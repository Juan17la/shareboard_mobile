# 35 · Close the gaps with other live whiteboards

**Goal:** finish `tasks-missing.md` (repo root) so Shareboard holds up next to
Excalidraw, tldraw, Miro, FigJam and Microsoft Whiteboard **for our users**:
class groups, mostly on phones, brainstorming and diagramming.
**Platforms:** web + mobile + server. Every store / geometry / canvas change is a
hand-mirrored twin (memory: *mirror fixes web↔mobile*). Web first, then mobile,
in the same round.

## Current state (checked 2026-10-24)

- Two items in `tasks-missing.md` are already done elsewhere: **offline editing**
  (`tasks-ux.md` U3, "keep drawing, it syncs when you're back online") and the
  **keyboard shortcut sheet** (`tasks-bugs.md` B5 / U6). Tick them.
- **The server whitelists element fields.** `server/src/model/validate.ts`
  (`validateElement`, `validatePatch`) drops or rejects anything it doesn't know,
  so every new field touches four files: `server/src/model/types.ts` +
  `validate.ts`, `web/src/lib/contract.ts`, `mobile/src/features/board/model.ts`.
- **Renderers switch on `kind`** (`web/src/components/board/renderer.ts`). A new
  `kind` is invisible, or worse, on an older installed APK.
- **The `preview` channel exists** (`protocol.ts`, `Preview`): relayed, never
  stored, rate-limited. Anything ephemeral (laser, reactions, follow) can ride
  on it or on a sibling message instead of a new storage path.
- The `shareboard:v1:` clipboard codec (`clip.ts`, both apps) and
  `cloneElements` already serialise and re-insert a selection. Templates and
  the library reuse them.
- `tasks-performance.md` P1–P8 are still open. Snapping guides, the lasso and
  the laser all redraw on every move, so do **P1 (in-progress layer) and P2
  (culling) before Phase 2**. Otherwise every new overlay makes the lag worse.

## Design rules for this round

1. **Add optional fields to existing kinds, not new kinds.** An older client
   then draws something sensible: a sticky as a filled rectangle with a label,
   a frame as a titled rectangle. The only new wire concepts are ephemeral
   messages.
2. **One schema round, one server deploy.** Every new field goes into the
   server (types + validate + tests) first, in a single change, before any
   client uses it. Deploy, then ship the clients.
3. **Client-only first.** Most of the list needs no server at all. Do those
   while the schema change is in review.
4. Each item ends with a case in both `test/geometry.mjs` when it has geometry,
   and a manual check on web + the Android release APK (memory: *local testing*).

## Phase 0 — Schema round (server, ~1 day)

Add these to `types.ts` / `validate.ts` / `contract.ts` / `model.ts` in one go:

| Field | On | Used by |
|---|---|---|
| `locked?: boolean` | `ElementBase` | Lock |
| `link?: string` (http/https only, ≤ 2,000 chars) | `ElementBase` | Links |
| `sticky?: boolean` | `ShapeElement` (rectangle) | Sticky notes (auto-fit label, note shadow) |
| `frame?: boolean` | `ShapeElement` (rectangle; `text` = frame name) | Frames |
| `tool?: 'highlighter'` | `StrokeElement` | Highlighter |
| `widths?: number[]` (one per point, same length/2 as `points`) | `StrokeElement` | Variable-width ink |
| `crop?: {x,y,w,h}` (fractions 0..1) | `ImageElement` | Image crop |

- Server: `locked` elements refuse `update`/`delete` from everyone except an
  `update` that sets `locked: false` (in `ws/hub.ts`, next to the
  selection-hold check). Send the same `from: 'server'` correction it already
  uses.
- New ephemeral messages in `protocol.ts` (+ both client copies):
  `{type:'viewport', at, zoom}` for follow, `{type:'react', emoji, at}`,
  `{type:'summon'}`, `{type:'timer', endsAt|null}`. All relayed, never stored,
  and under the existing rate limiter.
- Tests in `server/test`: each field round-trips, a bad `link` scheme is
  refused, a locked element refuses a move.

## Phase 1 — P1 items (core drawing)

| # | Item | Approach | Size |
|---|---|---|---|
| 1.1 | **Sticky notes** | A toolbar tool that drops a 200×200 `rectangle` with `sticky:true`, a pastel fill, and the text editor already open. The label font shrinks to fit the box (a `fitFontSize(text, box)` helper in geometry, twinned). Tap-tap-tap makes several in a row on mobile. | M |
| 1.2 | **Snapping + alignment guides** | In the move/resize gesture: collect the edges and centres of the **visible** elements (needs P2 culling), snap within 6 screen-px, and draw guide lines on the overlay layer. A grid-snap toggle in Settings uses the existing dot-grid spacing. Hold Alt (web) to bypass. | L |
| 1.3 | **Lock** | `locked` field. The context menu / hold menu gets Lock ↔ Unlock. A locked element can't be selected by tap or marquee, only via a "Locked" chip in the menu, and shows a small lock icon on hover. | S |
| 1.4 | **Lasso** | A selection-mode toggle (rectangle ↔ lasso) on the cursor tool; mobile default lasso. Point-in-polygon on each element's sample points (`geometry.ts`, twinned + tested). | M |

## Phase 2 — P2 for class groups

| # | Item | Approach | Size |
|---|---|---|---|
| 2.1 | **Templates** | 5 JSON files (brainstorm, retro, flowchart, Kanban, mind map) in `shareboard:v1:` format, shipped with both apps. Inserted at the viewport centre through the paste path (`cloneElements`). A "Templates" entry in the board menu + the empty-board hint. Background frames come in `locked`. | M |
| 2.2 | **Highlighter** | `tool:'highlighter'`: 40 % alpha, wide, drawn in a pass **under** ink and shapes (z-sort key). A pen-picker option, not a new toolbar button. | S |
| 2.3 | **Laser pointer** | A tool that sends only `preview` (a fading trail, never committed). Peers fade it out after 1 s. No storage. | S |
| 2.4 | **Variable-width ink** | Add `perfect-freehand` (≈3 KB, no deps) to both apps. Use real pressure where the platform gives it (web `PointerEvent.pressure` for pen; Android stylus) and simulated (speed-based) otherwise. Store `widths`, not the outline, so the server limits stay as they are. Old clients draw it at constant width. | M |
| 2.5 | **Reactions, voting, timer** | Reactions: the `react` message, an emoji that floats up at the sender's cursor. Voting: a "Vote" mode that adds a small coloured dot shape (an ordinary element, so it is counted and stored) and a per-person limit kept on the client. Timer: the `timer` message, a countdown pill in the header for everyone. Comments are moved to Phase 4 (they need storage and threads). | M |
| 2.6 | **Follow / summon** | Each client sends `viewport` (throttled to 5 Hz, only while someone follows it). Tap a person in the People sheet → "Follow": the camera tracks theirs until you pan. "Bring everyone to me" sends `summon`, and the others jump to your viewport. | M |
| 2.7 | **Version history** | The server keeps a snapshot every N ops / 10 min (cap 20 per board, Mongo, `store/boards.ts`). `GET /boards/:id/versions` lists them; restore = a `clear` + `add` batch through the normal op path, so undo and peers just work. Creator-only. A "History" sheet with timestamps + thumbnails (the existing PNG export). | L |

## Phase 3 — P2 for developer users

| # | Item | Approach | Size |
|---|---|---|---|
| 3.1 | **Frames** | `frame:true` rectangle, its name drawn above the top-left corner, drawn under everything. Membership is geometric (what is inside when it moves), so no parent ids. "Export frame" reuses PNG export with the frame's box. Presenting = zoom to fit each frame in turn. Skip separate **pages**; frames cover the need. | M |
| 3.2 | **Align / distribute / flip** | Pure geometry on the selection (twinned + tested): six align buttons, two distribute buttons, flip H/V (mirror `points` / `from`/`to` / vertices; text is not mirrored). Shown in the multi-select options strip. | S |
| 3.3 | **Copy / paste style** | Copy the style subset (`stroke`, `fill`, `strokeWidth`, `dash`, `font`, `fontSize`, `opacity`, `rounded`, markers) into memory. Paste applies it as one `update` batch. Ctrl+Alt+C / V on web, two hold-menu items on mobile. | S |
| 3.4 | **Links / embeds** | `link` field: a chip on the element opens it (`Linking.openURL` on mobile, a new tab with `noopener` on web). Embeds: pasting a YouTube or Figma URL makes an image element of the thumbnail + `link`. No iframes on the canvas (cost, security). | S |
| 3.5 | **Search** | Ctrl+F (web) / menu item (mobile): a filter over `text` of texts and labels, ↑/↓ cycles results, the camera zooms to each. | S |
| 3.6 | **Library** | "Add to library" on a selection stores a `shareboard:v1:` string with a name in local storage (web IndexedDB / mobile file, like `board-local`). A Library sheet inserts it through paste. Account sync later. | M |

## Phase 4 — P3 polish

| # | Item | Approach | Size |
|---|---|---|---|
| 4.1 | **Export 2× / 3× / PDF** | A scale picker in the Export sheet. Raise the cap in step with the zoom limits. PDF on web via `print()` on a page holding the image (no library). On mobile via `expo-print` if it is already installed, otherwise skip PDF on mobile. | S |
| 4.2 | **Partial eraser** | An eraser mode that cuts strokes: split `points` where they fall inside the eraser circle → one `delete` + N `add` ops. Strokes only; shapes stay whole-element. | M |
| 4.3 | **Image crop** | `crop` field. A crop handle mode on a selected image; the renderer draws the source sub-rect. | M |
| 4.4 | **Comments** | Pinned comment threads: a separate server collection keyed by board, not elements, so the 5,000-element limit and ops stay clean. Only if classes ask for it after 2.5. | L |

## Order and milestones

1. Perf P1 + P2 (prerequisite) → **Phase 0** schema + deploy.
2. **M1 "Brainstorm-ready":** 1.1 sticky, 1.3 lock, 2.1 templates, 2.2 highlighter, 2.3 laser, 2.5 reactions/vote/timer. This is the class use case and mostly S/M.
3. **M2 "Diagram-ready":** 1.2 snapping, 1.4 lasso, 3.2 align/flip, 3.3 style, 3.1 frames, 3.5 search.
4. **M3 "Trust":** 2.7 history, 2.6 follow, 2.4 pressure ink, 3.4 links, 3.6 library.
5. **M4 polish:** Phase 4.

Each milestone ships with: the features ticked in `tasks-missing.md`, a
`CHANGELOG.md` entry in each repo, the user guide (`mobile/docs/user-guide`)
updated, and one feature branch per repo merged `--no-ff` into `develop`
(memory: *git workflow*).

## Risks

- **Old APKs + new fields:** decision rule 1 covers rendering, but a locked
  element is still editable on an old client until the server refuses it. The
  server check is the real lock, so make sure the correction arrives cleanly.
- **Snapping on a 5,000-element board:** only snap against visible elements,
  and cap at the nearest ~200.
- **Android stylus pressure** through react-native-gesture-handler is not
  verified. Fall back to simulated pressure, and check on the emulator early.
- **Server cold start (perf P11)** also hurts history and every live feature.
  Fix it before classroom testing.

## Verification

- Per milestone: two browsers + the Android APK on one board. Each new element
  shows up identically on all three, survives a reload, and an older APK build
  draws the new fields in their fallback form.
- `npm run check:geometry` in web and mobile, `npm test` in server, `tsc -b` + `npm run lint`.
- Re-run the 2026-10-22 audit harness after Phase 2, to confirm the new overlays
  didn't bring the per-move repaint back.
