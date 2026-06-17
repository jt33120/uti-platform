"""
Chargement de la configuration de scoring (pilotable par l'admin).

Sépare l'accès base (ici) du moteur pur (`services.scoring`, sans I/O). Best-effort :
si la table n'existe pas ou est vide, on retombe sur les valeurs par défaut.
"""
from services.supabase_client import supabase
from services.scoring import DEFAULTS


def get_config() -> dict:
    """Retourne les surcharges de grille stockées (clés de DEFAULTS uniquement)."""
    try:
        rows = supabase.table("scoring_config").select("*").limit(1).execute().data or []
        if rows:
            row = rows[0]
            return {k: row[k] for k in DEFAULTS if row.get(k) is not None}
    except Exception as e:  # noqa: BLE001
        print(f"[SCORING] config indisponible, défauts utilisés: {e}")
    return {}
