import { Text, TextInput, View, type TextInputProps } from 'react-native';

export interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
}

export function Field({ label, hint, error, style, ...rest }: FieldProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor="#9AA0A6"
        className={[
          'h-11 rounded-lg border px-3 text-base text-text dark:text-text-dark',
          error
            ? 'border-danger'
            : 'border-border bg-background dark:border-border-dark dark:bg-background-dark',
        ].join(' ')}
        {...rest}
      />
      {error ? (
        <Text className="text-sm text-danger">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">{hint}</Text>
      ) : null}
    </View>
  );
}
