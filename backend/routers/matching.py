from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.supabase_client import supabase
from services.matching_runner import run_submission_matching
from services import storage
from routers.auth import get_current_user, require_staff
from services.ratelimit import rate_limit

router = APIRouter(prefix="/matching", tags=["matching"])


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

        return {
            "total_matchings": len(matchings),
            "model_used": "Claude 3.5 Haiku",
            "total_cost_usd": round(total_cost, 2),
            "status": "active",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/results/{ao_id}")
async def get_matching_results(ao_id: str, user: dict = Depends(get_current_user)):
    try:
        query = supabase.table("matchings").select(
            "*, consultants(name, tjm, skills, employment_type), submissions(cv_url, cv_filename)"
        ).eq("ao_id", ao_id).order("rank")

        if user["role"] == "ao":
            # Partners only see results for their own submissions
            own_subs = supabase.table("submissions").select("id").eq(
                "ao_id", ao_id
            ).eq("submitted_by", user["sub"]).execute().data or []
            own_ids = [s["id"] for s in own_subs]
            if not own_ids:
                return {"ao_id": ao_id, "results": []}
            query = query.in_("submission_id", own_ids)

        response = query.execute()
        for r in response.data or []:
            c = r.get("consultants") or {}
            s = r.get("submissions") or {}
            r["consultant_name"] = c.get("name")
            r["consultant_tjm"] = c.get("tjm")
            r["consultant_skills"] = c.get("skills")
            r["employment_type"] = c.get("employment_type")
            r["cv_url"] = storage.signed_cv_url(s.get("cv_url"))
            r["cv_filename"] = s.get("cv_filename")

        return {"ao_id": ao_id, "results": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
