from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"
    client = "client"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.client)
    phone = Column(String(20), nullable=True)
    company = Column(String(150), nullable=True)
    is_active = Column(Boolean, default=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    created_by = relationship("User", remote_side=[id], foreign_keys=[created_by_id])
    documents_assigned = relationship("Document", back_populates="client", foreign_keys="Document.client_id")
    documents_created = relationship("Document", back_populates="created_by", foreign_keys="Document.created_by_id")
    projects = relationship("Project", back_populates="client", foreign_keys="Project.client_id")
    audit_logs = relationship("AuditLog", back_populates="user")
