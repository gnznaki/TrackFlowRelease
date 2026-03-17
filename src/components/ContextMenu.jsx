import { useRef, useEffect } from "react";
import { Icon } from "./Icon";

export default function ContextMenu({ x, y, items, onClose, theme }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  const menuH = items.filter(i => i !== "divider").length * 36 + 8;
  const adjX = x + 210 > window.innerWidth ? x - 210 : x;
  const adjY = y + menuH > window.innerHeight ? y - menuH : y;
  return (
    <div ref={ref} style={{ position: "fixed", left: adjX, top: adjY, zIndex: 9999, background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: 200, padding: 4, fontFamily: theme.font || "Syne" }}>
      {items.map((item, i) => item === "divider" ? (
        <div key={i} style={{ height: 1, background: theme.border, margin: "4px 0" }} />
      ) : (
        <div key={i} onClick={() => { item.action(); if (!item.keepOpen) onClose(); }}
          style={{ padding: "8px 14px", borderRadius: theme.r - 2, cursor: "pointer", fontSize: 13, color: item.danger ? "#ff5050" : item.accent ? theme.accent : theme.text, display: "flex", alignItems: "center", gap: 10 }}
          onMouseEnter={e => e.currentTarget.style.background = theme.surface2}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          {item.icon && <Icon d={item.icon} size={13} style={{ flexShrink: 0 }} />}
          {item.label}
        </div>
      ))}
    </div>
  );
}
