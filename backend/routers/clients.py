from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
from routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/clients", tags=["clients"])


class ClientCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sector: Optional[str] = None
    logo_url: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sector: Optional[str] = None
    logo_url: Optional[str] = None


@router.post("")
async def create_client(body: ClientCreate, user: dict = Depends(require_admin)):
    try:
        response = supabase.table("clients").insert({
            "name": body.name,
            "description": body.description,
            "sector": body.sector,
            "logo_url": body.logo_url,
            "created_by": user["sub"],
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_clients(user: dict = Depends(get_current_user)):
    """
    Admin: sees all clients.
    Partner (ao): sees only clients they have list_1 or list_2 access to.
    """
    try:
        if user["role"] == "admin":
            response = supabase.table("clients").select("*").order("name").execute()
            return response.data

        # Partner: filter by access
        access = supabase.table("partner_clients").select("client_id, tier").eq(
            "partner_id", user["sub"]
        ).in_("tier", ["list_1", "list_2"]).execute()

        if not access.data:
            return []

        client_ids = [row["client_id"] for row in access.data]
        tiers = {row["client_id"]: row["tier"] for row in access.data}

        clients = supabase.table("clients").select("*").in_("id", client_ids).order("name").execute()
        # Annotate each client with the partner's tier
        for c in clients.data:
            c["tier"] = tiers.get(c["id"])
        return clients.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{client_id}")
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    try:
        response = supabase.table("clients").select("*").eq("id", client_id).single().execute()
        return response.data
    except Exception:
        raise HTTPException(status_code=404, detail="Client introuvable")


@router.patch("/{client_id}")
async def update_client(client_id: str, body: ClientUpdate, user: dict = Depends(require_admin)):
    try:
        update_data = body.model_dump(exclude_none=True)
        response = supabase.table("clients").update(update_data).eq("id", client_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(require_admin)):
    try:
        supabase.table("clients").delete().eq("id", client_id).execute()
        return {"message": "Client supprimé"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
