import { invoke } from "@tauri-apps/api/core";

let saveTimer = null;

export function saveState(data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await invoke("save_app_state", { state: JSON.stringify(data) }); }
    catch (e) { console.error("Failed to save:", e); }
  }, 800);
}

export async function loadState() {
  try {
    const raw = await invoke("load_app_state");
    if (!raw || raw === "") return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export async function backupState() {
  try { return await invoke("backup_app_state"); }
  catch (e) { return null; }
}
