{{ config(materialized='table', schema='research', alias='cohort') }}

with primary_diagnoses as (
    select
        hadm_id,
        icd_code    as primary_diagnosis_code,
        icd_description as primary_diagnosis_desc
    from {{ ref('clean_diagnoses') }}
    where seq_num = 1
      and is_valid_code = true
)

select
    row_number() over (order by p.subject_id, a.admittime) as cohort_id,
    p.age_band,
    p.gender,
    a.admission_type,
    round(a.los_days::numeric, 1) as los_days,
    d.primary_diagnosis_code,
    d.primary_diagnosis_desc,
    true as is_deidentified,
    now() as dbt_updated_at
from {{ ref('clean_patients') }} p
inner join {{ ref('clean_admissions') }} a on p.subject_id = a.subject_id
left join primary_diagnoses d on a.hadm_id = d.hadm_id
