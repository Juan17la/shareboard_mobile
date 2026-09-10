/**
 * The pill switch from the design's settings and export sheets.
 *
 * Not `react-native`'s `Switch`: that renders the platform control, which is
 * blue on iOS and Material-green on Android and would be the only element on
 * screen not wearing the app's accent.
 */
import { useEffect, useState } from 'react';
import { Animated, Pressable } from 'react-native';

import { Colors } from '@/constants/theme';

export function Toggle({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  // A lazily-initialised piece of state rather than a ref: the value is read
  // during render (it is interpolated into styles), which is exactly what a ref
  // is not for. `useState` with an initialiser creates it once all the same.
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 180,
      // `left` and `backgroundColor` are laid out on the JS side, so this
      // animation cannot be handed to the native driver.
      useNativeDriver: false,
    }).start();
  }, [value, progress]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View
        style={{
          width: 44,
          height: 26,
          borderRadius: 99,
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(27,32,48,0.16)', Colors.accent],
          }),
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 3,
            left: progress.interpolate({ inputRange: [0, 1], outputRange: [3, 21] }),
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
