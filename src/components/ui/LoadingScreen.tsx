/**
 * What the app shows while a board is being fetched or the server is slow to
 * answer, in place of an empty page: three dots breathing in turn and a line of
 * text, faded in. If it drags on (a sleeping server, a weak signal) a second
 * line says so, so the wait reads as "working" and not "broken".
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '@/features/i18n/store';
import { useColors } from '@/features/session/store';

import { Txt } from './Text';

/** How long before "taking longer than usual" appears. */
const SLOW_MS = 7000;

function Dot({ index, still }: { index: number; still: boolean }) {
  const c = useColors();
  const beat = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    beat.value = withDelay(
      index * 160,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 240 }),
        ),
        -1,
      ),
    );
  }, [beat, index, still]);

  const style = useAnimatedStyle(() => ({
    opacity: still ? 0.6 : 0.3 + beat.value * 0.7,
    transform: [{ scale: still ? 1 : 0.8 + beat.value * 0.45 }],
  }));

  return (
    <Animated.View
      style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }, style]}
    />
  );
}

export function LoadingScreen({ label }: { label?: string }) {
  const c = useColors();
  const t = useT();
  const still = useReducedMotion();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      entering={FadeIn.duration(350).delay(150)}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t.loading}
      style={{
        flex: 1,
        backgroundColor: c.background,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 28,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 9 }}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} still={still} />
        ))}
      </View>
      <Txt weight="bold" size={14} tone="secondary" style={{ textAlign: 'center' }}>
        {label ?? t.loading}
      </Txt>
      {slow ? (
        <Animated.View entering={FadeInDown.duration(400)}>
          <Txt size={12.5} leading={1.45} tone="secondary" style={{ textAlign: 'center', maxWidth: 280 }}>
            {t.loadingSlow}
          </Txt>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
