/**
 * "Account": who is signed in and the way out — or, for a guest, the form to
 * sign in. Sharing opens it too, with `reason` saying why it is asking.
 */
import { View } from 'react-native';

import { Radius } from '@/constants/theme';
import { fill } from '@/features/i18n/strings';
import { useT } from '@/features/i18n/store';
import { useColors, useSessionStore } from '@/features/session/store';

import { AuthForm } from '../account/AuthForm';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { GlassPanel } from '../ui/Glass';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

export function AccountSheet({
  open,
  onClose,
  reason,
  onSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  /** Shown above the form: why an account is needed right now. */
  reason?: string;
  /** Called after signing in; closes the sheet by default. */
  onSignedIn?: () => void;
}) {
  const c = useColors();
  const t = useT();
  const account = useSessionStore((s) => s.account);
  const nickname = useSessionStore((s) => s.nickname);
  const nickColor = useSessionStore((s) => s.nickColor);
  const avatar = useSessionStore((s) => s.avatar);

  return (
    <Sheet
      open={open}
      title={account ? t.sheetAccount : reason ? t.signInToShare : t.signIn}
      onClose={onClose}
      closeLabel={t.close}
      tall={!account}
    >
      {account ? (
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <GlassPanel level="row" radius={Radius.lg} border={c.border}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <Avatar name={nickname} color={nickColor} avatar={avatar} size={44} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt weight="bold" size={15} leading={1.2} numberOfLines={1}>
                  {nickname}
                </Txt>
                <Txt size={12} tone="secondary" numberOfLines={1}>
                  {fill(t.signedInAs, { USER: account.username })}
                </Txt>
              </View>
            </View>
          </GlassPanel>
          <Button
            label={t.signOut}
            variant="secondary"
            fullWidth
            onPress={() => {
              useSessionStore.getState().signOut();
              toast(t.toastSignedOut);
              onClose();
            }}
          />
        </View>
      ) : (
        <View style={{ gap: 16, paddingBottom: 8 }}>
          <Txt size={13} leading={1.45} tone="secondary">
            {reason ?? t.accountSub}
          </Txt>
          <AuthForm initialMode="login" onDone={onSignedIn ?? onClose} />
        </View>
      )}
    </Sheet>
  );
}
