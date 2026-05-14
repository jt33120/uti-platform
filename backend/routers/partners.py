from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Literal
from services.supabase_client import supabase
from routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/partners", tags=["partners"])


class AccessUpsert(BaseModel):
    partner_id: str
    client_id: str
    tier: Literal["list_1", "list_2", "suspended"]


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
