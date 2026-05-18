from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from services.supabase_client import supabase
from config import settings
import traceback

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # "admin" or "ao"
    invite_token: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def create_token(user_id: str, email: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return decode_token(credentials.credentials)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user


async def require_ao(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("ao", "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return user


def _parse_supabase_error(error_msg: str) -> tuple[int, str]:
    """
    Map raw Supabase / GoTrue error strings to human-readable French messages.
    Returns (http_status_code, user_facing_message).
    """
    msg = error_msg.lower()

    # ── Auth errors ───────────────────────────────────────────────
    if "user already registered" in msg or "already been registered" in msg or "already exists" in msg:
        return 409, "Un compte existe déjà avec cet email."

    if "password should be at least" in msg or "password is too short" in msg:
        return 422, "Le mot de passe est trop court (minimum 6 caractères)."

    if "unable to validate email address" in msg or "invalid email" in msg:
        return 422, "L'adresse email semble invalide."

    if "email rate limit exceeded" in msg or "too many requests" in msg or "rate limit" in msg:
        return 429, "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer."

    if "user not allowed" in msg or "signups not allowed" in msg or "signup is disabled" in msg:
        return 403, (
            "Les inscriptions sont désactivées sur ce projet Supabase. "
            "Activez-les dans : Supabase Dashboard → Authentication → Providers → Email → "
            "cochez « Enable Email provider » et désactivez « Confirm email » pour le POC."
        )

    if "email not confirmed" in msg:
        return 403, "Email non confirmé. Vérifiez votre boîte mail ou désactivez la confirmation email dans Supabase."

    if "invalid api key" in msg or "apikey" in msg:
        return 500, "Clé API Supabase invalide — vérifiez SUPABASE_SERVICE_KEY dans votre .env."

    if "relation" in msg and "does not exist" in msg:
        return 500, "La table 'profiles' n'existe pas en base. Avez-vous exécuté supabase_schema.sql ?"

    if "violates foreign key" in msg:
        return 500, "Erreur de contrainte base de données — l'utilisateur Auth n'a pas été créé avant le profil."

    if "violates unique constraint" in msg:
        return 409, "Un compte existe déjà avec cet email."

    if "permission denied" in msg or "not authorized" in msg:
        return 403, "Permission refusée par Supabase. Vérifiez que vous utilisez la clé service_role (pas la clé anon)."

    if "connection" in msg or "timeout" in msg or "could not connect" in msg:
        return 503, "Impossible de joindre Supabase. Vérifiez votre SUPABASE_URL et votre connexion réseau."

    # ── Fallback with raw message for debugging ───────────────────
    return 400, f"Erreur d'inscription : {error_msg}"


@router.post("/register")
async def register(body: RegisterRequest):
    # ── Validate and consume invite token (if provided) ───────────
    invitation = None
    if body.invite_token:
        try:
            inv_result = supabase.table("invitations").select("*") \
                .eq("token", body.invite_token).single().execute()
            invitation = inv_result.data
        except Exception:
            invitation = None

        if not invitation or invitation.get("used_at"):
            raise HTTPException(status_code=400, detail="Lien d'invitation invalide ou déjà utilisé.")

        inv_expires = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if inv_expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Ce lien d'invitation a expiré.")

        if invitation["email"].lower() != body.email.lower():
            raise HTTPException(status_code=400, detail="L'email ne correspond pas à l'invitation.")

        # Force role from invitation — prevents privilege escalation
        body.role = invitation["role"]

    if body.role not in ("admin", "ao"):
        raise HTTPException(status_code=400, detail="Rôle invalide. Utilisez 'admin' ou 'ao'.")

    if len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins 6 caractères.")

    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=422, detail="Le nom doit contenir au moins 2 caractères.")

    # ── Step 1: Create Supabase Auth user ─────────────────────────
    try:
        auth_response = supabase.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,  # auto-confirm — remove if you want email verification
        })
    except Exception as e:
        tb = traceback.format_exc()
        raw_error = str(e)
        print(f"[AUTH] create_user failed — raw error: {raw_error}\n{tb}")
        status, detail = _parse_supabase_error(raw_error)
        # Append raw for debugging (remove once fixed)
        raise HTTPException(status_code=status, detail=f"{detail} [debug: {raw_error}]")

    # ── Validate response ─────────────────────────────────────────
    if hasattr(auth_response, 'error') and auth_response.error:
        status, detail = _parse_supabase_error(auth_response.error.message)
        raise HTTPException(status_code=status, detail=detail)

    if not getattr(auth_response, 'user', None):
        print(f"[AUTH] Unexpected Supabase response: {auth_response}")
        raise HTTPException(
            status_code=500,
            detail="Supabase n'a pas retourné d'utilisateur. Vérifiez vos logs serveur."
        )

    user_id = auth_response.user.id

    # ── Step 2: Insert profile row ────────────────────────────────
    try:
        profile_resp = supabase.table("profiles").insert({
            "id": user_id,
            "email": body.email,
            "name": body.name.strip(),
            "role": body.role,
        }).execute()
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[AUTH] profiles insert failed for user {user_id}:\n{tb}")
        # Auth user was created — attempt cleanup to avoid orphan
        try:
            supabase.auth.admin.delete_user(user_id)
            print(f"[AUTH] Cleaned up orphan auth user {user_id}")
        except Exception as cleanup_err:
            print(f"[AUTH] Cleanup failed: {cleanup_err}")
        status, detail = _parse_supabase_error(str(e))
        raise HTTPException(status_code=status, detail=detail)

    if hasattr(profile_resp, 'error') and profile_resp.error:
        status, detail = _parse_supabase_error(profile_resp.error.message)
        raise HTTPException(status_code=status, detail=detail)

    # ── Consume invitation token ──────────────────────────────────
    if invitation:
        try:
            supabase.table("invitations").update({
                "used_at": datetime.now(timezone.utc).isoformat(),
                "used_by": user_id,
            }).eq("token", body.invite_token).execute()
        except Exception as e:
            print(f"[AUTH] Warning: could not mark invitation as used: {e}")

    token = create_token(user_id, body.email, body.role)

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": body.email,
            "name": body.name.strip(),
            "role": body.role,
        }
    }


@router.post("/login")
async def login(body: LoginRequest):
    # ── Step 1: Supabase Auth sign-in ─────────────────────────────
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
    except Exception as e:
        msg = str(e).lower()
        print(f"[AUTH] login failed: {e}")
        if "invalid login credentials" in msg or "invalid password" in msg:
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect.")
        if "email not confirmed" in msg:
            raise HTTPException(status_code=403, detail="Email non confirmé. Vérifiez votre boîte mail.")
        if "too many requests" in msg or "rate limit" in msg:
            raise HTTPException(status_code=429, detail="Trop de tentatives. Réessayez dans quelques minutes.")
        raise HTTPException(status_code=401, detail="Échec de la connexion. Vérifiez vos identifiants.")

    if not getattr(auth_response, 'user', None):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect.")

    user_id = auth_response.user.id

    # ── Step 2: Fetch profile ─────────────────────────────────────
    try:
        profile_response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        profile = profile_response.data
    except Exception as e:
        print(f"[AUTH] profiles fetch failed for {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Compte Auth trouvé mais profil introuvable en base. La table 'profiles' existe-t-elle ?"
        )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Profil utilisateur introuvable. Votre compte est peut-être incomplet — réinscrivez-vous."
        )

    token = create_token(user_id, body.email, profile["role"])

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": body.email,
            "name": profile["name"],
            "role": profile["role"],
        }
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    try:
        profile = supabase.table("profiles").select("*").eq("id", user["sub"]).single().execute()
        return profile.data
    except Exception:
        raise HTTPException(status_code=404, detail="Profil introuvable")