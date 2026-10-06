# 06 · Four text sizes: small / medium / large / extra large (S7)

**Goal:** replace the free font-size control with four presets.
**Platforms:** web + mobile.

## Current state
- `fontSize` numeric in `ToolConfig` and `TextElement` (`web/src/lib/contract.ts`, `mobile/src/features/board/model.ts:152`). Shape labels use `fontSize` too (`SHAPE_TEXT_SIZE = 18` on mobile).
- Options UI in `Toolbar.tsx` on both apps.

## Steps
1. Define `TEXT_SIZES = { small: 14, medium: 20, large: 32, xlarge: 48 }` once per app next to the model (values to tune on screen; default medium).
2. Keep the stored value numeric (no schema change, no server change, old boards keep working). The UI shows the nearest preset as selected (`nearestSize(fontSize)`).
3. Replace the size control in Toolbar with a 4-button segment (S / M / L / XL). Applying to a selection patches `fontSize`.
4. Same presets for shape labels.

## Risks
- Existing boards with arbitrary sizes: no preset highlighted exactly; show nearest.

## Verification
- Select text, press each size: it changes; reload the board: persists. Old text with size 23 shows "M" highlighted.
