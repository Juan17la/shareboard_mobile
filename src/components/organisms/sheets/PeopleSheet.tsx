/**
 * "Connected": who is on the board, and — for the creator — one tap to grant or
 * revoke their editing.
 *
 * The pill on the right is the whole control. Tapping it moves the board to the
 * `selected` policy and puts that person on (or off) the list, which is the
 * design's shortcut for the common case: you do not want to open an access
 * panel and reason about policies, you want to let *this* person draw.
 */
import { Pressable, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { useBoardPermissions } from '@/features/board/use-permissions';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore, useColors } from '@/features/session/store';

import { Avatar } from '../../atoms/Avatar';
import { Sheet, SheetGroup, SheetRow } from '../../molecules/Sheet';
import { Txt } from '../../atoms/Text';

export function PeopleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const meta = useBoardStore((s) => s.meta);
  const participants = useBoardStore((s) => s.participants);
  const userId = useSessionStore((s) => s.userId);
  const { isCreator, busy, apply } = useBoardPermissions();

  const toggleEditor = (target: string, currentlyEditor: boolean) => {
    if (!meta || busy) return;
    const editors = currentlyEditor
      ? meta.editors.filter((id) => id !== target)
      : [...meta.editors, target];
    // Granting one person implies the `selected` policy — under `everyone` the
    // pill would be meaningless, and under `creator-only` it would do nothing.
    void apply({ editPolicy: 'selected', editors });
  };

  return (
    <Sheet open={open} title={t.sheetPeople} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 8 }}>
        {participants.length === 0 ? (
          <Txt size={13} leading={1.4} tone="secondary" style={{ textAlign: 'center', paddingVertical: 16 }}>
            {t.aloneHere}
          </Txt>
        ) : (
          <SheetGroup footer={isCreator ? t.peopleHint : t.ownerOnlyHint}>
            {participants.map((p) => {
              const isOwner = p.userId === meta?.creatorId;
              const isYou = p.userId === userId;
              const canEdit = p.role !== 'viewer';
              const listed = meta?.editors.includes(p.userId) ?? false;
              const pill = isOwner ? t.pillOwner : canEdit ? t.pillCan : t.pillCannot;

              return (
                <SheetRow
                  key={p.userId}
                  title={`${p.nickname}${isYou && !isOwner ? ` · ${t.roleYou}` : ''}`}
                  description={isOwner ? (isYou ? t.roleOwner : t.roleOwnerOther) : t.roleGuest}
                  left={<Avatar name={p.nickname} color={p.color} avatar={p.avatar} size={34} />}
                  right={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${p.nickname}: ${pill}`}
                      accessibilityState={{ selected: canEdit, disabled: isOwner || !isCreator }}
                      disabled={isOwner || !isCreator || busy}
                      onPress={() => toggleEditor(p.userId, listed)}
                      hitSlop={8}
                      style={{
                        minHeight: 30,
                        justifyContent: 'center',
                        paddingHorizontal: 12,
                        borderRadius: Radius.pill,
                        backgroundColor: canEdit ? c.accentSoft : c.fill,
                        opacity: isCreator || isOwner ? 1 : 0.7,
                      }}
                    >
                      <Txt weight="semibold" size={13} color={canEdit ? c.accentText : c.textSecondary}>
                        {pill}
                      </Txt>
                    </Pressable>
                  }
                />
              );
            })}
          </SheetGroup>
        )}
      </View>
    </Sheet>
  );
}
