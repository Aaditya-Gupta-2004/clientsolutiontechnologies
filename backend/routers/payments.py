from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from models.user import User, UserRole
from models.payment import Payment, PaymentStatus
from schemas.payment import (
    PaymentCreate, PaymentUpdate,
    RazorpayOrderResponse, VerifyPaymentRequest, PaymentResponse, PaymentListResponse
)
from services.auth_service import get_current_user, require_admin
from services.razorpay_service import (
    create_order, verify_payment_signature, get_publishable_key
)
from services.audit_service import log_action, get_client_ip

router = APIRouter(prefix="/payments", tags=["Payments"])


def _pay_response(p: Payment) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "amount": p.amount,
        "currency": p.currency,
        "status": p.status,
        "stripe_payment_intent_id": p.stripe_payment_intent_id,
        "client_id": p.client_id,
        "created_by_id": p.created_by_id,
        "due_date": p.due_date,
        "paid_at": p.paid_at,
        "created_at": p.created_at,
        "client_name": p.client.name if p.client else None,
    }


@router.get("/config")
def get_razorpay_config():
    """Return Razorpay key id for frontend."""
    return {"key_id": get_publishable_key()}


@router.get("", response_model=PaymentListResponse)
def list_payments(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Payment)
    if current_user.role == UserRole.client:
        query = query.filter(Payment.client_id == current_user.id)
    elif current_user.role == UserRole.admin:
        query = query.filter(Payment.created_by_id == current_user.id)
    if status:
        query = query.filter(Payment.status == status)

    total = query.count()
    payments = query.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()
    return PaymentListResponse(payments=[_pay_response(p) for p in payments], total=total)


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if current_user.role == UserRole.client and p.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _pay_response(p)


@router.post("", response_model=PaymentResponse, status_code=201)
def create_payment(
    data: PaymentCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    p = Payment(
        title=data.title,
        description=data.description,
        amount=data.amount,
        currency=data.currency,
        client_id=data.client_id,
        created_by_id=current_user.id,
        due_date=data.due_date,
        status=PaymentStatus.pending,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    log_action(db, "payment.created", user=current_user, target_type="payment",
               target_id=p.id, detail={"amount": p.amount, "client_id": p.client_id})
    return _pay_response(p)


@router.post("/{payment_id}/create-order", response_model=RazorpayOrderResponse)
def create_intent(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Razorpay Order for a pending payment."""
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if current_user.role == UserRole.client and p.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if p.status not in [PaymentStatus.pending, PaymentStatus.processing]:
        raise HTTPException(status_code=400, detail=f"Payment is already {p.status.value}")

    # Ensure currency is INR for Razorpay in India, but Razorpay supports others too
    order = create_order(
        amount=p.amount,
        currency=p.currency,
        receipt_id=f"rcpt_{p.id}",
        notes={"payment_id": str(p.id), "client_id": str(p.client_id)}
    )
    p.stripe_payment_intent_id = order["order_id"] # Reusing the column
    p.status = PaymentStatus.processing
    db.commit()

    return RazorpayOrderResponse(
        order_id=order["order_id"],
        amount=order["amount"],
        currency=order["currency"],
        is_demo=order.get("is_demo", False)
    )


@router.post("/{payment_id}/verify", response_model=PaymentResponse)
def verify_payment(
    payment_id: int,
    data: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify Razorpay payment signature and mark as paid."""
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    is_valid = verify_payment_signature(
        data.razorpay_order_id, 
        data.razorpay_payment_id, 
        data.razorpay_signature
    )
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
        
    if p.stripe_payment_intent_id != data.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Order ID mismatch")

    p.status = PaymentStatus.paid
    p.paid_at = datetime.now(timezone.utc)
    p.stripe_client_secret = data.razorpay_payment_id # Store payment ID for reference
    db.commit()
    db.refresh(p)
    log_action(db, "payment.paid", user=current_user, target_type="payment",
               target_id=p.id, detail={"amount": p.amount, "razorpay_payment_id": data.razorpay_payment_id})
    return _pay_response(p)


@router.post("/{payment_id}/confirm-demo-payment", response_model=PaymentResponse)
def confirm_demo_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Complete a test payment directly (used in demo mode)."""
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if current_user.role == UserRole.client and p.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    p.status = PaymentStatus.paid
    p.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    log_action(db, "payment.paid", user=current_user, target_type="payment",
               target_id=p.id, detail={"amount": p.amount, "mode": "demo_test"})
    return _pay_response(p)


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    data: PaymentUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if data.title is not None:
        p.title = data.title
    if data.description is not None:
        p.description = data.description
    if data.amount is not None:
        p.amount = data.amount
    if data.due_date is not None:
        p.due_date = data.due_date
    if data.status is not None:
        p.status = data.status
    db.commit()
    db.refresh(p)
    return _pay_response(p)


@router.get("/{payment_id}/invoice")
def get_payment_invoice(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and return official Tax Invoice PDF for a payment."""
    from fastapi.responses import FileResponse
    from services.invoice_service import generate_invoice_pdf

    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if current_user.role == UserRole.client and p.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    pdf_path = generate_invoice_pdf(p)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"Invoice_INV_{p.id:04d}.pdf",
    )


@router.delete("/{payment_id}")
def delete_payment(
    payment_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(p)
    db.commit()
    return {"message": "Payment deleted"}

