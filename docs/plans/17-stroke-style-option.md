# 17 · Stroke style option: solid / dashed / dotted (S23)

**Goal:** figures (and lines/arrows) let the user pick the stroke style.
**Platforms:** web + mobile.

## Current state
- Model already has `dash: 'solid'|'dashed'|'dotted'` (`web/src/lib/contract.ts` `DASHES` ~L66–81; `mobile/src/features/board/model.ts:103`), and `ToolConfig.dash` on web/mobile stores. Server validates elements (`server/src/model/*`), already accepts `dash`.
- Likely missing: a visible control for shapes (check what Toolbar shows for rectangle/circle/triangle/polygon today) and rendering for every shape kind (ellipse, polygon) in `renderer.ts` (web) / `ElementRenderer.tsx` (mobile) and `svg.ts`.

## Steps
1. Add a 3-option segmented control (solid / dashed / dotted, drawn as mini line previews) in Toolbar options for shapes, line and arrow.
2. Make sure `dash` is applied when editing a selected element (`editPatches` / store `updateSelected`) and when creating (ToolConfig → element).
3. Verify renderers dash all shape outlines and scale dash length with `strokeWidth`; check SVG export (`stroke-dasharray`).
4. Sketch-recognised figures (`sketchElement`) inherit `ToolConfig.dash` (pen has no dash, so solid).

## Verification
- Each shape + line + arrow: switch the three styles live, export SVG/PNG shows the same.
