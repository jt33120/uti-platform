"""
Notifications partenaires d'un appel d'offres + relances.

Envoi MANUEL déclenché par le commercial : liste 1 immédiatement, liste 2 après
un délai configurable. Un planificateur (services.scheduler) envoie la liste 2 à
échéance et gère les relances automatiques. Tout est best-effort : un échec
d'email n'interrompt jamais le flux.
"""
from typing import Optional
from datetime import datetime, timezone

from services.supabase_client import supabase
from services.email import send_email
from services import email_templates
from config import settings


def _client_name(ao: dict) -> str:
    c = ao.get("clients")
    if isinstance(c, dict) and c.get("name"):
        return c["name"]
    try:
        row = supabase.table("clients").select("name").eq("id", ao["client_id"]).single().execute().data
        return (row or {}).get("name") or "—"
    except Exception:
        return "—"


def _emails_for_tiers(client_id: str, tiers: list[str]) -> list[dict]:
    """Partenaires (id, email, name) ayant accès au client pour les tiers donnés."""
    try:
        access = supabase.table("partner_clients").select("partner_id").eq(
            "client_id", client_id
        ).in_("tier", tiers).execute().data or []
    except Exception:
        return []
    ids = list({a["partner_id"] for a in access if a.get("partner_id")})
    if not ids:
        return []
    try:
        profiles = supabase.table("profiles").select("id, email, name").in_("id", ids).execute().data or []
    except Exception:
        return []
    return [p for p in profiles if p.get("email")]


def _partner_ids_with_submission(ao_id: str) -> set:
    """Partenaires ayant déjà soumis un CV sur cet AO (pour ne pas les relancer)."""
    try:
        subs = supabase.table("submissions").select("submitted_by").eq("ao_id", ao_id).execute().data or []
        return {s["submitted_by"] for s in subs if s.get("submitted_by")}
    except Exception:
        return set()


def _render(ao: dict, client_name: str, kind: str) -> tuple[str, str, str]:
    """Construit (subject, html, text) de l'email AO. kind = 'new' | 'relance'.

    Sujet et corps proviennent des templates éditables (Administration →
    Templates Mails), avec repli sur les valeurs par défaut.
    """
    url = f"{settings.frontend_url.rstrip('/')}/aos/{ao['id']}"
    key = "ao_relance" if kind == "relance" else "ao_new"
    context = {
        "title": ao.get("title") or "Appel d'offres",
        "client": client_name,
        "reference": ao.get("reference") or "",
        "location": ao.get("location") or "",
        "deadline": ao.get("deadline") or "",
        "link": url,
    }
    # Source unique de rendu (identique à l'aperçu admin).
    return email_templates.build_email(key, context)


def _log_send(ao_id, recipient: dict, kind: str, status: str, error, sent_by) -> None:
    """Journalise un envoi dans partner_email_log (best-effort)."""
    try:
        supabase.table("partner_email_log").insert({
            "ao_id": ao_id,
            "recipient_id": recipient.get("id"),
            "recipient_email": recipient.get("email"),
            "kind": kind,
            "status": status,
            "error": (error or None),
            "sent_by": sent_by,
        }).execute()
    except Exception as e:  # noqa: BLE001
        print(f"[NOTIF] log non écrit (AO {ao_id}): {e}")


def _send_to(recipients: list[dict], ao: dict, client_name: str, kind: str, actor_id=None) -> int:
    if not recipients:
        return 0
    subject, html, text = _render(ao, client_name, kind)
    sent = 0
    for r in recipients:
        ok, err = send_email(r["email"], subject, html, text=text)
        _log_send(ao.get("id"), r, kind, "sent" if ok else "failed", None if ok else err, actor_id)
        if ok:
            sent += 1
        else:
            print(f"[NOTIF] échec envoi à {r['email']} (AO {ao['id']}): {err}")
    return sent


def notify_tier(ao: dict, tier: str, actor_id=None) -> int:
    """Envoie la notification d'ouverture aux partenaires d'un tier (list_1/list_2)."""
    client_name = _client_name(ao)
    recipients = _emails_for_tiers(ao["client_id"], [tier])
    return _send_to(recipients, ao, client_name, tier, actor_id)


def relance(ao: dict, only_pending: bool = True, actor_id=None) -> int:
    """
    Relance les partenaires (liste 1 + liste 2). Par défaut, uniquement ceux qui
    n'ont pas encore soumis de CV.
    """
    client_name = _client_name(ao)
    recipients = _emails_for_tiers(ao["client_id"], ["list_1", "list_2"])
    if only_pending:
        done = _partner_ids_with_submission(ao["id"])
        recipients = [r for r in recipients if r["id"] not in done]
    return _send_to(recipients, ao, client_name, "relance", actor_id)


def eligible_partners(ao: dict) -> list[dict]:
    """
    Partenaires (liste 1 / liste 2) du client de l'AO, avec leur tier, s'ils ont
    déjà soumis un CV, et si leur compte est bloqué. Sert au renvoi ciblé.
    """
    try:
        access = supabase.table("partner_clients").select("partner_id, tier").eq(
            "client_id", ao["client_id"]
        ).in_("tier", ["list_1", "list_2"]).execute().data or []
    except Exception:
        return []
    tiers = {a["partner_id"]: a["tier"] for a in access if a.get("partner_id")}
    ids = list(tiers.keys())
    if not ids:
        return []
    try:
        profiles = supabase.table("profiles").select("id, name, email, status").in_("id", ids).execute().data or []
    except Exception:
        return []
    submitted = _partner_ids_with_submission(ao["id"])
    out = []
    for p in profiles:
        if not p.get("email"):
            continue
        out.append({
            "id": p["id"],
            "name": p.get("name"),
            "email": p["email"],
            "tier": tiers.get(p["id"]),
            "has_submitted": p["id"] in submitted,
            "blocked": bool(p.get("status") and p["status"] != "active"),
        })
    return out


def notify_selected(ao: dict, partner_ids: list[str], actor_id=None) -> int:
    """Renvoi MANUEL ciblé : envoie l'email d'AO aux seuls partenaires sélectionnés (validés éligibles)."""
    eligible = {p["id"]: p for p in eligible_partners(ao)}
    recipients = [eligible[pid] for pid in partner_ids if pid in eligible]
    client_name = _client_name(ao)
    return _send_to(recipients, ao, client_name, "manual", actor_id)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
