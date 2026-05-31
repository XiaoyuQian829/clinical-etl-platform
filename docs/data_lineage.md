# Data Lineage — ClinicalETL Platform

End-to-end traceability from raw MIMIC-IV source files to de-identified research exports.

---

## Source Files

| File | Rows | Description |
|---|---|---|
| `data/raw/patients.csv` | 100 | Patient demographics (subject_id, gender, anchor_age, anchor_year, dod) |
| `data/raw/admissions.csv` | 275 | Hospital admissions (hadm_id, admittime, dischtime, admission_type, race, insurance) |
| `data/raw/diagnoses_icd.csv` | 4,506 | ICD-coded diagnoses (subject_id, hadm_id, seq_num, icd_code, icd_version) |
| `data/raw/d_icd_diagnoses.csv` | 109,775 | ICD-9/10 reference codes with long_title descriptions |
| `data/raw/fhir_sample.json` | 3 | FHIR R4 Bundle with Patient resources (DynamoDB ingest path) |

---

## Lineage Graph

```
data/raw/patients.csv
        │  etl/extract.py: extract_patients_csv()
        │  etl/transform.py: transform_patients()   → gender norm, age_band
        │  etl/validate.py: validate_patients()     → Pydantic PatientRaw
        │  etl/load.py: load_patients_raw()
        ▼
raw.patients (100 rows)
        │  dbt: clean_patients.sql
        │    CASE WHEN anchor_age → age_band
        │    data_quality_flag computed from null check
        ▼
clean.patients (100 rows)
        │
        └──────────────────────────────────────────┐
                                                   │
data/raw/admissions.csv                            │
        │  etl/extract.py: extract_admissions_csv()│
        │  etl/transform.py: transform_admissions()│ → ISO8601, los_days
        │  etl/validate.py: validate_admissions()  │ → Pydantic AdmissionRaw
        │  etl/load.py: load_admissions_raw()       │
        ▼                                           │
raw.admissions (275 rows)                          │
        │  dbt: clean_admissions.sql               │
        │    JOIN clean.patients ON subject_id      │
        │    EXTRACT(EPOCH …)/86400 → los_days      │
        ▼                                           │
clean.admissions (275 rows) ◄──────────────────────┘
        │
        └──────────────────────────────────────────┐
                                                   │
data/raw/diagnoses_icd.csv                         │
        │  etl/extract.py: extract_diagnoses_csv() │
        │  etl/transform.py: transform_diagnoses() │ → ICD lookup
        │  etl/validate.py: validate_diagnoses()   │ → Pydantic DiagnosisRaw
        │  etl/load.py: load_diagnoses_raw()        │
        ▼                                           │
raw.diagnoses (4,506 rows)                         │
        │  dbt: clean_diagnoses.sql                │
        │    LEFT JOIN raw.icd_reference            │
        │      ON (icd_code, icd_version)           │
        │    icd_description = ref.long_title       │
        ▼                                           │
clean.diagnoses (4,506 rows, 100% icd_description) │
        │                                           │
        └──────────────────────────────────────────┤
                                                   │
data/raw/d_icd_diagnoses.csv                       │
        │  etl/load.py (bulk insert)                │
        ▼                                           │
raw.icd_reference (109,775 rows) ─────────────────►┘
        (JOIN used in clean_diagnoses.sql)


                    clean.patients ──────────────────────┐
                    clean.admissions ────────────────────┤
                    clean.diagnoses (seq_num=1 filter) ──┤
                                                        │
                                         dbt: research_cohort.sql
                                           ROW_NUMBER() → cohort_id (no subject_id)
                                           round(los_days, 1)
                                           primary_diagnosis_code + desc
                                           is_deidentified = true
                                                        │
                                                        ▼
                                         research.cohort (275 rows)
                                                        │
                                         dbt: research_outcomes.sql
                                           30-day readmission window function
                                                        │
                                                        ▼
                                         research.outcomes (275 rows)
                                                        │
                                              /export/request (API)
                                           etl/deidentify.py:
                                             remove_direct_identifiers()
                                             generalise_quasi_identifiers()
                                             check_k_anonymity(k=5)
                                                        │
                                                        ▼
                                         data/exports/export_{id}.csv
                                         (508 rows, no PII)
```

---

## DBT Model Summary

| Model | Schema | Rows | Materialization | Key Transforms |
|---|---|---|---|---|
| clean_patients | clean | 100 | table | age_band CASE, data_quality_flag |
| clean_admissions | clean | 275 | table | los_days EPOCH calc, JOIN clean.patients |
| clean_diagnoses | clean | 4,506 | table | LEFT JOIN icd_reference → icd_description |
| research_cohort | research | 275 | table (alias: cohort) | ROW_NUMBER() de-id, primary diagnosis (seq_num=1) |
| research_outcomes | research | 275 | table (alias: outcomes) | readmission_30d 30-day window |

---

## DBT Tests (22 total, all passing)

| Category | Test | Target | Result |
|---|---|---|---|
| Custom | assert_no_duplicate_patients | raw.patients | PASS — 0 duplicates |
| Custom | assert_valid_icd_codes | raw.diagnoses | PASS — 0 invalid codes |
| not_null | subject_id, gender, age_band | clean.patients | PASS |
| unique | subject_id | clean.patients | PASS |
| not_null | hadm_id, subject_id | clean.admissions | PASS |
| unique | hadm_id | clean.admissions | PASS |
| not_null | hadm_id, subject_id | clean.diagnoses | PASS |
| not_null | icd_code, icd_version | raw.icd_reference (source) | PASS |
| not_null | subject_id, gender | raw.patients (source) | PASS |
| unique | subject_id | raw.patients (source) | PASS |
| not_null | admittime, hadm_id, subject_id | raw.admissions (source) | PASS |
| unique | hadm_id | raw.admissions (source) | PASS |
| not_null | hadm_id, subject_id | raw.diagnoses (source) | PASS |

---

## Python ETL Field Transformations

### Patients

| Source Field | Transform | Output Field |
|---|---|---|
| gender (M/F/Male/Female/m/f) | mapping dict → M/F/UNKNOWN | gender |
| anchor_age | CASE: ≤17→PAEDIATRIC, ≤40→YOUNG_ADULT, ≤65→ADULT, 66+→ELDERLY | age_band |
| dod (float NaN) | NaN → None | dod |
| — | null check on required fields | data_quality_flag (PASS/WARN/FAIL) |

### Admissions

| Source Field | Transform | Output Field |
|---|---|---|
| admittime, dischtime | pandas Timestamp → ISO 8601 string | admittime, dischtime |
| admittime + dischtime | (dischtime − admittime).total_seconds() / 86400 | los_days (float, 2dp) |
| admission_type, race | str.strip().upper() | admission_type, race |
| deathtime, edregtime, edouttime (NaT) | isoformat() == "NaT" → None | (NULL in DB) |

### Diagnoses

| Source Field | Transform | Output Field |
|---|---|---|
| icd_code | str.strip().upper() | icd_code |
| icd_code | exact match in icd_reference (109,775 entries) | icd_description |
| icd_code | len(code) >= 3 | is_valid_code (bool) |

---

## Audit Trail Coverage

Every data access and mutation through the API is recorded in `public.audit_logs`:

| Action | Logged When |
|---|---|
| pipeline_run | POST /pipeline/run completes |
| export_requested | POST /export/request completes |
| export_downloaded | GET /export/download/{id} called |

The audit log includes: user_id, role, action, resource, ip_address, outcome (approved/denied/error), and optional JSONB detail (e.g. record_count, run_id).

---

*Generated from: MIMIC-IV Clinical Database Demo v2.2 (PhysioNet)*  
*DBT lineage graph: `dbt docs serve --profiles-dir dbt --project-dir dbt`*
