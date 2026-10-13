/**
 * Create an account, or sign in to one: two fields and one button, with a
 * link underneath that flips between the two. Used by the last welcome screen,
 * the account sheet, and wherever sharing asks for an account first.
 *
 * Registering takes the name and icon already chosen (welcome screen or
 * settings), so it asks for nothing else. Either way the guest id this install
 * had goes along, and the boards it made become the account's.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useT } from '@/features/i18n/store';
import type { Strings } from '@/features/i18n/strings';
import { LIMITS } from '@/features/board/model';
import { useColors, useSessionStore } from '@/features/session/store';
import { login, register } from '@/services/api/boards';
import { ApiError } from '@/services/api/client';

import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

export type AuthMode = 'register' | 'login';

const USERNAME = /^[a-zA-Z0-9._]{3,24}$/;

export function AuthForm({
  initialMode = 'register',
  onDone,
}: {
  initialMode?: AuthMode;
  /** Signed in. */
  onDone: () => void;
}) {
  const c = useColors();
  const t = useT();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registering = mode === 'register';
  const ready =
    USERNAME.test(username.trim()) &&
    (registering ? password.length >= LIMITS.minPasswordLength : password.length > 0);

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const { guestId, nickname, avatar, signIn } = useSessionStore.getState();
    const name = username.trim();
    try {
      const res = registering
        ? await register({ username: name, password, nickname, avatar, deviceId: guestId })
        : await login({ username: name, password, deviceId: guestId });
      signIn(
        { id: res.account.id, username: res.account.username, token: res.token },
        { nickname: res.account.nickname, avatar: res.account.avatar },
      );
      toast(t.toastSignedIn);
      onDone();
    } catch (err) {
      setError(messageFor(err, t));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <Field
        label={t.username}
        value={username}
        onChangeText={(v) => setUsername(v.replace(/\s/g, '').slice(0, 24))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        accessibilityLabel={t.username}
        returnKeyType="next"
        hint={registering ? t.usernameHint : undefined}
      />
      <View>
        <Field
          label={t.password}
          value={password}
          onChangeText={(v) => setPassword(v.slice(0, 128))}
          secureTextEntry={!reveal}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={registering ? 'new-password' : 'current-password'}
          textContentType={registering ? 'newPassword' : 'password'}
          accessibilityLabel={t.password}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          hint={registering ? t.passwordHint : undefined}
          style={{ paddingRight: 48 }}
        />
        {/* Sits on the input row, under the 10.5pt label and its 7pt gap. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reveal ? t.hidePassword : t.showPassword}
          accessibilityState={{ selected: reveal }}
          onPress={() => setReveal((on) => !on)}
          hitSlop={4}
          style={{ position: 'absolute', right: 4, top: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={reveal ? 'eye-slash' : 'eye'} size={19} color={c.textSecondary} />
        </Pressable>
      </View>

      {error ? (
        <Txt size={12.5} leading={1.4} weight="semibold" tone="danger" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}

      <Button
        label={registering ? t.createAccount : t.signIn}
        loading={busy}
        disabled={!ready}
        fullWidth
        onPress={() => void submit()}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setMode(registering ? 'login' : 'register');
          setError(null);
        }}
        hitSlop={6}
        style={{ alignSelf: 'center', paddingHorizontal: 8, paddingVertical: 4 }}
      >
        <Txt weight="bold" size={13} tone="accent">
          {registering ? t.haveAccount : t.noAccount}
        </Txt>
      </Pressable>
    </View>
  );
}

function messageFor(err: unknown, t: Strings): string {
  if (!(err instanceof ApiError)) return t.errAuth;
  switch (err.code) {
    case 'LOGIN_INVALID':
      return t.errLogin;
    case 'USERNAME_TAKEN':
      return t.errUsernameTaken;
    case 'NETWORK':
      return t.needOnline;
    case 'VALIDATION':
    case 'RATE_LIMITED':
      return err.message;
    default:
      return t.errAuth;
  }
}
