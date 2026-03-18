import { useState, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { createPaymentIntent } from "../lib/stripe";

// Singleton — only call loadStripe once
let stripePromise = null;
function getStripe() {
  const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!pk) return null;
  if (!stripePromise) stripePromise = loadStripe(pk);
  return stripePromise;
}

const PLAN_LABELS = {
  premium_once: { name: "Premium", price: "$15", sub: "one-time payment", accent: "#c8ff47" },
};

export default function CheckoutModal({ priceKey, onClose, onSuccess, theme }) {
  const C = theme;
  const plan = PLAN_LABELS[priceKey];

  const [status, setStatus] = useState("loading"); // loading | ready | processing | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [cardError, setCardError] = useState("");
  const [clientSecret, setClientSecret] = useState(null);

  const stripeRef = useRef(null);
  const cardRef = useRef(null);       // Stripe card Element instance
  const mountRef = useRef(null);      // DOM node for card element

  // Step 1: create intent on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await createPaymentIntent(priceKey);
      if (cancelled) return;
      if (result.error) { setErrorMsg(result.error); setStatus("error"); return; }
      setClientSecret(result.clientSecret);
    })();
    return () => { cancelled = true; };
  }, [priceKey]);

  // Step 2: mount Stripe card element once we have clientSecret + DOM node
  useEffect(() => {
    if (!clientSecret || !mountRef.current) return;
    let mounted = true;

    (async () => {
      const stripe = await getStripe();
      if (!stripe || !mounted) return;
      stripeRef.current = stripe;

      const elements = stripe.elements({
        fonts: [{ cssSrc: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(C.font || "Syne")}:wght@400;700&display=swap` }],
      });

      const isDark = true; // card is always rendered on a dark surface
      const card = elements.create("card", {
        style: {
          base: {
            color: C.cardText || "#f0f0f0",
            fontFamily: `"${C.font || "Syne"}", sans-serif`,
            fontSize: "14px",
            fontWeight: "500",
            "::placeholder": { color: C.cardText3 || "#555" },
            iconColor: C.accent || "#c8ff47",
          },
          invalid: { color: "#ff5050", iconColor: "#ff5050" },
        },
      });

      card.mount(mountRef.current);
      card.on("change", e => setCardError(e.error?.message ?? ""));
      cardRef.current = card;
      if (mounted) setStatus("ready");
    })();

    return () => {
      mounted = false;
      cardRef.current?.destroy();
      cardRef.current = null;
    };
  }, [clientSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePay() {
    if (!stripeRef.current || !cardRef.current || !clientSecret) return;
    setStatus("processing");
    setErrorMsg("");

    const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(clientSecret, {
      payment_method: { card: cardRef.current },
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus("ready");
      return;
    }

    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      setStatus("success");
      // Give the webhook ~1.5s head-start, then fire onSuccess so the parent can
      // close the upgrade modal and let useTier's realtime sub pick up the new tier.
      setTimeout(() => onSuccess?.(), 1500);
    } else {
      setErrorMsg("Payment did not complete. Please try again.");
      setStatus("ready");
    }
  }

  const accentColor = plan?.accent || C.accent;
  const isLoading = status === "loading";
  const isProcessing = status === "processing";
  const isSuccess = status === "success";
  const isError = status === "error" && !clientSecret;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10002, fontFamily: C.font || "Syne", padding: 24 }}
      onMouseDown={e => { if (e.target === e.currentTarget && !isProcessing) onClose(); }}
    >
      <div style={{ width: "100%", maxWidth: 420, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: C.r2, boxShadow: "0 32px 80px rgba(0,0,0,0.7)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              Complete your purchase
            </div>
            <div style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>
              Powered by <span style={{ color: C.text }}>Stripe</span> — your card is never stored by us
            </div>
          </div>
          {!isProcessing && (
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.text3, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "2px 6px" }}>×</button>
          )}
        </div>

        {/* Plan summary */}
        <div style={{ margin: "16px 24px 0", padding: "12px 16px", background: C.surface2, border: `1px solid ${accentColor}30`, borderRadius: C.r, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{plan?.name}</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{plan?.sub}</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: accentColor }}>{plan?.price}</div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px" }}>

          {/* Success */}
          {isSuccess && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${accentColor}18`, border: `2px solid ${accentColor}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Payment successful!</div>
              <div style={{ fontSize: 12, color: C.text2 }}>Your plan is being updated…</div>
            </div>
          )}

          {/* Fatal error (couldn't create intent) */}
          {isError && (
            <div style={{ padding: "16px 0", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#ff5050", marginBottom: 16 }}>{errorMsg}</div>
              <button onClick={onClose} style={{ padding: "8px 20px", background: "transparent", border: `1px solid ${C.border2}`, borderRadius: C.r, color: C.text2, fontFamily: C.font || "Syne", fontSize: 13, cursor: "pointer" }}>Close</button>
            </div>
          )}

          {/* Card form */}
          {!isSuccess && !isError && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.text2, letterSpacing: "0.05em", display: "block", marginBottom: 8, textTransform: "uppercase" }}>
                  Card details
                </label>
                <div
                  ref={mountRef}
                  style={{
                    padding: "12px 14px",
                    background: C.surface2,
                    border: `1px solid ${cardError ? "rgba(255,80,80,0.5)" : C.border2}`,
                    borderRadius: C.r,
                    minHeight: 44,
                    transition: "border-color 0.15s",
                    opacity: isLoading ? 0.5 : 1,
                  }}
                />
                {isLoading && (
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>Preparing secure checkout…</div>
                )}
                {cardError && (
                  <div style={{ fontSize: 11, color: "#ff5050", marginTop: 8 }}>{cardError}</div>
                )}
              </div>

              {errorMsg && (
                <div style={{ padding: "9px 12px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: C.r, fontSize: 12, color: "#ff5050", marginBottom: 14 }}>
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={isLoading || isProcessing || !!cardError}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  background: isLoading || isProcessing ? `${accentColor}60` : accentColor,
                  border: "none",
                  borderRadius: C.r,
                  color: isLoading || isProcessing ? "rgba(0,0,0,0.5)" : (accentColor === "#c8ff47" || accentColor === "#47c8ff" ? "#0a0a0b" : "#f0f0f0"),
                  fontFamily: C.font || "Syne",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isLoading || isProcessing ? "default" : "pointer",
                  transition: "all 0.15s",
                  letterSpacing: "0.02em",
                }}
              >
                {isProcessing ? "Processing…" : isLoading ? "Loading…" : `Pay ${plan?.price}`}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span style={{ fontSize: 11, color: C.text3 }}>Secured by Stripe</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
