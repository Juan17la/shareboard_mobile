import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { useColors } from '@/features/session/store';

import { Txt } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Two-to-four-way choice: visibility, export format. A grey track with one
 * white key that slides under the chosen option. The options share the width
 * equally, so the key is one n-th of the track. Mirrors web `atoms/Segmented.tsx`.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  const index = Math.max(0, options.findIndex((opt) => opt.value === value));
  const [width, setWidth] = useState(0);
  const [slide] = useState(() => new Animated.Value(index));
  useEffect(() => {
    Animated.timing(slide, {
      toValue: index,
      duration: 200,
      easing: Easing.bezier(0.22, 0.9, 0.26, 1),
      useNativeDriver: true,
    }).start();
  }, [index, slide]);
  const keyWidth = width / options.length;

  return (
    <View
      accessibilityRole="radiogroup"
      style={{ borderRadius: 9, padding: 2, backgroundColor: c.fill, opacity: disabled ? 0.5 : 1 }}
    >
      <View style={{ flexDirection: 'row' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: keyWidth,
              borderRadius: 7,
              backgroundColor: c.key,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
              transform: [{ translateX: Animated.multiply(slide, keyWidth) }],
            }}
          />
        ) : null}
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ checked: active, disabled: !!disabled }}
              disabled={disabled}
              onPress={() => onChange(opt.value)}
              // Drawn 32 tall in a 36 track; the finger still gets 44.
              hitSlop={{ top: 6, bottom: 6 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 32, paddingHorizontal: 6 }}
            >
              <Txt weight={active ? 'semibold' : 'medium'} size={13} color={active ? c.text : c.textSecondary} numberOfLines={1}>
                {opt.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
