import { useState } from "react";
import { openCustomerPortal } from "../lib/stripe";
import CheckoutModal from "./CheckoutModal";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    sub: "forever",
    accent: null,
    features: [
      "Unlimited local boards",
      "FL Studio, Ableton & Pro Tools scanning",
      "Kanban with tags, notes & filters",
      "Cloud backup across devices",
      "Join shared boards",
    ],
    cta: null,
  },
  {
    key: "premium",
    name: "Premium",
    price: "$15",
    sub: "one-time",
    priceKey: "premium_once",
    accent: "#c8ff47",
    features: [
      "Everything in Free",
      "Share boards with collaborators",
      "Real-time sync across all devices",
      "Unlimited shared boards",
      "Early access to new features",
    ],
    cta: "Get Premium",
    popular: true,
  },
];

function Check({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color || "#3af0b0"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function UpgradeModal({ tier, onClose, theme }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [checkoutPriceKey, setCheckoutPriceKey] = useState(null);
  const C = theme;

  function handleUpgrade(priceKey) {
    setCheckoutPriceKey(priceKey);
  }

  async function handlePortal() {
    setLoading("portal");
    setError(null);
    const { error: err } = await openCustomerPortal();
    setLoading(null);
    if (err) setError(err);
  }

  const isPaying = tier === "premium";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, fontFamily: C.font || "Syne", padding: 24 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "100%", maxWidth: 760, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: C.r2, boxShadow: "0 32px 80px rgba(0,0,0,0.6)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "22px 28px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>
              Upgrade <span style={{ color: C.accent }}>TrackFlow</span>
            </div>
            <div style={{ fontSize: 13, color: C.text2 }}>
              Unlock collaboration and keep your boards in sync everywhere.
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.text3, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "2px 4px", marginLeft: 16 }}>×</button>
        </div>

        {/* Plans grid */}
        <div style={{ display: "flex", gap: 12, padding: "20px 24px 24px" }}>
          {PLANS.map(plan => {
            const isCurrent = tier === plan.key;
            const accentColor = plan.accent || C.text3;

            return (
              <div key={plan.key} style={{ flex: 1, background: C.surface2, border: `1px solid ${plan.popular && !isCurrent ? C.accent + "50" : C.border}`, borderRadius: C.r2, padding: "18px 16px", display: "flex", flexDirection: "column", position: "relative", transition: "border-color 0.2s" }}>

                {plan.popular && (
                  <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: C.accent, color: C.accentText, fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 20, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                    MOST POPULAR
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isCurrent ? C.accent : C.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    {plan.name}
                    {isCurrent && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: `rgba(${C.accentRgb},0.15)`, color: C.accent, padding: "2px 7px", borderRadius: 8 }}>
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: accentColor }}>{plan.price}</span>
                    <span style={{ fontSize: 11, color: C.text3 }}>{plan.sub}</span>
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <Check color={plan.accent || "#3af0b0"} />
                      <span style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>

                {plan.cta && !isCurrent && (
                  <button
                    onClick={() => handleUpgrade(plan.priceKey)}
                    style={{ width: "100%", padding: "10px 0", background: plan.popular ? C.accent : "transparent", border: `1px solid ${accentColor}`, borderRadius: C.r, color: plan.popular ? C.accentText : accentColor, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { if (!plan.popular) e.currentTarget.style.background = accentColor + "15"; }}
                    onMouseLeave={e => { if (!plan.popular) e.currentTarget.style.background = "transparent"; }}
                  >
                    {plan.cta}
                  </button>
                )}
                {isCurrent && plan.key !== "free" && (
                  <button onClick={handlePortal} disabled={loading === "portal"}
                    style={{ width: "100%", padding: "10px 0", background: "transparent", border: `1px solid ${C.border}`, borderRadius: C.r, color: C.text3, fontFamily: C.font || "Syne", fontSize: 12, cursor: "pointer" }}>
                    {loading === "portal" ? "Opening…" : "Manage subscription"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "0 24px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: C.text3 }}>
            Your plan updates automatically once payment completes.
          </div>
          {isPaying && (
            <button onClick={handlePortal} style={{ background: "transparent", border: "none", color: C.text3, fontFamily: C.font || "Syne", fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Manage billing
            </button>
          )}
        </div>

        {error && (
          <div style={{ margin: "0 24px 16px", padding: "8px 12px", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: C.r, fontSize: 12, color: "#ff5050" }}>
            {error}
          </div>
        )}
      </div>

      {checkoutPriceKey && (
        <CheckoutModal
          priceKey={checkoutPriceKey}
          theme={C}
          onClose={() => setCheckoutPriceKey(null)}
          onSuccess={() => { setCheckoutPriceKey(null); onClose(); }}
        />
      )}
    </div>
  );
}
