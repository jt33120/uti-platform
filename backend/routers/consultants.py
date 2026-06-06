from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Literal
from services.supabase_client import supabase
from routers.auth import get_current_user

router = APIRouter(prefix="/consultants", tags=["consultants"])


class ConsultantCreate(BaseModel):
    name: str
    skills: str
    tjm: Optional[int] = None
    experience_years: Optional[int] = None
    availability: Optional[str] = None
    employment_type: Optional[Literal["independant", "salarie"]] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class ConsultantUpdate(BaseModel):
    name: Optional[str] = None
    skills: Optional[str] = None
    tjm: Optional[int] = None
    experience_years: Optional[int] = None
    availability: Optional[str] = None
    employment_type: Optional[Literal["independant", "salarie"]] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@router.post("")
async def create_consultant(body: ConsultantCreate, user: dict = Depends(get_current_user)):
    """
    Create a consultant in the partner's vivier (talent pool).
    CV upload is no longer here — CVs are attached to specific AO submissions.
    """
    try:
        response = supabase.table("consultants").insert({
            "name": body.name,
            "skills": body.skills,
            "tjm": body.tjm,
            "experience_years": body.experience_years,
            "availability": body.availability,
            "employment_type": body.employment_type,
            "email": body.email,
            "phone": body.phone,
            "created_by": user["sub"],
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_consultants(user: dict = Depends(get_current_user)):
    """
    Admin: all consultants.
    Partner: only their own vivier.
    """
    try:
        query = supabase.table("consultants").select("*").order("created_at", desc=True)
        if user["role"] == "ao":
            query = query.eq("created_by", user["sub"])
        return query.execute().data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{consultant_id}")
async def get_consultant(consultant_id: str, user: dict = Depends(get_current_user)):
    try:
        response = supabase.table("consultants").select("*").eq("id", consultant_id).single().execute()
        consultant = response.data
        if user["role"] == "ao" and consultant["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Accès interdit")
        return consultant
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Consultant introuvable")


@router.patch("/{consultant_id}")
async def update_consultant(consultant_id: str, body: ConsultantUpdate, user: dict = Depends(get_current_user)):
    try:
        consultant = supabase.table("consultants").select("*").eq("id", consultant_id).single().execute().data
        if user["role"] == "ao" and consultant["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Accès interdit")
        update_data = body.model_dump(exclude_none=True)
        response = supabase.table("consultants").update(update_data).eq("id", consultant_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{consultant_id}")
async def delete_consultant(consultant_id: str, user: dict = Depends(get_current_user)):
    try:
        consultant = supabase.table("consultants").select("*").eq("id", consultant_id).single().execute().data
        if user["role"] != "admin" and consultant["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Accès interdit")
        supabase.table("consultants").delete().eq("id", consultant_id).execute()
        return {"message": "Consultant supprimé"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
