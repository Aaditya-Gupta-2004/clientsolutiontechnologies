from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from models.payment import PaymentStatus


class PaymentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    amount: float
    currency: str = "usd"
    client_id: int
    due_date: Optional[datetime] = None


class PaymentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[datetime] = None
    status: Optional[PaymentStatus] = None


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: float
    currency: str


class PaymentResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    amount: float
    currency: str
    status: PaymentStatus
    stripe_payment_intent_id: Optional[str]
    client_id: int
    created_by_id: int
    due_date: Optional[datetime]
    paid_at: Optional[datetime]
    created_at: datetime
    client_name: Optional[str] = None

    class Config:
        from_attributes = True


class PaymentListResponse(BaseModel):
    payments: list[PaymentResponse]
    total: int
