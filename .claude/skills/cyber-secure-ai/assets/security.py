"""
security.py — Vérification de token + RBAC (snippet à adapter).

Deux branches d'auth — choisir UNE seule (voir references/auth.md) :
  (A) Supabase-native : vérifier le JWT émis par Supabase via JWKS (clé asymétrique)
      ou via le secret JWT du projet (HS256). Combiner avec les policies RLS côté DB.
  (B) Custom : tu émets toi-même les tokens. Ne pas mélanger avec l'auth Supabase.

Dépendances : python-jose[cryptography], httpx (pour JWKS). slowapi pour le rate limit.
"""
import os
import time

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

bearer = HTTPBearer(auto_error=True)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")          # ex: https://xxxx.supabase.co
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # HS256 (branche secret partagé)
EXPECTED_AUD = os.getenv("JWT_AUD", "authenticated")

# --- Branche A1 : vérification par JWKS (RS256/ES256, recommandé) ----------
_jwks_cache = {"keys": None, "exp": 0}


def _get_jwks():
    if _jwks_cache["keys"] and _jwks_cache["exp"] > time.time():
        return _jwks_cache["keys"]
    url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    resp = httpx.get(url, timeout=5)
    resp.raise_for_status()
    keys = resp.json()["keys"]
    _jwks_cache.update(keys=keys, exp=time.time() + 3600)  # cache 1h
    return keys


def _verify_jwks(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    key = next((k for k in _get_jwks() if k["kid"] == header["kid"]), None)
    if key is None:
        raise JWTError("Clé inconnue")
    return jwt.decode(token, key, algorithms=[key["alg"]], audience=EXPECTED_AUD)


# --- Branche A2 : vérification par secret partagé (HS256) ------------------
def _verify_hs256(token: str) -> dict:
    if not SUPABASE_JWT_SECRET:
        raise JWTError("SUPABASE_JWT_SECRET manquant")
    return jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience=EXPECTED_AUD)


def decode_token(token: str) -> dict:
    # Préférer JWKS si SUPABASE_URL est défini, sinon retomber sur le secret partagé.
    try:
        if SUPABASE_URL:
            return _verify_jwks(token)
        return _verify_hs256(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")


async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    """Retourne le claim utilisateur. L'ISOLATION tenant reste appliquée par les
    policies RLS côté Supabase — ne jamais s'appuyer uniquement sur ce claim."""
    payload = decode_token(cred.credentials)
    if "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token sans sujet")
    return payload


def require_role(*roles: str):
    """Garde RBAC : require_role('admin') en dépendance d'endpoint."""
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role") or user.get("app_metadata", {}).get("role")
        if user_role not in roles:
            raise HTTPException(status_code=403, detail="Accès refusé")
        return user
    return checker


# Usage :
#   @app.post("/admin/purge")
#   @limiter.limit("3/minute")
#   async def purge(request: Request, user=Depends(require_role("admin"))):
#       ...   # + human-in-the-loop sur action irréversible
