from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from governance.rbac import User
from api.middleware.auth import require_role
from api.schemas.response import ok
from etl.load import get_engine

router = APIRouter(prefix="/data", tags=["Data"])

# Allowlisted raw tables — prevents SQL injection via table name
RAW_TABLES = {
    "lab_events":         ("labevent_id",   "data_read_clean"),
    "chart_events":       (None,            "data_read_clean"),
    "prescriptions":      (None,            "data_read_clean"),
    "microbiology_events":("microevent_id", "data_read_clean"),
    "icu_stays":          ("stay_id",       "data_read_clean"),
    "transfers":          ("transfer_id",   "data_read_clean"),
    "procedures_icd":     (None,            "data_read_clean"),
    "pharmacy":           ("pharmacy_id",   "data_read_clean"),
}


def _query_table(schema: str, table: str, order_col: str | None,
                 limit: int, offset: int) -> dict:
    engine = get_engine()
    order = f"ORDER BY {order_col}" if order_col else ""
    with engine.connect() as conn:
        rows = conn.execute(
            text(f"SELECT * FROM {schema}.{table} {order} LIMIT :limit OFFSET :offset"),
            {"limit": limit, "offset": offset},
        ).mappings().all()
        total = conn.execute(text(f"SELECT COUNT(*) FROM {schema}.{table}")).scalar()
    return {"total": total, "limit": limit, "offset": offset, "records": [dict(r) for r in rows]}


@router.get("/clean/patients")
def get_clean_patients(
    limit:  int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("data_read_clean")),
):
    return ok(_query_table("clean", "patients", "subject_id", limit, offset))


@router.get("/clean/admissions")
def get_clean_admissions(
    limit:  int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("data_read_clean")),
):
    return ok(_query_table("clean", "admissions", "hadm_id", limit, offset))


@router.get("/clean/diagnoses")
def get_clean_diagnoses(
    limit:  int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("data_read_clean")),
):
    return ok(_query_table("clean", "diagnoses", "subject_id", limit, offset))


@router.get("/raw/{table}")
def get_raw_table(
    table:  str,
    limit:  int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("data_read_clean")),
):
    if table not in RAW_TABLES:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Table '{table}' not available")
    order_col, _ = RAW_TABLES[table]
    return ok(_query_table("raw", table, order_col, limit, offset))


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
    conditions, params = [], {"limit": limit, "offset": offset}
    if age_band:       conditions.append("age_band = :age_band");             params["age_band"] = age_band
    if gender:         conditions.append("gender = :gender");                  params["gender"] = gender
    if admission_type: conditions.append("admission_type = :admission_type");  params["admission_type"] = admission_type
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    with get_engine().connect() as conn:
        rows  = conn.execute(text(f"SELECT * FROM research.cohort {where} ORDER BY cohort_id LIMIT :limit OFFSET :offset"), params).mappings().all()
        total = conn.execute(text(f"SELECT COUNT(*) FROM research.cohort {where}"), params).scalar()
    return ok({"total": total, "limit": limit, "offset": offset, "records": [dict(r) for r in rows]})
