-- Fails if any subject_id appears more than once in raw.patients
select subject_id, count(*) as cnt
from raw.patients
group by subject_id
having count(*) > 1
