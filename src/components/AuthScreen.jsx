import { useState } from "react";
import { supabase } from "../lib/supabase";

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

function mapError(msg) {
  if (!msg) return msg;
  if (msg.includes("Invalid login credentials")) return "Incorrect email or password. Try resetting your password below.";
  if (msg.includes("Email not confirmed")) return "Please check your email and click the confirmation link before signing in.";
  if (msg.includes("User already registered")) return "An account with this email already exists. Try signing in.";
  return msg;
}

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
          border: `1px solid ${focused ? C.accent + "80" : C.border2}`,
          borderRadius: 10,
          padding: "12px 16px",
          color: C.text,
          fontFamily: "Syne, sans-serif",
          fontSize: 13,
          outline: "none",
          transition: "border-color 0.15s",
          boxSizing: "border-box",
          opacity: disabled ? 0.5 : 1,
          boxShadow: focused ? `0 0 0 3px ${C.accent}20` : "none",
        }}
      />
    </div>
  );
}

export default function AuthScreen({ onOffline }) {
  return null;
}

export function AuthScreenInner({ signIn, signUp, onOffline, resetPassword }) {
  const [view, setView] = useState("signin"); // "signin" | "signup" | "verify" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  function reset() { setEmail(""); setPassword(""); setUsername(""); setError(null); }

  function switchView(v) { reset(); setView(v); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (view === "signup") {
      const { data, error: err } = await signUp(email, password);
      if (err) { setLoading(false); setError(mapError(err.message)); return; }
      // Update display_name in profiles table if supabase is available
      if (data?.user && username.trim() && supabase) {
        await supabase.from("profiles").update({ display_name: username.trim() }).eq("id", data.user.id);
      }
      setLoading(false);
      if (data?.user && !data.session) { setView("verify"); return; }
    } else {
      const { error: err } = await signIn(email, password);
      setLoading(false);
      if (err) { setError(mapError(err.message)); return; }
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await resetPassword(forgotEmail);
    setLoading(false);
    if (err) { setError(mapError(err.message)); return; }
    setForgotSent(true);
  }

  const cardStyle = {
    background: C.surface,
    border: `1px solid ${C.border2}`,
    borderTop: `2px solid ${C.accent}`,
    borderRadius: 20,
    padding: 32,
    marginBottom: 16,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.5)",
  };

  if (view === "verify") {
    return (
      <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.5px", marginBottom: 6 }}>
            Track<span style={{ color: C.accent }}>Flow</span>
          </div>
          <div style={{ fontSize: 12, color: C.text3, marginBottom: 32 }}>The music production workspace</div>
          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>✉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>Check your inbox</div>
            <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, marginBottom: 24 }}>
              We sent a confirmation link to <span style={{ color: C.accent }}>{email}</span>.<br />
              Click it to activate your account and sign in.
            </div>
            <button onClick={() => switchView("signin")} style={{ padding: "10px 28px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 10, color: C.text2, fontFamily: "Syne, sans-serif", fontSize: 13, cursor: "pointer" }}>
              Back to sign in
            </button>
          </div>
        </div>
        <button onClick={onOffline}
          style={{ background: "transparent", border: "none", color: C.text3, fontFamily: "Syne, sans-serif", fontSize: 12, cursor: "pointer", padding: "6px 12px", borderRadius: 8, transition: "color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = C.text2}
          onMouseLeave={e => e.currentTarget.style.color = C.text3}>
          Continue without account →
        </button>
      </div>
    );
  }

  if (view === "forgot") {
    return (
      <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.5px", marginBottom: 6 }}>
              Track<span style={{ color: C.accent }}>Flow</span>
            </div>
            <div style={{ fontSize: 12, color: C.text3 }}>The music production workspace</div>
          </div>

          <div style={cardStyle}>
            <button onClick={() => switchView("signin")} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.text3, fontFamily: "Syne, sans-serif", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 20 }}
              onMouseEnter={e => e.currentTarget.style.color = C.text2}
              onMouseLeave={e => e.currentTarget.style.color = C.text3}>
              ← Back to sign in
            </button>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>Reset your password</div>
            <div style={{ fontSize: 12, color: C.text2, marginBottom: 20, lineHeight: 1.6 }}>
              Enter your email and we'll send you a reset link.
            </div>

            {forgotSent ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.success, marginBottom: 8 }}>Check your inbox</div>
                <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6 }}>
                  We sent a reset link to <span style={{ color: C.accent }}>{forgotEmail}</span>.
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgot}>
                <Field label="Email" type="email" value={forgotEmail} onChange={setForgotEmail} placeholder="you@example.com" disabled={loading} />
                {error && (
                  <div style={{ background: C.errorDim, border: `1px solid ${C.error}30`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: C.error, lineHeight: 1.5, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} style={{ background: "transparent", border: "none", color: C.error, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
                  </div>
                )}
                <button type="submit" disabled={loading || !forgotEmail}
                  style={{ width: "100%", padding: "12px 0", background: loading ? C.accentDim : C.accent, border: "none", borderRadius: 10, color: "#0a0a0b", fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 800, cursor: loading || !forgotEmail ? "default" : "pointer", transition: "filter 0.15s", opacity: !forgotEmail ? 0.5 : 1 }}
                  onMouseEnter={e => { if (!loading && forgotEmail) e.currentTarget.style.filter = "brightness(1.1)"; }}
                  onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
                  {loading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>

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

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.5px", marginBottom: 6 }}>
            Track<span style={{ color: C.accent }}>Flow</span>
          </div>
          <div style={{ fontSize: 12, color: C.text3 }}>The music production workspace</div>
        </div>

        {/* Card */}
        <div style={cardStyle}>

          {/* Pill tab switcher */}
          <div style={{ display: "flex", background: C.surface2, borderRadius: 50, padding: 4, marginBottom: 24, gap: 4 }}>
            {[["signin", "Sign In"], ["signup", "Create Account"]].map(([key, label]) => (
              <button key={key} onClick={() => switchView(key)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 50,
                  border: "none",
                  background: view === key ? C.accent : "transparent",
                  color: view === key ? "#0a0a0b" : C.text2,
                  fontFamily: "Syne, sans-serif",
                  fontSize: 12,
                  fontWeight: view === key ? 800 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {view === "signup" && (
              <Field label="Username" type="text" value={username} onChange={setUsername} placeholder="your-producer-name" disabled={loading} />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" disabled={loading} />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder={view === "signup" ? "8+ characters" : "••••••••"} disabled={loading} />

            {error && (
              <div style={{ background: C.errorDim, border: `1px solid ${C.error}30`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: C.error, lineHeight: 1.5, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} style={{ background: "transparent", border: "none", color: C.error, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password}
              style={{ width: "100%", padding: "12px 0", background: loading ? C.accentDim : C.accent, border: "none", borderRadius: 10, color: "#0a0a0b", fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 800, cursor: loading ? "default" : "pointer", transition: "filter 0.15s", opacity: (!email || !password) ? 0.5 : 1 }}
              onMouseEnter={e => { if (!loading && email && password) e.currentTarget.style.filter = "brightness(1.1)"; }}
              onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
              {loading ? "Please wait…" : view === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Forgot password — signin only */}
          {view === "signin" && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button type="button" onClick={() => { setForgotEmail(email); setForgotSent(false); setError(null); setView("forgot"); }}
                style={{ background: "transparent", border: "none", color: C.text3, fontFamily: "Syne, sans-serif", fontSize: 11, cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = C.text2}
                onMouseLeave={e => e.currentTarget.style.color = C.text3}>
                Forgot password?
              </button>
            </div>
          )}

          {/* Benefits — shown on signup only */}
          {view === "signup" && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
              {[
                { icon: "⟳", text: "Sync boards across devices" },
                { icon: "◈", text: "Save themes to your profile" },
                { icon: "⇌", text: "Collaborate on boards" },
              ].map(b => (
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
