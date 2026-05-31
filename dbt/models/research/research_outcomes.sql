{{ config(materialized='table', schema='research', alias='outcomes') }}

with cohort_with_subject as (
    -- re-join subject_id for readmission window calculation (not exposed in final output)
    select
        rc.cohort_id,
        cp.subject_id,
        ca.admittime,
        ca.dischtime
    from {{ ref('research_cohort') }} rc
    inner join {{ ref('clean_admissions') }} ca
        on rc.los_days = round(ca.los_days::numeric, 1)
        and rc.admission_type = ca.admission_type
    inner join {{ ref('clean_patients') }} cp on ca.subject_id = cp.subject_id
),

readmissions as (
    select distinct
        c1.cohort_id,
        true as readmission_30d
    from cohort_with_subject c1
    join cohort_with_subject c2
        on c1.subject_id = c2.subject_id
        and c2.admittime > c1.dischtime
        and c2.admittime <= c1.dischtime + interval '30 days'
        and c1.cohort_id != c2.cohort_id
)

select
    rc.cohort_id,
    coalesce(r.readmission_30d, false) as readmission_30d,
    false as icu_admission,  -- placeholder; requires ICU stay data
    now() as dbt_updated_at
from {{ ref('research_cohort') }} rc
left join readmissions r on rc.cohort_id = r.cohort_id
