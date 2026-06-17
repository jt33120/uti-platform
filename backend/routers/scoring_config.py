"""
Paramètres de scoring pilotables par l'admin (poids de la grille + seuils).

Lecture : staff UTI. Écriture : admin uniquement. Toute modification est
journalisée (audit_log, Art. 12) et impacte les scorings suivants.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from services.supabase_client import supabase
from services.scoring import DEFAULTS, GRID_VERSION
from services import audit
from routers.auth import require_staff, require_admin

router = APIRouter(prefix="/scoring-config", tags=["scoring-config"])


class ScoringConfig(BaseModel):
    w_competences: int = Field(ge=0, le=100)
    w_seniorite: int = Field(ge=0, le=100)
    w_contexte: int = Field(ge=0, le=100)
    w_tjm: int = Field(ge=0, le=100)
    seniority_full_years: int = Field(ge=1, le=40)
    reco_fort_min: int = Field(ge=0, le=100)
    reco_moyen_min: int = Field(ge=0, le=100)


@router.get("")
async def get_scoring_config(user: dict = Depends(require_staff)):
    """Config effective (défauts + surcharges stockées) + métadonnées."""
    stored = {}
    try:
        rows = supabase.table("scoring_config").select("*").limit(1).execute().data or []
        if rows:
            stored = {k: rows[0][k] for k in DEFAULTS if rows[0].get(k) is not None}
    except Exception as e:
        # Table peut ne pas exister encore — on renvoie les défauts.
        print(f"[SCORING] lecture config: {e}")
    effective = {**DEFAULTS, **stored}
    return {
        "config": effective,
        "defaults": DEFAULTS,
        "grid_version": GRID_VERSION,
        "is_custom": stored != {},
    }


@router.put("")
async def update_scoring_config(body: ScoringConfig, user: dict = Depends(require_admin)):
    """Met à jour la grille (admin). Valide la cohérence des seuils et des poids."""
    if body.reco_fort_min <= body.reco_moyen_min:
        raise HTTPException(
            status_code=422,
            detail="Le seuil FORT doit être strictement supérieur au seuil MOYEN.",
        )
    total_weights = body.w_competences + body.w_seniorite + body.w_contexte + body.w_tjm
    if total_weights != 100:
        raise HTTPException(
            status_code=422,
            detail=f"La somme des poids doit faire 100 (actuellement {total_weights}).",
        )

    payload = body.model_dump()
    payload["updated_by"] = user["sub"]

    try:
        existing = supabase.table("scoring_config").select("id").limit(1).execute().data or []
        if existing:
            supabase.table("scoring_config").update(payload).eq("id", existing[0]["id"]).execute()
        else:
            supabase.table("scoring_config").insert(payload).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur enregistrement config: {e}")

    audit.log_event(
        "config_change", audit.new_run_id(),
        actor_id=user["sub"], grid_version=GRID_VERSION,
        payload=body.model_dump(),
    )
    return {"config": body.model_dump(), "message": "Grille de scoring mise à jour."}
