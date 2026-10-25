# Board audit: smoothness, preview, bugs and gaps (2026-10-22)

A research and testing pass over the board on the web and on Android,
measured against Excalidraw (the developer reference) and, for features,
against tldraw, Miro, FigJam and Microsoft Whiteboard (the everyday-user
references). Nothing in the apps was changed. This is a list of findings,
not a plan.

## How it was tested

| | |
|--|--|
| Web build | `web/` at `develop` (1.6.0-beta) **with the uncommitted work in progress**, built for production (`vite build`, minified) |
| Android build | `shareboard-v1.6.0-beta.apk` (release), Pixel 10 Pro emulator, Android 17, host GPU (Intel Arc) |
| Browser | Headless Chromium (Playwright 1.63), 1440×900, at 1× and 4× CPU slowdown (4× ≈ a modest student laptop) |
| Reference | excalidraw.com, the same harness, the same scene, the same inputs |
| Scene | 0 / 500 / 2,000 / 5,000 elements: 60 % freehand strokes (40 points each), 25 % rectangles, ellipses and arrows (some with labels), 15 % text |
| Inputs | wheel pan, Ctrl+wheel zoom, hand-tool drag, a 180-point pen stroke at 60 Hz, marquee + drag, eraser scrub; each at "fit" and at 100 % |
| Collaboration | two browsers on one live board, against a throwaway memory-only server |

**Reading the numbers.** Headless Chromium rasterises the canvas on the CPU, so
the absolute frame rates are lower than on a laptop with a GPU. Shareboard
and Excalidraw were measured under the same conditions, so the *comparison*
holds. "Pen events/s" is how many pointer moves the page managed to handle
while 60/s were sent. When it drops, the stroke is drawn from fewer points
and trails behind the pointer. Emulator frame times are slower than on a
phone. Compare the Android rows with each other (they show the trend), not
with a real device.

## Summary

1. **Drawing slows down as the board fills up.** Every pointer move repaints
   the whole board. At 2,000 elements the web pen handles 26 of 60 events/s,
   and at 5,000 only 16. Excalidraw stays at 54 because it draws the
   in-progress line on its own layer. On a 4×-slower CPU, even an **empty**
   board draws at 39 fps (Excalidraw: 59). Most of that cost is the dot grid,
   which is repainted every frame.
2. **Nothing off-screen is skipped.** At 100 % zoom on a 5,000-element board,
   where almost everything is off-screen, Shareboard is as slow as when all of
   it is visible (42 fps, 17 pen events/s). Excalidraw runs at 60 fps there.
3. **Collaborators see a stroke only when the pen lifts. A dragged shape jumps
   at the end. Cursors move in 45 ms steps.** Excalidraw, tldraw, Miro and
   FigJam all show strokes and drags as they happen.
4. **One peer moving the mouse costs everyone else CPU.** On a 2,000-element
   live board, an idle viewer's main thread went from 4 % to 90 % because one
   other person moved their cursor. Each cursor message repaints the whole
   canvas.
5. **Bug: shapes can't be rotated with the knob** (web and Android). The
   "Aa · Add text" button sits exactly on top of the rotate knob.
6. **Bug (Android): Back with the long-press menu open quits the app**
   instead of closing the menu.
7. **Escape throws away the text being typed.** Every reference app keeps it.
8. **First run takes about 9 taps and a typed name before the first stroke**
   (welcome, name, account prompt, 6-step tutorial). This conflicts with
   PRODUCT.md principles 1 and 2.
9. **A live board turns read-only when the connection drops, and the
   production server takes 23 s to answer its first request after being idle**
   (Render free tier).
10. Android shows the same scaling: drawing goes from 32 ms per frame (about
    55 strokes) to 65 ms (about 2,000 strokes). The GPU stays at 10–14 ms, so
    the UI thread is the bottleneck.

Strengths worth keeping are listed in [What already works well](#what-already-works-well).

---

## 1. Performance and smoothness

### 1.1 Web vs Excalidraw, normal CPU (fps; pen = events handled per second)

| Scenario | SB 500 | EX 500 | SB 2,000 | EX 2,000 | SB 5,000 | EX 5,000 |
|----------|-------:|-------:|---------:|---------:|---------:|---------:|
| Wheel pan (fit) | 60 | 60 | 60 | 57 | 45 | 38 |
| Ctrl+wheel zoom | **47** | 60 | **41** | 59 | **34** | 57 |
| Hand-tool drag | 60 | 60 | 60 | 54 | 48 | 32 |
| Pen stroke, fps | 60 | 60 | 60 | 59 | **40** | 58 |
| Pen stroke, events/s | 55 | 55 | **26** | 54 | **16** | 54 |
| Marquee + drag | 58 | 60 | 59 | 57 | 39 | 36 |
| Eraser scrub | 60 | 60 | 61 | 51 | 47 | 36 |
| At 100 %: pan | 60 | 60 | 60 | 60 | **48** | 60 |
| At 100 %: pen fps / events/s | 60 / 41 | 60 / 56 | 60 / 27 | 60 / 56 | **42 / 17** | 59 / 53 |
| JS heap | 7–14 MB | 12–43 MB | 10–31 MB | 25–53 MB | 17–45 MB | 50–109 MB |
| Open the board | 0.74 s | — | 0.80 s | — | 0.95 s | — |

### 1.2 Web vs Excalidraw, 4× slower CPU

| Scenario | SB 0 | EX 0 | SB 500 | EX 500 | SB 2,000 | EX 2,000 |
|----------|-----:|-----:|-------:|-------:|---------:|---------:|
| Wheel pan | 51 | 60 | 47 | 46 | 26 | 23 |
| Ctrl+wheel zoom | 56 | 60 | **16** | 43 | **13** (p95 217 ms) | 39 |
| Hand-tool drag | 50 | 60 | 45 | 41 | 26 | 15 |
| Pen stroke, fps | **39** | 59 | **37** | 58 | **21** | 57 |
| Pen stroke, events/s | 15 | 25 | 14 | 25 | **8** | 25 |
| Marquee + drag | 39 | 59 | 38 | 59 | **20** | 48 |
| Eraser scrub | 59 | 58 | 56 | 42 | 30 | 26 |

The same empty board at 4× **with the dot grid off**: pen 54 fps (39 with the
grid), marquee + drag 54 (39), wheel pan 59 (51).

Where the two apps differ:

- Shareboard pans as well as Excalidraw, and on a full 5,000-element view a
  bit better.
- It uses less memory (17–45 MB against 50–109 MB at 5,000 elements).
- It loses badly on drawing, dragging and zooming, and on anything that
  happens while most of the board is off-screen.

### 1.3 Android (emulator, host GPU, `dumpsys gfxinfo`)

Baseline on the same emulator, scrolling Settings: p50 16 ms, 9 % janky frames.

| Board | Pen stroke p50 / p90 | Janky | Hand pan p50 / p90 | GPU p50 |
|-------|---------------------|------:|--------------------|--------:|
| ~55 strokes | 32 / 48 ms | 87 % | 32 / 48 ms | 10 ms |
| ~555 strokes | 48 / 65 ms | 91 % | 48 / 65 ms | 13 ms |
| ~2,055 strokes | 65 / 85 ms | 100 % | 48 / 81 ms | 14 ms |

Cold start with 2,055 strokes: the board shows about 2–3 s after the tap. The
GPU time stays flat, so the extra cost per element is CPU work on the UI
thread, where the Skia scene is replayed. Pinch zoom could not be measured,
because adb cannot inject two fingers.

### 1.4 Why (root causes in the code)

| # | Cause | Where | Effect |
|---|-------|-------|--------|
| W1 | One canvas. Every pointer move repaints every element (no separate layer for the in-progress stroke) | `web/src/components/board/BoardCanvas.tsx` `paint` (≈298–383), `renderer.ts` `paintBoard` | Pen and drag cost grows with the board (1.1, 1.2) |
| W2 | No viewport culling: `paintBoard` loops over all elements, visible or not | `renderer.ts` `paintBoard` | 100 % zoom is as slow as fit |
| W3 | The dot grid is ~2,000 `arc()` calls, rebuilt and filled every frame | `renderer.ts` `paintGrid` | About −30 % fps while drawing on a slow CPU, even on an empty board |
| W4 | Per-move React work. The live stroke copies its whole points array on each move (`[...prev, x, y]`). `paint` changes identity on each move, so the ResizeObserver effect re-subscribes and calls `setViewport`. That store update re-runs every selector, including two `Object.values(elements).some(...)` scans (zoom bar `hasContent`, empty-board hint) | `BoardCanvas.tsx` ≈398–414 and ≈721; `BottomControls.tsx`; the empty-board hint | Extra CPU per move that grows with the board |
| W5 | Shapes rebuild their `Path2D`, and arrow heads rebuild SVG path strings (`markerPaths`), every frame. Text is re-measured every frame. Strokes do cache their `Path2D` | `renderer.ts`, `lib/geometry.ts` | Zoom is the slowest case (34 fps at 5,000) |
| W6 | Each remote cursor replaces `participants` → `held` is recomputed → `paint` changes → full repaint, for every cursor message of every peer (~22/s each) | `board-store.ts` ≈710, `BoardCanvas.tsx` `held` | An idle viewer goes from 4 % to 90 % CPU (2,000 elements, one peer) |
| W7 | Ops are sent only on pointer-up. The protocol has no channel for an in-progress element or drag | `lib/contract.ts` (`op` / `cursor` / `select` only) | Peers see strokes pop in and drags jump (section 3) |
| W8 | One 607 KB JS chunk (182 KB gzip); Vite warns about it | `vite build` output | Slower first load on phone networks |
| M1 | Android: one Skia node per element, the whole scene replayed each frame, no culling. Camera, pen and live shapes run on the UI thread, which is why pan and zoom stay usable | `mobile/src/components/board/BoardCanvas.tsx` (`list.map` render), `ElementRenderer.tsx` | 32 → 65 ms per frame (1.3) |
| M2 | Android offline board: 500 ms after each edit it re-reads and parses the whole JSON file, then writes the whole board back on the JS thread | `mobile/src/features/board/local.ts`, `hooks/use-board-sync.ts` | Not measured; a likely hitch on big boards |

---

## 2. Bugs (confirmed)

| # | Bug | Platform | Evidence | Cause |
|---|-----|----------|----------|-------|
| B1 | **The rotate knob of a selected figure can't be grabbed.** The "Aa · Add text" button covers it | Web + Android | Web: `elementFromPoint` at the knob returns the *Add text* button, and dragging there does not rotate. Android: screenshot shows the knob's stem ending inside the "Aa" pill | Knob 24 px above the top edge (`geometry.ts` `rotateHandleOf`); pill at −42 px (web `BoardCanvas.tsx` ≈933) / −46 px (mobile `BoardCanvas.tsx` ≈1326), about 26 px tall |
| B2 | **Back with the long-press menu open quits the app** (to the home screen). Back on sheets works | Android | Reproduced twice on the emulator | `HoldMenu` is not a `Modal`, and the app registers no `BackHandler`. Other non-Modal overlays, such as toolbar dropdowns, probably behave the same (not tested) |
| B3 | **Escape discards typed text** (new text and figure labels) | Web | Typed "Login screen" in a label, pressed Escape, the label was gone | By design (`TextEditorOverlay.tsx` ≈152–157), but Excalidraw, tldraw, Miro and FigJam all keep the text on Escape |
| B4 | **"Draw to shape" is documented but can't be turned on.** The toggle was removed, and the setting is forced to `false` on every load. Only "hold still for 0.5 s" remains | Web + Android | `user-guide/features.md` still says "Turn it on in the pencil's options" | `web/src/features/session.ts:264`, `mobile/src/features/session/store.ts:253`; CHANGELOG "no longer an option of the pencil" |
| B5 | `?` opens **Settings**; the app has no keyboard shortcut list | Web | `pages/Board.tsx:111` `openShortcuts → setSheet('settings')` | — |
| B6 | Welcome card copy: "Whoever has it sees every stroke **as it happens**". Strokes arrive when the pen lifts | Web | First-run screen | Copy vs behaviour (W7) |

---

## 3. Preview: how it feels

**Your own preview is good.**

- The stroke or shape being drawn uses the same renderer as the final element.
- Arrows show connection points and frame their target while you drag.
- A moved figure drags its bound arrows along live.
- Labels and text are typed in place.
- Hold-to-shape turned rough rectangles, triangles, lines and ellipses into
  clean figures every time, in place, after a 0.5 s hold.
- The export sheet shows the exact crop, the pixel size and the element count.

**It degrades with board size.** When pen events drop to 16–26/s (2,000–5,000
elements), the line is built from fewer points and trails behind the pointer.
At 4× CPU it trails even on small boards (8–15 events/s).

**The remote preview is weak** (two browsers, local server):

| What A does | What B sees | Reference apps |
|-------------|-------------|----------------|
| Draws a 1.6 s stroke | Nothing until the pen lifts, then the whole stroke 25–40 ms later | The stroke growing as it is drawn |
| Drags a rectangle for 2 s | No movement, then a jump to the end ~57 ms after release | The shape moving with the pointer |
| Moves the mouse | The cursor jumps every 45 ms (22 Hz), with no interpolation | ~30 Hz or interpolated cursors |

On the real deployment, add the network round trip, plus the first request
after idle: `GET /health` on Render took **23.0 s** cold, then 0.5–0.9 s warm.

**Not tested:** the AI drawing preview (needs the AI provider key).

---

## 4. UX issues

| # | Issue | Verified | Compared with |
|---|-------|----------|---------------|
| U1 | **First run: 3 screens, an account prompt, then a 6-step tutorial** (≈9 taps plus typing a name, ≈11 s for a script) before the first stroke. On tutorial step 4 the coach mark covers the hand, pencil and eraser buttons | Yes (web) | Excalidraw and tldraw: drawing in 0 taps. PRODUCT.md: "nothing blocks the first stroke" and "ask for an account only when it unlocks something" |
| U2 | **A live board turns read-only while offline or reconnecting.** Shaky classroom Wi-Fi stops everyone drawing | From the code and docs | Excalidraw and tldraw keep editing locally and merge on reconnect |
| U3 | Strokes pop in, drags teleport, cursors step (section 3) | Yes | All the references sync live |
| U4 | **Zoom only goes from 25 % to 600 %.** "Fit" can't show a big board: the 5,000-element test board stopped at 25 % with content cut off | Yes | Excalidraw 10–3,000 %, tldraw 10–800 % |
| U5 | The phone-sized web layout shows no zoom or fit buttons (the zoom label appears only after a pinch), so a lost user has no obvious "find my drawing" | Yes (390×844) | — |
| U6 | **Shortcuts are hard to discover.** Only the small letters on the toolbar show them; `?` lands in Settings | Yes | Excalidraw: `?`; tldraw: Ctrl+/ open a shortcut sheet |
| U7 | Android: the header (2 rows) plus the zoom bar take about 20 % of the screen height | Yes (screenshot) | — |
| U8 | Android: changing the shape kind is a step deeper (Shapes → the first chip of the strip) than on the web (one key per shape) | Partly | — |
| U9 | Escape discards text (B3); the reflex users bring from other apps loses work | Yes | — |

---

## 5. What's missing compared with other boards

Listed for awareness, not as requirements. The last column says who usually
expects it.

| Capability | Shareboard | Developer boards (Excalidraw / tldraw) | Everyday boards (Miro / FigJam / MS Whiteboard) | Expected by |
|------------|-----------|-----------------------------------------|-----------------------------------------|-------------|
| Live in-progress strokes and drags for peers | ✗ | ✓ | ✓ | everyone |
| Keep editing a shared board offline, merge later | ✗ (read-only) | ✓ | partly | everyone |
| Follow a collaborator / smooth cursors | ✗ | ✓ | ✓ | everyone |
| Sticky notes | ✗ (rectangle + label) | tldraw ✓ | ✓ (the core object) | everyday |
| Templates / libraries of reusable pieces | ✗ | Excalidraw libraries | ✓ templates | both |
| Frames, pages or slides | ✗ | ✓ | ✓ | both |
| Snapping and alignment guides | ✗ (only 15° rotation and level-line snaps) | ✓ | ✓ | both |
| Align / distribute, flip | ✗ | ✓ | ✓ | developers |
| Lock an element | ✗ | ✓ | ✓ | both |
| Pressure / variable-width ink | ✗ (constant width) | ✓ | partly | everyday (stylus) |
| Highlighter, laser pointer | ✗ | laser ✓ | ✓ | both (teaching) |
| Lasso selection | ✗ (rectangle only) | Excalidraw ✓ | ✓ | everyday (touch) |
| Links on elements, embeds | ✗ | ✓ | ✓ | developers |
| Search text on the board | ✗ | Excalidraw ✓ | ✓ | developers |
| Copy / paste style | ✗ | Excalidraw ✓ | ✓ | developers |
| Comments, reactions, voting, timer | ✗ | ✗ | ✓ | everyday (class groups) |
| Version history | ✗ | ✗ | ✓ | everyday |
| Export at 2× / 3×, PDF | ✗ (1×, capped) | Excalidraw 1–3× | ✓ PDF | both |
| Keyboard shortcut sheet | ✗ | ✓ | ✓ | developers |
| Zoom range | 25–600 % | 10–3,000 % | wide | both |

### What already works well

- An offline-first local board.
- Code, link and QR sharing, an optional PIN, per-person edit rights.
- A native Android app: neither Excalidraw nor tldraw has one.
- Hold-to-shape, which is reliable.
- Arrows that bind to figures and follow them, crow's-foot markers.
- PNG exports that stay editable.
- AI drawing.
- Lower memory use than Excalidraw.
- Panning as smooth as Excalidraw's on medium boards.

---

## 6. Not covered

- Real phones (emulator only).
- A GPU-accelerated desktop browser (the headless browser rasterises on the CPU).
- iOS.
- AI drawing.
- PIN and permissions flows, import.
- Multi-touch on Android.
- Long sessions and memory growth.
- Throttled networks.

The measurement scripts (Playwright harness, Excalidraw comparison,
collaboration probe, adb frame-stats script) were kept outside the repos and
can be added under `test/` if wanted.
