from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from governance.rbac import Role, User, check_permission

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM  = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# In-memory demo users — replace with DB lookup in production
_USERS: dict[str, dict] = {
    "admin_user": {
        "user_id":  "admin_01",
        "username": "admin_user",
        "role":     Role.ADMIN,
        "hashed_password": pwd_context.hash("admin123"),
    },
    "researcher_user": {
        "user_id":  "researcher_01",
        "username": "researcher_user",
        "role":     Role.RESEARCHER,
        "hashed_password": pwd_context.hash("researcher123"),
    },
    "viewer_user": {
        "user_id":  "viewer_01",
        "username": "viewer_user",
        "role":     Role.VIEWER,
        "hashed_password": pwd_context.hash("viewer123"),
    },
}


def authenticate_user(username: str, password: str) -> User | None:
    user_data = _USERS.get(username)
    if not user_data:
        return None
    if not pwd_context.verify(password, user_data["hashed_password"]):
        return None
    return User(user_id=user_data["user_id"], username=username, role=user_data["role"])


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=EXPIRE_MIN)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    payload = verify_token(token)
    username = payload.get("sub")
    if not username or username not in _USERS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    data = _USERS[username]
    return User(user_id=data["user_id"], username=username, role=data["role"])


def require_role(required_action: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        try:
            check_permission(user, required_action)
        except PermissionError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        return user
    return dependency
