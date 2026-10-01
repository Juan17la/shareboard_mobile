import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radius } from '@/constants/theme';
import { useColors, useDark } from '@/features/session/store';

import { Txt } from './Text';

export interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Codes and PINs are typed in JetBrains Mono, spaced out. */
  mono?: boolean;
}

export function Field({ label, hint, error, mono = false, style, onFocus, onBlur, ...rest }: FieldProps) {
  const c = useColors();
  const dark = useDark();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      {label ? (
        <Txt weight="extrabold" size={10.5} tracking={0.9} tone="secondary">
          {label.toUpperCase()}
        </Txt>
      ) : null}
      <TextInput
        // Remounted on a theme switch: Android rebuilds an input's background
        // when its colours change and drops the padding set on it, which
        // clipped the text (the nickname field in Settings).
        key={dark ? 'dark' : 'light'}
        placeholderTextColor={c.borderDashed}
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
            paddingHorizontal: 13,
            paddingVertical: 12,
            borderRadius: Radius.lg,
            borderWidth: 1.5,
            borderColor: error ? c.dangerBright : focused ? c.accent : c.borderField,
            backgroundColor: c.surface,
            color: c.text,
            fontFamily: mono ? Fonts.monoBold : Fonts.semibold,
            fontSize: mono ? 15 : 16,
            ...(mono ? { letterSpacing: 1.5 } : null),
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Txt size={11.5} leading={1.4} tone="danger">
          {error}
        </Txt>
      ) : hint ? (
        <Txt size={11.5} leading={1.4} tone="secondary">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}
