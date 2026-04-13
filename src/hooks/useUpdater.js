import { useState, useEffect } from "react";

export default function useUpdater() {
  const [update, setUpdate] = useState(null);
  const [status, setStatus] = useState(null); // null | "downloading" | "installing" | "error"
  const [errorMsg, setErrorMsg] = useState(null);
  const [pct, setPct] = useState(0);

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
    if (!update?.raw || status === "downloading" || status === "installing") return;

    setStatus("downloading");
    setPct(0);
    setErrorMsg(null);

    try {
      let downloaded = 0;
      let total = 0;

      await update.raw.downloadAndInstall(event => {
        switch (event.event) {
          case "Started":
            total = event.data?.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data?.chunkLength ?? 0;
            if (total > 0) setPct(Math.round((downloaded / total) * 100));
            break;
          case "Finished":
            setStatus("installing");
            break;
        }
      });

      // downloadAndInstall resolves when install is done — relaunch
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.error("[updater] failed:", e);
      setErrorMsg(e?.message ?? String(e));
      setStatus("error");
    }
  }

  function dismiss() { setUpdate(null); setStatus(null); setErrorMsg(null); }

  return { update, status, pct, errorMsg, installUpdate, dismiss };
}
