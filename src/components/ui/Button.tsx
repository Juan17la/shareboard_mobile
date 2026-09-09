import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-primary active:opacity-80',
  secondary: 'bg-surface border border-border active:opacity-70 dark:bg-surface-dark dark:border-border-dark',
  ghost: 'bg-transparent active:bg-surface dark:active:bg-surface-dark',
  danger: 'bg-danger active:opacity-80',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-text dark:text-text-dark',
  ghost: 'text-text dark:text-text-dark',
  danger: 'text-white',
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || loading }}
      disabled={disabled || loading}
      className={[
        'h-11 min-w-11 flex-row items-center justify-center rounded-lg px-4',
        CONTAINER[variant],
        fullWidth ? 'w-full' : '',
        disabled || loading ? 'opacity-50' : '',
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? '#888' : '#fff'} />
      ) : (
        <Text className={`text-base font-semibold ${LABEL[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
