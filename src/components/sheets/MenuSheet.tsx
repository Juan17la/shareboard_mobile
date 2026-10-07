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
import { useColors, useSessionStore } from '@/features/session/store';
import { useT } from '@/features/i18n/store';

import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

export function MenuSheet({
  open,
  onClose,
  onOpenBoards,
  onOpenSettings,
  onOpenImport,
  onOpenPrivacy,
  onOpenPeople,
  onOpenAi,
}: {
  open: boolean;
  onClose: () => void;
  onOpenBoards: () => void;
  onOpenSettings: () => void;
  onOpenImport: () => void;
  onOpenPrivacy: () => void;
  onOpenPeople: () => void;
  onOpenAi: () => void;
}) {
  const c = useColors();
  const t = useT();
  const canEdit = useBoardStore((s) => s.canEditNow());
  const local = useBoardStore((s) => s.connection === 'local');

  type Row = { icon: IconName; label: string; onPress: () => void };
  const rows: Row[] = [
      { icon: 'settings', label: t.sheetSettings, onPress: onOpenSettings },
      { icon: 'board', label: t.myWhiteboards, onPress: onOpenBoards },
      { icon: 'download', label: t.importBoard, onPress: onOpenImport },
      // The offline board has nobody else on it and no access to set.
      ...(local
        ? []
        : [
            { icon: 'lock' as const, label: t.whoEdits, onPress: onOpenPrivacy },
            { icon: 'people' as const, label: t.sheetPeople, onPress: onOpenPeople },
          ]),
      ...(canEdit ? [{ icon: 'sparkle' as const, label: t.sheetAi, onPress: onOpenAi }] : []),
      // The tutorial only runs for editors, so a viewer has nothing to replay.
      ...(canEdit
        ? [
            {
              icon: 'cursor' as const,
              label: t.tourReplay,
              onPress: () => {
                useSessionStore.getState().setTutorialDone(false);
                onClose();
              },
            },
          ]
        : []),
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
