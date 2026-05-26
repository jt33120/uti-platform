import secrets
import httpx
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


def _send_invite_email(to_email: str, partner_name: str, invite_url: str) -> tuple[bool, Optional[str]]:
    """
    Send the invitation email via Resend.
    Returns (success, error_message). Never raises — caller decides what to do.
    """
    if not settings.resend_key:
        return False, "RESEND_KEY non configurée"

    subject = "Invitation — UTI Group Plateforme Partenaires"
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
                <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#6e6e73;font-weight:600;">UTI Group</div>
                <h1 style="font-size:22px;margin:8px 0 0;font-weight:600;">Bonjour {partner_name},</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;font-size:15px;line-height:1.55;color:#1d1d1f;">
                Vous êtes invité(e) à rejoindre la <strong>plateforme partenaires UTI Group</strong>.
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

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.resend_from,
                "to": [to_email],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        if resp.status_code >= 400:
            return False, f"Resend {resp.status_code}: {resp.text}"
        return True, None
    except Exception as e:
        return False, str(e)


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

    # Best-effort email send. Failure is non-blocking — admin can still copy the link.
    email_sent, email_error = _send_invite_email(body.email, name, invite_url)
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
    email_sent, email_error = _send_invite_email(inv["email"], inv.get("name", ""), invite_url)

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
