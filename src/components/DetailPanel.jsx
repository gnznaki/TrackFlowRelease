import { useState, useEffect, useRef, useCallback } from "react";
import { Icon, Icons } from "./Icon";
import Tag from "./Tag";
import { DAW_COLORS, DAW_LABELS, DAW_NAMES } from "../lib/constants";

const MIN_WIDTH = 200;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 275;

function ResizeHandle({ onDragStart, onResize, theme }) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    onDragStart();
    const startX = e.clientX;

    function onMouseMove(e) {
      onResize(startX - e.clientX);
    }
    function onMouseUp() {
      setDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [onDragStart, onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 5,
        cursor: "col-resize",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{
        width: 2,
        height: "100%",
        background: dragging
          ? theme.accent
          : hovered
            ? `rgba(255,255,255,0.15)`
            : "transparent",
        transition: dragging ? "none" : "background 0.15s",
      }} />
    </div>
  );
}

export default function DetailPanel({ card, onUpdateNote, onUpdateTags, onOpenInDaw, allTags, theme, isViewer, autoTagBpm, autoTagKey }) {
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const startWidthRef = useRef(DEFAULT_WIDTH);
  useEffect(() => { setShowTagPicker(false); }, [card?.id]);

  function handleResize(deltaX) {
    setWidth(w => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + deltaX)));
  }

  const panelStyle = {
    width,
    flexShrink: 0,
    borderLeft: `1px solid ${theme.border}`,
    background: theme.surface,
    position: "relative",
  };

  if (!card) return (
    <div style={{ ...panelStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <ResizeHandle onDragStart={() => { startWidthRef.current = width; }} onResize={handleResize} theme={theme} />
      <div style={{ color: theme.text3, fontSize: 13, textAlign: "center", padding: 24 }}>Select a project<br />to see details</div>
    </div>
  );

  const dawColor = DAW_COLORS[card.daw] || theme.text2;
  const availableTags = allTags.filter(t => !(card.tags || []).includes(t.label));

  return (
    <div style={{ ...panelStyle, display: "flex", flexDirection: "column" }}>
      <ResizeHandle
        onDragStart={() => { startWidthRef.current = width; }}
        onResize={handleResize}
        theme={theme}
      />
      <div style={{ padding: "14px 14px 12px", borderBottom: `1px solid ${theme.border}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: dawColor + "22", color: dawColor, display: "inline-block", marginBottom: 8 }}>{DAW_NAMES[card.daw] || "Unknown DAW"}</span>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: theme.text }}>{card.title}</div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: theme.text3, wordBreak: "break-all", lineHeight: 1.5 }}>{card.path}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Notes</div>
        <textarea
          value={card.note}
          onChange={e => !isViewer && onUpdateNote(card.id, e.target.value)}
          readOnly={isViewer}
          placeholder={isViewer ? "View only" : "Add a note..."}
          style={{ width: "100%", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, padding: "9px 11px", color: isViewer ? theme.text3 : theme.text, fontFamily: theme.font || "Syne", fontSize: 12, resize: "none", outline: "none", lineHeight: 1.6, minHeight: 75, cursor: isViewer ? "default" : "text", boxSizing: "border-box" }}
        />
        <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3, textTransform: "uppercase", letterSpacing: "0.08em", margin: "12px 0 5px" }}>Tags</div>
        <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 7 }}>
          {(card.tags || []).map(t => {
            const td = allTags.find(x => x.label === t);
            return <Tag key={t} label={t} color={td?.color} theme={theme} onRemove={isViewer ? null : () => onUpdateTags(card.id, (card.tags || []).filter(x => x !== t))} />;
          })}
          {autoTagBpm && card.bpm != null && <Tag label={`${card.bpm} BPM`} color={theme.accent} theme={theme} />}
          {autoTagKey && card.key && <Tag label={card.key} color={theme.accent} theme={theme} />}
        </div>
        {!isViewer && (
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
        )}
      </div>
      <button onClick={() => onOpenInDaw(card.path)} style={{ margin: "0 14px 14px", padding: 10, background: theme.accent, border: "none", borderRadius: theme.r, color: theme.accentText, fontFamily: "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <Icon d={Icons.open} size={13} />Open in {DAW_NAMES[card.daw] || "DAW"}
      </button>
    </div>
  );
}
