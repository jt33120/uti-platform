"""
Moteur de matching — orchestration hybride (AI Act Phase 3).

Pipeline : CV → [extraction LLM, pseudonymisée] → features → [scoring déterministe]
→ persistance + journal d'audit. Trois points d'entrée :
  * POST /matching/run             (manuel, staff)
  * new CV submitted               (auto re-score, background task)
  * AO created                     (vivier recommendations, background task)

Vivier mode scores consultants from the talent pool BEFORE any partner has
submitted a CV, so staff see recommendations immediately. Those rows are
stored with submission_id=NULL and are naturally replaced by the first
submission-based run (which clears previous matchings for the AO).
"""
import asyncio
from typing import Optional
from services.supabase_client import supabase
from services.ai_matching import extract_features, EXTRACTION_MODEL
from services.scoring import score_consultant, GRID_VERSION
from services.scoring_settings import get_config
from services.pseudonymize import strip_pii
from services import audit

# Keep vivier runs bounded — most recent consultants first
VIVIER_MAX_CONSULTANTS = 20


async def _features_for(item: dict) -> tuple[dict, float]:
    """Extraction pseudonymisée des features d'un candidat (best-effort)."""
    clean = strip_pii(item.get("cv_text"), item.get("name"))
    return await extract_features(clean)


def _persist(ao_id: str, results: list[dict], cost_usd: float, ran_by: Optional[str]):
    """Replace previous matchings for this AO with the new top results."""
    supabase.table("matchings").delete().eq("ao_id", ao_id).execute()
    for rank, r in enumerate(results, start=1):
        supabase.table("matchings").insert({
            "ao_id": ao_id,
            "submission_id": r.get("submission_id"),
            "consultant_id": r.get("consultant_id"),
            "score_total": r["score_total"],
            "breakdown": r.get("breakdown"),
            "points_forts": r.get("points_forts"),
            "points_faibles": r.get("points_faibles"),
            "resume_matching": r.get("resume_matching"),
            "recommandation": r.get("recommandation"),
            "rank": rank,
            "cost_usd": cost_usd,
            "ran_by": ran_by,
        }).execute()


async def _score_all(
    ao: dict, items: list[dict], run_id: str, ran_by: Optional[str]
) -> tuple[list[dict], float]:
    """Extrait (concurremment) puis score chaque candidat ; journalise chaque score."""
    config = get_config()  # surcharges de grille pilotées par l'admin (best-effort)
    extracted = await asyncio.gather(*[_features_for(it) for it in items])
    total_cost = 0.0
    results: list[dict] = []
    for it, (features, cost) in zip(items, extracted):
        total_cost += cost
        score = score_consultant(features, it, ao, config)
        score["submission_id"] = it.get("submission_id")
        score["consultant_id"] = it.get("consultant_id")
        score["consultant_name"] = it.get("name")
        score["consultant_tjm"] = it.get("tjm")
        score["consultant_skills"] = it.get("skills")
        results.append(score)
        audit.log_event(
            "score", run_id,
            ao_id=ao.get("id"), actor_id=ran_by,
            model_version=EXTRACTION_MODEL, grid_version=GRID_VERSION,
            input_hash=audit.features_hash(features),
            payload={
                "submission_id": it.get("submission_id"),
                "consultant_id": it.get("consultant_id"),
                "score_total": score["score_total"],
                "breakdown": score["breakdown"],
                "recommandation": score["recommandation"],
            },
        )
    results.sort(key=lambda r: r["score_total"], reverse=True)
    return results, total_cost


async def run_submission_matching(ao_id: str, ran_by: Optional[str], top_n: int = 3) -> dict:
    """
    Score every submitted CV for this AO and persist the top N.
    Raises LookupError (no AO / no submissions) or ValueError (no readable CV).
    """
    run_id = audit.new_run_id()
    try:
        ao = supabase.table("appels_offres").select("*").eq("id", ao_id).single().execute().data
    except Exception:
        raise LookupError("AO introuvable")

    submissions = supabase.table("submissions").select(
        "id, cv_text, consultant_id, consultants(id, name, tjm, skills, experience_years, employment_type)"
    ).eq("ao_id", ao_id).execute().data

    if not submissions:
        raise LookupError("Aucun CV soumis pour cet AO")

    items = []
    for s in submissions:
        c = s.get("consultants") or {}
        if not s.get("cv_text"):
            continue
        items.append({
            "submission_id": s["id"],
            "consultant_id": s["consultant_id"],
            "name": c.get("name", "Inconnu"),
            "tjm": c.get("tjm"),
            "skills": c.get("skills", ""),
            "experience_years": c.get("experience_years"),
            "cv_text": s["cv_text"],
        })

    if not items:
        raise ValueError("Aucun CV lisible pour cet AO")

    audit.log_event(
        "run_start", run_id, ao_id=ao_id, actor_id=ran_by,
        model_version=EXTRACTION_MODEL, grid_version=GRID_VERSION,
        payload={"trigger": "submission", "candidates": len(items)},
    )

    results, cost_usd = await _score_all(ao, items, run_id, ran_by)
    top_results = results[:top_n]

    try:
        _persist(ao_id, top_results, cost_usd, ran_by)
    except Exception as e:
        audit.log_event(
            "error", run_id, ao_id=ao_id, severity="error",
            payload={"stage": "persist", "error": str(e)},
        )
        print(f"[MATCHING] Warning: could not save results for AO {ao_id}: {e}")

    return {
        "ao_id": ao_id,
        "ao_title": ao["title"],
        "total_consultants_evaluated": len(items),
        "top_n": top_n,
        "results": top_results,
    }


async def run_vivier_matching(ao_id: str, ran_by: Optional[str], top_n: int = 3) -> Optional[dict]:
    """
    Recommend consultants straight from the vivier for a freshly created AO.
    Only consultants owned by partners with active access to the AO's client
    (or by UTI staff) are eligible. Never raises — background-task friendly.
    """
    run_id = audit.new_run_id()
    try:
        ao = supabase.table("appels_offres").select("*").eq("id", ao_id).single().execute().data
        if not ao:
            return None

        # Don't overwrite real submission-based results
        existing = supabase.table("submissions").select("id").eq("ao_id", ao_id).limit(1).execute().data
        if existing:
            return None

        # Eligible owners: partners with list_1/list_2 on the client + UTI staff
        eligible_ids = set()
        if ao.get("client_id"):
            rows = supabase.table("partner_clients").select("partner_id").eq(
                "client_id", ao["client_id"]
            ).in_("tier", ["list_1", "list_2"]).execute().data or []
            eligible_ids = {r["partner_id"] for r in rows}
        staff = supabase.table("profiles").select("id").in_(
            "role", ["admin", "commerce"]
        ).execute().data or []
        eligible_ids |= {r["id"] for r in staff}

        consultants = supabase.table("consultants").select("*").order(
            "created_at", desc=True
        ).limit(200).execute().data or []
        pool = [c for c in consultants if c.get("created_by") in eligible_ids][:VIVIER_MAX_CONSULTANTS]
        if not pool:
            return None

        # CVs are anonymised / often absent in the vivier — fall back to a
        # profile sheet so the extractor always has something to read.
        items = []
        for c in pool:
            cv = c.get("cv_text") or (
                f"Profil consultant (fiche vivier, CV non fourni)\n"
                f"Compétences : {c.get('skills') or 'N/A'}\n"
                f"Expérience : {c.get('experience_years') or 'N/A'} ans\n"
                f"TJM : {c.get('tjm') or 'N/A'} €/j\n"
                f"Disponibilité : {c.get('availability') or 'N/A'}\n"
                f"Statut : {c.get('employment_type') or 'N/A'}"
            )
            items.append({
                "submission_id": None,  # vivier recommendation — no CV submitted yet
                "consultant_id": c["id"],
                "name": c.get("name", "Inconnu"),
                "tjm": c.get("tjm"),
                "skills": c.get("skills", ""),
                "experience_years": c.get("experience_years"),
                "cv_text": cv,
            })

        audit.log_event(
            "run_start", run_id, ao_id=ao_id, actor_id=ran_by,
            model_version=EXTRACTION_MODEL, grid_version=GRID_VERSION,
            payload={"trigger": "vivier", "candidates": len(items)},
        )

        results, cost_usd = await _score_all(ao, items, run_id, ran_by)
        top_results = results[:top_n]
        _persist(ao_id, top_results, cost_usd, ran_by)
        return {"ao_id": ao_id, "results": top_results}
    except Exception as e:
        print(f"[MATCHING] vivier matching failed for AO {ao_id}: {e}")
        return None


async def auto_rescore_ao(ao_id: str, ran_by: Optional[str]):
    """Background task: re-score an AO after a new CV lands. Never raises."""
    try:
        await run_submission_matching(ao_id, ran_by)
        print(f"[MATCHING] auto re-score done for AO {ao_id}")
    except Exception as e:
        print(f"[MATCHING] auto re-score skipped for AO {ao_id}: {e}")
