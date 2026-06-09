"""
In-app AI assistant ("cowork" copilot).

Design principles (mirrors the product spec):
  * The assistant ONLY helps with things the website can actually do.
  * It NEVER submits forms or sends anything — it only routes the user to the
    right page and pre-fills inputs. The user always reviews and clicks the
    final action button themselves.
  * It is permission-aware: the set of pages/actions it can propose is filtered
    by the caller's role (admin vs partner). This is enforced server-side via an
    allowlist, on top of the frontend route guards (defense in depth).

It uses the same OpenRouter (Claude) client as the matching engine. If no API
key is configured or the model call fails, a deterministic intent parser keeps
the assistant useful.
"""
import json
import re
from typing import Optional, Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from openai import AsyncOpenAI

from config import settings
from routers.auth import get_current_user

router = APIRouter(prefix="/assistant", tags=["assistant"])

_client: Optional[AsyncOpenAI] = (
    AsyncOpenAI(api_key=settings.openrouter_key, base_url="https://openrouter.ai/api/v1")
    if settings.openrouter_key else None
)
MODEL = "anthropic/claude-3.5-haiku"


# ── Capability catalog ─────────────────────────────────────────────
# Each capability = a page the assistant may route to, optionally with a set of
# pre-fillable fields. `roles` restricts who may be offered it.
CAPABILITIES = [
    {"path": "/dashboard", "label": "Tableau de bord", "roles": ["admin", "ao"], "prefill": []},
    {"path": "/aos", "label": "Liste des appels d'offres", "roles": ["admin", "ao"], "prefill": []},
    {"path": "/consultants", "label": "Vivier de consultants", "roles": ["admin", "ao"], "prefill": []},
    {"path": "/clients", "label": "Clients", "roles": ["admin", "ao"], "prefill": []},
    {
        "path": "/consultants/new",
        "label": "Ajouter un consultant au vivier",
        "roles": ["admin", "ao"],
        "prefill": ["name", "skills", "tjm", "experience_years", "employment_type", "availability", "email", "phone"],
    },
    {
        "path": "/aos/new",
        "label": "Créer un appel d'offres",
        "roles": ["admin"],
        "prefill": ["title", "description", "skills_required", "budget_max", "location", "duration", "context", "ao_type", "deadline"],
    },
    {"path": "/clients/new", "label": "Créer un client", "roles": ["admin"], "prefill": []},
    {"path": "/partners", "label": "Partenaires", "roles": ["admin"], "prefill": []},
    {"path": "/partners-access", "label": "Accès partenaires", "roles": ["admin"], "prefill": []},
    {"path": "/pacs", "label": "PACs", "roles": ["admin"], "prefill": []},
]


def _allowed(role: str) -> list[dict]:
    return [c for c in CAPABILITIES if role in c["roles"]]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    page: Optional[str] = None  # current path, for context


class AssistantAction(BaseModel):
    type: Literal["navigate"] = "navigate"
    path: str
    prefill: Optional[dict] = None
    cta: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    action: Optional[AssistantAction] = None


def _build_system_prompt(role: str) -> str:
    role_label = "administrateur" if role == "admin" else "partenaire"
    caps = _allowed(role)
    lines = []
    for c in caps:
        pf = f" — champs pré-remplissables : {', '.join(c['prefill'])}" if c["prefill"] else ""
        lines.append(f"- {c['path']} : {c['label']}{pf}")
    catalog = "\n".join(lines)

    return f"""Tu es l'assistant intégré de la plateforme partenaires UTI Group (matching IA entre consultants et appels d'offres).
L'utilisateur courant est un {role_label}.

RÈGLES ABSOLUES :
1. Tu n'agis JAMAIS à la place de l'utilisateur : tu ne soumets aucun formulaire, tu n'envoies rien, tu ne supprimes rien. Tu te contentes d'amener l'utilisateur sur la bonne page et, si pertinent, de pré-remplir des champs. L'utilisateur relit toujours et clique lui-même sur le bouton final.
2. Tu ne proposes QUE des actions réellement disponibles dans l'application, et UNIQUEMENT celles autorisées pour son rôle ({role_label}).
3. Tu réponds toujours en français, de façon concise et utile.

PAGES DISPONIBLES POUR CE RÔLE :
{catalog}

FORMAT DE RÉPONSE : réponds UNIQUEMENT avec un objet JSON valide (sans markdown), de la forme :
{{"reply": "<message court à l'utilisateur>", "action": null | {{"type": "navigate", "path": "<un chemin de la liste>", "prefill": {{<champ: valeur>}} ou null, "cta": "<libellé du bouton, ex: Ouvrir le formulaire>"}}}}

- Mets "action" à null si aucune navigation n'est nécessaire (simple réponse/explication).
- "prefill" ne doit contenir que des champs pré-remplissables listés pour la page choisie, et seulement si l'utilisateur a fourni l'information.
- Pour "deadline", utilise le format AAAA-MM-JJ. Pour "employment_type", utilise "independant" ou "salarie".
- Rappelle brièvement dans "reply" que tu as préparé l'action mais que l'utilisateur doit valider lui-même."""


def _strip_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    return text


def _parse_json(text: str) -> Optional[dict]:
    """Robustly parse a JSON object from the model output (handles fences/prose)."""
    raw = _strip_json(text or "")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


def _sanitize_action(action: Optional[dict], role: str) -> Optional[AssistantAction]:
    """Validate a proposed action against the role's allowlist."""
    if not action or not isinstance(action, dict):
        return None
    path = action.get("path")
    cap = next((c for c in _allowed(role) if c["path"] == path), None)
    if not cap:
        return None  # disallowed or unknown path → drop the action
    prefill = action.get("prefill")
    clean_prefill = None
    if isinstance(prefill, dict) and cap["prefill"]:
        clean_prefill = {
            k: v for k, v in prefill.items()
            if k in cap["prefill"] and v not in (None, "")
        } or None
    return AssistantAction(
        type="navigate",
        path=path,
        prefill=clean_prefill,
        cta=action.get("cta") or f"Ouvrir « {cap['label']} »",
    )


# ── Deterministic fallback (no LLM key / model error) ──────────────
def _fallback(messages: list[ChatMessage], role: str) -> ChatResponse:
    last = next((m.content for m in reversed(messages) if m.role == "user"), "").lower()
    caps = {c["path"]: c for c in _allowed(role)}

    def act(path, cta, prefill=None):
        cap = caps.get(path)
        if not cap:
            return None
        return AssistantAction(type="navigate", path=path, prefill=prefill, cta=cta)

    # Create AO (admin)
    if role == "admin" and any(w in last for w in ["créer un ao", "creer un ao", "nouvel ao", "nouvel appel", "nouveau appel", "créer un appel", "creer un appel"]):
        return ChatResponse(
            reply="Je vous amène au formulaire de création d'appel d'offres. Relisez les informations puis cliquez sur « Créer l'AO » — je ne le soumets pas à votre place.",
            action=act("/aos/new", "Ouvrir le formulaire d'AO"),
        )
    # Add consultant
    if any(w in last for w in ["ajouter un consultant", "nouveau consultant", "ajouter au vivier", "ajouter un profil"]):
        return ChatResponse(
            reply="Direction le formulaire d'ajout de consultant à votre vivier. Vérifiez les champs et validez vous-même l'ajout.",
            action=act("/consultants/new", "Ouvrir le formulaire consultant"),
        )
    # Navigation intents
    nav = [
        (["appel", "ao", "offre"], "/aos", "Voir les appels d'offres"),
        (["vivier", "consultant"], "/consultants", "Voir le vivier"),
        (["client"], "/clients", "Voir les clients"),
        (["partenaire", "accès", "acces"], "/partners", "Voir les partenaires"),
        (["pac"], "/pacs", "Voir les PACs"),
        (["tableau", "dashboard", "accueil"], "/dashboard", "Aller au tableau de bord"),
    ]
    for keywords, path, cta in nav:
        if path in caps and any(k in last for k in keywords):
            return ChatResponse(
                reply=f"Je peux vous y emmener. {cta} ?",
                action=act(path, cta),
            )

    avail = ", ".join(c["label"] for c in _allowed(role))
    return ChatResponse(
        reply=(
            "Je suis votre assistant intégré : je peux vous guider vers la bonne page et "
            "pré-remplir des formulaires, mais je ne valide jamais à votre place. "
            f"Voici ce que je peux ouvrir pour vous : {avail}."
        ),
        action=None,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: dict = Depends(get_current_user)):
    role = user.get("role", "ao")

    if _client is None or not body.messages:
        return _fallback(body.messages, role)

    convo = [{"role": "system", "content": _build_system_prompt(role)}]
    if body.page:
        convo.append({"role": "system", "content": f"Page actuelle de l'utilisateur : {body.page}"})
    convo += [{"role": m.role, "content": m.content} for m in body.messages[-10:]]

    try:
        resp = await _client.chat.completions.create(
            model=MODEL,
            messages=convo,
            temperature=0.3,
            max_tokens=600,
        )
        data = _parse_json(resp.choices[0].message.content or "")
        if data is None:
            print("[ASSISTANT] model output was not valid JSON — falling back")
            return _fallback(body.messages, role)
        reply = (data.get("reply") or "").strip() or "Comment puis-je vous aider ?"
        action = _sanitize_action(data.get("action"), role)
        return ChatResponse(reply=reply, action=action)
    except Exception as e:
        print(f"[ASSISTANT] falling back (LLM error): {e}")
        return _fallback(body.messages, role)
