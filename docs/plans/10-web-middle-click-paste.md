# 10 · Web: remove paste with the middle mouse button (W1)

**Goal:** middle click never pastes.
**Platform:** web.

## Current state (important)
- The app has **no** middle-click paste code. Middle button is pan (`web/src/components/board/BoardCanvas.tsx ~L540–547`, `panClick` threshold ~L705). Paste goes through the window `paste` event in `web/src/hooks/use-shortcuts.ts ~L153–187`.
- On Linux browsers, middle click fires a `paste` event with the X11 *primary selection* (text you merely highlighted). That is almost certainly what the user sees.

## Steps
1. Reproduce on Linux: highlight text elsewhere, middle-click the canvas → text element appears.
2. In `use-shortcuts.ts` paste handler: ignore the event unless it was triggered by keyboard/menu. Track `lastMouseButton === 1` via a `pointerdown`/`mousedown` listener (set on button 1, clear after ~100 ms or on `keydown`) and `return` from the paste handler while set.
3. In `BoardCanvas` `onPointerDown` for `button === 1`: `e.preventDefault()` (also stops Linux autoscroll/paste on the canvas).
4. Leave Ctrl/Cmd+V and the context-menu paste (`pasteFromSystem`) untouched.

## Verification
- Linux Chrome + Firefox: middle-click on canvas pans, doesn't paste. Ctrl+V and right-click Paste still work.
