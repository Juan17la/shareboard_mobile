/**
 * Create an account, or sign in to one: a segmented switch on top, two fields
 * that explain themselves, one button. Used by the account sheet, which is
 * also wherever sharing asks for an account first.
 *
 * Registering takes the name and icon already chosen (asked just before the
 * account sheet, or in settings), so it asks for nothing else. Either way the
 * guest id this install had goes along, and the boards it made become the account's.
 */
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';


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
  mode,
  onModeChange,
  onDone,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Signed in. */
  onDone: () => void;
}) {
  const c = useColors();
  const t = useT();
  const [forgot, setForgot] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const [shown, setShown] = useState({ username: false, password: false });
  const userRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const registering = mode === 'register';
  const name = username.trim();
  // Sign-in only needs something typed: older accounts may predate today's rules.
  const userErr = !name
    ? t.errUserRequired
    : registering && !USERNAME.test(name)
      ? t.errUserInvalid
      : taken
        ? t.errUsernameTaken
        : null;
  const passErr = !password
    ? t.errPassRequired
    : registering && password.length < LIMITS.minPasswordLength
      ? t.errPassShort
      : null;

  function switchMode(next: AuthMode) {
    onModeChange(next);
    setForgot(false);
    setError(null);
    setTaken(false);
    setShown({ username: false, password: false });
  }

  async function submit() {
    if (busy) return;
    if (userErr || passErr) {
      setShown({ username: true, password: true });
      (userErr ? userRef : passRef).current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const { guestId, nickname, avatar, signIn } = useSessionStore.getState();
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
      if (err instanceof ApiError && err.code === 'USERNAME_TAKEN') {
        setTaken(true);
        setShown((s) => ({ ...s, username: true }));
      } else {
        setError(messageFor(err, t));
      }
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Field
        ref={userRef}
        label={t.username}
        value={username}
        onChangeText={(v) => {
          setUsername(v.replace(/\s/g, '').slice(0, 24));
          setTaken(false);
        }}
        onBlur={() => setShown((s) => ({ ...s, username: true }))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        accessibilityLabel={t.username}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passRef.current?.focus()}
        error={shown.username ? userErr : null}
        hint={registering ? <Rule met={USERNAME.test(name)}>{t.usernameHint}</Rule> : undefined}
      />
      <View>
        <Field
          ref={passRef}
          label={t.password}
          value={password}
          onChangeText={(v) => setPassword(v.slice(0, 128))}
          onBlur={() => setShown((s) => ({ ...s, password: true }))}
          secureTextEntry={!reveal}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={registering ? 'new-password' : 'current-password'}
          textContentType={registering ? 'newPassword' : 'password'}
          accessibilityLabel={t.password}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={shown.password ? passErr : null}
          hint={registering ? <Rule met={password.length >= LIMITS.minPasswordLength}>{t.passwordHint}</Rule> : undefined}
          style={{ paddingRight: 48 }}
        />
        {/* Sits on the input row, under the 13pt label and its 6pt gap. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reveal ? t.hidePassword : t.showPassword}
          accessibilityState={{ selected: reveal }}
          onPress={() => setReveal((on) => !on)}
          hitSlop={4}
          style={{ position: 'absolute', right: 2, top: 23, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
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
        variant="go"
        icon="go"
        iconAfter
        label={registering ? t.signUp : t.signIn}
        loading={busy}
        fullWidth
        onPress={() => void submit()}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <Txt size={14} tone="secondary">
          {registering ? t.haveAccount : t.noAccount}
        </Txt>
        <Pressable
          accessibilityRole="button"
          onPress={() => switchMode(registering ? 'login' : 'register')}
          hitSlop={10}
        >
          <Txt weight="bold" size={14} color={c.accentText}>
            {registering ? t.signIn : t.signUp}
          </Txt>
        </Pressable>
      </View>
      {registering ? null : (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: forgot }}
            onPress={() => setForgot((on) => !on)}
            hitSlop={10}
          >
            <Txt size={13} tone="secondary" style={{ textDecorationLine: 'underline' }}>
              {t.forgotPassword}
            </Txt>
          </Pressable>
          {forgot ? (
            <Txt size={13} leading={1.4} tone="secondary" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
              {t.forgotBody}
            </Txt>
          ) : null}
        </View>
      )}
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

/** A rule under a field that ticks itself off as it is met. */
function Rule({ met, children }: { met: boolean; children: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: met ? c.go : 'transparent',
          borderWidth: met ? 0 : 1.5,
          borderColor: c.textTertiary,
        }}
      >
        {met ? <Icon name="check" size={9} color="#FFFFFF" /> : null}
      </View>
      <Txt size={12} leading={1.4} weight={met ? 'semibold' : 'regular'} color={met ? c.go : c.textSecondary} style={{ flex: 1 }}>
        {children}
      </Txt>
    </View>
  );
}
