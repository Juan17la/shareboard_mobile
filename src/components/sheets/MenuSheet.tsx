/**
 * "Menu": the way between whiteboards and the rest of what a board can do —
 * a new one, one of your old ones, one joined with a code, a file brought in —
 * then export, who may edit, who is here, the assistant.
 *
 * There is no home screen to go back to: the app opens on the last whiteboard,
 * and this is where the others are reached from. The settings are their own
 * button on the header.
 */
import { Pressable, View } from 'react-native';

import { useBoardStore } from '@/features/board/store';
import { useColors } from '@/features/session/store';
import { useT } from '@/features/i18n/store';

import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

export function MenuSheet({
  open,
  onClose,
  onNew,
  onOpenBoards,
  onOpenJoin,
  onOpenExport,
  onOpenImport,
  onOpenPrivacy,
  onOpenPeople,
  onOpenAi,
}: {
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onOpenBoards: () => void;
  onOpenJoin: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenPrivacy: () => void;
  onOpenPeople: () => void;
  onOpenAi: () => void;
}) {
  const c = useColors();
  const t = useT();
  const canEdit = useBoardStore((s) => s.canEditNow());

  type Row = { icon: IconName; label: string; onPress: () => void };
  const rows: Row[] = [
      { icon: 'plus', label: t.newWhiteboard, onPress: onNew },
      { icon: 'board', label: t.myWhiteboards, onPress: onOpenBoards },
      { icon: 'link', label: t.joinWhiteboard, onPress: onOpenJoin },
      { icon: 'download', label: t.importBoard, onPress: onOpenImport },
      { icon: 'image', label: t.exportImage, onPress: onOpenExport },
      { icon: 'lock', label: t.whoEdits, onPress: onOpenPrivacy },
      { icon: 'people', label: t.sheetPeople, onPress: onOpenPeople },
      ...(canEdit ? [{ icon: 'sparkle' as const, label: t.sheetAi, onPress: onOpenAi }] : []),
  ];

  return (
    <Sheet open={open} title={t.boardMenu} onClose={onClose} closeLabel={t.close}>
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
