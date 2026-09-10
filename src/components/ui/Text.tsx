/**
 * The one way text is rendered in this app.
 *
 * Weight and italics are separate font *files* here rather than style flags
 * (see `hooks/use-app-fonts.ts`), so every call site has to name a family. A
 * component makes that a prop — `<Txt weight="extrabold">` — instead of a
 * `fontFamily` string repeated a hundred times, and keeps one place to change
 * if the type ramp moves.
 */
import { Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';
export type TextTone = 'default' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'inverse';

const FAMILY: Record<TextWeight, string> = {
  regular: Fonts.regular,
  medium: Fonts.medium,
  semibold: Fonts.semibold,
  bold: Fonts.bold,
  extrabold: Fonts.extrabold,
};

const TONE: Record<TextTone, string> = {
  default: Colors.text,
  secondary: Colors.textSecondary,
  tertiary: Colors.textTertiary,
  accent: Colors.accent,
  danger: Colors.danger,
  inverse: '#FFFFFF',
};

export interface TxtProps extends TextProps {
  weight?: TextWeight;
  tone?: TextTone;
  /** JetBrains Mono — codes, PINs, percentages. Overrides `weight`'s family. */
  mono?: boolean;
  italic?: boolean;
  size?: number;
  /** Line height as a multiple of `size`. */
  leading?: number;
  /** Letter spacing in px; the design tightens large headings and opens codes. */
  tracking?: number;
  color?: string;
}

export function Txt({
  weight = 'regular',
  tone = 'default',
  mono = false,
  italic = false,
  size = 14,
  leading,
  tracking,
  color,
  style,
  ...rest
}: TxtProps) {
  const family = mono
    ? weight === 'bold' || weight === 'extrabold'
      ? Fonts.monoBold
      : Fonts.mono
    : italic
      ? weight === 'extrabold' || weight === 'bold'
        ? Fonts.extraboldItalic
        : Fonts.italic
      : FAMILY[weight];

  return (
    <Text
      style={[
        {
          fontFamily: family,
          fontSize: size,
          color: color ?? TONE[tone],
          ...(leading ? { lineHeight: Math.round(size * leading) } : null),
          ...(tracking !== undefined ? { letterSpacing: tracking } : null),
        },
        style,
      ]}
      {...rest}
    />
  );
}
