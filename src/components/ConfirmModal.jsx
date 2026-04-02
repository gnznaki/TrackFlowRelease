/**
 * Custom confirm dialog — replaces window.confirm() throughout the app.
 * Renders as a centred overlay modal with Cancel + Confirm buttons.
 *
 * Props:
 *   title        — bold heading
 *   message      — body text (optional)
 *   confirmLabel — text on the confirm button (default "Confirm")
 *   destructive  — if true, confirm button is red (default false)
 *   onConfirm    — called when user clicks confirm
 *   onCancel     — called when user clicks cancel or backdrop
 *   theme        — app theme object
 */
export default function ConfirmModal({ title, message, confirmLabel = "Confirm", destructive = false, onConfirm, onCancel, theme }) {
  const C = theme;
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20000, fontFamily: C.font || "Syne" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ width: 360, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: C.r2, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{title}</div>
          {message && <div style={{ fontSize: 12, color: C.text3, marginTop: 5, lineHeight: 1.55 }}>{message}</div>}
        </div>
        <div style={{ padding: "14px 20px 18px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${C.border2}`, borderRadius: C.r, color: C.text2, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: "8px 18px", background: destructive ? "rgba(255,77,77,0.15)" : `rgba(${C.accentRgb},0.15)`, border: `1px solid ${destructive ? "rgba(255,77,77,0.5)" : C.accent}`, borderRadius: C.r, color: destructive ? "#ff4d4d" : C.accent, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
