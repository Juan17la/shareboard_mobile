/**
 * "Board": the overflow menu behind the header's ⋯ button.
 *
 * Everything here is reachable some other way too — export from the share
 * sheet, access from the header chip — because the design puts the frequent
 * routes on the surface and keeps this as the complete list for anyone who did
 * not find them.
 */
import { Pressable, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useT } from '@/features/i18n/store';

import { GlassPanel } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

export function MenuSheet({
  open,
  onClose,
  onOpenExport,
  onOpenImport,
  onOpenPrivacy,
  onOpenPeople,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenPrivacy: () => void;
  onOpenPeople: () => void;
  onOpenSettings: () => void;
}) {
  const t = useT();

  const rows: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'image', label: t.exportImage, onPress: onOpenExport },
    { icon: 'download', label: t.importBoard, onPress: onOpenImport },
    { icon: 'lock', label: t.whoEdits, onPress: onOpenPrivacy },
    { icon: 'people', label: t.sheetPeople, onPress: onOpenPeople },
    { icon: 'settings', label: t.sheetSettings, onPress: onOpenSettings },
  ];

  return (
    <Sheet open={open} title={t.sheetMenu} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 8 }}>
        {rows.map((row) => (
          <GlassPanel key={row.label} level="row" radius={15} border={Colors.border}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={row.label}
              onPress={row.onPress}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: Colors.accentSoft,
                }}
              >
                <Icon name={row.icon} size={19} color={Colors.accent} />
              </View>
              <Txt weight="bold" size={13.5} leading={1.2} style={{ flex: 1 }}>
                {row.label}
              </Txt>
              <Icon name="chevron" size={15} color={Colors.textTertiary} />
            </Pressable>
          </GlassPanel>
        ))}
        <View style={{ height: 8 }} />
      </View>
    </Sheet>
  );
}
