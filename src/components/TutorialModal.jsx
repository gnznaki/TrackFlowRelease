import { useState, useEffect, useCallback } from "react";
import { Icon, Icons } from "./Icon";

const SPOT_PAD = 14;

const STEPS = [
  {
    selector: null,
    title: "Welcome to TrackFlow",
    desc: "Your music projects, finally organized. Here's a quick look at what you can do — takes 30 seconds.",
  },
  {
    selector: "[data-board-scroll]",
    anchor: "center-bottom",
    title: "Your kanban board",
    desc: "Drag cards between columns to track every project. Right-click any card for quick actions like rename, duplicate, or delete.",
  },
  {
    selector: "[data-tutorial='sidebar']",
    anchor: "right",
    title: "Project groups",
    desc: "Organize tracks into albums, beat tapes, or EPs. Drag cards from the board straight onto a project to add them.",
  },
  {
    selector: "[data-tutorial='pages']",
    anchor: "below",
    title: "Multiple boards",
    desc: "Create separate boards for different sessions — beats, client work, collabs. Each board has its own columns and cards.",
  },
  {
    selector: "[data-tutorial='share']",
    anchor: "below",
    title: "Collaborate (Premium)",
    desc: "Share a board with your engineer, A&R, or co-producer with role-based access. Coming soon as a one-time upgrade.",
  },
  {
    selector: null,
    title: "One more thing",
    desc: "Open Settings to scan folders and auto-import all your .flp, .als, .ptx, and .rpp files. Click any card to open it directly in your DAW, or use the detail panel to add tags and notes.",
  },
];

export default function TutorialModal({ onClose, theme }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const C = theme;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const updateRect = useCallback(() => {
    if (!current.selector) { setRect(null); return; }
    const el = document.querySelector(current.selector);
    if (!el) { setRect(null); return; }
    setRect(el.getBoundingClientRect());
  }, [current.selector]);

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [updateRect]);

  const W = window.innerWidth;
  const H = window.innerHeight;

  function getTooltipPos() {
    const TW = 360;
    const MARGIN = 20;

    if (!rect) {
      return { left: W / 2 - TW / 2, top: H / 2 - 100 };
    }

    const anchor = current.anchor;

    if (anchor === "below" || anchor === "center-bottom") {
      const top = Math.min(rect.bottom + SPOT_PAD + MARGIN, H - 200);
      let left = rect.left + rect.width / 2 - TW / 2;
      left = Math.max(MARGIN, Math.min(W - TW - MARGIN, left));
      return { left, top };
    }
    if (anchor === "above") {
      let top = rect.top - SPOT_PAD - MARGIN - 180;
      top = Math.max(MARGIN, top);
      let left = rect.left + rect.width / 2 - TW / 2;
      left = Math.max(MARGIN, Math.min(W - TW - MARGIN, left));
      return { left, top };
    }
    if (anchor === "right") {
      const left = Math.min(rect.right + SPOT_PAD + MARGIN, W - TW - MARGIN);
      const top = Math.max(MARGIN, Math.min(H - 200, rect.top + rect.height / 2 - 90));
      return { left, top };
    }
    if (anchor === "left") {
      const left = Math.max(MARGIN, rect.left - SPOT_PAD - MARGIN - TW);
      const top = Math.max(MARGIN, Math.min(H - 200, rect.top + rect.height / 2 - 90));
      return { left, top };
    }

    return { left: W / 2 - TW / 2, top: H / 2 - 100 };
  }

  const tooltipPos = getTooltipPos();

  return (
    <>
      {/* Full-screen SVG overlay with spotlight cutout */}
      <svg
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 19998, pointerEvents: "all" }}
        onClick={e => { if (e.target.tagName === "rect" || e.target.tagName === "svg") return; }}
      >
        <defs>
          <mask id="tf-spotlight-mask">
            <rect x={0} y={0} width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.x - SPOT_PAD}
                y={rect.y - SPOT_PAD}
                width={rect.width + SPOT_PAD * 2}
                height={rect.height + SPOT_PAD * 2}
                rx={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark overlay */}
        <rect x={0} y={0} width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#tf-spotlight-mask)" />
        {/* Accent border around spotlight */}
        {rect && (
          <rect
            x={rect.x - SPOT_PAD}
            y={rect.y - SPOT_PAD}
            width={rect.width + SPOT_PAD * 2}
            height={rect.height + SPOT_PAD * 2}
            rx={8}
            fill="none"
            stroke={C.accent}
            strokeWidth={1.5}
            opacity={0.55}
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        style={{
          position: "fixed",
          left: tooltipPos.left,
          top: tooltipPos.top,
          width: 360,
          zIndex: 19999,
          background: C.surface,
          border: `1px solid ${C.border2}`,
          borderRadius: C.r2,
          boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px ${C.border}`,
          fontFamily: C.font || "Syne",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: i === step ? 18 : 5,
                  height: 5,
                  borderRadius: 3,
                  background: i === step ? C.accent : i < step ? C.accent + "44" : C.border2,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", padding: 3, display: "flex", lineHeight: 1, borderRadius: 4 }}
          >
            <Icon d={Icons.close} size={13} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 16px 12px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3 }}>
            {current.title}
          </div>
          <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.75 }}>
            {current.desc}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 14px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", fontSize: 11, fontFamily: C.font || "Syne", padding: "4px 0" }}
          >
            Skip
          </button>
          <div style={{ display: "flex", gap: 7 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${C.border2}`, borderRadius: C.r, color: C.text2, fontFamily: C.font || "Syne", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? onClose : () => setStep(s => s + 1)}
              style={{ padding: "7px 20px", background: C.accent, border: "none", borderRadius: C.r, color: C.accentText, fontFamily: C.font || "Syne", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              {isLast ? "Let's go" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
