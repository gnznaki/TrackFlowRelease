# DEV.md — TrackFlow Developer Guide

## Commands

```bash
# Development
npm run dev          # Start Vite dev server (port 1420) — frontend only, no Tauri
npm run tauri dev    # Start full Tauri desktop app (Rust + React)

# Build
npm run build        # Build frontend with Vite (output: dist/)
npm run tauri build  # Build full desktop app installer

# Preview
npm run preview      # Preview production frontend build
```

No lint or test commands configured.

## Architecture

TrackFlow is a Tauri 2 desktop app. Two layers:

**Frontend** (`src/`) — React 18 + Vite, no routing:
- `App.jsx` — Main UI (~1500 lines). All state, logic, and rendering. Producer/Engineer workflow modes.
- `scanner.js` — Recursively scans directories for `.flp`, `.als`, `.ptx` files.
- `storage.js` — Debounced auto-save (800ms) to the Rust backend. Handles backup creation.
- `ErrorBoundary.jsx` — Catches React errors and auto-reports to the crash webhook.

**Backend** (`src-tauri/src/main.rs`) — Minimal Rust layer:
- File operations (open DAW files, get metadata)
- State persistence (save/load/backup `trackflow-state.json` in AppData)

## State Shape

Persisted to `%APPDATA%\com.trackflow.app\trackflow-state.json`:

```js
{
  mode: "producer" | "engineer",
  pages: [{ id, columns: [], layout: [] }],
  projects: [{ id, title, color, songs: [] }],
  watchedFolders: [path],
  customTags: [{ label, color }],
  themePreset: "default" | "daves" | "tabkiller" | "findanote",
  themeCustom: { bg, cardBg, borderHex, accent, font },
  collapsedCols: [colId],
  lockedCols: [colId],
  colMaxHeight: 500
}
```

## Drag-and-Drop

Uses `@atlaskit/pragmatic-drag-and-drop`. Three contexts:
1. Cards between/within columns
2. Columns within rows (horizontal reorder)
3. Rows (vertical reorder via up/down buttons)

Custom RAF-based auto-scroll replaces dnd-kit's built-in scroll.

## Tauri IPC Pattern

```js
import { invoke } from "@tauri-apps/api/core";
await invoke("save_app_state", { state: JSON.stringify(appState) });
await invoke("load_app_state");
await invoke("open_daw_file", { path: "/path/to/project.flp" });
```

New Rust commands: add `#[tauri::command]` fn in `main.rs`, register in `.invoke_handler(tauri::generate_handler![...])`, and add permission to `src-tauri/capabilities/default.json`.

## DAW File Types

- `.flp` — FL Studio (orange `#ff8c00`)
- `.als` — Ableton Live (cyan `#47c8ff`)
- `.ptx` — Pro Tools (blue `#4780ff`)

## Tier System

- DB values: `free`, `premium`, `ongoing`
- `useTier.js` reads from Supabase `profiles` table
- To gate features: use `isPaid` (premium or ongoing) from `useTier()`
- Premium features are "Coming Soon" — UpgradeModal shows preview only, no checkout
- Flip the gates when Stripe goes live

## Crash Reporting

Errors auto-report to a baked Discord webhook in `src/lib/discord.js`. No user configuration needed. `postToDiscord(title, message, color)` is the only export.
