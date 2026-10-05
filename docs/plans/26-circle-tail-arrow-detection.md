# 26 · Pencil: a line with a small circle at the tail becomes an arrow (S12)

**Goal:** easier arrow drawing with the normal pencil. A straight stroke ending (or starting) with a small loop/circle is recognised as an arrow (the loop marks the head end).
**Platforms:** web + mobile.

## Current state
- `recognizeSketch(flat, minSize)` in `web/src/lib/geometry.ts ~L1747` and `mobile/src/features/board/geometry.ts ~L1471–1721`.
  - Straight run → line; straight run with a **hook at the tip** → arrow (check near L1695 on mobile).
  - Loops → ellipse / rect / triangle / polygon. Constants `CORNER_DEG = 55`, `SOFT_CORNER_DEG = 30`.
- Store `sketchElement` gives arrows `headEnd: 'arrow'`.

## Steps
1. Before the closed-loop branch, add a "line + loop" test: split the stroke into the long straight part and a trailing (or leading) sub-path whose points enclose a small area (≈ closed: end near the sub-path start, extent ≤ ~15 % of the straight length and ≥ minSize). Use the existing polygon-area / closure helpers in `geometry.ts`.
2. If it matches, return a `Sketch` of kind arrow from the line's start to the loop's start point, with the head at the loop end. Which end is the head? Decision: the loop is the *tail*? The to-do says "a line with a small circle ... then make an arrow" → loop at the tail end of drawing = the head end the user finishes at. Make the head at the end where the loop is (it replaces the hand-drawn hook).
3. Keep the existing hook rule working; the loop rule must not hijack a genuine large circle with a tail (size ratio guard) or a spiral.
4. Add cases to `web/test/geometry.mjs` (`npm run check:geometry`): line+loop at end, loop at start, big circle with short tail (stays ellipse), plain line. Port the same geometry to mobile.
5. Mirror web ↔ mobile in the same commit.

## Verification
- Draw line + small circle with the pencil on both apps: arrow appears after the hold delay (plan 01). Geometry tests pass.
