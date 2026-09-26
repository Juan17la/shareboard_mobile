/**
 * "What should we call you?" — the identity step before a board opens.
 *
 * There are no accounts, so this name and colour *are* the user as far as the
 * board is concerned: they label the cursor other people watch move and the
 * avatar in the header. Both are remembered per install, so a returning user
 * sees their own name already filled in and one tap gets them through.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatars, Radius } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { LIMITS } from '@/features/board/model';
import { useSessionStore, useColors } from '@/features/session/store';

import { Avatar } from '../ui/Avatar';
import { Backdrop, BackdropScene } from '../ui/Backdrop';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { GlassPanel, GlassScene, type SceneSize } from '../ui/Glass';
import { SectionLabel } from '../ui/Sheet';
import { Txt } from '../ui/Text';

const backdropScene = (size: SceneSize) => (
  <BackdropScene variant="nickname" width={size.width} height={size.height} />
);

export function NicknameScreen({
  landscape,
  onContinue,
}: {
  landscape: boolean;
  onContinue: (nickname: string) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const storedNickname = useSessionStore((s) => s.nickname);
  const nickColor = useSessionStore((s) => s.nickColor);
  const avatar = useSessionStore((s) => s.avatar);

  const [draft, setDraft] = useState(storedNickname);
  const ready = draft.trim().length > 0;

  // The wash, handed to the glass panels so they can blur it; and how far the
  // page has scrolled, so the blur follows the panels (ui/Glass).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <GlassScene render={backdropScene} scroll={scrollY}>
      <Backdrop variant="nickname" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
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

          <GlassPanel level="row" radius={Radius.xl} border={c.border}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <Avatar name={draft || '?'} color={nickColor} avatar={avatar} size={46} />
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
            {/* One choice, not two: every icon brings its own colour. */}
            <SectionLabel>{t.yourIcon}</SectionLabel>
            <AvatarPicker name={draft} />
          </View>

          <View style={{ flex: 1, minHeight: 16 }} />

          <Button
            label={t.continue}
            onPress={() => onContinue(draft.trim())}
            disabled={!ready}
            fullWidth
          />
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </GlassScene>
  );
}

/** The icon grid: one choice, not two, since every icon brings its own colour. */
export function AvatarPicker({ name }: { name: string }) {
  const avatar = useSessionStore((s) => s.avatar);
  const setAvatar = useSessionStore((s) => s.setAvatar);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: -4 }}>
      {Avatars.map(({ icon, color }) => {
        const active = avatar === icon;
        return (
          <Pressable
            key={icon}
            accessibilityRole="radio"
            accessibilityLabel={icon}
            accessibilityState={{ selected: active }}
            onPress={() => setAvatar(icon)}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: active ? color : 'transparent',
            }}
          >
            <Avatar name={name || '?'} color={color} avatar={icon} size={36} />
          </Pressable>
        );
      })}
    </View>
  );
}
