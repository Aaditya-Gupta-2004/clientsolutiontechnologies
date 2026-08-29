from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class DocumentStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    signed = "signed"
    rejected = "rejected"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=False)          # original PDF path
    signed_file_path = Column(String(500), nullable=True)    # signed PDF path
    signature_data = Column(Text, nullable=True)             # base64 image of signature
    status = Column(Enum(DocumentStatus), default=DocumentStatus.draft, nullable=False)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    sent_at = Column(DateTime(timezone=True), nullable=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    created_by = relationship("User", back_populates="documents_created", foreign_keys=[created_by_id])
    client = relationship("User", back_populates="documents_assigned", foreign_keys=[client_id])
