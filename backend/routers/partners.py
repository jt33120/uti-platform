from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Literal
from services.supabase_client import supabase
from routers.auth import get_current_user, require_admin
from config import settings
import httpx

router = APIRouter(prefix="/partners", tags=["partners"])


class AccessUpsert(BaseModel):
    partner_id: str
    client_id: str
    tier: Literal["list_1", "list_2", "suspended"]


class PartnerUpdate(BaseModel):
    name: str


@router.get("")
async def list_partners(user: dict = Depends(require_admin)):
    """List all users with role='ao' (partners)."""
    try:
        response = supabase.table("profiles").select(
            "id, email, name, role, created_at"
        ).eq("role", "ao").order("name").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/access")
async def list_all_access(user: dict = Depends(require_admin)):
    """Return all partner_clients rows. Used to build the access matrix UI."""
    try:
        response = supabase.table("partner_clients").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/access")
async def upsert_access(body: AccessUpsert, user: dict = Depends(require_admin)):
    """
    Set or update a partner's tier for a client.
    Tier values: 'list_1', 'list_2', 'suspended'.
    """
    try:
        # Check if row exists
        existing = supabase.table("partner_clients").select("id").eq(
            "partner_id", body.partner_id
        ).eq("client_id", body.client_id).execute()

        if existing.data:
            response = supabase.table("partner_clients").update({
                "tier": body.tier,
                "assigned_by": user["sub"],
            }).eq("partner_id", body.partner_id).eq("client_id", body.client_id).execute()
        else:
            response = supabase.table("partner_clients").insert({
                "partner_id": body.partner_id,
                "client_id": body.client_id,
                "tier": body.tier,
                "assigned_by": user["sub"],
            }).execute()

        return response.data[0] if response.data else {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{partner_id}/suspend")
async def suspend_partner_globally(partner_id: str, user: dict = Depends(require_admin)):
    """Set all existing partner_clients rows for this partner to 'suspended'."""
    try:
        supabase.table("partner_clients").update({
            "tier": "suspended",
            "assigned_by": user["sub"],
        }).eq("partner_id", partner_id).execute()
        return {"message": "Partenaire suspendu sur tous les clients"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/access")
async def remove_access(partner_id: str, client_id: str, user: dict = Depends(require_admin)):
    """Remove a partner's access to a client entirely."""
    try:
        supabase.table("partner_clients").delete().eq(
            "partner_id", partner_id
        ).eq("client_id", client_id).execute()
        return {"message": "Accès retiré"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{partner_id}")
async def update_partner(partner_id: str, body: PartnerUpdate, user: dict = Depends(require_admin)):
    """Update a partner's display name."""
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Le nom doit contenir au moins 2 caractères.")
    try:
        response = supabase.table("profiles").update({"name": name}).eq(
            "id", partner_id
        ).eq("role", "ao").execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Partenaire introuvable.")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{partner_id}")
async def delete_partner(partner_id: str, user: dict = Depends(require_admin)):
    """
    Permanently delete a partner: removes their profile row (which cascades
    to partner_clients) and their Supabase Auth account.
    """
    try:
        # Delete profile row — partner_clients FK cascades automatically
        supabase.table("profiles").delete().eq("id", partner_id).eq("role", "ao").execute()
        # Delete Supabase Auth user via direct HTTP (bypasses gotrue-py header bug)
        with httpx.Client(timeout=10) as client:
            client.delete(
                f"{settings.supabase_url}/auth/v1/admin/users/{partner_id}",
                headers={
                    "apikey": settings.supabase_service_key,
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                },
            )
        return {"message": "Partenaire supprimé"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
