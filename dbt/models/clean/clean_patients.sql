{{ config(materialized='table', schema='clean') }}

select
    subject_id,
    gender,
    anchor_age,
    anchor_year,
    anchor_year_group,
    dod,
    case
        when anchor_age <= 17 then 'PAEDIATRIC'
        when anchor_age <= 40 then 'YOUNG_ADULT'
        when anchor_age <= 65 then 'ADULT'
        else 'ELDERLY'
    end as age_band,
    case
        when subject_id is null or gender is null or anchor_age is null then 'FAIL'
        else 'PASS'
    end as data_quality_flag,
    now() as dbt_updated_at
from {{ source('raw', 'patients') }}
