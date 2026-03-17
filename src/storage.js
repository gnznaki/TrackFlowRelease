import { invoke } from "@tauri-apps/api/core";
import { supabase } from "./lib/supabase";

export const SCHEMA_VERSION = 2;

let saveTimer = null;

async function getCurrentUserId() {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch { return null; }
}

// Debounced save: always writes locally, then syncs to Supabase in background
export function saveState(data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const payload = { ...data, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() };

    // Local save — always happens first, never lost even if cloud is down
    try { await invoke("save_app_state", { state: JSON.stringify(payload) }); }
    catch (e) { console.error("[storage] local save failed:", e); }

    // Cloud sync — fire-and-forget, doesn't block the UI
    const userId = await getCurrentUserId();
    if (userId && supabase) {
      supabase.from("app_state")
        .upsert({ id: userId, state: payload, schema_version: SCHEMA_VERSION })
        .then(({ error }) => { if (error) console.warn("[storage] cloud sync failed:", error.message); });
    }
  }, 800);
}

// Load state: prefer cloud if logged in and newer, fall back to local
export async function loadState() {
  // Always read local first — it's fast and always available
  let local = null;
  try {
    const raw = await invoke("load_app_state");
    if (raw && raw !== "") local = JSON.parse(raw);
  } catch (e) {}

  // Try cloud if configured and user is signed in
  const userId = await getCurrentUserId();
  if (userId && supabase) {
    try {
      const { data, error } = await supabase
        .from("app_state")
        .select("state, updated_at")
        .eq("id", userId)
        .single();

      if (!error && data?.state) {
        const cloudMs = new Date(data.updated_at).getTime();
        const localMs = local?.updatedAt ?? 0;

        if (cloudMs > localMs) {
          // Cloud is newer — write it back to local so next offline load is current
          try { await invoke("save_app_state", { state: JSON.stringify(data.state) }); } catch (e) {}
          return data.state;
        }
      }
    } catch (e) {
      console.warn("[storage] cloud load failed, using local:", e);
    }
  }

  return local;
}

export async function backupState() {
  try { return await invoke("backup_app_state"); }
  catch (e) { return null; }
}
