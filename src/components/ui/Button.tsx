import { ActivityIndicator, Pressable, View, type PressableProps, type ViewStyle } from 'react-native';

import { Radius, Shadow, type Palette } from '@/constants/theme';
import { useColors } from '@/features/session/store';

import { Icon, type IconName } from './Icon';
import { tip } from './Toast';
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
function foreground(c: Palette, variant: ButtonVariant): string {
  switch (variant) {
    case 'secondary':
      return c.text;
    case 'ghost':
      return c.textSecondary;
    case 'dashed':
      return c.textSecondary;
    default:
      return '#FFFFFF';
  }
}

function container(c: Palette, variant: ButtonVariant, disabled: boolean): ViewStyle {
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
      return { ...base, backgroundColor: c.accent, ...(disabled ? null : Shadow.accent) };
    case 'danger':
      return { ...base, backgroundColor: c.danger, ...(disabled ? null : Shadow.danger) };
    case 'secondary':
      return {
        ...base,
        backgroundColor: c.glassTintSolid,
        borderWidth: 1,
        borderColor: c.borderStrong,
      };
    case 'dashed':
      return {
        ...base,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.borderDashed,
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
  const c = useColors();
  const fg = foreground(c, variant);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      disabled={off}
      style={({ pressed }) => [
        container(c, variant, off),
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
  color: tint,
  disabled,
  background: fill,
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
  const c = useColors();
  const color = tint ?? c.text;
  const background = fill ?? c.glassTintSolid;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={() => tip(label)}
      style={({ pressed }) => ({
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: pressed ? c.surfaceSelected : background,
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
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={() => tip(label)}
      style={({ pressed }) => ({
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9,
        borderWidth: 1,
        borderColor: c.borderStrong,
        backgroundColor: pressed ? c.surfaceSelected : c.surface,
      })}
    >
      <Icon name={icon} size={14} color={c.text} />
    </Pressable>
  );
}

/** Divider used inside panels and rails. */
export function Hairline({ style }: { style?: ViewStyle }) {
  const c = useColors();
  return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
}
