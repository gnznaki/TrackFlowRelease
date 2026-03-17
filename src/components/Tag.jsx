export default function Tag({ label, color, onRemove, theme }) {
  const c = color || theme.text3;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: c + "22", color: c, marginRight: 4, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {label}
      {onRemove && <span onClick={e => { e.stopPropagation(); onRemove(); }} style={{ cursor: "pointer", opacity: 0.5, fontSize: 11 }}>×</span>}
    </span>
  );
}
