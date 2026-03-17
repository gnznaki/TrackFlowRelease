import { useState } from "react";
import { buildTheme, BASE_PRESETS, FONTS, contrastText } from "../lib/theme";
import { Icon } from "./Icon";

export default function ThemeCustomizer({ themePreset, themeCustom, font, onApply, onClose, theme }) {
  const [preset, setPreset] = useState(themePreset);
  const [custom, setCustom] = useState(themeCustom);
  const [selFont, setSelFont] = useState(font);

  function pickPreset(key) {
    setPreset(key);
    setCustom(BASE_PRESETS[key]);
  }
  function setField(k, v) { setCustom(c => ({ ...c, [k]: v })); }

  const preview = buildTheme(custom.bg, custom.cardBg, custom.borderHex, custom.accent, selFont);

  const colorFields = [
    { key: "bg", label: "Background", desc: "App background" },
    { key: "cardBg", label: "Cards", desc: "Card surface color" },
    { key: "borderHex", label: "Borders", desc: "Border & divider tint" },
    { key: "accent", label: "Accent", desc: "Highlights & buttons" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r2, padding: 28, width: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: theme.text }}>Customize Theme</div>
        <div style={{ fontSize: 12, color: theme.text3, marginBottom: 20 }}>Pick colors — everything else auto-adjusts.</div>

        {/* Presets */}
        <div style={{ fontSize: 11, color: theme.text3, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Start from a preset</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22 }}>
          {Object.entries(BASE_PRESETS).map(([key, p]) => {
            const t = buildTheme(p.bg, p.cardBg, p.borderHex, p.accent, "Syne");
            return (
              <div key={key} onClick={() => pickPreset(key)}
                style={{ background: t.bg, border: `2px solid ${preset === key ? t.accent : t.border}`, borderRadius: t.r2, padding: 12, cursor: "pointer", transition: "border-color 0.15s" }}>
                <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
                  {[t.accent, "#ff6b47", "#47c8ff"].map((c, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{p.name}</div>
                {preset === key && <div style={{ fontSize: 10, color: t.accent, marginTop: 4, fontFamily: "monospace" }}>● selected</div>}
              </div>
            );
          })}
        </div>

        {/* Color pickers */}
        <div style={{ fontSize: 11, color: theme.text3, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Colors</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
          {colorFields.map(({ key, label, desc }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, background: theme.surface2, padding: "10px 14px", borderRadius: theme.r, border: `1px solid ${theme.border}` }}>
              <input type="color" value={custom[key] || "#888888"} onChange={e => { setField(key, e.target.value); setPreset("custom"); }} style={{ width: 36, height: 36, border: "none", borderRadius: 8, cursor: "pointer", background: "transparent", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 10, color: theme.text3 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Font */}
        <div style={{ fontSize: 11, color: theme.text3, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Font</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {FONTS.map(f => (
            <div key={f} onClick={() => setSelFont(f)}
              style={{ padding: "7px 14px", borderRadius: theme.r, border: `1px solid ${selFont === f ? theme.accent : theme.border}`, cursor: "pointer", fontSize: 13, color: selFont === f ? theme.accent : theme.text2, fontFamily: f, transition: "all 0.15s" }}>
              {f}
            </div>
          ))}
        </div>

        {/* Preview */}
        <div style={{ marginBottom: 22, background: preview.bg, border: `2px solid ${preview.border2}`, borderRadius: preview.r2, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: preview.text, marginBottom: 8, fontFamily: selFont }}>
            Track<span style={{ color: preview.accent }}>Flow</span> Preview
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ padding: "5px 12px", background: preview.accent, borderRadius: preview.r, fontSize: 12, fontWeight: 700, color: contrastText(preview.accent), fontFamily: selFont }}>Accent</div>
            <div style={{ padding: "5px 12px", background: preview.surface2, border: `1px solid ${preview.border}`, borderRadius: preview.r, fontSize: 12, color: preview.text2, fontFamily: selFont }}>Cards</div>
            <div style={{ padding: "5px 12px", background: preview.surface3, borderRadius: preview.r, fontSize: 12, color: preview.text3, fontFamily: selFont }}>Surface</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onApply(preset, custom, selFont)} style={{ flex: 1, padding: 11, background: theme.accent, border: "none", borderRadius: theme.r, color: theme.accentText, fontFamily: "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Apply</button>
          <button onClick={onClose} style={{ padding: "11px 20px", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, color: theme.text2, fontFamily: "Syne", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
