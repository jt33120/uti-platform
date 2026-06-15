from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Literal, Optional
from routers.auth import get_current_user
from services.supabase_client import supabase
from services.email import send_email
from services.ratelimit import rate_limit
from config import settings

router = APIRouter(prefix="/support", tags=["support"])

_TYPES = Literal["bug", "question", "suggestion", "other"]
_TYPE_LABELS = {
    "bug": "Problème technique",
    "question": "Question",
    "suggestion": "Suggestion",
    "other": "Autre",
}


class ContactRequest(BaseModel):
    type: _TYPES
    subject: str
    message: str


def _send_support_email(
    from_name: str,
    from_email: str,
    type_label: str,
    subject: str,
    message: str,
) -> tuple[bool, Optional[str]]:
    """Forward contact message to the admin via SMTP. Never raises."""
    if not settings.admin_email:
        return False, "ADMIN_EMAIL non configurée"

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
                <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#6e6e73;font-weight:600;">UTI Group — Support</div>
                <h1 style="font-size:20px;margin:8px 0 0;font-weight:600;">Nouveau message : {type_label}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px;">
                <table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;color:#1d1d1f;">
                  <tr><td style="padding:4px 0;color:#6e6e73;width:90px;">De</td><td>{from_name} &lt;{from_email}&gt;</td></tr>
                  <tr><td style="padding:4px 0;color:#6e6e73;">Sujet</td><td>{subject}</td></tr>
                  <tr><td style="padding:4px 0;color:#6e6e73;">Type</td><td>{type_label}</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px;">
                <div style="background:#f5f5f7;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;color:#1d1d1f;white-space:pre-wrap;">{message}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e5e5e7;font-size:12px;color:#86868b;">
                Vous pouvez répondre directement à {from_email}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    text = (
        f"Nouveau message de support : {type_label}\n\n"
        f"De : {from_name} <{from_email}>\n"
        f"Sujet : {subject}\n"
        f"Type : {type_label}\n\n"
        f"{message}\n\n"
        f"Vous pouvez répondre directement à {from_email}"
    )
    return send_email(
        settings.admin_email,
        f"[Support] {type_label} — {subject}",
        html,
        text=text,
        reply_to=from_email,
    )


@router.post("/contact", dependencies=[Depends(rate_limit(5, 300))])
async def contact(body: ContactRequest, user: dict = Depends(get_current_user)):
    if not body.subject.strip():
        raise HTTPException(status_code=422, detail="Le sujet est requis.")
    if not body.message.strip():
        raise HTTPException(status_code=422, detail="Le message est requis.")
    if len(body.message.strip()) < 10:
        raise HTTPException(status_code=422, detail="Le message est trop court (minimum 10 caractères).")

    user_id = user["sub"]
    user_email = user["email"]

    # Fetch name from profiles
    try:
        profile = supabase.table("profiles").select("name").eq("id", user_id).single().execute()
        from_name = profile.data.get("name", user_email)
    except Exception:
        from_name = user_email

    # Persist in DB (service role bypasses RLS)
    try:
        supabase.table("support_messages").insert({
            "user_id": user_id,
            "from_name": from_name,
            "from_email": user_email,
            "type": body.type,
            "subject": body.subject.strip(),
            "message": body.message.strip(),
        }).execute()
    except Exception as e:
        print(f"[SUPPORT] DB insert failed: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'enregistrement du message.")

    # Send email notification to admin
    type_label = _TYPE_LABELS.get(body.type, body.type)
    ok, err = _send_support_email(from_name, user_email, type_label, body.subject.strip(), body.message.strip())
    if not ok:
        print(f"[SUPPORT] Email non envoyé : {err}")
    else:
        print(f"[SUPPORT] Email transmis à {settings.admin_email}")

    return {"message": "Message envoyé avec succès."}
