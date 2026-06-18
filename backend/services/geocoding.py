"""
Géocodage gratuit via la Base Adresse Nationale (BAN), sans clé API.

https://api-adresse.data.gouv.fr — idéal pour les villes/adresses françaises.
Best-effort : toute erreur ou résultat peu fiable renvoie None (la fiche reste
simplement non positionnée sur la carte).
"""
from typing import Optional
import httpx

BAN_URL = "https://api-adresse.data.gouv.fr/search/"
MIN_SCORE = 0.3  # écarte les correspondances trop floues (ex. "Remote 3j/sem")


async def geocode(query: Optional[str]) -> Optional[dict]:
    """Renvoie {'latitude', 'longitude', 'label'} pour une ville/adresse FR, ou None."""
    if not query or not query.strip():
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(BAN_URL, params={"q": query.strip(), "limit": 1})
            r.raise_for_status()
            features = (r.json() or {}).get("features") or []
        if not features:
            return None
        f = features[0]
        props = f.get("properties", {})
        if props.get("score", 1) < MIN_SCORE:
            return None
        lon, lat = f["geometry"]["coordinates"]
        return {"latitude": lat, "longitude": lon, "label": props.get("label")}
    except Exception:
        return None
