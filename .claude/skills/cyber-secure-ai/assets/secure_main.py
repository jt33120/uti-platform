"""
secure_main.py — Initialisation FastAPI durcie (snippet à adapter, pas un template figé).

À adapter avant livraison : ALLOWED_ORIGINS, nom de l'app, routers.
Repose sur ENV pour basculer le comportement prod/dev — ne jamais coder "prod" en dur.
"""
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

IS_PROD = os.getenv("ENV", "dev").lower() == "prod"

# Domaines explicites uniquement — jamais ["*"] avec credentials.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="API",
    # /docs et /redoc désactivés en prod.
    docs_url=None if IS_PROD else "/docs",
    redoc_url=None if IS_PROD else "/redoc",
    openapi_url=None if IS_PROD else "/openapi.json",
)
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if IS_PROD:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    # Ne pas révéler le framework.
    response.headers.pop("server", None)
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # En prod : message générique, jamais de stack trace au client.
    # Le détail part dans les logs / Sentry, pas dans la réponse.
    if IS_PROD:
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    raise exc


# Exemple d'endpoint LLM rate-limité (voir security.py pour l'auth) :
#
# @app.post("/chat")
# @limiter.limit("10/minute")
# async def chat(request: Request, body: ChatInput, user=Depends(get_current_user)):
#     ...
