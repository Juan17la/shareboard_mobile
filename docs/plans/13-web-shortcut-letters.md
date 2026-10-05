# 13 · Web: show tiny keyboard-shortcut letters on the toolbar (W5)

**Goal:** each tool button shows its key as a small letter, like Excalidraw.
**Platform:** web.

## Current state
- `web/src/hooks/use-shortcuts.ts` `TOOL_KEYS`: v, h, p, e, s, r, o, y, g, l, a, t.
- `web/src/components/board/Toolbar.tsx` `ToolButton`.

## Steps
1. Export `TOOL_KEYS` (or a `keyOf(tool, shape)` helper) from `use-shortcuts.ts` so the toolbar reads the same source of truth (no duplicated letters).
2. In `ToolButton`, render the letter bottom-right, ~9 px, 50 % opacity, `pointer-events-none`. Hide on touch devices (`@media (hover: none)`).
3. Also add it to the tooltip.

## Verification
- Letters match what the keys do. Layout unchanged on narrow windows.
