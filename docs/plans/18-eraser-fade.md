# 18 · Eraser fades what it will erase (S9)

**Goal:** elements touched by the eraser become semi-transparent while the pointer is still down, so the user sees what will go.
**Platforms:** web + mobile.

## Current state
- Web: `store.eraseAt(p, 12/scale)` on pointer down/move (`BoardCanvas.tsx ~L571, L660`); `liveErased` already hides elements immediately; `commitErase` on pointer up (~L731), `discardErase` cancels (store ~L1054–1064).
- Mobile: `eraseAt(at, radius = 12)` (store L1205) using `hitTest`; same live-erased idea needs checking.

## Steps
1. Keep the logic: touched ids go into `liveErased` (a set). Don't delete until pointer-up (that is already the behaviour on web; match on mobile).
2. Renderer: when drawing an element whose id is in `liveErased`, use `globalAlpha = 0.25` (web `renderer.ts`) / `opacity={0.25}` (mobile `ElementRenderer.tsx`) instead of skipping it.
3. Linked arrows: if an erased shape has arrows attached, only the shape fades (arrows are separate elements). Same as today's behaviour on commit.
4. Pointer-up commits as one undo step (unchanged); Escape/cancel restores opacity.
5. Per-element opacity (plan 20) multiplies with this fade; implement 20 after this and compose both.

## Verification
- Drag the eraser across several shapes/strokes: they dim as touched; releasing deletes them; undo restores them at full opacity.
