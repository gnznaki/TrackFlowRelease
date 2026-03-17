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

export const BASE_PRESETS = {
  default: { name: "Default", bg: "#0a0a0b", cardBg: "#18181d", borderHex: "#ffffff", accent: "#c8ff47" },
  daves:   { name: "Dave's",  bg: "#15120a", cardBg: "#252015", borderHex: "#aa9137", accent: "#52b23e" },
  tabkiller: { name: "TabKiller", bg: "#f4f4fc", cardBg: "#eeeeff", borderHex: "#5037c8", accent: "#e8197e" },
  findanote: { name: "FindANote", bg: "#060d1c", cardBg: "#0d1c32", borderHex: "#00afd2", accent: "#00b8d4" },
};

// Keep options few but visually distinct (display / grotesk / serif / mono)
export const FONTS = ["Syne", "Space Grotesk", "Cormorant Garamond", "JetBrains Mono"];
export const FONT_WEIGHTS = { "Syne": "400;600;700;800", "Space Grotesk": "400;500;600;700", "Cormorant Garamond": "400;500;600;700", "JetBrains Mono": "400;500;700" };
