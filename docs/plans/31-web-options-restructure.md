# 31 · Web: restructure the options per tool (W4)

**Goal:** options exactly as specified in `00-to-do`, nothing else. `[]` = shown in the toolbar, `{}` = in a dropdown menu.
**Platform:** web (mobile reuses the manifest in plan 32).

## Spec (from 00-to-do)
- cursor, hand: no options
- pencil: thickness, color, draw-to-shape
- eraser: thickness
- shapes (rectangle / circle / triangle / polygon):
  - Rectangle [background color, border color, thickness, corners {sharp, rounded}, stroke style, text align {top, bottom, center, left, right, full centered}]
  - Circle [background color, border {color, thickness}, stroke style]
  - Triangle [background, border color, thickness, corners, stroke style, sides]
  - Polygon [background, border color, thickness, corners, stroke style]
- line: color, thickness, stroke style
- arrow: color, stroke style, tail type {all}, head type {all}, arrow type {curved, straight, elbow}, text {text options}
- text: color, size {S/M/L/XL}, font {fonts}, bold, italic, underline, text align {left, right, center}

## Prerequisites (must exist first)
plan 06 (sizes), 15 (swatch), 17 (stroke style), 20 (opacity — **not in the spec, so decide**: put it in the same dropdown as background/stroke, or drop it from the UI), 21 (corners), 22 (alignment), 25 (manifest), 16 (layout). **Underline** is not in the model yet: add `underline?: boolean` to `TextElement` (model copies, server validator, renderer, svg) as part of this plan.

## Steps
1. Finalise `TOOL_OPTIONS` (plan 25) to match the spec; each option has `placement: 'toolbar' | 'dropdown'`.
2. Option components: `ColorSwatch`, `ThicknessPicker`, `Segmented` (corners, stroke style), `AlignMenu` (dropdown), `HeadTailMenu` (dropdown with marker previews from `MARKERS`), `RouteMenu`, `FontMenu`, `SizeSegment`.
3. `Toolbar.tsx` renders purely from the manifest; the same list drives the selected-element inspector.
4. Remove anything the spec doesn't list (e.g. extra fill-wash controls) from the visible UI.
5. Shortcut letters (plan 13) stay on tool buttons.

## Verification
- Click through every tool and compare with the spec checklist (put it in the PR); selected-element edits use the same controls.
