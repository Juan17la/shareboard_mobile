# 04 · Export icon outside the three-dots menu (S16)

**Goal:** a one-tap export icon (icon only, no label) in the header.
**Platforms:** web + mobile.

## Current state
- Web: `web/src/components/header/BoardHeader.tsx`; export currently opened from `MenuSheet.tsx`.
- Mobile: `mobile/src/components/header/BoardHeader.tsx` (`IconButton` "more" ~L145, share button ~L203–226); export from `MenuSheet.tsx`.
- Both open `ExportSheet`; wiring on mobile in `src/app/board/[id].tsx`, on web in `pages/Board.tsx`.

## Steps
1. Add an `export` (download) icon to `Icon.tsx` if missing.
2. Add an `IconButton` in each header that calls the same handler the menu entry uses (`openExport`).
3. Remove the export row from `MenuSheet` (or keep it; decide when seeing the menu length. Recommended: remove to avoid duplicates).
4. Accessibility label/tooltip "Export" even though icon-only.
5. Mobile: mind header width on small phones (see plan 08/09 for the other header changes; do them together).

## Verification
- One tap opens ExportSheet on both apps; menu no longer lists it.
