from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator


class DiagnosisRaw(BaseModel):
    model_config = ConfigDict(strict=False)

    subject_id: int
    hadm_id: int
    seq_num: Optional[int] = None
    icd_code: Optional[str] = None
    icd_version: int

    @field_validator("icd_version")
    @classmethod
    def validate_icd_version(cls, v: int) -> int:
        if v not in (9, 10):
            raise ValueError(f"icd_version must be 9 or 10, got {v}")
        return v
