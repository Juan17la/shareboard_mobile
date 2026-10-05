# 24 · Mobile: share via WhatsApp and other messaging apps (M4)

**Goal:** the share button offers WhatsApp and other messengers, not only copy/QR.
**Platform:** mobile.

## Current state
- `mobile/src/components/sheets/ShareSheet.tsx` (140 lines): share code, QR, shortcut tiles.
- Link = `boardShareLink` in `mobile/src/utils/deep-link.ts` (`${WEB_BASE_URL}/b/${shortCode}`). `expo-sharing` is installed for files only (`features/board/export.ts`).
- Read the Expo v57 docs for `Linking`/`expo-sharing`/ RN `Share` before coding (`mobile/AGENTS.md`).

## Steps
1. Add a **WhatsApp** tile: `Linking.openURL('whatsapp://send?text=' + encodeURIComponent(message))`; fall back to `https://wa.me/?text=…` if `canOpenURL` fails (Android 11+ needs the `whatsapp` scheme in `<queries>`; iOS needs `LSApplicationQueriesSchemes` — add via `app.json` plugins/config, requires a new native build, so release APK rebuild).
2. Add a **More…** tile using React Native's `Share.share({ message })` which opens the native chooser (Telegram, Messenger, SMS, mail…). This gives "other apps" without per-app code.
3. Message text: localized "Join my board: <link>" (strings file).
4. Optional: Telegram (`tg://msg?text=`) tile if wanted; skip by default.
5. Keep Copy link and QR.

## Verification
- On emulator with WhatsApp absent: wa.me fallback opens the browser; More… opens the system chooser. On a device with WhatsApp: opens chat picker with the link prefilled.
