/**
 * Sign in, sign up, or reset a forgotten password: fields that explain
 * themselves, one button, and under it the way to the other ones. Used by the
 * account sheet, which is also wherever sharing asks for an account first.
 * Twin of web's `components/account/AuthForm.tsx`.
 *
 * Registering takes the name and icon already chosen (asked just before the
 * account sheet, or in settings), so it asks only for a username, an email and
 * a password. Either way the guest id this install had goes along, and the
 * boards it made become the account's.
 *
 * A forgotten password is two steps: the email, then the 6-digit code it got
 * and a new password. The server answers the first the same whether or not the
 * email has an account, so this says "if it has one" rather than "sent".
 */
import { useRef, useState, type ReactNode, type Ref } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useT } from '@/features/i18n/store';
import { LIMITS } from '@/features/board/model';
import { useColors, useSessionStore } from '@/features/session/store';
import { forgotPassword, login, register, resetPassword } from '@/services/api/boards';
import { ApiError } from '@/services/api/client';
import type { SignedIn } from '@/services/api/types';

import { Button } from '../../atoms/Button';
import { Field } from '../../atoms/Field';
import { Icon } from '../../atoms/Icon';
import { Txt } from '../../atoms/Text';
import { toast } from '../../molecules/Toast';
import { applySignedIn, authMessage, EMAIL, passwordError } from './auth';

export type AuthMode = 'register' | 'login' | 'reset';

const USERNAME = /^[a-zA-Z0-9._]{3,24}$/;
const CODE = /^\d{6}$/;

export function AuthForm({
  mode,
  onModeChange,
  onDone,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Signed in. */
  onDone: (res: SignedIn) => void;
}) {
  const t = useT();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<'username' | 'email' | null>(null);
  const [shown, setShown] = useState(false);
  const userRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const registering = mode === 'register';
  const name = username.trim();
  const mail = email.trim();
  // Sign-in only needs something typed: older accounts may predate today's rules.
  const userErr = registering
    ? !USERNAME.test(name)
      ? t.errUserInvalid
      : taken === 'username'
        ? t.errUsernameTaken
        : null
    : !name
      ? t.errUserRequired
      : null;
  const emailErr = !registering
    ? null
    : !mail
      ? t.errEmailRequired
      : !EMAIL.test(mail)
        ? t.errEmailInvalid
        : taken === 'email'
          ? t.errEmailTaken
          : null;
  const passErr = registering ? passwordError(password, t) : !password ? t.errPassRequired : null;

  function switchMode(next: AuthMode) {
    onModeChange(next);
    setError(null);
    setTaken(null);
    setShown(false);
  }

  async function submit() {
    if (busy) return;
    if (userErr || emailErr || passErr) {
      setShown(true);
      (userErr ? userRef : emailErr ? emailRef : passRef).current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const { guestId, nickname, avatar } = useSessionStore.getState();
    try {
      const res = registering
        ? await register({ username: name, email: mail, password, nickname, avatar, deviceId: guestId })
        : await login({ login: name, password, deviceId: guestId });
      applySignedIn(res);
      toast(t.toastSignedIn);
      onDone(res);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'USERNAME_TAKEN' || err.code === 'EMAIL_TAKEN')) {
        setTaken(err.code === 'USERNAME_TAKEN' ? 'username' : 'email');
        setShown(true);
      } else {
        setError(authMessage(err, t));
      }
      setBusy(false);
    }
  }

  if (mode === 'reset') {
    return (
      <ResetForm
        onBack={() => switchMode('login')}
        onDone={(res) => {
          toast(t.toastPasswordChanged);
          onDone(res);
        }}
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Field
        ref={userRef}
        label={registering ? t.username : t.loginId}
        value={username}
        onChangeText={(v) => {
          setUsername(v.replace(/\s/g, '').slice(0, registering ? 24 : 254));
          if (taken === 'username') setTaken(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        accessibilityLabel={registering ? t.username : t.loginId}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => (registering ? emailRef : passRef).current?.focus()}
        error={shown ? userErr : null}
        hint={registering ? <Rule met={USERNAME.test(name)}>{t.usernameHint}</Rule> : undefined}
      />
      {registering ? (
        <EmailField
          ref={emailRef}
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (taken === 'email') setTaken(null);
          }}
          onSubmitEditing={() => passRef.current?.focus()}
          error={shown ? emailErr : null}
        />
      ) : null}
      <PasswordField
        ref={passRef}
        label={t.password}
        value={password}
        onChange={setPassword}
        isNew={registering}
        onSubmitEditing={() => void submit()}
        error={shown ? passErr : null}
        hint={
          registering ? <Rule met={password.length >= LIMITS.minPasswordLength}>{t.passwordHint}</Rule> : undefined
        }
      />

      <FormError error={error} />

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
        <TextLink bold onPress={() => switchMode(registering ? 'login' : 'register')}>
          {registering ? t.signIn : t.signUp}
        </TextLink>
      </View>
      {registering ? null : <TextLink onPress={() => switchMode('reset')}>{t.forgotPassword}</TextLink>}
    </View>
  );
}

/** Forgot password: the email, then its code and a new password. Signs in at the end. */
function ResetForm({ onBack, onDone }: { onBack: () => void; onDone: (res: SignedIn) => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const mail = email.trim();
  const emailErr = !mail ? t.errEmailRequired : !EMAIL.test(mail) ? t.errEmailInvalid : null;
  const codeErr = CODE.test(code) ? null : t.errCodeFormat;
  const passErr = passwordError(password, t);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(authMessage(err, t));
    }
    setBusy(false);
  }

  function submit() {
    if (busy) return;
    if (emailErr || (sent && (codeErr || passErr))) {
      setShown(true);
      (emailErr ? emailRef : codeErr ? codeRef : passRef).current?.focus();
      return;
    }
    if (!sent) {
      void run(async () => {
        await forgotPassword(mail);
        setSent(true);
        setShown(false);
        codeRef.current?.focus();
      });
    } else {
      void run(async () => {
        const res = await resetPassword({ email: mail, code, password });
        applySignedIn(res);
        onDone(res);
      });
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Txt size={14} leading={1.4} tone="secondary" accessibilityLiveRegion="polite">
        {sent ? t.resetSent : t.forgotIntro}
      </Txt>
      <EmailField
        ref={emailRef}
        value={email}
        onChange={(v) => {
          setEmail(v);
          setSent(false);
        }}
        onSubmitEditing={submit}
        error={shown ? emailErr : null}
      />
      {sent ? (
        <>
          <CodeField ref={codeRef} value={code} onChange={setCode} onSubmitEditing={() => passRef.current?.focus()} error={shown ? codeErr : null} />
          <PasswordField
            ref={passRef}
            label={t.newPassword}
            value={password}
            onChange={setPassword}
            isNew
            onSubmitEditing={submit}
            error={shown ? passErr : null}
            hint={<Rule met={password.length >= LIMITS.minPasswordLength}>{t.passwordHint}</Rule>}
          />
        </>
      ) : null}

      <FormError error={error} />

      <Button
        variant="go"
        icon="go"
        iconAfter
        label={sent ? t.changePassword : t.sendCode}
        loading={busy}
        fullWidth
        onPress={submit}
      />
      {sent ? (
        <TextLink
          bold
          onPress={() =>
            void run(async () => {
              await forgotPassword(mail);
              toast(t.toastCodeSent);
            })
          }
        >
          {t.resendCode}
        </TextLink>
      ) : null}
      <TextLink onPress={onBack}>{t.backToSignIn}</TextLink>
    </View>
  );
}

export function EmailField({
  ref,
  value,
  onChange,
  onSubmitEditing,
  error,
}: {
  ref?: Ref<TextInput>;
  value: string;
  onChange: (email: string) => void;
  onSubmitEditing?: () => void;
  error: string | null;
}) {
  const t = useT();
  return (
    <Field
      ref={ref}
      label={t.email}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\s/g, '').slice(0, 254))}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      textContentType="emailAddress"
      accessibilityLabel={t.email}
      returnKeyType="next"
      submitBehavior="submit"
      onSubmitEditing={onSubmitEditing}
      error={error}
    />
  );
}

/** The 6-digit code from an email: digits only, offered by the keyboard's one-time-code suggestion. */
export function CodeField({
  ref,
  value,
  onChange,
  onSubmitEditing,
  error,
}: {
  ref?: Ref<TextInput>;
  value: string;
  onChange: (code: string) => void;
  onSubmitEditing?: () => void;
  error: string | null;
}) {
  const t = useT();
  return (
    <Field
      ref={ref}
      label={t.emailCode}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      accessibilityLabel={t.emailCode}
      returnKeyType="next"
      submitBehavior="submit"
      onSubmitEditing={onSubmitEditing}
      mono
      error={error}
    />
  );
}

/** A password input with its show/hide toggle sitting on the input row. */
export function PasswordField({
  ref,
  label,
  value,
  onChange,
  isNew,
  onSubmitEditing,
  error,
  hint,
}: {
  ref?: Ref<TextInput>;
  label: string;
  value: string;
  onChange: (password: string) => void;
  /** A password being chosen (new-password autofill), not one being typed from memory. */
  isNew: boolean;
  onSubmitEditing?: () => void;
  error: string | null;
  hint?: ReactNode;
}) {
  const c = useColors();
  const t = useT();
  const [reveal, setReveal] = useState(false);
  return (
    <View>
      <Field
        ref={ref}
        label={label}
        value={value}
        onChangeText={(v) => onChange(v.slice(0, 128))}
        secureTextEntry={!reveal}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        accessibilityLabel={label}
        returnKeyType="go"
        onSubmitEditing={onSubmitEditing}
        error={error}
        hint={hint}
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
  );
}

export function FormError({ error }: { error: string | null }) {
  return error ? (
    <Txt size={12.5} leading={1.4} weight="semibold" tone="danger" accessibilityRole="alert">
      {error}
    </Txt>
  ) : null;
}

/** A tappable line of text: the way to another form, or a second action under a button. */
export function TextLink({ bold = false, onPress, children }: { bold?: boolean; onPress: () => void; children: string }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={{ alignSelf: 'center' }}>
      <Txt
        size={bold ? 14 : 13}
        weight={bold ? 'bold' : 'regular'}
        color={bold ? c.accentText : c.textSecondary}
        style={bold ? undefined : { textDecorationLine: 'underline' }}
      >
        {children}
      </Txt>
    </Pressable>
  );
}

/** A rule under a field that ticks itself off as it is met. */
export function Rule({ met, children }: { met: boolean; children: string }) {
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
