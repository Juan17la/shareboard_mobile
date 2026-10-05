# 20 · Opacity option for figures (S24)

**Goal:** an opacity slider affecting the whole figure (fill + stroke + label).
**Platforms:** web + mobile + **server validation**.

## Current state
- No per-element opacity. Only `fillOpacity` in `ToolConfig` baked into the fill (`fillWith`, `fillOpacityOf`, `FILL_WASH` in `lib/theme.ts` / store).
- `ElementBase` (`web/src/lib/contract.ts`, `mobile/.../model.ts`, `server/src/model/types.ts`) has id, z, group, rotation.

## Steps
1. Add optional `opacity?: number` (0.1–1, default 1) to `ElementBase` in the three model copies; server validator (`server/src/model/*`) accepts and clamps it. Optional field ⇒ old clients/boards keep working. Bump the server's accepted-schema list, and the export format (`serialization.ts`, `features/export`) passes it through.
2. Renderers: wrap each element draw in `globalAlpha = opacity` / Skia `<Group opacity>`; also `svg.ts` (`opacity` attribute).
3. Keep the existing fill-opacity: decide if the old "fill wash" control becomes redundant. Recommended: keep fill alpha for fill only, add element opacity as the new overall control.
4. UI: slider (4 steps or continuous) in the shape options; works on multi-selection (plan 30).
5. Compose with eraser fade (plan 18) by multiplying.

## Verification
- Set 40 %: element + label dim; reload, other client sees it; SVG/PNG export matches; old boards unchanged.
