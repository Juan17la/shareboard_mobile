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

import { Colors } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { useSessionStore } from '@/features/session/store';
import { notify, tick } from '@/utils/haptics';

import { Backdrop } from '../ui/Backdrop';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Text';

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

  const keySize = landscape ? { width: 66, height: 42, radius: 14 } : { width: 74, height: 60, radius: 18 };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop variant="pin" />
      <ScrollView
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
            width: 46,
            height: 46,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: Colors.border,
            backgroundColor: 'rgba(255,255,255,0.8)',
          }}
        >
          <Icon name="lock" size={22} color={Colors.text} />
        </View>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Txt weight="extrabold" size={20} leading={1.2} tracking={-0.4}>
            {t.pinTitle}
          </Txt>
          <Txt size={13} leading={1.4} color="#565D6C" style={{ textAlign: 'center' }}>
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
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: filled ? Colors.accent : 'transparent',
                  borderWidth: filled ? 0 : 2,
                  borderColor: 'rgba(27,32,48,0.2)',
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
            width: keySize.width * 3 + (landscape ? 16 : 24),
            gap: landscape ? 8 : 12,
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
                borderWidth: key ? 1 : 0,
                borderColor: Colors.border,
                backgroundColor: key
                  ? pressed
                    ? Colors.surfaceSelected
                    : 'rgba(255,255,255,0.78)'
                  : 'transparent',
                ...(key
                  ? {
                      shadowColor: '#151A2D',
                      shadowOpacity: 0.07,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 2,
                    }
                  : null),
              })}
            >
              {key === 'back' ? (
                <Icon name="close" size={20} color={Colors.text} />
              ) : (
                <Txt weight="bold" size={21}>
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
