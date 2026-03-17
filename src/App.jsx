import { saveState, loadState, backupState } from "./storage";
import { useState, useEffect, useRef, useCallback, Component } from "react";
import { scanForProjects, pickAndScanFolder } from "./scanner";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  DragOverlay, useDroppable, rectIntersection, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  horizontalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import "./App.css";

// ── DISCORD ───────────────────────────────────────────────────────────────────
let _webhookUrl = "";
export function setWebhookUrl(url) { _webhookUrl = url; }
async function postToDiscord(url, title, message, color = 0xff4444) {
  if (!url) return false;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [{ title, color, description: message.substring(0, 2000), footer: { text: `TrackFlow v1.2.0 · ${new Date().toLocaleString()}` } }] }) });
    return true;
  } catch (e) { return false; }
}

// ── ERROR BOUNDARY ────────────────────────────────────────────────────────────
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, sending: false, sent: false }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("TrackFlow crash:", error, info); }
  async sendError() {
    if (!_webhookUrl) { alert("No Discord webhook. Add one in Settings (⚙)."); return; }
    this.setState({ sending: true });
    const ok = await postToDiscord(_webhookUrl, "🔴 TrackFlow Crash", `**Error:** ${this.state.error?.message}\n\`\`\`${(this.state.error?.stack || "").substring(0, 1500)}\`\`\``);
    this.setState({ sending: false, sent: ok });
    if (!ok) alert("Send failed. Check your webhook URL in Settings.");
  }
  render() {
    if (this.state.hasError) return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0b", color: "#f0f0f0", fontFamily: "Syne, sans-serif", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 24, maxWidth: 400, lineHeight: 1.6 }}>Your data is safe. Reload to continue or send the error so it can be fixed.</div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555", background: "#111", padding: "10px 16px", borderRadius: 8, marginBottom: 24, maxWidth: 500, wordBreak: "break-all" }}>{this.state.error?.message || "Unknown"}</div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", background: "#c8ff47", border: "none", borderRadius: 10, color: "#0a0a0b", fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Reload</button>
          <button onClick={() => this.sendError()} disabled={this.state.sending || this.state.sent} style={{ padding: "10px 24px", background: this.state.sent ? "#3af0b0" : "#18181d", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: this.state.sent ? "#0a0a0b" : "#f0f0f0", fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            {this.state.sending ? "Sending..." : this.state.sent ? "✓ Sent" : "Send Error Report"}
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ── ICONS ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 14, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}><path d={d} /></svg>
);
const Icons = {
  producer: "M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z",
  engineer: "M12 5v14M5 12h14",
  folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  scan: "M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15",
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z",
  theme: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 2v20M2 12h20",
  search: "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  close: "M18 6L6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  drag: "M9 4h2v2H9zM13 4h2v2h-2zM9 8h2v2H9zM13 8h2v2h-2zM9 12h2v2H9zM13 12h2v2h-2z",
  open: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3",
  album: "M9 18V5l12-3v13M6 21a3 3 0 100-6 3 3 0 000 6zM18 18a3 3 0 100-6 3 3 0 000 6z",
  chevronUp: "M18 15l-6-6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  play: "M5 3l14 9-14 9V3z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
  backup: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06-.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  lock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  unlock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 019.9-1",
  copy: "M20 9H11a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
  trash: "M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2",
  drop: "M12 2v14M5 9l7 7 7-7",
  rowDown: "M12 19l-7-7h14l-7 7zM5 5h14",
  rowUp: "M12 5l7 7H5l7-7zM5 19h14",
  update: "M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  collapse: "M4 14h16M4 10h16",
};

// ── COLOR UTILITIES ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}
function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex.startsWith("#") ? hex : "#888888");
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function contrastText(hex) {
  const lum = getLuminance(hex.startsWith("#") ? hex : "#888888");
  return lum > 0.62 ? "#0a0a0b" : "#f0f0f0";
}
function shiftHex(hex, amt) {
  const { r, g, b } = hexToRgb(hex.startsWith("#") ? hex : "#888888");
  const clamp = v => Math.min(255, Math.max(0, Math.round(v + amt * 255)));
  return `#${[clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex.startsWith("#") ? hex : "#888888");
  return `rgba(${r},${g},${b},${alpha})`;
}

// Auto-derive all theme colors from 4 user choices + font
function buildTheme(bg, cardBg, borderHex, accent, font) {
  const isDark = getLuminance(bg) < 0.5;
  const shift = isDark ? 0.04 : -0.03;
  const { r: ar, g: ag, b: ab } = hexToRgb(accent.startsWith("#") ? accent : "#c8ff47");
  return {
    name: "Custom", sub: "User defined",
    bg,
    surface: shiftHex(bg, shift),
    surface2: cardBg,
    surface3: shiftHex(cardBg, isDark ? 0.05 : -0.04),
    border: withAlpha(borderHex, isDark ? 0.18 : 0.14),
    border2: withAlpha(borderHex, isDark ? 0.3 : 0.24),
    text: isDark ? "#f0f0f0" : "#1a1a1a",
    text2: isDark ? "#888888" : "#666666",
    text3: isDark ? "#555555" : "#999999",
    accent,
    accentText: contrastText(accent),
    accentRgb: `${ar},${ag},${ab}`,
    glow: `rgba(${ar},${ag},${ab},0.03)`,
    glow2: "rgba(71,200,255,0.02)",
    r: 10, r2: 14, font: font || "Syne",
  };
}

// ── BASE PRESETS ──────────────────────────────────────────────────────────────
const BASE_PRESETS = {
  default: { name: "Default", bg: "#0a0a0b", cardBg: "#18181d", borderHex: "#ffffff", accent: "#c8ff47" },
  daves:   { name: "Dave's",  bg: "#15120a", cardBg: "#252015", borderHex: "#aa9137", accent: "#52b23e" },
  tabkiller: { name: "TabKiller", bg: "#f4f4fc", cardBg: "#eeeeff", borderHex: "#5037c8", accent: "#e8197e" },
  findanote: { name: "FindANote", bg: "#060d1c", cardBg: "#0d1c32", borderHex: "#00afd2", accent: "#00b8d4" },
};

// Keep options few but visually distinct (display / grotesk / serif / mono)
const FONTS = ["Syne", "Space Grotesk", "Cormorant Garamond", "JetBrains Mono"];
const FONT_WEIGHTS = { "Syne": "400;600;700;800", "Space Grotesk": "400;500;600;700", "Cormorant Garamond": "400;500;600;700", "JetBrains Mono": "400;500;700" };

const PRODUCER_COLUMNS = [
  { id: "p-ideas", title: "Raw Ideas", color: "#888", cards: [] },
  { id: "p-potential", title: "Has Potential", color: "#47c8ff", cards: [] },
  { id: "p-arrange", title: "In Arrangement", color: "#b847ff", cards: [] },
  { id: "p-completed", title: "Completed Beats", color: "#c8ff47", cards: [] },
];
const ENGINEER_COLUMNS = [
  { id: "e-tracking", title: "Tracking", color: "#888", cards: [] },
  { id: "e-editing", title: "Editing", color: "#47c8ff", cards: [] },
  { id: "e-mixing", title: "Needs Mixing", color: "#ff6b47", cards: [] },
  { id: "e-mastering", title: "Mastering", color: "#b847ff", cards: [] },
  { id: "e-delivered", title: "Delivered", color: "#c8ff47", cards: [] },
];
const DEFAULT_TAGS = [{ label: "favorite", color: "#c8ff47" }];
const DAW_LABELS = { fl: "FLS", ab: "ABL", pt: "PT" };
const DAW_COLORS = { fl: "#ff8c00", ab: "#3af0b0", pt: "#6a8eff" };
const DEFAULT_COL_HEIGHT = 500;

function migrateState(saved) {
  if (!saved) return null;
  const themeMap = { dark: "default", slate: "tabkiller", warm: "daves", cyber: "findanote" };
  let themePreset = saved.themePreset || (themeMap[saved.themeKey] || "default");
  const pCols = saved.producerCols || PRODUCER_COLUMNS;
  const eCols = saved.engineerCols || ENGINEER_COLUMNS;
  return {
    mode: saved.mode || "producer",
    producerCols: pCols,
    engineerCols: eCols,
    producerLayout: saved.producerLayout || [pCols.map(c => c.id)],
    engineerLayout: saved.engineerLayout || [eCols.map(c => c.id)],
    projects: saved.projects || [],
    watchedFolders: saved.watchedFolders || [],
    customTags: saved.customTags || DEFAULT_TAGS,
    themePreset,
    themeCustom: saved.themeCustom || BASE_PRESETS[themePreset] || BASE_PRESETS.default,
    font: saved.font || "Syne",
    colMaxHeight: saved.colMaxHeight || DEFAULT_COL_HEIGHT,
    discordWebhook: saved.discordWebhook || "",
    collapsedCols: saved.collapsedCols || [],
    lockedCols: saved.lockedCols || [],
  };
}

async function findAudioPreview(projectPath) {
  try {
    const folder = projectPath.substring(0, projectPath.lastIndexOf("\\"));
    const entries = await readDir(folder);
    for (const entry of entries) {
      const ext = entry.name.toLowerCase().substring(entry.name.lastIndexOf("."));
      if ([".wav", ".mp3", ".ogg", ".flac"].includes(ext))
        return "asset://" + (folder + "\\" + entry.name).replace(/\\/g, "/");
    }
  } catch (e) {}
  return null;
}

// ── TAG COMPONENT ─────────────────────────────────────────────────────────────
function Tag({ label, color, onRemove, theme }) {
  const c = color || theme.text3;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: c + "22", color: c, marginRight: 4, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {label}
      {onRemove && <span onClick={e => { e.stopPropagation(); onRemove(); }} style={{ cursor: "pointer", opacity: 0.5, fontSize: 11 }}>×</span>}
    </span>
  );
}

// ── CONTEXT MENU ──────────────────────────────────────────────────────────────
function ContextMenu({ x, y, items, onClose, theme }) {
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

// ── SORT + FILTER DROPDOWN ────────────────────────────────────────────────────
function SortFilterDropdown({ sortBy, setSortBy, sortDir, setSortDir, allTags, activeTagFilters, setActiveTagFilters, theme }) {
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

// ── MINI PLAYER ───────────────────────────────────────────────────────────────
function MiniPlayer({ projectPath, theme }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef(null);
  useEffect(() => {
    setLoading(true); setPlaying(false); setProgress(0);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    findAudioPreview(projectPath).then(url => { setAudioUrl(url); setLoading(false); });
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, [projectPath]);
  function togglePlay(e) {
    e.stopPropagation();
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.ontimeupdate = () => setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }
  if (loading) return null;
  if (!audioUrl) return <div style={{ fontSize: 10, color: theme.text3, fontFamily: "monospace", marginTop: 8 }}>no audio preview</div>;
  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={togglePlay} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: playing ? theme.accent : theme.surface3, color: playing ? "#0a0a0b" : theme.text2, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        <Icon d={playing ? Icons.pause : Icons.play} size={10} />
      </button>
      <div onClick={e => { e.stopPropagation(); if (!audioRef.current) return; const rect = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current.duration; }}
        style={{ flex: 1, height: 4, background: theme.surface3, borderRadius: 4, cursor: "pointer" }}>
        <div style={{ width: progress + "%", height: "100%", background: theme.accent, borderRadius: 4, transition: "width 0.1s" }} />
      </div>
    </div>
  );
}

// ── CARD CONTENT ──────────────────────────────────────────────────────────────
function CardContent({ card, isSelected, onDelete, isDragging, allTags, theme }) {
  const dawColor = DAW_COLORS[card.daw] || theme.text2;
  return (
    <div style={{ background: isDragging ? theme.surface3 : theme.surface2, border: `1px solid ${isSelected ? theme.accent + "80" : theme.border}`, borderRadius: theme.r, padding: "12px 13px", borderLeft: `3px solid ${dawColor}`, outline: isSelected ? `2px solid ${theme.accent}40` : "none", opacity: isDragging ? 0.9 : 1, boxShadow: isDragging ? "0 12px 40px rgba(0,0,0,0.5)" : "none", position: "relative", transition: "box-shadow 0.2s" }}>
      {onDelete && <div onClick={e => { e.stopPropagation(); onDelete(card.id); }} style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.text3 }} onMouseEnter={e => e.currentTarget.style.color = "#ff5050"} onMouseLeave={e => e.currentTarget.style.color = theme.text3}><Icon d={Icons.close} size={11} /></div>}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, paddingRight: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, flex: 1, color: theme.text }}>{card.title}</div>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: dawColor + "22", color: dawColor, fontFamily: "monospace", flexShrink: 0 }}>{DAW_LABELS[card.daw] || "?"}</span>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: theme.text3, marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.path}</div>
      <div style={{ flexWrap: "wrap", display: "flex", marginBottom: card.note ? 7 : 0 }}>
        {(card.tags || []).map(t => { const td = allTags?.find(x => x.label === t); return <Tag key={t} label={t} color={td?.color} theme={theme} />; })}
      </div>
      {card.note && <div style={{ fontSize: 11, color: theme.text2, background: theme.surface3, borderRadius: theme.r - 2, padding: "5px 8px", borderLeft: `2px solid ${theme.border2}`, marginBottom: 7 }}>{card.note}</div>}
      <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3 }}>{card.date}</div>
    </div>
  );
}

// ── SORTABLE CARD ─────────────────────────────────────────────────────────────
function SortableCard({ card, isSelected, onClick, onDelete, allTags, theme, isLocked }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { type: "card" }, disabled: isLocked });
  return (
    <div ref={setNodeRef} {...attributes} {...(isLocked ? {} : listeners)} onClick={onClick}
      style={{ transform: CSS.Transform.toString(transform), transition, marginBottom: 8, opacity: isDragging ? 0 : 1, cursor: isLocked ? "default" : (isDragging ? "grabbing" : "grab"), touchAction: "none", userSelect: "none" }}>
      <CardContent card={card} isSelected={isSelected} onDelete={onDelete} allTags={allTags} theme={theme} />
    </div>
  );
}

// ── CARD DROP ZONE ────────────────────────────────────────────────────────────
function CardDropZone({ colId, children, theme, isCardDrag, colMaxHeight }) {
  const { setNodeRef, isOver } = useDroppable({ id: "zone-" + colId, disabled: !isCardDrag });
  return (
    <div ref={setNodeRef} style={{ padding: 12, height: colMaxHeight, overflowY: "auto", background: isOver && isCardDrag ? `rgba(${theme.accentRgb},0.07)` : "transparent", borderRadius: theme.r, transition: "background 0.15s" }}>
      {children}
    </div>
  );
}

// ── SORTABLE COLUMN ───────────────────────────────────────────────────────────
function SortableColumn({ col, selectedCard, onSelectCard, onAddCard, onDeleteCard, onRenameCol, onDeleteCol, onDuplicateCol, onChangeColor, onToggleCollapse, onToggleLock, onClearCol, onMoveRowUp, onMoveRowDown, onMoveToNewRow, allTags, sortBy, sortDir, activeFilters, theme, isCardDrag, isCollapsed, isLocked, colMaxHeight, canMoveUp, canMoveDown }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id, data: { type: "column" } });
  const [contextMenu, setContextMenu] = useState(null);
  const [colorPicker, setColorPicker] = useState({ open: false, value: col.color, x: 120, y: 120 });
  const dragRef = useRef({ dragging: false, ox: 0, oy: 0 });

  useEffect(() => {
    // Keep picker value in sync when column color changes externally
    setColorPicker(p => (p.open ? p : { ...p, value: col.color }));
  }, [col.color]);

  function openColorPicker() {
    setColorPicker(p => ({ ...p, open: true, value: col.color }));
  }

  function closeColorPicker() {
    setColorPicker(p => ({ ...p, open: false }));
  }

  function applyColorPicker() {
    onChangeColor(col.id, colorPicker.value);
    closeColorPicker();
  }

  function onPickerMouseDown(e) {
    // drag only from header area
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { dragging: true, ox: e.clientX - rect.left, oy: e.clientY - rect.top };
    e.preventDefault();
    e.stopPropagation();
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.dragging) return;
      setColorPicker(p => ({
        ...p,
        x: Math.max(10, Math.min(window.innerWidth - 260, e.clientX - dragRef.current.ox)),
        y: Math.max(10, Math.min(window.innerHeight - 180, e.clientY - dragRef.current.oy)),
      }));
    }
    function onUp() { dragRef.current.dragging = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const sortedCards = [...col.cards]
    .filter(card => activeFilters.length === 0 || activeFilters.every(f => (card.tags || []).includes(f)))
    .sort((a, b) => {
      if (sortBy === "modified") return sortDir === "asc" ? (a.fileModified || 0) - (b.fileModified || 0) : (b.fileModified || 0) - (a.fileModified || 0);
      if (sortBy === "opened") return sortDir === "asc" ? (a.lastOpened || 0) - (b.lastOpened || 0) : (b.lastOpened || 0) - (a.lastOpened || 0);
      return 0;
    });

  const contextItems = [
    { label: "Rename", icon: Icons.tag, action: () => { const t = prompt("New name:", col.title); if (t) onRenameCol(col.id, t); } },
    { label: isCollapsed ? "Expand" : "Collapse", icon: Icons.collapse, action: () => onToggleCollapse(col.id) },
    { label: isLocked ? "Unlock Column" : "Lock Column", icon: isLocked ? Icons.unlock : Icons.lock, action: () => onToggleLock(col.id) },
    "divider",
    { label: "Change Color", icon: Icons.theme, keepOpen: true, action: () => openColorPicker() },
    { label: "Duplicate Column", icon: Icons.copy, action: () => onDuplicateCol(col.id) },
    "divider",
    ...(canMoveUp ? [{ label: "Move to Row Above", icon: Icons.rowUp, action: () => onMoveRowUp(col.id) }] : []),
    ...(canMoveDown ? [{ label: "Move to Row Below", icon: Icons.rowDown, action: () => onMoveRowDown(col.id) }] : []),
    { label: "Move to New Row", icon: Icons.rowDown, action: () => onMoveToNewRow(col.id) },
    "divider",
    { label: "Clear All Cards", icon: Icons.trash, action: () => { if (window.confirm(`Clear all cards from "${col.title}"?`)) onClearCol(col.id); }, danger: true },
    { label: "Delete Column", icon: Icons.close, action: () => { if (window.confirm(`Delete "${col.title}"?`)) onDeleteCol(col.id); }, danger: true },
  ];

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, width: 285, flexShrink: 0 }}>
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextItems} onClose={() => setContextMenu(null)} theme={theme} />}
      {colorPicker.open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000 }} onMouseDown={closeColorPicker}>
          <div
            onMouseDown={e => { e.stopPropagation(); }}
            style={{
              position: "fixed",
              left: colorPicker.x,
              top: colorPicker.y,
              width: 250,
              background: theme.surface,
              border: `1px solid ${theme.border2}`,
              borderRadius: theme.r2,
              boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
              overflow: "hidden",
              fontFamily: theme.font || "Syne",
            }}
          >
            <div
              onMouseDown={onPickerMouseDown}
              style={{
                padding: "10px 12px",
                borderBottom: `1px solid ${theme.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "move",
                userSelect: "none",
                color: theme.text,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Column color
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={applyColorPicker} style={{ padding: "4px 10px", borderRadius: 8, border: "none", background: theme.accent, color: theme.accentText, cursor: "pointer", fontWeight: 800, fontSize: 12 }}>✓</button>
                <button onClick={closeColorPicker} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${theme.border2}`, background: theme.surface2, color: theme.text2, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Cancel</button>
              </div>
            </div>
            <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <input type="color" value={colorPicker.value} onChange={e => setColorPicker(p => ({ ...p, value: e.target.value }))} style={{ width: 44, height: 44, border: "none", background: "transparent", cursor: "pointer" }} />
              <input
                value={colorPicker.value}
                onChange={e => setColorPicker(p => ({ ...p, value: e.target.value }))}
                style={{ flex: 1, background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 10px", color: theme.text, fontFamily: "monospace", fontSize: 12, outline: "none" }}
              />
            </div>
          </div>
        </div>
      )}

      <div onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        style={{ background: theme.surface, border: `1px solid ${isDragging ? theme.accent + "60" : isLocked ? theme.accent + "30" : theme.border}`, borderRadius: theme.r2, overflow: "hidden", opacity: isDragging ? 0.4 : 1 }}>
        {/* HEADER */}
        <div style={{ padding: "11px 13px 9px", display: "flex", alignItems: "center", gap: 7, borderBottom: isCollapsed ? "none" : `1px solid ${theme.border}` }}>
          <div {...attributes} {...listeners} style={{ cursor: "grab", color: theme.text3, display: "flex", alignItems: "center", flexShrink: 0, touchAction: "none" }}>
            <Icon d={Icons.drag} size={12} />
          </div>
          <div onClick={() => openColorPicker()}
            style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, flexShrink: 0, cursor: "pointer", transition: "box-shadow 0.15s" }}
            title="Click to change color"
            onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${col.color}88`}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"} />
          <div style={{ fontSize: 13, fontWeight: 700, flex: 1, color: theme.text }}>
            {col.title}{isLocked && <span style={{ fontSize: 9, marginLeft: 5, color: theme.accent }}>🔒</span>}
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: theme.text3, background: theme.surface2, padding: "2px 6px", borderRadius: 8 }}>{col.cards.length}</span>
          <div onClick={() => onToggleCollapse(col.id)} style={{ color: theme.text3, cursor: "pointer", display: "flex" }}>
            <Icon d={isCollapsed ? Icons.chevronDown : Icons.chevronUp} size={12} />
          </div>
        </div>

        {!isCollapsed && (
          <CardDropZone colId={col.id} theme={theme} isCardDrag={isCardDrag && !isLocked} colMaxHeight={colMaxHeight}>
            <SortableContext items={sortedCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {sortedCards.map(card => (
                <SortableCard key={card.id} card={card} isSelected={selectedCard?.id === card.id} onClick={() => onSelectCard(card)} onDelete={isLocked ? null : onDeleteCard} allTags={allTags} theme={theme} isLocked={isLocked} />
              ))}
            </SortableContext>
            {sortedCards.length === 0 && activeFilters.length > 0 && <div style={{ textAlign: "center", padding: "16px 0", color: theme.text3, fontSize: 12 }}>No cards match filter</div>}
            {!isLocked && <button onClick={() => onAddCard(col.id)} style={{ width: "100%", padding: "7px", background: "transparent", border: `1px dashed ${theme.border2}`, borderRadius: theme.r, color: theme.text3, cursor: "pointer", fontSize: 12, marginTop: 4, fontFamily: theme.font || "Syne" }}>+ Add Project</button>}
          </CardDropZone>
        )}
      </div>
    </div>
  );
}

// ── PROJECT SIDEBAR ───────────────────────────────────────────────────────────
function DroppableProject({ proj, isExpanded, onToggle, onDelete, onRename, getAllCards, onRemoveSong, onAddSong, theme, isCardDrag }) {
  const { setNodeRef, isOver } = useDroppable({ id: "proj-" + proj.id, disabled: !isCardDrag });
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(proj.title);
  return (
    <div ref={setNodeRef} style={{ marginBottom: 4, borderRadius: theme.r, border: `1px solid ${isOver ? theme.accent : isExpanded ? theme.accent + "40" : theme.border}`, background: isOver ? theme.accent + "12" : isExpanded ? theme.surface2 : "transparent", transition: "all 0.15s", overflow: "hidden" }}>
      <div style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }} onClick={() => onToggle(proj.id)}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: proj.color || theme.accent, flexShrink: 0 }} />
        {editing ? (
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onBlur={() => { onRename(proj.id, val); setEditing(false); }}
            onKeyDown={e => { if (e.key === "Enter") { onRename(proj.id, val); setEditing(false); } e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${theme.accent}`, color: theme.text, fontFamily: theme.font || "Syne", fontSize: 12, fontWeight: 600, outline: "none" }} />
        ) : (
          <span onDoubleClick={e => { e.stopPropagation(); setEditing(true); }} style={{ flex: 1, fontSize: 12, fontWeight: 600, color: isOver ? theme.accent : theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.title}</span>
        )}
        {isOver && <Icon d={Icons.drop} size={11} style={{ color: theme.accent, flexShrink: 0 }} />}
        <span style={{ fontSize: 10, color: theme.text3, fontFamily: "monospace" }}>{proj.songs?.length || 0}</span>
        <Icon d={isExpanded ? Icons.chevronUp : Icons.chevronDown} size={10} style={{ color: theme.text3 }} />
        <div onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${proj.title}"?`)) onDelete(proj.id); }} style={{ color: theme.text3, display: "flex", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.color = "#ff5050"} onMouseLeave={e => e.currentTarget.style.color = theme.text3}><Icon d={Icons.close} size={10} /></div>
      </div>
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${theme.border}` }}>
          {(proj.songs || []).map(songId => {
            const card = getAllCards().find(c => c.id === songId);
            if (!card) return null;
            const dawColor = DAW_COLORS[card.daw] || theme.text3;
            return (
              <div key={songId} style={{ padding: "7px 11px 7px 26px", display: "flex", alignItems: "center", gap: 7, borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: dawColor, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 11, color: theme.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.title}</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: dawColor }}>{DAW_LABELS[card.daw]}</span>
                <div onClick={() => onRemoveSong(proj.id, songId)} style={{ color: theme.text3, cursor: "pointer", display: "flex" }} onMouseEnter={e => e.currentTarget.style.color = "#ff5050"} onMouseLeave={e => e.currentTarget.style.color = theme.text3}><Icon d={Icons.close} size={9} /></div>
              </div>
            );
          })}
          <div style={{ padding: "7px 11px" }}>
            <select defaultValue="" onChange={e => { if (e.target.value) { onAddSong(proj.id, e.target.value); e.target.value = ""; } }} style={{ width: "100%", background: theme.surface3, border: `1px solid ${theme.border}`, borderRadius: theme.r - 2, color: theme.text2, fontFamily: theme.font || "Syne", fontSize: 11, padding: "4px 7px", outline: "none", cursor: "pointer" }}>
              <option value="" disabled>+ Add song...</option>
              {getAllCards().filter(c => !(proj.songs || []).includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectSidebar({ projects, onAddProject, onDeleteProject, onAddSong, onRemoveSong, onRenameProject, theme, allColumns, isCardDrag, collapsed, onToggleCollapsed }) {
  const [expandedId, setExpandedId] = useState(null);
  const getAllCards = useCallback(() => allColumns.flatMap(col => col.cards), [allColumns]);
  return (
    <div style={{ width: collapsed ? 52 : 235, flexShrink: 0, borderRight: `1px solid ${theme.border}`, background: theme.surface, display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.18s" }}>
      <div style={{ padding: collapsed ? "12px 10px" : "13px 14px 10px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: collapsed ? "center" : "center", justifyContent: "space-between", gap: 8, flexDirection: collapsed ? "column" : "row" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", justifyContent: collapsed ? "center" : "flex-start" }}>
          <Icon d={Icons.album} size={13} style={{ color: theme.accent }} />
          {!collapsed && <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Projects</span>}
        </div>
        {collapsed ? (
          <button
            onClick={onToggleCollapsed}
            title="Expand Projects"
            style={{ width: 26, height: 18, borderRadius: 999, border: `1px solid ${theme.border2}`, background: theme.surface2, color: theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 8 }}
            onMouseEnter={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = theme.accent; }}
            onMouseLeave={e => { e.currentTarget.style.color = theme.text2; e.currentTarget.style.borderColor = theme.border2; }}>
            <Icon d={Icons.chevronDown} size={11} />
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={onAddProject} style={{ width: 22, height: 22, borderRadius: theme.r - 2, border: `1px solid ${theme.border2}`, background: "transparent", color: theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = theme.accent; }} onMouseLeave={e => { e.currentTarget.style.color = theme.text2; e.currentTarget.style.borderColor = theme.border2; }}>
              <Icon d={Icons.plus} size={11} />
            </button>
            <button onClick={onToggleCollapsed} title="Collapse Projects"
              style={{ width: 22, height: 22, borderRadius: theme.r - 2, border: `1px solid ${theme.border2}`, background: "transparent", color: theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = theme.accent; }}
              onMouseLeave={e => { e.currentTarget.style.color = theme.text2; e.currentTarget.style.borderColor = theme.border2; }}>
              <Icon d={Icons.chevronUp} size={11} />
            </button>
          </div>
        )}
      </div>
      {!collapsed && (
        <>
          {isCardDrag && projects.length > 0 && <div style={{ padding: "5px 10px", background: theme.accent + "18", borderBottom: `1px solid ${theme.border}`, fontSize: 10, color: theme.accent, fontFamily: "monospace", textAlign: "center" }}>Drop onto a project to add it</div>}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {projects.length === 0 && <div style={{ padding: "18px 10px", textAlign: "center", color: theme.text3, fontSize: 12, lineHeight: 1.7 }}>Create projects to organize songs into albums, beat tapes, or EPs.</div>}
            {projects.map(proj => <DroppableProject key={proj.id} proj={proj} isExpanded={expandedId === proj.id} onToggle={id => setExpandedId(expandedId === id ? null : id)} onDelete={onDeleteProject} onRename={onRenameProject} getAllCards={getAllCards} onRemoveSong={onRemoveSong} onAddSong={onAddSong} theme={theme} isCardDrag={isCardDrag} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ── THEME CUSTOMIZER (simplified) ─────────────────────────────────────────────
function ThemeCustomizer({ themePreset, themeCustom, font, onApply, onClose, theme }) {
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

// ── SETTINGS PANEL ────────────────────────────────────────────────────────────
function SettingsPanel({ discordWebhook, colMaxHeight, onSave, onClose, theme }) {
  const [webhook, setWebhook] = useState(discordWebhook);
  const [maxH, setMaxH] = useState(colMaxHeight);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  async function testWebhook() {
    setTesting(true); setTestResult(null);
    const ok = await postToDiscord(webhook, "✅ TrackFlow Test", "Webhook connected!", 0x3af0b0);
    setTesting(false); setTestResult(ok ? "success" : "fail");
  }

  async function checkUpdate() {
    setChecking(true); setUpdateStatus(null);
    try {
      const result = await invoke("check_for_update");
      setUpdateStatus(result);
    } catch (e) {
      setUpdateStatus({ available: false, error: String(e) });
    }
    setChecking(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r2, padding: 28, width: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, color: theme.text }}>Settings</div>

        {/* Column height */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 }}>Column Height</div>
          <div style={{ fontSize: 11, color: theme.text3, marginBottom: 10 }}>Sets a fixed height for all columns so grid rows stay aligned.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="range" min={200} max={900} step={20} value={maxH} onChange={e => setMaxH(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent, fontFamily: "monospace", minWidth: 50 }}>{maxH}px</span>
          </div>
        </div>

        {/* Updates */}
        <div style={{ marginBottom: 24, padding: 16, background: theme.surface2, borderRadius: theme.r, border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 }}>Updates</div>
          <div style={{ fontSize: 11, color: theme.text3, marginBottom: 12, lineHeight: 1.6 }}>Updates install automatically and preserve your entire saved state. Your projects, tags, and layout will be exactly as you left them.</div>
          <button onClick={checkUpdate} disabled={checking} style={{ padding: "7px 16px", background: theme.surface3, border: `1px solid ${theme.border2}`, borderRadius: theme.r, color: theme.text, fontFamily: "Syne", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={Icons.update} size={13} />{checking ? "Checking..." : "Check for Updates"}
          </button>
          {updateStatus && (
            <div style={{ marginTop: 10, fontSize: 12, color: updateStatus.available ? theme.accent : theme.text3 }}>
              {updateStatus.available ? `✓ Update available: v${updateStatus.version}` : updateStatus.error ? `Error: ${updateStatus.error}` : "✓ You're on the latest version"}
            </div>
          )}
        </div>

        {/* Discord webhook */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 }}>Discord Error Webhook</div>
          <div style={{ fontSize: 11, color: theme.text3, marginBottom: 10, lineHeight: 1.6 }}>
            When TrackFlow hits an error, a "Send Error Report" button appears. Paste your Discord webhook and it'll DM you the details.<br />
            <span style={{ color: theme.accent }}>Server → Channel → Integrations → Webhooks → New Webhook → Copy URL</span>
          </div>
          <input value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..."
            style={{ width: "100%", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, padding: "9px 12px", color: theme.text, fontFamily: "monospace", fontSize: 11, outline: "none", marginBottom: 8 }} />
          <button onClick={testWebhook} disabled={!webhook || testing}
            style={{ padding: "6px 14px", background: testResult === "success" ? "#3af0b0" : testResult === "fail" ? "#ff5050" : theme.surface3, border: `1px solid ${theme.border}`, borderRadius: theme.r, color: testResult ? "#0a0a0b" : theme.text2, fontFamily: "Syne", fontSize: 12, cursor: "pointer" }}>
            {testing ? "Sending..." : testResult === "success" ? "✓ Test sent!" : testResult === "fail" ? "✗ Failed" : "Send Test Message"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onSave(webhook, maxH)} style={{ flex: 1, padding: 11, background: theme.accent, border: "none", borderRadius: theme.r, color: theme.accentText, fontFamily: "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Save</button>
          <button onClick={onClose} style={{ padding: "11px 20px", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, color: theme.text2, fontFamily: "Syne", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── TAG MANAGER ───────────────────────────────────────────────────────────────
function TagManager({ allTags, onAddTag, onDeleteTag, onClose, theme }) {
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

// ── DETAIL PANEL ──────────────────────────────────────────────────────────────
function DetailPanel({ card, onUpdateNote, onUpdateTags, onOpenInDaw, allTags, theme }) {
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

// ── APP ───────────────────────────────────────────────────────────────────────
function App() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("producer");
  const [producerCols, setProducerCols] = useState(PRODUCER_COLUMNS);
  const [engineerCols, setEngineerCols] = useState(ENGINEER_COLUMNS);
  const [producerLayout, setProducerLayout] = useState([PRODUCER_COLUMNS.map(c => c.id)]);
  const [engineerLayout, setEngineerLayout] = useState([ENGINEER_COLUMNS.map(c => c.id)]);
  const [layoutView, setLayoutView] = useState("grid"); // "grid" (multi-row) | "panel" (single row)
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [watchedFolders, setWatchedFolders] = useState([]);
  const [customTags, setCustomTags] = useState(DEFAULT_TAGS);
  const [selectedCard, setSelectedCard] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const [activeColId, setActiveColId] = useState(null);
  const [isCardDrag, setIsCardDrag] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [themePreset, setThemePreset] = useState("default");
  const [themeCustom, setThemeCustom] = useState(BASE_PRESETS.default);
  const [font, setFont] = useState("Syne");
  const [colMaxHeight, setColMaxHeight] = useState(DEFAULT_COL_HEIGHT);
  const [sortBy, setSortBy] = useState("modified");
  const [sortDir, setSortDir] = useState("desc");
  const [modeTransition, setModeTransition] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState([]);
  const [collapsedCols, setCollapsedCols] = useState([]);
  const [lockedCols, setLockedCols] = useState([]);
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [errorLog, setErrorLog] = useState([]);
  const [showErrorBar, setShowErrorBar] = useState(false);

  const theme = buildTheme(themeCustom.bg, themeCustom.cardBg, themeCustom.borderHex, themeCustom.accent, font);
  const columns = mode === "producer" ? producerCols : engineerCols;
  const setColumns = mode === "producer" ? setProducerCols : setEngineerCols;
  const layout = mode === "producer" ? producerLayout : engineerLayout;
  const setLayout = mode === "producer" ? setProducerLayout : setEngineerLayout;
  const isGridView = layoutView === "grid";

  // ALL HOOKS BEFORE EARLY RETURN
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const columnsRef = useRef(columns);
    useEffect(() => { columnsRef.current = columns; }, [columns]);
    const layoutRef = useRef(layout);
    useEffect(() => { layoutRef.current = layout; }, [layout]);
    const dragStartColRef = useRef(null); // ← THIS WAS MISSING
  const lastColumnOverRef = useRef(null);
  const rafColumnReorderRef = useRef(null);
  const savedGridLayoutRef = useRef({ producer: null, engineer: null });

  function flattenLayout(lyt) {
    return (lyt || []).flat().map(String);
  }

  function normalizeLayout(lyt, colIds) {
    const ids = colIds.map(String);
    const seen = new Set();
    const outRows = (lyt || [])
      .map(row => (row || []).map(String).filter(id => ids.includes(id)))
      .filter(row => row.length > 0)
      .map(row => row.filter(id => (seen.has(id) ? false : (seen.add(id), true))));
    const missing = ids.filter(id => !seen.has(id));
    if (missing.length > 0) {
      if (outRows.length === 0) outRows.push([]);
      outRows[outRows.length - 1].push(...missing);
    }
    return outRows.length > 0 ? outRows : [ids];
  }

  function computeGridLayoutFromOrder(order) {
    // Roughly account for sidebars (235 + 275) + paddings/gaps
    const available = Math.max(500, window.innerWidth - 560);
    const colW = 285;
    const gap = 14;
    const perRow = Math.max(1, Math.min(6, Math.floor((available + gap) / (colW + gap))));
    const rows = [];
    for (let i = 0; i < order.length; i += perRow) rows.push(order.slice(i, i + perRow));
    return rows.slice(0, 4);
  }

  const applyResponsiveLayout = useCallback((nextView) => {
    const key = mode === "producer" ? "producer" : "engineer";
    const colIds = columnsRef.current.map(c => String(c.id));
    const current = normalizeLayout(layoutRef.current, colIds);

    if (nextView === "panel") {
      // Save current grid so we can restore it later.
      savedGridLayoutRef.current[key] = current;
      const order = flattenLayout(current);
      const panelLayout = [order];
      setLayout(panelLayout);
      layoutRef.current = panelLayout;
      return;
    }

    // nextView === "grid"
    const saved = savedGridLayoutRef.current[key];
    const restored = saved ? normalizeLayout(saved, colIds) : computeGridLayoutFromOrder(flattenLayout(current));
    setLayout(restored);
    layoutRef.current = restored;
  }, [mode, setLayout]);

  // Auto-switch between panel (single row) and grid (multi-row) based on window width.
  useEffect(() => {
    function decideView() {
      const next = window.innerWidth < 1200 ? "panel" : "grid";
      setLayoutView(prev => (prev === next ? prev : next));
    }
    decideView();
    window.addEventListener("resize", decideView);
    return () => window.removeEventListener("resize", decideView);
  }, []);

  // When layoutView changes, transform the underlying saved layout once (minimal + preserves DnD logic).
  useEffect(() => {
    if (!ready) return;
    applyResponsiveLayout(layoutView);
  }, [ready, layoutView, applyResponsiveLayout]);
  useEffect(() => {
    loadState().then(raw => {
      const saved = migrateState(raw);
      if (saved) {
        setMode(saved.mode); setProducerCols(saved.producerCols); setEngineerCols(saved.engineerCols);
        setProducerLayout(saved.producerLayout); setEngineerLayout(saved.engineerLayout);
        setProjects(saved.projects); setWatchedFolders(saved.watchedFolders); setCustomTags(saved.customTags);
        setThemePreset(saved.themePreset); setThemeCustom(saved.themeCustom); setFont(saved.font);
        setColMaxHeight(saved.colMaxHeight); setCollapsedCols(saved.collapsedCols); setLockedCols(saved.lockedCols);
        setDiscordWebhook(saved.discordWebhook); setWebhookUrl(saved.discordWebhook);
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    async function loadTimes(cols) {
      return Promise.all(cols.map(async col => ({ ...col, cards: await Promise.all(col.cards.map(async card => { if (!card.path || card.path.startsWith("~")) return card; try { return { ...card, fileModified: await invoke("get_file_modified", { path: card.path }) }; } catch (e) { return card; } })) })));
    }
    loadTimes(producerCols).then(setProducerCols);
    loadTimes(engineerCols).then(setEngineerCols);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    saveState({ mode, producerCols, engineerCols, producerLayout, engineerLayout, projects, watchedFolders, customTags, themePreset, themeCustom, font, colMaxHeight, discordWebhook, collapsedCols, lockedCols });
  }, [ready, mode, producerCols, engineerCols, producerLayout, engineerLayout, projects, watchedFolders, customTags, themePreset, themeCustom, font, colMaxHeight, discordWebhook, collapsedCols, lockedCols]);

  // Orphan cleanup — ref pattern avoids #105 loop
  const orphanRef = useRef(null);
  orphanRef.current = { producerCols, engineerCols };
  useEffect(() => {
    const allCardIds = new Set([...orphanRef.current.producerCols, ...orphanRef.current.engineerCols].flatMap(c => c.cards.map(x => x.id)));
    setProjects(ps => { const cleaned = ps.map(p => ({ ...p, songs: (p.songs || []).filter(id => allCardIds.has(id)) })); return cleaned.some((p, i) => p.songs.length !== ps[i].songs.length) ? cleaned : ps; });
  }, [producerCols, engineerCols]);

  // Global error catch
  useEffect(() => {
    const onErr = e => { setErrorLog(prev => [...prev, { message: e.message, stack: e.error?.stack, time: Date.now() }]); setShowErrorBar(true); };
    const onRej = e => { setErrorLog(prev => [...prev, { message: String(e.reason), stack: e.reason?.stack, time: Date.now() }]); setShowErrorBar(true); };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);

  // Dynamic font loading
  useEffect(() => {
    const name = font.replace(/ /g, "+");
    const w = FONT_WEIGHTS[font] || "400;700";
    const el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = `https://fonts.googleapis.com/css2?family=${name}:wght@${w}&display=swap`;
    document.head.appendChild(el);
    return () => { try { document.head.removeChild(el); } catch (e) {} };
  }, [font]);

  if (!ready) return (
    <div style={{ height: "100vh", background: "#0a0a0b", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f0" }}>Track<span style={{ color: "#c8ff47" }}>Flow</span></div>
      <div style={{ fontSize: 12, color: "#555" }}>Loading your projects...</div>
    </div>
  );

  // ── LAYOUT HELPERS ────────────────────────────────────────────────────────────
  function getColRowIdx(colId, lyt = layout) { return lyt.findIndex(row => row.includes(String(colId))); }

  function moveColToRow(colId, targetRowIdx) {
    let newLayout = layout.map(row => row.filter(id => id !== String(colId))).filter(row => row.length > 0);
    const clampedIdx = Math.max(0, Math.min(targetRowIdx, newLayout.length));
    if (clampedIdx < newLayout.length) { newLayout[clampedIdx] = [...newLayout[clampedIdx], String(colId)]; }
    else if (newLayout.length < 4) { newLayout.push([String(colId)]); }
    setLayout(newLayout);
  }

  function handleMoveRowUp(colId) {
  setLayout(current => {
    const rowIdx = current.findIndex(row => row.includes(String(colId)));
    if (rowIdx <= 0) return current;
    const newLayout = current.map(row => row.filter(id => id !== String(colId)));
    newLayout[rowIdx - 1] = [...newLayout[rowIdx - 1], String(colId)];
    return newLayout.filter(row => row.length > 0);
  });
}

function handleMoveRowDown(colId) {
  setLayout(current => {
    const rowIdx = current.findIndex(row => row.includes(String(colId)));
    if (rowIdx === -1) return current;
    let newLayout = current.map(row => row.filter(id => id !== String(colId))).filter(row => row.length > 0);
    if (rowIdx < newLayout.length) {
      newLayout[rowIdx] = [...newLayout[rowIdx], String(colId)];
    } else if (newLayout.length < 4) {
      newLayout.push([String(colId)]);
    }
    return newLayout;
  });
}

function handleMoveToNewRow(colId) {
  setLayout(current => {
    if (current.length >= 4) { alert("Maximum 4 rows reached."); return current; }
    const newLayout = current.map(row => row.filter(id => id !== String(colId))).filter(row => row.length > 0);
    return [...newLayout, [String(colId)]];
  });
}

  // ── DRAG ─────────────────────────────────────────────────────────────────────
  function findColumnOfCard(cardId) { return columnsRef.current.find(col => col.cards.some(c => c.id === cardId)); }

  function switchMode(m) {
    if (m === mode) return;
    setModeTransition(true);
    setTimeout(() => { setMode(m); setSelectedCard(null); setActiveTagFilters([]); setModeTransition(false); }, 250);
  }

function handleDragStart({ active }) {
  if (active.data.current?.type === "column") {
    setActiveColId(active.id);
    setIsCardDrag(false);
    lastColumnOverRef.current = null;
  } else if (active.data.current?.type === "card") {
    const col = columnsRef.current.find(col => col.cards.some(c => c.id === active.id));
    dragStartColRef.current = col?.id || null;
    setActiveCard(col?.cards.find(c => c.id === active.id) || null);
    setIsCardDrag(true);
  }
}

function handleDragOver({ active, over }) {
  if (!over) return;

  if (active.data.current?.type === "column") {
    const overId = String(over.id);
    if (overId.startsWith("zone-") || overId.startsWith("proj-")) return;
    const activeId = String(active.id);
    if (lastColumnOverRef.current === overId) return;
    lastColumnOverRef.current = overId;

    if (rafColumnReorderRef.current) cancelAnimationFrame(rafColumnReorderRef.current);
    rafColumnReorderRef.current = requestAnimationFrame(() => {
      rafColumnReorderRef.current = null;

    if (isGridView && overId.startsWith("row-") && !isCardDrag) {
      const lyt = layoutRef.current;
      const currentRow = lyt.findIndex(row => row.includes(activeId));

      if (overId === "row-new") {
        if (lyt.length >= 4) return;
        const newLayout = lyt
          .map(row => row.filter(id => id !== activeId))
          .filter(row => row.length > 0);
        newLayout.push([activeId]);
        setLayout(newLayout);
        layoutRef.current = newLayout;
        return;
      }

      const targetRow = Number(overId.replace("row-", ""));
      if (!Number.isFinite(targetRow)) return;
      if (currentRow !== -1 && currentRow === targetRow) return;

      const newLayout = lyt
        .map(row => row.filter(id => id !== activeId))
        .filter(row => row.length > 0);

      const clamped = Math.max(0, Math.min(targetRow, newLayout.length));
      if (clamped < newLayout.length) newLayout[clamped] = [...newLayout[clamped], activeId];
      else if (newLayout.length < 4) newLayout.push([activeId]);

      setLayout(newLayout);
      layoutRef.current = newLayout;
      return;
    }
    const lyt = layoutRef.current;
    const activeRow = lyt.findIndex(row => row.includes(activeId));
    const overRow = lyt.findIndex(row => row.includes(overId));
    if (activeRow !== -1 && overRow !== -1 && activeId !== overId) {
      // Smooth cross-row + within-row ordering: insert before hovered column.
      const next = lyt.map(r => [...r]);
      // Remove active from its current row
      next[activeRow] = next[activeRow].filter(id => id !== activeId);
      // Insert into overRow at hovered index
      const insertAt = Math.max(0, next[overRow].indexOf(overId));
      next[overRow].splice(insertAt, 0, activeId);
      const cleaned = next.filter(r => r.length > 0);
      // Only update if changed to avoid jitter
      const same = JSON.stringify(cleaned) === JSON.stringify(lyt);
      if (!same) {
        setLayout(cleaned);
        layoutRef.current = cleaned;
      }
      return;
    }
    if (activeRow !== -1 && activeRow === overRow && activeId !== overId) {
      const row = lyt[activeRow];
      const fi = row.indexOf(activeId);
      const ti = row.indexOf(overId);
      if (fi !== -1 && ti !== -1 && fi !== ti) {
        const newLayout = lyt.map((r, i) => i === activeRow ? arrayMove(r, fi, ti) : r);
setLayout(newLayout);
layoutRef.current = newLayout; // ← sync immediately, don't wait for useEffect
      }
    }
    });
    return;
  }

  if (active.data.current?.type !== "card") return;
  if (String(over.id).startsWith("proj-")) return;

  const targetId = String(over.id).startsWith("zone-")
    ? over.id.replace("zone-", "") : over.id;

  const cols = columnsRef.current;
  const src = cols.find(col => col.cards.some(c => c.id === active.id));
  const dst = cols.find(c => c.id === targetId) || cols.find(col => col.cards.some(c => c.id === targetId));

  if (!src || !dst || src.id === dst.id || lockedCols.includes(dst.id) || lockedCols.includes(src.id)) return;

  setColumns(cols => {
    const currentSrc = cols.find(col => col.cards.some(c => c.id === active.id));
    if (!currentSrc || currentSrc.id === dst.id) return cols;
    const card = currentSrc.cards.find(c => c.id === active.id);
    if (!card) return cols;
    return cols.map(col => {
      if (col.id === currentSrc.id) return { ...col, cards: col.cards.filter(c => c.id !== active.id) };
      if (col.id === dst.id) return { ...col, cards: [...col.cards, card] };
      return col;
    });
  });
}

function handleDragEnd({ active, over }) {
  if (rafColumnReorderRef.current) {
    cancelAnimationFrame(rafColumnReorderRef.current);
    rafColumnReorderRef.current = null;
  }
  lastColumnOverRef.current = null;
  if (isCardDrag && over && String(over.id).startsWith("proj-")) {
    const projId = over.id.replace("proj-", "");
    // Add to project
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p :
      (p.songs || []).includes(String(active.id)) ? p :
      { ...p, songs: [...(p.songs || []), String(active.id)] }
    ));
    // Restore card to its original column (handleDragOver may have moved it)
    const originalColId = dragStartColRef.current;
    if (originalColId) {
      setColumns(cols => {
        const currentCol = cols.find(col => col.cards.some(c => c.id === active.id));
        if (!currentCol || currentCol.id === originalColId) return cols;
        const card = currentCol.cards.find(c => c.id === active.id);
        if (!card) return cols;
        return cols.map(col => {
          if (col.id === currentCol.id) return { ...col, cards: col.cards.filter(c => c.id !== active.id) };
          if (col.id === originalColId) return { ...col, cards: [...col.cards, card] };
          return col;
        });
      });
    }
    setActiveCard(null); setActiveColId(null); setIsCardDrag(false);
    dragStartColRef.current = null;
    return;
  }
  // Deduplicate
  setColumns(cols => {
    const seen = new Set();
    return cols.map(col => ({ ...col, cards: col.cards.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; }) }));
  });
  setActiveCard(null); setActiveColId(null); setIsCardDrag(false);
  dragStartColRef.current = null;
}

  // ── HANDLERS ─────────────────────────────────────────────────────────────────
  function handleUpdateNote(cardId, note) { setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.id === cardId ? { ...c, note } : c) }))); setSelectedCard(prev => prev?.id === cardId ? { ...prev, note } : prev); }
  function handleUpdateTags(cardId, tags) { setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.id === cardId ? { ...c, tags } : c) }))); setSelectedCard(prev => prev?.id === cardId ? { ...prev, tags } : prev); }
  function handleAddCard(colId) { const title = prompt("Project name:"); if (!title) return; setColumns(cols => cols.map(col => col.id === colId ? { ...col, cards: [...col.cards, { id: Date.now().toString(), title, daw: "fl", path: `~/Music/${title}.flp`, tags: [], note: "", date: "Just now" }] } : col)); }
  function handleDeleteCard(cardId) { setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== cardId) }))); setSelectedCard(prev => prev?.id === cardId ? null : prev); }
  function handleRenameCol(colId, title) { setColumns(cols => cols.map(col => col.id === colId ? { ...col, title } : col)); }
  function handleDeleteCol(colId) {
  setColumns(cols => cols.filter(col => col.id !== colId));
  setLayout(layoutRef.current.map(row => row.filter(id => id !== colId)).filter(row => row.length > 0));
}

function handleDuplicateCol(colId) {
  const col = columns.find(c => c.id === colId); if (!col) return;
  const newId = Date.now().toString();
  setColumns(cols => {
    const idx = cols.findIndex(c => c.id === colId);
    const next = [...cols];
    next.splice(idx + 1, 0, { ...col, id: newId, title: col.title + " (copy)", cards: col.cards.map(c => ({ ...c, id: c.id + "-" + Date.now() })) });
    return next;
  });
  setLayout(layoutRef.current.map(row => {
    const idx = row.indexOf(colId);
    if (idx === -1) return row;
    const r = [...row]; r.splice(idx + 1, 0, newId); return r;
  }));
}
  function handleChangeColColor(colId, color) { setColumns(cols => cols.map(col => col.id === colId ? { ...col, color } : col)); }
  function handleToggleCollapse(colId) { setCollapsedCols(prev => prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]); }
  function handleToggleLock(colId) { setLockedCols(prev => prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]); }
  function handleClearCol(colId) { setColumns(cols => cols.map(col => col.id === colId ? { ...col, cards: [] } : col)); }
  async function handleOpenInDaw(filePath) { try { setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.path === filePath ? { ...c, lastOpened: Date.now(), date: "Just opened" } : c) }))); await invoke("open_daw_file", { path: filePath }); } catch (e) { alert("Could not open: " + e); } }
  function handleAddProject() { const title = prompt("Project name:"); if (!title) return; const colors = [theme.accent, "#47c8ff", "#ff6b47", "#b847ff", "#3af0b0"]; setProjects(ps => [...ps, { id: Date.now().toString(), title, color: colors[ps.length % colors.length], songs: [] }]); }
  function handleAddCol() {
  const title = prompt("Column name:"); if (!title) return;
  const newId = Date.now().toString();
  setColumns(cols => [...cols, { id: newId, title, color: theme.accent, cards: [] }]);
  const lyt = layoutRef.current;
  setLayout(lyt.length > 0 ? [...lyt.slice(0, -1), [...lyt[lyt.length - 1], newId]] : [[newId]]);
}

  function pickTargetColumnId(cols, message) {
    if (!cols || cols.length === 0) return null;
    const list = cols.map((c, i) => `${i + 1}. ${c.title}`).join("\n");
    const input = prompt(`${message}\n\n${list}\n\nType a number (1-${cols.length}) or leave blank for the first column:`);
    if (!input) return cols[0].id;
    const n = Number(input);
    if (!Number.isFinite(n) || n < 1 || n > cols.length) return cols[0].id;
    return cols[n - 1].id;
  }

  async function handleAddFolder() {
    const result = await pickAndScanFolder(); if (!result) return;
    setWatchedFolders(prev => [...new Set([...prev, ...result.folders])]);
    if (result.files.length === 0) { alert("No DAW projects found."); return; }
    const withMeta = await Promise.all(result.files.map(async f => { try { return { ...f, fileModified: await invoke("get_file_modified", { path: f.path }) }; } catch (e) { return f; } }));
    setColumns(cols => {
      if (cols.length === 0) return cols;
      const targetId = pickTargetColumnId(cols, "Add new projects into which column?");
      const existing = new Set(cols.flatMap(c => c.cards.map(x => x.path)));
      const newCards = withMeta.filter(f => !existing.has(f.path));
      alert(`Found ${newCards.length} new projects!`);
      return cols.map(col => col.id === targetId ? { ...col, cards: [...col.cards, ...newCards] } : col);
    });
  }
  async function handleRescan() {
    if (watchedFolders.length === 0) { alert("Add a folder first."); return; }
    const found = await scanForProjects(watchedFolders); if (found.length === 0) { alert("No new projects found."); return; }
    const withMeta = await Promise.all(found.map(async f => { try { return { ...f, fileModified: await invoke("get_file_modified", { path: f.path }) }; } catch (e) { return f; } }));
    setColumns(cols => {
      if (cols.length === 0) return cols;
      const targetId = pickTargetColumnId(cols, "Rescan found new projects. Add into which column?");
      const existing = new Set(cols.flatMap(c => c.cards.map(x => x.path)));
      const newCards = withMeta.filter(f => !existing.has(f.path));
      alert(`Found ${newCards.length} new projects!`);
      return cols.map(col => col.id === targetId ? { ...col, cards: [...col.cards, ...newCards] } : col);
    });
  }
  async function sendErrorReport() {
    if (!discordWebhook) { alert("No webhook configured. Go to Settings."); return; }
    const latest = errorLog[errorLog.length - 1];
    const ok = await postToDiscord(discordWebhook, "🟡 TrackFlow Runtime Error", `**Error:** ${latest?.message || "Unknown"}\n\`\`\`${(latest?.stack || "No stack").substring(0, 1500)}\`\`\``);
    if (ok) { setShowErrorBar(false); setErrorLog([]); } else alert("Send failed. Check webhook URL.");
  }

  const modeAccent = mode === "producer" ? theme.accent : "#47c8ff";
  const activeColData = activeColId ? columns.find(c => c.id === activeColId) : null;

  function RowDropZone({ id, children, hint }) {
    const { setNodeRef, isOver } = useDroppable({ id, disabled: !isGridView || isCardDrag });
    const showHint = Boolean(hint) && activeColId && !isCardDrag;
    return (
      <div
        ref={setNodeRef}
        style={{
          borderRadius: theme.r2,
          outline: isOver ? `1px solid ${theme.accent}66` : "none",
          background: isOver ? `rgba(${theme.accentRgb},0.035)` : "transparent",
          transition: "outline 0.12s, background 0.12s",
        }}
      >
        {children}
        {showHint && (
          <div
            style={{
              height: 34,
              marginTop: 8,
              borderRadius: theme.r2,
              border: `1px dashed ${theme.border}`,
              color: theme.text3,
              opacity: 0.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.04em",
              userSelect: "none",
            }}
          >
            {hint}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font || "Syne", background: theme.bg, color: theme.text, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", transition: "background 0.3s" }}>
      {showTagManager && <TagManager allTags={customTags} onAddTag={tag => { if (!customTags.find(t => t.label === tag.label)) setCustomTags(p => [...p, tag]); }} onDeleteTag={l => setCustomTags(p => p.filter(t => t.label !== l))} onClose={() => setShowTagManager(false)} theme={theme} />}
      {showThemeCustomizer && <ThemeCustomizer themePreset={themePreset} themeCustom={themeCustom} font={font} onApply={(preset, custom, f) => { setThemePreset(preset); setThemeCustom(custom); setFont(f); setShowThemeCustomizer(false); }} onClose={() => setShowThemeCustomizer(false)} theme={theme} />}
      {showSettings && <SettingsPanel discordWebhook={discordWebhook} colMaxHeight={colMaxHeight} onSave={(wh, mh) => { setDiscordWebhook(wh); setWebhookUrl(wh); setColMaxHeight(mh); setShowSettings(false); }} onClose={() => setShowSettings(false)} theme={theme} />}

      {/* Error bar */}
      {showErrorBar && (
        <div style={{ background: "#c0392b", padding: "7px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 12, color: "#fff", fontWeight: 600 }}>⚠ Runtime error detected</span>
          <button onClick={sendErrorReport} style={{ padding: "4px 12px", background: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#c0392b" }}>Send Error Report</button>
          <button onClick={() => setShowErrorBar(false)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* TOPBAR */}
      <div style={{ height: 50, background: theme.surface, borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: theme.text, letterSpacing: "-0.5px" }}>Track<span style={{ color: modeAccent }}>Flow</span></div>
        <div style={{ display: "flex", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, padding: 3, gap: 2 }}>
          {[{ key: "producer", icon: Icons.producer, label: "Producer" }, { key: "engineer", icon: Icons.engineer, label: "Engineer" }].map(m => (
            <button key={m.key} onClick={() => switchMode(m.key)} style={{ padding: "4px 12px", borderRadius: theme.r - 2, border: "none", background: mode === m.key ? theme.surface3 : "transparent", color: mode === m.key ? (m.key === "producer" ? theme.accent : "#47c8ff") : theme.text3, fontFamily: font || "Syne", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon d={m.icon} size={12} />{m.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />

        {/* Unified sort + filter dropdown */}
        <SortFilterDropdown sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} allTags={customTags} activeTagFilters={activeTagFilters} setActiveTagFilters={setActiveTagFilters} theme={theme} />

        {watchedFolders.length > 0 && <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{watchedFolders.length} folder{watchedFolders.length > 1 ? "s" : ""} watched</div>}
        {[
          { icon: Icons.backup, action: async () => { const p = await backupState(); if (p) alert(`Backup saved:\n${p}`); }, hover: theme.accent, title: "Backup" },
          { icon: Icons.theme, action: () => setShowThemeCustomizer(true), hover: theme.accent, title: "Customize Theme" },
          { icon: Icons.tag, action: () => setShowTagManager(true), hover: "#b847ff", title: "Manage Tags" },
          { icon: Icons.folder, action: handleAddFolder, hover: "#47c8ff", title: "Add Folder" },
          { icon: Icons.scan, action: handleRescan, hover: theme.accent, title: "Rescan" },
          { icon: Icons.settings, action: () => setShowSettings(true), hover: theme.text2, title: "Settings" },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} title={btn.title} style={{ width: 32, height: 32, borderRadius: theme.r, border: `1px solid ${theme.border}`, background: theme.surface2, color: theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => e.currentTarget.style.color = btn.hover} onMouseLeave={e => e.currentTarget.style.color = theme.text2}>
            <Icon d={btn.icon} size={13} />
          </button>
        ))}
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${theme.accent}, #47c8ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: theme.accentText }}>KD</div>
      </div>

      <div style={{ height: 2, background: `linear-gradient(90deg, ${modeAccent}99, transparent)`, flexShrink: 0 }} />

      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const type = args.active?.data?.current?.type;
          // closestCenter is more forgiving when dropping into nearby columns (esp. vertically)
          return (type === "column" || type === "card") ? closestCenter(args) : rectIntersection(args);
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <ProjectSidebar projects={projects} onAddProject={handleAddProject} onDeleteProject={id => setProjects(ps => ps.filter(p => p.id !== id))} onAddSong={(projId, songId) => setProjects(ps => ps.map(p => p.id === projId ? { ...p, songs: [...(p.songs || []), songId] } : p))} onRemoveSong={(projId, songId) => setProjects(ps => ps.map(p => p.id === projId ? { ...p, songs: (p.songs || []).filter(s => s !== songId) } : p))} onRenameProject={(id, title) => setProjects(ps => ps.map(p => p.id === id ? { ...p, title } : p))} theme={theme} allColumns={[...producerCols, ...engineerCols]} isCardDrag={isCardDrag} collapsed={projectsCollapsed} onToggleCollapsed={() => setProjectsCollapsed(v => !v)} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", opacity: modeTransition ? 0 : 1, transition: "opacity 0.25s", background: mode === "producer" ? theme.glow : theme.glow2 }}>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16, minWidth: "fit-content" }}>
              {layout.map((rowColIds, rowIdx) => (
                <RowDropZone key={rowIdx} id={`row-${rowIdx}`}>
                  <SortableContext items={rowColIds} strategy={horizontalListSortingStrategy}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      {rowColIds.map(colId => {
                        const col = columns.find(c => c.id === colId);
                        if (!col) return null;
                        return (
                          <SortableColumn key={col.id} col={col}
                            selectedCard={selectedCard} onSelectCard={setSelectedCard}
                            onAddCard={handleAddCard} onDeleteCard={handleDeleteCard}
                            onRenameCol={handleRenameCol} onDeleteCol={handleDeleteCol}
                            onDuplicateCol={handleDuplicateCol} onChangeColor={handleChangeColColor}
                            onToggleCollapse={handleToggleCollapse} onToggleLock={handleToggleLock}
                            onClearCol={handleClearCol}
                            onMoveRowUp={handleMoveRowUp} onMoveRowDown={handleMoveRowDown} onMoveToNewRow={handleMoveToNewRow}
                            allTags={customTags} sortBy={sortBy} sortDir={sortDir}
                            activeFilters={activeTagFilters} theme={theme}
                            isCardDrag={isCardDrag}
                            isCollapsed={collapsedCols.includes(col.id)} isLocked={lockedCols.includes(col.id)}
                            colMaxHeight={colMaxHeight}
                            canMoveUp={isGridView && rowIdx > 0} canMoveDown={isGridView && (layout.length < 4 || rowIdx < layout.length - 1)} />
                        );
                      })}
                      {rowIdx === layout.length - 1 && (
                      <button onClick={handleAddCol} style={{ flexShrink: 0, width: 46, minHeight: 80, background: "transparent", border: `1px dashed ${theme.border}`, borderRadius: theme.r2, color: theme.text3, opacity: 0.55, cursor: "pointer", alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.15s, border-color 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = 0.9; e.currentTarget.style.borderColor = theme.accent; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = 0.55; e.currentTarget.style.borderColor = theme.border; }}>
                          <Icon d={Icons.plus} size={18} />
                        </button>
                      )}
                    </div>
                  </SortableContext>
                </RowDropZone>
              ))}

              {isGridView && layout.length < 4 && (
                <RowDropZone id="row-new" hint="Drop a column here to create a new row" />
              )}
            </div>

            <DragOverlay>
              {activeCard && <div style={{ width: 260, opacity: 0.95, transform: "rotate(1.5deg)" }}><CardContent card={activeCard} isDragging allTags={customTags} theme={theme} /></div>}
              {activeColData && <div style={{ width: 285, opacity: 0.9, transform: "rotate(1deg)", background: theme.surface, border: `1px solid ${theme.accent}60`, borderRadius: theme.r2, padding: "12px 14px" }}><div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{activeColData.title}</div><div style={{ fontSize: 11, color: theme.text3, marginTop: 4 }}>{activeColData.cards.length} projects</div></div>}
            </DragOverlay>
          </div>

          <DetailPanel card={selectedCard} onUpdateNote={handleUpdateNote} onUpdateTags={handleUpdateTags} onOpenInDaw={handleOpenInDaw} allTags={customTags} theme={theme} />
        </div>
      </DndContext>
    </div>
  );
}

export default App;
