import { useState } from "react";
import { supabase } from "../lib/supabase";
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

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8ff47" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function PurchaseGate({ user, signOut, onRefreshTier }) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleAlreadyPurchased() {
    setChecking(true);
    setMessage(null);
    const { data } = await supabase.from("profiles").select("tier").eq("id", user.id).single();
    if (data?.tier === "premium" || data?.tier === "ongoing") {
      setMessage("Purchase confirmed! Loading...");
      await onRefreshTier?.();
    } else {
      setMessage("No purchase found. Complete checkout first.");
      setChecking(false);
    }
  }

  return (
    <div style={{
      height: "100vh",
      background: "#0a0a0b",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Syne, sans-serif",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ fontSize: 20, fontWeight: 900, color: "#f0f0f0", marginBottom: 32, letterSpacing: "-0.02em" }}>
          Track<span style={{ color: "#c8ff47" }}>Flow</span>
        </div>

        {/* Card */}
        <div style={{ background: "#111112", border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>

          {/* Header */}
          <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f0f0", marginBottom: 6 }}>
              Purchase required to continue
            </div>
            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
              TrackFlow is a one-time purchase. Pay once, use forever.
            </div>
          </div>

          {/* Price */}
          <div style={{ padding: "20px 24px 4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: "#c8ff47", lineHeight: 1 }}>$10</span>
            <span style={{ fontSize: 12, color: "#555" }}>one-time · no subscription · ever</span>
          </div>

          {/* Feature list */}
          <div style={{ padding: "16px 24px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {FEATURES.map(f => (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Check />
                  <span style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: "24px 24px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => setShowCheckout(true)}
              style={{ width: "100%", padding: "13px 0", background: "#c8ff47", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#000", letterSpacing: "0.04em", fontFamily: "Syne, sans-serif" }}
            >
              Buy Now — $10
            </button>

            {/* Already purchased */}
            <button
              onClick={handleAlreadyPurchased}
              disabled={checking}
              style={{
                width: "100%",
                padding: "11px 0",
                background: "transparent",
                border: "1px solid #2a2a2a",
                borderRadius: 8,
                cursor: checking ? "default" : "pointer",
                fontSize: 12,
                fontWeight: 700,
                color: checking ? "#444" : "#888",
                fontFamily: "Syne, sans-serif",
              }}
            >
              {checking ? "Checking..." : "I've already purchased"}
            </button>

            {message && (
              <div style={{ fontSize: 11, color: message.includes("confirmed") ? "#c8ff47" : "#ff6b6b", textAlign: "center", lineHeight: 1.5 }}>
                {message}
              </div>
            )}
          </div>
        </div>

        {/* Sign out */}
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "#444" }}>Signed in as {user.email} · </span>
          <button
            onClick={signOut}
            style={{ background: "none", border: "none", color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "Syne, sans-serif", padding: 0 }}
          >
            Sign out
          </button>
        </div>

      </div>

      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onSuccess={async () => {
            setShowCheckout(false);
            setTimeout(() => onRefreshTier?.(), 2000);
          }}
        />
      )}
    </div>
  );
}
