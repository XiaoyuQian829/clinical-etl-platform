{{ config(materialized='table', schema='clean') }}

select
    d.subject_id,
    d.hadm_id,
    d.seq_num,
    d.icd_code,
    d.icd_version,
    ref.long_title as icd_description,
    case
        when d.icd_code is not null and length(trim(d.icd_code)) >= 3 then true
        else false
    end as is_valid_code,
    now() as dbt_updated_at
from {{ source('raw', 'diagnoses') }} d
left join {{ source('raw', 'icd_reference') }} ref
    on d.icd_code = ref.icd_code
    and d.icd_version = ref.icd_version
