import { useState, useEffect } from "react";

export default function useUpdater() {
  const [update, setUpdate] = useState(null); // { version, body }
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(null); // "Downloading… 42%" | "Installing…" | null
  const [updateError, setUpdateError] = useState(null);

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
      } catch (e) {
        console.warn("[updater] check failed:", e);
      }
    }

    const t = setTimeout(checkForUpdate, 4000);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  async function installUpdate() {
    if (!update?.raw || installing) return;
    setInstalling(true);
    setUpdateError(null);
    setProgress("Starting download…");

    try {
      let downloaded = 0;
      let total = 0;

      await update.raw.downloadAndInstall(event => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          setProgress("Downloading…");
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength ?? 0;
          if (total > 0) {
            const pct = Math.round((downloaded / total) * 100);
            setProgress(`Downloading… ${pct}%`);
          }
        } else if (event.event === "Finished") {
          setProgress("Installing…");
        }
      });

      setProgress("Relaunching…");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.error("[updater] install failed:", e);
      setUpdateError(e?.message ?? String(e));
      setInstalling(false);
      setProgress(null);
    }
  }

  return { update, installing, progress, updateError, installUpdate, dismiss: () => { setUpdate(null); setUpdateError(null); } };
}
