"""
Rate limiting léger, sans dépendance (fenêtre glissante en mémoire).

Conçu pour un backend uvicorn mono-processus. Protège surtout les endpoints
qui appellent le LLM (coût + abus). Clé par utilisateur authentifié (sub du
JWT), repli sur l'IP. En cas de scale horizontal, remplacer par un store
partagé (Redis) — mais pour ce POC, l'in-memory suffit et reste honnête.
"""
import time
from collections import defaultdict, deque
from fastapi import Depends, HTTPException, Request

from routers.auth import get_current_user

# clé -> deque de timestamps (epoch secondes)
_HITS: dict[str, deque] = defaultdict(deque)
# garde-fou mémoire : au-delà, on purge les clés inactives
_MAX_KEYS = 10_000


def _client_ip(request: Request) -> str:
    # nginx pose X-Forwarded-For ; on prend la 1re IP (client réel)
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(max_calls: int, per_seconds: int):
    """
    Dépendance FastAPI : limite à `max_calls` requêtes par `per_seconds`,
    par utilisateur (ou IP si non authentifié). 429 au dépassement.
    """
    async def _dep(request: Request, user: dict = Depends(get_current_user)):
        now = time.time()
        key = f"{user.get('sub') or _client_ip(request)}:{id(_dep)}"

        if len(_HITS) > _MAX_KEYS:  # purge grossière des clés vidées
            for k in [k for k, d in list(_HITS.items()) if not d]:
                _HITS.pop(k, None)

        hits = _HITS[key]
        cutoff = now - per_seconds
        while hits and hits[0] < cutoff:
            hits.popleft()

        if len(hits) >= max_calls:
            retry = int(hits[0] + per_seconds - now) + 1
            raise HTTPException(
                status_code=429,
                detail="Trop de requêtes — patientez un instant avant de réessayer.",
                headers={"Retry-After": str(max(retry, 1))},
            )

        hits.append(now)
        return user

    return _dep


def rate_limit_public(max_calls: int, per_seconds: int):
    """Variante SANS authentification : limite par IP. Pour les endpoints
    publics (ex. formulaire de contact des futurs partenaires)."""
    async def _dep(request: Request):
        now = time.time()
        key = f"pub:{_client_ip(request)}:{id(_dep)}"

        if len(_HITS) > _MAX_KEYS:
            for k in [k for k, d in list(_HITS.items()) if not d]:
                _HITS.pop(k, None)

        hits = _HITS[key]
        cutoff = now - per_seconds
        while hits and hits[0] < cutoff:
            hits.popleft()

        if len(hits) >= max_calls:
            retry = int(hits[0] + per_seconds - now) + 1
            raise HTTPException(
                status_code=429,
                detail="Trop de requêtes — patientez un instant avant de réessayer.",
                headers={"Retry-After": str(max(retry, 1))},
            )

        hits.append(now)
        return None

    return _dep
