# 09 · Mobile: social-media style share icon (M3)

**Goal:** the share button uses the familiar "three connected dots" share glyph.
**Platform:** mobile.

## Current state
- `mobile/src/components/header/BoardHeader.tsx` share button (~L203–226) with its current icon from `src/components/ui/Icon.tsx`.

## Steps
1. Add `ShareNodesIcon` (three circles joined by two lines) to `Icon.tsx` in the existing stroke style.
2. Use it in the header share button. Consider doing the same on web for consistency (optional, one-line change in the web header).

## Verification
- Header shows the new glyph in light/dark theme; tap still opens ShareSheet.
