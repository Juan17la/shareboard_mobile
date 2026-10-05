# 01 · Faster figure detection (S4)

**Goal:** the pen turns a held stroke into a figure 200 ms sooner (700 → 500 ms).
**Platforms:** web + mobile.

## Current state
- `web/src/components/board/BoardCanvas.tsx:77` `SKETCH_MS = 700`; timer set in `awaitSketch` (~L185).
- `mobile/src/components/board/BoardCanvas.tsx:182` `SKETCH_MS = 700`; timer in `watchSketch`/`penStarted` (~L440–520).
- Don't touch `HOLD_MS = 500` on mobile (long-press menu), it is a different timer.

## Steps
1. Set `SKETCH_MS = 500` in both files.
2. Check the timer restarts on pointer movement (small jitter must not fire it too early; see the movement threshold next to the timer). If 500 ms triggers on slow drawing, keep the jitter tolerance and don't lower further.

## Risks
- Slow, deliberate strokes may be recognised accidentally. Compare by drawing a slow curve.

## Verification
- Draw a circle and hold still: figure appears at ~0.5 s on both apps. Draw a slow freehand curve without stopping: stays a stroke.
