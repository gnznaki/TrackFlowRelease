import { useState } from "react";

// Uses hardcoded default-theme colours so it renders before prefs are loaded
const C = {
  bg: "#0a0a0b",
  surface: "#111115",
  surface2: "#18181d",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.14)",
  text: "#f0f0f0",
  text2: "#888888",
  text3: "#444444",
  accent: "#c8ff47",
  accentDim: "rgba(200,255,71,0.12)",
  error: "#ff5050",
  errorDim: "rgba(255,80,80,0.12)",
  success: "#3af0b0",
};

function Field({ label, type, value, onChange, placeholder, disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 6, letterSpacing: "0.04em" }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: C.surface2,
          border: `1px solid ${focused ? C.accent + "60" : C.border2}`,
          borderRadius: 10,
          padding: "10px 14px",
          color: C.text,
          fontFamily: "Syne, sans-serif",
          fontSize: 13,
          outline: "none",
          transition: "border-color 0.15s",
          boxSizing: "border-box",
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  );
}

export default function AuthScreen({ onOffline }) {
  const [view, setView] = useState("signin"); // "signin" | "signup" | "verify"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lazy import so supabase.js warning only fires if AuthScreen is rendered
  async function getAuth() {
    const { useAuth } = await import("../hooks/useAuth.js");
    return useAuth;
  }

  // We call the auth functions directly to avoid hook rules — pass them via props instead
  // AuthScreen receives signIn/signUp from the parent that already called useAuth
  return null; // placeholder — see below for the real implementation
}

// The real component — receives auth functions as props from App
export function AuthScreenInner({ signIn, signUp, onOffline }) {
  const [view, setView] = useState("signin"); // "signin" | "signup" | "verify"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function reset() { setEmail(""); setPassword(""); setError(null); }

  function switchView(v) { reset(); setView(v); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (view === "signup") {
      const { data, error: err } = await signUp(email, password);
      setLoading(false);
      if (err) { setError(err.message); return; }
      // Supabase sends a confirmation email unless "Confirm email" is disabled in project settings
      if (data?.user && !data.session) { setView("verify"); return; }
      // Auto-confirmed (email confirm disabled in project) — user is now logged in
    } else {
      const { error: err } = await signIn(email, password);
      setLoading(false);
      if (err) { setError(err.message); return; }
      // onAuthStateChange in useAuth handles the session update automatically
    }
  }

  const BENEFITS = [
    { icon: "⟳", text: "Sync boards across devices" },
    { icon: "◈", text: "Save themes to your profile" },
    { icon: "⇌", text: "Collaborate on boards" },
  ];

  if (view === "verify") {
    return (
      <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: "0 24px" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>✉</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>Check your inbox</div>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, marginBottom: 28 }}>
            We sent a confirmation link to <span style={{ color: C.accent }}>{email}</span>.<br />
            Click it to activate your account and sign in.
          </div>
          <button onClick={() => switchView("signin")} style={{ padding: "10px 28px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 10, color: C.text2, fontFamily: "Syne, sans-serif", fontSize: 13, cursor: "pointer" }}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.5px", marginBottom: 6 }}>
            Track<span style={{ color: C.accent }}>Flow</span>
          </div>
          <div style={{ fontSize: 12, color: C.text3 }}>The music production workspace</div>
        </div>

        {/* Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 16, padding: 28, marginBottom: 16 }}>

          {/* Tab toggle */}
          <div style={{ display: "flex", background: C.surface2, borderRadius: 10, padding: 3, marginBottom: 24, gap: 2 }}>
            {[["signin", "Sign In"], ["signup", "Create Account"]].map(([key, label]) => (
              <button key={key} onClick={() => switchView(key)}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: view === key ? C.bg : "transparent", color: view === key ? C.text : C.text2, fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: view === key ? 700 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" disabled={loading} />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder={view === "signup" ? "8+ characters" : "••••••••"} disabled={loading} />

            {error && (
              <div style={{ background: C.errorDim, border: `1px solid ${C.error}30`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: C.error, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password}
              style={{ width: "100%", padding: "11px 0", background: loading ? C.accentDim : C.accent, border: "none", borderRadius: 10, color: "#0a0a0b", fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 800, cursor: loading ? "default" : "pointer", transition: "background 0.15s", opacity: (!email || !password) ? 0.5 : 1 }}>
              {loading ? "Please wait…" : view === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Benefits — shown on signup only */}
          {view === "signup" && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
              {BENEFITS.map(b => (
                <div key={b.text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: C.accent, width: 16, textAlign: "center", flexShrink: 0 }}>{b.icon}</span>
                  <span style={{ fontSize: 12, color: C.text2 }}>{b.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Continue offline */}
        <div style={{ textAlign: "center" }}>
          <button onClick={onOffline}
            style={{ background: "transparent", border: "none", color: C.text3, fontFamily: "Syne, sans-serif", fontSize: 12, cursor: "pointer", padding: "6px 12px", borderRadius: 8, transition: "color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.color = C.text2}
            onMouseLeave={e => e.currentTarget.style.color = C.text3}>
            Continue without account →
          </button>
        </div>
      </div>
    </div>
  );
}
