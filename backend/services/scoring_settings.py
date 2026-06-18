"""
Chargement de la configuration de scoring (pilotable par l'admin).

Sépare l'accès base (ici) du moteur pur (`services.scoring`, sans I/O). Best-effort :
si la table n'existe pas ou est vide, on retombe sur les valeurs par défaut.
"""
from services.supabase_client import supabase
from services.scoring import DEFAULTS, STAR_CRITERIA


def get_config() -> dict:
    """
    Retourne les surcharges de grille stockées par l'admin.

    Préfère la forme « étoiles » (clés `s_*` → dict `stars`) qui est la forme
    canonique pilotée par l'UI ; retombe sur les poids `w_*` historiques si une
    ligne ancienne ne contient pas encore d'étoiles. Best-effort : si la table
    n'existe pas, on renvoie {} et le moteur utilise DEFAULTS.
    """
    try:
        rows = supabase.table("scoring_config").select("*").limit(1).execute().data or []
        if rows:
            row = rows[0]
            out = {}
            for k in ("seniority_full_years", "reco_fort_min", "reco_moyen_min"):
                if row.get(k) is not None:
                    out[k] = row[k]
            stars = {c: row[f"s_{c}"] for c in STAR_CRITERIA if row.get(f"s_{c}") is not None}
            if len(stars) == len(STAR_CRITERIA):
                out["stars"] = stars
            else:
                for k in ("w_competences", "w_seniorite", "w_contexte", "w_tjm"):
                    if row.get(k) is not None:
                        out[k] = row[k]
            return out
    except Exception as e:  # noqa: BLE001
        print(f"[SCORING] config indisponible, défauts utilisés: {e}")
    return {}
