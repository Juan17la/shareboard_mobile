/**
 * The 4-digit PIN gate on a private board.
 *
 * It draws its own keypad instead of using a number-pad keyboard. The design
 * asks for it, and it earns its place: the keys are far larger than a keyboard's,
 * the four dots make the length obvious without a caret, and there is nothing on
 * screen but the one thing being asked for — which matters for the audience this
 * app is aimed at.
 *
 * The PIN is submitted the moment the fourth digit lands; there is no confirm
 * button to hunt for, and a wrong one clears itself so the next attempt starts
 * clean.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/features/i18n/store';
import { useSessionStore, useColors } from '@/features/session/store';
import { notify, tick } from '@/utils/haptics';

import { Backdrop } from '../atoms/Backdrop';
import { Icon } from '../atoms/Icon';
import { Txt } from '../atoms/Text';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

export function PinScreen({
  landscape,
  error,
  onSubmit,
}: {
  landscape: boolean;
  /** Set when the previous attempt was rejected. */
  error: string | null;
  onSubmit: (pin: string) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const haptics = useSessionStore((s) => s.settings.haptics);
  const [pin, setPin] = useState('');

  // A rejected attempt buzzes. The dots are cleared by the submit itself
  // (below), so by the time an error comes back the keypad is already ready for
  // the next try rather than holding four digits the user has to delete.
  useEffect(() => {
    if (error) notify(haptics, false);
  }, [error, haptics]);

  const press = (key: (typeof KEYS)[number]) => {
    if (!key) return;
    tick(haptics);
    if (key === 'back') {
      setPin((current) => current.slice(0, -1));
      return;
    }
    setPin((current) => {
      const next = (current + key).slice(0, 4);
      if (next.length === 4) {
        // Let the fourth dot paint before the screen changes under the finger,
        // then hand it over and reset for whatever comes back.
        setTimeout(() => {
          setPin('');
          onSubmit(next);
        }, 160);
      }
      return next;
    });
  };

  const keySize = landscape ? { width: 66, height: 42, radius: 21 } : { width: 68, height: 68, radius: 34 };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView
        // The grouped ground of a sheet, full screen: the keys are white on it.
        style={{ backgroundColor: c.sheet }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          gap: 16,
          paddingTop: insets.top + (landscape ? 12 : 52),
          paddingBottom: Math.max(insets.bottom, 16) + 18,
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.accentSoft,
          }}
        >
          <Icon name="lock" size={21} color={c.accentText} />
        </View>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Txt weight="semibold" size={20} leading={1.2} tracking={-0.3} accessibilityRole="header">
            {t.pinTitle}
          </Txt>
          <Txt
            size={14}
            leading={1.4}
            weight={error ? 'medium' : 'regular'}
            color={error ? c.danger : c.textSecondary}
            accessibilityRole={error ? 'alert' : undefined}
            style={{ textAlign: 'center' }}
          >
            {error ? t.pinWrong : t.pinSub}
          </Txt>
        </View>

        <View
          style={{ flexDirection: 'row', gap: 12, marginTop: 6, marginBottom: 2 }}
          accessibilityLabel={`${pin.length} / 4`}
        >
          {[0, 1, 2, 3].map((i) => {
            const filled = i < pin.length;
            return (
              <View
                key={i}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 7,
                  backgroundColor: filled ? c.accent : 'transparent',
                  borderWidth: filled ? 0 : 1.5,
                  borderColor: c.borderDashed,
                }}
              />
            );
          })}
        </View>

        <View style={{ flex: 1, minHeight: 8 }} />

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            width: keySize.width * 3 + (landscape ? 16 : 40),
            gap: landscape ? 8 : 20,
            rowGap: landscape ? 8 : 12,
          }}
        >
          {KEYS.map((key, index) => (
            <Pressable
              key={`${key}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? t.deleteDigit : key || ' '}
              disabled={!key}
              onPress={() => press(key)}
              style={({ pressed }) => ({
                width: keySize.width,
                height: keySize.height,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: keySize.radius,
                // Digits are white keys; delete is a bare glyph, as on a phone's own keypad.
                backgroundColor: !key ? 'transparent' : pressed ? c.fillStrong : key === 'back' ? 'transparent' : c.glassTintSolid,
              })}
            >
              {key === 'back' ? (
                <Icon name="close" size={20} color={c.textSecondary} />
              ) : (
                <Txt size={26}>
                  {key}
                </Txt>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
