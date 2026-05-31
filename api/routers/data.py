from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from governance.rbac import User
from api.middleware.auth import require_role
from api.schemas.response import ok
from etl.load import get_engine

router = APIRouter(prefix="/data", tags=["Data"])


@router.get("/clean/patients")
def get_clean_patients(
    limit:  int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("data_read_clean")),
):
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM clean.patients ORDER BY subject_id LIMIT :limit OFFSET :offset"),
            {"limit": limit, "offset": offset},
        ).mappings().all()
        total = conn.execute(text("SELECT COUNT(*) FROM clean.patients")).scalar()
    return ok({"total": total, "limit": limit, "offset": offset, "records": [dict(r) for r in rows]})


@router.get("/research/cohort")
def get_research_cohort(
    limit:          int = Query(50, ge=1, le=500),
    offset:         int = Query(0, ge=0),
    age_band:       str | None = Query(None),
    gender:         str | None = Query(None),
    admission_type: str | None = Query(None),
    user: User = Depends(require_role("data_read_research")),
):
    engine = get_engine()
    conditions = []
    params: dict = {"limit": limit, "offset": offset}

    if age_band:
        conditions.append("age_band = :age_band")
        params["age_band"] = age_band
    if gender:
        conditions.append("gender = :gender")
        params["gender"] = gender
    if admission_type:
        conditions.append("admission_type = :admission_type")
        params["admission_type"] = admission_type

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    with engine.connect() as conn:
        rows = conn.execute(
            text(f"SELECT * FROM research.cohort {where} ORDER BY cohort_id LIMIT :limit OFFSET :offset"),
            params,
        ).mappings().all()
        total = conn.execute(text(f"SELECT COUNT(*) FROM research.cohort {where}"), params).scalar()

    return ok({"total": total, "limit": limit, "offset": offset, "records": [dict(r) for r in rows]})
