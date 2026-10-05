# 34 · Offline-first boards (S18) — the biggest item

**Goal:** the app opens on a **local (offline) board** that works without internet. It stays local until the user decides to share it. The user is always redirected to their offline board. Live (shared) boards are shown only if the user hasn't been offline more than 5 hours.
**Platforms:** web + mobile (+ small server surface).

## Current state
- No board content is stored locally. Edits are dropped when `connection !== 'online'` (web store ~L441; mobile `commitLocal` ~L502). Reload = refetch from the server.
- Session persistence only for profile/recent list/PINs (web `localStorage`, mobile AsyncStorage).
- Mobile `src/app/index.tsx` opens `recent[0]` or creates a board on the server (`createBoard`); web routes `/b/:code`, `/board/:id` (`main.tsx`).
- Server: `POST /boards/import` creates a **new** board from a file (exists — reuse to share a local board). Snapshot GET gives full state; ops carry `seq`.

## Design decisions
1. **Local board = a client-only document** with id `loc_<uuid>`, saved as a snapshot (elements + camera) in persistent storage: web **IndexedDB** (via a ~30-line wrapper; `localStorage` has too small a quota for images), mobile **`expo-file-system`** JSON file (already a dependency; Expo v57 API — read its docs first per `mobile/AGENTS.md`) or AsyncStorage for small boards. Debounced write (~500 ms) on every commit + on app background/`pagehide`.
2. **Same store, different backend:** `connection` gets a new state `'local'`. `commitLocal`/`ops` stop dropping edits when local: apply + persist + keep undo/redo. The sync hook (`use-board-sync.ts`) is skipped for `loc_*` ids.
3. **Share = promote:** "Share" on a local board calls `POST /boards/import` with the serialised board (existing `serialization.ts` format `live-whiteboard` v1), then redirects to `/board/<newId>` and records `localBoard.sharedAs = newId`. Decision to confirm with the user: after sharing, does the local board *become* the live board (mirror) or remain a private copy? **Default: the local copy stays a private snapshot; the shared board is a separate live board** (simplest, no merge conflicts).
4. **Redirect rule:** entry route (`/` on web, `app/index.tsx` on mobile) always opens the user's local board (create one if none). Other routes (`/b/:code`, deep links) still open the live board they point to.
5. **5-hour rule:** persist `lastOnlineAt` (updated on each successful socket/API contact; throttled to 1/min). On app open, if `now − lastOnlineAt ≤ 5 h` the boards list (BoardsSheet) shows recent live boards; if > 5 h hide them (and don't auto-reconnect to them) until a connectivity check succeeds again and, **to confirm with the user**, whether "hasn't been offline more than 5 hours" means they're hidden while offline-too-long or again hidden until next successful online use. Default: hidden when offline *and* the last contact was > 5 h ago; shown again as soon as the app reaches the server.
6. **Multiple local boards?** The to-do says "his offline board" (singular). Start with one; the storage key is per-board id so a list is a later extension.

## Steps
1. Persistence layer (`board-local.ts` per app): `loadLocal()`, `saveLocal(snapshot)`, `lastOnlineAt` get/set.
2. Store: `connection: 'local'`, `loadLocalBoard()`, remove the "drop edits offline" guard for local boards only (live boards keep their outbox behaviour).
3. Routing/entry changes (web `main.tsx`/`pages/Start.tsx`, mobile `app/index.tsx`).
4. Header: show a "Local" badge instead of the connection banner; the Share button promotes (ShareSheet gets a "Create shareable board" step first).
5. `lastOnlineAt` writes in `use-board-sync.ts` + BoardsSheet filtering; the connectivity check = `GET /health`.
6. AI works only when online: disable the AI button with an explanation when `navigator.onLine` is false / no connection.
7. Images: store as data URLs/files in the snapshot (check size; cap or warn).
8. Tests: a Node script round-tripping `saveLocal → loadLocal` and `serialization` import; manual: airplane mode create/edit/restart; share while online; 5-hour rule by faking `lastOnlineAt`.

## Risks
- Largest change: touches both stores, routing, session, header, sharing. Do web first, then mirror to mobile (memory: *mirror fixes*), and keep the worktree clean of the user's WIP (memory: *dirty worktrees*; use a feature branch per project per *git workflow*).
- Android storage/file APIs differ by SDK — read the v57 docs first.

## Verification
- Airplane mode: open the app → local board → draw → kill/restart → the drawing is still there. Online: Share → live board opens with the same content. Set `lastOnlineAt` to 6 h ago + offline → live boards hidden.
