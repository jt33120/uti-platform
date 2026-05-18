from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional
from services.supabase_client import supabase
from services.cv_parser import extract_text_from_pdf
from routers.auth import get_current_user
import uuid

router = APIRouter(prefix="/submissions", tags=["submissions"])

ALLOWED_MIME_TYPES = {"application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def _check_ao_access(ao_id: str, user: dict) -> dict:
    """
    Ensure the user can access this AO.
    Admin → ok. Partner → must have list_1/list_2 access to the AO's client.
    Returns the AO row.
    """
    try:
        ao = supabase.table("appels_offres").select("*").eq("id", ao_id).single().execute().data
    except Exception:
        raise HTTPException(status_code=404, detail="AO introuvable")

    if user["role"] == "admin":
        return ao

    access = supabase.table("partner_clients").select("tier").eq(
        "partner_id", user["sub"]
    ).eq("client_id", ao["client_id"]).in_("tier", ["list_1", "list_2"]).execute()

    if not access.data:
        raise HTTPException(status_code=403, detail="Vous n'avez pas accès à cet AO")

    return ao


@router.post("")
async def create_submission(
    ao_id: str = Form(...),
    consultant_id: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    tjm: Optional[int] = Form(None),
    skills: Optional[str] = Form(None),
    experience_years: Optional[int] = Form(None),
    employment_type: Optional[str] = Form(None),
    availability: Optional[str] = Form(None),
    cv_file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Submit a CV to an AO.

    Two modes:
    - Pass `consultant_id` to reuse an existing roster consultant
    - Pass consultant fields (name, skills, ...) to create + submit in one shot
    """
    _check_ao_access(ao_id, user)

    # Validate file
    if cv_file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")
    file_bytes = await cv_file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10MB)")

    try:
        cv_text = extract_text_from_pdf(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Impossible de lire le PDF: {str(e)}")
    if not cv_text or len(cv_text) < 50:
        raise HTTPException(status_code=422, detail="Le PDF semble vide ou illisible")

    # Resolve consultant (create-on-the-fly or reuse)
    if consultant_id:
        try:
            consultant = supabase.table("consultants").select("*").eq("id", consultant_id).single().execute().data
        except Exception:
            raise HTTPException(status_code=404, detail="Consultant introuvable")
        if user["role"] == "ao" and consultant["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Ce consultant ne vous appartient pas")
    else:
        if not name or not skills:
            raise HTTPException(status_code=400, detail="Nom et compétences requis pour créer un consultant")
        if employment_type and employment_type not in ("independant", "salarie"):
            raise HTTPException(status_code=400, detail="employment_type doit être 'independant' ou 'salarie'")
        consultant = supabase.table("consultants").insert({
            "name": name,
            "tjm": tjm,
            "skills": skills,
            "experience_years": experience_years,
            "employment_type": employment_type,
            "availability": availability,
            "created_by": user["sub"],
        }).execute().data[0]
        consultant_id = consultant["id"]

    # Refuse duplicate submission
    existing = supabase.table("submissions").select("id").eq(
        "ao_id", ao_id
    ).eq("consultant_id", consultant_id).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Ce consultant a déjà été soumis à cet AO")

    # Upload PDF
    submission_uuid = str(uuid.uuid4())
    storage_path = f"{ao_id}/{submission_uuid}.pdf"
    try:
        supabase.storage.from_("cvs").upload(
            storage_path,
            file_bytes,
            {"content-type": "application/pdf"},
        )
        cv_url = supabase.storage.from_("cvs").get_public_url(storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur upload CV: {str(e)}")

    # Insert submission
    try:
        sub = supabase.table("submissions").insert({
            "id": submission_uuid,
            "ao_id": ao_id,
            "consultant_id": consultant_id,
            "cv_url": cv_url,
            "cv_text": cv_text,
            "cv_filename": cv_file.filename,
            "submitted_by": user["sub"],
        }).execute().data[0]
    except Exception as e:
        try:
            supabase.storage.from_("cvs").remove([storage_path])
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Erreur création soumission: {str(e)}")

    sub["consultant"] = consultant
    return sub


@router.get("/ao/{ao_id}")
async def list_submissions_for_ao(ao_id: str, user: dict = Depends(get_current_user)):
    """
    Admin: sees every submission for this AO.
    Partner: sees only their own submissions for this AO.
    """
    _check_ao_access(ao_id, user)
    try:
        # Admin gets submitter profile; partners only see their own submissions
        if user["role"] == "admin":
            select = (
                "*, "
                "consultants(id, name, tjm, skills, experience_years, employment_type, availability), "
                "submitter:profiles!submitted_by(id, name, email)"
            )
        else:
            select = "*, consultants(id, name, tjm, skills, experience_years, employment_type, availability)"

        query = supabase.table("submissions").select(select).eq(
            "ao_id", ao_id
        ).order("submitted_at", desc=True)

        if user["role"] == "ao":
            query = query.eq("submitted_by", user["sub"])

        return query.execute().data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mine")
async def list_my_submissions(user: dict = Depends(get_current_user)):
    """Return all submissions made by the current user, with AO title."""
    try:
        return supabase.table("submissions").select(
            "id, ao_id, submitted_at, appels_offres(title)"
        ).eq("submitted_by", user["sub"]).order("submitted_at", desc=True).execute().data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{submission_id}")
async def delete_submission(submission_id: str, user: dict = Depends(get_current_user)):
    try:
        sub = supabase.table("submissions").select("*").eq("id", submission_id).single().execute().data
    except Exception:
        raise HTTPException(status_code=404, detail="Soumission introuvable")

    if user["role"] != "admin" and sub["submitted_by"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Accès interdit")

    # Attempt to delete the file from storage (best-effort)
    try:
        path = f"{sub['ao_id']}/{submission_id}.pdf"
        supabase.storage.from_("cvs").remove([path])
    except Exception:
        pass

    supabase.table("submissions").delete().eq("id", submission_id).execute()
    return {"message": "Soumission supprimée"}
