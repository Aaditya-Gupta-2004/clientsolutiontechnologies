from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models.user import User, UserRole
from schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from services.auth_service import hash_password, get_current_user, require_admin, require_superadmin
from services.audit_service import log_action

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=UserListResponse)
def list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    # Superadmin sees everyone; admin sees only their clients
    if current_user.role == UserRole.admin:
        query = query.filter(User.created_by_id == current_user.id)

    if role:
        query = query.filter(User.role == role)
    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )

    total = query.count()
    users = query.offset(skip).limit(limit).all()
    return UserListResponse(users=users, total=total)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Admins can only see their own clients
    if current_user.role == UserRole.admin and user.created_by_id != current_user.id and user.id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return user


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Admin can only create clients; superadmin can create admins and clients
    if current_user.role == UserRole.admin and data.role != UserRole.client:
        raise HTTPException(status_code=403, detail="Admins can only create client accounts")

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        phone=data.phone,
        company=data.company,
        created_by_id=current_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, "user.created", user=current_user, target_type="user", target_id=user.id,
               detail={"name": user.name, "email": user.email, "role": user.role.value})
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role == UserRole.admin and user.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.name is not None:
        user.name = data.name
    if data.email is not None:
        user.email = data.email
    if data.phone is not None:
        user.phone = data.phone
    if data.company is not None:
        user.company = data.company
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password is not None:
        user.hashed_password = hash_password(data.password)

    db.commit()
    db.refresh(user)
    log_action(db, "user.updated", user=current_user, target_type="user", target_id=user.id)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()
    log_action(db, "user.deleted", user=current_user, target_type="user", target_id=user_id)
    return {"message": "User deleted"}
