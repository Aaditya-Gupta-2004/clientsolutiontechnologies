import json
from sqlalchemy.orm import Session
from models.audit_log import AuditLog
from models.user import User


def log_action(
    db: Session,
    action: str,
    user: User = None,
    target_type: str = None,
    target_id: int = None,
    detail: dict = None,
    ip_address: str = None,
    user_agent: str = None,
):
    """Create an audit log entry."""
    entry = AuditLog(
        user_id=user.id if user else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=json.dumps(detail) if detail else None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    db.commit()


def get_client_ip(request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
