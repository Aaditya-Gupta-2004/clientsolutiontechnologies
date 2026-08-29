from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Float, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class ProjectStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    on_hold = "on_hold"
    cancelled = "cancelled"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.not_started, nullable=False)

    # Phase data stored as JSON list:
    # [{"name": "Design", "weight": 20, "completion": 100, "description": "..."},
    #  {"name": "Development", "weight": 60, "completion": 45, "description": "..."},
    #  {"name": "QA", "weight": 20, "completion": 0, "description": "..."}]
    phases = Column(JSON, nullable=False, default=list)
    overall_completion = Column(Float, default=0.0)  # computed from phases

    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    client = relationship("User", back_populates="projects", foreign_keys=[client_id])
    admin = relationship("User", foreign_keys=[admin_id])
