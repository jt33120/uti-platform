"""
Cartographie géographique (staff UTI) : points consultants & AO pour la carte.

Les coordonnées sont géocodées et mises en cache à la création/màj (BAN).
Best-effort : si les colonnes géo n'existent pas encore, on renvoie des listes
vides plutôt que d'échouer.
"""
from fastapi import APIRouter, Depends
from services.supabase_client import supabase
from routers.auth import require_staff

router = APIRouter(prefix="/map", tags=["cartography"])


@router.get("/points")
async def map_points(user: dict = Depends(require_staff)):
    """Consultants géolocalisés + AO (positionnés ou en télétravail) pour la carte."""
    consultants = []
    try:
        rows = supabase.table("consultants").select(
            "id, name, city, latitude, longitude, skills, tjm"
        ).execute().data or []
        consultants = [r for r in rows if r.get("latitude") is not None and r.get("longitude") is not None]
    except Exception:
        pass

    aos = []
    try:
        aos = supabase.table("appels_offres").select(
            "id, title, location, work_mode, latitude, longitude, status, clients(name)"
        ).execute().data or []
    except Exception:
        pass

    return {"consultants": consultants, "aos": aos}
