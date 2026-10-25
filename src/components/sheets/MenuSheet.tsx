/**
 * "Menu": everything a board offers that is not on the board itself, in three
 * labelled groups — the whiteboards (this one's siblings, a new one, a file
 * brought in), what can be done with this board (export, who may edit, who is
 * here, the assistant), and the app (settings, the tutorial).
 *
 * There is no home screen to go back to: the app opens on the last whiteboard,
 * and this is where the others are reached from. Each thing has exactly one
 * entry here; the header carries only Share.
 */
import { Pressable, View } from 'react-native';

import { useBoardStore } from '@/features/board/store';
import { useColors, useSessionStore } from '@/features/session/store';
import { useT } from '@/features/i18n/store';

import { Icon, type IconName } from '../ui/Icon';
import { SectionLabel, Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

type Row = { icon: IconName; label: string; onPress: () => void };

export function MenuSheet({
  open,
  onClose,
  onOpenBoards,
  onOpenNew,
  onOpenSettings,
  onOpenImport,
  onOpenExport,
  onOpenPrivacy,
  onOpenPeople,
  onOpenAi,
  onOpenTemplates,
}: {
  open: boolean;
  onClose: () => void;
  onOpenBoards: () => void;
  onOpenNew: () => void;
  onOpenSettings: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenPrivacy: () => void;
  onOpenPeople: () => void;
  onOpenAi: () => void;
  onOpenTemplates: () => void;
}) {
  const c = useColors();
  const t = useT();
  const canEdit = useBoardStore((s) => s.canEditNow());
  const local = useBoardStore((s) => s.connection === 'local');

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: t.menuBoards,
      rows: [
        { icon: 'board', label: t.myWhiteboards, onPress: onOpenBoards },
        { icon: 'plus', label: t.createOrJoin, onPress: onOpenNew },
        { icon: 'download', label: t.importBoard, onPress: onOpenImport },
      ],
    },
    {
      title: t.menuThisBoard,
      rows: [
        { icon: 'image', label: t.exportImage, onPress: onOpenExport },
        // The offline board has nobody else on it and no access to set.
        ...(local
          ? []
          : [
              { icon: 'lock' as const, label: t.whoEdits, onPress: onOpenPrivacy },
              { icon: 'people' as const, label: t.sheetPeople, onPress: onOpenPeople },
            ]),
        ...(canEdit
          ? [
              { icon: 'template' as const, label: t.templates, onPress: onOpenTemplates },
              { icon: 'sparkle' as const, label: t.sheetAi, onPress: onOpenAi },
            ]
          : []),
      ],
    },
    {
      title: t.menuApp,
      rows: [
        { icon: 'settings', label: t.sheetSettings, onPress: onOpenSettings },
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
      ],
    },
  ];

  return (
    <Sheet open={open} title={t.boardMenu} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        {groups.map((group) => (
          <View key={group.title} accessibilityRole="menu" accessibilityLabel={group.title}>
            <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
              <SectionLabel>{group.title}</SectionLabel>
            </View>
            {group.rows.map((row, i) => (
              <Pressable
                key={row.label}
                accessibilityRole="button"
                accessibilityLabel={row.label}
                onPress={row.onPress}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 48,
                  paddingHorizontal: 8,
                  // `text` + 16% alpha: a visible press tone in both themes.
                  backgroundColor: pressed ? c.text + '29' : 'transparent',
                  borderBottomWidth: i < group.rows.length - 1 ? 1 : 0,
                  borderColor: c.borderStrong,
                })}
              >
                <Icon name={row.icon} size={19} color={c.text} />
                <Txt weight="semibold" size={14} leading={1.2} style={{ flex: 1 }}>
                  {row.label}
                </Txt>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </Sheet>
  );
}
