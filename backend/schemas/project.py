from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from models.project import ProjectStatus


class PhaseItem(BaseModel):
    name: str
    weight: float        # percentage weight of this phase (all weights should sum to 100)
    completion: float    # 0-100 how complete this phase is
    description: Optional[str] = None
    color: Optional[str] = None  # hex color for UI


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    client_id: int
    phases: List[PhaseItem] = []
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    phases: Optional[List[PhaseItem]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    deadline: Optional[datetime] = None


class ProjectPhaseUpdate(BaseModel):
    phases: List[PhaseItem]


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: ProjectStatus
    phases: List[Any]
    overall_completion: float
    client_id: int
    admin_id: int
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    deadline: Optional[datetime]
    created_at: datetime
    client_name: Optional[str] = None
    admin_name: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int
