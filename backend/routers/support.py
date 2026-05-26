from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Literal
from routers.auth import get_current_user
from services.supabase_client import supabase

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


@router.post("/contact")
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

    # Mock email — log until SMTP / DNS is configured
    type_label = _TYPE_LABELS.get(body.type, body.type)
    print(
        f"\n[SUPPORT] ✉️  Nouveau message — {type_label}\n"
        f"  De      : {from_name} <{user_email}>\n"
        f"  Sujet   : {body.subject.strip()}\n"
        f"  Message : {body.message.strip()}\n"
    )

    return {"message": "Message envoyé avec succès."}
