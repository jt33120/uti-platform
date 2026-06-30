"""
Admin supervision console (admin only):
  * accounts  — every profile with role + last connection, delete account
  * tickets   — support messages with an open/resolved workflow
  * overview  — high-level KPIs (accounts by role, activity over 30 days)
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Literal, Optional
import httpx

from services.supabase_client import supabase
from services.app_settings import get_notification_settings, set_notification_settings
from routers.auth import require_admin
from config import settings

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview")
async def overview(user: dict = Depends(require_admin)):
    """KPIs for the supervision page. Each block is best-effort."""
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    def _count(table, **filters):
        try:
            q = supabase.table(table).select("id")
            for k, v in filters.items():
                q = q.eq(k, v)
            return len(q.execute().data or [])
        except Exception:
            return None

    profiles = []
    try:
        profiles = supabase.table("profiles").select("id, role, last_login_at").execute().data or []
    except Exception:
        try:
            profiles = supabase.table("profiles").select("id, role").execute().data or []
        except Exception:
            pass

    by_role = {}
    active_30d = 0
    for p in profiles:
        by_role[p["role"]] = by_role.get(p["role"], 0) + 1
        if p.get("last_login_at") and p["last_login_at"] >= since:
            active_30d += 1

    def _count_since(table, ts_col):
        try:
            rows = supabase.table(table).select("id").gte(ts_col, since).execute().data
            return len(rows or [])
        except Exception:
            return None

    tickets_open = None
    try:
        rows = supabase.table("support_messages").select("id, status").execute().data or []
        tickets_open = sum(1 for r in rows if r.get("status", "open") != "resolved")
    except Exception:
        try:
            tickets_open = len(supabase.table("support_messages").select("id").execute().data or [])
        except Exception:
            pass

    # Coût IA cumulé — métrique sensible réservée aux admins (cet endpoint est
    # require_admin). Elle n'apparaît volontairement pas sur le dashboard staff.
    matchings_total = None
    matching_cost_usd = None
    try:
        rows = supabase.table("matchings").select("cost_usd").execute().data or []
        matchings_total = len(rows)
        matching_cost_usd = round(sum(float(r.get("cost_usd") or 0) for r in rows), 2)
    except Exception:
        try:
            matchings_total = len(supabase.table("matchings").select("id").execute().data or [])
        except Exception:
            pass

    return {
        "accounts_total": len(profiles),
        "accounts_by_role": by_role,
        "active_accounts_30d": active_30d,
        "aos_total": _count("appels_offres"),
        "aos_open": _count("appels_offres", status="open"),
        "aos_30d": _count_since("appels_offres", "created_at"),
        "submissions_30d": _count_since("submissions", "submitted_at"),
        "matchings_30d": _count_since("matchings", "created_at"),
        "matchings_total": matchings_total,
        "matching_cost_usd": matching_cost_usd,
        "tickets_open": tickets_open,
    }


@router.get("/accounts")
async def list_accounts(user: dict = Depends(require_admin)):
    """All accounts (admin, commerce, partners) + pending invitations."""
    try:
        accounts = supabase.table("profiles").select(
            "id, email, name, role, org, status, created_at, last_login_at, last_login_ip, avatar_url, mfa_enabled, mfa_required"
        ).order("created_at", desc=True).execute().data or []
    except Exception:
        # colonnes (org/status/last_login_*/mfa_*) pas encore migrées — dégrade proprement
        try:
            accounts = supabase.table("profiles").select(
                "id, email, name, role, org, status, created_at, last_login_at, avatar_url"
            ).order("created_at", desc=True).execute().data or []
        except Exception:
            accounts = supabase.table("profiles").select(
                "id, email, name, role, created_at, avatar_url"
            ).order("created_at", desc=True).execute().data or []

    pending = []
    try:
        now = datetime.now(timezone.utc).isoformat()
        try:
            pending = supabase.table("invitations").select(
                "id, email, name, role, org, expires_at, created_at"
            ).is_("used_at", "null").gte("expires_at", now).order(
                "created_at", desc=True
            ).execute().data or []
        except Exception:
            # 'org' column not migrated yet — degrade gracefully.
            pending = supabase.table("invitations").select(
                "id, email, name, role, expires_at, created_at"
            ).is_("used_at", "null").gte("expires_at", now).order(
                "created_at", desc=True
            ).execute().data or []
    except Exception:
        pass

    return {"accounts": accounts, "pending_invitations": pending}


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[Literal["admin", "commerce", "ao"]] = None
    org: Optional[Literal["uti", "groupement-it"]] = None
    status: Optional[Literal["active", "suspended", "disabled"]] = None


@router.patch("/accounts/{account_id}")
async def update_account(account_id: str, body: AccountUpdate, user: dict = Depends(require_admin)):
    """
    Admin edit of any account: display name, email, role, commercial entity and
    status (active / suspended / disabled). Email changes are propagated to the
    Supabase Auth user. An admin cannot change their own role or status (anti
    self-lockout) — name/email are still allowed.
    """
    is_self = account_id == user["sub"]
    if is_self and (body.role is not None or (body.status is not None and body.status != "active")):
        raise HTTPException(
            status_code=400,
            detail="Vous ne pouvez pas modifier votre propre rôle ni suspendre votre propre compte.",
        )

    profile_update: dict = {}
    if body.name is not None:
        name = body.name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=422, detail="Le nom doit contenir au moins 2 caractères.")
        profile_update["name"] = name
    if body.email is not None:
        profile_update["email"] = body.email
    if body.role is not None:
        profile_update["role"] = body.role
    if body.status is not None:
        profile_update["status"] = body.status
    # org only meaningful for sales accounts; normalise UTI → NULL.
    if body.org is not None or body.role is not None:
        effective_role = body.role if body.role is not None else None
        if body.org is not None:
            profile_update["org"] = body.org if body.org == "groupement-it" else None
        elif effective_role in ("admin", "ao"):
            profile_update["org"] = None

    if not profile_update:
        raise HTTPException(status_code=422, detail="Aucune modification fournie.")

    # Propagate an email change to the Supabase Auth user first.
    if body.email is not None:
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.put(
                    f"{settings.supabase_url}/auth/v1/admin/users/{account_id}",
                    headers={
                        "apikey": settings.supabase_service_key,
                        "Authorization": f"Bearer {settings.supabase_service_key}",
                        "Content-Type": "application/json",
                    },
                    json={"email": body.email, "email_confirm": True},
                )
            if resp.status_code >= 400:
                raise HTTPException(status_code=400, detail="Impossible de mettre à jour l'email (déjà utilisé ?).")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=502, detail="Service d'authentification indisponible.")

    try:
        updated = supabase.table("profiles").update(profile_update).eq("id", account_id).execute()
    except Exception as e:
        # 'org'/'status' columns missing — retry without them so the rest applies.
        profile_update.pop("org", None)
        profile_update.pop("status", None)
        if not profile_update:
            raise HTTPException(status_code=500, detail="Colonnes org/status absentes : migration requise.")
        updated = supabase.table("profiles").update(profile_update).eq("id", account_id).execute()

    if not updated.data:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    return updated.data[0]


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, user: dict = Depends(require_admin)):
    """Permanently delete any account (profile + Supabase Auth user)."""
    if account_id == user["sub"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte.")
    try:
        supabase.table("profiles").delete().eq("id", account_id).execute()
        with httpx.Client(timeout=10) as client:
            client.delete(
                f"{settings.supabase_url}/auth/v1/admin/users/{account_id}",
                headers={
                    "apikey": settings.supabase_service_key,
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                },
            )
        return {"message": "Compte supprimé"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class NotificationSettings(BaseModel):
    enabled: Optional[bool] = None
    list2_delay_days: Optional[int] = None
    relance_auto_enabled: Optional[bool] = None
    relance_interval_days: Optional[int] = None
    relance_max: Optional[int] = None


@router.get("/settings")
async def get_settings(user: dict = Depends(require_admin)):
    """Réglages globaux pilotés par l'admin (notifications + relances)."""
    return {"notifications": get_notification_settings()}


@router.put("/settings/notifications")
async def update_notif_settings(body: NotificationSettings, user: dict = Depends(require_admin)):
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=422, detail="Aucun réglage fourni.")
    return {"notifications": set_notification_settings(patch)}


@router.get("/tickets")
async def list_tickets(user: dict = Depends(require_admin)):
    try:
        return supabase.table("support_messages").select("*").order(
            "created_at", desc=True
        ).execute().data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TicketUpdate(BaseModel):
    status: Literal["open", "resolved"]


@router.patch("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, body: TicketUpdate, user: dict = Depends(require_admin)):
    try:
        response = supabase.table("support_messages").update(
            {"status": body.status}
        ).eq("id", ticket_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Ticket introuvable")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
