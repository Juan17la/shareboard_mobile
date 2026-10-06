# 07 · Lines no longer connect, only arrows do (S25)

**Goal:** `line` never links to elements; `arrow` does. Do this before plan 28 (linking rules).
**Platforms:** web + mobile.

## Current state
- Link logic in `geometry.ts` (`isLinkTarget`, `anchorsOf`, `linkEndpoints`, `followLinks`, `shapeAt`) on both apps.
- Anchors shown when the shape tool is line **or** arrow: `web/.../BoardCanvas.tsx ~L334`, `mobile/.../BoardCanvas.tsx ~L1007`; snap in `snapLine` (mobile L117) / ~L420 (web).
- `ShapeElement.shape` distinguishes `line` / `arrow`; `fromLink`/`toLink` fields.

## Steps
1. In the snap code, skip snapping/linking when the kind is `line` (anchors not painted for `line`).
2. Anchors visibility: arrow tool only (and a selected arrow).
3. `editPatches`/`followLinks`: ignore links on `line` elements (handles legacy boards, where a line may already have `fromLink`). Optionally strip those links on load.
4. Sketch-recognised straight lines (pen → line) must not link either.

## Verification
- Draw a line from a rectangle: stays free when the rectangle moves. Arrow still follows.
- `npm run check:geometry` in web.
