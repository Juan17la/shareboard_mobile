import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { Radius, Shadow, type Palette } from '@/constants/theme';
import { useColors } from '@/features/session/store';

import { Icon, type IconName } from './Icon';
import { tip } from './Toast';
import { Txt } from './Text';

/**
 * Pills, like the line badges on a transit sign. `primary` (blue), `go`
 * (green: the step that finishes a flow) and `danger` are filled flat;
 * `secondary` is outlined in ink. Mirrors web `ui/Button.tsx`.
 */
export type ButtonVariant = 'primary' | 'go' | 'secondary' | 'ghost' | 'danger' | 'dashed';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  /** Compact height for inline use next to an input. */
  compact?: boolean;
  /** The icon after the label (a "go on" arrow) instead of before it. */
  iconAfter?: boolean;
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

function container(
  c: Palette,
  variant: ButtonVariant,
  disabled: boolean,
  pressed: boolean,
): ViewStyle {
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.pill,
    opacity: disabled ? 0.55 : 1,
  };
  // Filled like signage: the flat line colour, flat as enamel, a soft low
  // shadow, and the deeper shade while the finger is on it.
  const filled = (fill: string, deep: string, shadow: ViewStyle): ViewStyle => ({
    ...base,
    backgroundColor: pressed ? deep : fill,
    ...(disabled ? null : shadow),
  });
  switch (variant) {
    case 'primary':
      return filled(c.accent, c.accentDeep, Shadow.accent);
    case 'go':
      return filled(c.go, c.goDeep, Shadow.accent);
    case 'danger':
      return filled(c.danger, '#A00D25', Shadow.danger);
    // Outlined in ink: clearly a button, never competing with a filled one.
    case 'secondary':
      return {
        ...base,
        backgroundColor: pressed ? c.surfaceSelected : 'transparent',
        borderWidth: 2,
        borderColor: c.text,
      };
    case 'dashed':
      return {
        ...base,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: c.borderDashed,
        borderRadius: Radius.lg,
      };
    default:
      return { ...base, backgroundColor: pressed ? c.surfaceSelected : 'transparent' };
  }
}

export function Button({
  label,
  variant = 'primary',
  icon,
  loading = false,
  fullWidth = false,
  compact = false,
  iconAfter = false,
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
        container(c, variant, off, pressed),
        {
          minHeight: compact ? 40 : 48,
          paddingVertical: compact ? 8 : 12,
          paddingHorizontal: compact ? 16 : 20,
          flexDirection: iconAfter ? 'row-reverse' : 'row',
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
          {icon ? <Icon name={icon} size={compact ? 16 : 18} color={fg} /> : null}
          <Txt weight="bold" size={compact ? 14 : 15} tracking={-0.1} color={fg}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

/** Round icon button ringed in ink, like a station marker — the header's back / menu affordances. */
export function IconButton({
  icon,
  label,
  onPress,
  size = 40,
  iconSize = 18,
  color: tint,
  disabled,
  background: fill,
  radius,
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
  const background = fill ?? c.background;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={() => tip(label)}
      // Small variants (the sheet's close) still get a 44pt target.
      hitSlop={Math.max(0, Math.ceil((44 - size) / 2))}
      style={({ pressed }) => ({
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius ?? size / 2,
        borderWidth: 2,
        borderColor: c.text,
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
      hitSlop={9}
      style={({ pressed }) => ({
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 13,
        borderWidth: 2,
        borderColor: c.text,
        backgroundColor: pressed ? c.surfaceSelected : c.background,
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
