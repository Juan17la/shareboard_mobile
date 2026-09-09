import { Pressable, Text, View } from 'react-native';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row rounded-lg border border-border bg-surface p-1 dark:border-border-dark dark:bg-surface-dark">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            className={`flex-1 items-center rounded-md px-3 py-2 ${
              active ? 'bg-background dark:bg-background-dark' : ''
            }`}
          >
            <Text
              className={`text-sm ${
                active
                  ? 'font-semibold text-text dark:text-text-dark'
                  : 'text-text-secondary dark:text-text-secondary-dark'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
