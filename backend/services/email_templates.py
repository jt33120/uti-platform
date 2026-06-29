"""
Templates d'emails éditables (menu Administration → Templates Mails).

Le sujet et le corps de chaque email transactionnel sont éditables par l'admin
via un éditeur visuel riche (gras, couleurs, images, boutons, listes…) et
stockés en base (`email_templates`). À défaut de ligne stockée, on retombe sur
les valeurs par défaut ci-dessous : le code reste fonctionnel même sans la
migration.

Le corps est stocké en **HTML** (format "html"). Pour la rétro-compatibilité,
un corps en texte brut (format "text", anciennes lignes) reste rendu comme
avant. Le sujet est toujours du texte simple.

Variables disponibles dans le sujet et le corps :
  {title} {client} {reference} {location} {deadline} {link}
"""
import re
import html as _html
from services.supabase_client import supabase

PLACEHOLDERS = ["title", "client", "reference", "location", "deadline", "link"]
# Variables mises en évidence (gras) dans le rendu des anciens corps "texte".
_BOLD = {"title", "client"}

# Corps par défaut — HTML riche, styles inline (compatibles clients mail).
_DEFAULT_NEW = (
    '<p style="margin:0 0 14px;">Bonjour,</p>'
    '<p style="margin:0 0 14px;">Un nouvel appel d\'offres '
    '<strong>{title}</strong> pour le client <strong>{client}</strong> '
    "vient d'être ouvert sur la plateforme.</p>"
    '<p style="margin:0 0 14px;">Vous pouvez dès à présent proposer un '
    "consultant correspondant au besoin.</p>"
)
_DEFAULT_RELANCE = (
    '<p style="margin:0 0 14px;">Bonjour,</p>'
    '<p style="margin:0 0 14px;">Pour rappel, l\'appel d\'offres '
    "<strong>{title}</strong> ({client}) est toujours ouvert et nous n'avons "
    "pas encore reçu de proposition de votre part.</p>"
    '<p style="margin:0 0 14px;">N\'hésitez pas à nous proposer un profil '
    "avant la date limite.</p>"
)

DEFAULTS = {
    "ao_new": {
        "label": "Nouvel appel d'offres — notification aux partenaires",
        "subject": "Nouvel appel d'offres : {title}",
        "body": _DEFAULT_NEW,
        "format": "html",
    },
    "ao_relance": {
        "label": "Relance des partenaires — AO resté sans réponse",
        "subject": "Rappel — Appel d'offres : {title}",
        "body": _DEFAULT_RELANCE,
        "format": "html",
    },
}


def _stored() -> dict:
    """Lignes stockées indexées par clé (best-effort : {} si table absente)."""
    try:
        rows = supabase.table("email_templates").select("*").execute().data or []
        return {r["key"]: r for r in rows}
    except Exception:
        return {}


def _looks_html(s: str) -> bool:
    return bool(re.search(r"<[a-zA-Z!/][^>]*>", s or ""))


def _strip_html(s: str) -> str:
    """Réduit un corps HTML en texte brut lisible (fallback texte de l'email)."""
    s = s or ""
    s = re.sub(r"(?is)<\s*(br)\s*/?>", "\n", s)
    s = re.sub(r"(?is)<\s*li[^>]*>", "• ", s)
    s = re.sub(r"(?is)</\s*(p|div|li|h[1-6]|tr|ul|ol)\s*>", "\n", s)
    s = re.sub(r"(?is)<[^>]+>", "", s)
    s = _html.unescape(s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


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
            "format": row.get("format") or d.get("format", "html"),
            "default_subject": d["subject"],
            "default_body": d["body"],
            "default_format": d.get("format", "html"),
            "is_custom": bool(row),
            "placeholders": PLACEHOLDERS,
        })
    return out


def _effective(key: str) -> dict:
    """Template effectif pour un envoi (stocké sinon défaut)."""
    d = DEFAULTS.get(key, {"subject": "{title}", "body": "", "format": "html"})
    row = _stored().get(key) or {}
    return {
        "subject": row.get("subject") or d["subject"],
        "body": row.get("body") or d["body"],
        "format": row.get("format") or d.get("format", "html"),
    }


def raw_body(key: str) -> str:
    """Corps brut effectif (non rendu) — sert au dédoublonnage du bloc méta."""
    return _effective(key)["body"]


def _val(context: dict, name: str) -> str:
    return str(context.get(name) or "")


def render_subject(key: str, context: dict) -> str:
    s = _effective(key)["subject"]
    for name in PLACEHOLDERS:
        s = s.replace("{" + name + "}", _val(context, name))
    return s.strip() or "Appel d'offres"


def _inject_html(body: str, context: dict) -> str:
    """Injecte les variables (valeurs échappées) dans un corps HTML déjà sûr."""
    out = body
    for name in PLACEHOLDERS:
        out = out.replace("{" + name + "}", _html.escape(_val(context, name)))
    return out


def render_body(key: str, context: dict, as_html: bool) -> str:
    """Corps rendu.

    - HTML + format html : le corps est de l'HTML de confiance (éditeur admin),
      on injecte seulement les variables (valeurs échappées).
    - HTML + format texte (legacy) : on échappe, met {title}/{client} en gras,
      et convertit les retours ligne.
    - Texte : on retire le HTML éventuel et on injecte les valeurs brutes.
    """
    eff = _effective(key)
    body, fmt = eff["body"], eff["format"]
    is_html = fmt == "html" or _looks_html(body)

    if not as_html:
        text = _strip_html(body) if is_html else body
        for name in PLACEHOLDERS:
            text = text.replace("{" + name + "}", _val(context, name))
        return text

    if is_html:
        return _inject_html(body, context)

    # Legacy : corps texte brut → échappé, variables en gras, sauts de ligne.
    out = _html.escape(body)
    for name in PLACEHOLDERS:
        val = _html.escape(_val(context, name))
        rep = f"<strong>{val}</strong>" if (name in _BOLD and val) else val
        out = out.replace("{" + name + "}", rep)
    return out.replace("\n", "<br>")
