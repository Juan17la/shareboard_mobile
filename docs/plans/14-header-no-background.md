# 14 · Header without background or glass (S3)

**Goal:** the top header takes less space: no background, no glass; only the buttons float.
**Platforms:** web + mobile.

## Current state
- Web: `web/src/components/header/BoardHeader.tsx` using `GlassPanel` (`components/ui/Glass.tsx`); CSS blur in `index.css ~L155`.
- Mobile: `mobile/src/components/header/BoardHeader.tsx` with `HeaderScrim` (blurred, ~L335) and `GlassBlur` (`components/ui/Glass.tsx`; iOS `expo-blur`, Android Skia snapshot via `BoardMirror.tsx`).

## Steps
1. Remove the panel/scrim wrapper from the header; keep the buttons laid out at the same positions.
2. Give each button its own small solid chip background (theme surface colour, subtle border) so it stays legible over drawings. "Nothing behind the row" but buttons readable.
3. Reduce vertical padding; the board area starts higher / the header overlays the canvas (check that it doesn't steal pointer events between buttons: container `pointer-events: none`, buttons `auto`).
4. Mobile: remove the `HeaderScrim`; if nothing else uses `BoardMirror` on Android after this, leave it (toolbar still uses glass).
5. Respect safe-area insets on mobile.

## Verification
- Draw under the header area: strokes reach the top and aren't blocked. Buttons readable on dark and white boards, both themes.
