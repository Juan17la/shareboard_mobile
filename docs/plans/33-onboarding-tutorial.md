# 33 · Short tutorial for new users (S5)

**Goal:** first-run walkthrough: use the pencil, look at the options, select/move, add a shape, share. Skippable, replayable from the menu.
**Platforms:** web + mobile.

## Current state
- No onboarding anywhere. First-run screens: `NicknameScreen`/`PinScreen`. Persisted session store: web `features/session.ts` (`localStorage` key `shareboard.session`), mobile `features/session/store.ts` (AsyncStorage via zustand `persist`).
- All UI text through `strings.ts` / i18n.

## Steps
1. Add `tutorialDone: boolean` to the persisted session (both apps; default false for new users, **true for existing sessions** so current users aren't nagged — migrate by checking for an existing nickname).
2. `Tutorial` component: 5–6 steps as coach marks (dim overlay with a spotlight around a target + caption + Next/Skip). Steps: (1) pencil: "draw something" (advance when a stroke is committed), (2) options/colour, (3) draw to shape toggle (after plan 29), (4) select & move, (5) arrows/text, (6) share.
3. Targets via refs/`data-tour` ids on tool buttons; positions measured at show time (web `getBoundingClientRect`, mobile `measureInWindow`).
4. Step completion can be action-driven (store subscription) with a "Next" fallback.
5. Strings in all languages; "Replay tutorial" row in the menu/settings.
6. Show it on the first board open after the nickname screen; for the offline-first flow (plan 34) show it on the local board.

## Dependencies
- Best after 29/31/32 so it points to the final UI.

## Verification
- Fresh profile: tutorial runs, skipping works, reload doesn't repeat; existing session doesn't see it; replay works.
