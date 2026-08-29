from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from pathlib import Path
from database import get_db
from models.user import User, UserRole
from models.document import Document, DocumentStatus
from schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentSend,
    DocumentSign, DocumentResponse, DocumentListResponse
)
from services.auth_service import get_current_user, require_admin, require_any
from services.document_service import (
    save_uploaded_pdf, create_placeholder_pdf, overlay_signature_on_pdf
)
from services.audit_service import log_action, get_client_ip

router = APIRouter(prefix="/documents", tags=["Documents"])


def _doc_response(doc: Document) -> dict:
    data = {
        "id": doc.id,
        "title": doc.title,
        "description": doc.description,
        "status": doc.status,
        "file_path": doc.file_path,
        "signed_file_path": doc.signed_file_path,
        "client_id": doc.client_id,
        "created_by_id": doc.created_by_id,
        "sent_at": doc.sent_at,
        "signed_at": doc.signed_at,
        "created_at": doc.created_at,
        "client_name": doc.client.name if doc.client else None,
        "created_by_name": doc.created_by.name if doc.created_by else None,
    }
    return data


@router.get("", response_model=DocumentListResponse)
def list_documents(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Document)

    if current_user.role == UserRole.client:
        query = query.filter(Document.client_id == current_user.id)
    elif current_user.role == UserRole.admin:
        query = query.filter(Document.created_by_id == current_user.id)
    # superadmin sees all

    if status:
        query = query.filter(Document.status == status)
    if search:
        query = query.filter(Document.title.ilike(f"%{search}%"))

    total = query.count()
    docs = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()
    return DocumentListResponse(
        documents=[_doc_response(d) for d in docs],
        total=total
    )


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if current_user.role == UserRole.client and doc.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == UserRole.admin and doc.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _doc_response(doc)


@router.post("", response_model=DocumentResponse, status_code=201)
async def create_document(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    client_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if file and file.filename:
        content = await file.read()
        file_path = save_uploaded_pdf(content, file.filename)
    else:
        file_path = create_placeholder_pdf(title, description or "")

    status = DocumentStatus.sent if client_id else DocumentStatus.draft

    doc = Document(
        title=title,
        description=description,
        file_path=file_path,
        created_by_id=current_user.id,
        client_id=client_id,
        status=status,
        sent_at=datetime.now(timezone.utc) if client_id else None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    log_action(db, "document.created", user=current_user, target_type="document",
               target_id=doc.id, detail={"title": title})
    return _doc_response(doc)


@router.post("/{doc_id}/send", response_model=DocumentResponse)
def send_document(
    doc_id: int,
    data: DocumentSend,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if current_user.role == UserRole.admin and doc.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Verify client exists
    client = db.query(User).filter(User.id == data.client_id, User.role == UserRole.client).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    doc.client_id = data.client_id
    doc.status = DocumentStatus.sent
    doc.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(doc)
    log_action(db, "document.sent", user=current_user, target_type="document",
               target_id=doc.id, detail={"client_id": data.client_id})
    return _doc_response(doc)


@router.post("/{doc_id}/sign", response_model=DocumentResponse)
def sign_document(
    doc_id: int,
    data: DocumentSign,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.client:
        raise HTTPException(status_code=403, detail="Only clients can sign documents")

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="This document is not assigned to you")
    if doc.status == DocumentStatus.signed:
        raise HTTPException(status_code=400, detail="Document already signed")
    if doc.status != DocumentStatus.sent:
        raise HTTPException(status_code=400, detail="Document is not ready for signing")

    placement_dict = data.placement.model_dump() if data.placement else None
    signed_path = overlay_signature_on_pdf(doc.file_path, data.signature_data, current_user.name, placement=placement_dict)
    doc.signature_data = data.signature_data
    doc.signed_file_path = signed_path
    doc.status = DocumentStatus.signed
    doc.signed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(doc)
    log_action(db, "document.signed", user=current_user, target_type="document",
               target_id=doc.id, ip_address=get_client_ip(request))
    return _doc_response(doc)


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    signed: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if current_user.role == UserRole.client and doc.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # If signed is False, serve original unsigned file
    if signed is False:
        file_path = doc.file_path
    elif doc.signed_file_path and Path(doc.signed_file_path).exists():
        file_path = doc.signed_file_path
    else:
        file_path = doc.file_path

    if not Path(file_path).exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    is_signed_file = (file_path == doc.signed_file_path)
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=f"{doc.title}{'_signed' if is_signed_file else ''}.pdf"
    )


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Remove files on disk if present
    if doc.file_path and Path(doc.file_path).exists():
        try:
            Path(doc.file_path).unlink(missing_ok=True)
        except Exception:
            pass
            
    if doc.signed_file_path and Path(doc.signed_file_path).exists():
        try:
            Path(doc.signed_file_path).unlink(missing_ok=True)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    log_action(db, "document.deleted", user=current_user, target_type="document", target_id=doc_id, detail={"title": doc.title})
    return {"message": "Document deleted successfully"}
