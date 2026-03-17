import { useState, useEffect } from "react";
import { Icon, Icons } from "./Icon";
import Tag from "./Tag";
import MiniPlayer from "./MiniPlayer";
import { DAW_COLORS, DAW_LABELS } from "../lib/constants";

export default function DetailPanel({ card, onUpdateNote, onUpdateTags, onOpenInDaw, allTags, theme }) {
  const [showTagPicker, setShowTagPicker] = useState(false);
  useEffect(() => { setShowTagPicker(false); }, [card?.id]);

  if (!card) return (
    <div style={{ width: 275, flexShrink: 0, borderLeft: `1px solid ${theme.border}`, background: theme.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: theme.text3, fontSize: 13, textAlign: "center", padding: 24 }}>Select a project<br />to see details</div>
    </div>
  );
  const dawColor = DAW_COLORS[card.daw] || theme.text2;
  const availableTags = allTags.filter(t => !(card.tags || []).includes(t.label));
  return (
    <div style={{ width: 275, flexShrink: 0, borderLeft: `1px solid ${theme.border}`, background: theme.surface, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 14px 12px", borderBottom: `1px solid ${theme.border}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: dawColor + "22", color: dawColor, display: "inline-block", marginBottom: 8 }}>{card.daw === "fl" ? "FL Studio" : card.daw === "ab" ? "Ableton Live" : "Pro Tools"}</span>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: theme.text }}>{card.title}</div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: theme.text3, wordBreak: "break-all", lineHeight: 1.5 }}>{card.path}</div>
      </div>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Preview</div>
        <MiniPlayer projectPath={card.path} theme={theme} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Notes</div>
        <textarea value={card.note} onChange={e => onUpdateNote(card.id, e.target.value)} placeholder="Add a note..." style={{ width: "100%", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, padding: "9px 11px", color: theme.text, fontFamily: theme.font || "Syne", fontSize: 12, resize: "none", outline: "none", lineHeight: 1.6, minHeight: 75 }} />
        <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3, textTransform: "uppercase", letterSpacing: "0.08em", margin: "12px 0 5px" }}>Tags</div>
        <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 7 }}>
          {(card.tags || []).map(t => { const td = allTags.find(x => x.label === t); return <Tag key={t} label={t} color={td?.color} theme={theme} onRemove={() => onUpdateTags(card.id, (card.tags || []).filter(x => x !== t))} />; })}
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowTagPicker(v => !v)} style={{ padding: "3px 9px", background: "transparent", border: `1px dashed ${theme.border2}`, borderRadius: 20, color: theme.text3, fontSize: 11, cursor: "pointer", fontFamily: theme.font || "Syne" }}>+ Add Tag</button>
          {showTagPicker && (
            <div style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 5, background: theme.surface2, border: `1px solid ${theme.border2}`, borderRadius: theme.r, padding: 9, zIndex: 100, minWidth: 170, maxHeight: 170, overflowY: "auto" }}>
              {availableTags.length === 0 && <div style={{ fontSize: 11, color: theme.text3 }}>No more tags</div>}
              {availableTags.map(tag => (
                <div key={tag.label} onClick={() => { onUpdateTags(card.id, [...(card.tags || []), tag.label]); setShowTagPicker(false); }} style={{ padding: "5px 7px", borderRadius: theme.r - 2, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }} onMouseEnter={e => e.currentTarget.style.background = theme.surface3} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: tag.color }} />
                  <span style={{ fontSize: 12, color: theme.text }}>{tag.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <button onClick={() => onOpenInDaw(card.path)} style={{ margin: "0 14px 14px", padding: 10, background: theme.accent, border: "none", borderRadius: theme.r, color: theme.accentText, fontFamily: "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <Icon d={Icons.open} size={13} />Open in {card.daw === "fl" ? "FL Studio" : card.daw === "ab" ? "Ableton" : "Pro Tools"}
      </button>
    </div>
  );
}
