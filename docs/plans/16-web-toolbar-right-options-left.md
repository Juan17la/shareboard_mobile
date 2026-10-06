# 16 · Web: toolbar on the right, options on the left (W2)

**Goal:** swap sides: tool rail right, options panel left.
**Platform:** web.

## Current state
- `web/src/components/board/Toolbar.tsx` contains both the rail and options strip (`railOpen` in the store toggles options; `pickTool` ~L641).
- `BottomControls.tsx` (zoom) and `BoardHeader.tsx` live elsewhere; check for overlaps on the right (header buttons, people panel, connection banner).

## Steps
1. Change the container anchor classes: rail `right-*`, options panel `left-*` (mirror the open/close animation direction and any `translate-x` sign).
2. Options panel keeps vertical alignment with the active tool button where it is aligned today (now across the screen; simplest: options panel stays at a fixed left position, vertically centred).
3. Check overlaps: header right-hand buttons, minimap/zoom controls, context menu clamping, AI/People sheets.
4. RTL is not needed.
5. Narrow windows (<640 px): fall back to the current bottom layout if one exists; otherwise stack.

## Verification
- Tools on the right, options on the left at 1280 and 768 px widths; nothing overlaps; pointer events pass through empty space.
