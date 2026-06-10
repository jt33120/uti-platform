"""
Shared matching engine — one core, three entry points:
  * POST /matching/run             (manual, staff)
  * new CV submitted               (auto re-score, background task)
  * AO created                     (vivier recommendations, background task)

Vivier mode scores consultants from the talent pool BEFORE any partner has
submitted a CV, so staff see recommendations immediately. Those rows are
stored with submission_id=NULL and are naturally replaced by the first
submission-based run (which clears previous matchings for the AO).
"""
from typing import Optional
from services.supabase_client import supabase
from services.ai_matching import score_consultants_batch

# Keep vivier runs bounded — most recent consultants first
VIVIER_MAX_CONSULTANTS = 20


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


async def run_submission_matching(ao_id: str, ran_by: Optional[str], top_n: int = 3) -> dict:
    """
    Score every submitted CV for this AO and persist the top N.
    Raises LookupError (no AO / no submissions), ValueError (no readable CV
    or parse error) or RuntimeError (LLM API error).
    """
    try:
        ao = supabase.table("appels_offres").select("*").eq("id", ao_id).single().execute().data
    except Exception:
        raise LookupError("AO introuvable")

    submissions = supabase.table("submissions").select(
        "id, cv_text, consultant_id, consultants(id, name, tjm, skills, experience_years, employment_type)"
    ).eq("ao_id", ao_id).execute().data

    if not submissions:
        raise LookupError("Aucun CV soumis pour cet AO")

    # ai_matching round-trips on `id` — pass submission.id so results map back
    valid = []
    for s in submissions:
        c = s.get("consultants") or {}
        if not s.get("cv_text"):
            continue
        valid.append({
            "id": s["id"],
            "consultant_id": s["consultant_id"],
            "name": c.get("name", "Inconnu"),
            "tjm": c.get("tjm"),
            "skills": c.get("skills", ""),
            "experience_years": c.get("experience_years"),
            "cv_text": s["cv_text"],
        })

    if not valid:
        raise ValueError("Aucun CV lisible pour cet AO")

    all_scores, cost_usd = await score_consultants_batch(ao, valid)
    top_results = all_scores[:top_n]

    sub_index = {s["id"]: s for s in valid}
    for r in top_results:
        sub_id = r.get("consultant_id")  # ai_matching echoes our `id` here
        sub = sub_index.get(sub_id, {})
        r["submission_id"] = sub_id
        r["consultant_id"] = sub.get("consultant_id")
        r["consultant_name"] = sub.get("name")
        r["consultant_tjm"] = sub.get("tjm")
        r["consultant_skills"] = sub.get("skills")

    try:
        _persist(ao_id, top_results, cost_usd, ran_by)
    except Exception as e:
        print(f"[MATCHING] Warning: could not save results for AO {ao_id}: {e}")

    return {
        "ao_id": ao_id,
        "ao_title": ao["title"],
        "total_consultants_evaluated": len(valid),
        "top_n": top_n,
        "results": top_results,
    }


async def run_vivier_matching(ao_id: str, ran_by: Optional[str], top_n: int = 3) -> Optional[dict]:
    """
    Recommend consultants straight from the vivier for a freshly created AO.
    Only consultants owned by partners with active access to the AO's client
    (or by UTI staff) are eligible. Never raises — background-task friendly.
    """
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
        # profile sheet so the scorer always has something to read.
        valid = []
        for c in pool:
            cv = c.get("cv_text") or (
                f"Profil consultant (fiche vivier, CV non fourni)\n"
                f"Compétences : {c.get('skills') or 'N/A'}\n"
                f"Expérience : {c.get('experience_years') or 'N/A'} ans\n"
                f"TJM : {c.get('tjm') or 'N/A'} €/j\n"
                f"Disponibilité : {c.get('availability') or 'N/A'}\n"
                f"Statut : {c.get('employment_type') or 'N/A'}"
            )
            valid.append({
                "id": c["id"],
                "name": c.get("name", "Inconnu"),
                "tjm": c.get("tjm"),
                "skills": c.get("skills", ""),
                "experience_years": c.get("experience_years"),
                "cv_text": cv,
            })

        all_scores, cost_usd = await score_consultants_batch(ao, valid)
        top_results = all_scores[:top_n]
        for r in top_results:
            r["submission_id"] = None  # vivier recommendation — no CV submitted yet

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
