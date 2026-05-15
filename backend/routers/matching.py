from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.supabase_client import supabase
from services.ai_matching import score_consultants_batch
from routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/matching", tags=["matching"])


class MatchRequest(BaseModel):
    ao_id: str
    top_n: int = 3


@router.post("/run")
async def run_matching(body: MatchRequest, user: dict = Depends(require_admin)):
    """
    Score all consultants who have submitted a CV to this AO.
    Returns the top N scored submissions with breakdown + explanation.
    Admin only.
    """
    try:
        ao = supabase.table("appels_offres").select("*").eq("id", body.ao_id).single().execute().data
    except Exception:
        raise HTTPException(status_code=404, detail="AO introuvable")

    # Fetch submissions joined with consultant info
    try:
        submissions = supabase.table("submissions").select(
            "id, cv_text, consultant_id, consultants(id, name, tjm, skills, experience_years, employment_type)"
        ).eq("ao_id", body.ao_id).execute().data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur récupération soumissions: {str(e)}")

    if not submissions:
        raise HTTPException(status_code=404, detail="Aucun CV soumis pour cet AO")

    # Build the list the AI service expects. We pass submission.id as the id so
    # results round-trip back to the right submission row.
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
        raise HTTPException(status_code=422, detail="Aucun CV lisible pour cet AO")

    try:
        all_scores, cost_usd = await score_consultants_batch(ao, valid)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    top_results = all_scores[:body.top_n]

    # Re-map AI results: ai_matching uses "consultant_id" key but we passed
    # submission.id there. Recover both ids for storage.
    sub_index = {s["id"]: s for s in valid}
    for r in top_results:
        sub_id = r.get("consultant_id")  # this is submission.id from our perspective
        sub = sub_index.get(sub_id, {})
        r["submission_id"] = sub_id
        r["consultant_id"] = sub.get("consultant_id")
        r["consultant_name"] = sub.get("name")
        r["consultant_tjm"] = sub.get("tjm")
        r["consultant_skills"] = sub.get("skills")

    # Persist results: clear previous, insert new
    try:
        supabase.table("matchings").delete().eq("ao_id", body.ao_id).execute()
        for rank, result in enumerate(top_results, start=1):
            supabase.table("matchings").insert({
                "ao_id": body.ao_id,
                "submission_id": result["submission_id"],
                "consultant_id": result["consultant_id"],
                "score_total": result["score_total"],
                "breakdown": result["breakdown"],
                "points_forts": result["points_forts"],
                "points_faibles": result["points_faibles"],
                "resume_matching": result["resume_matching"],
                "recommandation": result["recommandation"],
                "rank": rank,
                "cost_usd": cost_usd,
                "ran_by": user["sub"],
            }).execute()
    except Exception as e:
        print(f"Warning: Could not save matching results: {e}")

    return {
        "ao_id": body.ao_id,
        "ao_title": ao["title"],
        "total_consultants_evaluated": len(valid),
        "top_n": body.top_n,
        "results": top_results,
    }


@router.get("/stats")
async def get_matching_stats(user: dict = Depends(require_admin)):
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
            "model_used": "GPT-4o",
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
            r["cv_url"] = s.get("cv_url")
            r["cv_filename"] = s.get("cv_filename")

        return {"ao_id": ao_id, "results": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
