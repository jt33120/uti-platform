import re
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from services.supabase_client import supabase
from services.email import send_email
from routers.auth import require_admin
from config import settings

router = APIRouter(prefix="/invitations", tags=["invitations"])


class CreateInviteRequest(BaseModel):
    email: EmailStr
    name: str  # Display name set by admin
    role: Literal["ao", "commerce"] = "ao"  # partner (default) or sales
    # Commercial entity (only meaningful when role == 'commerce').
    # None / 'uti' → Commercial UTI ; 'groupement-it' → Commercial Groupement-IT.
    org: Optional[Literal["uti", "groupement-it"]] = None


def _is_expired(expires_at: str) -> bool:
    dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    return dt < datetime.now(timezone.utc)


def _greeting_name(name: str) -> str:
    """
    Friendly first name for the email greeting. If the admin accidentally typed
    an email address as the display name (e.g. 'christelle.pelouin@grp-it.com'),
    derive a capitalised first name ('Christelle') instead of greeting an address.
    """
    n = (name or "").strip()
    if "@" in n:
        first = re.split(r"[._\-+]", n.split("@", 1)[0])[0]
        return first.capitalize() if first else n
    return n


def _send_invite_email(to_email: str, partner_name: str, invite_url: str, role: str = "ao") -> tuple[bool, Optional[str]]:
    """
    Send the invitation email via SMTP.
    Returns (success, error_message). Never raises — caller decides what to do.
    """
    greeting = _greeting_name(partner_name)
    logo_url = f"{settings.frontend_url.rstrip('/')}/logo.png"
    role_label = "l'équipe commerciale Groupement IT" if role == "commerce" else "la plateforme partenaires Groupement-IT"
    subject = "Invitation — GROUPEMENT-IT Plateforme"
    html = f"""\
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5e5e7;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <img src="{logo_url}" alt="Groupement-IT" height="40" style="height:40px;width:auto;display:block;margin:0 0 12px;" />
                <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#6e6e73;font-weight:600;">Groupement-IT</div>
                <h1 style="font-size:22px;margin:8px 0 0;font-weight:600;">Bonjour {greeting},</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;font-size:15px;line-height:1.55;color:#1d1d1f;">
                Vous êtes invité(e) à rejoindre <strong>{role_label}</strong>.
                Créez votre compte en cliquant sur le bouton ci-dessous.
                <p style="font-size:13px;color:#6e6e73;margin:12px 0 0;">Ce lien est à usage unique et expire dans 7 jours.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 32px;">
                <a href="{invite_url}"
                   style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
                  Créer mon compte
                </a>
                <p style="font-size:12px;color:#86868b;margin:20px 0 0;word-break:break-all;">
                  Ou copiez ce lien :<br/>
                  <span style="color:#1d1d1f;">{invite_url}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e5e5e7;font-size:12px;color:#86868b;">
                Si vous n'attendiez pas cette invitation, ignorez simplement cet email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    text = (
        f"Bonjour {greeting},\n\n"
        f"Vous êtes invité(e) à rejoindre {role_label}.\n"
        "Créez votre compte en ouvrant le lien ci-dessous (usage unique, expire dans 7 jours) :\n\n"
        f"{invite_url}\n\n"
        "Si vous n'attendiez pas cette invitation, ignorez simplement cet email."
    )
    return send_email(to_email, subject, html, text=text)


@router.post("")
async def create_invitation(body: CreateInviteRequest, user: dict = Depends(require_admin)):
    """
    Create a single-use, time-limited invitation link for a partner (role='ao')
    or a UTI sales account (role='commerce'). The admin sets both the email and
    the display name. A pending unused invite for this email is replaced.
    """
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Le nom doit contenir au moins 2 caractères.")
    # Normalise an email accidentally typed as the display name into a clean
    # first name, so it shows correctly everywhere (email greeting, the register
    # prefill, and the admin "pending invitations" chip) — not just in the email.
    name = _greeting_name(name)

    # Revoke any existing unused invites for this email
    supabase.table("invitations").delete() \
        .eq("email", body.email).is_("used_at", "null").execute()

    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    # Only carry an org for sales accounts; normalise UTI → None.
    org = body.org if (body.role == "commerce" and body.org == "groupement-it") else None
    record = {
        "token": token,
        "email": body.email,
        "name": name,
        "role": body.role,
        "invited_by": user["sub"],
        "expires_at": expires_at,
        "org": org,
    }
    try:
        supabase.table("invitations").insert(record).execute()
    except Exception:
        # 'org' column not migrated yet — degrade gracefully.
        record.pop("org", None)
        supabase.table("invitations").insert(record).execute()

    invite_url = f"{settings.frontend_url}/register?invite={token}"

    # Best-effort email send. Failure is non-blocking — admin can still copy the link.
    email_sent, email_error = _send_invite_email(body.email, name, invite_url, body.role)
    if not email_sent:
        print(f"[INVITATIONS] Email not sent to {body.email}: {email_error}")

    return {
        "url": invite_url,
        "email": body.email,
        "name": name,
        "expires_in_days": 7,
        "email_sent": email_sent,
        "email_error": email_error,
    }


class ResendInviteRequest(BaseModel):
    token: str


@router.post("/resend")
async def resend_invitation(body: ResendInviteRequest, user: dict = Depends(require_admin)):
    """Re-send an existing invite email (e.g. partner lost it). Does not regenerate the token."""
    try:
        result = supabase.table("invitations").select("*").eq("token", body.token).single().execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Invitation introuvable")

    inv = result.data
    if inv.get("used_at"):
        raise HTTPException(status_code=410, detail="Cette invitation a déjà été utilisée")
    if _is_expired(inv["expires_at"]):
        raise HTTPException(status_code=410, detail="Cette invitation a expiré")

    invite_url = f"{settings.frontend_url}/register?invite={body.token}"
    email_sent, email_error = _send_invite_email(inv["email"], inv.get("name", ""), invite_url, inv.get("role", "ao"))

    if not email_sent:
        raise HTTPException(status_code=502, detail=f"Échec d'envoi: {email_error}")

    return {"email_sent": True, "email": inv["email"]}


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
