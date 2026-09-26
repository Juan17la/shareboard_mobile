import { Pressable, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useColors } from '@/features/session/store';

import { Txt } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Two-or-three-way choice: visibility, export format. */
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
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 7,
        padding: 5,
        borderRadius: Radius.lg,
        backgroundColor: c.surfaceSelected,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 9,
              borderRadius: 11,
              backgroundColor: active ? c.background : 'transparent',
              ...(active
                ? {
                    shadowColor: '#151A2D',
                    shadowOpacity: 0.1,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }
                : null),
            }}
          >
            <Txt weight="extrabold" size={12.5} color={active ? c.accent : c.textSecondary}>
              {opt.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
