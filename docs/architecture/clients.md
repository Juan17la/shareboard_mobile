# Client internals

The web app and the Android app are separate code bases with the same design.
Most of their logic exists twice, as twins kept in step by hand:

| Concern | Web (`web/src/…`) | Mobile (`mobile/src/…`) |
|---------|-------------------|-------------------------|
| Contract types | `lib/contract.ts` | `features/board/model.ts`, `services/realtime/protocol.ts` |
| Board state | `features/board-store.ts` | `features/board/store.ts` |
| Geometry | `lib/geometry.ts` | `features/board/geometry.ts` |
| Applying ops | `lib/ops.ts` | `features/board/ops.ts` |
| REST client | `lib/api.ts` | `services/api/` |
| WebSocket | `lib/socket.ts` | `services/realtime/socket.ts` |
| Join + sync | `hooks/use-board-sync.ts` | `hooks/use-board-sync.ts` |
| Session | `features/session.ts` | `features/session/store.ts` |
| Offline board | `features/board-local.ts` | `features/board/local.ts` |
| Export / import | `features/export.ts`, `features/import.ts` | `features/board/export.ts`, `import.ts` |
| Picture-embedded boards | `lib/embed.ts` | `features/board/embed.ts` |
| SVG export | `lib/svg.ts` | `features/board/svg.ts` |
| QR codes | `lib/qr.ts` | `features/qr/encode.ts` |
| Strings (ES/EN) | `features/strings.ts` | `features/i18n/strings.ts` |
| Canvas | `components/board/BoardCanvas.tsx` + `renderer.ts` (Canvas 2D) | `components/board/BoardCanvas.tsx` + `ElementRenderer.tsx` (Skia) |

When a bug is fixed in one, check the twin.

## Screens and navigation

There is no home page. Both apps have three routes:

| Web | Mobile | |
|-----|--------|--|
| `/` | `app/index.tsx` | Opens the device's offline board (creating it the first time). Only if the device cannot store it, falls back to the last board, or a new live one |
| `/b/:code` | (deep link) | Resolves a short code and redirects to the board |
| `/board/:id` | `app/board/[id].tsx` | The board |

Everything else (new board, join, my boards, import, settings, share,
permissions, people, export, AI) is a **sheet** opened from the board's header
or menu. On mobile, switching from one board to another uses
`router.setParams` on the same screen, so two board screens never compete for
the shared board store.

## State: the board store

Both apps keep one [zustand](https://github.com/pmndrs/zustand)-style store per
open board, holding:

- `meta`, `you`, `participants`, `connection`, `serverSeq`, `boardToken`;
- `elements` (a map by id) and a local `zCounter`;
- the active `tool` and its options, the `camera`, the `selectedIds`;
- the **outbox** of ops waiting to be sent, and the undo/redo stacks;
- a clipboard that survives switching boards.

The one rule: **every real change goes through `commitLocal(ops)`**, which in a
single step

1. records the inverse of `ops` on the undo stack (computed before applying),
2. applies `ops` to `elements`,
3. appends them to the outbox.

`commitLocal` refuses changes while a live board is offline. Ops from the
server go through `applyRemote` instead, which skips both the outbox and the
undo history. Details of the round trip are in
[Communication](communication.md#how-a-change-travels).

History entries can be **merged** (typing the text you just placed is part of
placing it) or **replaced** (a text placed and left empty never happened), so
one gesture is one undo step.

Selections, the camera and live drags are never sent as ops. A drag previews
locally and commits once, on release, as one op per element.

## Sync hook (`use-board-sync`)

Ties a board screen to the server, and exposes a `phase`:
`loading → need-nickname / need-pin → ready` (or `error`).

- **Live board:** `GET /boards/:id` → `POST /join` → open the socket. On
  `joined` it hydrates the store, re-sends the selection, and records the board
  in *recent boards*. It subscribes to the store and drains the outbox through
  a 50 ms throttle. It sends the cursor and the selection, throttled to 45 ms.
  It reconnects when the tab or app comes back to the foreground.
- **Offline board** (`loc_…` ids): no network at all. The board is read from
  local storage, and every change is written back half a second after the last
  edit (and when the page is hidden).
- **Five-hour rule:** each time the server answers, the time is stored. Live
  boards are listed in *My whiteboards* only if the server answered in the last
  five hours.

## Rendering

### Web: Canvas 2D

The board is a single `<canvas>` repainted on an animation frame loop, not an
SVG or DOM tree: a busy board holds thousands of elements, and redrawing a
canvas stays smooth where thousands of DOM nodes would not. `renderer.ts`
(`paintBoard`) paints in board coordinates after the camera transform is set.
The same function paints the PNG/JPG export into an offscreen canvas, so an
export always matches the screen.

Pointer input (`BoardCanvas.tsx`):

| Input | Action |
|-------|--------|
| Primary button, one finger, pen | Active tool |
| Two fingers, middle button, Space/Alt + drag | Pan |
| Hand tool or no edit rights | Primary button pans |
| Wheel / trackpad | Pan |
| Ctrl/⌘ + wheel | Zoom at the pointer |

Keyboard shortcuts live in `hooks/use-shortcuts.ts`. Toolbar, sheets and
dialogs are React components styled with Tailwind 4 and CSS variables (light
and dark themes switch `data-theme` on `<html>`). Icons are Phosphor.

### Mobile: Skia on the UI thread

The canvas is [React Native Skia](https://shopify.github.io/react-native-skia/).
Gestures come from React Native Gesture Handler and run as **Reanimated
worklets on the UI thread**:

- one finger is always the active tool, two fingers are always the camera;
- the stroke being drawn is built and drawn on the UI thread, so the pencil
  follows the finger without waiting for JavaScript;
- the camera is mirrored into a shared value; panning moves the element group's
  transform and the dot grid on the UI thread **without re-rendering** the
  board.

Things to know:

- **Fonts on the canvas.** Skia needs font bytes. They are loaded with
  `expo-asset` + `expo-file-system` and kept in a small store
  (`BoardFonts.tsx`). React context does not reach Skia's children, because
  the Skia canvas is a separate React root.
- **Worklet order.** A worklet that calls another worklet must be declared
  after it. In a release build, calling one declared later gets `undefined` and
  crashes.
- **Glass.** Panels and sheets are frosted glass. iOS blurs natively. Android
  blurs a throttled snapshot of the canvas (`BoardMirror.tsx`), taken only
  while something changes.
- **Hold menu.** A long press with the cursor opens copy / cut / paste /
  duplicate / order / group / delete.
- **Haptics** on tool taps (can be turned off).

## Geometry

`geometry.ts` (about 2,000 lines in each app) holds the pure math, with no UI
imports, so it runs under Node in the checks:

- **Strokes:** point simplification before sending, and Catmull-Rom smoothing
  converted to Bézier curves for drawing.
- **Camera:** zoom around a point (25 %–600 %), fit to content.
- **Hit testing:** what is under the pointer, taking stroke width, hollow
  versus filled figures and rotation into account.
- **Handles:** resize, rotate, group resize (several elements scale from their
  overall box), curve handles, the elbow's slide handle.
- **Text layout:** line wrapping and label placement, using the platform's
  text measurement.
- **Connection points:** the anchors of each element, the nearest three while
  drawing an arrow, resolving a `Link` to a point, and moving every linked line
  when an element moves.
- **Routes:** straight, curved (two control points) and elbow lines. Elbows
  leave a figure straight out of its side and route around it, with a fallback
  when the first way out is blocked.
- **Markers:** the 15 line-end shapes.
- **Draw to shape:** `recognizeSketch` reads a pencil stroke as a line, arrow
  (a loop at one end), ellipse, rectangle, triangle or polygon, including
  irregular ones. It snaps near-level / upright / diagonal lines and
  near-symmetric figures, and leaves strokes it cannot read as freehand.

## Export and import

**Export** (`features/export`):

- PNG/JPG: the board is painted into an offscreen canvas cropped to the content
  bounds plus 24 px padding, scaled down beyond 4,096 px. JPG is offered only
  with an opaque background.
- SVG: generated as text from the elements (`svg.ts`).
- JSON: the [snapshot format](data-model.md#snapshot-export-file).
- Whole board or the selection.

**Pictures that carry the board** (`embed.ts`, byte-compatible between web and
mobile): the snapshot JSON, base64-encoded, is written into

- a PNG `tEXt` chunk with keyword `shareboard`, placed right after `IHDR`;
- one or more JPEG `COM` segments (`Shareboard/1` marker), split in 60 KB pieces
  because a segment holds at most 64 KB.

Neither changes how the picture looks in other programs.

**Import** (`features/import`) looks at the bytes, not the file name:

| File | Result |
|------|--------|
| `.json` snapshot | New board, everything editable (`POST /boards/import`) |
| Shareboard PNG/JPG | Same, read from the embedded snapshot (unless *Restore editable* is off) |
| Any other picture | One image element on the current board |

A plain picture is **re-encoded until it fits** a WebSocket frame (256 KB):
a phone photo sent as-is would make the socket drop the connection (close
1009) and the image would be lost silently. If even the smallest attempt is too
big, the import is refused with a readable message.

## Session and settings

Stored per device (`localStorage` on the web, AsyncStorage on Android):
user id, nickname, icon and colour, language, theme, the settings toggles,
recent boards, the PINs this device chose (so the creator can see their own
PIN; the server never returns it), and whether the tutorial was done.

If no name was chosen, the user is *Guest NNNN* until they pick one.

## Languages

All visible text lives in one table per language (Spanish default, English).
The tables are typed so a key missing in one language fails the type check.
Components read strings through `useT()`, so a language switch re-renders
everything. The web also sets `<html lang>` for screen readers.

## Mobile-only pieces

- **Updater** (`features/update/releases.ts`, `components/UpdatePrompt.tsx`):
  see [Communication](communication.md#the-in-app-updater-android).
- **Configuration** (`constants/config.ts`): `EXPO_PUBLIC_API_URL`,
  `EXPO_PUBLIC_WS_URL`, `EXPO_PUBLIC_WEB_URL` (where share links point) and
  `EXPO_PUBLIC_RELEASE` (the build's version). In development, a `localhost`
  default is rewritten to the address of the machine running Expo, so a phone
  on the same Wi-Fi reaches the local server.
- **Deep links:** scheme `shareboard://board/<id>`. The join field also accepts
  `https://…/b/<code>`, `https://…/board/<id>`, a bare code or a bare id.
- **Saving and sharing:** `expo-media-library` (save to the gallery),
  `expo-sharing` (system share sheet, WhatsApp), `expo-image-picker` and
  `expo-document-picker` (import), `expo-clipboard`.

## Checks

| Project | Command | Checks |
|---------|---------|--------|
| web | `npm run lint` | oxlint |
| web | `npm run build` | TypeScript + production build |
| web | `npm run check:geometry` | Geometry and store logic under Node |
| mobile | `npm run lint`, `npx tsc --noEmit` | ESLint, TypeScript |
| mobile | `npm run check:geometry` | Geometry and store under Node (with an Expo stub) |
| mobile | `npm run check:socket` | The real socket client against a running server |
| mobile | `npm run check:update` | Version ordering and release picking |

The Node-based checks borrow `tsx` from `../server/node_modules`, so install the
server's dependencies first.
