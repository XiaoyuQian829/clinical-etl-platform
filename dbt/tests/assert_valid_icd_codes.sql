-- Fails if any diagnosis record has a null or too-short ICD code
select *
from raw.diagnoses
where icd_code is null
   or length(trim(icd_code)) < 3
