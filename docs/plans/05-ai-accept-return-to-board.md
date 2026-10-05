# 05 · After accepting an AI result, go back to the whiteboard (S22)

**Goal:** pressing "Add to board" adds the elements and closes the AI sheet so the user sees the board.
**Platforms:** web + mobile.

## Current state
- `web/src/components/sheets/AiSheet.tsx:38` `decide(i, accept)` → `addElements(els)` (`web/src/features/board-store.ts:~1112`, selects new elements, one undo step).
- `mobile/src/components/sheets/AiSheet.tsx:55` `decide(msg, accept)` → `addElements` (store ~L1273).
- The sheet stays open after accept; the conversation continues there.

## Steps
1. After a successful accept call the sheet's `onClose` (both apps).
2. Keep the conversation history in the sheet component state/store so reopening shows it (verify it isn't unmounted-and-lost; if it is, lift the messages into a small store).
3. Optionally frame the new elements (fit camera to them) if they were placed off-screen. The server uses the viewport centre as `at`, so usually unnecessary.
4. Discard keeps the sheet open (user may refine).

## Verification
- Ask the AI to draw something, accept: sheet closes, elements visible and selected, undo removes them in one step.
