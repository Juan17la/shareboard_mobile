# 02 · Bucket icon for the filler (S14)

**Goal:** the fill tool shows a paint-bucket icon instead of the drop.
**Platforms:** web + mobile.

## Current state
- Mobile: `mobile/src/components/ui/Icon.tsx:149` `fill: [DropIcon]`; used by `TOOLS` in `Toolbar.tsx:115`.
- Web: `web/src/components/ui/Icon.tsx` (same icon map), tool list in `web/src/components/board/Toolbar.tsx`.

## Steps
1. Add a `BucketIcon` (same stroke style/viewBox as the other icons) in each `Icon.tsx`.
2. Point the `fill` entry at it. Keep `DropIcon` only if used elsewhere (e.g. FillSheet colour); otherwise delete it.

## Verification
- Toolbar shows the bucket on both apps in light and dark theme.
