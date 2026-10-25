import { useState, type Ref } from 'react';
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
  ref?: Ref<TextInput>;
}

export function Field({ label, hint, error, mono = false, style, onFocus, onBlur, ...rest }: FieldProps) {
  const c = useColors();
  const dark = useDark();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      {label ? (
        <Txt weight="extrabold" size={10.5} tracking={0.9} style={{ opacity: 0.7 }}>
          {label.toUpperCase()}
        </Txt>
      ) : null}
      {/* The ring is a 3px border that is always there, transparent until focus
          or an error lights it: nothing shifts when it appears. */}
      <View
        style={{
          borderRadius: Radius.lg + 3,
          borderWidth: 3,
          borderColor: error ? 'rgba(255,59,48,0.22)' : focused ? c.accentSoft : 'transparent',
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
              minHeight: 48,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: Radius.lg,
              borderWidth: focused ? 2 : 1.5,
              borderColor: error ? c.dangerBright : focused ? c.accent : c.borderField,
              // Paper-white on the panel (a well in dark mode): the edge is
              // drawn by the border, the fill only says "type here".
              backgroundColor: c.background,
              color: c.text,
              fontFamily: mono ? Fonts.monoBold : Fonts.semibold,
              fontSize: mono ? 15 : 16,
              ...(mono ? { letterSpacing: 1.5 } : null),
            },
            style,
          ]}
          {...rest}
        />
      </View>
      {error ? (
        <Txt size={11.5} leading={1.4} weight="semibold" tone="danger" accessibilityRole="alert">
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
