"""
Templates d'emails éditables (menu Administration → Templates Mails).

Le sujet et le corps de chaque email transactionnel sont éditables par l'admin
et stockés en base (`email_templates`). À défaut de ligne stockée, on retombe
sur les valeurs par défaut ci-dessous : le code reste fonctionnel même sans la
migration.

Variables disponibles dans le sujet et le corps :
  {title} {client} {reference} {location} {deadline} {link}
"""
import html as _html
from services.supabase_client import supabase

PLACEHOLDERS = ["title", "client", "reference", "location", "deadline", "link"]
# Variables mises en évidence (gras) dans le rendu HTML.
_BOLD = {"title", "client"}

DEFAULTS = {
    "ao_new": {
        "label": "Nouvel appel d'offres — notification aux partenaires",
        "subject": "Nouvel appel d'offres : {title}",
        "body": (
            "Un nouvel appel d'offres {title} pour le client {client} vient "
            "d'être ouvert. Vous pouvez proposer un consultant directement sur "
            "la plateforme."
        ),
    },
    "ao_relance": {
        "label": "Relance des partenaires — AO resté sans réponse",
        "subject": "Rappel — Appel d'offres : {title}",
        "body": (
            "Pour rappel, l'appel d'offres {title} ({client}) est toujours "
            "ouvert et nous n'avons pas encore reçu de proposition de votre part."
        ),
    },
}


def _stored() -> dict:
    """Lignes stockées indexées par clé (best-effort : {} si table absente)."""
    try:
        rows = supabase.table("email_templates").select("*").execute().data or []
        return {r["key"]: r for r in rows}
    except Exception:
        return {}


def get_all() -> list[dict]:
    """Tous les templates (stocké fusionné sur le défaut), pour l'UI admin."""
    stored = _stored()
    out = []
    for key, d in DEFAULTS.items():
        row = stored.get(key) or {}
        out.append({
            "key": key,
            "label": d["label"],
            "subject": row.get("subject") or d["subject"],
            "body": row.get("body") or d["body"],
            "default_subject": d["subject"],
            "default_body": d["body"],
            "is_custom": bool(row),
            "placeholders": PLACEHOLDERS,
        })
    return out


def _effective(key: str) -> dict:
    """Template effectif pour un envoi (stocké sinon défaut)."""
    d = DEFAULTS.get(key, {"subject": "{title}", "body": ""})
    row = _stored().get(key) or {}
    return {"subject": row.get("subject") or d["subject"], "body": row.get("body") or d["body"]}


def _val(context: dict, name: str) -> str:
    return str(context.get(name) or "")


def render_subject(key: str, context: dict) -> str:
    s = _effective(key)["subject"]
    for name in PLACEHOLDERS:
        s = s.replace("{" + name + "}", _val(context, name))
    return s.strip() or "Appel d'offres"


def render_body(key: str, context: dict, as_html: bool) -> str:
    """Corps rendu. En HTML : texte échappé, variables {title}/{client} en gras."""
    body = _effective(key)["body"]
    if not as_html:
        for name in PLACEHOLDERS:
            body = body.replace("{" + name + "}", _val(context, name))
        return body
    out = _html.escape(body)  # n'altère pas les accolades des variables
    for name in PLACEHOLDERS:
        val = _html.escape(_val(context, name))
        rep = f"<strong>{val}</strong>" if (name in _BOLD and val) else val
        out = out.replace("{" + name + "}", rep)
    return out.replace("\n", "<br>")
