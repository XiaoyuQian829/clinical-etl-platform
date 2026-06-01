from __future__ import annotations
import os
import subprocess
import threading
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from governance.rbac import User
from api.middleware.auth import require_role
from api.schemas.response import ok, err

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])

# In-memory run state (keyed by run_id)
_runs: dict[str, dict] = {}


def _run_pipeline_async(run_id: str, client_host: str, user: User) -> None:
    """Execute the pipeline in a background thread so the API returns immediately."""
    _execute_pipeline(run_id, client_host, user)


@router.post("/run")
def trigger_pipeline(request: Request, user: User = Depends(require_role("pipeline_run"))):
    run_id = str(uuid.uuid4())[:8]
    _runs[run_id] = {
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "steps": {},
    }
    client_host = request.client.host if request.client else "unknown"
    t = threading.Thread(target=_run_pipeline_async, args=(run_id, client_host, user), daemon=True)
    t.start()
    return ok({"run_id": run_id, **_runs[run_id]})


def _execute_pipeline(run_id: str, client_host: str, user: User) -> None:
    from etl.extract import (
        extract_patients_csv, extract_admissions_csv, extract_diagnoses_csv, extract_csv,
    )
    from etl.transform import transform_patients, transform_admissions, transform_diagnoses
    from etl.validate import validate_patients, validate_admissions, validate_diagnoses, generate_validation_report
    from etl.load import (
        get_engine,
        load_patients_raw, load_admissions_raw, load_diagnoses_raw,
        load_patients_clean, load_admissions_clean, load_diagnoses_clean,
        # reference tables
        load_d_icd_procedures, load_d_labitems, load_d_hcpcs, load_d_items,
        # hosp clinical
        load_lab_events, load_prescriptions, load_procedures_icd, load_drg_codes,
        load_microbiology_events, load_pharmacy, load_emar, load_emar_detail,
        load_hcpcs_events, load_omr, load_services, load_transfers,
        load_poe, load_poe_detail,
        # icu
        load_icu_stays, load_chart_events, load_input_events, load_output_events,
        load_procedure_events, load_datetime_events, load_ingredient_events,
    )
    from governance.audit import AuditEntry, log_action

    RAW = "data/raw"

    try:
        # ── Extract ──────────────────────────────────────────────────────────
        _runs[run_id]["steps"]["extract"] = "running"
        patients_raw   = extract_patients_csv(f"{RAW}/patients.csv")
        admissions_raw = extract_admissions_csv(f"{RAW}/admissions.csv")
        diagnoses_raw  = extract_diagnoses_csv(f"{RAW}/diagnoses_icd.csv")
        _runs[run_id]["steps"]["extract"] = "complete"

        # ── Transform ─────────────────────────────────────────────────────────
        _runs[run_id]["steps"]["transform"] = "running"
        patients_t   = transform_patients(patients_raw)
        admissions_t = transform_admissions(admissions_raw)
        diagnoses_t  = transform_diagnoses(diagnoses_raw)
        _runs[run_id]["steps"]["transform"] = "complete"

        # ── Validate ──────────────────────────────────────────────────────────
        _runs[run_id]["steps"]["validate"] = "running"
        p_valid, p_invalid = validate_patients(patients_t)
        a_valid, a_invalid = validate_admissions(admissions_t)
        d_valid, d_invalid = validate_diagnoses(diagnoses_t)
        generate_validation_report("patients",   p_valid, p_invalid)
        generate_validation_report("admissions", a_valid, a_invalid)
        generate_validation_report("diagnoses",  d_valid, d_invalid)
        _runs[run_id]["steps"]["validate"] = "complete"

        # ── Load ──────────────────────────────────────────────────────────────
        _runs[run_id]["steps"]["load"] = "running"
        engine = get_engine()

        # Core medallion tables
        load_patients_raw(p_valid, engine)
        load_admissions_raw(a_valid, engine)
        load_diagnoses_raw(d_valid, engine)
        load_patients_clean(p_valid, engine)
        load_admissions_clean(a_valid, engine)
        load_diagnoses_clean(d_valid, engine)

        # Reference / lookup tables (small — safe to load in memory)
        load_d_labitems(extract_csv(f"{RAW}/d_labitems.csv"), engine)
        load_d_items(extract_csv(f"{RAW}/d_items.csv"), engine)

        # Hosp clinical tables (medium — safe)
        load_drg_codes(extract_csv(f"{RAW}/drgcodes.csv"), engine)
        load_services(extract_csv(f"{RAW}/services.csv"), engine)
        load_transfers(extract_csv(f"{RAW}/transfers.csv"), engine)
        load_omr(extract_csv(f"{RAW}/omr.csv"), engine)
        load_procedures_icd(extract_csv(f"{RAW}/procedures_icd.csv"), engine)
        load_microbiology_events(extract_csv(f"{RAW}/microbiologyevents.csv"), engine)
        load_icu_stays(extract_csv(f"{RAW}/icustays.csv"), engine)
        # Note: labevents (107K) and chartevents (668K) are pre-loaded via S3 sync
        # and skipped here to prevent OOM on t3.small EC2 (2GB RAM)

        _runs[run_id]["steps"]["load"] = "complete"

        # ── DBT ───────────────────────────────────────────────────────────────
        _runs[run_id]["steps"]["dbt"] = "running"
        dbt_env = {**os.environ, "POSTGRES_HOST": os.getenv("POSTGRES_HOST", "localhost")}
        dbt_result = subprocess.run(
            ["dbt", "run", "--profiles-dir", "dbt", "--project-dir", "dbt"],
            capture_output=True, text=True, env=dbt_env
        )
        if dbt_result.returncode == 0:
            _runs[run_id]["steps"]["dbt"] = "complete"
            print(f"[pipeline] dbt run complete")
        else:
            _runs[run_id]["steps"]["dbt"] = "failed"
            print(f"[pipeline] dbt run failed:\n{dbt_result.stderr[-500:]}")

        _runs[run_id]["status"] = "complete"
        _runs[run_id]["records"] = {
            "patients":   len(p_valid),
            "admissions": len(a_valid),
            "diagnoses":  len(d_valid),
        }

        log_action(AuditEntry(
            user_id=user.user_id, role=user.role, action="pipeline_run",
            resource="etl_pipeline", ip_address=client_host,
            outcome="approved", detail={"run_id": run_id, "records": _runs[run_id]["records"]},
        ), engine)

    except Exception as e:
        _runs[run_id]["status"] = "failed"
        _runs[run_id]["error"] = str(e)
        print(f"[pipeline] run {run_id} FAILED: {e}")


@router.get("/status/{run_id}")
def pipeline_status(run_id: str, user: User = Depends(require_role("pipeline_status"))):
    run = _runs.get(run_id)
    if not run:
        return err(f"Run {run_id} not found")
    return ok({"run_id": run_id, **run})
