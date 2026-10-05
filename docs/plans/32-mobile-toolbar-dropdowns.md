# 32 · Mobile toolbar with dropdown menus, Excalidraw-mobile style (M5)

**Goal:** same option set as web (plan 31) but compact: only `{}` dropdowns for the larger option groups to save space. Like Excalidraw's mobile UI: the colour button is always visible, plus one settings button opening a general dropdown with all other options.
**Platform:** mobile.

## Current state
- `mobile/src/components/board/Toolbar.tsx` (943 lines): `TOOLS` L115, `SHAPES` L100, options rail via `railOpen`; `BottomControls.tsx`; glass (`ui/Glass.tsx`); sheets (`ui/Sheet.tsx`) are available for the dropdown body.

## Steps
1. Reuse the shared manifest (`TOOL_OPTIONS` from plan 25/31, mirrored into `mobile/src`) but map every option to `{}` except the colour swatch(es) that remain visible next to the tools.
2. Layout: bottom toolbar = tool buttons + colour swatch (current tool's main colour) + a "settings" (sliders) button. The settings button opens a dropdown/popover (anchored above the toolbar, scrollable, max ~50 % screen) listing the tool's remaining options with the same controls as web.
3. When an element is selected, the same button edits the selection (no separate inspector).
4. Touch targets ≥ 44 pt; dismiss on outside tap; keep the keyboard avoidance (plan 23) in mind for the font menu.
5. Check Android glass snapshot (`BoardMirror`) still works; flatten (`glassFlat`) if the popover causes perf issues.
6. Remove the old options rail.

## Dependencies
- Plans 14, 15, 25, 31 (manifest + option components).

## Verification
- Release APK on the Pixel emulator, small and large screens: all tools reachable, options match the spec, the board area is larger than before.
