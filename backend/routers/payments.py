from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from models.user import User, UserRole
from models.payment import Payment, PaymentStatus
from schemas.payment import (
    PaymentCreate, PaymentUpdate,
    PaymentIntentResponse, PaymentResponse, PaymentListResponse
)
from services.auth_service import get_current_user, require_admin
from services.stripe_service import (
    create_payment_intent, retrieve_payment_intent,
    construct_webhook_event, get_publishable_key
)
from services.audit_service import log_action, get_client_ip
import stripe

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
def get_stripe_config():
    """Return Stripe publishable key for frontend."""
    return {"publishable_key": get_publishable_key()}


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


@router.post("/{payment_id}/create-intent", response_model=PaymentIntentResponse)
def create_intent(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe PaymentIntent for a pending payment."""
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if current_user.role == UserRole.client and p.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if p.status not in [PaymentStatus.pending, PaymentStatus.processing]:
        raise HTTPException(status_code=400, detail=f"Payment is already {p.status.value}")

    intent = create_payment_intent(
        amount_dollars=p.amount,
        currency=p.currency,
        metadata={"payment_id": str(p.id), "client_id": str(p.client_id)},
    )
    p.stripe_payment_intent_id = intent["payment_intent_id"]
    p.stripe_client_secret = intent["client_secret"]
    p.status = PaymentStatus.processing
    db.commit()

    return PaymentIntentResponse(
        client_secret=intent["client_secret"],
        payment_intent_id=intent["payment_intent_id"],
        amount=p.amount,
        currency=p.currency,
    )


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
               target_id=p.id, detail={"amount": p.amount, "mode": "card_test"})
    return _pay_response(p)



@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    """Handle Stripe webhook events."""
    payload = await request.body()
    try:
        event = construct_webhook_event(payload, stripe_signature)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    if event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        payment_id = int(pi.get("metadata", {}).get("payment_id", 0))
        p = db.query(Payment).filter(Payment.id == payment_id).first()
        if p:
            p.status = PaymentStatus.paid
            p.paid_at = datetime.now(timezone.utc)
            db.commit()
            log_action(db, "payment.paid", target_type="payment", target_id=p.id,
                       detail={"stripe_id": pi["id"]})

    elif event["type"] == "payment_intent.payment_failed":
        pi = event["data"]["object"]
        payment_id = int(pi.get("metadata", {}).get("payment_id", 0))
        p = db.query(Payment).filter(Payment.id == payment_id).first()
        if p:
            p.status = PaymentStatus.failed
            db.commit()

    return {"status": "ok"}


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

