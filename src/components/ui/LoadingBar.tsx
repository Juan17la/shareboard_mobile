/**
 * The quiet loader: a thin line along the top edge with a soft glint running
 * through it, like a browser's. It waits a beat before showing, so a fast load
 * never flashes it at all. Mirrors web's `.sb-loading`.
 */
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/features/i18n/store';
import { useColors } from '@/features/session/store';

export function LoadingBar() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const still = useReducedMotion();
  const shown = useSharedValue(0);
  const x = useSharedValue(0);

  useEffect(() => {
    shown.value = withDelay(250, withTiming(1, { duration: 400 }));
    if (!still) {
      x.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.bezier(0.45, 0, 0.3, 1) }),
        -1,
      );
    }
  }, [shown, x, still]);

  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  const glint = useAnimatedStyle(() => ({
    transform: [{ translateX: -width * 0.35 + x.value * width * 1.35 }],
  }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={t.loading}
      pointerEvents="none"
      style={[
        { position: 'absolute', top: insets.top, left: 0, right: 0, height: 2, overflow: 'hidden', zIndex: 70 },
        fade,
      ]}
    >
      <Animated.View
        style={[
          still
            ? { width: '100%', height: 2, opacity: 0.3 }
            : { width: width * 0.35, height: 2, borderRadius: 1, opacity: 0.55 },
          { backgroundColor: c.accent },
          still ? null : glint,
        ]}
      />
    </Animated.View>
  );
}
