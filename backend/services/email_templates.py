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

Chaque template déclare ses propres variables (`placeholders`). À l'envoi, on
remplace toutes les `{clé}` présentes dans le contexte fourni.
"""
import re
import html as _html
from services.supabase_client import supabase

# Variables mises en évidence (gras) dans le rendu des anciens corps "texte".
_BOLD = {"title", "client"}

# ── Corps par défaut — HTML riche, styles inline (compatibles clients mail) ──
# Le titre de l'AO est présenté UNE fois, comme bloc mis en valeur (pas dans le
# H1, qui reste un libellé court) pour éviter les pavés en double.
_AO_TITLE_BLOCK = (
    '<p style="margin:0 0 16px;padding:12px 16px;background:#f4f5fb;'
    'border-left:3px solid #4f46e5;border-radius:6px;font-size:16px;'
    'font-weight:700;color:#1d1d1f;">{title}</p>'
)
_DEFAULT_NEW = (
    '<p style="margin:0 0 12px;">Bonjour,</p>'
    '<p style="margin:0 0 4px;">Un nouvel appel d\'offres vient d\'être ouvert '
    "pour le client <strong>{client}</strong> :</p>"
    + _AO_TITLE_BLOCK +
    '<p style="margin:0;">Vous pouvez dès à présent proposer un consultant '
    "correspondant directement sur la plateforme.</p>"
)
_DEFAULT_RELANCE = (
    '<p style="margin:0 0 12px;">Bonjour,</p>'
    '<p style="margin:0 0 4px;">Pour rappel, cet appel d\'offres pour '
    "<strong>{client}</strong> est toujours ouvert :</p>"
    + _AO_TITLE_BLOCK +
    '<p style="margin:0;">Nous n\'avons pas encore reçu de proposition de votre '
    "part — n'hésitez pas à nous proposer un profil avant la date limite.</p>"
)
_DEFAULT_INVITE = (
    '<p style="margin:0 0 14px;">Vous êtes invité(e) à rejoindre '
    "<strong>{role}</strong>.</p>"
    '<p style="margin:0 0 14px;">Créez votre compte en cliquant sur le bouton '
    "ci-dessous.</p>"
    '<p style="margin:0;font-size:13px;color:#6e6e73;">Ce lien est à usage '
    "unique et expire dans 7 jours.</p>"
)
_DEFAULT_RESET = (
    '<p style="margin:0 0 14px;">Vous avez demandé à réinitialiser le mot de '
    "passe de votre compte sur la plateforme Groupement-IT.</p>"
    '<p style="margin:0 0 14px;">Cliquez sur le bouton ci-dessous pour choisir '
    "un nouveau mot de passe.</p>"
    '<p style="margin:0;font-size:13px;color:#6e6e73;">Ce lien est à usage '
    "unique et expire dans 1 heure.</p>"
)

# `placeholders` : variables proposées dans l'éditeur.
# `email_title`  : H1 court de l'email (≠ corps), peut utiliser des variables.
# `cta_label`    : libellé du bouton d'action (le lien = {link} du contexte).
# `footer`       : note de pied de page.
DEFAULTS = {
    "ao_new": {
        "label": "Nouvel appel d'offres — notification aux partenaires",
        "subject": "Nouvel appel d'offres : {title}",
        "body": _DEFAULT_NEW,
        "format": "html",
        "placeholders": ["title", "client", "reference", "location", "deadline", "link"],
        "email_title": "Nouvel appel d'offres",
        "cta_label": "Voir l'appel d'offres",
        "footer": "Vous recevez cet email car vous êtes partenaire référencé sur ce client.",
    },
    "ao_relance": {
        "label": "Relance des partenaires — AO resté sans réponse",
        "subject": "Rappel, appel d'offres : {title}",
        "body": _DEFAULT_RELANCE,
        "format": "html",
        "placeholders": ["title", "client", "reference", "location", "deadline", "link"],
        "email_title": "Appel d'offres toujours ouvert",
        "cta_label": "Proposer un consultant",
        "footer": "Vous recevez cet email car vous êtes partenaire référencé sur ce client.",
    },
    "invite": {
        "label": "Invitation — création de compte (partenaire / commercial)",
        "subject": "Invitation à la plateforme Groupement-IT",
        "body": _DEFAULT_INVITE,
        "format": "html",
        "placeholders": ["name", "role", "link"],
        "email_title": "Bonjour {name},",
        "cta_label": "Créer mon compte",
        "footer": "Si vous n'attendiez pas cette invitation, ignorez simplement cet email.",
    },
    "password_reset": {
        "label": "Mot de passe oublié — lien de réinitialisation",
        "subject": "Réinitialisation de votre mot de passe",
        "body": _DEFAULT_RESET,
        "format": "html",
        "placeholders": ["link"],
        "email_title": "Réinitialisation du mot de passe",
        "cta_label": "Réinitialiser mon mot de passe",
        "footer": "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email, votre mot de passe reste inchangé.",
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
            "placeholders": d.get("placeholders", []),
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


def render_subject(key: str, context: dict) -> str:
    s = _effective(key)["subject"]
    for name, val in context.items():
        s = s.replace("{" + name + "}", str(val or ""))
    return s.strip() or "Groupement-IT"


def _inject_html(body: str, context: dict) -> str:
    """Injecte les variables (valeurs échappées) dans un corps HTML déjà sûr."""
    out = body
    for name, val in context.items():
        out = out.replace("{" + name + "}", _html.escape(str(val or "")))
    return out


def render_body(key: str, context: dict, as_html: bool) -> str:
    """Corps rendu.

    - HTML + format html : corps de confiance (éditeur admin), on injecte
      seulement les variables (valeurs échappées).
    - HTML + format texte (legacy) : on échappe, met {title}/{client} en gras,
      et convertit les retours ligne.
    - Texte : on retire le HTML éventuel et on injecte les valeurs brutes.
    """
    eff = _effective(key)
    body, fmt = eff["body"], eff["format"]
    is_html = fmt == "html" or _looks_html(body)

    if not as_html:
        text = _strip_html(body) if is_html else body
        for name, val in context.items():
            text = text.replace("{" + name + "}", str(val or ""))
        return text

    if is_html:
        return _inject_html(body, context)

    # Legacy : corps texte brut → échappé, variables en gras, sauts de ligne.
    out = _html.escape(body)
    for name, val in context.items():
        v = _html.escape(str(val or ""))
        rep = f"<strong>{v}</strong>" if (name in _BOLD and v) else v
        out = out.replace("{" + name + "}", rep)
    return out.replace("\n", "<br>")


def _subst(s: str, context: dict) -> str:
    for name, val in context.items():
        s = s.replace("{" + name + "}", str(val or ""))
    return s


def _meta_table(context: dict) -> str:
    """Tableau Référence / Localisation / Date limite (emails AO)."""
    rows = ""
    for label, key in (("Référence", "reference"), ("Localisation", "location"), ("Date limite", "deadline")):
        val = context.get(key)
        if val:
            rows += (
                f'<tr><td style="padding:4px 0;color:#9098a3;width:120px;">{_html.escape(label)}</td>'
                f'<td style="color:#3a3f4a;">{_html.escape(str(val))}</td></tr>'
            )
    if not rows:
        return ""
    return f'<table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin-top:14px;">{rows}</table>'


def build_email(key: str, context: dict, subject: str = None, body: str = None) -> tuple[str, str, str]:
    """Construit (sujet, html, texte) d'un email transactionnel — SOURCE UNIQUE.

    Utilisée pour l'envoi réel ET pour l'aperçu, ce qui garantit que l'aperçu
    affiché à l'admin est exactement le mail reçu. `subject`/`body` permettent
    de prévisualiser un contenu non encore enregistré.
    """
    # Import local pour éviter toute dépendance circulaire au chargement.
    from services.email import render_email_html

    d = DEFAULTS.get(key, {})

    # Sujet
    subj = subject if subject is not None else _effective(key)["subject"]
    subj = _subst(subj, context).strip() or "Groupement-IT"

    # Corps (HTML) — override éventuel (aperçu) ou template effectif.
    if body is not None:
        intro = _inject_html(body, context) if _looks_html(body) else _inject_html(
            "<p>" + _html.escape(body).replace("\n", "<br>") + "</p>", context
        )
        raw = body
    else:
        intro = render_body(key, context, as_html=True)
        raw = raw_body(key)

    # Bloc méta automatique (AO) si le template n'y fait pas déjà référence.
    if key in ("ao_new", "ao_relance"):
        if not any(("{" + v + "}") in (raw or "") for v in ("reference", "location", "deadline")):
            intro += _meta_table(context)

    # H1 court (jamais le titre brut de l'AO).
    title = _subst(d.get("email_title", "Groupement-IT"), context)
    title = title.replace(" ,", ",").strip() or "Groupement-IT"

    # Bouton d'action : lien réel = {link} du contexte.
    cta = None
    link = context.get("link")
    if d.get("cta_label") and link:
        cta = {"label": d["cta_label"], "url": str(link)}

    html = render_email_html(
        title=title, body_html=intro, cta=cta, footer_note=d.get("footer"),
    )

    # Version texte (fallback).
    text_body = render_body(key, context, as_html=False) if body is None else _subst(
        _strip_html(body) if _looks_html(body) else body, context
    )
    text_lines = [title, "", text_body]
    if link:
        text_lines += ["", str(link)]
    return subj, html, "\n".join(text_lines)
