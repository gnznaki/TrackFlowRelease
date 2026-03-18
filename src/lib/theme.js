function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      default: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToHex(h, s, l) {
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const bv = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  return `#${[r, g, bv].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

// Ensure accent has enough contrast against bg — preserves hue, adjusts lightness
function safeAccent(accentHex, bgHex) {
  const bgLum = getLuminance(bgHex);
  const accentLum = getLuminance(accentHex);
  if (Math.abs(accentLum - bgLum) >= 0.2) return accentHex;
  const { h, s } = hexToHsl(accentHex);
  const targetL = bgLum < 0.45 ? 0.72 : 0.28;
  return hslToHex(h, Math.max(s, 0.45), targetL);
}

// Ensure cardBg is visually distinct from bg
function safeCardBg(cardBgHex, bgHex) {
  const diff = Math.abs(getLuminance(cardBgHex) - getLuminance(bgHex));
  if (diff >= 0.04) return cardBgHex;
  const isDark = getLuminance(bgHex) < 0.5;
  return shiftHex(cardBgHex, isDark ? 0.07 : -0.07);
}

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}
export function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex.startsWith("#") ? hex : "#888888");
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
export function contrastText(hex) {
  const lum = getLuminance(hex.startsWith("#") ? hex : "#888888");
  return lum > 0.62 ? "#0a0a0b" : "#f0f0f0";
}
export function shiftHex(hex, amt) {
  const { r, g, b } = hexToRgb(hex.startsWith("#") ? hex : "#888888");
  const clamp = v => Math.min(255, Math.max(0, Math.round(v + amt * 255)));
  return `#${[clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex.startsWith("#") ? hex : "#888888");
  return `rgba(${r},${g},${b},${alpha})`;
}

// Auto-derive all theme colors from 4 user choices + font
export function buildTheme(bg, cardBg, borderHex, accent, font) {
  const safeBg = bg?.startsWith("#") ? bg : "#0a0a0b";
  const safeAcc = safeAccent(accent?.startsWith("#") ? accent : "#c8ff47", safeBg);
  const safeCard = safeCardBg(cardBg?.startsWith("#") ? cardBg : "#18181d", safeBg);
  bg = safeBg; accent = safeAcc; cardBg = safeCard;
  const isDark = getLuminance(bg) < 0.5;
  const shift = isDark ? 0.04 : -0.03;
  const { r: ar, g: ag, b: ab } = hexToRgb(accent.startsWith("#") ? accent : "#c8ff47");
  return {
    name: "Custom", sub: "User defined",
    bg,
    surface: shiftHex(bg, shift),
    surface2: cardBg,
    surface3: shiftHex(cardBg, isDark ? 0.05 : -0.04),
    border: withAlpha(borderHex?.startsWith("#") ? borderHex : "#ffffff", isDark ? 0.18 : 0.14),
    border2: withAlpha(borderHex?.startsWith("#") ? borderHex : "#ffffff", isDark ? 0.3 : 0.24),
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

export const BASE_PRESETS = {
  default: { name: "Default", bg: "#0a0a0b", cardBg: "#18181d", borderHex: "#ffffff", accent: "#c8ff47" },
  daves:   { name: "Dave's",  bg: "#15120a", cardBg: "#252015", borderHex: "#aa9137", accent: "#52b23e" },
  tabkiller: { name: "TabKiller", bg: "#f4f4fc", cardBg: "#eeeeff", borderHex: "#5037c8", accent: "#e8197e" },
  findanote: { name: "FindANote", bg: "#060d1c", cardBg: "#0d1c32", borderHex: "#00afd2", accent: "#00b8d4" },
};

// Keep options few but visually distinct (display / grotesk / serif / mono)
export const FONTS = ["Syne", "Space Grotesk", "Cormorant Garamond", "JetBrains Mono"];
export const FONT_WEIGHTS = { "Syne": "400;600;700;800", "Space Grotesk": "400;500;600;700", "Cormorant Garamond": "400;500;600;700", "JetBrains Mono": "400;500;700" };
