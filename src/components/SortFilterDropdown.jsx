import { useState, useEffect, useRef } from "react";
import { Icon, Icons } from "./Icon";

export default function SortFilterDropdown({ sortBy, setSortBy, sortDir, setSortDir, allTags, activeTagFilters, setActiveTagFilters, theme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const activeCount = activeTagFilters.length;
  const sortLabels = { modified: "File Modified", opened: "Last Opened", default: "Default" };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: theme.surface2, border: `1px solid ${activeCount > 0 ? theme.accent + "60" : theme.border}`, borderRadius: theme.r, padding: "5px 10px", cursor: "pointer", userSelect: "none" }}>
        <Icon d={Icons.filter} size={12} style={{ color: activeCount > 0 ? theme.accent : theme.text3 }} />
        <span style={{ fontSize: 11, color: activeCount > 0 ? theme.accent : theme.text2, fontWeight: 600 }}>
          {sortLabels[sortBy]}{activeCount > 0 ? ` · ${activeCount} tag${activeCount > 1 ? "s" : ""}` : ""}
        </span>
        <Icon d={Icons.chevronDown} size={11} style={{ color: theme.text3 }} />
      </div>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: 240, zIndex: 500, padding: 8, fontFamily: theme.font || "Syne" }}>
          {/* Sort section */}
          <div style={{ fontSize: 10, color: theme.text3, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 8px 6px" }}>Sort By</div>
          {["modified", "opened", "default"].map(opt => (
            <div key={opt} onClick={() => setSortBy(opt)}
              style={{ padding: "7px 10px", borderRadius: theme.r - 2, cursor: "pointer", fontSize: 12, color: sortBy === opt ? theme.accent : theme.text, display: "flex", alignItems: "center", justifyContent: "space-between", background: sortBy === opt ? theme.accent + "15" : "transparent" }}
              onMouseEnter={e => e.currentTarget.style.background = sortBy === opt ? theme.accent + "15" : theme.surface2}
              onMouseLeave={e => e.currentTarget.style.background = sortBy === opt ? theme.accent + "15" : "transparent"}>
              {sortLabels[opt]}
              {sortBy === opt && <span style={{ fontSize: 10, color: theme.accent }}>●</span>}
            </div>
          ))}

          {/* Direction */}
          <div onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            style={{ padding: "7px 10px", borderRadius: theme.r - 2, cursor: "pointer", fontSize: 12, color: theme.text2, display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}
            onMouseEnter={e => e.currentTarget.style.background = theme.surface2}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Icon d={sortDir === "desc" ? Icons.chevronDown : Icons.chevronUp} size={12} />
            {sortDir === "desc" ? "Newest first" : "Oldest first"}
          </div>

          {/* Tag filter section */}
          {allTags.length > 0 && (
            <>
              <div style={{ height: 1, background: theme.border, margin: "8px 0" }} />
              <div style={{ fontSize: 10, color: theme.text3, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 8px 6px" }}>Filter by Tag</div>
              {allTags.map(tag => {
                const active = activeTagFilters.includes(tag.label);
                const c = tag.color || theme.text3;
                return (
                  <div key={tag.label}
                    onClick={() => setActiveTagFilters(prev => active ? prev.filter(t => t !== tag.label) : [...prev, tag.label])}
                    style={{ padding: "7px 10px", borderRadius: theme.r - 2, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 10, background: active ? c + "15" : "transparent" }}
                    onMouseEnter={e => e.currentTarget.style.background = active ? c + "15" : theme.surface2}
                    onMouseLeave={e => e.currentTarget.style.background = active ? c + "15" : "transparent"}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: active ? c : theme.text }}>{tag.label}</span>
                    {active && <span style={{ fontSize: 11, color: c }}>✓</span>}
                  </div>
                );
              })}
              {activeTagFilters.length > 0 && (
                <div onClick={() => setActiveTagFilters([])}
                  style={{ padding: "7px 10px", borderRadius: theme.r - 2, cursor: "pointer", fontSize: 12, color: theme.text3, marginTop: 2 }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  Clear all filters
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
