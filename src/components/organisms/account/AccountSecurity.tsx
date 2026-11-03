/**
 * The signed-in half of the account sheet: the account's email (add one,
 * enter its code, change it) and changing the password. Twin of web's
 * `components/account/AccountSecurity.tsx`.
 *
 * An email is what sharing needs (the server refuses an unverified account
 * with EMAIL_UNVERIFIED), and what a forgotten password is recovered through.
 * Accounts from before emails have none, so they are asked for one here.
 * Adding or changing it asks for the password: a borrowed, unlocked phone must
 * not be enough to point the account's resets at someone else's inbox.
 */
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { LIMITS } from '@/features/board/model';
import { fill } from '@/features/i18n/strings';
import { useT } from '@/features/i18n/store';
import { useColors, useSessionStore } from '@/features/session/store';
import { changePassword, resendEmailCode, setEmail, verifyEmail } from '@/services/api/boards';
import type { AccountProfile } from '@/services/api/types';

import { Button } from '../../atoms/Button';
import { GlassPanel } from '../../atoms/Glass';
import { Icon } from '../../atoms/Icon';
import { Txt } from '../../atoms/Text';
import { toast } from '../../molecules/Toast';
import { applySignedIn, authMessage, EMAIL, passwordError } from './auth';
import { CodeField, EmailField, FormError, PasswordField, Rule, TextLink } from './AuthForm';

const keep = (a: AccountProfile) =>
  useSessionStore
    .getState()
    .updateAccount({ email: a.email, emailVerified: a.emailVerified, verificationRequired: a.verificationRequired });

/** Add, verify or change the account's email. `onVerified` runs once it is verified here. */
export function EmailSection({ onVerified }: { onVerified?: () => void }) {
  const c = useColors();
  const t = useT();
  const account = useSessionStore((s) => s.account);
  const [editing, setEditing] = useState(false);
  if (!account) return null;
  const email = account.email ?? null;

  const required = account.verificationRequired === true;
  if (!email || editing) {
    return <EmailForm current={email} required={required} onDone={() => setEditing(false)} onCancel={email ? () => setEditing(false) : undefined} />;
  }
  if (!account.emailVerified && required) return <VerifyForm email={email} onChange={() => setEditing(true)} onVerified={onVerified} />;

  return (
    <GlassPanel level="row" radius={Radius.lg}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        {account.emailVerified ? <Icon name="check" size={18} color={c.go} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="bold" size={14} numberOfLines={1}>
            {email}
          </Txt>
          {account.emailVerified ? (
            <Txt size={12} weight="semibold" color={c.go}>
              {t.emailVerified}
            </Txt>
          ) : null}
        </View>
        <Button label={t.changeEmail} variant="secondary" compact onPress={() => setEditing(true)} />
      </View>
    </GlassPanel>
  );
}

function EmailForm({
  current,
  required,
  onDone,
  onCancel,
}: {
  current: string | null;
  /** Sharing waits for the email: say so. Otherwise it is only for password resets. */
  required: boolean;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const [email, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const mail = email.trim();
  const emailErr = !mail ? t.errEmailRequired : !EMAIL.test(mail) ? t.errEmailInvalid : null;
  const passErr = password ? null : t.errPassRequired;

  async function submit() {
    if (busy) return;
    if (emailErr || passErr) {
      setShown(true);
      (emailErr ? emailRef : passRef).current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      keep(await setEmail(mail, password));
      toast(required ? t.toastCodeSent : t.toastEmailSaved);
      onDone();
    } catch (err) {
      setError(authMessage(err, t));
    }
    setBusy(false);
  }

  return (
    <View style={{ gap: 12 }}>
      {current ? null : (
        <View style={{ gap: 4 }}>
          <Txt weight="bold" size={15}>
            {t.addEmailTitle}
          </Txt>
          <Txt size={13} leading={1.4} tone="secondary">
            {required ? t.addEmailBody : t.addEmailBodyReset}
          </Txt>
        </View>
      )}
      <EmailField ref={emailRef} value={email} onChange={setValue} onSubmitEditing={() => passRef.current?.focus()} error={shown ? emailErr : null} />
      <PasswordField
        ref={passRef}
        label={t.confirmWithPassword}
        value={password}
        onChange={setPassword}
        isNew={false}
        onSubmitEditing={() => void submit()}
        error={shown ? passErr : null}
      />
      <FormError error={error} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {onCancel ? (
          <View style={{ flex: 1 }}>
            <Button label={t.cancel} variant="secondary" fullWidth onPress={onCancel} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button label={t.sendCode} loading={busy} fullWidth onPress={() => void submit()} />
        </View>
      </View>
    </View>
  );
}

function VerifyForm({ email, onChange, onVerified }: { email: string; onChange: () => void; onVerified?: () => void }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(authMessage(err, t));
    }
    setBusy(false);
  }

  const verify = () => {
    if (code.length !== 6) return setError(t.errCodeFormat);
    void run(async () => {
      keep(await verifyEmail(code));
      toast(t.toastEmailVerified);
      onVerified?.();
    });
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Txt weight="bold" size={15}>
          {t.verifyTitle}
        </Txt>
        <Txt size={13} leading={1.4} tone="secondary">
          {fill(t.verifyBody, { EMAIL: email })}
        </Txt>
      </View>
      <CodeField value={code} onChange={setCode} onSubmitEditing={verify} error={null} />
      <FormError error={error} />
      <Button variant="go" label={t.verifyCta} loading={busy} fullWidth onPress={verify} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
        <TextLink
          bold
          onPress={() =>
            void run(async () => {
              await resendEmailCode();
              toast(t.toastCodeSent);
            })
          }
        >
          {t.resendCode}
        </TextLink>
        <TextLink onPress={onChange}>{t.changeEmail}</TextLink>
      </View>
    </View>
  );
}

/** Current password, new password. This install stays signed in with a new token; every other session ends. */
export function PasswordSection() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const currentRef = useRef<TextInput>(null);
  const nextRef = useRef<TextInput>(null);

  if (!open) return <Button label={t.changePassword} variant="secondary" fullWidth onPress={() => setOpen(true)} />;

  const currentErr = current ? null : t.errPassRequired;
  const nextErr = passwordError(next, t);

  async function submit() {
    if (busy) return;
    if (currentErr || nextErr) {
      setShown(true);
      (currentErr ? currentRef : nextRef).current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      applySignedIn(await changePassword(current, next));
      toast(t.toastPasswordChanged);
      setOpen(false);
      setCurrent('');
      setNext('');
    } catch (err) {
      setError(authMessage(err, t));
    }
    setBusy(false);
  }

  return (
    <View style={{ gap: 12 }}>
      <Txt weight="bold" size={15}>
        {t.changePassword}
      </Txt>
      <PasswordField
        ref={currentRef}
        label={t.currentPassword}
        value={current}
        onChange={setCurrent}
        isNew={false}
        onSubmitEditing={() => nextRef.current?.focus()}
        error={shown ? currentErr : null}
      />
      <PasswordField
        ref={nextRef}
        label={t.newPassword}
        value={next}
        onChange={setNext}
        isNew
        onSubmitEditing={() => void submit()}
        error={shown ? nextErr : null}
        hint={<Rule met={next.length >= LIMITS.minPasswordLength}>{t.passwordHint}</Rule>}
      />
      <FormError error={error} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label={t.cancel} variant="secondary" fullWidth onPress={() => setOpen(false)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t.changePassword} loading={busy} fullWidth onPress={() => void submit()} />
        </View>
      </View>
    </View>
  );
}
