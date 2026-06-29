from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.supabase_client import supabase
from services.matching_runner import run_submission_matching
from services import storage, audit
from routers.auth import get_current_user, require_staff
from services.ratelimit import rate_limit

router = APIRouter(prefix="/matching", tags=["matching"])

VALID_CONTACT_STATUS = ("none", "contacted", "proposed")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fetch_states(ao_id: str) -> dict:
    """État humain (classement + contact) par consultant. Best-effort (table absente → {})."""
    try:
        rows = supabase.table("ao_consultant_state").select("*").eq("ao_id", ao_id).execute().data or []
        return {r["consultant_id"]: r for r in rows}
    except Exception:
        return {}


class MatchRequest(BaseModel):
    ao_id: str
    top_n: int = 3


@router.post("/run", dependencies=[Depends(rate_limit(10, 60))])
async def run_matching(body: MatchRequest, user: dict = Depends(require_staff)):
    """
    Score all consultants who have submitted a CV to this AO.
    Returns the top N scored submissions with breakdown + explanation.
    UTI staff (admin or commerce). Also runs automatically when a new CV
    is submitted — this endpoint remains for manual re-runs.
    """
    try:
        return await run_submission_matching(body.ao_id, user["sub"], body.top_n)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/stats")
async def get_matching_stats(user: dict = Depends(require_staff)):
    """Get AI matching statistics: total matchings, model used, total cost."""
    try:
        # Try with cost_usd column; fall back if column doesn't exist yet
        try:
            matchings = supabase.table("matchings").select("id, cost_usd").execute().data or []
            total_cost = sum(float(m.get("cost_usd") or 0) for m in matchings)
        except Exception:
            matchings = supabase.table("matchings").select("id").execute().data or []
            total_cost = 0.0

        from services.ai_matching import EXTRACTION_MODEL
        from services.scoring import GRID_VERSION

        return {
            "total_matchings": len(matchings),
            # Architecture hybride : le LLM extrait, le score est déterministe.
            "extraction_model": EXTRACTION_MODEL,
            "scoring": "déterministe",
            "grid_version": GRID_VERSION,
            "total_cost_usd": round(total_cost, 2),
            "status": "active",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _partner_emails(results: list[dict]) -> dict:
    """submission_id → {name, email} du partenaire ayant soumis le CV (pour le mailto)."""
    sub_ids = [r["submission_id"] for r in results if r.get("submission_id")]
    if not sub_ids:
        return {}
    try:
        subs = supabase.table("submissions").select("id, submitted_by").in_("id", sub_ids).execute().data or []
        by_sub = {s["id"]: s.get("submitted_by") for s in subs}
        pids = [p for p in by_sub.values() if p]
        profs = supabase.table("profiles").select("id, name, email").in_("id", pids).execute().data or [] if pids else []
        by_pid = {p["id"]: p for p in profs}
        return {sid: by_pid.get(pid, {}) for sid, pid in by_sub.items() if pid}
    except Exception:
        return {}


@router.get("/results/{ao_id}")
async def get_matching_results(ao_id: str, user: dict = Depends(get_current_user)):
    try:
        query = supabase.table("matchings").select(
            "*, consultants(name, tjm, skills, employment_type), submissions(cv_url, cv_filename)"
        ).eq("ao_id", ao_id).order("rank")

        is_partner = user["role"] == "ao"
        if is_partner:
            # Partners only see results for their own submissions
            own_subs = supabase.table("submissions").select("id").eq(
                "ao_id", ao_id
            ).eq("submitted_by", user["sub"]).execute().data or []
            own_ids = [s["id"] for s in own_subs]
            if not own_ids:
                return {"ao_id": ao_id, "results": []}
            query = query.in_("submission_id", own_ids)

        response = query.execute()
        results = response.data or []
        states = _fetch_states(ao_id)
        # Email partenaire : seulement côté staff (le partenaire n'a pas à se contacter lui-même).
        partners = {} if is_partner else _partner_emails(results)

        for r in results:
            c = r.get("consultants") or {}
            s = r.get("submissions") or {}
            r["consultant_name"] = c.get("name")
            r["consultant_tjm"] = c.get("tjm")
            r["consultant_skills"] = c.get("skills")
            r["employment_type"] = c.get("employment_type")
            r["cv_url"] = storage.signed_cv_url(s.get("cv_url"))
            r["cv_filename"] = s.get("cv_filename")
            # État humain : classement choisi par l'opérateur + suivi de contact.
            st = states.get(r.get("consultant_id")) or {}
            r["human_rank"] = st.get("human_rank")
            r["contact_status"] = st.get("contact_status") or "none"
            r["contacted_at"] = st.get("contacted_at")
            if not is_partner:
                p = partners.get(r.get("submission_id")) or {}
                r["partner_name"] = p.get("name")
                r["partner_email"] = p.get("email")

        # L'humain a le dernier mot : son classement prime, sinon le rang IA.
        results.sort(key=lambda r: (r.get("human_rank") is None, r.get("human_rank") or 0, r.get("rank") or 0))
        return {"ao_id": ao_id, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RankRequest(BaseModel):
    order: list[str]  # consultant_ids dans l'ordre voulu par l'opérateur


@router.post("/{ao_id}/rank")
async def set_human_rank(ao_id: str, body: RankRequest, user: dict = Depends(require_staff)):
    """Enregistre le classement humain (AI Act Art. 14 — l'humain a le dernier mot)."""
    now = _now_iso()
    try:
        for idx, cid in enumerate(body.order, start=1):
            supabase.table("ao_consultant_state").upsert({
                "ao_id": ao_id,
                "consultant_id": cid,
                "human_rank": idx,
                "decided_by": user["sub"],
                "updated_at": now,
            }, on_conflict="ao_id,consultant_id").execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur enregistrement classement: {e}")
    audit.log_event(
        "human_rank", audit.new_run_id(), ao_id=ao_id, actor_id=user["sub"],
        payload={"order": body.order},
    )
    return {"ok": True, "order": body.order}


class ContactRequest(BaseModel):
    consultant_id: str
    submission_id: str | None = None
    status: str  # 'none' | 'contacted' | 'proposed'


@router.post("/{ao_id}/contact")
async def set_contact_status(ao_id: str, body: ContactRequest, user: dict = Depends(require_staff)):
    """Marque un consultant comme contacté / proposé (suivi de diffusion)."""
    if body.status not in VALID_CONTACT_STATUS:
        raise HTTPException(status_code=422, detail=f"status doit être l'un de {VALID_CONTACT_STATUS}")
    now = _now_iso()
    payload = {
        "ao_id": ao_id,
        "consultant_id": body.consultant_id,
        "contact_status": body.status,
        "decided_by": user["sub"],
        "updated_at": now,
    }
    if body.status in ("contacted", "proposed"):
        payload["contacted_at"] = now
    try:
        row = supabase.table("ao_consultant_state").upsert(
            payload, on_conflict="ao_id,consultant_id"
        ).execute().data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur mise à jour contact: {e}")
    audit.log_event(
        "contact", audit.new_run_id(), ao_id=ao_id, actor_id=user["sub"],
        payload={"consultant_id": body.consultant_id, "status": body.status},
    )
    return row
