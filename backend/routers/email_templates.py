"""
Templates d'emails éditables (Administration → Templates Mails).

Lecture : staff UTI. Écriture/réinitialisation : admin uniquement.
Toute modification est journalisée (audit_log).
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from services import email_templates, audit
from services.supabase_client import supabase
from routers.auth import require_staff, require_admin

router = APIRouter(prefix="/email-templates", tags=["email-templates"])


@router.get("")
async def list_templates(user: dict = Depends(require_staff)):
    """Liste des templates (valeur effective + défaut + variables disponibles)."""
    return {"templates": email_templates.get_all()}


class TemplateUpdate(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=4000)


@router.put("/{key}")
async def update_template(key: str, body: TemplateUpdate, user: dict = Depends(require_admin)):
    """Enregistre le sujet + corps personnalisés d'un template (admin)."""
    if key not in email_templates.DEFAULTS:
        raise HTTPException(status_code=404, detail="Template inconnu")
    payload = {
        "key": key,
        "subject": body.subject,
        "body": body.body,
        "updated_by": user["sub"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase.table("email_templates").upsert(payload, on_conflict="key").execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur enregistrement: {e}")
    audit.log_event(
        "email_template_change", audit.new_run_id(),
        actor_id=user["sub"], payload={"key": key},
    )
    return {"message": "Template enregistré.", "key": key}


@router.delete("/{key}")
async def reset_template(key: str, user: dict = Depends(require_admin)):
    """Réinitialise un template à sa valeur par défaut (supprime la ligne stockée)."""
    if key not in email_templates.DEFAULTS:
        raise HTTPException(status_code=404, detail="Template inconnu")
    try:
        supabase.table("email_templates").delete().eq("key", key).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur réinitialisation: {e}")
    audit.log_event(
        "email_template_reset", audit.new_run_id(),
        actor_id=user["sub"], payload={"key": key},
    )
    return {"message": "Template réinitialisé.", "key": key}
