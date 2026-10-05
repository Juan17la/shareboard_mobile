# 30 · Transformations on multiple selected elements (S21)

**Goal:** with several elements selected, resize (and rotate) them together. Elements without transform support stay unchanged.
**Platforms:** web + mobile.

## Current state
- Marquee multi-select works (`elementsIn`, `BoardCanvas.tsx ~L688` web, `~L679–735` mobile); groups via `ElementBase.group`.
- Handles/rotate knob/`resizeElement` are single-element only (`LiveEdit {mode:'move'|'resize', handle, patch}` web ~L50; `handlesOf` web L555, `resizeElement` L599; mobile `beginEdit ~L356–425`).

## Steps
1. Compute the selection's union bbox; paint the 8 handles on it (existing `paintSelection`/`paintDashedBox`), with the per-element boxes drawn faint.
2. Resize: scale each element about the opposite handle with `sx, sy` from the bbox: new geometry = `T(old)`; per kind:
   - shapes: scale `from/to`; stroke width untouched; text size untouched.
   - text: scale `at`, and width (wrap) only; not font size (decision: font size is preset-based, plan 06).
   - strokes: scale all points.
   - images: scale rect (keep aspect with Shift/pinch).
   - arrows/lines: scale endpoints/control points; linked ends re-resolve via `followLinks`.
   - Elements with rotation ≠ 0: scale position only, keep size (they're "not transformable"), or skip — pick *skip size* to avoid skewing.
3. Rotate: rotate positions around the bbox centre and add the angle to each element's `rotation`; strokes rotate points.
4. Produce one `LiveEdit` with a map id → patch, committed as ops in one history step (`editPatches` generalised to N elements).
5. Server: ops already carry full patches per element; make sure rate limits (`server/src/ws`) tolerate N element updates per commit (batching op).
6. Locks: skip elements locked by other users.
7. Test: geometry check for union bbox + scale mapping; manual multi-select with mixed kinds.

## Dependencies
- Plan 19 (selection after create), 28 (links follow).

## Verification
- Select rect + text + stroke + arrow, drag a corner: all scale; undo restores everything in one step; another client sees the same result.
