import { useState, type ReactNode, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radius } from '@/constants/theme';
import { useColors, useDark } from '@/features/session/store';

import { Txt } from './Text';

export interface FieldProps extends TextInputProps {
  label?: string;
  /** A line of help under the field; a node for one that changes as it is met. */
  hint?: ReactNode;
  error?: string | null;
  /** Codes and PINs are typed in JetBrains Mono, spaced out. */
  mono?: boolean;
  ref?: Ref<TextInput>;
}

/**
 * A borderless well on the sheet: white on the grouped grey, 44pt tall. The
 * label and the hint line up with the text inside it. Mirrors web `atoms/Field.tsx`.
 */
export function Field({ label, hint, error, mono = false, style, onFocus, onBlur, ...rest }: FieldProps) {
  const c = useColors();
  const dark = useDark();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      {label ? (
        <Txt weight="medium" size={13} tone="secondary" style={{ paddingHorizontal: 12 }}>
          {label}
        </Txt>
      ) : null}
      {/* The halo is a 3px border that is always there, transparent until focus
          or an error lights it: nothing shifts when it appears. */}
      <View
        style={{
          borderRadius: Radius.md + 3,
          borderWidth: 3,
          borderColor: error ? c.dangerSoft : focused ? c.accentSoft : 'transparent',
          margin: -3,
        }}
      >
        <TextInput
          // Remounted on a theme switch: Android rebuilds an input's background
          // when its colours change and drops the padding set on it, which
          // clipped the text (the nickname field in Settings).
          key={dark ? 'dark' : 'light'}
          placeholderTextColor={c.textTertiary}
          underlineColorAndroid="transparent"
          selectionColor={c.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              minHeight: 44,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: Radius.md,
              // The edge is always 1.5px wide and only changes colour.
              borderWidth: 1.5,
              borderColor: error ? c.dangerBright : focused ? c.accent : 'transparent',
              backgroundColor: c.glassTintSolid,
              color: c.text,
              fontFamily: mono ? Fonts.monoBold : Fonts.regular,
              fontSize: mono ? 15 : 16,
              ...(mono ? { letterSpacing: 1.5 } : null),
            },
            style,
          ]}
          {...rest}
        />
      </View>
      {error ? (
        <Txt size={12} leading={1.4} weight="medium" tone="danger" accessibilityRole="alert" style={{ paddingHorizontal: 12 }}>
          {error}
        </Txt>
      ) : typeof hint === 'string' ? (
        <Txt size={12} leading={1.4} tone="secondary" style={{ paddingHorizontal: 12 }}>
          {hint}
        </Txt>
      ) : hint ? (
        <View style={{ paddingHorizontal: 12 }}>{hint}</View>
      ) : null}
    </View>
  );
}
