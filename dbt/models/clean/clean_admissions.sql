{{ config(materialized='table', schema='clean') }}

select
    a.hadm_id,
    a.subject_id,
    a.admittime,
    a.dischtime,
    a.admission_type,
    a.admission_location,
    a.discharge_location,
    a.insurance,
    a.marital_status,
    a.race,
    round(
        extract(epoch from (a.dischtime - a.admittime)) / 86400.0,
        2
    ) as los_days,
    case
        when a.hadm_id is null or a.subject_id is null or a.admittime is null then 'FAIL'
        when a.dischtime is null then 'WARN'
        else 'PASS'
    end as data_quality_flag,
    now() as dbt_updated_at
from {{ source('raw', 'admissions') }} a
inner join {{ ref('clean_patients') }} p on a.subject_id = p.subject_id
where a.admittime is not null
  and (a.dischtime is null or a.dischtime > a.admittime)
