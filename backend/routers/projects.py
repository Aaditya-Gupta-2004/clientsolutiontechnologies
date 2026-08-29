from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models.user import User, UserRole
from models.project import Project
from schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectPhaseUpdate,
    ProjectResponse, ProjectListResponse
)
from services.auth_service import get_current_user, require_admin
from services.audit_service import log_action

router = APIRouter(prefix="/projects", tags=["Projects"])


def _compute_overall(phases: list) -> float:
    """Compute weighted overall completion from phases list."""
    if not phases:
        return 0.0
    total = sum(p.get("weight", 0) * p.get("completion", 0) / 100 for p in phases)
    return round(min(total, 100.0), 2)


def _proj_response(proj: Project) -> dict:
    return {
        "id": proj.id,
        "name": proj.name,
        "description": proj.description,
        "status": proj.status,
        "phases": proj.phases or [],
        "overall_completion": proj.overall_completion,
        "client_id": proj.client_id,
        "admin_id": proj.admin_id,
        "start_date": proj.start_date,
        "end_date": proj.end_date,
        "deadline": proj.deadline,
        "created_at": proj.created_at,
        "client_name": proj.client.name if proj.client else None,
        "admin_name": proj.admin.name if proj.admin else None,
    }


@router.get("", response_model=ProjectListResponse)
def list_projects(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Project)
    if current_user.role == UserRole.client:
        query = query.filter(Project.client_id == current_user.id)
    elif current_user.role == UserRole.admin:
        query = query.filter(Project.admin_id == current_user.id)
    if status:
        query = query.filter(Project.status == status)

    total = query.count()
    projects = query.order_by(Project.created_at.desc()).offset(skip).limit(limit).all()
    return ProjectListResponse(projects=[_proj_response(p) for p in projects], total=total)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role == UserRole.client and proj.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == UserRole.admin and proj.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _proj_response(proj)


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    data: ProjectCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    phases = [p.model_dump() for p in data.phases]
    overall = _compute_overall(phases)

    proj = Project(
        name=data.name,
        description=data.description,
        client_id=data.client_id,
        admin_id=current_user.id,
        phases=phases,
        overall_completion=overall,
        start_date=data.start_date,
        deadline=data.deadline,
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    log_action(db, "project.created", user=current_user, target_type="project",
               target_id=proj.id, detail={"name": proj.name})
    return _proj_response(proj)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role == UserRole.admin and proj.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.name is not None:
        proj.name = data.name
    if data.description is not None:
        proj.description = data.description
    if data.status is not None:
        proj.status = data.status
    if data.start_date is not None:
        proj.start_date = data.start_date
    if data.end_date is not None:
        proj.end_date = data.end_date
    if data.deadline is not None:
        proj.deadline = data.deadline
    if data.phases is not None:
        phases = [p.model_dump() for p in data.phases]
        proj.phases = phases
        proj.overall_completion = _compute_overall(phases)

    db.commit()
    db.refresh(proj)
    log_action(db, "project.updated", user=current_user, target_type="project", target_id=proj.id)
    return _proj_response(proj)


@router.patch("/{project_id}/phases", response_model=ProjectResponse)
def update_phases(
    project_id: int,
    data: ProjectPhaseUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Quick endpoint to update only phase progress."""
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role == UserRole.admin and proj.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    phases = [p.model_dump() for p in data.phases]
    proj.phases = phases
    proj.overall_completion = _compute_overall(phases)
    db.commit()
    db.refresh(proj)
    log_action(db, "project.phases_updated", user=current_user, target_type="project",
               target_id=proj.id, detail={"overall": proj.overall_completion})
    return _proj_response(proj)


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role == UserRole.admin and proj.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(proj)
    db.commit()
    log_action(db, "project.deleted", user=current_user, target_type="project", target_id=project_id)
    return {"message": "Project deleted"}
