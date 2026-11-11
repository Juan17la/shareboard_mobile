import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { Radius, type Palette } from '@/constants/theme';
import { useColors } from '@/features/session/store';

import { Icon, type IconName } from './Icon';
import { tip } from '../molecules/Toast';
import { Txt } from './Text';

/**
 * Rounded rectangles, flat. `primary` is the one filled blue button a surface
 * gets; `secondary` is a grey fill, `ghost` is plain tinted text, `danger` is
 * a red tint for the answer that destroys something, `dashed` a drop target.
 * 44pt tall, 36 when `compact`. Mirrors web `atoms/Button.tsx`.
 */
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
      return c.accentText;
    case 'danger':
      return c.danger;
    case 'dashed':
      return c.textSecondary;
    default:
      return '#FFFFFF';
  }
}

/** The fill at rest and under the finger: pressing darkens it, nothing moves. */
function fills(c: Palette, variant: ButtonVariant): [rest: string, pressed: string] {
  switch (variant) {
    case 'primary':
      return [c.accent, c.accentDeep];
    case 'secondary':
      return [c.fill, c.fillStrong];
    case 'danger':
      return [c.dangerSoft, c.fillStrong];
    case 'ghost':
      return ['transparent', c.accentSofter];
    default:
      return ['transparent', c.fill];
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
  const [fill, pressedFill] = fills(c, variant);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      // The compact size is drawn at 36 and still reaches 44 under a finger.
      hitSlop={compact ? 4 : 0}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          minHeight: compact ? 36 : 44,
          paddingVertical: compact ? 6 : 10,
          paddingHorizontal: compact ? 12 : 16,
          borderRadius: compact ? Radius.md : Radius.lg,
          backgroundColor: pressed ? pressedFill : fill,
          opacity: off ? 0.45 : 1,
          width: fullWidth ? '100%' : undefined,
          ...(variant === 'dashed'
            ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderDashed }
            : null),
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={compact ? 15 : 17} color={fg} /> : null}
          <Txt weight="semibold" size={compact ? 14 : 16} color={fg}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

/** Round icon button on a grey fill: the sheet's close and back, the header's menu. */
export function IconButton({
  icon,
  label,
  onPress,
  size = 36,
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
  const background = fill ?? c.fill;
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
        backgroundColor: pressed ? c.fillStrong : background,
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
        backgroundColor: pressed ? c.fillStrong : c.fill,
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
