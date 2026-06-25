"""
Réglages applicatifs globaux, pilotés par l'admin depuis la plateforme.

Stockés dans la table `app_settings` (clé → valeur JSON). Best-effort : si la
table n'existe pas encore, on retombe sur les valeurs par défaut.
"""
from typing import Any
from services.supabase_client import supabase

# Réglages des notifications partenaires + relances (tous éditables par l'admin).
NOTIFICATION_DEFAULTS: dict[str, Any] = {
    "enabled": True,            # envoi des notifications activé
    "list2_delay_days": 2,      # délai (jours) entre l'envoi liste 1 et liste 2 (48 h)
    "relance_auto_enabled": False,  # relance automatique des partenaires
    "relance_interval_days": 7,     # fréquence des relances automatiques
    "relance_max": 2,               # nombre maximum de relances automatiques
}

_NOTIF_KEY = "notifications"


def get_setting(key: str, default: Any = None) -> Any:
    try:
        rows = supabase.table("app_settings").select("value").eq("key", key).limit(1).execute().data or []
        if rows:
            return rows[0].get("value")
    except Exception as e:  # noqa: BLE001
        print(f"[SETTINGS] lecture '{key}' indisponible, défaut utilisé: {e}")
    return default


def set_setting(key: str, value: Any) -> None:
    supabase.table("app_settings").upsert({"key": key, "value": value}).execute()


def _coerce_notifications(raw: Any) -> dict:
    """Fusionne les valeurs stockées avec les défauts + borne les valeurs."""
    cfg = dict(NOTIFICATION_DEFAULTS)
    if isinstance(raw, dict):
        for k in NOTIFICATION_DEFAULTS:
            if raw.get(k) is not None:
                cfg[k] = raw[k]
    cfg["enabled"] = bool(cfg["enabled"])
    cfg["relance_auto_enabled"] = bool(cfg["relance_auto_enabled"])
    cfg["list2_delay_days"] = max(0, int(cfg["list2_delay_days"]))
    cfg["relance_interval_days"] = max(1, int(cfg["relance_interval_days"]))
    cfg["relance_max"] = max(0, int(cfg["relance_max"]))
    return cfg


def get_notification_settings() -> dict:
    """Réglages de notification effectifs (défauts + surcharges admin)."""
    return _coerce_notifications(get_setting(_NOTIF_KEY))


def set_notification_settings(patch: dict) -> dict:
    """Applique une mise à jour partielle des réglages de notification."""
    current = get_notification_settings()
    current.update({k: patch[k] for k in NOTIFICATION_DEFAULTS if k in patch})
    cfg = _coerce_notifications(current)
    set_setting(_NOTIF_KEY, cfg)
    return cfg
