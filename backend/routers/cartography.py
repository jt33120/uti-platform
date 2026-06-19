"""
Cartographie géographique (staff UTI) : points consultants & AO pour la carte.

Les coordonnées sont géocodées et mises en cache à la création/màj (BAN).
Best-effort : si les colonnes géo n'existent pas encore, on renvoie des listes
vides plutôt que d'échouer.
"""
from fastapi import APIRouter, Depends
from services.supabase_client import supabase
from routers.auth import require_staff, require_admin

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


@router.post("/backfill")
async def backfill_geocoding(user: dict = Depends(require_admin)):
    """
    Géocode (a posteriori) les fiches qui ont une localisation mais pas encore de
    coordonnées — typiquement les AO/consultants créés avant l'ajout de la carte.
    Idempotent : ne retouche que les fiches sans coordonnées. Best-effort par fiche.
    """
    from services.geocoding import geocode

    ao_done = 0
    try:
        aos = supabase.table("appels_offres").select(
            "id, location, work_mode, latitude, longitude"
        ).execute().data or []
        for a in aos:
            if a.get("latitude") is not None and a.get("longitude") is not None:
                continue
            if not a.get("location") or a.get("work_mode") == "remote":
                continue
            geo = await geocode(a["location"])
            if not geo:
                continue
            try:
                supabase.table("appels_offres").update(
                    {"latitude": geo["latitude"], "longitude": geo["longitude"]}
                ).eq("id", a["id"]).execute()
                ao_done += 1
            except Exception:
                pass
    except Exception:
        pass

    co_done = 0
    try:
        cons = supabase.table("consultants").select(
            "id, city, latitude, longitude"
        ).execute().data or []
        for c in cons:
            if c.get("latitude") is not None and c.get("longitude") is not None:
                continue
            if not c.get("city"):
                continue
            geo = await geocode(c["city"])
            if not geo:
                continue
            try:
                supabase.table("consultants").update(
                    {"latitude": geo["latitude"], "longitude": geo["longitude"]}
                ).eq("id", c["id"]).execute()
                co_done += 1
            except Exception:
                pass
    except Exception:
        pass

    return {"aos_geocoded": ao_done, "consultants_geocoded": co_done}
