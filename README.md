# TrackFlow

A native desktop app for music producers and audio engineers to track DAW projects through a customizable kanban-style workflow.

Built with **Tauri 2** (Rust backend) + **React 18** (Vite frontend).

---

## What It Does

TrackFlow replaces the mental overhead of tracking "where is this beat at?" across dozens of open projects. Drop your DAW files onto cards, move them through workflow columns as work progresses, and know at a glance what needs attention.

Two built-in workflow modes:

| Producer | Engineer |
|---|---|
| Raw Ideas | Tracking |
| Has Potential | Editing |
| In Arrangement | Needs Mixing |
| Completed Beats | Mastering |
| | Delivered |

---

## Features

- **Kanban boards** — drag-and-drop cards across columns, reorder columns within rows, reorder rows
- **DAW file tracking** — scan watched folders for `.flp` (FL Studio), `.als` (Ableton Live), `.ptx` (Pro Tools) files
- **Multiple pages** — create unlimited custom boards beyond the two defaults
- **Real-time collaboration** — share any board via a code; collaborators get live updates (editor/viewer roles)
- **Cloud sync** — state persists to Supabase across devices when signed in
- **Offline mode** — fully functional without an account; state saved locally via Tauri
- **Custom themes** — four built-in presets (default, tabkiller, daves, findanote) + full hex color customization
- **Custom tags** — color-coded labels per card
- **Sort & filter** — sort cards by name, date, or custom order; filter by tag
- **Discord webhooks** — post card updates to a Discord channel
- **Auto-updater** — GitHub Releases-based OTA updates via `@tauri-apps/plugin-updater`
- **Project sidebar** — organize songs into named project groups
- **Error reporting** — crash reports posted to a Discord webhook via `ErrorBoundary`

---

## Pricing

| Free | Premium ($15 one-time) |
|---|---|
| Unlimited local boards | Everything in Free |
| Offline mode | Real-time collaboration |
| All themes + customization | Cloud sync across devices |
| DAW file scanning | Board sharing with team |

---

## Development Phases

### Phase 0 — Foundation
Initial Tauri + React scaffold. Basic kanban board with two hardcoded modes (Producer / Engineer). Local state persistence via Rust `save_state` / `load_state` commands. Drag-and-drop via `@dnd-kit/core`.

### Phase 1 — Auth
Supabase authentication added (`useAuth` hook). Email/password sign-in and sign-up with offline fallback mode. Auth screen with premium UI, resend confirmation support, and password reset flow.

### Phase 2 — Cloud Sync
Board state persisted to Supabase `app_state` table for cross-device sync. State migration layer (`migrateState`) handles schema upgrades from older local saves without data loss.

### Phase 3 — Real-Time Collaboration
`useCollabBoard` hook built on Supabase Realtime broadcast channels. Share any board with a code; peers receive live column/card updates. `board_members` table tracks owner / editor / viewer roles. Viewers see the board read-only.

### Phase 4 — Billing & Tiers
Stripe integration via Supabase Edge Functions. `CheckoutModal` and `UpgradeModal` for payment flows. `useTier` hook reads `profiles.tier` with live Postgres subscription. Premium tier unlocks collab and cloud sync.

### Phase 5 — Architecture Refactor
Monolithic `App.jsx` split into components (`Column`, `DetailPanel`, `ProjectSidebar`, `ThemeCustomizer`, `SettingsPanel`, `TagManager`, `SortFilterDropdown`, `ShareModal`, `ProfileModal`) and lib modules (`theme`, `constants`, `migrate`, `discord`, `stripe`, `supabase`). iOS-style column drag added.

### Phase 6 — Pages & Multi-Board
State shape migrated from two hardcoded boards to a generic `pages` array. Each page has independent columns, layout, and a `boardId` for collab. Context menu on page tabs for rename, color, duplicate, delete.

### Phase 7 — Polish & Bug Fixes
- Custom RAF-based card-drag scroll (replaces dnd-kit autoScroll which scrolled the wrong container)
- `RowDropZone` extracted outside `App()` to prevent scroll position resets on re-render
- Column drag constrained to same row; new row created on downward drag
- Background tint tracks active page color
- Profile system: display name, avatar color, account creation date
- Auth screen redesign with premium feel

---

## Tech Stack

| Layer | Tech |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | React 18 + Vite |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable |
| Auth & DB | Supabase (Auth + Postgres + Realtime) |
| Payments | Stripe (via Supabase Edge Functions) |
| Auto-updater | @tauri-apps/plugin-updater + GitHub Releases |
| Styling | Inline CSS-in-JS with computed theme tokens |

---

## Commands

```bash
# Frontend only (fast dev loop)
npm run dev

# Full desktop app (requires Rust toolchain)
npm run tauri dev

# Build installer
npm run tauri build
```

---

## Environment

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

The app works offline without these set — Supabase features are silently disabled when unconfigured.

---

## State Persistence

State is saved to `AppData/trackflow-state.json` (via Tauri) and optionally to Supabase for cloud sync. The `migrateState()` function handles all schema upgrades forward-compatibly so old saves always load cleanly.
