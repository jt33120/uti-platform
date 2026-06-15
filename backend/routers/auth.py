from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from services.supabase_client import supabase
from services import storage
from config import settings
import traceback
import httpx

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # "admin", "commerce" (UTI sales) or "ao" (partner)
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


VALID_ROLES = ("admin", "commerce", "ao")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    """UTI internal staff: admin or commerce. Commerce drives AOs + matching
    but stays read-only on clients/partners governance (those keep require_admin)."""
    if user.get("role") not in ("admin", "commerce"):
        raise HTTPException(status_code=403, detail="Accès réservé à l'équipe UTI")
    return user


def is_staff(user: dict) -> bool:
    return user.get("role") in ("admin", "commerce")


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

    # ── Fallback — generic to the client; the raw message stays in logs ──
    print(f"[AUTH] unmapped registration error: {error_msg}")
    return 400, "Inscription impossible pour le moment. Réessayez ou contactez le support."


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
        # Force name from invitation — admin sets the partner display name
        if invitation.get("name"):
            body.name = invitation["name"]

    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Rôle invalide. Utilisez 'admin', 'commerce' ou 'ao'.")

    if len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins 6 caractères.")

    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=422, detail="Le nom doit contenir au moins 2 caractères.")

    # ── Step 1: Create Supabase Auth user ─────────────────────────
    # Using direct HTTP instead of supabase.auth.admin to ensure the
    # service_role key is sent in BOTH the apikey and Authorization headers,
    # which some versions of gotrue-py fail to do correctly.
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{settings.supabase_url}/auth/v1/admin/users",
                headers={
                    "apikey": settings.supabase_service_key,
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "email": body.email,
                    "password": body.password,
                    "email_confirm": True,
                },
            )
        if resp.status_code >= 400:
            raw_error = resp.text
            print(f"[AUTH] create_user HTTP {resp.status_code}: {raw_error}")
            status, detail = _parse_supabase_error(raw_error)
            raise HTTPException(status_code=status, detail=detail)
        user_data = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        raw_error = str(e)
        print(f"[AUTH] create_user failed — raw error: {raw_error}\n{tb}")
        status, detail = _parse_supabase_error(raw_error)
        raise HTTPException(status_code=status, detail=detail)

    # ── Validate response ─────────────────────────────────────────
    user_id = user_data.get("id")
    if not user_id:
        print(f"[AUTH] Unexpected Supabase response (no id): {user_data}")
        raise HTTPException(
            status_code=500,
            detail="Supabase n'a pas retourné d'utilisateur. Vérifiez vos logs serveur."
        )

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
            with httpx.Client(timeout=10) as client:
                client.delete(
                    f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
                    headers={
                        "apikey": settings.supabase_service_key,
                        "Authorization": f"Bearer {settings.supabase_service_key}",
                    },
                )
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

    # Track last connection (powers the admin supervision page) — best-effort
    try:
        supabase.table("profiles").update({
            "last_login_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", user_id).execute()
    except Exception:
        pass

    token = create_token(user_id, body.email, profile["role"])

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": body.email,
            "name": profile["name"],
            "role": profile["role"],
            "avatar_url": profile.get("avatar_url"),
        }
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    try:
        profile = supabase.table("profiles").select("*").eq("id", user["sub"]).single().execute()
        return profile.data
    except Exception:
        raise HTTPException(status_code=404, detail="Profil introuvable")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    access_token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    """
    Sends a Supabase password-reset email. Always returns 200 to avoid
    leaking whether the email exists in the system.
    """
    try:
        with httpx.Client(timeout=10) as client:
            client.post(
                f"{settings.supabase_url}/auth/v1/recover",
                headers={
                    "apikey": settings.supabase_service_key,
                    "Content-Type": "application/json",
                },
                json={
                    "email": body.email,
                    "gotrue_meta_security": {},
                },
                params={"redirect_to": f"{settings.frontend_url}/reset-password"},
            )
    except Exception as e:
        print(f"[AUTH] forgot-password error (non-fatal): {e}")
    return {"message": "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    """
    Validates the Supabase recovery token and updates the password.
    The access_token comes from the URL hash after the user clicks the reset link.
    """
    if len(body.new_password) < 6:
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins 6 caractères.")
    try:
        # Verify the recovery token by calling Supabase /auth/v1/user with it
        with httpx.Client(timeout=10) as client:
            user_resp = client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_service_key,
                    "Authorization": f"Bearer {body.access_token}",
                },
            )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide ou expiré.")
        user_id = user_resp.json().get("id")
        if not user_id:
            raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide ou expiré.")
        # Update the password via admin API
        with httpx.Client(timeout=10) as client:
            upd = client.put(
                f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": settings.supabase_service_key,
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "Content-Type": "application/json",
                },
                json={"password": body.new_password},
            )
        if upd.status_code >= 400:
            raise HTTPException(status_code=400, detail="Impossible de mettre à jour le mot de passe.")
        return {"message": "Mot de passe mis à jour avec succès."}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] reset-password error: {e}")
        raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide ou expiré.")


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


@router.patch("/me")
async def update_profile(body: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    current_email = user["email"]

    # Email or password change requires current password verification
    if body.email or body.new_password:
        if not body.current_password:
            raise HTTPException(status_code=422, detail="Mot de passe actuel requis pour changer l'email ou le mot de passe.")
        try:
            auth_resp = supabase.auth.sign_in_with_password({
                "email": current_email,
                "password": body.current_password,
            })
            if not getattr(auth_resp, 'user', None):
                raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect.")
        except HTTPException:
            raise
        except Exception as e:
            msg = str(e).lower()
            if "invalid" in msg or "credentials" in msg:
                raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect.")
            raise HTTPException(status_code=500, detail="Erreur de vérification du mot de passe.")

        if body.new_password and len(body.new_password) < 6:
            raise HTTPException(status_code=422, detail="Le nouveau mot de passe doit contenir au moins 6 caractères.")

        auth_update: dict = {}
        if body.email:
            auth_update["email"] = body.email
        if body.new_password:
            auth_update["password"] = body.new_password

        with httpx.Client(timeout=10) as client:
            resp = client.put(
                f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": settings.supabase_service_key,
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "Content-Type": "application/json",
                },
                json=auth_update,
            )
        if resp.status_code >= 400:
            raise HTTPException(status_code=400, detail="Impossible de mettre à jour les identifiants.")

    profile_update: dict = {}
    if body.name and body.name.strip():
        if len(body.name.strip()) < 2:
            raise HTTPException(status_code=422, detail="Le nom doit contenir au moins 2 caractères.")
        profile_update["name"] = body.name.strip()
    if body.email:
        profile_update["email"] = body.email

    if profile_update:
        supabase.table("profiles").update(profile_update).eq("id", user_id).execute()

    profile = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    return profile.data


_AVATAR_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_AVATAR_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
_AVATAR_MAX_BYTES = 2 * 1024 * 1024  # 2 MB


@router.post("/me/avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    user_id = user["sub"]

    if file.content_type not in _AVATAR_ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Format non supporté. Utilisez JPEG, PNG ou WebP.")

    file_bytes = await file.read()
    if len(file_bytes) > _AVATAR_MAX_BYTES:
        raise HTTPException(status_code=422, detail="Image trop lourde (max 2 Mo).")

    ext = _AVATAR_EXT[file.content_type]
    storage_path = f"{user_id}/avatar.{ext}"

    # Remove any existing avatar files for this user
    try:
        existing = storage.list("avatars", user_id)
        if existing:
            storage.remove("avatars", [f"{user_id}/{f['name']}" for f in existing])
    except Exception:
        pass

    try:
        avatar_url = storage.upload(
            "avatars",
            storage_path,
            file_bytes,
            file.content_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur upload avatar: {str(e)}")

    supabase.table("profiles").update({"avatar_url": avatar_url}).eq("id", user_id).execute()
    return {"avatar_url": avatar_url}


@router.delete("/me/avatar")
async def delete_avatar(user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    try:
        existing = storage.list("avatars", user_id)
        if existing:
            storage.remove("avatars", [f"{user_id}/{f['name']}" for f in existing])
    except Exception:
        pass
    supabase.table("profiles").update({"avatar_url": None}).eq("id", user_id).execute()
    return {"avatar_url": None}