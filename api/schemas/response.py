from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel


class APIResponse(BaseModel):
    status: str  # "ok" | "error"
    data:   Optional[Any] = None
    error:  Optional[str] = None


def ok(data: Any = None) -> dict:
    return {"status": "ok", "data": data, "error": None}


def err(message: str) -> dict:
    return {"status": "error", "data": None, "error": message}
