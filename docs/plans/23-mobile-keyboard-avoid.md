# 23 · Mobile: keep the text being written above the keyboard (M1)

**Goal:** when the user writes text, the board view moves so the text field is visible over the keyboard.
**Platform:** mobile.

## Current state
- `mobile/src/components/board/TextEditorOverlay.tsx`: a `TextInput` placed over the board-painted text; commit on blur/return; **no** keyboard handling (no camera lift).
- `ui/Sheet.tsx` L65–86 already uses `Keyboard.addListener`; `NicknameScreen` uses `KeyboardAvoidingView`. Reuse that listener approach.
- Camera/viewport state lives in the board store (pan/scale).
- Read the Expo SDK docs (`mobile/AGENTS.md`: https://docs.expo.dev/versions/v57.0.0/) before touching keyboard/edge-to-edge behaviour; Android resize mode (`softwareKeyboardLayoutMode` in `app.json`) changes how the keyboard reports height.

## Steps
1. In the overlay, listen to `keyboardDidShow/Hide` (or `useAnimatedKeyboard` from reanimated, already a worklet dependency) to get the keyboard height.
2. On editing start: compute the text's screen rect; if its bottom > screenHeight − keyboardHeight − margin, pan the camera (store `panBy(0, −delta)`) so it sits just above the keyboard. Animate it.
3. Remember the previous camera, restore it on blur/commit (unless the user panned meanwhile).
4. Growing text (new lines) re-checks on content size change.
5. Beware worklet declaration order (memory: *worklet declaration order*) if writing this in a worklet.

## Verification
- Release APK on Pixel emulator: text near the bottom of the screen → view lifts above keyboard, returns afterwards. Also test top-of-screen text (no movement) and landscape.
