import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from services.supabase_client import supabase
from routers.auth import require_admin
from config import settings

router = APIRouter(prefix="/invitations", tags=["invitations"])


class CreateInviteRequest(BaseModel):
    email: EmailStr
    name: str  # Partner name set by admin


def _is_expired(expires_at: str) -> bool:
    dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    return dt < datetime.now(timezone.utc)


@router.post("")
async def create_invitation(body: CreateInviteRequest, user: dict = Depends(require_admin)):
    """
    Create a single-use, time-limited invitation link for a partner (role='ao').
    The admin sets both the email and the display name of the partner.
    If a pending unused invite already exists for this email, it is revoked and replaced.
    """
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Le nom du partenaire doit contenir au moins 2 caractères.")

    # Revoke any existing unused invites for this email
    supabase.table("invitations").delete() \
        .eq("email", body.email).is_("used_at", "null").execute()

    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    supabase.table("invitations").insert({
        "token": token,
        "email": body.email,
        "name": name,
        "role": "ao",
        "invited_by": user["sub"],
        "expires_at": expires_at,
    }).execute()

    invite_url = f"{settings.frontend_url}/register?invite={token}"
    return {"url": invite_url, "email": body.email, "name": name, "expires_in_days": 7}


@router.get("/validate/{token}")
async def validate_invitation(token: str):
    """
    Public endpoint: validate an invite token.
    Returns invite metadata (email, name, role) if valid; 400/410 otherwise.
    """
    try:
        result = supabase.table("invitations").select("*").eq("token", token).single().execute()
    except Exception:
        raise HTTPException(status_code=400, detail="Lien d'invitation invalide.")

    inv = result.data
    if not inv:
        raise HTTPException(status_code=400, detail="Lien d'invitation invalide.")
    if inv.get("used_at"):
        raise HTTPException(status_code=410, detail="Ce lien d'invitation a déjà été utilisé.")
    if _is_expired(inv["expires_at"]):
        raise HTTPException(status_code=410, detail="Ce lien d'invitation a expiré.")

    return {"email": inv["email"], "name": inv.get("name", ""), "role": inv["role"], "valid": True}
