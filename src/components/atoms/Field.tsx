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

export function Field({ label, hint, error, mono = false, style, onFocus, onBlur, ...rest }: FieldProps) {
  const c = useColors();
  const dark = useDark();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Txt weight="semibold" size={13}>
          {label}
        </Txt>
      ) : null}
      {/* The ring is a 3px border that is always there, transparent until focus
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
          placeholderTextColor={c.textSecondary}
          underlineColorAndroid="transparent"
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
              paddingVertical: 9,
              borderRadius: Radius.md,
              borderWidth: 2,
              borderColor: error ? c.dangerBright : focused ? c.accent : c.borderField,
              // Paper-white on the panel (a well in dark mode): the edge is
              // drawn by the border, the fill only says "type here".
              backgroundColor: c.background,
              color: c.text,
              fontFamily: mono ? Fonts.monoBold : Fonts.medium,
              fontSize: mono ? 15 : 16,
              ...(mono ? { letterSpacing: 1.5 } : null),
            },
            style,
          ]}
          {...rest}
        />
      </View>
      {error ? (
        <Txt size={12} leading={1.4} weight="semibold" tone="danger" accessibilityRole="alert">
          {error}
        </Txt>
      ) : typeof hint === 'string' ? (
        <Txt size={12} leading={1.4} tone="secondary">
          {hint}
        </Txt>
      ) : (
        hint ?? null
      )}
    </View>
  );
}
