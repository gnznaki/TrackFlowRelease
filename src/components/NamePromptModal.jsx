import { useState, useEffect, useRef } from "react";

export default function NamePromptModal({ title, hint, placeholder, onConfirm, onCancel, theme }) {
  const [val, setVal] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Slight delay so the modal paint settles before focus
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  function handleConfirm() {
    const trimmed = val.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9100 }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r2, padding: 24, width: 340, boxShadow: "0 24px 80px rgba(0,0,0,0.6)", fontFamily: theme.font || "Syne" }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: hint ? 5 : 16 }}>{title}</div>
        {hint && <div style={{ fontSize: 12, color: theme.text3, marginBottom: 16 }}>{hint}</div>}
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") onCancel();
            e.stopPropagation();
          }}
          placeholder={placeholder || "Enter a name…"}
          style={{
            width: "100%",
            background: focused ? theme.surface3 : theme.surface2,
            border: `1px solid ${focused ? theme.accent + "66" : theme.border2}`,
            borderRadius: theme.r,
            padding: "11px 14px",
            color: theme.text,
            fontFamily: theme.font || "Syne",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
            boxShadow: focused ? `0 0 0 3px rgba(${theme.accentRgb},0.09)` : "none",
            transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
            marginBottom: 16,
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleConfirm}
            disabled={!val.trim()}
            style={{ flex: 1, padding: "10px 0", background: val.trim() ? theme.accent : theme.surface3, border: "none", borderRadius: theme.r, color: val.trim() ? theme.accentText : theme.text3, fontFamily: theme.font || "Syne", fontSize: 13, fontWeight: 700, cursor: val.trim() ? "pointer" : "not-allowed", transition: "background 0.15s, color 0.15s" }}
          >
            Create
          </button>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "10px 0", background: "transparent", border: `1px solid ${theme.border}`, borderRadius: theme.r, color: theme.text3, fontFamily: theme.font || "Syne", fontSize: 13, cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.border2; e.currentTarget.style.color = theme.text2; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.text3; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
