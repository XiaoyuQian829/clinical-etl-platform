from __future__ import annotations
import math
import os
from typing import Any
from sqlalchemy import create_engine, text, Engine


def _clean_record(record: dict) -> dict:
    """Convert pandas NaN / NaT values to None so PostgreSQL accepts them."""
    cleaned = {}
    for k, v in record.items():
        if v is None:
            cleaned[k] = None
        elif isinstance(v, float) and math.isnan(v):
            cleaned[k] = None
        elif hasattr(v, "isoformat"):
            # pandas Timestamp or datetime — but NaT.isoformat() returns "NaT"
            iso = v.isoformat()
            cleaned[k] = None if iso == "NaT" else iso
        else:
            # Catch pandas NaT which renders as "NaT" string
            s = str(v)
            if s in ("NaT", "nan", "None"):
                cleaned[k] = None
            else:
                cleaned[k] = v
    return cleaned


def _clean_records(records: list[dict]) -> list[dict]:
    return [_clean_record(r) for r in records]


def get_engine() -> Engine:
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db   = os.getenv("POSTGRES_DB", "clinical_etl")
    user = os.getenv("POSTGRES_USER", "admin")
    pw   = os.getenv("POSTGRES_PASSWORD", "admin123")
    url  = f"postgresql+psycopg2://{user}:{pw}@{host}:{port}/{db}"
    return create_engine(url)


def _bulk_insert(records: list[dict], table: str, pk_field: str, engine: Engine) -> int:
    if not records:
        print(f"[load] {table}: 0 records (empty input)")
        return 0

    cols = list(records[0].keys())
    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    stmt = text(
        f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT ({pk_field}) DO NOTHING"
    )

    inserted = 0
    try:
        with engine.begin() as conn:
            result = conn.execute(stmt, records)
            inserted = result.rowcount
        print(f"[load] {table}: {inserted}/{len(records)} records inserted")
    except Exception as e:
        print(f"[load] {table}: ERROR — {e}")
    return inserted


def load_patients_raw(records: list[dict], engine: Engine) -> int:
    keep = ["subject_id", "gender", "anchor_age", "anchor_year", "anchor_year_group", "dod"]
    clean = [{k: r.get(k) for k in keep} for r in records if not r.get("_validation_errors")]
    return _bulk_insert(_clean_records(clean), "raw.patients", "subject_id", engine)


def load_admissions_raw(records: list[dict], engine: Engine) -> int:
    keep = ["hadm_id", "subject_id", "admittime", "dischtime", "deathtime",
            "admission_type", "admit_provider_id", "admission_location",
            "discharge_location", "insurance", "language", "marital_status",
            "race", "edregtime", "edouttime", "hospital_expire_flag"]
    clean = [{k: r.get(k) for k in keep} for r in records if not r.get("_validation_errors")]
    return _bulk_insert(_clean_records(clean), "raw.admissions", "hadm_id", engine)


def load_diagnoses_raw(records: list[dict], engine: Engine) -> int:
    keep = ["subject_id", "hadm_id", "seq_num", "icd_code", "icd_version"]
    clean = [{k: r.get(k) for k in keep} for r in records if not r.get("_validation_errors")]
    # diagnoses has a serial PK, use a different conflict target
    if not clean:
        return 0
    cols = list(clean[0].keys())
    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    stmt = text(
        f"INSERT INTO raw.diagnoses ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT ON CONSTRAINT uq_diagnoses_natural_key DO NOTHING"
    )
    inserted = 0
    try:
        with engine.begin() as conn:
            result = conn.execute(stmt, clean)
            inserted = result.rowcount
        print(f"[load] raw.diagnoses: {inserted}/{len(clean)} records inserted")
    except Exception as e:
        print(f"[load] raw.diagnoses: ERROR — {e}")
    return inserted


def load_patients_clean(records: list[dict], engine: Engine) -> int:
    keep = ["subject_id", "gender", "anchor_age", "anchor_year", "anchor_year_group",
            "dod", "age_band", "data_quality_flag"]
    clean = [{k: r.get(k) for k in keep} for r in records if not r.get("_validation_errors")]
    return _bulk_insert(_clean_records(clean), "clean.patients", "subject_id", engine)


def load_admissions_clean(records: list[dict], engine: Engine) -> int:
    keep = ["hadm_id", "subject_id", "admittime", "dischtime", "admission_type",
            "admission_location", "discharge_location", "insurance",
            "marital_status", "race", "los_days", "data_quality_flag"]
    clean = [{k: r.get(k) for k in keep} for r in records if not r.get("_validation_errors")]
    return _bulk_insert(_clean_records(clean), "clean.admissions", "hadm_id", engine)


def load_diagnoses_clean(records: list[dict], engine: Engine) -> int:
    keep = ["subject_id", "hadm_id", "seq_num", "icd_code", "icd_version",
            "icd_description", "is_valid_code"]
    clean = [{k: r.get(k) for k in keep} for r in records if not r.get("_validation_errors")]
    if not clean:
        return 0
    cols = list(clean[0].keys())
    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    stmt = text(
        f"INSERT INTO clean.diagnoses ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT ON CONSTRAINT uq_clean_diagnoses_natural_key DO NOTHING"
    )
    inserted = 0
    try:
        with engine.begin() as conn:
            result = conn.execute(stmt, clean)
            inserted = result.rowcount
        print(f"[load] clean.diagnoses: {inserted}/{len(clean)} records inserted")
    except Exception as e:
        print(f"[load] clean.diagnoses: ERROR — {e}")
    return inserted


# ---------------------------------------------------------------------------
# Generic raw loader — used for all new tables
# ---------------------------------------------------------------------------

def load_raw_generic(
    records: list[dict],
    table: str,
    columns: list[str],
    conflict_target: str,
    engine: Engine,
) -> int:
    """
    Load records into any raw.* table.

    conflict_target: either a column name ("col") for simple PK conflicts,
                     or a constraint name ("ON CONSTRAINT name") for composite keys.
    """
    rows = [{k: r.get(k) for k in columns} for r in records]
    rows = _clean_records(rows)
    if not rows:
        print(f"[load] {table}: 0 records")
        return 0

    col_list     = ", ".join(f'"{c}"' for c in columns)
    placeholders = ", ".join(f":{c}" for c in columns)

    if conflict_target.upper().startswith("ON CONSTRAINT"):
        conflict_clause = conflict_target
    elif conflict_target.startswith("("):
        conflict_clause = conflict_target   # already has parens
    else:
        conflict_clause = f"({conflict_target})"

    stmt = text(
        f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT {conflict_clause} DO NOTHING"
    )
    inserted = 0
    try:
        with engine.begin() as conn:
            result = conn.execute(stmt, rows)
            inserted = result.rowcount
        print(f"[load] {table}: {inserted:,}/{len(rows):,} records inserted")
    except Exception as e:
        print(f"[load] {table}: ERROR — {e}")
    return inserted


# ---------------------------------------------------------------------------
# Reference tables
# ---------------------------------------------------------------------------

def load_d_icd_procedures(records: list[dict], engine: Engine) -> int:
    return load_raw_generic(records, "raw.d_icd_procedures",
        ["icd_code", "icd_version", "long_title"], "(icd_code, icd_version)", engine)

def load_d_labitems(records: list[dict], engine: Engine) -> int:
    return load_raw_generic(records, "raw.d_labitems",
        ["itemid", "label", "fluid", "category"], "itemid", engine)

def load_d_hcpcs(records: list[dict], engine: Engine) -> int:
    return load_raw_generic(records, "raw.d_hcpcs",
        ["code", "category", "long_description", "short_description"], "code", engine)

def load_d_items(records: list[dict], engine: Engine) -> int:
    return load_raw_generic(records, "raw.d_items",
        ["itemid", "label", "abbreviation", "linksto", "category",
         "unitname", "param_type", "lownormalvalue", "highnormalvalue"], "itemid", engine)


# ---------------------------------------------------------------------------
# Hosp clinical tables
# ---------------------------------------------------------------------------

def load_lab_events(records: list[dict], engine: Engine) -> int:
    cols = ["labevent_id", "subject_id", "hadm_id", "specimen_id", "itemid",
            "order_provider_id", "charttime", "storetime", "value", "valuenum",
            "valueuom", "ref_range_lower", "ref_range_upper", "flag", "priority", "comments"]
    return load_raw_generic(records, "raw.lab_events", cols, "labevent_id", engine)

def load_prescriptions(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "pharmacy_id", "poe_id", "poe_seq",
            "order_provider_id", "starttime", "stoptime", "drug_type", "drug",
            "formulary_drug_cd", "gsn", "ndc", "prod_strength", "form_rx",
            "dose_val_rx", "dose_unit_rx", "form_val_disp", "form_unit_disp",
            "doses_per_24_hrs", "route"]
    return load_raw_generic(records, "raw.prescriptions", cols,
        "ON CONSTRAINT uq_prescriptions", engine)

def load_procedures_icd(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "seq_num", "chartdate", "icd_code", "icd_version"]
    return load_raw_generic(records, "raw.procedures_icd", cols,
        "ON CONSTRAINT uq_procedures_icd", engine)

def load_drg_codes(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "drg_type", "drg_code",
            "description", "drg_severity", "drg_mortality"]
    return load_raw_generic(records, "raw.drg_codes", cols,
        "ON CONSTRAINT uq_drg_codes", engine)

def load_microbiology_events(records: list[dict], engine: Engine) -> int:
    cols = ["microevent_id", "subject_id", "hadm_id", "micro_specimen_id",
            "order_provider_id", "chartdate", "charttime", "spec_itemid",
            "spec_type_desc", "test_seq", "storedate", "storetime", "test_itemid",
            "test_name", "org_itemid", "org_name", "isolate_num", "quantity",
            "ab_itemid", "ab_name", "dilution_text", "dilution_comparison",
            "dilution_value", "interpretation", "comments"]
    return load_raw_generic(records, "raw.microbiology_events", cols, "microevent_id", engine)

def load_pharmacy(records: list[dict], engine: Engine) -> int:
    cols = ["pharmacy_id", "subject_id", "hadm_id", "poe_id", "starttime", "stoptime",
            "medication", "proc_type", "status", "entertime", "verifiedtime", "route",
            "frequency", "disp_sched", "infusion_type", "sliding_scale", "lockout_interval",
            "basal_rate", "one_hr_max", "doses_per_24_hrs", "duration", "duration_interval",
            "expiration_value", "expiration_unit", "expirationdate", "dispensation", "fill_quantity"]
    return load_raw_generic(records, "raw.pharmacy", cols, "pharmacy_id", engine)

def load_emar(records: list[dict], engine: Engine) -> int:
    cols = ["emar_id", "emar_seq", "subject_id", "hadm_id", "poe_id", "pharmacy_id",
            "enter_provider_id", "charttime", "medication", "event_txt",
            "scheduletime", "storetime"]
    return load_raw_generic(records, "raw.emar", cols, "(emar_id, emar_seq)", engine)

def load_emar_detail(records: list[dict], engine: Engine) -> int:
    cols = ["emar_id", "emar_seq", "subject_id", "parent_field_ordinal",
            "administration_type", "pharmacy_id", "barcode_type", "reason_for_no_barcode",
            "complete_dose_not_given", "dose_due", "dose_due_unit", "dose_given",
            "dose_given_unit", "will_remainder_of_dose_be_given", "product_amount_given",
            "product_unit", "product_code", "product_description", "product_description_other",
            "prior_infusion_rate", "infusion_rate", "infusion_rate_adjustment",
            "infusion_rate_adjustment_amount", "infusion_rate_unit", "route",
            "infusion_complete", "completion_interval", "new_iv_bag_hung",
            "continued_infusion_in_other_location", "restart_interval", "side", "site",
            "non_formulary_visual_verification"]
    rows = [_clean_record({k: r.get(k) for k in cols}) for r in records]
    if not rows:
        return 0
    col_list     = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    stmt = text(f"INSERT INTO raw.emar_detail ({col_list}) VALUES ({placeholders})")
    inserted = 0
    try:
        with engine.begin() as conn:
            result = conn.execute(stmt, rows)
            inserted = result.rowcount
        print(f"[load] raw.emar_detail: {inserted:,}/{len(rows):,} records inserted")
    except Exception as e:
        print(f"[load] raw.emar_detail: ERROR — {e}")
    return inserted

def load_hcpcs_events(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "chartdate", "hcpcs_cd", "seq_num", "short_description"]
    return load_raw_generic(records, "raw.hcpcs_events", cols,
        "ON CONSTRAINT uq_hcpcs_events", engine)

def load_omr(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "chartdate", "seq_num", "result_name", "result_value"]
    return load_raw_generic(records, "raw.omr", cols, "ON CONSTRAINT uq_omr", engine)

def load_services(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "transfertime", "prev_service", "curr_service"]
    return load_raw_generic(records, "raw.services", cols,
        "ON CONSTRAINT uq_services", engine)

def load_transfers(records: list[dict], engine: Engine) -> int:
    cols = ["transfer_id", "subject_id", "hadm_id", "eventtype", "careunit", "intime", "outtime"]
    return load_raw_generic(records, "raw.transfers", cols, "transfer_id", engine)

def load_poe(records: list[dict], engine: Engine) -> int:
    cols = ["poe_id", "poe_seq", "subject_id", "hadm_id", "ordertime", "order_type",
            "order_subtype", "transaction_type", "discontinue_of_poe_id",
            "discontinued_by_poe_id", "order_provider_id", "order_status"]
    return load_raw_generic(records, "raw.poe", cols, "(poe_id, poe_seq)", engine)

def load_poe_detail(records: list[dict], engine: Engine) -> int:
    cols = ["poe_id", "poe_seq", "subject_id", "field_name", "field_value"]
    return load_raw_generic(records, "raw.poe_detail", cols,
        "ON CONSTRAINT uq_poe_detail", engine)


# ---------------------------------------------------------------------------
# ICU tables
# ---------------------------------------------------------------------------

def load_icu_stays(records: list[dict], engine: Engine) -> int:
    cols = ["stay_id", "subject_id", "hadm_id", "first_careunit", "last_careunit",
            "intime", "outtime", "los"]
    return load_raw_generic(records, "raw.icu_stays", cols, "stay_id", engine)

def load_chart_events(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "stay_id", "caregiver_id", "charttime", "storetime",
            "itemid", "value", "valuenum", "valueuom", "warning"]
    return load_raw_generic(records, "raw.chart_events", cols,
        "ON CONSTRAINT uq_chart_events", engine)

def load_input_events(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "stay_id", "caregiver_id", "starttime", "endtime",
            "storetime", "itemid", "amount", "amountuom", "rate", "rateuom",
            "orderid", "linkorderid", "ordercategoryname", "secondaryordercategoryname",
            "ordercomponenttypedescription", "ordercategorydescription", "patientweight",
            "totalamount", "totalamountuom", "isopenbag", "continueinnextdept",
            "statusdescription", "originalamount", "originalrate"]
    return load_raw_generic(records, "raw.input_events", cols,
        "ON CONSTRAINT uq_input_events", engine)

def load_output_events(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "stay_id", "caregiver_id", "charttime",
            "storetime", "itemid", "value", "valueuom"]
    return load_raw_generic(records, "raw.output_events", cols,
        "ON CONSTRAINT uq_output_events", engine)

def load_procedure_events(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "stay_id", "caregiver_id", "starttime", "endtime",
            "storetime", "itemid", "value", "valueuom", "location", "locationcategory",
            "orderid", "linkorderid", "ordercategoryname", "ordercategorydescription",
            "patientweight", "isopenbag", "continueinnextdept", "statusdescription",
            "originalamount", "originalrate"]
    # CSV uses uppercase ORIGINALAMOUNT/ORIGINALRATE — normalise
    normalised = []
    for r in records:
        row = dict(r)
        row["originalamount"] = row.pop("ORIGINALAMOUNT", row.get("originalamount"))
        row["originalrate"]   = row.pop("ORIGINALRATE",   row.get("originalrate"))
        normalised.append(row)
    return load_raw_generic(normalised, "raw.procedure_events", cols,
        "ON CONSTRAINT uq_procedure_events", engine)

def load_datetime_events(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "stay_id", "caregiver_id", "charttime",
            "storetime", "itemid", "value", "valueuom", "warning"]
    return load_raw_generic(records, "raw.datetime_events", cols,
        "ON CONSTRAINT uq_datetime_events", engine)

def load_ingredient_events(records: list[dict], engine: Engine) -> int:
    cols = ["subject_id", "hadm_id", "stay_id", "caregiver_id", "starttime", "endtime",
            "storetime", "itemid", "amount", "amountuom", "rate", "rateuom",
            "orderid", "linkorderid", "statusdescription", "originalamount", "originalrate"]
    return load_raw_generic(records, "raw.ingredient_events", cols,
        "ON CONSTRAINT uq_ingredient_events", engine)
