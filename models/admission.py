from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class AdmissionRaw(BaseModel):
    model_config = ConfigDict(strict=False)

    hadm_id: int
    subject_id: int
    admittime: datetime
    dischtime: Optional[datetime] = None
    admission_type: str
    admission_location: Optional[str] = None
    discharge_location: Optional[str] = None
    insurance: Optional[str] = None
    marital_status: Optional[str] = None
    race: Optional[str] = None

    @field_validator("marital_status", "discharge_location", "insurance", "race",
                     "admission_location", mode="before")
    @classmethod
    def handle_nan_strings(cls, v):
        if v is None:
            return None
        if isinstance(v, float):
            return None
        return v

    @model_validator(mode="after")
    def dischtime_after_admittime(self) -> "AdmissionRaw":
        if self.dischtime and self.dischtime <= self.admittime:
            raise ValueError("dischtime must be after admittime")
        return self
