from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import auth, consultants, aos, matching, clients, partners, submissions, invitations, pacs, support, assistant, admin

app = FastAPI(
    title="G-IT Plateforme Partenaires — POC",
    description="API de matching IA entre consultants et Appels d'Offres",
    version="0.1.0",
)

def is_allowed_origin(origin: str) -> bool:
    """Check if origin is allowed (production URL, localhost, or Vercel preview)."""
    if not origin:
        return False
    allowed = [
        settings.frontend_url,
        "https://git-alpha-hazel.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    # Allow exact matches
    if origin in allowed:
        return True
    # Allow all Vercel preview deployments
    if origin.startswith("https://") and ".vercel.app" in origin:
        return True
    return False

# ── CORS middleware with dynamic origin checking ──────────────
@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    origin = request.headers.get("origin")
    
    # Handle preflight OPTIONS requests
    if request.method == "OPTIONS":
        if origin and is_allowed_origin(origin):
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin",
                    "Access-Control-Max-Age": "600",
                },
            )
        return Response(status_code=403)
    
    # Handle actual requests
    response = await call_next(request)
    if origin and is_allowed_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    
    return response

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(invitations.router)
app.include_router(clients.router)
app.include_router(partners.router)
app.include_router(pacs.router)
app.include_router(consultants.router)
app.include_router(aos.router)
app.include_router(submissions.router)
app.include_router(matching.router)
app.include_router(support.router)
app.include_router(assistant.router)
app.include_router(admin.router)

@app.get("/")
def root():
    return {"status": "running", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok"}