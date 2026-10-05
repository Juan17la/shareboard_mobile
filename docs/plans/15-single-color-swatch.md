# 15 · One colour swatch instead of the colour palette (S8)

**Goal:** tool options show a single box with the current colour; tapping it opens the picker.
**Platforms:** web + mobile.

## Current state
- Web: palette row in `web/src/components/board/Toolbar.tsx` (`DrawingPalette` in `lib/theme.ts`), picker `components/ui/ColorPickerSheet.tsx` (embedded ~L575).
- Mobile: `mobile/src/components/board/Toolbar.tsx` + `ui/ColorPickerSheet.tsx`, `FillSheet.tsx`.

## Steps
1. Create a `ColorSwatch` component (box filled with the colour, checkerboard when transparent, ring for contrast) in `components/ui/` of each app.
2. Replace the palette rows for stroke colour and fill colour with swatches that open `ColorPickerSheet` (the sheet keeps the palette + hex input, so no capability is lost).
3. Where a tool has both (shapes: border colour + background colour) show two labelled swatches ("Border", "Background").
4. Recent colours inside the picker are optional.

## Dependencies
- Plan 12 for the labels; plan 31/32 reuse this swatch.

## Verification
- Every tool that has a colour shows a swatch of the live colour; changing it updates the swatch and the selected element.
