import { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createPaymentIntent, confirmDemoPayment } from '../services/api';
import { CreditCard, Lock, CheckCircle2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const CARD_OPTIONS = {
  style: {
    base: {
      color: '#F0F4FF',
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: 'rgba(240,244,255,0.35)' },
      iconColor: '#4F8EF7',
    },
    invalid: { color: '#EF4444', iconColor: '#EF4444' },
  },
};

const getSymbol = (curr) => {
  const c = curr?.toLowerCase();
  return c === 'inr' ? '₹' : c === 'eur' ? '€' : c === 'gbp' ? '£' : '$';
};

export default function StripeCheckout({ payment, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(null);

  // Demo card form states
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('123');
  const [cardName, setCardName] = useState(payment.client_name || 'Cardholder');

  useEffect(() => {
    createPaymentIntent(payment.id)
      .then(d => {
        setClientSecret(d.client_secret);
        if (d.client_secret?.includes('pi_demo_') || !stripe) {
          setIsDemo(true);
        }
      })
      .catch(() => {
        // Fallback to demo mode for testing
        setIsDemo(true);
        setClientSecret('demo_mode_ready');
      });
  }, [payment.id, stripe]);

  const handleDemoSubmit = async (e) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCvc) {
      return toast.error('Please fill in all card details');
    }
    setLoading(true);
    try {
      // Simulate 1.2s processing delay for realistic payment gateway feel
      await new Promise(r => setTimeout(r, 1200));
      await confirmDemoPayment(payment.id);
      toast.success('Payment successfully processed! 🎉');
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStripeSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setLoading(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
        billing_details: { name: payment.client_name || cardName },
      },
    });

    setLoading(false);

    if (stripeError) {
      setError(stripeError.message);
      toast.error(stripeError.message);
    } else if (paymentIntent.status === 'succeeded') {
      toast.success('Payment successful! 🎉');
      onSuccess?.();
    }
  };

  if (!clientSecret) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span style={{ marginLeft: '0.75rem', color: 'var(--text-muted)' }}>Initializing secure payment…</span>
      </div>
    );
  }

  // If in Demo Mode (when Stripe live/test API keys are not configured in .env)
  if (isDemo || !stripe) {
    return (
      <form onSubmit={handleDemoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Payment summary */}
        <div style={{
          background: 'rgba(79,142,247,0.08)',
          border: '1px solid rgba(79,142,247,0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ marginBottom: '0.25rem' }}>{payment.title}</h4>
              {payment.description && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{payment.description}</p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                {getSymbol(payment.currency)} {payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {payment.currency}
              </div>
            </div>
          </div>
        </div>

        {/* Card Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="form-group">
            <label className="form-label">
              <CreditCard size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
              Card Number (Credit / Debit)
            </label>
            <input
              type="text"
              className="form-input"
              value={cardNumber}
              onChange={e => setCardNumber(e.target.value)}
              placeholder="4242 4242 4242 4242"
              maxLength={19}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input
                type="text"
                className="form-input"
                value={cardExpiry}
                onChange={e => setCardExpiry(e.target.value)}
                placeholder="MM/YY"
                maxLength={5}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">CVC / CVV</label>
              <input
                type="text"
                className="form-input"
                value={cardCvc}
                onChange={e => setCardCvc(e.target.value)}
                placeholder="123"
                maxLength={4}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cardholder Name</label>
            <input
              type="text"
              className="form-input"
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              placeholder="Full Name"
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Shield size={13} color="var(--accent-green)" />
            <span>256-bit SSL Encrypted Card Processing (Test Mode Enabled)</span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg w-full"
          disabled={loading}
        >
          {loading ? (
            <><div className="spinner" style={{ width: 16, height: 16 }} /> Processing Payment…</>
          ) : (
            <><CreditCard size={18} /> Pay {getSymbol(payment.currency)} {payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</>
          )}
        </button>
      </form>
    );
  }

  // Live / Real Stripe Elements Mode
  return (
    <form onSubmit={handleStripeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{
        background: 'rgba(79,142,247,0.08)',
        border: '1px solid rgba(79,142,247,0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ marginBottom: '0.25rem' }}>{payment.title}</h4>
            {payment.description && (
              <p style={{ fontSize: '0.8rem' }}>{payment.description}</p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
              {getSymbol(payment.currency)} {payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {payment.currency}
            </div>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          <CreditCard size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
          Card Details (Credit or Debit)
        </label>
        <div
          className={`stripe-card-element${focused ? ' focused' : ''}`}
          onClick={() => elements?.getElement(CardElement)?.focus()}
        >
          <CardElement
            options={CARD_OPTIONS}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => e.error && setError(e.error.message)}
          />
        </div>
        {error && (
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-red)' }}>{error}</span>
        )}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Lock size={11} /> Secured by Stripe. Test card: 4242 4242 4242 4242
        </span>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg w-full"
        disabled={loading || !stripe}
      >
        {loading ? (
          <><div className="spinner" style={{ width: 16, height: 16 }} /> Processing…</>
        ) : (
          <><CreditCard size={18} /> Pay {getSymbol(payment.currency)} {payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</>
        )}
      </button>
    </form>
  );
}
