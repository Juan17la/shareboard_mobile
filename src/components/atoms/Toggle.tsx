/**
 * The switch in the settings and export sheets: green when on, as a switch is
 * on a phone, so "on" never reads as "this is the primary action".
 *
 * Not `react-native`'s `Switch`: that renders the platform control, which
 * looks different on every platform; this one matches the web app's.
 */
import { useEffect, useState } from 'react';
import { Animated, Pressable } from 'react-native';

import { useColors } from '@/features/session/store';

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
  const c = useColors();
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
      hitSlop={9}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View
        style={{
          width: 44,
          height: 26,
          borderRadius: 99,
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [c.fillStrong, c.switchOn],
          }),
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 2,
            left: progress.interpolate({ inputRange: [0, 1], outputRange: [2, 20] }),
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
