/**
 * "What should we call you?" — the identity step before a board opens.
 *
 * There are no accounts, so this name and colour *are* the user as far as the
 * board is concerned: they label the cursor other people watch move and the
 * avatar in the header. Both are remembered per install, so a returning user
 * sees their own name already filled in and one tap gets them through.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, NicknameColors, Radius } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { LIMITS } from '@/features/board/model';
import { useSessionStore } from '@/features/session/store';

import { Avatar } from '../ui/Avatar';
import { Backdrop } from '../ui/Backdrop';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { GlassPanel } from '../ui/Glass';
import { SectionLabel } from '../ui/Sheet';
import { Txt } from '../ui/Text';

export function NicknameScreen({
  landscape,
  onContinue,
}: {
  landscape: boolean;
  onContinue: (nickname: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const storedNickname = useSessionStore((s) => s.nickname);
  const nickColor = useSessionStore((s) => s.nickColor);
  const setNickColor = useSessionStore((s) => s.setNickColor);

  const [draft, setDraft] = useState(storedNickname);
  const ready = draft.trim().length > 0;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop variant="nickname" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            gap: 22,
            paddingTop: insets.top + (landscape ? 16 : 56),
            paddingBottom: Math.max(insets.bottom, 16) + 24,
            paddingHorizontal: Math.max(insets.left, insets.right, landscape ? 46 : 24),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 7 }}>
            <Txt weight="extrabold" size={24} leading={1.15} tracking={-0.5}>
              {t.nickTitle}
            </Txt>
            <Txt size={13.5} leading={1.45} color="#565D6C">
              {t.nickSub}
            </Txt>
          </View>

          <GlassPanel level="row" radius={Radius.xl} border={Colors.border}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <Avatar name={draft || '?'} color={nickColor} size={46} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Field
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t.nickPlaceholder}
                  maxLength={LIMITS.maxNicknameLength}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoFocus={!storedNickname}
                  returnKeyType="go"
                  onSubmitEditing={() => ready && onContinue(draft.trim())}
                  style={{
                    borderWidth: 0,
                    backgroundColor: 'transparent',
                    paddingHorizontal: 0,
                    paddingVertical: 4,
                    fontSize: 17,
                  }}
                />
              </View>
            </View>
          </GlassPanel>

          <View style={{ gap: 9 }}>
            <SectionLabel>{t.yourColor}</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: -4 }}>
              {NicknameColors.map((color) => {
                const active = nickColor === color;
                return (
                  // The selected swatch gets a coloured ring around a white
                  // gap. Two nested views rather than a shadow: a zero-radius
                  // shadow reads as a ring only on iOS.
                  <Pressable
                    key={color}
                    accessibilityRole="radio"
                    accessibilityLabel={color}
                    accessibilityState={{ selected: active }}
                    onPress={() => setNickColor(color)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: active ? color : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: color,
                        borderWidth: active ? 3 : 1,
                        borderColor: active ? '#FFFFFF' : 'rgba(27,32,48,0.12)',
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 16 }} />

          <Button
            label={t.continue}
            onPress={() => onContinue(draft.trim())}
            disabled={!ready}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
