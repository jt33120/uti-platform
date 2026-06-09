"""
AI drafting of an "Appel d'Offres" from raw source material.

Takes the raw text of an AO (pasted email + extracted attachment text) and asks
the LLM (OpenRouter / Claude, same client as the assistant & matching engine) to
return a clean, structured set of AO fields that the admin then reviews and edits
before saving. The model is instructed to extract only — never to invent missing
data.
"""
import json
import re
from typing import Optional

from openai import AsyncOpenAI

from config import settings

_client: Optional[AsyncOpenAI] = (
    AsyncOpenAI(api_key=settings.openrouter_key, base_url="https://openrouter.ai/api/v1")
    if settings.openrouter_key
    else None
)
MODEL = "anthropic/claude-3.5-haiku"
MAX_SOURCE_CHARS = 24000


def is_available() -> bool:
    return _client is not None


def _extract_json(raw: str) -> Optional[dict]:
    """Best-effort parse of a JSON object from the model output."""
    if not raw:
        return None
    raw = raw.strip()
    # Strip ```json ... ``` fences if present
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
    return None


def _sanitize(d: dict, ao_types: list[str]) -> dict:
    """Coerce the model output into safe, form-ready values."""
    def text(key: str) -> str:
        v = d.get(key)
        if v is None:
            return ""
        return v.strip() if isinstance(v, str) else str(v).strip()

    budget = d.get("budget_max")
    try:
        budget = int(budget) if budget not in (None, "", "null") else None
    except (ValueError, TypeError):
        budget = None

    ao_type = text("ao_type")
    if ao_type not in ao_types:
        ao_type = ""

    deadline = text("deadline")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", deadline):
        deadline = ""

    return {
        "title": text("title")[:300],
        "description": text("description"),
        "skills_required": text("skills_required"),
        "ao_type": ao_type,
        "budget_max": budget,
        "location": text("location"),
        "duration": text("duration"),
        "deadline": deadline,
        "context": text("context"),
    }


async def draft_ao_fields(source: str, ao_types: list[str]) -> Optional[dict]:
    """
    Generate structured AO fields from raw source text.
    Returns a dict of form fields, or None if the model output was unusable.
    """
    if not _client:
        return None

    source = source[:MAX_SOURCE_CHARS]
    system = (
        "Tu es un assistant staffing qui transforme un appel d'offres brut (email "
        "et/ou pièces jointes) en une fiche d'AO structurée, claire et "
        "professionnelle, en français. Tu extrais les informations présentes et tu "
        "les reformules proprement. N'invente jamais de donnée absente : laisse le "
        "champ vide. Réponds UNIQUEMENT avec un objet JSON valide, sans texte "
        "autour ni balises markdown."
    )
    user = (
        "Génère la fiche AO à partir du contenu source ci-dessous.\n\n"
        "Champs JSON attendus (tous présents, vide si l'info est absente) :\n"
        '- "title": titre court et parlant de la mission\n'
        '- "description": description claire et professionnelle (3 à 6 phrases), reformulée\n'
        '- "skills_required": compétences techniques clés, séparées par des virgules\n'
        f'- "ao_type": exactement l\'une de ces valeurs si pertinent, sinon "" : {", ".join(ao_types)}\n'
        '- "budget_max": nombre entier (budget max en €/jour) ou null\n'
        '- "location": localisation / télétravail\n'
        '- "duration": durée de la mission\n'
        '- "deadline": date limite de réponse au format "YYYY-MM-DD", sinon ""\n'
        '- "context": éléments de contexte utiles (secteur, contraintes, urgence, environnement technique)\n\n'
        f'Contenu source :\n"""\n{source}\n"""'
    )

    resp = await _client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
        max_tokens=1200,
    )
    data = _extract_json(resp.choices[0].message.content or "")
    if data is None:
        return None
    return _sanitize(data, ao_types)
