from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models.user import User, UserRole
from models.document import Document, DocumentStatus
from models.project import Project
from models.payment import Payment, PaymentStatus
from models.audit_log import AuditLog
from schemas import AuditLogListResponse, AuditLogResponse
from services.auth_service import get_current_user, require_admin, require_superadmin

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return role-appropriate dashboard statistics."""
    role = current_user.role

    if role == UserRole.superadmin:
        return {
            "role": "superadmin",
            "total_admins": db.query(User).filter(User.role == UserRole.admin).count(),
            "total_clients": db.query(User).filter(User.role == UserRole.client).count(),
            "total_documents": db.query(Document).count(),
            "total_signed": db.query(Document).filter(Document.status == DocumentStatus.signed).count(),
            "total_projects": db.query(Project).count(),
            "total_revenue": db.query(Payment).filter(Payment.status == PaymentStatus.paid).with_entities(
                db.query(Payment).filter(Payment.status == PaymentStatus.paid).statement
            ).scalar() or 0,
            "pending_payments": db.query(Payment).filter(Payment.status == PaymentStatus.pending).count(),
            "recent_signups": db.query(User).order_by(User.created_at.desc()).limit(5).count(),
        }

    elif role == UserRole.admin:
        my_clients = db.query(User).filter(User.created_by_id == current_user.id).count()
        my_docs = db.query(Document).filter(Document.created_by_id == current_user.id)
        my_projects = db.query(Project).filter(Project.admin_id == current_user.id)
        my_payments = db.query(Payment).filter(Payment.created_by_id == current_user.id)

        paid_amount = sum(
            p.amount for p in db.query(Payment)
            .filter(Payment.created_by_id == current_user.id, Payment.status == PaymentStatus.paid)
            .all()
        )

        return {
            "role": "admin",
            "my_clients": my_clients,
            "total_documents": my_docs.count(),
            "signed_documents": my_docs.filter(Document.status == DocumentStatus.signed).count(),
            "pending_documents": my_docs.filter(Document.status == DocumentStatus.sent).count(),
            "total_projects": my_projects.count(),
            "active_projects": my_projects.filter(Project.status == "in_progress").count(),
            "total_payments": my_payments.count(),
            "pending_payments": my_payments.filter(Payment.status == PaymentStatus.pending).count(),
            "collected_revenue": paid_amount,
        }

    else:  # client
        my_docs = db.query(Document).filter(Document.client_id == current_user.id)
        my_projects = db.query(Project).filter(Project.client_id == current_user.id)
        my_payments = db.query(Payment).filter(Payment.client_id == current_user.id)

        return {
            "role": "client",
            "documents_to_sign": my_docs.filter(Document.status == DocumentStatus.sent).count(),
            "signed_documents": my_docs.filter(Document.status == DocumentStatus.signed).count(),
            "total_projects": my_projects.count(),
            "active_projects": my_projects.filter(Project.status == "in_progress").count(),
            "pending_payments": my_payments.filter(Payment.status == PaymentStatus.pending).count(),
            "total_paid": sum(
                p.amount for p in my_payments.filter(Payment.status == PaymentStatus.paid).all()
            ),
            "projects": [
                {
                    "id": p.id,
                    "name": p.name,
                    "overall_completion": p.overall_completion,
                    "status": p.status.value,
                }
                for p in my_projects.limit(5).all()
            ],
        }


@router.get("/audit-logs", response_model=AuditLogListResponse)
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    action: str = None,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "detail": log.detail,
            "ip_address": log.ip_address,
            "created_at": log.created_at,
            "user_name": log.user.name if log.user else "System",
        })
    return AuditLogListResponse(logs=result, total=total)
