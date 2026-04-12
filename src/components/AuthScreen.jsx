import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { reportError } from "../lib/errorReporting";

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

// Defined at module level so it never remounts on parent re-renders
function ParticleCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const dots = Array.from({ length: 50 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.1 + 0.3,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      o: Math.random() * 0.22 + 0.04,
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0) d.x = canvas.width;
        else if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        else if (d.y > canvas.height) d.y = 0;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${C.accentRgb},${d.o})`;
        ctx.fill();

        for (let j = i + 1; j < dots.length; j++) {
          const dx = d.x - dots[j].x;
          const dy = d.y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = `rgba(${C.accentRgb},${0.035 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
    />
  );
}

function getStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong", "Very strong"];
const STRENGTH_COLOR = ["", "#ff5050", "#ffaa40", "#ffd700", "#3af0b0", C.accent];

function StrengthBar({ password }) {
  const s = getStrength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: -8, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: 2, borderRadius: 2,
            background: i <= s ? STRENGTH_COLOR[s] : "rgba(255,255,255,0.08)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
      <div style={{ fontSize: 10, color: STRENGTH_COLOR[s], textAlign: "right", letterSpacing: "0.04em" }}>
        {STRENGTH_LABEL[s]}
      </div>
    </div>
  );
}

function Field({ label, type: typeProp, value, onChange, placeholder, disabled, autoFocus, action }) {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const isPassword = typeProp === "password";
  const type = isPassword && show ? "text" : typeProp;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {label}
        </span>
        {action}
      </div>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            background: focused ? C.surface3 : C.surface2,
            border: `1px solid ${focused ? C.accent + "55" : C.border2}`,
            borderRadius: 10,
            padding: isPassword ? "12px 44px 12px 16px" : "12px 16px",
            color: C.text,
            fontFamily: "Syne, sans-serif",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
            opacity: disabled ? 0.5 : 1,
            boxShadow: focused ? `0 0 0 3px rgba(${C.accentRgb},0.09)` : "none",
            transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
          }}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow(v => !v)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: C.text3, cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.color = C.text2}
            onMouseLeave={e => e.currentTarget.style.color = C.text3}
          >
            {show ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SubmitBtn({ loading, disabled, children }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      style={{
        width: "100%",
        padding: "13px 0",
        background: loading || disabled ? `rgba(${C.accentRgb},0.25)` : C.accent,
        border: "none",
        borderRadius: 10,
        color: loading || disabled ? "rgba(0,0,0,0.35)" : "#08080a",
        fontFamily: "Syne, sans-serif",
        fontSize: 13,
        fontWeight: 800,
        cursor: loading || disabled ? "default" : "pointer",
        letterSpacing: "0.02em",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!loading && !disabled) e.currentTarget.style.filter = "brightness(1.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
    >
      {loading ? (
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(0,0,0,0.25)", borderTopColor: "rgba(0,0,0,0.6)", borderRadius: "50%", animation: "tf-spin 0.7s linear infinite" }} />
          {children}
        </span>
      ) : children}
    </button>
  );
}

function ErrorBanner({ error, onClose }) {
  const [sending, setSending] = useState(false);
  if (!error) return null;

  async function handleSendAndRefresh() {
    setSending(true);
    await reportError({ type: "auth_error", message: error });
    window.location.reload();
  }

  return (
    <div style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.18)", borderRadius: 8, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: C.error, lineHeight: 1.5 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span>{error}</span>
        <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: C.error, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0, opacity: 0.6 }}>×</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={handleSendAndRefresh} disabled={sending}
          style={{ flex: 1, padding: "5px 10px", background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 6, color: C.error, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
          {sending ? "Sending..." : "Send Report & Refresh"}
        </button>
        <button type="button" onClick={() => window.location.reload()}
          style={{ padding: "5px 10px", background: "transparent", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 6, color: C.error, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: 0.7 }}>
          Refresh
        </button>
      </div>
    </div>
  );
}

function mapError(msg) {
  if (!msg) return msg;
  if (msg.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("Email not confirmed")) return "Check your inbox — confirm your email before signing in.";
  if (msg.includes("User already registered")) return "An account with this email already exists. Try signing in.";
  if (msg.includes("Password should be at least")) return "Password must be at least 6 characters.";
  return msg;
}

function TrustRow() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
      {[
        { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, text: "Save across devices" },
        { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>, text: "Local-first storage" },
        { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>, text: "Auto-saved always" },
      ].map(({ icon, text }) => (
        <div key={text} style={{ display: "flex", alignItems: "center", gap: 5, color: C.text3, fontSize: 10 }}>
          {icon}<span>{text}</span>
        </div>
      ))}
    </div>
  );
}

const CARD_STYLE = {
  background: "rgba(17,17,21,0.88)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: `1px solid rgba(255,255,255,0.1)`,
  borderTop: `1px solid rgba(${C.accentRgb},0.25)`,
  borderRadius: 18,
  padding: "28px 28px 22px",
  boxShadow: `0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)`,
};

const OUTER_STYLE = {
  height: "100vh",
  background: C.bg,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Syne, sans-serif",
  padding: 24,
  position: "relative",
  overflow: "hidden",
};

const GLOBAL_STYLES = `
  @keyframes tf-spin { to { transform: rotate(360deg); } }
  @keyframes tf-slidein { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes tf-fadein { from { opacity: 0; } to { opacity: 1; } }
`;

export default function AuthScreen({ onOffline }) { return null; }

export function AuthScreenInner({ signIn, signUp, onOffline, resetPassword }) {
  const [view, setView] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const [verifyEmail, setVerifyEmail] = useState("");
  const [resendVerifyCooldown, setResendVerifyCooldown] = useState(0);
  const verifyRef = useRef(null);

  useEffect(() => () => {
    clearInterval(cooldownRef.current);
    clearInterval(verifyRef.current);
  }, []);

  function startCooldown(setter, ref, seconds = 60) {
    setter(seconds);
    clearInterval(ref.current);
    ref.current = setInterval(() => {
      setter(v => {
        if (v <= 1) { clearInterval(ref.current); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  function reset() { setEmail(""); setPassword(""); setUsername(""); setError(null); }
  function switchView(v) { reset(); setView(v); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (view === "signup") {
      const { data, error: err } = await signUp(email, password);
      if (err) { setLoading(false); setError(mapError(err.message)); return; }
      if (data?.user && username.trim() && supabase) {
        await supabase.from("profiles").update({ display_name: username.trim() }).eq("id", data.user.id);
      }
      setLoading(false);
      if (data?.user && !data.session) {
        setVerifyEmail(email);
        startCooldown(setResendVerifyCooldown, verifyRef);
        setView("verify");
        return;
      }
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
    startCooldown(setResendCooldown, cooldownRef);
  }

  async function handleResendReset() {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    const { error: err } = await resetPassword(forgotEmail);
    setLoading(false);
    if (!err) startCooldown(setResendCooldown, cooldownRef);
  }

  async function handleResendVerify() {
    if (resendVerifyCooldown > 0 || loading || !supabase) return;
    setLoading(true);
    await supabase.auth.resend({ type: "signup", email: verifyEmail });
    setLoading(false);
    startCooldown(setResendVerifyCooldown, verifyRef);
  }

  // ── Logo block (stable — no animation so no remount flicker) ──────────────
  const logo = (
    <div style={{ textAlign: "center", marginBottom: 28 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.5px" }}>
        Track<span style={{ color: C.accent }}>Flow</span>
      </div>
      <div style={{ fontSize: 10, color: C.text3, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Music Production Workspace
      </div>
    </div>
  );

  // ── Verify view ────────────────────────────────────────────────────────────
  if (view === "verify") {
    return (
      <div style={OUTER_STYLE}>
        <style>{GLOBAL_STYLES}</style>
        <ParticleCanvas />
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, background: `radial-gradient(circle, rgba(${C.accentRgb},0.035) 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />
        <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1, animation: "tf-slidein 0.3s ease" }}>
          {logo}
          <div style={CARD_STYLE}>
            <div style={{ textAlign: "center", padding: "6px 0 16px" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: `rgba(${C.accentRgb},0.1)`, border: `1px solid rgba(${C.accentRgb},0.25)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 8 }}>Verify your email</div>
              <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, marginBottom: 20 }}>
                Confirmation link sent to<br />
                <span style={{ color: C.accent, fontWeight: 700 }}>{verifyEmail}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={handleResendVerify} disabled={resendVerifyCooldown > 0 || loading}
                  style={{ padding: "11px 0", background: resendVerifyCooldown > 0 ? "transparent" : `rgba(${C.accentRgb},0.1)`, border: `1px solid ${resendVerifyCooldown > 0 ? C.border2 : `rgba(${C.accentRgb},0.25)`}`, borderRadius: 10, color: resendVerifyCooldown > 0 ? C.text3 : C.accent, fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: 700, cursor: resendVerifyCooldown > 0 ? "default" : "pointer", transition: "all 0.2s" }}>
                  {resendVerifyCooldown > 0 ? `Resend in ${resendVerifyCooldown}s` : "Resend confirmation email"}
                </button>
                <button onClick={() => switchView("signin")}
                  style={{ padding: "11px 0", background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 10, color: C.text2, fontFamily: "Syne, sans-serif", fontSize: 12, cursor: "pointer" }}>
                  Back to sign in
                </button>
              </div>
            </div>
            <TrustRow />
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password view ───────────────────────────────────────────────────
  if (view === "forgot") {
    return (
      <div style={OUTER_STYLE}>
        <style>{GLOBAL_STYLES}</style>
        <ParticleCanvas />
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, background: `radial-gradient(circle, rgba(${C.accentRgb},0.035) 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />
        <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1, animation: "tf-slidein 0.3s ease" }}>
          {logo}
          <div style={CARD_STYLE}>
            <button onClick={() => { switchView("signin"); setForgotSent(false); setResendCooldown(0); clearInterval(cooldownRef.current); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.text3, fontFamily: "Syne, sans-serif", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 20, transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = C.text2}
              onMouseLeave={e => e.currentTarget.style.color = C.text3}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back to sign in
            </button>

            {forgotSent ? (
              <div style={{ textAlign: "center", padding: "4px 0" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(58,240,176,0.1)", border: "1px solid rgba(58,240,176,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>Check your inbox</div>
                <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, marginBottom: 20 }}>
                  Reset link sent to<br />
                  <span style={{ color: C.accent, fontWeight: 700 }}>{forgotEmail}</span>
                </div>
                <button onClick={handleResendReset} disabled={resendCooldown > 0 || loading}
                  style={{ width: "100%", padding: "11px 0", background: resendCooldown > 0 ? "transparent" : `rgba(${C.accentRgb},0.1)`, border: `1px solid ${resendCooldown > 0 ? C.border2 : `rgba(${C.accentRgb},0.25)`}`, borderRadius: 10, color: resendCooldown > 0 ? C.text3 : C.accent, fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: 700, cursor: resendCooldown > 0 ? "default" : "pointer", transition: "all 0.2s" }}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : loading ? "Sending…" : "Resend reset link"}
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>Reset your password</div>
                <div style={{ fontSize: 12, color: C.text2, marginBottom: 20, lineHeight: 1.6 }}>
                  Enter your email and we'll send a secure reset link.
                </div>
                <form onSubmit={handleForgot}>
                  <Field label="Email" type="email" value={forgotEmail} onChange={setForgotEmail} placeholder="you@example.com" disabled={loading} autoFocus />
                  <ErrorBanner error={error} onClose={() => setError(null)} />
                  <SubmitBtn loading={loading} disabled={!forgotEmail}>Send Reset Link</SubmitBtn>
                </form>
              </>
            )}
            <TrustRow />
          </div>
        </div>
      </div>
    );
  }

  // ── Sign in / Sign up ──────────────────────────────────────────────────────
  return (
    <div style={OUTER_STYLE}>
      <style>{GLOBAL_STYLES}</style>
      <ParticleCanvas />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, background: `radial-gradient(circle, rgba(${C.accentRgb},0.035) 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1, animation: "tf-slidein 0.3s ease" }}>
        {logo}
        <div style={CARD_STYLE}>
          {/* Tab switcher */}
          <div style={{ display: "flex", background: C.surface2, borderRadius: 12, padding: 3, marginBottom: 24, gap: 3, border: `1px solid ${C.border}` }}>
            {[["signin", "Sign In"], ["signup", "Create Account"]].map(([key, label]) => (
              <button key={key} onClick={() => switchView(key)}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 9, border: "none",
                  background: view === key ? C.surface : "transparent",
                  color: view === key ? C.text : C.text3,
                  fontFamily: "Syne, sans-serif", fontSize: 12,
                  fontWeight: view === key ? 700 : 500,
                  cursor: "pointer", transition: "all 0.18s",
                  boxShadow: view === key ? "0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
                }}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {view === "signup" && (
              <Field label="Username" type="text" value={username} onChange={setUsername} placeholder="your-producer-name" disabled={loading} autoFocus />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" disabled={loading} autoFocus={view === "signin"} />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={view === "signup" ? "8+ characters" : "••••••••"}
              disabled={loading}
              action={view === "signin" && (
                <button type="button"
                  onClick={() => { setForgotEmail(email); setForgotSent(false); setError(null); setView("forgot"); }}
                  style={{ background: "transparent", border: "none", color: C.text3, fontFamily: "Syne, sans-serif", fontSize: 10, cursor: "pointer", padding: 0, letterSpacing: "0.04em", textTransform: "uppercase", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = C.accent}
                  onMouseLeave={e => e.currentTarget.style.color = C.text3}>
                  Forgot?
                </button>
              )}
            />
            {view === "signup" && <StrengthBar password={password} />}
            <ErrorBanner error={error} onClose={() => setError(null)} />
            <SubmitBtn loading={loading} disabled={!email || !password}>
              {loading ? "Please wait…" : view === "signin" ? "Sign In" : "Create Account"}
            </SubmitBtn>
          </form>

          <TrustRow />
        </div>
      </div>
    </div>
  );
}
