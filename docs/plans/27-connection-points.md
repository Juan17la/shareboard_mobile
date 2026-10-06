# 27 · More connection points, only three visible per figure (S20)

**Goal:** figures expose more anchors (e.g. 8: corners + edge midpoints, or N per perimeter), but the UI shows only three at a time: the closest to the pointer plus its neighbours (or the 3 nearest while an arrow is being dragged).
**Platforms:** web + mobile. Model: `Link {id, u, v}` is a free point in 0..1 of the box, so **no schema/server change**.

## Current state
- `anchorsOf` (`web/.../geometry.ts:700`, `mobile/.../geometry.ts:659`) = centre + outline anchors. `linkPoint`, `linkEndpoints`, `followLinks`, `shapeAt` handle linking.
- Painting: `paintAnchors` (`web/.../renderer.ts`); anchors flag at `BoardCanvas.tsx ~L334` (web) / `~L1007` (mobile); snapping in the pointer move handler.

## Steps
1. Extend `anchorsOf` per shape: rectangle 8 (4 corners + 4 midpoints), ellipse 8 at 45°, triangle 6, polygon (vertices + edge midpoints). Keep `u,v` normalised so existing links keep resolving.
2. Snapping uses all anchors (distance threshold in screen px, so it's still exact and fast).
3. Painting: `visibleAnchors(shape, pointer)` returns the 3 nearest anchors; draw only those (centre one highlighted when snapping).
4. When not dragging, show nothing / the three of the last snapped end.
5. Depends on plan 07 (lines don't link) and feeds plan 28.
6. Add geometry tests (counts per shape, nearest-three ordering).

## Verification
- Drag an arrow near a rectangle: only three dots show and move with the pointer; the arrow snaps to any of the eight; links survive moving/resizing the shape.
