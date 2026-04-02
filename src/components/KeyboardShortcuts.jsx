import { useEffect } from "react";

const SHORTCUT_SECTIONS = [
  {
    label: "BOARD ACTIONS",
    shortcuts: [
      { keys: ["F10"], description: "Reload App" },
      { keys: ["Ctrl", "N"], description: "New Column" },
      { keys: ["?"], description: "This Shortcuts Guide" },
    ],
  },
  {
    label: "CARD ACTIONS",
    shortcuts: [
      { keys: ["Delete"], description: "Delete Selected Card" },
      { keys: ["Ctrl", "R"], description: "Rename Card" },
      { keys: ["Ctrl", "D"], description: "Duplicate Card" },
      { keys: ["Ctrl", "C"], description: "Copy Card" },
      { keys: ["Ctrl", "V"], description: "Paste Card" },
    ],
  },
  {
    label: "FILE",
    shortcuts: [
      { keys: ["Ctrl", "S"], description: "Auto-saved (always on)" },
    ],
  },
  {
    label: "NAVIGATION",
    shortcuts: [
      { keys: ["Esc"], description: "Close / Deselect" },
      { keys: ["Ctrl", "Click"], description: "Open in DAW" },
    ],
  },
];

function KeyCap({ label, theme }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2px 7px",
        minWidth: "28px",
        height: "24px",
        background: theme.surface3,
        border: `1px solid ${theme.border2}`,
        borderBottom: `2px solid ${theme.border2}`,
        borderRadius: "4px",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "11px",
        fontWeight: "600",
        color: theme.text2,
        letterSpacing: "0.02em",
        boxShadow: `0 2px 0 ${theme.border2}, inset 0 1px 0 rgba(255,255,255,0.07)`,
        userSelect: "none",
        lineHeight: 1,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function ShortcutRow({ keys, description, theme }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "7px 0",
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <span
        style={{
          fontSize: "12.5px",
          color: theme.text2,
          fontFamily: theme.font || "inherit",
          flex: 1,
          minWidth: 0,
        }}
      >
        {description}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          flexShrink: 0,
        }}
      >
        {keys.map((key, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {i > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  color: theme.text3,
                  fontFamily: "monospace",
                  lineHeight: 1,
                }}
              >
                +
              </span>
            )}
            <KeyCap label={key} theme={theme} />
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({ section, theme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: theme.accent,
            boxShadow: `0 0 6px ${theme.accent}88`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "10px",
            fontWeight: "700",
            letterSpacing: "0.12em",
            color: theme.accent,
            textTransform: "uppercase",
          }}
        >
          {section.label}
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            background: `linear-gradient(to right, ${theme.accent}44, transparent)`,
          }}
        />
      </div>

      {/* Shortcut rows */}
      <div>
        {section.shortcuts.map((s, i) => (
          <ShortcutRow
            key={i}
            keys={s.keys}
            description={s.description}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}

export default function KeyboardShortcuts({ theme, onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const left = SHORTCUT_SECTIONS.slice(0, 2);
  const right = SHORTCUT_SECTIONS.slice(2);

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          background: theme.surface,
          border: `1px solid ${theme.border2}`,
          borderRadius: `${theme.r2 || theme.r || "10px"}`,
          overflow: "hidden",
          boxShadow: `
            0 0 0 1px ${theme.border},
            0 32px 80px rgba(0,0,0,0.7),
            0 0 60px rgba(${theme.accentRgb || "99,102,241"},0.08)
          `,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px 14px",
            borderBottom: `1px solid ${theme.border2}`,
            background: theme.surface2,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative corner accent */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "3px",
              height: "100%",
              background: `linear-gradient(to bottom, ${theme.accent}, ${theme.accent}00)`,
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Game-style icon */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                background: `${theme.accent}1a`,
                border: `1px solid ${theme.accent}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                flexShrink: 0,
              }}
            >
              ⌨
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: "13px",
                  fontWeight: "800",
                  letterSpacing: "0.18em",
                  color: theme.text,
                  textTransform: "uppercase",
                  lineHeight: 1.1,
                }}
              >
                KEYBOARD SHORTCUTS
              </div>
              <div
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: "9px",
                  letterSpacing: "0.08em",
                  color: theme.text3,
                  marginTop: "2px",
                }}
              >
                CONTROLS REFERENCE
              </div>
            </div>
          </div>

          {/* Accent line under title */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "24px",
              width: "160px",
              height: "2px",
              background: `linear-gradient(to right, ${theme.accent}, ${theme.accent}00)`,
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "6px",
              border: `1px solid ${theme.border2}`,
              background: theme.surface3,
              color: theme.text3,
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
              flexShrink: 0,
              fontFamily: "monospace",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.surface2;
              e.currentTarget.style.color = theme.text;
              e.currentTarget.style.borderColor = theme.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.surface3;
              e.currentTarget.style.color = theme.text3;
              e.currentTarget.style.borderColor = theme.border2;
            }}
          >
            ✕
          </button>
        </div>

        {/* Body — two-column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0",
            padding: "0",
          }}
        >
          {/* Left column */}
          <div
            style={{
              padding: "20px 24px",
              borderRight: `1px solid ${theme.border}`,
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {left.map((section, i) => (
              <Section key={i} section={section} theme={theme} />
            ))}
          </div>

          {/* Right column */}
          <div
            style={{
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {right.map((section, i) => (
              <Section key={i} section={section} theme={theme} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 24px",
            borderTop: `1px solid ${theme.border}`,
            background: theme.surface2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "9.5px",
              letterSpacing: "0.08em",
              color: theme.text3,
              textTransform: "uppercase",
            }}
          >
            Press{" "}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1px 5px",
                background: theme.surface3,
                border: `1px solid ${theme.border2}`,
                borderBottom: `2px solid ${theme.border2}`,
                borderRadius: "3px",
                fontSize: "9px",
                color: theme.text2,
                fontFamily: "monospace",
                boxShadow: `0 1px 0 ${theme.border2}`,
                position: "relative",
                top: "-0.5px",
              }}
            >
              Esc
            </span>{" "}
            to close
          </span>
          <span
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "9px",
              letterSpacing: "0.06em",
              color: `${theme.accent}88`,
            }}
          >
            TRACKFLOW
          </span>
        </div>
      </div>
    </div>
  );
}
