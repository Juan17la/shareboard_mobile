/**
 * "Share board": the three ways someone else gets in — scan it, read the code
 * out, or send the link.
 *
 * The QR is generated for real (`features/qr/encode.ts`) rather than being a
 * decorative block, because the whole point of the panel is a second device
 * pointing a camera at the first.
 */
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { mayShare, useColors, useSessionStore } from '@/features/session/store';
import { useT } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';
import { loadLocal, updateLocal } from '@/features/board/local';
import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from '@/features/board/model';
import { ApiError } from '@/services/api/client';
import { importSnapshot } from '@/services/api/boards';
import { formatShortCode } from '@/utils/short-code';

import { Button } from '../../atoms/Button';
import { GlassPanel } from '../../atoms/Glass';
import { Icon, type IconName } from '../../atoms/Icon';
import { QRCode } from '../../atoms/QRCode';
import { Sheet, SheetGroup, SheetRow } from '../../molecules/Sheet';
import { Txt } from '../../atoms/Text';
import { toast } from '../../molecules/Toast';

export function ShareSheet({
  open,
  onClose,
  link,
  onOpenExport,
  onOpenPrivacy,
  onNeedAccount,
  onCreateBlank,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  link: string;
  onOpenExport: () => void;
  onOpenPrivacy: () => void;
  /** Sharing the offline board needs an account; a guest is sent to sign in. */
  onNeedAccount: () => void;
  /** A new, blank live board instead of a copy of this one. */
  onCreateBlank: () => void;
  creating: boolean;
}) {
  const c = useColors();
  const t = useT();
  const meta = useBoardStore((s) => s.meta);
  const local = useBoardStore((s) => s.connection === 'local');
  const code = meta?.shortCode ?? '';

  const message = `${t.shareMessage} ${link}`;
  // No canOpenURL: it needs the app's scheme declared natively (a new build);
  // openURL rejects when nothing handles it, and the web link works everywhere.
  const sendWhatsApp = () =>
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() =>
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`),
    );
  // The system chooser: Telegram, Messenger, SMS, mail… without per-app code.
  const sendMore = () => Share.share({ message });

  const copy = async (value: string, message: string) => {
    await Clipboard.setStringAsync(value);
    toast(message);
  };

  if (local) {
    return (
      <LocalShare
        open={open}
        onClose={onClose}
        onOpenExport={onOpenExport}
        onNeedAccount={onNeedAccount}
        onCreateBlank={onCreateBlank}
        creating={creating}
      />
    );
  }

  return (
    <Sheet open={open} title={t.sheetShare} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <QRCode value={link} size={132} />
          <Txt size={12} leading={1.35} tone="secondary" style={{ textAlign: 'center' }}>
            {t.qrHint}
          </Txt>
        </View>

        {/* The code is what gets read out loud: big, mono, one tap to copy. */}
        <SheetGroup title={t.code}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.code} ${code}`}
            onPress={() => copy(code, t.toastCopied)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              minHeight: 52,
              paddingHorizontal: 12,
              backgroundColor: pressed ? c.fill : 'transparent',
            })}
          >
            <Txt mono weight="bold" size={22} tracking={2}>
              {formatShortCode(code)}
            </Txt>
            <Icon name="copy" size={18} color={c.accentText} />
          </Pressable>
        </SheetGroup>

        <SheetGroup>
          <SheetRow
            title={t.copyLink}
            description={
              <Txt size={12} mono tone="secondary" numberOfLines={1}>
                {link}
              </Txt>
            }
            left={<Icon name="link" size={20} color={c.accentText} />}
            onPress={() => copy(link, t.toastLink)}
          />
        </SheetGroup>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ShortcutTile icon="whatsapp" label={t.shareWhatsApp} onPress={sendWhatsApp} />
          <ShortcutTile icon="share" label={t.shareMore} onPress={sendMore} />
          <ShortcutTile icon="image" label={t.exportImage} onPress={onOpenExport} />
          <ShortcutTile icon="lock" label={t.permissions} onPress={onOpenPrivacy} />
        </View>
      </View>
    </Sheet>
  );
}

/**
 * The offline board has no code yet (plans/34): sharing makes a live copy of
 * it and opens that, where Share has its code and link. The offline board stays as it is — a private copy, never merged with the live one.
 */
function LocalShare({
  open,
  onClose,
  onOpenExport,
  onNeedAccount,
  onCreateBlank,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  onOpenExport: () => void;
  onNeedAccount: () => void;
  onCreateBlank: () => void;
  creating: boolean;
}) {
  const t = useT();
  const userId = useSessionStore((s) => s.userId);
  const signedIn = useSessionStore((s) => s.account !== null);
  const verified = useSessionStore((s) => mayShare(s.account));
  const [busy, setBusy] = useState(false);
  const [sharedAs, setSharedAs] = useState<string | undefined>();
  useEffect(() => {
    if (open) void loadLocal().then((board) => setSharedAs(board?.sharedAs));
  }, [open]);
  const go = (id: string) => router.setParams({ id });

  async function promote() {
    const { meta, visibleElements } = useBoardStore.getState();
    if (!meta) return;
    setBusy(true);
    try {
      const created = await importSnapshot(
        { format: SNAPSHOT_FORMAT, version: SNAPSHOT_VERSION, meta: { name: meta.name }, elements: visibleElements(), exportedAt: Date.now() },
        userId,
      );
      await updateLocal(meta.id, { sharedAs: created.id });
      go(created.id);
    } catch (error) {
      toast(error instanceof ApiError && error.code !== 'NETWORK' ? error.message : t.needOnline);
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} title={t.sheetShare} onClose={onClose} closeLabel={t.close}>
      {verified ? (
        <View style={{ gap: 12 }}>
          <Txt size={14} leading={1.4} tone="secondary">
            {t.shareLocalBody}
          </Txt>
          <ShareChoice
            label={t.shareThisBoard}
            description={t.shareThisBoardDesc}
            icon="share"
            loading={busy}
            disabled={creating}
            onPress={() => void promote()}
          />
          <ShareChoice
            label={t.shareBlank}
            description={t.shareBlankDesc}
            icon="plus"
            variant="secondary"
            loading={creating}
            disabled={busy}
            onPress={onCreateBlank}
          />
          {sharedAs ? (
            <Button label={t.openShared} icon="link" variant="secondary" fullWidth onPress={() => go(sharedAs)} />
          ) : null}
          <View style={{ flexDirection: 'row' }}>
            <ShortcutTile icon="image" label={t.exportImage} onPress={onOpenExport} />
          </View>
        </View>
      ) : (
        // Sharing needs an account with a verified email, so that is the one way forward and nothing else.
        <View style={{ gap: 12 }}>
          <Txt size={14} leading={1.4} tone="secondary">
            {signedIn ? t.addEmailBody : t.signInToShareBody}
          </Txt>
          <Button label={signedIn ? t.verifyTitle : t.signInToShare} icon="user" fullWidth onPress={onNeedAccount} />
        </View>
      )}
    </Sheet>
  );
}

/** One way to share: the button, and what it does under it. */
function ShareChoice({
  label,
  description,
  icon,
  variant,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  description: string;
  icon: IconName;
  variant?: 'secondary';
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Button label={label} icon={icon} variant={variant} loading={loading} disabled={disabled} fullWidth onPress={onPress} />
      <Txt size={12} leading={1.4} tone="secondary" style={{ textAlign: 'center' }}>
        {description}
      </Txt>
    </View>
  );
}

function ShortcutTile({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <GlassPanel level="row" radius={Radius.lg} border={null}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => ({
            alignItems: 'center',
            gap: 5,
            minHeight: 56,
            justifyContent: 'center',
            paddingHorizontal: 3,
            backgroundColor: pressed ? c.fill : 'transparent',
          })}
        >
          <Icon name={icon} size={20} color={c.accentText} />
          <Txt weight="medium" size={11} numberOfLines={1}>
            {label}
          </Txt>
        </Pressable>
      </GlassPanel>
    </View>
  );
}
