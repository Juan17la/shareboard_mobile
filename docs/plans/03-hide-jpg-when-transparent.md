# 03 · Hide JPG when background is transparent (S15)

**Goal:** with "transparent" on, JPG isn't offered (today it's shown but disabled / ignored).
**Platforms:** web + mobile.

## Current state
- `web/src/components/sheets/ExportSheet.tsx` and `mobile/src/components/sheets/ExportSheet.tsx`: `canBeTransparent` disables the toggle for JPG; format selector is a segmented control (PNG/JPG/SVG).
- Renderers: `web/src/features/export.ts` (`transparent && format === 'png'`), `mobile/src/features/board/export.ts`.

## Steps
1. Filter the format options: when `transparent` is true, drop `jpg` from the segmented control.
2. If the user toggles transparent on while `jpg` is selected, switch format to `png`.
3. SVG stays available (it is already transparent-capable).
4. Keep the toggle enabled for PNG/SVG, and remove the "disabled for JPG" branch.

## Verification
- Toggle transparent: JPG disappears, PNG selected. Toggle off: JPG returns. Exported PNG has alpha.
