import { useState } from "react";
import { buildTheme, FONTS } from "../lib/theme";

// h: 0-360, s: 0-100, l: 0-100 → "#rrggbb"
function hslHex(h, s, l) {
  s /= 100; l /= 100;
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q-p)*6*t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q-p)*(2/3-t)*6;
    return p;
  }
  const q = l < 0.5 ? l*(1+s) : l+s-l*s;
  const p = 2*l - q;
  const r = Math.round(hue2rgb(p, q, h/360 + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h/360) * 255);
  const b = Math.round(hue2rgb(p, q, h/360 - 1/3) * 255);
  return `#${[r,g,b].map(v => v.toString(16).padStart(2,"0")).join("")}`;
}

// Derive theme inputs from just hue + saturation
// Lightness is fixed per role so the dark theme is always readable
function deriveColors(hue, sat) {
  return {
    bg:        hslHex(hue, sat * 0.18, 5.5),
    cardBg:    hslHex(hue, sat * 0.28, 11),
    borderHex: hslHex(hue, sat * 0.32, 44),
    accent:    hslHex(hue, Math.max(sat, 55), 72),
  };
}

// Pull H+S from a stored accent hex for backwards-compat init
function accentToHS(hex) {
  if (!hex?.startsWith("#") || hex.length < 7) return { hue: 78, sat: 100 };
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
  if (d === 0) return { hue: 0, sat: 0 };
  const l = (max+min)/2;
  let h = 0;
  if (max === r) h = (g-b)/d + (g<b?6:0);
  else if (max === g) h = (b-r)/d + 2;
  else h = (r-g)/d + 4;
  return {
    hue: Math.round(h * 60),
    sat: Math.round((l > 0.5 ? d/(2-max-min) : d/(max+min)) * 100),
  };
}

const QUICK = [
  { name: "Lime",    hue: 78,  sat: 100 },
  { name: "Blue",    hue: 210, sat: 100 },
  { name: "Purple",  hue: 270, sat: 90  },
  { name: "Amber",   hue: 38,  sat: 100 },
  { name: "Teal",    hue: 168, sat: 85  },
  { name: "Mono",    hue: 220, sat: 8   },
];

const RAINBOW = "linear-gradient(to right,hsl(0,80%,58%),hsl(30,80%,58%),hsl(60,80%,58%),hsl(90,80%,58%),hsl(120,80%,58%),hsl(150,80%,58%),hsl(180,80%,58%),hsl(210,80%,58%),hsl(240,80%,58%),hsl(270,80%,58%),hsl(300,80%,58%),hsl(330,80%,58%),hsl(360,80%,58%))";

function SliderTrack({ value, min, max, trackBg, thumbColor, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ position: "relative", height: 28, userSelect: "none" }}>
      <div style={{
        position: "absolute", top: "50%", left: 0, right: 0,
        height: 8, transform: "translateY(-50%)",
        borderRadius: 4, background: trackBg,
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
      }} />
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          opacity: 0, cursor: "pointer", margin: 0, padding: 0,
        }}
      />
      <div style={{
        position: "absolute",
        top: "50%", left: `${pct}%`,
        transform: "translate(-50%,-50%)",
        width: 20, height: 20, borderRadius: "50%",
        background: thumbColor,
        border: "2.5px solid rgba(255,255,255,0.92)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.65)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

export default function ThemeCustomizer({ themeCustom, font, onApply, onClose, theme }) {
  const C = theme;

  const init = themeCustom?.hue != null
    ? { hue: themeCustom.hue, sat: themeCustom.sat ?? 100 }
    : accentToHS(themeCustom?.accent);

  const [hue, setHue] = useState(init.hue);
  const [sat, setSat] = useState(init.sat);
  const [selFont, setSelFont] = useState(font);

  const derived = deriveColors(hue, sat);
  const preview = buildTheme(derived.bg, derived.cardBg, derived.borderHex, derived.accent, selFont);

  const satTrack = `linear-gradient(to right,#2a2a2a,hsl(${hue},100%,60%))`;
  const hueThumb = hslHex(hue, 80, 62);
  const satThumb = hslHex(hue, sat, 62);

  function handleApply() {
    onApply("custom", { ...derived, hue, sat }, selFont);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10002, fontFamily: C.font || "Syne" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.border2}`, borderRadius: C.r2, padding: 28, width: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 28px 72px rgba(0,0,0,0.65)" }}
      >
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 3 }}>Theme</div>
          <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.5 }}>Hue and saturation — lightness auto-scales for every surface and text layer.</div>
        </div>

        {/* Quick presets */}
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>Quick Start</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {QUICK.map(p => {
            const active = Math.abs(hue - p.hue) < 6 && Math.abs(sat - p.sat) < 8;
            const chip = hslHex(p.hue, Math.max(p.sat, 55), 70);
            return (
              <button key={p.name}
                onClick={() => { setHue(p.hue); setSat(p.sat); }}
                style={{
                  padding: "5px 13px", borderRadius: 20,
                  background: active ? `${chip}22` : C.surface2,
                  border: `1px solid ${active ? chip : C.border}`,
                  color: active ? chip : C.text3,
                  fontFamily: C.font || "Syne", fontSize: 11,
                  fontWeight: active ? 700 : 400, cursor: "pointer",
                  transition: "all 0.15s",
                }}>
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Hue slider */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>Hue</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text2, fontFamily: "monospace" }}>{hue}°</span>
          </div>
          <SliderTrack value={hue} min={0} max={360} trackBg={RAINBOW} thumbColor={hueThumb} onChange={setHue} />
        </div>

        {/* Saturation slider */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>Saturation</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text2, fontFamily: "monospace" }}>{sat}%</span>
          </div>
          <SliderTrack value={sat} min={0} max={100} trackBg={satTrack} thumbColor={satThumb} onChange={setSat} />
        </div>

        {/* Color swatches */}
        <div style={{ display: "flex", gap: 10, marginBottom: 22, alignItems: "flex-end" }}>
          {[
            { label: "BG",     color: derived.bg },
            { label: "Card",   color: derived.cardBg },
            { label: "Border", color: derived.borderHex },
            { label: "Accent", color: derived.accent },
          ].map(({ label, color }) => (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ width: "100%", height: 28, borderRadius: 6, background: color, border: `1px solid ${C.border2}` }} />
              <div style={{ fontSize: 9, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Mini board preview */}
        <div style={{ marginBottom: 22, background: preview.bg, border: `1px solid ${preview.border2}`, borderRadius: preview.r2, padding: 14 }}>
          <div style={{ fontSize: 9, color: preview.text3, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Preview</div>
          <div style={{ display: "flex", gap: 7 }}>
            {[
              { title: "Ideas",    dot: preview.text3, cards: 2 },
              { title: "Active",   dot: preview.accent, cards: 3 },
              { title: "Done",     dot: preview.accent, cards: 1 },
            ].map(({ title, dot, cards }, ci) => (
              <div key={title} style={{ flex: 1, background: preview.surface2, border: `1px solid ${preview.border}`, borderRadius: preview.r, padding: "7px 7px 5px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                  <div style={{ fontSize: 8, fontWeight: 700, color: preview.cardText2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{title}</div>
                </div>
                {Array.from({ length: cards }).map((_, i) => (
                  <div key={i} style={{
                    height: 14,
                    background: i % 2 === 0 ? preview.surface3 : preview.surface,
                    borderRadius: 3,
                    border: `1px solid ${preview.border}`,
                    marginBottom: 3,
                    width: i === cards-1 && cards > 1 ? "65%" : "100%",
                  }} />
                ))}
              </div>
            ))}
            {/* Text legibility column */}
            <div style={{ background: preview.surface2, border: `1px solid ${preview.border}`, borderRadius: preview.r, padding: "7px 9px", minWidth: 60 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: preview.cardText, marginBottom: 3 }}>Aa</div>
              <div style={{ fontSize: 9, color: preview.cardText2 }}>Secondary</div>
              <div style={{ fontSize: 8, color: preview.cardText3, marginTop: 2 }}>Muted</div>
              <div style={{ marginTop: 5, padding: "2px 6px", background: preview.accent, borderRadius: 3 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: preview.accentText }}>Button</div>
              </div>
            </div>
          </div>
        </div>

        {/* Font */}
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>Font</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {FONTS.map(f => (
            <button key={f} onClick={() => setSelFont(f)}
              style={{
                padding: "6px 13px", borderRadius: C.r,
                border: `1px solid ${selFont === f ? C.accent : C.border}`,
                background: selFont === f ? `${C.accent}18` : "transparent",
                cursor: "pointer", fontSize: 12,
                color: selFont === f ? C.accent : C.text2,
                fontFamily: f, transition: "all 0.15s",
              }}>
              {f}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleApply}
            style={{ flex: 1, padding: 11, background: C.accent, border: "none", borderRadius: C.r, color: C.accentText, fontFamily: C.font || "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
            Apply
          </button>
          <button onClick={onClose}
            style={{ padding: "11px 20px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: C.r, color: C.text2, fontFamily: C.font || "Syne", fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
