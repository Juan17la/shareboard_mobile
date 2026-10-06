# 28 · Arrow linking rules (S11)

**Goal:** arrows (not lines — plan 07) link automatically:
- Starts over an element (figure, text, image) → tail linked instantly.
- Ends over an element → head linked too (both ends if both).
- Starts in empty space but ends over an element → tail free, head linked to the last element.
**Platforms:** web + mobile. No schema change (`fromLink`/`toLink` exist).

## Current state
- `Link {id,u,v}`; `isLinkTarget` (`web/.../geometry.ts:663`), `shapeAt` (L880), `linkEndpoints`, `followLinks`. Snap logic around `BoardCanvas.tsx ~L420` (web), `snapLine` L117 (mobile). `editPatches` (web store ~L100) unlinks when a line moves away.
- Today link targets may be limited to shapes (`isLinkTarget`); text and images need to be valid targets with anchors (bbox-based `anchorsOf` for text/image).

## Steps
1. `isLinkTarget` → shapes, text, images (not strokes, not other arrows).
2. `anchorsOf` for text/image: same bbox anchors as rectangle.
3. On pointer-down of an arrow: `shapeAt(start)` → set `fromLink` at the nearest anchor if any (else the exact (u,v) of the hit point — "instantly linked").
4. On pointer-up: `shapeAt(end)` → `toLink`. Independent of the start, so case 3 works naturally.
5. During the drag, preview the target (highlight outline of the shape under each end) so the behaviour is predictable.
6. Exclude linking to the arrow's own source if start and end land on the same element? Allow (self-loop) only if the drag is long; otherwise skip `toLink`.
7. Moving/resizing a linked element: `followLinks` already updates; confirm for text/image.
8. Tests in `geometry.mjs` for the three cases.

## Dependencies
- Plans 07 and 27 first.

## Verification
- Draw arrows for the 3 cases on both apps; move each element and confirm the ends follow (or the free tail stays).
