from __future__ import annotations
from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator


class PatientRaw(BaseModel):
    model_config = ConfigDict(strict=False)

    subject_id: int
    gender: str
    anchor_age: int
    anchor_year: int
    anchor_year_group: Optional[str] = None
    dod: Optional[date] = None

    @field_validator("gender", mode="before")
    @classmethod
    def normalise_gender(cls, v: str) -> str:
        mapping = {"m": "M", "male": "M", "f": "F", "female": "F"}
        return mapping.get(str(v).strip().lower(), "UNKNOWN")

    @field_validator("dod", mode="before")
    @classmethod
    def handle_nan_dod(cls, v):
        if v is None:
            return None
        if isinstance(v, float):
            return None  # pandas NaN / NaT comes through as float
        return v

    @field_validator("anchor_age")
    @classmethod
    def validate_age(cls, v: int) -> int:
        if not 0 <= v <= 120:
            raise ValueError(f"anchor_age {v} out of range 0-120")
        return v
