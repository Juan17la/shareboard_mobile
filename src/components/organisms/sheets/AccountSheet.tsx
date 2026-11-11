/**
 * "Account": who is signed in, their email and password, and the way out — or,
 * for a guest, the form to sign in. Sharing opens it too; it carries on
 * (`onSignedIn`) once the account may share, which for a new or older account
 * means after its email is verified here.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Radius } from '@/constants/theme';
import { fill } from '@/features/i18n/strings';
import { useT } from '@/features/i18n/store';
import { useSessionStore } from '@/features/session/store';
import { getMe } from '@/services/api/boards';
import { ApiError } from '@/services/api/client';

import { EmailSection, PasswordSection } from '../account/AccountSecurity';
import { AuthForm, type AuthMode } from '../account/AuthForm';
import { Avatar } from '../../atoms/Avatar';
import { Button } from '../../atoms/Button';
import { GlassPanel } from '../../atoms/Glass';
import { Sheet } from '../../molecules/Sheet';
import { Txt } from '../../atoms/Text';
import { toast } from '../../molecules/Toast';

export function AccountSheet({
  open,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after signing in; closes the sheet by default. */
  onSignedIn?: () => void;
}) {
  const t = useT();
  // Sign in first: most people opening this already have an account somewhere.
  const [mode, setMode] = useState<AuthMode>('login');
  const account = useSessionStore((s) => s.account);
  const nickname = useSessionStore((s) => s.nickname);
  const nickColor = useSessionStore((s) => s.nickColor);
  const avatar = useSessionStore((s) => s.avatar);
  const done = onSignedIn ?? onClose;

  // The email may have been verified (or the password changed) on another
  // device since this install signed in: ask the server, which decides anyway.
  const signedIn = account !== null;
  useEffect(() => {
    if (!open || !signedIn) return;
    getMe().then(
      (me) =>
        useSessionStore.getState().updateAccount({
          email: me.email,
          emailVerified: me.emailVerified,
          verificationRequired: me.verificationRequired,
        }),
      (err) => {
        if (err instanceof ApiError && err.code === 'AUTH_REQUIRED') {
          useSessionStore.getState().signOut();
          toast(t.sessionExpired);
        }
      },
    );
  }, [open, signedIn, t]);

  return (
    <Sheet
      open={open}
      title={account ? t.sheetAccount : mode === 'register' ? t.signUp : mode === 'reset' ? t.forgotPassword : t.signIn}
      large={!account}
      onClose={onClose}
      closeLabel={t.close}
      tall={!account}
    >
      {account ? (
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <GlassPanel level="row" radius={Radius.lg} border={null}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
              <Avatar name={nickname} color={nickColor} avatar={avatar} size={40} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt weight="semibold" size={16} leading={1.25} numberOfLines={1}>
                  {nickname}
                </Txt>
                <Txt size={12} tone="secondary" numberOfLines={1}>
                  {fill(t.signedInAs, { USER: account.username })}
                </Txt>
              </View>
            </View>
          </GlassPanel>
          <EmailSection onVerified={onSignedIn} />
          <PasswordSection />
          <Button
            label={t.signOut}
            variant="danger"
            fullWidth
            onPress={() => {
              useSessionStore.getState().signOut();
              toast(t.toastSignedOut);
              onClose();
            }}
          />
        </View>
      ) : (
        <View style={{ paddingBottom: 8 }}>
          {/* An account that cannot share yet stays here, on its email. */}
          <AuthForm mode={mode} onModeChange={setMode} onDone={(res) => (res.account.emailVerified || !res.account.verificationRequired ? done() : undefined)} />
        </View>
      )}
    </Sheet>
  );
}

