# 12 · Representative names for tool options (S10)

**Goal:** option labels say what they do: Colors, Figures, Font, Size, Borders, Bold, Italic…
**Platforms:** web + mobile.

## Current state
- Web: all UI text lives in `web/src/features/strings.ts` (i18n via `features/i18n.ts`).
- Mobile: equivalent strings file under `mobile/src/` (search for the label keys used by `Toolbar.tsx`); same i18n pattern.

## Steps
1. List current labels used in `Toolbar.tsx` (tool names, option group titles, tooltips) on both apps.
2. Rename to the target vocabulary: Colors, Figures, Font, Size, Borders, Stroke, Corners, Opacity, Bold, Italic, Underline, Align… (final names follow the lists in plan 31).
3. Update every language in the strings files (at least es + en).
4. Keep keys stable where possible; only change values.

## Verification
- Toggle languages: no raw keys; labels consistent between web and mobile.
