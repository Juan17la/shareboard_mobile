# 21 · Rounded / sharp corners for figures (S17)

**Goal:** rectangle, triangle and polygon get a `corners: sharp | rounded` option. Default sharp. (Circle excluded.)
**Platforms:** web + mobile + server validation.

## Current state
- No corner field in `ShapeElement` (`web/src/lib/contract.ts`, `mobile/src/features/board/model.ts:103`, server types).
- Rendering: web `components/board/renderer.ts` + `lib/svg.ts`; mobile `ElementRenderer.tsx` + `svg.ts`. Hit-testing uses outline geometry in `geometry.ts` (rounding is small enough to ignore for hits).

## Steps
1. Add optional `rounded?: boolean` (simpler than a radius number; radius derived as `min(w,h)*0.18` or a fixed proportion of the shortest side, capped). Add to the 3 model copies and the server validator.
2. Rectangle: use `roundRect` (canvas) / `RRect` (Skia) / `rx` (SVG).
3. Triangle/polygon: build the path with `arcTo`-style rounded joins between vertices (one shared helper in `geometry.ts`: `roundedPolygonPath(points, r)`), mirrored web↔mobile.
4. Sketch-recognised figures get sharp.
5. UI: 2-option segmented control (Sharp / Rounded) in the options of rectangle, triangle, polygon only (per W4 spec).
6. Unit check in `web/test/geometry.mjs` for the path helper (point count, no NaN for tiny sizes).

## Risks
- Anchors (`anchorsOf`) still use the geometric vertices/edges; the difference is minor.

## Verification
- Toggle on each shape; resize very small (no NaN/artifacts); SVG export correct; other clients see it.
