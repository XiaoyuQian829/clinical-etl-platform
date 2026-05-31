from __future__ import annotations
from enum import Enum
from functools import wraps
from typing import Callable
from pydantic import BaseModel


class Role(str, Enum):
    ADMIN      = "admin"
    RESEARCHER = "researcher"
    VIEWER     = "viewer"


class User(BaseModel):
    user_id:   str
    username:  str
    role:      Role
    is_active: bool = True


PERMISSIONS: dict[Role, list[str]] = {
    Role.ADMIN: [
        "user_management",
        "audit_read",
        "pipeline_run",
        "pipeline_status",
        "data_read_raw",
        "data_read_clean",
        "data_read_research",
        "export_request",
        "export_download",
    ],
    Role.RESEARCHER: [
        "pipeline_status",
        "data_read_clean",
        "data_read_research",
        "export_request",
        "export_download",
    ],
    Role.VIEWER: [
        "data_read_research",
    ],
}


def check_permission(user: User, action: str) -> bool:
    if not user.is_active:
        raise PermissionError(f"User {user.username} is inactive")
    allowed = PERMISSIONS.get(user.role, [])
    if action not in allowed:
        raise PermissionError(
            f"User {user.username} (role={user.role}) is not permitted to perform '{action}'"
        )
    print(f"[rbac] ALLOW user={user.username} role={user.role} action={action}")
    return True


def require_permission(action: str) -> Callable:
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, user: User, **kwargs):
            check_permission(user, action)
            return fn(*args, user=user, **kwargs)
        return wrapper
    return decorator
