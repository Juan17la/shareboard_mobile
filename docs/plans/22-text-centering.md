# 22 · Text alignment inside figures and text elements (S19)

**Goal:** options to align text horizontally (left / center / right), vertically (top / middle / bottom) and "full centered" (both at once, exactly centred). For rectangle (spec: top, bottom, left, right, center, full centered) and for Text elements (left / right / center).
**Platforms:** web + mobile + server validation.

## Current state
- No align field. Shape labels are centred (`labelAt`, `labelLines`, `textBox` in `geometry.ts`); `TextElement` has `width` for wrapping (`TextEditorOverlay.tsx` edits it).

## Steps
1. Model: `align?: 'left'|'center'|'right'` and `valign?: 'top'|'middle'|'bottom'` on `ShapeElement`; `align` on `TextElement`. Defaults: center/middle for shapes, left for text. Add to 3 model copies + server validator.
2. Layout: `labelLines`/`textBox` take align params; compute x anchor and the vertical offset inside the shape's inner box (respecting padding and the stroke width). "Full centered" = set both to center/middle (one button that sets both, so exact centre is guaranteed).
3. Renderers (web `renderer.ts`, mobile `ElementRenderer.tsx`, both `svg.ts`) use `textAlign`.
4. Editor overlays (`TextEditorOverlay.tsx` both apps) match the alignment so editing doesn't jump.
5. UI: compact 3×3 or two segmented controls (horizontal, vertical) plus a "centered" button. Text tool: left/center/right only.
6. Triangle/polygon: vertical bounds use the inscribed box, not the bbox; check with a triangle.

## Verification
- Each combination on a rectangle; editing text keeps the position; triangle text stays inside; export matches.
