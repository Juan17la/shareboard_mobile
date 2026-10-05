# 08 · Mobile: settings at the start of the three-dots menu (M2)

**Goal:** the header's separate settings button goes away; "Settings" becomes the first entry of the "more" menu.
**Platform:** mobile.

## Current state
- `mobile/src/components/header/BoardHeader.tsx`: `IconButton` "more" (~L145) and a separate `settings` icon button.
- `mobile/src/components/sheets/MenuSheet.tsx` (menu) and `SettingsSheet.tsx`.

## Steps
1. Add a first row "Settings" in `MenuSheet` that closes the menu and opens `SettingsSheet` (use the same open handler the header button used; wiring in `src/app/board/[id].tsx`).
2. Remove the header settings button (frees header width; export button from plan 04 uses that space).

## Verification
- Header has no gear; menu's first row opens settings.
