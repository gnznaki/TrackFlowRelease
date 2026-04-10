import { useState, useEffect } from "react";

export default function useUpdater() {
  const [update, setUpdate] = useState(null); // { version, body }
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) return;
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const result = await check();
        if (!cancelled && result) {
          setUpdate({ version: result.version, body: result.body, raw: result });
        }
      } catch {
        // Silently ignore — no network, endpoint not set up yet, etc.
      }
    }

    // Delay slightly so it doesn't compete with app startup
    const t = setTimeout(checkForUpdate, 4000);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  async function installUpdate() {
    if (!update?.raw) return;
    setInstalling(true);
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await update.raw.downloadAndInstall();
      await relaunch();
    } catch {
      setInstalling(false);
    }
  }

  return { update, installing, installUpdate, dismiss: () => setUpdate(null) };
}
