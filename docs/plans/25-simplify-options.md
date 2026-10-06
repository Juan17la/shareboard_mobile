# 25 · Simplify options with progressive disclosure (S13)

**Goal:** a new user never sees every option at once: only the options of the active tool, grouped, with advanced ones behind a "More" disclosure.
**Platforms:** web + mobile.

## Current state
- One options strip per app in `Toolbar.tsx` (web ~L575 area; mobile 943 lines) driven by `railOpen`/`tool`/`shape` from the store. Many controls render for a tool at once.

## Steps
1. Define a per-tool option manifest (data, not JSX) — `TOOL_OPTIONS: Record<ToolKey, { primary: OptionId[]; more?: OptionId[] }>`, using the lists in `00-to-do` (Web #4) as the source of truth: pencil [thickness, color, draw-to-shape], eraser [thickness], rectangle [...], etc.
2. Toolbar renders from the manifest: primary options inline; the rest in a "More" popover/accordion (collapsed by default, state remembered).
3. Selection-based options (when an element is selected with the cursor) use the same manifest keyed by the element kind.
4. Do this *before* 31/32: those plans move the manifest into the final layout (toolbar `[]` vs dropdown `{}`) — keep the manifest as the single place defining it.
5. Use the labels from plan 12 and the swatch from plan 15.

## Risks
- Hiding options can hurt power users: keep one-tap access to "More".

## Verification
- Open each tool on a fresh profile: ≤ 4 visible controls; nothing disappeared (all reachable via More).
