import { useState } from "react";
import { Icon } from "./Icon";

export default function TagManager({ allTags, onAddTag, onDeleteTag, onClose, theme, autoTagBpm, setAutoTagBpm, autoTagKey, setAutoTagKey }) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(theme.accent);

  const autoTagOptions = [
    { label: "BPM Tag", enabled: autoTagBpm, toggle: () => setAutoTagBpm(v => !v), example: "e.g. 128 BPM" },
    { label: "Key Tag", enabled: autoTagKey, toggle: () => setAutoTagKey(v => !v), example: "e.g. A minor" },
  ];
  const color = theme.accent;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r2, padding: 24, width: 380, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, color: theme.text }}>Manage Tags</div>

        {/* Auto Tags */}
        <div style={{ fontSize: 10, color: theme.text3, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Auto Tags</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {autoTagOptions.map(({ label, enabled, toggle, example }) => (
            <div key={label} onClick={toggle}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: theme.r, background: enabled ? color + "15" : theme.surface2, border: `1px solid ${enabled ? color + "50" : theme.border}`, cursor: "pointer", transition: "background 0.15s" }}>
              <div style={{ width: 32, height: 17, borderRadius: 9, background: enabled ? color : theme.surface3, border: `1px solid ${enabled ? color : theme.border2}`, position: "relative", transition: "background 0.15s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 3, left: enabled ? 16 : 3, width: 9, height: 9, borderRadius: "50%", background: enabled ? theme.accentText : theme.text3, transition: "left 0.15s" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: enabled ? color : theme.text2 }}>{label}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: theme.text3 }}>{example}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: theme.border, marginBottom: 16 }} />

        {/* Custom Tags */}
        <div style={{ fontSize: 10, color: theme.text3, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Custom Tags</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Tag name..."
            onKeyDown={e => { if (e.key === "Enter" && newLabel.trim()) { onAddTag({ label: newLabel.trim().toLowerCase(), color: newColor }); setNewLabel(""); } }}
            style={{ flex: 1, background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, padding: "8px 12px", color: theme.text, fontFamily: theme.font || "Syne", fontSize: 12, outline: "none" }} />
          <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 40, height: 36, border: "none", borderRadius: theme.r, cursor: "pointer", background: "transparent" }} />
          <button onClick={() => { if (newLabel.trim()) { onAddTag({ label: newLabel.trim().toLowerCase(), color: newColor }); setNewLabel(""); } }} style={{ padding: "8px 14px", background: theme.accent, border: "none", borderRadius: theme.r, color: theme.accentText, fontFamily: "Syne", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allTags.map(tag => (
            <div key={tag.label} style={{ display: "flex", alignItems: "center", gap: 6, background: tag.color + "22", borderRadius: 20, padding: "4px 10px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: tag.color }}>{tag.label}</span>
              {tag.label !== "favorite" && <span onClick={() => onDeleteTag(tag.label)} style={{ color: tag.color, opacity: 0.6, cursor: "pointer", fontSize: 13 }}>×</span>}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 24, width: "100%", padding: 10, background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, color: theme.text2, fontFamily: theme.font || "Syne", fontSize: 12, cursor: "pointer" }}>Done</button>
      </div>
    </div>
  );
}
