import { Pressable, View } from 'react-native';

import { useColors } from '@/features/session/store';

import { Txt } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Two-to-four-way choice: visibility, export format. */
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
        gap: 2,
        padding: 3,
        borderRadius: 11,
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
              paddingVertical: 7,
              borderRadius: 9,
              backgroundColor: active ? c.background : 'transparent',
              ...(active
                ? {
                    shadowColor: '#151A2D',
                    shadowOpacity: 0.14,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 2,
                  }
                : null),
            }}
          >
            <Txt weight="bold" size={12.5} color={active ? c.accentText : c.textSecondary}>
              {opt.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
