/**
 * "Board": the overflow menu behind the header's ⋯ button.
 *
 * Everything here is reachable some other way too — export from the share
 * sheet, access from the header chip — because the design puts the frequent
 * routes on the surface and keeps this as the complete list for anyone who did
 * not find them.
 */
import { Pressable, View } from 'react-native';

import { useColors } from '@/features/session/store';
import { useT } from '@/features/i18n/store';

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
  const c = useColors();
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
      <View>
        {rows.map((row, i) => (
          <Pressable
            key={row.label}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            onPress={row.onPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 13,
              paddingHorizontal: 8,
              // `text` + 16% alpha: a visible press tone in both themes.
              backgroundColor: pressed ? c.text + '29' : 'transparent',
              borderBottomWidth: i < rows.length - 1 ? 1 : 0,
              borderColor: c.borderStrong,
            })}
          >
            <Icon name={row.icon} size={19} color={c.text} />
            <Txt weight="semibold" size={14} leading={1.2} style={{ flex: 1 }}>
              {row.label}
            </Txt>
          </Pressable>
        ))}
        <View style={{ height: 8 }} />
      </View>
    </Sheet>
  );
}
