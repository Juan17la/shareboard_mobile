# 29 · Geometric pencil ("draw to shape" mode) (S2)

**Goal:** a second pencil mode that turns freehand into clean figures: straight lines, arrows, circles/ellipses, polygons of any number of sides. While drawing, a low-opacity preview shows what the detector sees; the mode persists as the chosen pencil until the user switches back (pencil → draw to shape → pencil).
**Platforms:** web + mobile.

## Current state
- Recognition exists and runs only when the pen **holds still** (`SKETCH_MS`, plan 01): `awaitSketch`/`watchSketch` → `recognizeSketch` (`geometry.ts`) → `store.addSketch`, then `sketchResize` lets the pointer keep resizing the figure.
- `ToolConfig` holds the pen settings; there's no pen "mode".

## Steps
1. Add `penMode: 'free' | 'shape'` to `ToolConfig` (persisted in the session/settings store so it survives reloads). UI: a toggle "Draw to shape" in the pencil options (plan 25/31 manifest: pencil = thickness, color, draw-to-shape).
2. In `shape` mode, run recognition **continuously** (throttled ~60 ms, and on pointer-up) instead of only after a hold:
   - On each run store `candidate = recognizeSketch(points)`; draw it in the overlay layer at ~35 % opacity above the raw stroke (renderer overlay path, like marquee/handles; no store write, no network).
   - On pointer-up: commit the candidate (as `addSketch`); if nothing recognised, keep the freehand stroke.
3. Extend `recognizeSketch` for "any polygon/figure": N-gon (corner detection with CORNER_DEG already counts corners — return `polygon` with `sides` = count, cap ~12), closed curves → ellipse/circle (circle if aspect ≈ 1), open straight → line, line+loop → arrow (plan 26). Return a `confidence` so the preview can hide on low confidence.
4. Hold-still behaviour in this mode: commit immediately and keep the existing resize-while-held (`sketchResize`) for fine adjustments.
5. Plan 19 interplay: after commit return to cursor with the figure selected; `penMode` is remembered so re-picking the pencil restores the mode.
6. Mirror web ↔ mobile; add geometry tests with fixture strokes (jittery circle, 5-gon, rectangle, zigzag that must stay freehand).
7. Performance (mobile): recognition on the JS thread at 60 ms cadence with long strokes — decimate points first (e.g. Ramer–Douglas–Peucker already in geometry? reuse), and skip while the stroke is < minSize. Remember worklet order pitfalls (memory) if any piece moves to the UI thread.

## Risks
- False positives while sketching naturally: use the confidence threshold and the freehand fallback.

## Verification
- Draw each figure type; preview appears at low opacity, commits on release; toggling back to pencil is plain freehand; the mode persists after reload.
