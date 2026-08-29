from .auth import router as auth_router
from .users import router as users_router
from .documents import router as documents_router
from .projects import router as projects_router
from .payments import router as payments_router
from .dashboard import router as dashboard_router

__all__ = [
    "auth_router", "users_router", "documents_router",
    "projects_router", "payments_router", "dashboard_router"
]
