from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from config import get_settings
from database import engine, Base

# Import all models so Alembic/SQLAlchemy sees them
import models  # noqa: F401

from routers import (
    auth_router, users_router, documents_router,
    projects_router, payments_router, dashboard_router,
)

settings = get_settings()

# Create tables (for dev; use Alembic for prod migrations)
Base.metadata.create_all(bind=engine)

# Ensure storage directory exists
storage_path = Path(settings.storage_path)
storage_path.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="ProjectPortal API",
    description="E-Sign, Project Tracking & Payment Portal",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploaded/signed PDFs
app.mount("/storage", StaticFiles(directory=str(storage_path)), name="storage")

# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": settings.app_name}


# Seed superadmin on first run
@app.on_event("startup")
def seed_superadmin():
    from database import SessionLocal
    from models.user import User, UserRole
    from services.auth_service import hash_password

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.role == UserRole.superadmin).first()
        if not existing:
            superadmin = User(
                name="Super Admin",
                email="admin@projectportal.com",
                hashed_password=hash_password("Admin@1234"),
                role=UserRole.superadmin,
            )
            db.add(superadmin)
            db.commit()
            print("Superadmin seeded: admin@projectportal.com / Admin@1234")
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

