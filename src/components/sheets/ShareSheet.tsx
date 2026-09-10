/**
 * "Share board": the three ways someone else gets in — scan it, read the code
 * out, or send the link.
 *
 * The QR is generated for real (`features/qr/encode.ts`) rather than being a
 * decorative block, because the whole point of the panel is a second device
 * pointing a camera at the first.
 */
import * as Clipboard from 'expo-clipboard';
import { Pressable, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';

import { GlassPanel } from '../ui/Glass';
import { Icon } from '../ui/Icon';
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
  const t = useT();
  const meta = useBoardStore((s) => s.meta);
  const code = meta?.shortCode ?? '';

  const copy = async (value: string, message: string) => {
    await Clipboard.setStringAsync(value);
    toast(message);
  };

  return (
    <Sheet open={open} title={t.sheetShare} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 13 }}>
        <GlassPanel level="row" radius={18} border={Colors.border}>
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
                  borderColor: Colors.borderStrong,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Txt weight="bold" size={16} mono tracking={1.4}>
                  {code}
                </Txt>
                <Icon name="copy" size={15} color={Colors.text} />
              </Pressable>
              <Txt size={11} leading={1.35} tone="secondary">
                {t.qrHint}
              </Txt>
            </View>
          </View>
        </GlassPanel>

        <GlassPanel level="row" radius={Radius.lg} border={Colors.border}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.copyLink}
            onPress={() => copy(link, t.toastLink)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
          >
            <Icon name="link" size={18} color={Colors.text} />
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
          <ShortcutTile icon="image" label={t.exportImage} onPress={onOpenExport} />
          <ShortcutTile icon="lock" label={t.permissions} onPress={onOpenPrivacy} />
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
  icon: 'image' | 'lock';
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <GlassPanel level="row" radius={Radius.lg} border={Colors.border}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={{ alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 8 }}
        >
          <Icon name={icon} size={20} color={Colors.text} />
          <Txt weight="bold" size={11.5}>
            {label}
          </Txt>
        </Pressable>
      </GlassPanel>
    </View>
  );
}
