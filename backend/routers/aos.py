from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
from routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/aos", tags=["appels_offres"])


class AOCreate(BaseModel):
    client_id: str
    title: str
    description: str
    skills_required: str
    budget_max: Optional[int] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    context: Optional[str] = None


class AOUpdate(BaseModel):
    client_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    skills_required: Optional[str] = None
    budget_max: Optional[int] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    context: Optional[str] = None
    status: Optional[str] = None


def _accessible_client_ids(user: dict) -> Optional[list[str]]:
    """
    Returns the list of client_ids a partner can see, or None for admin (= all).
    Suspended access is excluded.
    """
    if user["role"] == "admin":
        return None
    access = supabase.table("partner_clients").select("client_id").eq(
        "partner_id", user["sub"]
    ).in_("tier", ["list_1", "list_2"]).execute()
    return [row["client_id"] for row in (access.data or [])]


@router.post("")
async def create_ao(body: AOCreate, user: dict = Depends(require_admin)):
    try:
        response = supabase.table("appels_offres").insert({
            "client_id": body.client_id,
            "title": body.title,
            "description": body.description,
            "skills_required": body.skills_required,
            "budget_max": body.budget_max,
            "location": body.location,
            "duration": body.duration,
            "context": body.context,
            "status": "open",
            "created_by": user["sub"],
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_aos(user: dict = Depends(get_current_user)):
    """
    Returns AOs with client info + submission count.
    Partners see only AOs from clients they have list_1/list_2 access to.
    Response is annotated with partner tier (`tier`) when applicable so the
    frontend can group by tier.
    """
    try:
        ids = _accessible_client_ids(user)
        query = supabase.table("appels_offres").select(
            "*, clients(id, name, sector, logo_url), submissions(count)"
        ).order("created_at", desc=True)

        if ids is not None:
            if not ids:
                return []
            query = query.in_("client_id", ids)

        aos = query.execute().data

        # Flatten the submissions count into `submission_count`
        for ao in aos:
            subs = ao.get("submissions")
            if isinstance(subs, list) and subs:
                ao["submission_count"] = subs[0].get("count", 0)
            else:
                ao["submission_count"] = 0
            ao.pop("submissions", None)

        # Attach the partner's tier per client
        if user["role"] == "ao":
            access = supabase.table("partner_clients").select("client_id, tier").eq(
                "partner_id", user["sub"]
            ).execute().data or []
            tiers = {row["client_id"]: row["tier"] for row in access}
            for ao in aos:
                ao["tier"] = tiers.get(ao["client_id"])

        return aos
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ao_id}")
async def get_ao(ao_id: str, user: dict = Depends(get_current_user)):
    try:
        response = supabase.table("appels_offres").select(
            "*, clients(id, name, sector, description, logo_url), submissions(count)"
        ).eq("id", ao_id).single().execute()
        ao = response.data

        # Access check for partners
        if user["role"] == "ao":
            access = supabase.table("partner_clients").select("tier").eq(
                "partner_id", user["sub"]
            ).eq("client_id", ao["client_id"]).in_("tier", ["list_1", "list_2"]).execute()
            if not access.data:
                raise HTTPException(status_code=403, detail="Accès refusé à cet AO")
            ao["tier"] = access.data[0]["tier"]

        subs = ao.get("submissions")
        if isinstance(subs, list) and subs:
            ao["submission_count"] = subs[0].get("count", 0)
        else:
            ao["submission_count"] = 0
        ao.pop("submissions", None)

        return ao
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="AO introuvable")


@router.patch("/{ao_id}")
async def update_ao(ao_id: str, body: AOUpdate, user: dict = Depends(require_admin)):
    try:
        update_data = body.model_dump(exclude_none=True)
        response = supabase.table("appels_offres").update(update_data).eq("id", ao_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{ao_id}")
async def delete_ao(ao_id: str, user: dict = Depends(require_admin)):
    try:
        supabase.table("appels_offres").delete().eq("id", ao_id).execute()
        return {"message": "AO supprimé"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
