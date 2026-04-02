import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Icon, Icons } from "./Icon";

export default function SettingsPanel({ colMaxHeight, onSave, onClose, onShowShortcuts, onShowContact, theme }) {
  const [maxH, setMaxH] = useState(colMaxHeight);
  const [appVersion, setAppVersion] = useState(null);

  useEffect(() => { getVersion().then(setAppVersion).catch(() => {}); }, []);

  const s = theme;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: s.surface, border: `1px solid ${s.border2}`, borderRadius: s.r2, padding: 28, width: 480, maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: s.text }}>Settings</div>
          {appVersion && (
            <span style={{ fontSize: 10, fontFamily: "monospace", color: s.text3, background: s.surface3, padding: "2px 8px", borderRadius: 6 }}>
              v{appVersion}
            </span>
          )}
        </div>

        {/* Column height */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: s.text, marginBottom: 4 }}>Column Height</div>
          <div style={{ fontSize: 11, color: s.text3, marginBottom: 10 }}>Sets a fixed height for all columns so grid rows stay aligned.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="range" min={200} max={900} step={20} value={maxH} onChange={e => setMaxH(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: s.accent, fontFamily: "monospace", minWidth: 50 }}>{maxH}px</span>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: s.text, marginBottom: 4 }}>Keyboard Shortcuts</div>
          <div style={{ fontSize: 11, color: s.text3, marginBottom: 10 }}>View all hotkeys — duplicate, delete, rename, reload and more.</div>
          <button onClick={onShowShortcuts}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: s.surface2, border: `1px solid ${s.border2}`, borderRadius: s.r, color: s.text, fontFamily: "Syne", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <span style={{ fontSize: 16 }}>⌨</span> View Shortcuts
          </button>
        </div>

        {/* Contact Us */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: s.text, marginBottom: 4 }}>Support</div>
          <div style={{ fontSize: 11, color: s.text3, marginBottom: 10 }}>Report a bug, suggest a feature, or ask a question.</div>
          <button onClick={onShowContact}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: s.surface2, border: `1px solid ${s.border2}`, borderRadius: s.r, color: s.text, fontFamily: "Syne", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <span style={{ fontSize: 15 }}>✉</span> Contact Us
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onSave(maxH)} style={{ flex: 1, padding: 11, background: s.accent, border: "none", borderRadius: s.r, color: s.accentText, fontFamily: "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Save</button>
          <button onClick={onClose} style={{ padding: "11px 20px", background: s.surface2, border: `1px solid ${s.border}`, borderRadius: s.r, color: s.text2, fontFamily: "Syne", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
