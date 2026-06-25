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
from services.email import send_email, render_email_html
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
    """Construit (subject, html, text) de l'email AO. kind = 'new' | 'relance'."""
    title = ao.get("title") or "Appel d'offres"
    url = f"{settings.frontend_url.rstrip('/')}/aos/{ao['id']}"
    ref = ao.get("reference")
    loc = ao.get("location")
    deadline = ao.get("deadline")

    if kind == "relance":
        subject = f"Rappel — Appel d'offres : {title}"
        intro = (
            f"Pour rappel, l'appel d'offres <strong>{title}</strong> ({client_name}) "
            "est toujours ouvert et nous n'avons pas encore reçu de proposition de votre part."
        )
        cta_label = "Proposer un consultant"
    else:
        subject = f"Nouvel appel d'offres : {title}"
        intro = (
            f"Un nouvel appel d'offres <strong>{title}</strong> pour le client "
            f"<strong>{client_name}</strong> vient d'être ouvert. "
            "Vous pouvez proposer un consultant directement sur la plateforme."
        )
        cta_label = "Voir l'appel d'offres"

    meta_rows = ""
    for label, val in (("Référence", ref), ("Localisation", loc), ("Date limite", deadline)):
        if val:
            meta_rows += (
                f'<tr><td style="padding:3px 0;color:#6e6e73;width:110px;">{label}</td>'
                f'<td style="color:#1d1d1f;">{val}</td></tr>'
            )
    meta_html = (
        f'<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;margin-top:8px;">{meta_rows}</table>'
        if meta_rows else ""
    )
    body_html = f"{intro}{meta_html}"

    html = render_email_html(
        title=title,
        body_html=body_html,
        cta={"label": cta_label, "url": url},
        footer_note="Vous recevez cet email car vous êtes partenaire référencé sur ce client.",
    )
    text_lines = [
        f"{'Rappel — ' if kind == 'relance' else ''}Appel d'offres : {title}",
        f"Client : {client_name}",
    ]
    if ref:
        text_lines.append(f"Référence : {ref}")
    text_lines += ["", "Proposez un consultant sur la plateforme :", url]
    return subject, html, "\n".join(text_lines)


def _send_to(recipients: list[dict], ao: dict, client_name: str, kind: str) -> int:
    if not recipients:
        return 0
    subject, html, text = _render(ao, client_name, kind)
    sent = 0
    for r in recipients:
        ok, err = send_email(r["email"], subject, html, text=text)
        if ok:
            sent += 1
        else:
            print(f"[NOTIF] échec envoi à {r['email']} (AO {ao['id']}): {err}")
    return sent


def notify_tier(ao: dict, tier: str) -> int:
    """Envoie la notification d'ouverture aux partenaires d'un tier (list_1/list_2)."""
    client_name = _client_name(ao)
    recipients = _emails_for_tiers(ao["client_id"], [tier])
    return _send_to(recipients, ao, client_name, "new")


def relance(ao: dict, only_pending: bool = True) -> int:
    """
    Relance les partenaires (liste 1 + liste 2). Par défaut, uniquement ceux qui
    n'ont pas encore soumis de CV.
    """
    client_name = _client_name(ao)
    recipients = _emails_for_tiers(ao["client_id"], ["list_1", "list_2"])
    if only_pending:
        done = _partner_ids_with_submission(ao["id"])
        recipients = [r for r in recipients if r["id"] not in done]
    return _send_to(recipients, ao, client_name, "relance")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
