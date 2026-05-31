-- ClinicalETL PostgreSQL Schema Init
-- Medallion architecture: raw → clean → research
-- Run: psql -U admin -d clinical_etl -f infra/aws/rds_init.sql

-- ─── Schemas ────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS clean;
CREATE SCHEMA IF NOT EXISTS research;

-- ─── RAW LAYER ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS raw.patients (
    subject_id    INTEGER PRIMARY KEY,
    gender        VARCHAR(10),
    anchor_age    INTEGER,
    anchor_year   INTEGER,
    anchor_year_group VARCHAR(20),
    dod           DATE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw.admissions (
    hadm_id              INTEGER PRIMARY KEY,
    subject_id           INTEGER NOT NULL,
    admittime            TIMESTAMPTZ,
    dischtime            TIMESTAMPTZ,
    deathtime            TIMESTAMPTZ,
    admission_type       VARCHAR(50),
    admit_provider_id    VARCHAR(20),
    admission_location   VARCHAR(60),
    discharge_location   VARCHAR(60),
    insurance            VARCHAR(30),
    language             VARCHAR(20),
    marital_status       VARCHAR(30),
    race                 VARCHAR(60),
    edregtime            TIMESTAMPTZ,
    edouttime            TIMESTAMPTZ,
    hospital_expire_flag SMALLINT,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw.diagnoses (
    id          SERIAL PRIMARY KEY,
    subject_id  INTEGER NOT NULL,
    hadm_id     INTEGER NOT NULL,
    seq_num     INTEGER,
    icd_code    VARCHAR(20),
    icd_version INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_diagnoses_natural_key UNIQUE (subject_id, hadm_id, seq_num, icd_code, icd_version)
);

-- ICD-9 / ICD-10 code reference (loaded from d_icd_diagnoses.csv)
CREATE TABLE IF NOT EXISTS raw.icd_reference (
    icd_code    VARCHAR(20) NOT NULL,
    icd_version INTEGER     NOT NULL,
    long_title  VARCHAR(500),
    PRIMARY KEY (icd_code, icd_version)
);

-- ─── CLEAN LAYER ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clean.patients (
    subject_id         INTEGER PRIMARY KEY,
    gender             VARCHAR(10),
    anchor_age         INTEGER,
    anchor_year        INTEGER,
    anchor_year_group  VARCHAR(20),
    dod                DATE,
    age_band           VARCHAR(20),   -- PAEDIATRIC/YOUNG_ADULT/ADULT/ELDERLY
    data_quality_flag  VARCHAR(10),   -- PASS/WARN/FAIL
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clean.admissions (
    hadm_id              INTEGER PRIMARY KEY,
    subject_id           INTEGER NOT NULL,
    admittime            TIMESTAMPTZ,
    dischtime            TIMESTAMPTZ,
    admission_type       VARCHAR(50),
    admission_location   VARCHAR(60),
    discharge_location   VARCHAR(60),
    insurance            VARCHAR(30),
    marital_status       VARCHAR(30),
    race                 VARCHAR(60),
    los_days             NUMERIC(8, 2),  -- length of stay in days
    data_quality_flag    VARCHAR(10),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clean.diagnoses (
    id               SERIAL PRIMARY KEY,
    subject_id       INTEGER NOT NULL,
    hadm_id          INTEGER NOT NULL,
    seq_num          INTEGER,
    icd_code         VARCHAR(20),
    icd_version      INTEGER,
    icd_description  VARCHAR(500),
    is_valid_code    BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_clean_diagnoses_natural_key UNIQUE (subject_id, hadm_id, seq_num, icd_code, icd_version)
);

-- ─── RESEARCH LAYER ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research.cohort (
    cohort_id             SERIAL PRIMARY KEY,
    age_band              VARCHAR(20),
    gender                VARCHAR(10),
    admission_type        VARCHAR(50),
    los_days              NUMERIC(8, 1),
    primary_diagnosis_code    VARCHAR(20),
    primary_diagnosis_desc    VARCHAR(255),
    is_deidentified       BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research.outcomes (
    cohort_id          INTEGER PRIMARY KEY REFERENCES research.cohort(cohort_id),
    readmission_30d    BOOLEAN DEFAULT FALSE,
    icu_admission      BOOLEAN DEFAULT FALSE,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUDIT LOG ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id          SERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ DEFAULT NOW(),
    user_id     VARCHAR(100) NOT NULL,
    role        VARCHAR(20)  NOT NULL,
    action      VARCHAR(100) NOT NULL,
    resource    VARCHAR(100) NOT NULL,
    ip_address  VARCHAR(45),
    outcome     VARCHAR(20)  NOT NULL CHECK (outcome IN ('approved', 'denied', 'error')),
    detail      JSONB
);

-- ─── RAW LAYER: Reference tables ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS raw.d_icd_procedures (
    icd_code    VARCHAR(20)  NOT NULL,
    icd_version INTEGER      NOT NULL,
    long_title  VARCHAR(500),
    PRIMARY KEY (icd_code, icd_version)
);

CREATE TABLE IF NOT EXISTS raw.d_labitems (
    itemid   INTEGER PRIMARY KEY,
    label    TEXT,
    fluid    TEXT,
    category TEXT
);

CREATE TABLE IF NOT EXISTS raw.d_hcpcs (
    code              VARCHAR(20) PRIMARY KEY,
    category          TEXT,
    long_description  TEXT,
    short_description TEXT
);

CREATE TABLE IF NOT EXISTS raw.d_items (
    itemid          INTEGER PRIMARY KEY,
    label           TEXT,
    abbreviation    TEXT,
    linksto         TEXT,
    category        TEXT,
    unitname        TEXT,
    param_type      TEXT,
    lownormalvalue  NUMERIC,
    highnormalvalue NUMERIC
);

-- ─── RAW LAYER: Hosp clinical tables ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS raw.lab_events (
    labevent_id       BIGINT PRIMARY KEY,
    subject_id        INTEGER,
    hadm_id           INTEGER,
    specimen_id       INTEGER,
    itemid            INTEGER,
    order_provider_id TEXT,
    charttime         TIMESTAMPTZ,
    storetime         TIMESTAMPTZ,
    value             TEXT,
    valuenum          NUMERIC,
    valueuom          TEXT,
    ref_range_lower   NUMERIC,
    ref_range_upper   NUMERIC,
    flag              TEXT,
    priority          TEXT,
    comments          TEXT
);

CREATE TABLE IF NOT EXISTS raw.prescriptions (
    id                SERIAL PRIMARY KEY,
    subject_id        INTEGER,
    hadm_id           INTEGER,
    pharmacy_id       INTEGER,
    poe_id            TEXT,
    poe_seq           INTEGER,
    order_provider_id TEXT,
    starttime         TIMESTAMPTZ,
    stoptime          TIMESTAMPTZ,
    drug_type         TEXT,
    drug              TEXT,
    formulary_drug_cd TEXT,
    gsn               TEXT,
    ndc               TEXT,
    prod_strength     TEXT,
    form_rx           TEXT,
    dose_val_rx       TEXT,
    dose_unit_rx      TEXT,
    form_val_disp     TEXT,
    form_unit_disp    TEXT,
    doses_per_24_hrs  NUMERIC,
    route             TEXT,
    CONSTRAINT uq_prescriptions UNIQUE (subject_id, hadm_id, pharmacy_id, starttime, drug)
);

CREATE TABLE IF NOT EXISTS raw.procedures_icd (
    id          SERIAL PRIMARY KEY,
    subject_id  INTEGER,
    hadm_id     INTEGER,
    seq_num     INTEGER,
    chartdate   DATE,
    icd_code    VARCHAR(20),
    icd_version INTEGER,
    CONSTRAINT uq_procedures_icd UNIQUE (subject_id, hadm_id, seq_num, icd_code, icd_version)
);

CREATE TABLE IF NOT EXISTS raw.drg_codes (
    id           SERIAL PRIMARY KEY,
    subject_id   INTEGER,
    hadm_id      INTEGER,
    drg_type     TEXT,
    drg_code     TEXT,
    description  TEXT,
    drg_severity SMALLINT,
    drg_mortality SMALLINT,
    CONSTRAINT uq_drg_codes UNIQUE (subject_id, hadm_id, drg_type, drg_code)
);

CREATE TABLE IF NOT EXISTS raw.microbiology_events (
    microevent_id       BIGINT PRIMARY KEY,
    subject_id          INTEGER,
    hadm_id             INTEGER,
    micro_specimen_id   INTEGER,
    order_provider_id   TEXT,
    chartdate           DATE,
    charttime           TIMESTAMPTZ,
    spec_itemid         INTEGER,
    spec_type_desc      TEXT,
    test_seq            INTEGER,
    storedate           DATE,
    storetime           TIMESTAMPTZ,
    test_itemid         INTEGER,
    test_name           TEXT,
    org_itemid          INTEGER,
    org_name            TEXT,
    isolate_num         SMALLINT,
    quantity            TEXT,
    ab_itemid           INTEGER,
    ab_name             TEXT,
    dilution_text       TEXT,
    dilution_comparison TEXT,
    dilution_value      NUMERIC,
    interpretation      TEXT,
    comments            TEXT
);

CREATE TABLE IF NOT EXISTS raw.pharmacy (
    pharmacy_id       INTEGER PRIMARY KEY,
    subject_id        INTEGER,
    hadm_id           INTEGER,
    poe_id            TEXT,
    starttime         TIMESTAMPTZ,
    stoptime          TIMESTAMPTZ,
    medication        TEXT,
    proc_type         TEXT,
    status            TEXT,
    entertime         TIMESTAMPTZ,
    verifiedtime      TIMESTAMPTZ,
    route             TEXT,
    frequency         TEXT,
    disp_sched        TEXT,
    infusion_type     TEXT,
    sliding_scale     TEXT,
    lockout_interval  TEXT,
    basal_rate        NUMERIC,
    one_hr_max        NUMERIC,
    doses_per_24_hrs  NUMERIC,
    duration          NUMERIC,
    duration_interval TEXT,
    expiration_value  NUMERIC,
    expiration_unit   TEXT,
    expirationdate    TIMESTAMPTZ,
    dispensation      TEXT,
    fill_quantity     TEXT
);

CREATE TABLE IF NOT EXISTS raw.emar (
    emar_id           TEXT,
    emar_seq          INTEGER,
    subject_id        INTEGER,
    hadm_id           INTEGER,
    poe_id            TEXT,
    pharmacy_id       INTEGER,
    enter_provider_id TEXT,
    charttime         TIMESTAMPTZ,
    medication        TEXT,
    event_txt         TEXT,
    scheduletime      TIMESTAMPTZ,
    storetime         TIMESTAMPTZ,
    PRIMARY KEY (emar_id, emar_seq)
);

CREATE TABLE IF NOT EXISTS raw.emar_detail (
    emar_id                           TEXT,
    emar_seq                          INTEGER,
    subject_id                        INTEGER,
    parent_field_ordinal              TEXT,
    administration_type               TEXT,
    pharmacy_id                       INTEGER,
    barcode_type                      TEXT,
    reason_for_no_barcode             TEXT,
    complete_dose_not_given           TEXT,
    dose_due                          TEXT,
    dose_due_unit                     TEXT,
    dose_given                        TEXT,
    dose_given_unit                   TEXT,
    will_remainder_of_dose_be_given   TEXT,
    product_amount_given              TEXT,
    product_unit                      TEXT,
    product_code                      TEXT,
    product_description               TEXT,
    product_description_other         TEXT,
    prior_infusion_rate               TEXT,
    infusion_rate                     TEXT,
    infusion_rate_adjustment          TEXT,
    infusion_rate_adjustment_amount   TEXT,
    infusion_rate_unit                TEXT,
    route                             TEXT,
    infusion_complete                 TEXT,
    completion_interval               TEXT,
    new_iv_bag_hung                   TEXT,
    continued_infusion_in_other_location TEXT,
    restart_interval                  TEXT,
    side                              TEXT,
    site                              TEXT,
    non_formulary_visual_verification TEXT,
    id BIGSERIAL PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS raw.hcpcs_events (
    id                SERIAL PRIMARY KEY,
    subject_id        INTEGER,
    hadm_id           INTEGER,
    chartdate         DATE,
    hcpcs_cd          TEXT,
    seq_num           INTEGER,
    short_description TEXT,
    CONSTRAINT uq_hcpcs_events UNIQUE (subject_id, hadm_id, chartdate, hcpcs_cd, seq_num)
);

CREATE TABLE IF NOT EXISTS raw.omr (
    id           SERIAL PRIMARY KEY,
    subject_id   INTEGER,
    chartdate    DATE,
    seq_num      INTEGER,
    result_name  TEXT,
    result_value TEXT,
    CONSTRAINT uq_omr UNIQUE (subject_id, chartdate, seq_num, result_name)
);

CREATE TABLE IF NOT EXISTS raw.services (
    id           SERIAL PRIMARY KEY,
    subject_id   INTEGER,
    hadm_id      INTEGER,
    transfertime TIMESTAMPTZ,
    prev_service TEXT,
    curr_service TEXT,
    CONSTRAINT uq_services UNIQUE (subject_id, hadm_id, transfertime, curr_service)
);

CREATE TABLE IF NOT EXISTS raw.transfers (
    transfer_id INTEGER PRIMARY KEY,
    subject_id  INTEGER,
    hadm_id     INTEGER,
    eventtype   TEXT,
    careunit    TEXT,
    intime      TIMESTAMPTZ,
    outtime     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS raw.poe (
    poe_id                  TEXT,
    poe_seq                 INTEGER,
    subject_id              INTEGER,
    hadm_id                 INTEGER,
    ordertime               TIMESTAMPTZ,
    order_type              TEXT,
    order_subtype           TEXT,
    transaction_type        TEXT,
    discontinue_of_poe_id   TEXT,
    discontinued_by_poe_id  TEXT,
    order_provider_id       TEXT,
    order_status            TEXT,
    PRIMARY KEY (poe_id, poe_seq)
);

CREATE TABLE IF NOT EXISTS raw.poe_detail (
    id          SERIAL PRIMARY KEY,
    poe_id      TEXT,
    poe_seq     INTEGER,
    subject_id  INTEGER,
    field_name  TEXT,
    field_value TEXT,
    CONSTRAINT uq_poe_detail UNIQUE (poe_id, poe_seq, field_name)
);

-- ─── RAW LAYER: ICU tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS raw.icu_stays (
    stay_id         INTEGER PRIMARY KEY,
    subject_id      INTEGER,
    hadm_id         INTEGER,
    first_careunit  TEXT,
    last_careunit   TEXT,
    intime          TIMESTAMPTZ,
    outtime         TIMESTAMPTZ,
    los             NUMERIC
);

CREATE TABLE IF NOT EXISTS raw.chart_events (
    id          BIGSERIAL PRIMARY KEY,
    subject_id  INTEGER,
    hadm_id     INTEGER,
    stay_id     INTEGER,
    caregiver_id INTEGER,
    charttime   TIMESTAMPTZ,
    storetime   TIMESTAMPTZ,
    itemid      INTEGER,
    value       TEXT,
    valuenum    NUMERIC,
    valueuom    TEXT,
    warning     SMALLINT,
    CONSTRAINT uq_chart_events UNIQUE (stay_id, charttime, itemid)
);

CREATE TABLE IF NOT EXISTS raw.input_events (
    id                              BIGSERIAL PRIMARY KEY,
    subject_id                      INTEGER,
    hadm_id                         INTEGER,
    stay_id                         INTEGER,
    caregiver_id                    INTEGER,
    starttime                       TIMESTAMPTZ,
    endtime                         TIMESTAMPTZ,
    storetime                       TIMESTAMPTZ,
    itemid                          INTEGER,
    amount                          NUMERIC,
    amountuom                       TEXT,
    rate                            NUMERIC,
    rateuom                         TEXT,
    orderid                         BIGINT,
    linkorderid                     BIGINT,
    ordercategoryname               TEXT,
    secondaryordercategoryname      TEXT,
    ordercomponenttypedescription   TEXT,
    ordercategorydescription        TEXT,
    patientweight                   NUMERIC,
    totalamount                     NUMERIC,
    totalamountuom                  TEXT,
    isopenbag                       SMALLINT,
    continueinnextdept              SMALLINT,
    statusdescription               TEXT,
    originalamount                  NUMERIC,
    originalrate                    NUMERIC,
    CONSTRAINT uq_input_events UNIQUE (stay_id, starttime, itemid, orderid)
);

CREATE TABLE IF NOT EXISTS raw.output_events (
    id           BIGSERIAL PRIMARY KEY,
    subject_id   INTEGER,
    hadm_id      INTEGER,
    stay_id      INTEGER,
    caregiver_id INTEGER,
    charttime    TIMESTAMPTZ,
    storetime    TIMESTAMPTZ,
    itemid       INTEGER,
    value        NUMERIC,
    valueuom     TEXT,
    CONSTRAINT uq_output_events UNIQUE (stay_id, charttime, itemid)
);

CREATE TABLE IF NOT EXISTS raw.procedure_events (
    id                          BIGSERIAL PRIMARY KEY,
    subject_id                  INTEGER,
    hadm_id                     INTEGER,
    stay_id                     INTEGER,
    caregiver_id                INTEGER,
    starttime                   TIMESTAMPTZ,
    endtime                     TIMESTAMPTZ,
    storetime                   TIMESTAMPTZ,
    itemid                      INTEGER,
    value                       NUMERIC,
    valueuom                    TEXT,
    location                    TEXT,
    locationcategory            TEXT,
    orderid                     BIGINT,
    linkorderid                 BIGINT,
    ordercategoryname           TEXT,
    ordercategorydescription    TEXT,
    patientweight               NUMERIC,
    isopenbag                   SMALLINT,
    continueinnextdept          SMALLINT,
    statusdescription           TEXT,
    originalamount              NUMERIC,
    originalrate                NUMERIC,
    CONSTRAINT uq_procedure_events UNIQUE (stay_id, starttime, itemid, orderid)
);

CREATE TABLE IF NOT EXISTS raw.datetime_events (
    id           BIGSERIAL PRIMARY KEY,
    subject_id   INTEGER,
    hadm_id      INTEGER,
    stay_id      INTEGER,
    caregiver_id INTEGER,
    charttime    TIMESTAMPTZ,
    storetime    TIMESTAMPTZ,
    itemid       INTEGER,
    value        TIMESTAMPTZ,
    valueuom     TEXT,
    warning      SMALLINT,
    CONSTRAINT uq_datetime_events UNIQUE (stay_id, charttime, itemid)
);

CREATE TABLE IF NOT EXISTS raw.ingredient_events (
    id              BIGSERIAL PRIMARY KEY,
    subject_id      INTEGER,
    hadm_id         INTEGER,
    stay_id         INTEGER,
    caregiver_id    INTEGER,
    starttime       TIMESTAMPTZ,
    endtime         TIMESTAMPTZ,
    storetime       TIMESTAMPTZ,
    itemid          INTEGER,
    amount          NUMERIC,
    amountuom       TEXT,
    rate            NUMERIC,
    rateuom         TEXT,
    orderid         BIGINT,
    linkorderid     BIGINT,
    statusdescription TEXT,
    originalamount  NUMERIC,
    originalrate    NUMERIC,
    CONSTRAINT uq_ingredient_events UNIQUE (stay_id, starttime, itemid, orderid)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_raw_admissions_subject_id    ON raw.admissions(subject_id);
CREATE INDEX IF NOT EXISTS idx_raw_diagnoses_subject_id     ON raw.diagnoses(subject_id);
CREATE INDEX IF NOT EXISTS idx_raw_diagnoses_hadm_id        ON raw.diagnoses(hadm_id);

-- New raw table indexes
CREATE INDEX IF NOT EXISTS idx_raw_lab_events_subject      ON raw.lab_events(subject_id);
CREATE INDEX IF NOT EXISTS idx_raw_lab_events_hadm         ON raw.lab_events(hadm_id);
CREATE INDEX IF NOT EXISTS idx_raw_lab_events_itemid       ON raw.lab_events(itemid);
CREATE INDEX IF NOT EXISTS idx_raw_prescriptions_subject   ON raw.prescriptions(subject_id);
CREATE INDEX IF NOT EXISTS idx_raw_prescriptions_hadm      ON raw.prescriptions(hadm_id);
CREATE INDEX IF NOT EXISTS idx_raw_chart_events_stay       ON raw.chart_events(stay_id);
CREATE INDEX IF NOT EXISTS idx_raw_chart_events_itemid     ON raw.chart_events(itemid);
CREATE INDEX IF NOT EXISTS idx_raw_chart_events_charttime  ON raw.chart_events(charttime);
CREATE INDEX IF NOT EXISTS idx_raw_icu_stays_subject       ON raw.icu_stays(subject_id);
CREATE INDEX IF NOT EXISTS idx_raw_icu_stays_hadm          ON raw.icu_stays(hadm_id);
CREATE INDEX IF NOT EXISTS idx_raw_input_events_stay       ON raw.input_events(stay_id);
CREATE INDEX IF NOT EXISTS idx_raw_output_events_stay      ON raw.output_events(stay_id);

CREATE INDEX IF NOT EXISTS idx_clean_admissions_subject_id  ON clean.admissions(subject_id);
CREATE INDEX IF NOT EXISTS idx_clean_diagnoses_subject_id   ON clean.diagnoses(subject_id);
CREATE INDEX IF NOT EXISTS idx_clean_diagnoses_hadm_id      ON clean.diagnoses(hadm_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id           ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action            ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp         ON public.audit_logs(timestamp DESC);
