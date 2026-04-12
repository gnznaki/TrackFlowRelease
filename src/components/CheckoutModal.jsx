import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createPaymentIntent } from "../lib/stripe";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const C = {
  bg: "#08080a",
  surface: "#111115",
  surface2: "#18181d",
  surface3: "#1e1e25",
  border: "rgba(255,255,255,0.06)",
  border2: "rgba(255,255,255,0.12)",
  text: "#f0f0f0",
  text2: "#909090",
  text3: "#454545",
  accent: "#c8ff47",
  accentRgb: "200,255,71",
  error: "#ff5050",
  success: "#3af0b0",
};

const STRIPE_APPEARANCE = {
  theme: "night",
  variables: {
    colorPrimary: C.accent,
    colorBackground: C.surface2,
    colorText: C.text,
    colorTextSecondary: C.text2,
    colorTextPlaceholder: C.text3,
    colorDanger: C.error,
    colorSuccess: C.success,
    fontFamily: "Syne, sans-serif",
    fontSizeBase: "13px",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: `1px solid ${C.border2}`,
      backgroundColor: C.surface2,
      color: C.text,
      padding: "12px 16px",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: `1px solid rgba(${C.accentRgb},0.4)`,
      boxShadow: `0 0 0 3px rgba(${C.accentRgb},0.09)`,
    },
    ".Input--invalid": {
      border: `1px solid rgba(255,80,80,0.5)`,
    },
    ".Label": {
      color: C.text2,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontSize: "11px",
    },
    ".Tab": {
      border: `1px solid ${C.border2}`,
      backgroundColor: C.surface2,
    },
    ".Tab:hover": {
      backgroundColor: C.surface3,
    },
    ".Tab--selected": {
      border: `1px solid rgba(${C.accentRgb},0.4)`,
      backgroundColor: C.surface3,
      boxShadow: `0 0 0 2px rgba(${C.accentRgb},0.12)`,
    },
    ".TabIcon--selected": { color: C.accent },
    ".TabLabel--selected": { color: C.accent },
    ".Block": {
      backgroundColor: C.surface2,
      border: `1px solid ${C.border}`,
    },
    ".Error": { color: C.error },
  },
};

function PaymentForm({ onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) { setError(submitErr.message); setLoading(false); return; }

    const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: "https://trackflow.app/checkout/success" },
      redirect: "if_required",
    });

    if (confirmErr) {
      setError(confirmErr.message);
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess();
    } else {
      setError("Payment incomplete. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <div style={{ marginTop: 14, padding: "9px 12px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.18)", borderRadius: 8, fontSize: 12, color: C.error, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        style={{
          width: "100%",
          marginTop: 16,
          padding: "13px 0",
          background: !stripe || loading ? `rgba(${C.accentRgb},0.25)` : C.accent,
          border: "none",
          borderRadius: 10,
          cursor: !stripe || loading ? "default" : "pointer",
          fontSize: 13,
          fontWeight: 800,
          color: !stripe || loading ? "rgba(0,0,0,0.35)" : "#08080a",
          fontFamily: "Syne, sans-serif",
          letterSpacing: "0.02em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { if (stripe && !loading) e.currentTarget.style.filter = "brightness(1.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
      >
        {loading ? (
          <>
            <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(0,0,0,0.25)", borderTopColor: "rgba(0,0,0,0.6)", borderRadius: "50%", animation: "tf-spin 0.7s linear infinite" }} />
            Processing...
          </>
        ) : "Pay $10"}
      </button>

      <div style={{ marginTop: 10, fontSize: 11, color: C.text3, textAlign: "center", lineHeight: 1.6 }}>
        Secured by Stripe · No subscription · Instant access
        <br />Not happy? Contact us within 30 days for a full refund.
      </div>
    </form>
  );
}

function SuccessView({ onClose }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: `rgba(${C.accentRgb},0.1)`, border: `1px solid rgba(${C.accentRgb},0.3)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 8 }}>Purchase complete</div>
      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, marginBottom: 24 }}>
        Welcome to TrackFlow. Your account is now active.<br />
        A receipt has been sent to your email.
      </div>
      <button
        onClick={onClose}
        style={{ padding: "12px 32px", background: C.accent, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, color: "#08080a", fontFamily: "Syne, sans-serif", cursor: "pointer", letterSpacing: "0.02em" }}
      >
        Get started
      </button>
    </div>
  );
}

export default function CheckoutModal({ onClose, onSuccess }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(() => {
    createPaymentIntent("premium_once").then(result => {
      if (result.error) setLoadError(result.error);
      else setClientSecret(result.clientSecret);
    });
  }, []);

  function handleSuccess() {
    setSucceeded(true);
    setTimeout(() => { onSuccess?.(); }, 1800);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10002, fontFamily: "Syne, sans-serif", padding: 24 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`@keyframes tf-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: "100%", maxWidth: 440, background: C.surface, border: `1px solid ${C.border2}`, borderTop: `1px solid rgba(${C.accentRgb},0.25)`, borderRadius: 18, boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 3 }}>
              Get <span style={{ color: C.accent }}>TrackFlow</span>
            </div>
            <div style={{ fontSize: 12, color: C.text2 }}>$10 · one-time · no subscription</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.text3, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "2px 4px", marginLeft: 16, flexShrink: 0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 24px 24px" }}>
          {succeeded ? (
            <SuccessView onClose={onClose} />
          ) : loadError ? (
            <div style={{ padding: "12px 0", fontSize: 13, color: C.error, textAlign: "center", lineHeight: 1.6 }}>
              {loadError}
            </div>
          ) : !clientSecret ? (
            <div style={{ padding: "24px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: C.text3, fontSize: 12 }}>
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: C.text3, borderRadius: "50%", animation: "tf-spin 0.7s linear infinite" }} />
              Loading payment form...
            </div>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE, fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" }] }}>
              <PaymentForm onSuccess={handleSuccess} onClose={onClose} />
            </Elements>
          )}
        </div>

      </div>
    </div>
  );
}
