from __future__ import annotations
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends

from api.middleware.auth import authenticate_user, create_access_token
from api.routers import pipeline, data, export, audit

app = FastAPI(
    title="ClinicalETL API",
    version="1.0.0",
    description=(
        "Production-grade clinical data ETL platform. "
        "Provides governed access to MIMIC-IV derived datasets with RBAC, "
        "audit logging, and de-identified export."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipeline.router)
app.include_router(data.router)
app.include_router(export.router)
app.include_router(audit.router)


@app.post("/auth/token", tags=["Auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.on_event("startup")
def on_startup():
    print("\n=== ClinicalETL API ready ===")
    print("Docs:   http://localhost:8000/docs")
    print("Health: http://localhost:8000/health")
    routes = [f"  {r.methods} {r.path}" for r in app.routes if hasattr(r, "methods")]
    print("\n".join(routes))
    print("=" * 30)
