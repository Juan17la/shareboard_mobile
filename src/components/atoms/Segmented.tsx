import { Pressable, View } from 'react-native';

import { useColors } from '@/features/session/store';

import { Txt } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Two-to-four-way choice: visibility, export format. A pill ringed in ink; the chosen part fills. */
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
        padding: 2,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: c.text,
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
              justifyContent: 'center',
              minHeight: 40,
              borderRadius: 999,
              backgroundColor: active ? c.text : 'transparent',
            }}
          >
            <Txt weight="bold" size={13} color={active ? c.background : c.textSecondary}>
              {opt.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
