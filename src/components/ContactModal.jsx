import { useState } from "react";
import { postToDiscord } from "../lib/discord";

const TYPES = ["Bug Report", "Feature Request", "Question", "Other"];

const TYPE_COLORS = {
  "Bug Report":       0xff4444,
  "Feature Request":  0xc8ff47,
  "Question":         0x4780ff,
  "Other":            0x888888,
};

const TYPE_EMOJIS = {
  "Bug Report":       "🐛",
  "Feature Request":  "💡",
  "Question":         "❓",
  "Other":            "💬",
};

export default function ContactModal({ onClose, theme }) {
  const s = theme;
  const [type, setType] = useState("Bug Report");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | sending | success | error

  async function handleSubmit() {
    if (!message.trim()) return;
    setPhase("sending");
    const body = [
      email ? `**From:** ${email}` : "**From:** Anonymous",
      `**Type:** ${TYPE_EMOJIS[type]} ${type}`,
      `\n${message.trim()}`,
    ].join("\n");
    const ok = await postToDiscord(`${TYPE_EMOJIS[type]} ${type}`, body, TYPE_COLORS[type]);
    setPhase(ok ? "success" : "error");
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, fontFamily: s.font || "Syne", padding: 24 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "100%", maxWidth: 460, background: s.surface, border: `1px solid ${s.border2}`, borderRadius: s.r2, boxShadow: "0 32px 80px rgba(0,0,0,0.6)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.text, marginBottom: 3 }}>Contact Us</div>
            <div style={{ fontSize: 12, color: s.text3 }}>Bugs, ideas, questions — we read everything.</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: s.text3, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "2px 4px" }}>×</button>
        </div>

        {phase === "success" ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.text, marginBottom: 6 }}>Message sent</div>
            <div style={{ fontSize: 12, color: s.text3, marginBottom: 24 }}>Thanks for reaching out. We'll get back to you{email ? " at " + email : ""} soon.</div>
            <button onClick={onClose} style={{ padding: "9px 28px", background: s.accent, border: "none", borderRadius: s.r, color: s.accentText, fontFamily: "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              Close
            </button>
          </div>
        ) : (
          <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Type selector */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.text2, marginBottom: 8 }}>Type</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      padding: "6px 14px",
                      background: type === t ? s.accent : s.surface2,
                      border: `1px solid ${type === t ? s.accent : s.border}`,
                      borderRadius: s.r,
                      color: type === t ? s.accentText : s.text2,
                      fontFamily: "Syne",
                      fontSize: 12,
                      fontWeight: type === t ? 700 : 400,
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    {TYPE_EMOJIS[t]} {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.text2, marginBottom: 8 }}>Message <span style={{ color: "#ff5050" }}>*</span></div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={
                  type === "Bug Report" ? "Describe what happened and how to reproduce it…" :
                  type === "Feature Request" ? "What would you like to see added or changed?" :
                  type === "Question" ? "What would you like to know?" :
                  "What's on your mind?"
                }
                rows={5}
                style={{
                  width: "100%",
                  background: s.surface2,
                  border: `1px solid ${s.border}`,
                  borderRadius: s.r,
                  padding: "10px 12px",
                  color: s.text,
                  fontFamily: "Syne",
                  fontSize: 12,
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.6,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Email */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.text2, marginBottom: 8 }}>Your email <span style={{ color: s.text3 }}>(optional — for replies)</span></div>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                style={{
                  width: "100%",
                  background: s.surface2,
                  border: `1px solid ${s.border}`,
                  borderRadius: s.r,
                  padding: "9px 12px",
                  color: s.text,
                  fontFamily: "Syne",
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {phase === "error" && (
              <div style={{ fontSize: 12, color: "#ff5050" }}>Failed to send. Please try again.</div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || phase === "sending"}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  background: message.trim() ? s.accent : s.surface3,
                  border: "none",
                  borderRadius: s.r,
                  color: message.trim() ? s.accentText : s.text3,
                  fontFamily: "Syne",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: message.trim() ? "pointer" : "default",
                  transition: "all 0.15s",
                }}
              >
                {phase === "sending" ? "Sending…" : "Send Message"}
              </button>
              <button onClick={onClose} style={{ padding: "11px 20px", background: s.surface2, border: `1px solid ${s.border}`, borderRadius: s.r, color: s.text2, fontFamily: "Syne", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
