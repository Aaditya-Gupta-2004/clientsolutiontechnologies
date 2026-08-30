from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    target_type: Optional[str]
    target_id: Optional[int]
    detail: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int


# Schemas init
from .user import UserCreate, UserUpdate, UserResponse, UserListResponse
from .auth import LoginRequest, TokenResponse, PasswordChange
from .document import DocumentCreate, DocumentUpdate, DocumentSend, DocumentSign, DocumentResponse, DocumentListResponse
from .project import ProjectCreate, ProjectUpdate, ProjectPhaseUpdate, ProjectResponse, ProjectListResponse, PhaseItem
from .payment import PaymentCreate, PaymentUpdate, RazorpayOrderResponse, VerifyPaymentRequest, PaymentResponse, PaymentListResponse
