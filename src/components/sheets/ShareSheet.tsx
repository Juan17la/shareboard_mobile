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
import { useColors, useSessionStore } from '@/features/session/store';
import { useT } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';
import { loadLocal, updateLocal } from '@/features/board/local';
import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from '@/features/board/model';
import { ApiError } from '@/services/api/client';
import { importSnapshot } from '@/services/api/boards';
import { formatShortCode } from '@/utils/short-code';

import { Button } from '../ui/Button';
import { GlassPanel } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { QRCode } from '../ui/QRCode';
import { SectionLabel, Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

export function ShareSheet({
  open,
  onClose,
  link,
  onOpenExport,
  onOpenPrivacy,
}: {
  open: boolean;
  onClose: () => void;
  link: string;
  onOpenExport: () => void;
  onOpenPrivacy: () => void;
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

  if (local) return <LocalShare open={open} onClose={onClose} onOpenExport={onOpenExport} />;

  return (
    <Sheet open={open} title={t.sheetShare} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 13 }}>
        <GlassPanel level="row" radius={18} border={c.border}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 15 }}>
            <QRCode value={link} size={96} />
            <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
              <SectionLabel>{t.code}</SectionLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.code} ${code}`}
                onPress={() => copy(code, t.toastCopied)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: 7,
                  paddingHorizontal: 11,
                  paddingVertical: 9,
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: c.borderStrong,
                  backgroundColor: c.surface,
                }}
              >
                <Txt weight="extrabold" size={17} tracking={1.6}>
                  {formatShortCode(code)}
                </Txt>
                <Icon name="copy" size={15} color={c.text} />
              </Pressable>
              <Txt size={11} leading={1.35} tone="secondary">
                {t.qrHint}
              </Txt>
            </View>
          </View>
        </GlassPanel>

        <GlassPanel level="row" radius={Radius.lg} border={c.border}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.copyLink}
            onPress={() => copy(link, t.toastLink)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
          >
            <Icon name="link" size={18} color={c.text} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt weight="bold" size={13.5} leading={1.2}>
                {t.copyLink}
              </Txt>
              <Txt size={11} mono tone="secondary" numberOfLines={1}>
                {link}
              </Txt>
            </View>
          </Pressable>
        </GlassPanel>

        <View style={{ flexDirection: 'row', gap: 9 }}>
          <ShortcutTile icon="whatsapp" label={t.shareWhatsApp} onPress={sendWhatsApp} />
          <ShortcutTile icon="share" label={t.shareMore} onPress={sendMore} />
        </View>

        <View style={{ flexDirection: 'row', gap: 9 }}>
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
function LocalShare({ open, onClose, onOpenExport }: { open: boolean; onClose: () => void; onOpenExport: () => void }) {
  const t = useT();
  const userId = useSessionStore((s) => s.userId);
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
      <View style={{ gap: 12 }}>
        <Txt size={13} leading={1.45} tone="secondary">
          {t.shareLocalBody}
        </Txt>
        <Button label={t.shareLocalCta} icon="share" loading={busy} fullWidth onPress={() => void promote()} />
        {sharedAs ? (
          <Button label={t.openShared} icon="link" variant="secondary" fullWidth onPress={() => go(sharedAs)} />
        ) : null}
        <View style={{ flexDirection: 'row' }}>
          <ShortcutTile icon="image" label={t.exportImage} onPress={onOpenExport} />
        </View>
      </View>
    </Sheet>
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
      <GlassPanel level="row" radius={Radius.lg} border={c.border}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={{ alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 8 }}
        >
          <Icon name={icon} size={20} color={c.text} />
          <Txt weight="bold" size={11.5}>
            {label}
          </Txt>
        </Pressable>
      </GlassPanel>
    </View>
  );
}
