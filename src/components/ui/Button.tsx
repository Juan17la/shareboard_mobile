import { ActivityIndicator, Pressable, View, type PressableProps, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow } from '@/constants/theme';

import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dashed';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  /** Compact height for inline use next to an input. */
  compact?: boolean;
  style?: ViewStyle;
}

/** Foreground colour per variant, also used for the icon. */
const FOREGROUND: Record<ButtonVariant, string> = {
  primary: '#FFFFFF',
  secondary: Colors.text,
  ghost: Colors.textSecondary,
  danger: '#FFFFFF',
  dashed: 'rgba(27,32,48,0.6)',
};

function container(variant: ButtonVariant, disabled: boolean): ViewStyle {
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: Radius.xl,
    opacity: disabled ? 0.55 : 1,
  };
  switch (variant) {
    case 'primary':
      return { ...base, backgroundColor: Colors.accent, ...(disabled ? null : Shadow.accent) };
    case 'danger':
      return { ...base, backgroundColor: Colors.danger, ...(disabled ? null : Shadow.danger) };
    case 'secondary':
      return {
        ...base,
        backgroundColor: 'rgba(255,255,255,0.75)',
        borderWidth: 1,
        borderColor: Colors.borderStrong,
      };
    case 'dashed':
      return {
        ...base,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: Colors.borderDashed,
        borderRadius: Radius.lg,
      };
    default:
      return base;
  }
}

export function Button({
  label,
  variant = 'primary',
  icon,
  loading = false,
  fullWidth = false,
  compact = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const off = !!disabled || loading;
  const fg = FOREGROUND[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      disabled={off}
      style={({ pressed }) => [
        container(variant, off),
        {
          paddingVertical: compact ? 12 : 16,
          paddingHorizontal: compact ? 16 : 18,
          width: fullWidth ? '100%' : undefined,
          transform: [{ scale: pressed && !off ? 0.985 : 1 }],
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={compact ? 16 : 19} color={fg} /> : null}
          <Txt weight="extrabold" size={compact ? 13.5 : 15.5} color={fg}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

/** Square glass icon button — the header's back / menu affordances. */
export function IconButton({
  icon,
  label,
  onPress,
  size = 36,
  iconSize = 18,
  color = Colors.text,
  disabled,
  background = 'rgba(255,255,255,0.62)',
  radius = Radius.md,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  disabled?: boolean;
  background?: string;
  radius?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: pressed ? '#FFFFFF' : background,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Icon name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}

/** The `+`/`−` steppers in the text options panel. */
export function StepperButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9,
        borderWidth: 1,
        borderColor: Colors.borderStrong,
        backgroundColor: pressed ? Colors.surfaceSelected : '#FFFFFF',
      })}
    >
      <Icon name={icon} size={14} color={Colors.text} />
    </Pressable>
  );
}

/** Divider used inside panels and rails. */
export function Hairline({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: Colors.border }, style]} />;
}
