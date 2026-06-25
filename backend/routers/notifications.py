"""
Journal des emails de notification envoyés aux partenaires (admin / staff).
Lecture seule — la table partner_email_log est alimentée par services.notifications.
"""
from fastapi import APIRouter, Depends
from services.supabase_client import supabase
from routers.auth import require_staff

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/log")
async def email_log(user: dict = Depends(require_staff), limit: int = 200):
    """Derniers envois d'emails aux partenaires, enrichis du titre d'AO et des noms."""
    try:
        rows = supabase.table("partner_email_log").select("*").order(
            "created_at", desc=True
        ).limit(min(max(limit, 1), 500)).execute().data or []
    except Exception:
        return {"logs": []}

    ao_ids = list({r["ao_id"] for r in rows if r.get("ao_id")})
    person_ids = list({
        *(r["recipient_id"] for r in rows if r.get("recipient_id")),
        *(r["sent_by"] for r in rows if r.get("sent_by")),
    })

    ao_titles: dict = {}
    if ao_ids:
        try:
            for a in supabase.table("appels_offres").select("id, title").in_("id", ao_ids).execute().data or []:
                ao_titles[a["id"]] = a.get("title")
        except Exception:
            pass

    names: dict = {}
    if person_ids:
        try:
            for p in supabase.table("profiles").select("id, name").in_("id", person_ids).execute().data or []:
                names[p["id"]] = p.get("name")
        except Exception:
            pass

    for r in rows:
        r["ao_title"] = ao_titles.get(r.get("ao_id"))
        r["recipient_name"] = names.get(r.get("recipient_id"))
        r["sent_by_name"] = names.get(r.get("sent_by"))
    return {"logs": rows}
