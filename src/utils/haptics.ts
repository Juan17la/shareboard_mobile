/**
 * Haptic feedback, behind the settings-sheet switch.
 *
 * Every call site passes the current setting rather than reading the store, so
 * this module stays free of app state and can be called from a gesture handler
 * without a subscription. Failures are swallowed: the Taptic Engine is
 * unavailable in Low Power Mode and on much Android hardware, and a tool tap
 * that throws because the phone cannot buzz would be absurd.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A light tick — picking a tool, a colour, a size. */
export function tick(enabled: boolean): void {
  if (!enabled) return;
  // Expo recommends the Android-native path there; `selectionAsync` maps to a
  // full vibration rather than to the subtle tick it is on iOS.
  const run =
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick)
      : Haptics.selectionAsync();
  void run.catch(() => {});
}

/** A firmer bump — a destructive action landing, a board being created. */
export function thud(enabled: boolean): void {
  if (!enabled) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success / failure of something the user waited for. */
export function notify(enabled: boolean, ok: boolean): void {
  if (!enabled) return;
  void Haptics.notificationAsync(
    ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
}
