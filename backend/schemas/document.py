from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from models.document import DocumentStatus


class DocumentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    client_id: Optional[int] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    client_id: Optional[int] = None


class DocumentSend(BaseModel):
    client_id: int


class SignaturePlacement(BaseModel):
    page: Optional[int] = 1
    x_pct: Optional[float] = None
    y_pct: Optional[float] = None
    width_pct: Optional[float] = None


class DocumentSign(BaseModel):
    signature_data: str  # base64 PNG of signature
    placement: Optional[SignaturePlacement] = None


class DocumentResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: DocumentStatus
    file_path: str
    signed_file_path: Optional[str]
    client_id: Optional[int]
    created_by_id: int
    sent_at: Optional[datetime]
    signed_at: Optional[datetime]
    created_at: datetime
    client_name: Optional[str] = None
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
