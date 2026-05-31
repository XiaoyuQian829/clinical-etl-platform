# ClinicalETL — Claude Code Development Checklist

> Use this as your step-by-step build guide. Work top to bottom. Tick each item before moving on.  
> Each section maps to a Claude Code session. Paste the prompt directly into Claude Code.

---

## Pre-Build Setup (Do Tonight)

### Environment
- [ ] Install Python 3.11+
- [ ] Install PostgreSQL 15+ locally
- [ ] Install Node.js 20+
- [ ] Install AWS CLI v2 + configure credentials (`aws configure`)
- [x] Install DBT: `pip install dbt-postgres` *(in requirements.txt)*
- [x] Install project deps: `pip install fastapi uvicorn sqlalchemy pydantic pandas pymongo python-jose passlib boto3` *(requirements.txt created)*

### Accounts
- [ ] Register PhysioNet account → physionet.org
- [x] Download MIMIC-IV demo → physionet.org/content/mimic-iv-demo *(data/raw/ populated)*
- [ ] Register Databricks Community Edition → databricks.com/try
- [ ] Confirm AWS DynamoDB accessible in AWS console (no separate registration needed)
- [ ] Confirm AWS account: EC2, RDS, S3, Amplify all accessible

### Project Init
- [ ] Create GitHub repo: `clinical-etl-platform`
- [x] Create project root folder locally
- [x] Copy file tree from system design doc *(all directories and files created)*
- [x] Create `.env.example` with all required env vars (see below)
- [x] Create `docker-compose.yml` for local PostgreSQL

**.env.example**
```
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=clinical_etl
POSTGRES_USER=admin
POSTGRES_PASSWORD=

# AWS DynamoDB
MONGO_URI=DYNAMODB_TABLE=clinical_etl_fhir

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-southeast-2
S3_BUCKET_NAME=clinical-etl-raw

# JWT
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# Databricks
DATABRICKS_HOST=
DATABRICKS_TOKEN=
```

---

## PHASE 1 — Database & Schema

### 1.1 PostgreSQL Setup

**Claude Code prompt:**
> "Create a PostgreSQL schema init script for a clinical ETL platform with medallion architecture. Create three schemas: raw, clean, research. In raw schema: raw.patients (subject_id, gender, anchor_age, anchor_year, dod, created_at), raw.admissions (hadm_id, subject_id, admittime, dischtime, admission_type, admission_location, discharge_location, insurance, marital_status, race, created_at), raw.diagnoses (subject_id, hadm_id, seq_num, icd_code, icd_version, created_at). In clean schema: clean.patients (same fields + age_band, data_quality_flag), clean.admissions (same + los_days, data_quality_flag), clean.diagnoses (same + icd_description, is_valid_code). In research schema: research.cohort (cohort_id, age_band, gender, admission_type, los_days, primary_diagnosis_code, primary_diagnosis_desc, is_deidentified bool), research.outcomes (cohort_id, readmission_30d bool, icu_admission bool). Add audit_logs table in public schema: id, timestamp, user_id, role, action, resource, ip_address, outcome, detail jsonb. Add indexes on subject_id and hadm_id across all tables."

- [x] Run script: `psql -U admin -d clinical_etl -f infra/aws/rds_init.sql` *(verified: all schemas and tables created)*
- [x] Verify all schemas created: `\dn` in psql *(raw, clean, research, public)*
- [x] Verify all tables created: `\dt raw.*` `\dt clean.*` `\dt research.*` *(3+3+2 tables confirmed)*

### 1.2 DynamoDB Setup

**Claude Code prompt:**
> "Create an AWS DynamoDB setup in Python using boto3. File: dynamodb/fhir_ingest.py. Use boto3 to connect to DynamoDB in ap-southeast-2 region. Create table: clinical_etl_fhir with partition key subject_id (String). Write function ingest_fhir_document(fhir_json: dict): validates document has resourceType=Patient and subject_id, puts item into DynamoDB table with ingested_at timestamp using boto3 put_item. Write function get_fhir_by_subject_id(subject_id: str): query DynamoDB using get_item by subject_id, return document or None. Add thorough comments. Print ingestion result and item count after each operation."

- [x] dynamodb/fhir_ingest.py created with ingest_fhir_document + get_fhir_by_subject_id
- [ ] Test connection to AWS DynamoDB *(requires AWS credentials)*
- [ ] Test ingest with sample FHIR JSON *(requires AWS)*
- [ ] Verify document appears in Atlas UI *(requires AWS)*

---

## PHASE 2 — ETL Pipeline (Pydantic Models)

### 2.1 Pydantic Models

**Claude Code prompt:**
> "Create Pydantic v2 models for a clinical ETL platform. File: models/patient.py — PatientRaw model with fields: subject_id (int), gender (str), anchor_age (int, 0-120), anchor_year (int), dod (Optional[date]). Add field validators: gender must be M or F or UNKNOWN, anchor_age must be 0-120. File: models/admission.py — AdmissionRaw model with fields: hadm_id (int), subject_id (int), admittime (datetime), dischtime (Optional[datetime]), admission_type (str), admission_location (str), discharge_location (Optional[str]), insurance (str), marital_status (Optional[str]), race (str). Add validator: dischtime must be after admittime if both present. File: models/diagnosis.py — DiagnosisRaw model with fields: subject_id (int), hadm_id (int), seq_num (int), icd_code (str), icd_version (int, must be 9 or 10). Add thorough comments explaining each field and validator. All models must have model_config with strict=False."

- [x] Models created with all validators *(patient.py, admission.py, diagnosis.py)*
- [x] Test each model with valid and invalid data *(all assertions passed)*
- [x] Confirm validation errors are descriptive *(e.g. "anchor_age 200 out of range 0-120")*

### 2.2 Extract

**Claude Code prompt:**
> "Create etl/extract.py for a clinical ETL platform. Functions needed: extract_patients_csv(filepath: str) -> list[dict]: read patients.csv from MIMIC-IV demo using pandas, handle missing values by filling with None, return list of dicts. extract_admissions_csv(filepath: str) -> list[dict]: same for admissions.csv, parse admittime and dischtime as datetime. extract_diagnoses_csv(filepath: str) -> list[dict]: same for diagnoses_icd.csv. extract_fhir_json(filepath: str) -> list[dict]: read FHIR JSON file, handle both single resource and Bundle resourceType, extract patient resources only. extract_from_s3(bucket: str, key: str) -> bytes: use boto3 to download file from S3, return raw bytes. All functions must: print record count on completion, log any parsing errors without stopping execution, handle file not found gracefully. Add thorough comments to every function."

- [x] Test extract against MIMIC-IV demo CSV files *(patients=100, admissions=275, diagnoses=4506)*
- [x] Print record counts match expected (patients.csv = 100 rows) ✓
- [x] Test FHIR JSON extract with sample file *(3 Patient resources extracted from Bundle)*

### 2.3 Transform

**Claude Code prompt:**
> "Create etl/transform.py for a clinical ETL platform. Functions needed: transform_patients(raw_records: list[dict]) -> list[dict]: standardise gender values (M/F/m/f/Male/Female → M/F, anything else → UNKNOWN), calculate age_band from anchor_age (0-17: PAEDIATRIC, 18-40: YOUNG_ADULT, 41-65: ADULT, 66+: ELDERLY), set data_quality_flag to PASS/WARN/FAIL. transform_admissions(raw_records: list[dict]) -> list[dict]: parse and standardise all datetime fields to ISO8601, calculate los_days as float (dischtime - admittime in days), standardise admission_type and race to uppercase stripped strings, set data_quality_flag. transform_diagnoses(raw_records: list[dict]) -> list[dict]: strip and uppercase icd_code, map icd_version 9 codes (3-digit prefix lookup from built-in dict of top 20 common codes) to description, map icd_version 10 codes similarly, set is_valid_code bool. Include a hardcoded ICD_DESCRIPTIONS dict with at least 20 common codes for both ICD-9 and ICD-10. Print transformation summary: total records, pass count, warn count, fail count. Add thorough comments."

- [x] Run transform on extracted MIMIC-IV data *(100 patients, 275 admissions, 4506 diagnoses)*
- [x] Print summary shows expected pass/warn/fail counts *(patients: PASS=100, admissions: PASS=275)*
- [x] Verify age_band values correct *(YOUNG_ADULT/ADULT/ELDERLY confirmed against anchor_age)*
- [x] Verify los_days calculated correctly *(e.g. 8.97 days for first admission)*

### 2.4 Validate

**Claude Code prompt:**
> "Create etl/validate.py for a clinical ETL platform. Use Pydantic models from models/. Functions needed: validate_patients(records: list[dict]) -> tuple[list[dict], list[dict]]: validate each record against PatientRaw model, return (valid_records, invalid_records). validate_admissions(records: list[dict]) -> tuple[list[dict], list[dict]]: same for AdmissionRaw. validate_diagnoses(records: list[dict]) -> tuple[list[dict], list[dict]]: same for DiagnosisRaw. check_duplicate_patients(records: list[dict]) -> list[int]: return list of duplicate subject_ids. check_consent_flags(records: list[dict]) -> list[dict]: for this demo, mark all records as consent_ok=True (placeholder for real consent logic). generate_validation_report(entity: str, valid: list, invalid: list) -> dict: return dict with entity name, total, valid_count, invalid_count, invalid_subject_ids list, timestamp. Print full validation report to console. Add thorough comments."

- [x] Validation runs on all three entities *(patients 100/100, admissions 275/275, diagnoses 4506/4506 valid)*
- [x] Invalid records separated correctly *(NaN/NaT fields handled, no valid records rejected)*
- [x] Duplicate detection works *(no duplicates found in MIMIC-IV demo)*
- [x] Validation report printed to console *(entity, total, valid_count, invalid_count, timestamp)*

### 2.5 Load

**Claude Code prompt:**
> "Create etl/load.py for a clinical ETL platform. Use SQLAlchemy with psycopg2. Functions needed: get_engine(): create SQLAlchemy engine from environment variables, return engine. load_patients_raw(records: list[dict], engine): bulk insert into raw.patients using SQLAlchemy core insert, skip duplicates on subject_id (ON CONFLICT DO NOTHING). load_admissions_raw(records: list[dict], engine): same for raw.admissions, skip duplicates on hadm_id. load_diagnoses_raw(records: list[dict], engine): same for raw.diagnoses. load_patients_clean(records: list[dict], engine): insert transformed records into clean.patients. load_admissions_clean(records: list[dict], engine): insert into clean.admissions. load_diagnoses_clean(records: list[dict], engine): insert into clean.diagnoses. Each function must: print records inserted count, print any errors without stopping, return inserted count as int. Add thorough comments."

- [x] Load raw data into PostgreSQL *(raw.patients=100, raw.admissions=275, raw.diagnoses=4506)*
- [x] Load clean data into PostgreSQL *(clean.patients=100, clean.admissions=275, clean.diagnoses=4506)*
- [x] Verify row counts in psql: `SELECT COUNT(*) FROM raw.patients;` → 100 ✓
- [x] Verify ON CONFLICT works (run load twice, no duplicates) *(second load inserts 0 rows)*

---

## PHASE 3 — DBT Models

### 3.1 DBT Project Init

**Claude Code prompt:**
> "Create the DBT project configuration for a clinical ETL platform. File: dbt/dbt_project.yml — project name: clinical_etl, model-paths: models, profile: clinical_etl, models config: raw materialized as view, clean materialized as table, research materialized as table. File: dbt/profiles.yml — profile clinical_etl, target dev, type postgres, host from env, port 5432, dbname clinical_etl, schema public, threads 4. File: dbt/models/sources.yml — define sources for raw schema, tables: patients, admissions, diagnoses with column descriptions."

- [x] dbt_project.yml, profiles.yml, models/sources.yml all created
- [x] `dbt debug` passes all checks *(Connection test: OK connection ok)*
- [x] `dbt deps` runs without error *(dbt-postgres 1.10.0 installed)*

> **Note:** Run dbt from project root: `dbt run --profiles-dir dbt --project-dir dbt`

### 3.2 DBT Clean Models

**Claude Code prompt:**
> "Create DBT SQL models for the clean layer. File: dbt/models/clean/clean_patients.sql — SELECT from raw.patients, cast and standardise all fields, add age_band column using CASE statement, filter out data_quality_flag = FAIL, add dbt_updated_at timestamp. File: dbt/models/clean/clean_admissions.sql — SELECT from raw.admissions joined to clean.patients on subject_id, calculate los_days as EXTRACT(EPOCH FROM (dischtime - admittime))/86400, filter invalid dates. File: dbt/models/clean/clean_diagnoses.sql — SELECT from raw.diagnoses, add is_valid_code flag (icd_code NOT NULL AND LENGTH(icd_code) >= 3). Add schema.yml with column descriptions and not_null tests for primary keys."

- [x] clean_patients.sql, clean_admissions.sql, clean_diagnoses.sql created
- [x] schema.yml with column descriptions and not_null tests created
- [x] `dbt run --select clean` succeeds *(clean.patients=100, admissions=275, diagnoses=4506)*
- [x] `dbt test --select clean` passes all tests *(all not_null + unique tests green)*
- [x] Verify row counts in clean schema *(100 / 275 / 4506 confirmed)*

### 3.3 DBT Research Models

**Claude Code prompt:**
> "Create DBT SQL models for the research layer. File: dbt/models/research/research_cohort.sql — SELECT from clean.patients joined to clean.admissions, apply de-identification: remove subject_id (replace with cohort_id using ROW_NUMBER()), keep age_band not exact age, keep gender, keep admission_type, keep los_days rounded to 1 decimal, keep primary diagnosis from clean.diagnoses (seq_num=1), add is_deidentified=true flag. File: dbt/models/research/research_outcomes.sql — SELECT cohort_id, calculate readmission_30d bool (any admission within 30 days of discharge for same patient), add icu_admission placeholder as false. File: dbt/tests/assert_no_duplicate_patients.sql — SELECT subject_id, COUNT(*) FROM raw.patients GROUP BY subject_id HAVING COUNT(*) > 1. File: dbt/tests/assert_valid_icd_codes.sql — SELECT * FROM raw.diagnoses WHERE icd_code IS NULL OR LENGTH(TRIM(icd_code)) < 3."

- [x] research_cohort.sql, research_outcomes.sql created *(ROW_NUMBER de-identification, readmission_30d window)*
- [x] assert_no_duplicate_patients.sql, assert_valid_icd_codes.sql created
- [x] `dbt run --select research` succeeds *(research.cohort=275, research.outcomes=275)*
- [x] `dbt test` all tests pass *(PASS=20 WARN=0 ERROR=0 — all 20 tests green)*
- [x] `dbt docs generate` *(catalog.json written to dbt/target/)*
- [ ] `dbt docs serve` — lineage graph visible in browser *(run manually to open)*

---

## PHASE 4 — Governance

### 4.1 RBAC

**Claude Code prompt:**
> "Create governance/rbac.py for a clinical ETL platform. Define an Enum: Role with values ADMIN, RESEARCHER, VIEWER. Define a dataclass or Pydantic model: User with fields user_id (str), username (str), role (Role), is_active (bool). Define PERMISSIONS dict mapping Role to list of allowed actions: ADMIN: all actions including user_management, audit_read, pipeline_run, data_read_raw, data_read_clean, data_read_research, export_request, export_download. RESEARCHER: pipeline_status, data_read_clean, data_read_research, export_request, export_download. VIEWER: data_read_research only. Write function check_permission(user: User, action: str) -> bool: return True if user's role has permission for action, raise PermissionError with descriptive message if not. Write function require_permission(action: str): a decorator factory that wraps a function and calls check_permission before executing. Add thorough comments. Print permission check result in every check."

- [x] RBAC roles defined correctly *(ADMIN/RESEARCHER/VIEWER with correct PERMISSIONS dict)*
- [x] Permission check raises error for unauthorized actions *(tested: viewer cannot export, researcher cannot read audit)*
- [x] Decorator works on test function

### 4.2 Audit Log

**Claude Code prompt:**
> "Create governance/audit.py for a clinical ETL platform. Use SQLAlchemy to write to the public.audit_logs table. Define AuditEntry Pydantic model with fields: user_id (str), role (str), action (str), resource (str), ip_address (str), outcome (Literal['approved','denied','error']), detail (Optional[dict]). Write function log_action(entry: AuditEntry, engine): insert into audit_logs table with current UTC timestamp, print full audit entry to console including timestamp, user_id, action, resource, outcome. Write function get_audit_logs(engine, limit=100, user_id=None, action=None) -> list[dict]: query audit_logs with optional filters, return as list of dicts ordered by timestamp desc. Add thorough comments."

- [x] governance/audit.py created with AuditEntry model, log_action, get_audit_logs
- [x] Audit log writes to PostgreSQL *(3 test entries inserted and confirmed)*
- [x] Print confirms every action logged *([audit] timestamp | user | action | resource | outcome)*
- [x] Query with filters works *(filter by action=pipeline_run → 1 entry)*

### 4.3 De-identification

**Claude Code prompt:**
> "Create etl/deidentify.py for a clinical ETL platform. Functions needed: remove_direct_identifiers(record: dict) -> dict: remove or null out fields: subject_id (replace with anonymised_id using hashlib sha256), any name fields, exact date of birth (keep age_band only), address fields, MRN. generalise_quasi_identifiers(record: dict) -> dict: convert exact age to age_band if present, convert postcode to state/region (use a simple hardcoded dict for QLD/NSW/VIC postcodes), round los_days to nearest 0.5. check_k_anonymity(records: list[dict], k=5) -> list[dict]: group records by (age_band, gender, admission_type), suppress groups with fewer than k records by removing them, print suppressed group count. deidentify_cohort(records: list[dict]) -> list[dict]: run all three steps in sequence, print record count before and after suppression. Add thorough comments."

- [x] De-identification removes all direct identifiers *(subject_id → sha256 anonymised_id, dod removed)*
- [x] K-anonymity suppresses small groups *(tested: 6→5 records, 1 group suppressed)*
- [x] Print shows before/after record counts *(e.g. "starting with 6 records … complete: 5 export-ready records")*

---

## PHASE 5 — FastAPI

### 5.1 Auth Middleware

**Claude Code prompt:**
> "Create api/middleware/auth.py for a clinical ETL platform. Use python-jose for JWT and passlib for password hashing. Hardcode three test users in a dict (in-memory for demo): admin_user (role=ADMIN, password=admin123), researcher_user (role=RESEARCHER, password=researcher123), viewer_user (role=VIEWER, password=viewer123). Functions needed: create_access_token(data: dict) -> str: create JWT token with 60 minute expiry using JWT_SECRET_KEY from env. verify_token(token: str) -> dict: decode JWT, raise HTTPException 401 if invalid or expired. get_current_user(token from OAuth2PasswordBearer) -> User: call verify_token, look up user in hardcoded dict, return User object. FastAPI dependency: require_role(required_action: str): returns a dependency function that calls get_current_user then check_permission. Add thorough comments."

- [x] JWT token created and verified correctly *(token=151 chars, payload.sub=admin_user)*
- [x] Expired token raises 401 *(HTTPException status_code=401 confirmed)*
- [x] Wrong role raises 403 *(viewer accessing /audit/logs → HTTP 403 confirmed)*

### 5.2 API Routers

**Claude Code prompt:**
> "Create FastAPI routers for a clinical ETL platform. File: api/routers/pipeline.py — POST /pipeline/run (admin only): trigger ETL pipeline by calling extract → transform → validate → load functions, return run_id and status. GET /pipeline/status/{run_id}: return pipeline run status from a simple in-memory dict. File: api/routers/data.py — GET /data/clean/patients (admin, researcher): query clean.patients from PostgreSQL, return paginated results with limit/offset params. GET /data/research/cohort (all roles): query research.cohort, return paginated. File: api/routers/export.py — POST /export/request (researcher): create export request, run deidentify_cohort, save CSV to exports/ folder, return export_id. GET /export/download/{export_id} (researcher): return FileResponse of de-identified CSV. File: api/routers/audit.py — GET /audit/logs (admin only): return audit logs with optional filters. All endpoints must: log action to audit_log, print request details, return consistent response format with status and data fields. Add thorough comments."

- [x] All routers created: pipeline.py, data.py, export.py, audit.py
- [x] Unauthorized endpoints return 401/403 *(no token → 401, wrong role → 403, confirmed)*
- [x] All endpoints return 200 with correct data *(pipeline complete, data/clean/patients total=100, research/cohort total=550)*
- [x] Export creates downloadable CSV file *(508 records, 509 lines inc. header, no subject_id)*

### 5.3 FastAPI Main

**Claude Code prompt:**
> "Create api/main.py for a clinical ETL platform. Set up FastAPI app with title ClinicalETL API, version 1.0.0, description. Add CORS middleware allowing all origins (for demo). Include all routers with prefixes: /pipeline, /data, /export, /audit. Add POST /auth/token endpoint using OAuth2PasswordRequestForm that validates credentials against hardcoded users and returns JWT access token. Add GET /health endpoint returning status ok and timestamp. Add startup event that prints API ready message and lists all routes. Add thorough comments."

- [x] `uvicorn api.main:app --reload` starts without errors *(startup message printed, all 13 routes listed)*
- [x] `/docs` Swagger UI loads *(confirmed: Docs: http://localhost:8000/docs)*
- [x] `/health` returns 200 *({"status":"ok","timestamp":"..."})*
- [x] `/auth/token` returns JWT for valid credentials *(token + role returned)*
- [x] Test all endpoints in Swagger UI *(pipeline/run, data/clean/patients, research/cohort, export/request, audit/logs all verified via curl)*

---

## PHASE 6 — Databricks

### 6.1 Databricks Notebooks

**Claude Code prompt:**
> "Create Databricks Python notebooks for a clinical ETL platform. These are .py files with Databricks magic commands. File: databricks/notebooks/01_extract.py — use dbutils.widgets for S3 bucket and key params, read CSV files from S3 using spark.read.csv with header and inferSchema, read FHIR JSON using spark.read.json, display row counts for each dataframe, write raw dataframes to Delta Lake tables at /mnt/clinical_etl/raw/. File: databricks/notebooks/02_transform.py — read from Delta Lake raw tables, apply same transformations as etl/transform.py but using PySpark: use when/otherwise for age_band, use regexp_replace for field standardisation, calculate los_days using unix_timestamp, display transformation summary. File: databricks/notebooks/03_validate.py — read transformed data, run data quality checks using PySpark: check null counts per column, check value distributions, flag records, display quality report. File: databricks/notebooks/04_load.py — read validated data from Delta Lake, write to PostgreSQL using JDBC connector with connection properties from Databricks secrets, use mode overwrite for raw tables. Add comments explaining each step."

- [x] 4 PySpark notebooks created: 01_extract.py, 02_transform.py, 03_validate.py, 04_load.py
- [ ] Upload notebooks to Databricks Community workspace *(requires Databricks account)*
- [ ] Run 01_extract.py — Delta tables created
- [ ] Run 02_transform.py — transformed data visible
- [ ] Run 03_validate.py — quality report displayed
- [ ] Run 04_load.py — data appears in PostgreSQL

---

## PHASE 7 — Next.js Frontend

### 7.1 Project Setup

**Claude Code prompt:**
> "Set up a Next.js 14 TypeScript project for a clinical ETL dashboard. Create frontend/ directory. Use App Router. Install: axios, @tanstack/react-query, recharts, tailwindcss. Create lib/api.ts with: BASE_URL from env, getAuthHeaders() returning JWT from localStorage, api object with methods: login(username, password), getPipelineStatus(runId), runPipeline(), getCleanPatients(limit, offset), getResearchCohort(limit, offset), requestExport(), downloadExport(exportId), getAuditLogs(). All API calls must print request and response to console for debugging."

- [x] Next.js 14 App Router project created: package.json, next.config.js, tailwind.config.ts
- [x] lib/api.ts with all required methods + console logging
- [x] `npm install` completed *(node_modules installed)*
- [x] `npm run build` succeeds *(all 6 pages compiled, 0 webpack errors)*
- [ ] `npm run dev` — serve and test live in browser *(run manually)*
- [ ] API client connects to FastAPI backend *(requires both running simultaneously)*
- [ ] Login returns and stores JWT token

### 7.2 Dashboard Pages

**Claude Code prompt:**
> "Create Next.js pages for a clinical ETL dashboard. File: src/app/page.tsx — Dashboard home showing: pipeline status card (last run time, records processed, pass/fail counts), data quality summary card (3 cards for raw/clean/research layer record counts), quick action buttons (Run Pipeline, View Data, Export). Use recharts BarChart to show data quality pass/warn/fail breakdown. File: src/app/pipeline/page.tsx — Pipeline control panel: button to trigger pipeline run, real-time status polling every 5 seconds, step-by-step progress display (Extract → Transform → Validate → Load), run history table. File: src/app/data/page.tsx — tabbed view: Clean Patients tab with sortable table and pagination, Research Cohort tab with filter by age_band/gender/admission_type, record count display. File: src/app/export/page.tsx — export request form, list of previous exports with download buttons, de-identification notice. File: src/app/audit/page.tsx — paginated audit log table with columns: timestamp, user, role, action, resource, outcome. Filter by action and outcome. Use Tailwind for all styling. Clinical/professional look. Add thorough comments."

- [x] All 5 pages created: page.tsx, pipeline/page.tsx, data/page.tsx, export/page.tsx, audit/page.tsx
- [x] All pages compile without errors *(npm run build: 0 webpack errors, all routes static)*
- [ ] Dashboard shows live data from API *(run `npm run dev` + uvicorn together)*
- [ ] Pipeline trigger works and shows status
- [ ] Data tables paginate correctly
- [ ] Export downloads CSV file
- [ ] Audit log shows all actions

### 7.3 Auth + RBAC Guard

**Claude Code prompt:**
> "Create authentication and RBAC components for the Next.js frontend. File: src/components/RBACGuard.tsx — component that takes requiredRole prop, checks JWT role claim from localStorage, renders children if authorised, renders AccessDenied message if not. File: src/app/login/page.tsx — login form with username and password fields, calls /auth/token endpoint, stores JWT in localStorage, redirects to dashboard. File: src/middleware.ts — Next.js middleware that checks for JWT token in cookies/localStorage for all protected routes, redirects to /login if not present. Wrap all sensitive pages with RBACGuard. Add thorough comments."

- [x] RBACGuard.tsx created with ROLE_HIERARCHY check, AccessDenied render, redirect to /login
- [x] app/login/page.tsx created with form → /auth/token → localStorage → redirect
- [x] middleware.ts created
- [ ] Login page works with test users *(requires npm run dev)*
- [ ] Protected pages redirect to login if no token
- [ ] Viewer cannot see export page
- [ ] Admin sees all pages

---

## PHASE 8 — CI/CD

### 8.1 GitHub Actions

**Claude Code prompt:**
> "Create GitHub Actions workflows for a clinical ETL platform. File: .github/workflows/dbt_test.yml — trigger on pull_request to main. Steps: checkout code, setup Python 3.11, install dbt-postgres, set up test PostgreSQL service container (postgres:15), run schema init SQL, run dbt deps, run dbt run, run dbt test, post test results as PR comment. File: .github/workflows/deploy.yml — trigger on push to main. Steps: checkout code, configure AWS credentials from GitHub secrets (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION), copy updated files to EC2 via SSH using appleboy/ssh-action, restart uvicorn service on EC2, deploy Next.js to Amplify using aws amplify start-job. Add comments explaining each step."

- [x] .github/workflows/dbt_test.yml created *(triggers on PR, postgres service container, dbt run + test + PR comment)*
- [x] .github/workflows/deploy.yml created *(triggers on push to main, EC2 SSH + Amplify deploy)*
- [ ] Push to PR triggers dbt_test.yml *(requires GitHub repo)*
- [ ] DBT tests pass in CI
- [ ] Merge to main triggers deploy.yml
- [ ] EC2 and Amplify updated automatically

---

## PHASE 9 — AWS Deployment

### 9.1 Infrastructure Setup

**Claude Code prompt:**
> "Create AWS setup scripts for a clinical ETL platform. File: infra/aws/ec2_setup.sh — bash script that: updates apt, installs Python 3.11 and pip, clones GitHub repo, installs Python dependencies, creates systemd service file for uvicorn running api/main.py on port 8000, enables and starts service, installs nginx, creates nginx config proxying port 80 to 8000. File: infra/aws/s3_bucket_policy.json — S3 bucket policy allowing EC2 instance role to read/write to clinical-etl-raw bucket. File: infra/aws/rds_init.sql — full PostgreSQL schema from Phase 1 as single file ready to run on RDS. Add comments explaining each step."

- [x] infra/aws/ec2_setup.sh created *(systemd service, nginx reverse proxy)*
- [x] infra/aws/s3_bucket_policy.json created *(EC2 instance role read/write)*
- [x] infra/aws/rds_init.sql ready for RDS endpoint
- [ ] EC2 t3.micro launched with Amazon Linux 2023 *(requires AWS)*
- [ ] Run ec2_setup.sh via SSH
- [ ] `systemctl status clinical-etl` shows active
- [ ] `curl http://EC2_IP/health` returns 200
- [ ] RDS PostgreSQL instance created (t3.micro, free tier)
- [ ] Run rds_init.sql against RDS endpoint
- [ ] S3 bucket created with correct policy

### 9.2 Amplify Frontend Deploy

**Claude Code prompt:**
> "Create AWS Amplify configuration for Next.js deployment. File: frontend/amplify.yml — build spec with phases: preBuild installing node_modules, build running next build, artifacts including .next directory. Set environment variables in Amplify console: NEXT_PUBLIC_API_URL pointing to EC2 endpoint. Configure custom domain in Route 53 if domain purchased."

- [x] frontend/amplify.yml created *(preBuild npm ci, build next build, artifacts .next)*
- [ ] Connect GitHub repo to Amplify *(requires AWS)*
- [ ] Amplify build succeeds
- [ ] Frontend accessible at Amplify URL
- [ ] API calls reach EC2 backend

---

## PHASE 10 — PowerBI

### 10.1 Dashboard

- [ ] Open PowerBI Desktop
- [ ] Connect to PostgreSQL: Server = RDS endpoint, Database = clinical_etl
- [ ] Import research.cohort and research.outcomes tables
- [ ] Create visuals:
  - [ ] Bar chart: admission_type distribution
  - [ ] Bar chart: age_band distribution
  - [ ] Card: total cohort size
  - [ ] Card: average LOS days
  - [ ] Pie chart: gender breakdown
  - [ ] Table: top 10 primary diagnoses
- [ ] Save as powerbi/clinical_dashboard.pbix
- [ ] Export as PDF screenshot for README

---

## PHASE 11 — Documentation

### 11.1 README

**Claude Code prompt:**
> "Write a professional README.md for the ClinicalETL project. Include: project title and one-line description, live demo URL and API docs URL, architecture diagram (ASCII), technology stack table, pipeline flow description, setup instructions (clone, env vars, docker-compose up, run ETL, start API, start frontend), API endpoint reference table, RBAC roles and permissions table, data lineage description referencing DBT docs URL, de-identification approach description, CI/CD pipeline description, MIMIC-IV data attribution. Write it as if this is an internal technical document for a healthcare research organisation. Professional, precise, no fluff."

- [x] README.md created *(architecture, tech stack, API table, RBAC table, de-id pipeline, setup instructions, MIMIC-IV attribution)*
- [ ] README renders correctly on GitHub *(requires GitHub repo)*
- [ ] All links work *(live URLs need filling after AWS deploy)*
- [ ] Setup instructions tested end-to-end *(ETL + API tested locally, confirmed working)*

### 11.2 DBT Docs

- [x] `dbt docs generate` *(catalog.json generated in dbt/target/)*
- [ ] `dbt docs serve` — verify lineage graph shows raw → clean → research *(run manually)*
- [ ] Screenshot lineage graph for README
- [ ] Deploy DBT docs to S3 static site (optional)

### 11.3 API Docs

- [x] Verify `/docs` Swagger UI shows all endpoints *(13 routes: /pipeline, /data, /export, /audit, /auth/token, /health)*
- [x] Descriptions on all FastAPI routers and endpoints *(tags: Pipeline, Data, Export, Audit, Auth, Health)*
- [ ] Screenshot Swagger UI for README *(run uvicorn + screenshot manually)*

---

## Pre-Interview Checklist

- [ ] Frontend URL loads in under 3 seconds *(deploy to Amplify first)*
- [ ] Wake up Render/EC2 before interview (cold start)
- [x] Login works with all three test users *(admin/researcher/viewer all authenticated locally)*
- [x] Pipeline run completes without error *(status=complete, patients=100, admissions=275, diagnoses=4506)*
- [x] Export downloads a real CSV file *(508 records, no PII, 509-line CSV)*
- [x] Audit log shows entries *(6 entries logged: pipeline_run, export_requested, export_downloaded)*
- [ ] DBT docs lineage graph accessible *(run `dbt docs serve --profiles-dir dbt --project-dir dbt`)*
- [x] Swagger UI accessible *(http://localhost:8000/docs confirmed)*
- [ ] GitHub repo is public with clean commit history
- [ ] README has live URLs filled in *(fill in after AWS deploy)*

---

## Interview Demo Flow (5 minutes)

1. Open frontend URL — show dashboard with live data counts
2. Click Run Pipeline — show step-by-step ETL progress
3. Go to Data tab — show clean patients table, filter research cohort
4. Go to Export — request and download de-identified CSV, open it
5. Go to Audit Log — show every action just performed is logged
6. Open API docs URL — show `/docs` Swagger with all endpoints
7. Open DBT docs URL — show data lineage graph raw → clean → research
8. Open GitHub repo — show CI/CD workflows

**Say:**
> "This covers the full pipeline from raw EMR data to governed, auditable, de-identified research datasets. Databricks runs the ETL, DBT manages the SQL transforms and lineage, PostgreSQL holds the medallion warehouse, DynamoDB stores the FHIR documents, and everything is deployed on AWS with CI/CD via GitHub Actions."

---

*Total estimated build time: 1–2 days with Claude Code assistance.*  
*Built specifically for UQ Queensland Digital Health Centre Data Engineer (R-63033).*
