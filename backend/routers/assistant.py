"""
In-app AI assistant ("cowork" copilot) — agentic.

Design principles:
  * NEVER acts for the user: no form submit, no delete, no send. It can answer
    questions, route to a page (+pre-fill), point to where something is
    (highlight), and draw a small chart in the chat. The user always confirms.
  * Permission-aware: pages/actions are filtered by role (admin vs partner),
    enforced server-side (defense in depth on top of frontend route guards).
  * Data-aware: a compact, role-scoped snapshot of the platform data is injected
    so the assistant can answer real questions ("combien de consultants seniors ?").

Uses a dedicated OpenRouter key/model when configured (assistant_openrouter_key
/ assistant_model), otherwise falls back to the shared key. If no key or the
model errors, a deterministic intent parser keeps the assistant useful.
"""
import json
import re
from typing import Optional, Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from openai import AsyncOpenAI

from config import settings
from services.supabase_client import supabase
from routers.auth import get_current_user

router = APIRouter(prefix="/assistant", tags=["assistant"])

_key = settings.assistant_openrouter_key or settings.openrouter_key
_client: Optional[AsyncOpenAI] = (
    AsyncOpenAI(api_key=_key, base_url="https://openrouter.ai/api/v1") if _key else None
)
MODEL = settings.assistant_model


# ── Capability catalog ─────────────────────────────────────────────
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
    {"path": "/graph", "label": "Cartographie", "roles": ["admin"], "prefill": []},
    {"path": "/pacs", "label": "PACs", "roles": ["admin"], "prefill": []},
]


def _allowed(role: str) -> list[dict]:
    return [c for c in CAPABILITIES if role in c["roles"]]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    page: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    actions: list[dict] = []


# ── Data context (role-scoped snapshot for Q&A) ────────────────────
def _build_data_context(user: dict) -> str:
    role = user.get("role")
    try:
        if role == "admin":
            consultants = supabase.table("consultants").select(
                "name, skills, experience_years, tjm, employment_type").limit(50).execute().data or []
            aos = supabase.table("appels_offres").select(
                "title, status, ao_type, budget_max, client_id").limit(50).execute().data or []
            clients = supabase.table("clients").select("id, name, sector").limit(60).execute().data or []
            partners = supabase.table("profiles").select("id, name").eq("role", "ao").limit(60).execute().data or []
            access = supabase.table("partner_clients").select("partner_id, client_id, tier").limit(400).execute().data or []
        else:
            uid = user["sub"]
            access = supabase.table("partner_clients").select("partner_id, client_id, tier").eq(
                "partner_id", uid).limit(400).execute().data or []
            cids = [r["client_id"] for r in access if r["tier"] in ("list_1", "list_2")]
            consultants = supabase.table("consultants").select(
                "name, skills, experience_years, tjm, employment_type").eq("created_by", uid).limit(50).execute().data or []
            clients = (supabase.table("clients").select("id, name, sector").in_("id", cids).execute().data or []) if cids else []
            aos = (supabase.table("appels_offres").select(
                "title, status, ao_type, budget_max, client_id").in_("client_id", cids).limit(50).execute().data or []) if cids else []
            partners = []

        cmap = {c["id"]: c["name"] for c in clients}

        def cons_line(c):
            sk = (c.get("skills") or "").strip()
            return f"{c.get('name')} [{sk[:60]} · {c.get('experience_years') or 0} ans · {c.get('tjm') or '?'}€/j · {c.get('employment_type') or '?'}]"

        def ao_line(a):
            st = "ouvert" if a.get("status") == "open" else "fermé"
            cl = cmap.get(a.get("client_id"), "?")
            return f"\"{a.get('title')}\" [{st} · {a.get('ao_type') or 'non typé'} · {a.get('budget_max') or '?'}€/j · {cl}]"

        open_n = sum(1 for a in aos if a.get("status") == "open")
        parts = ["DONNÉES ACTUELLES (utilise-les pour répondre, ne les invente pas) :"]
        parts.append(f"Consultants ({len(consultants)}) : " + "; ".join(cons_line(c) for c in consultants[:40]))
        parts.append(f"Appels d'offres ({len(aos)}, dont {open_n} ouverts) : " + "; ".join(ao_line(a) for a in aos[:40]))
        parts.append(f"Clients ({len(clients)}) : " + "; ".join(f"{c['name']} [{c.get('sector') or '?'}]" for c in clients[:40]))
        if role == "admin":
            acc_count = {}
            for r in access:
                if r["tier"] in ("list_1", "list_2"):
                    acc_count[r["partner_id"]] = acc_count.get(r["partner_id"], 0) + 1
            parts.append(f"Partenaires ({len(partners)}) : " + "; ".join(
                f"{p['name']} [{acc_count.get(p['id'], 0)} client(s)]" for p in partners[:40]))
        return "\n".join(parts)
    except Exception as e:
        print(f"[ASSISTANT] data context error: {e}")
        return ""


def _build_system_prompt(role: str) -> str:
    role_label = "administrateur" if role == "admin" else "partenaire"
    caps = _allowed(role)
    catalog = "\n".join(
        f"- {c['path']} : {c['label']}" + (f" (pré-remplissable : {', '.join(c['prefill'])})" if c["prefill"] else "")
        for c in caps
    )
    return f"""Tu es l'assistant intégré de la plateforme partenaires UTI Group (matching IA consultants ↔ appels d'offres).
L'utilisateur est un {role_label}.

RÈGLES ABSOLUES :
1. Tu n'agis JAMAIS à sa place : aucune soumission de formulaire, aucun envoi, aucune suppression. Tu peux répondre, l'amener sur une page (+pré-remplir), lui MONTRER où se trouve une fonction, ou afficher un petit graphique. Il valide toujours lui-même.
2. Tu ne proposes QUE des chemins de la liste ci-dessous, autorisés pour son rôle.
3. Réponds en français, de façon concise et utile. Sers-toi des DONNÉES ACTUELLES pour répondre aux questions chiffrées.

PAGES DISPONIBLES :
{catalog}

TU RÉPONDS UNIQUEMENT avec un objet JSON valide (sans markdown) :
{{"reply": "<message court>", "actions": [<0 à 3 actions>]}}

Types d'action possibles dans "actions" :
- {{"type": "navigate", "path": "<chemin>", "prefill": {{<champ: valeur>}} | null, "cta": "<libellé bouton>"}} → emmène l'utilisateur (quand il veut FAIRE quelque chose).
- {{"type": "highlight", "path": "<chemin>", "cta": "<libellé>"}} → met en évidence l'entrée de menu (quand il demande OÙ / COMMENT accéder à quelque chose, sans le déplacer).
- {{"type": "chart", "kind": "bar", "title": "<titre>", "data": [{{"name": "...", "value": <nombre>}}]}} → un graphique (max 8 entrées) quand il demande une répartition / comparaison / classement, calculé depuis les DONNÉES ACTUELLES.

- "actions" peut être vide [] pour une simple réponse.
- "prefill" : seulement les champs listés pour la page, et seulement si l'info est fournie. deadline = AAAA-MM-JJ ; employment_type = "independant" ou "salarie".
- Rappelle dans "reply" que l'utilisateur garde la main."""


def _strip_json(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    return text


def _parse_json(text: str) -> Optional[dict]:
    raw = _strip_json(text)
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


def _sanitize_actions(raw, role: str) -> list[dict]:
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    allowed = {c["path"]: c for c in _allowed(role)}
    out = []
    for a in raw[:3]:
        if not isinstance(a, dict):
            continue
        t = a.get("type")
        if t == "navigate":
            cap = allowed.get(a.get("path"))
            if not cap:
                continue
            prefill = a.get("prefill")
            cp = None
            if isinstance(prefill, dict) and cap["prefill"]:
                cp = {k: v for k, v in prefill.items() if k in cap["prefill"] and v not in (None, "")} or None
            out.append({"type": "navigate", "path": cap["path"], "prefill": cp, "cta": a.get("cta") or f"Ouvrir « {cap['label']} »"})
        elif t == "highlight":
            cap = allowed.get(a.get("path"))
            if not cap:
                continue
            out.append({"type": "highlight", "path": cap["path"], "cta": a.get("cta") or f"Voir « {cap['label']} » dans le menu"})
        elif t == "chart":
            kind = a.get("kind") if a.get("kind") in ("bar", "donut") else "bar"
            clean = []
            for d in (a.get("data") or [])[:8]:
                if isinstance(d, dict) and d.get("name") is not None:
                    try:
                        clean.append({"name": str(d["name"])[:40], "value": float(d.get("value"))})
                    except (TypeError, ValueError):
                        continue
            if clean:
                out.append({"type": "chart", "kind": kind, "title": str(a.get("title") or "")[:80], "data": clean})
    return out


# ── Deterministic fallback (no LLM key / model error) ──────────────
def _fallback(messages: list[ChatMessage], role: str) -> ChatResponse:
    last = next((m.content for m in reversed(messages) if m.role == "user"), "").lower()
    caps = {c["path"]: c for c in _allowed(role)}

    def nav(path, cta):
        return [{"type": "navigate", "path": path, "prefill": None, "cta": cta}] if path in caps else []

    if role == "admin" and any(w in last for w in ["créer un ao", "creer un ao", "nouvel ao", "nouvel appel", "créer un appel", "creer un appel"]):
        return ChatResponse(reply="Je vous amène au formulaire d'appel d'offres. Vous validez vous-même.", actions=nav("/aos/new", "Ouvrir le formulaire d'AO"))
    if any(w in last for w in ["ajouter un consultant", "nouveau consultant", "ajouter au vivier"]):
        return ChatResponse(reply="Direction l'ajout de consultant. Vérifiez puis validez vous-même.", actions=nav("/consultants/new", "Ouvrir le formulaire consultant"))
    nav_map = [
        (["appel", "ao", "offre"], "/aos", "Voir les appels d'offres"),
        (["vivier", "consultant"], "/consultants", "Voir le vivier"),
        (["client"], "/clients", "Voir les clients"),
        (["carto", "graph", "réseau", "reseau"], "/graph", "Ouvrir la cartographie"),
        (["partenaire", "accès", "acces"], "/partners", "Voir les partenaires"),
        (["tableau", "dashboard", "accueil"], "/dashboard", "Aller au tableau de bord"),
    ]
    for keys, path, cta in nav_map:
        if path in caps and any(k in last for k in keys):
            return ChatResponse(reply=f"Je peux vous y emmener. {cta} ?", actions=nav(path, cta))
    avail = ", ".join(c["label"] for c in _allowed(role))
    return ChatResponse(
        reply=f"Je peux vous guider, répondre sur vos données, ou vous montrer où aller. Pages disponibles : {avail}.",
        actions=[],
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: dict = Depends(get_current_user)):
    role = user.get("role", "ao")
    if _client is None or not body.messages:
        return _fallback(body.messages, role)

    convo = [{"role": "system", "content": _build_system_prompt(role)}]
    ctx = _build_data_context(user)
    if ctx:
        convo.append({"role": "system", "content": ctx})
    if body.page:
        convo.append({"role": "system", "content": f"Page actuelle de l'utilisateur : {body.page}"})
    convo += [{"role": m.role, "content": m.content} for m in body.messages[-10:]]

    try:
        resp = await _client.chat.completions.create(model=MODEL, messages=convo, temperature=0.3, max_tokens=900)
        data = _parse_json(resp.choices[0].message.content or "")
        if data is None:
            print("[ASSISTANT] model output was not valid JSON — falling back")
            return _fallback(body.messages, role)
        reply = (data.get("reply") or "").strip() or "Comment puis-je vous aider ?"
        actions = _sanitize_actions(data.get("actions", data.get("action")), role)
        return ChatResponse(reply=reply, actions=actions)
    except Exception as e:
        print(f"[ASSISTANT] falling back (LLM error): {e}")
        return _fallback(body.messages, role)
