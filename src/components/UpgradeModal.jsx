import { useState } from "react";
import CheckoutModal from "./CheckoutModal";

const FEATURES = [
  "Unlimited local boards",
  "Auto-scan DAW projects (.flp, .als, .ptx, .rpp)",
  "Custom tags, notes & one-click open in DAW",
  "Cloud backup & multi-device sync",
  "Share boards with collaborators in real-time",
  "Invite collaborators by email",
  "Role-based access — editor or viewer",
];

function Check({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function UpgradeModal({ onClose, onPurchased, theme }) {
  const C = theme;
  const [showCheckout, setShowCheckout] = useState(false);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, fontFamily: C.font || "Syne", padding: 24 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "100%", maxWidth: 420, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: C.r2, boxShadow: "0 32px 80px rgba(0,0,0,0.6)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 4 }}>
              Get <span style={{ color: "#c8ff47" }}>TrackFlow</span>
            </div>
            <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6 }}>
              One-time purchase. Everything included. No subscription, ever.
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.text3, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "2px 4px", marginLeft: 16, flexShrink: 0 }}>×</button>
        </div>

        {/* Price */}
        <div style={{ padding: "20px 24px 4px", display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 42, fontWeight: 900, color: "#c8ff47", lineHeight: 1 }}>$10</span>
          <span style={{ fontSize: 12, color: C.text3 }}>one-time · no subscription · ever</span>
        </div>

        {/* Feature list */}
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Everything included</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Check color="#c8ff47" />
                <span style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: "24px 24px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => setShowCheckout(true)}
            style={{ width: "100%", padding: "13px 0", background: "#c8ff47", border: "none", borderRadius: C.r, cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#000", letterSpacing: "0.04em", fontFamily: C.font || "Syne" }}
          >
            Buy Now — $10
          </button>

          <div style={{ fontSize: 11, color: C.text3, textAlign: "center", lineHeight: 1.6 }}>
            Secure checkout · Instant access · Windows 10 / 11
          </div>
        </div>

      </div>

      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onSuccess={() => { setShowCheckout(false); onPurchased?.(); onClose(); }}
        />
      )}
    </div>
  );
}
