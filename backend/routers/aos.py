from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
from services.cv_parser import extract_text_from_pdf, extract_text_from_docx
from services import ao_drafter
from services.matching_runner import run_vivier_matching
from services.ratelimit import rate_limit
from routers.auth import get_current_user, require_staff, is_staff
from routers.scoring_config import AOScoringOverrides

router = APIRouter(prefix="/aos", tags=["appels_offres"])


def _overrides_for_storage(ov: Optional[AOScoringOverrides]) -> Optional[dict]:
    """Valide la cohérence des seuils d'un override d'AO et renvoie le dict à stocker."""
    if ov is None:
        return None
    if ov.reco_fort_min is not None and ov.reco_moyen_min is not None \
            and ov.reco_fort_min <= ov.reco_moyen_min:
        raise HTTPException(
            status_code=422,
            detail="Le seuil FORT doit être strictement supérieur au seuil MOYEN.",
        )
    return ov.to_storage()


AO_TYPES = [
    "Assurance",
    "Banque / Finance",
    "IT / Dev",
    "Énergie",
    "Retail",
    "Public",
    "Santé",
    "Autre",
]


class AOCreate(BaseModel):
    client_id: str
    title: str
    description: str
    skills_required: str
    budget_max: Optional[int] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    context: Optional[str] = None
    ao_type: Optional[str] = None
    deadline: Optional[str] = None  # date limite de réponse (YYYY-MM-DD)
    scoring_overrides: Optional[AOScoringOverrides] = None  # priorités de matching propres à l'AO


class AOUpdate(BaseModel):
    client_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    skills_required: Optional[str] = None
    budget_max: Optional[int] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    context: Optional[str] = None
    ao_type: Optional[str] = None
    deadline: Optional[str] = None  # date limite de réponse (YYYY-MM-DD)
    status: Optional[str] = None
    scoring_overrides: Optional[AOScoringOverrides] = None


def _accessible_client_ids(user: dict) -> Optional[list[str]]:
    """
    Returns the list of client_ids a partner can see, or None for admin (= all).
    Suspended access is excluded.
    """
    if is_staff(user):
        return None
    access = supabase.table("partner_clients").select("client_id").eq(
        "partner_id", user["sub"]
    ).in_("tier", ["list_1", "list_2"]).execute()
    return [row["client_id"] for row in (access.data or [])]


@router.get("/types")
async def get_ao_types():
    return AO_TYPES


@router.post("/draft", dependencies=[Depends(rate_limit(10, 60))])
async def draft_ao(
    pasted_text: str = Form(""),
    files: list[UploadFile] = File(default=[]),
    user: dict = Depends(require_staff),
):
    """
    Generate editable AO fields from raw source material: pasted email text and/or
    attachments (PDF, DOCX, TXT). The staff member reviews and edits the result
    before saving — nothing is persisted here.
    """
    if not ao_drafter.is_available():
        raise HTTPException(status_code=503, detail="Génération IA indisponible (clé OpenRouter non configurée).")

    parts: list[str] = []
    if pasted_text and pasted_text.strip():
        parts.append(pasted_text.strip())

    for f in files:
        data = await f.read()
        if not data:
            continue
        name = (f.filename or "").lower()
        try:
            if name.endswith(".pdf"):
                parts.append(extract_text_from_pdf(data))
            elif name.endswith(".docx"):
                parts.append(extract_text_from_docx(data))
            elif name.endswith(".txt"):
                parts.append(data.decode("utf-8", errors="ignore"))
            # other formats are silently skipped
        except Exception:
            # unreadable file → skip rather than fail the whole request
            continue

    source = "\n\n".join(p for p in parts if p and p.strip())
    if not source.strip():
        raise HTTPException(
            status_code=422,
            detail="Aucun contenu exploitable. Collez le texte de l'email ou ajoutez un PDF/DOCX.",
        )

    try:
        fields = await ao_drafter.draft_ao_fields(source, AO_TYPES)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur de génération IA : {e}")

    if fields is None:
        raise HTTPException(status_code=502, detail="L'IA n'a pas renvoyé de résultat exploitable. Réessayez.")
    return fields


@router.post("")
async def create_ao(body: AOCreate, background_tasks: BackgroundTasks, user: dict = Depends(require_staff)):
    try:
        record = {
            "client_id": body.client_id,
            "title": body.title,
            "description": body.description,
            "skills_required": body.skills_required,
            "budget_max": body.budget_max,
            "location": body.location,
            "duration": body.duration,
            "context": body.context,
            "ao_type": body.ao_type,
            "deadline": body.deadline,
            "status": "open",
            "created_by": user["sub"],
        }
        overrides = _overrides_for_storage(body.scoring_overrides)
        try:
            response = supabase.table("appels_offres").insert(
                {**record, "scoring_overrides": overrides}
            ).execute()
        except Exception:
            # Colonne scoring_overrides pas encore migrée → on crée l'AO sans elle.
            response = supabase.table("appels_offres").insert(record).execute()
        ao = response.data[0]
        # Kick off vivier recommendations right away — staff get suggested
        # consultants before any partner submits a CV.
        background_tasks.add_task(run_vivier_matching, ao["id"], user["sub"])
        return ao
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_aos(user: dict = Depends(get_current_user)):
    """
    Returns AOs with client info + submission count.
    Partners see only AOs from clients they have list_1/list_2 access to.
    Response is annotated with partner tier (`tier`) when applicable so the
    frontend can group by tier.
    """
    try:
        ids = _accessible_client_ids(user)
        query = supabase.table("appels_offres").select(
            "*, clients(id, name, sector, logo_url), submissions(count)"
        ).order("created_at", desc=True)

        if ids is not None:
            if not ids:
                return []
            query = query.in_("client_id", ids)

        aos = query.execute().data

        # Flatten the submissions count into `submission_count`
        for ao in aos:
            subs = ao.get("submissions")
            if isinstance(subs, list) and subs:
                ao["submission_count"] = subs[0].get("count", 0)
            else:
                ao["submission_count"] = 0
            ao.pop("submissions", None)

        # Attach the partner's tier per client
        if user["role"] == "ao":
            access = supabase.table("partner_clients").select("client_id, tier").eq(
                "partner_id", user["sub"]
            ).execute().data or []
            tiers = {row["client_id"]: row["tier"] for row in access}
            for ao in aos:
                ao["tier"] = tiers.get(ao["client_id"])

        return aos
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ao_id}")
async def get_ao(ao_id: str, user: dict = Depends(get_current_user)):
    try:
        response = supabase.table("appels_offres").select(
            "*, clients(id, name, sector, description, logo_url), submissions(count)"
        ).eq("id", ao_id).single().execute()
        ao = response.data

        # Access check for partners
        if user["role"] == "ao":
            access = supabase.table("partner_clients").select("tier").eq(
                "partner_id", user["sub"]
            ).eq("client_id", ao["client_id"]).in_("tier", ["list_1", "list_2"]).execute()
            if not access.data:
                raise HTTPException(status_code=403, detail="Accès refusé à cet AO")
            ao["tier"] = access.data[0]["tier"]

        subs = ao.get("submissions")
        if isinstance(subs, list) and subs:
            ao["submission_count"] = subs[0].get("count", 0)
        else:
            ao["submission_count"] = 0
        ao.pop("submissions", None)

        return ao
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="AO introuvable")


@router.get("/{ao_id}/stats")
async def get_ao_stats(ao_id: str, user: dict = Depends(require_staff)):
    """
    Funnel analytics for an AO (UTI staff).

    Returns, for this AO:
    - partners who *could* answer it (list_1/list_2 access to the AO's client)
    - partners who *actually* answered it (submitted at least one CV)
    - consultants that have been proposed (distinct consultants submitted)
    - consultants that *match the criteria* but haven't been proposed yet
      (skill overlap with the AO, owned by an eligible partner, not yet submitted)
    """
    try:
        ao = supabase.table("appels_offres").select("*").eq("id", ao_id).single().execute().data
    except Exception:
        raise HTTPException(status_code=404, detail="AO introuvable")

    client_id = ao.get("client_id")

    # ── Partners who could answer (eligible access on this client) ──
    eligible_rows = []
    if client_id:
        eligible_rows = supabase.table("partner_clients").select("partner_id, tier").eq(
            "client_id", client_id
        ).in_("tier", ["list_1", "list_2"]).execute().data or []
    eligible_partner_ids = {r["partner_id"] for r in eligible_rows}
    partners_list_1 = sum(1 for r in eligible_rows if r["tier"] == "list_1")
    partners_list_2 = sum(1 for r in eligible_rows if r["tier"] == "list_2")

    # ── Submissions for this AO ────────────────────────────────────
    subs = supabase.table("submissions").select(
        "id, submitted_by, consultant_id"
    ).eq("ao_id", ao_id).execute().data or []
    responded_partner_ids = {s["submitted_by"] for s in subs if s.get("submitted_by")}
    proposed_consultant_ids = {s["consultant_id"] for s in subs if s.get("consultant_id")}

    # ── Consultants matching the AO criteria, owned by eligible partners ──
    ao_skills = [s.strip().lower() for s in (ao.get("skills_required") or "").split(",") if s.strip()]
    pool_eligible = 0
    eligible_not_proposed = 0
    if eligible_partner_ids:
        consultants = supabase.table("consultants").select(
            "id, skills, created_by"
        ).in_("created_by", list(eligible_partner_ids)).execute().data or []
        for c in consultants:
            c_skills = [s.strip().lower() for s in (c.get("skills") or "").split(",") if s.strip()]
            matches = (
                any(any(a in cs or cs in a for cs in c_skills) for a in ao_skills)
                if ao_skills else True
            )
            if matches:
                pool_eligible += 1
                if c["id"] not in proposed_consultant_ids:
                    eligible_not_proposed += 1

    return {
        "partners_eligible": len(eligible_partner_ids),
        "partners_list_1": partners_list_1,
        "partners_list_2": partners_list_2,
        "partners_responded": len(responded_partner_ids),
        "consultants_proposed": len(proposed_consultant_ids),
        "consultants_pool_eligible": pool_eligible,
        "consultants_eligible_not_proposed": eligible_not_proposed,
        "submissions_total": len(subs),
    }


@router.patch("/{ao_id}")
async def update_ao(ao_id: str, body: AOUpdate, user: dict = Depends(require_staff)):
    try:
        update_data = body.model_dump(exclude_none=True)
        if "scoring_overrides" in update_data:
            # Revalide la cohérence des seuils et normalise pour le stockage.
            update_data["scoring_overrides"] = _overrides_for_storage(body.scoring_overrides)
        try:
            response = supabase.table("appels_offres").update(update_data).eq("id", ao_id).execute()
        except Exception:
            # Colonne scoring_overrides pas encore migrée → on met à jour le reste.
            update_data.pop("scoring_overrides", None)
            response = supabase.table("appels_offres").update(update_data).eq("id", ao_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BulkDeleteRequest(BaseModel):
    ids: list[str]


@router.post("/bulk-delete")
async def bulk_delete_aos(body: BulkDeleteRequest, user: dict = Depends(require_staff)):
    """Delete several AOs in one shot (multi-select on the AO list)."""
    if not body.ids:
        raise HTTPException(status_code=422, detail="Aucun AO sélectionné")
    try:
        supabase.table("appels_offres").delete().in_("id", body.ids).execute()
        return {"message": f"{len(body.ids)} AO(s) supprimé(s)", "count": len(body.ids)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{ao_id}")
async def delete_ao(ao_id: str, user: dict = Depends(require_staff)):
    try:
        supabase.table("appels_offres").delete().eq("id", ao_id).execute()
        return {"message": "AO supprimé"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
