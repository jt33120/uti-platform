"""
Pseudonymisation des CV avant envoi au LLM (AI Act Art. 10 + RGPD — minimisation).

Le moteur d'extraction ne doit JAMAIS recevoir le nom, l'e-mail ou le téléphone
du consultant : ces signaux n'ont aucune valeur pour le scoring et portent du
biais (genre/origine) + des données personnelles directement identifiantes.
L'identité est réattachée APRÈS le scoring, côté base, jamais exposée au modèle.
"""
import re

_URL = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# Suites « téléphone » : au moins 8 chiffres éventuellement séparés par espaces,
# points, tirets ou parenthèses, préfixe international optionnel.
_PHONE = re.compile(r"(?:\+?\d[\s.\-()]?){8,}\d")


def strip_pii(text: str | None, name: str | None = None) -> str:
    """
    Retire les identifiants directs d'un texte de CV avant envoi au LLM.
    - URLs, e-mails, numéros de téléphone -> masqués.
    - Le nom connu du consultant (chaque composant > 1 caractère) -> masqué.
    Idempotent et sans effet de bord ; ne lève jamais.
    """
    if not text:
        return ""
    out = _URL.sub("[URL]", text)
    out = _EMAIL.sub("[EMAIL]", out)
    out = _PHONE.sub("[TEL]", out)
    if name:
        for part in (p for p in re.split(r"\s+", name.strip()) if len(p) > 1):
            out = re.sub(rf"\b{re.escape(part)}\b", "[NOM]", out, flags=re.IGNORECASE)
    return out
