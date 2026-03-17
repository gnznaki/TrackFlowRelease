import { useState } from "react";
import { Icon } from "./Icon";

export default function TagManager({ allTags, onAddTag, onDeleteTag, onClose, theme }) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(theme.accent);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r2, padding: 24, width: 380, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, color: theme.text }}>Manage Tags</div>
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
