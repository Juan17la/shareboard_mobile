# 19 · Return to the cursor after using a tool, leaving the object selected (S1)

**Goal:** figure → draw → confirm ⇒ tool becomes `select` and the new object is selected for editing. Exceptions: hand, eraser, fill (they stay active). Also applies to pencil, line/arrow, text.
**Platforms:** web + mobile.

## Current state
- Web: `tool` default `'select'`; `setTool` (~L635) clears selection unless select/shape; `pickTool` ~L641. Only paste (~L1107/L1117), right-click on element (`BoardCanvas.tsx ~L716`) and AI add return to select. Pointer-up for each tool: `BoardCanvas.tsx ~L700–760`.
- Mobile: `pickTool` ~L725, `setTool` ~L743; shape created at `BoardCanvas.tsx ~L741` with the tool kept and the shape unselected; text commit in `TextEditorOverlay.tsx`.

## Steps
1. Add a store action `finishCreate(ids)` = `select(ids)` + `tool = 'select'` (+ close options rail). Call it:
   - after a shape/line/arrow is committed on pointer-up,
   - after a pen stroke ends (including a recognised sketch, after the pointer is released),
   - after text is committed (non-empty).
2. Never call it for `hand`, `eraser`, `fill`.
3. Interaction with plan 29 (geometric pencil): the pencil stays the pencil until the user changes it? To-do #2 says draw-to-shape persists as a *pencil mode*, so the pencil **should not** auto-return if it conflicts. Decision: the pencil returns to cursor like the others, and the pencil *mode* (normal / geometric) is remembered in `ToolConfig`, so picking the pencil again restores the mode.
4. Multi-stroke flows: shape tool + double-tap-lock (optional, later) lets power users stay in the tool.
5. Undo: creating + selecting is a single history entry (don't add one for selection).

## Risks
- Users who drew many pencil strokes in a row now must re-pick the pencil. Mitigate by keeping the last-used pen config (colour, width, mode).

## Verification
- Draw rectangle → rectangle selected, cursor tool active, handles visible. Pencil stroke likewise. Eraser/hand/fill unchanged.
