from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"
    cancelled = "cancelled"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)           # in dollars
    currency = Column(String(10), default="usd")
    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending, nullable=False)

    stripe_payment_intent_id = Column(String(255), nullable=True, index=True)
    stripe_client_secret = Column(String(500), nullable=True)

    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    due_date = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    client = relationship("User", foreign_keys=[client_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
