import stripe
import uuid
from config import get_settings

settings = get_settings()
stripe.api_key = settings.stripe_secret_key


def is_stripe_configured() -> bool:
    key = settings.stripe_secret_key
    return bool(key and not key.startswith("sk_test_placeholder") and len(key) > 20)


def create_payment_intent(amount_dollars: float, currency: str = "usd", metadata: dict = None) -> dict:
    """Create a Stripe PaymentIntent or return a demo intent if no live/test key is set."""
    if is_stripe_configured():
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(amount_dollars * 100),   # Stripe uses cents
                currency=currency,
                payment_method_types=["card"],
                metadata=metadata or {},
            )
            return {
                "client_secret": intent.client_secret,
                "payment_intent_id": intent.id,
                "amount": amount_dollars,
                "currency": currency,
                "is_demo": False,
            }
        except Exception as e:
            print(f"Stripe API error: {e}, falling back to demo mode.")

    # Demo mode fallback for testing without requiring Stripe API keys
    mock_id = f"pi_demo_{uuid.uuid4().hex[:16]}"
    return {
        "client_secret": f"{mock_id}_secret_{uuid.uuid4().hex[:16]}",
        "payment_intent_id": mock_id,
        "amount": amount_dollars,
        "currency": currency,
        "is_demo": True,
    }


def retrieve_payment_intent(payment_intent_id: str) -> stripe.PaymentIntent:
    if is_stripe_configured() and not payment_intent_id.startswith("pi_demo_"):
        return stripe.PaymentIntent.retrieve(payment_intent_id)
    return None


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )


def cancel_payment_intent(payment_intent_id: str):
    if is_stripe_configured() and not payment_intent_id.startswith("pi_demo_"):
        return stripe.PaymentIntent.cancel(payment_intent_id)
    return None


def get_publishable_key() -> str:
    return settings.stripe_publishable_key
