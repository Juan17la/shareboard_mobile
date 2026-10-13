/**
 * The welcome screens, once per install: what the app does, what to call you,
 * and an account — which can wait ("Not now"; sharing asks again later).
 *
 * Three short steps in the manner of Apple's own first-run screens: one idea
 * each, a big title, a few lines, and one obvious button at the bottom. They
 * stand on the same wash as the identity screen, which is the second step.
 */
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/features/i18n/store';
import { useColors, useSessionStore } from '@/features/session/store';

import { AuthForm } from '../account/AuthForm';
import { Backdrop } from '../ui/Backdrop';
import { Button } from '../ui/Button';
import { Icon, type IconName } from '../ui/Icon';
import { Txt } from '../ui/Text';
import { NicknameScreen } from './NicknameScreen';

const APP_ICON = require('../../../assets/images/icon.png');

export function Onboarding({ landscape }: { landscape: boolean }) {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'welcome' | 'name' | 'account'>('welcome');
  const finish = useSessionStore((s) => s.setOnboarded);

  if (step === 'name') {
    return (
      <NicknameScreen
        blank
        landscape={landscape}
        onContinue={(name) => {
          useSessionStore.getState().setNickname(name);
          setStep('account');
        }}
      />
    );
  }

  const features: [IconName, string, string][] = [
    ['pencil', t.welcomeDrawTitle, t.welcomeDrawBody],
    ['people', t.welcomeShareTitle, t.welcomeShareBody],
    ['sparkle', t.welcomeAiTitle, t.welcomeAiBody],
  ];
  const side = Math.max(insets.left, insets.right, landscape ? 46 : 28);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop variant="nickname" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            gap: 28,
            paddingTop: insets.top + (landscape ? 20 : 64),
            paddingBottom: Math.max(insets.bottom, 16) + 20,
            paddingHorizontal: side,
            width: '100%',
            maxWidth: 520,
            alignSelf: 'center',
          }}
        >
          {step === 'welcome' ? (
            <>
              <View style={{ alignItems: 'center', gap: 16 }}>
                <Image
                  source={APP_ICON}
                  accessibilityIgnoresInvertColors
                  style={{ width: 72, height: 72, borderRadius: 18 }}
                />
                <Txt weight="extrabold" size={30} leading={1.1} tracking={-0.6} style={{ textAlign: 'center' }} accessibilityRole="header">
                  {t.welcomeTitle}
                </Txt>
              </View>
              <View style={{ gap: 22 }}>
                {features.map(([icon, title, body]) => (
                  <View key={title} style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
                    <View style={{ paddingTop: 2 }}>
                      <Icon name={icon} size={30} color={c.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Txt weight="bold" size={15.5} leading={1.2}>
                        {title}
                      </Txt>
                      <Txt size={13.5} leading={1.4} tone="secondary">
                        {body}
                      </Txt>
                    </View>
                  </View>
                ))}
              </View>
              <View style={{ flex: 1, minHeight: 12 }} />
              <Button label={t.continue} fullWidth onPress={() => setStep('name')} />
            </>
          ) : (
            <>
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Icon name="user" size={48} color={c.accent} />
                <Txt weight="extrabold" size={26} leading={1.15} tracking={-0.5} style={{ textAlign: 'center' }} accessibilityRole="header">
                  {t.accountTitle}
                </Txt>
                <Txt size={13.5} leading={1.45} tone="secondary" style={{ textAlign: 'center' }}>
                  {t.accountSub}
                </Txt>
              </View>
              <View style={{ gap: 4 }}>
                <AuthForm onDone={finish} />
                <Button label={t.notNow} variant="ghost" fullWidth compact onPress={finish} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
