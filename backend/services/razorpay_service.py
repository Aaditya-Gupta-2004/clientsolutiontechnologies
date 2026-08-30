import razorpay
import uuid
import hmac
import hashlib
from config import get_settings

settings = get_settings()

def get_razorpay_client():
    if not is_razorpay_configured():
        return None
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))

def is_razorpay_configured() -> bool:
    key_id = settings.razorpay_key_id
    key_secret = settings.razorpay_key_secret
    return bool(key_id and key_secret and not key_id.startswith("rzp_test_placeholder"))

def create_order(amount: float, currency: str = "INR", receipt_id: str = None, notes: dict = None) -> dict:
    """Create a Razorpay Order or return a demo order if keys are missing."""
    if is_razorpay_configured():
        try:
            client = get_razorpay_client()
            # Razorpay uses smallest currency subunit (paise for INR)
            amount_in_subunit = int(amount * 100)
            
            order_data = {
                "amount": amount_in_subunit,
                "currency": currency.upper(),
                "receipt": receipt_id or f"rcpt_{uuid.uuid4().hex[:8]}",
                "notes": notes or {}
            }
            order = client.order.create(data=order_data)
            
            return {
                "order_id": order["id"],
                "amount": amount,
                "currency": currency,
                "is_demo": False,
            }
        except Exception as e:
            print(f"Razorpay API error: {e}, falling back to demo mode.")

    # Demo mode fallback
    mock_id = f"order_demo_{uuid.uuid4().hex[:14]}"
    return {
        "order_id": mock_id,
        "amount": amount,
        "currency": currency,
        "is_demo": True,
    }

def verify_payment_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    """Verify the signature returned by Razorpay Checkout."""
    if not is_razorpay_configured():
        # In demo mode, accept any signature for demo orders
        return razorpay_order_id.startswith("order_demo_")
        
    client = get_razorpay_client()
    try:
        client.utility.verify_payment_signature({
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        })
        return True
    except razorpay.errors.SignatureVerificationError:
        return False

def get_publishable_key() -> str:
    return settings.razorpay_key_id
