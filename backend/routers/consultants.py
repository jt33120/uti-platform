from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Literal
from services.supabase_client import supabase
from services.email import send_email
from routers.auth import get_current_user, require_staff, is_staff

router = APIRouter(prefix="/consultants", tags=["consultants"])


class ConsultantCreate(BaseModel):
    name: str
    skills: str
    tjm: Optional[int] = None
    experience_years: Optional[int] = None
    availability: Optional[str] = None
    employment_type: Optional[Literal["independant", "salarie"]] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class ConsultantUpdate(BaseModel):
    name: Optional[str] = None
    skills: Optional[str] = None
    tjm: Optional[int] = None
    experience_years: Optional[int] = None
    availability: Optional[str] = None
    employment_type: Optional[Literal["independant", "salarie"]] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@router.post("")
async def create_consultant(body: ConsultantCreate, user: dict = Depends(get_current_user)):
    """
    Create a consultant in the partner's vivier (talent pool).
    CV upload is no longer here — CVs are attached to specific AO submissions.
    """
    try:
        response = supabase.table("consultants").insert({
            "name": body.name,
            "skills": body.skills,
            "tjm": body.tjm,
            "experience_years": body.experience_years,
            "availability": body.availability,
            "employment_type": body.employment_type,
            "email": body.email,
            "phone": body.phone,
            "created_by": user["sub"],
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_consultants(user: dict = Depends(get_current_user)):
    """
    Staff (admin/commerce): all consultants, with the owning partner joined so
    the UI can show who carries each profile and offer a direct contact.
    Partner: only their own vivier.
    """
    try:
        if is_staff(user):
            select = "*, owner:profiles!created_by(id, name, email, role)"
        else:
            select = "*"
        query = supabase.table("consultants").select(select).order("created_at", desc=True)
        if user["role"] == "ao":
            query = query.eq("created_by", user["sub"])
        return query.execute().data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{consultant_id}")
async def get_consultant(consultant_id: str, user: dict = Depends(get_current_user)):
    try:
        response = supabase.table("consultants").select("*").eq("id", consultant_id).single().execute()
        consultant = response.data
        if user["role"] == "ao" and consultant["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Accès interdit")
        return consultant
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Consultant introuvable")


@router.patch("/{consultant_id}")
async def update_consultant(consultant_id: str, body: ConsultantUpdate, user: dict = Depends(get_current_user)):
    try:
        consultant = supabase.table("consultants").select("*").eq("id", consultant_id).single().execute().data
        # Owner or admin only — commerce has read-only access to the vivier
        if user["role"] != "admin" and consultant["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Accès interdit")
        update_data = body.model_dump(exclude_none=True)
        response = supabase.table("consultants").update(update_data).eq("id", consultant_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ContactPartnerRequest(BaseModel):
    subject: str
    message: str


@router.post("/{consultant_id}/contact-partner")
async def contact_partner(consultant_id: str, body: ContactPartnerRequest, user: dict = Depends(require_staff)):
    """
    Email the partner who carries this consultant. The message is written by
    UTI staff in a pre-filled modal; Reply-To points back at the sender.
    """
    if not body.subject.strip() or not body.message.strip():
        raise HTTPException(status_code=422, detail="Sujet et message requis.")

    try:
        consultant = supabase.table("consultants").select("id, name, created_by").eq(
            "id", consultant_id
        ).single().execute().data
    except Exception:
        raise HTTPException(status_code=404, detail="Consultant introuvable")

    if not consultant.get("created_by"):
        raise HTTPException(status_code=422, detail="Ce consultant n'a pas de partenaire porteur.")

    try:
        owner = supabase.table("profiles").select("name, email").eq(
            "id", consultant["created_by"]
        ).single().execute().data
    except Exception:
        raise HTTPException(status_code=404, detail="Partenaire porteur introuvable")

    sender_email = user["email"]
    try:
        sender = supabase.table("profiles").select("name").eq("id", user["sub"]).single().execute().data
        sender_name = sender.get("name") or sender_email
    except Exception:
        sender_name = sender_email

    html = f"""\
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5e5e7;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:32px 32px 8px;">
            <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#6e6e73;font-weight:600;">UTI Group</div>
            <h1 style="font-size:20px;margin:8px 0 0;font-weight:600;">À propos de votre consultant {consultant['name']}</h1>
          </td></tr>
          <tr><td style="padding:16px 32px 32px;">
            <div style="background:#f5f5f7;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;color:#1d1d1f;white-space:pre-wrap;">{body.message.strip()}</div>
            <p style="font-size:12px;color:#86868b;margin:20px 0 0;">Message envoyé par {sender_name} ({sender_email}) — répondez directement à cet email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""
    text = (
        f"À propos de votre consultant {consultant['name']}\n\n"
        f"{body.message.strip()}\n\n"
        f"— {sender_name} ({sender_email}), UTI Group. Répondez directement à cet email."
    )

    ok, err = send_email(owner["email"], body.subject.strip(), html, text=text, reply_to=sender_email)
    if not ok:
        raise HTTPException(status_code=502, detail=f"Échec d'envoi de l'email : {err}")

    return {"message": "Email envoyé au partenaire.", "partner_email": owner["email"]}


@router.delete("/{consultant_id}")
async def delete_consultant(consultant_id: str, user: dict = Depends(get_current_user)):
    try:
        consultant = supabase.table("consultants").select("*").eq("id", consultant_id).single().execute().data
        if user["role"] != "admin" and consultant["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Accès interdit")
        supabase.table("consultants").delete().eq("id", consultant_id).execute()
        return {"message": "Consultant supprimé"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
