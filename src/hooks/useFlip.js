import { useRef, useLayoutEffect } from "react";

/**
 * FLIP animation hook for list reordering.
 * Call capture() right before a state update that reorders elements.
 * Each tracked element needs a ref registered via setRef(key).
 */
export function useFlip() {
  const snapRef = useRef({});
  const elsRef = useRef({});
  const doFlip = useRef(false);

  // Runs after every render but exits immediately unless capture() was called
  useLayoutEffect(() => {
    if (!doFlip.current) return;
    doFlip.current = false;

    Object.entries(elsRef.current).forEach(([key, el]) => {
      if (!el || !snapRef.current[key]) return;
      const old = snapRef.current[key];
      const cur = el.getBoundingClientRect();
      const dx = old.left - cur.left;
      const dy = old.top - cur.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.position = "relative";
      el.style.zIndex = "2";
      el.getBoundingClientRect(); // force reflow
      el.style.transition = "transform 220ms cubic-bezier(0.2, 0, 0, 1)";
      el.style.transform = "";
      el.addEventListener("transitionend", () => {
        el.style.transition = "";
        el.style.position = "";
        el.style.zIndex = "";
      }, { once: true });
    });
  });

  /** Call immediately before the state update that will reorder elements. */
  function capture() {
    doFlip.current = true;
    // Cancel any running FLIP first so getBoundingClientRect returns layout position
    Object.values(elsRef.current).forEach(el => {
      if (el) { el.style.transition = "none"; el.style.transform = ""; }
    });
    snapRef.current = {};
    Object.entries(elsRef.current).forEach(([key, el]) => {
      if (el) snapRef.current[key] = el.getBoundingClientRect();
    });
  }

  /** Returns a ref callback for the given key. Assign to element's ref prop. */
  function setRef(key) {
    return el => { elsRef.current[key] = el; };
  }

  return { capture, setRef };
}
