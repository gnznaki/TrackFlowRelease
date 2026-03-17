# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

There are no lint or test commands configured in this project.

## Architecture

TrackFlow is a Tauri desktop app for organizing DAW projects. It has two layers:

**Frontend** (`src/`) — React 18 + Vite, no routing, essentially a single large component:
- `App.jsx` — The entire UI (~1560 lines). Contains all state, logic, and rendering. Two workflow modes (Producer/Engineer), each with independent kanban boards.
- `scanner.js` — Recursively scans directories for `.flp`, `.als`, `.ptx` files.
- `storage.js` — Debounced auto-save (800ms) to the Rust backend. Handles backup creation.
- `ErrorBoundary.jsx` — Catches React errors and posts crash reports to a Discord webhook.

**Backend** (`src-tauri/src/main.rs`) — Minimal Rust layer exposing Tauri commands:
- File operations (open DAW files, get metadata)
- State persistence (save/load/backup `trackflow-state.json` in AppData)
- Auto-updater integration

## State Shape

State is persisted to `AppData/trackflow-state.json`. The root shape:

```js
{
  mode: "producer" | "engineer",
  producerCols: [{ id, title, color, cards: [] }],
  engineerCols: [{ id, title, color, cards: [] }],
  producerLayout: [[colId, colId], [colId]],  // rows of column IDs
  engineerLayout: [[colId, colId], [colId]],
  projects: [{ id, title, color, songs: [] }], // sidebar project library
  watchedFolders: [path],
  customTags: [{ label, color }],
  themePreset: "default" | "daves" | "tabkiller" | "findanote",
  themeCustom: { bg, cardBg, borderHex, accent, font },
  collapsedCols: [colId],
  lockedCols: [colId],
  discordWebhook: ""
}
```

## Drag-and-Drop System

Uses `@dnd-kit/core` with `closestCenter` collision detection. Three DnD contexts:
1. Cards between/within columns
2. Columns within rows (horizontal reorder)
3. Rows (vertical reorder via up/down buttons)

## Tauri IPC Pattern

Frontend calls Rust via `invoke()` from `@tauri-apps/api/core`:

```js
import { invoke } from "@tauri-apps/api/core";
await invoke("save_state", { state: JSON.stringify(appState) });
await invoke("load_state");
await invoke("open_file", { path: "/path/to/project.flp" });
```

New Rust commands must be registered in `main.rs` with `#[tauri::command]` and added to `.invoke_handler(tauri::generate_handler![...])`.

## DAW File Types

- `.flp` — FL Studio (orange badge)
- `.als` — Ableton Live (cyan badge)
- `.ptx` — Pro Tools (blue badge)
