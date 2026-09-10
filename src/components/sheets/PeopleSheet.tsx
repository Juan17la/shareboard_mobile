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

import { Colors, Radius } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { useBoardPermissions } from '@/features/board/use-permissions';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';

import { Avatar } from '../ui/Avatar';
import { GlassPanel } from '../ui/Glass';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

export function PeopleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <Txt size={12.5} leading={1.4} tone="secondary">
            {t.aloneHere}
          </Txt>
        ) : null}

        {participants.map((p) => {
          const isOwner = p.userId === meta?.creatorId;
          const isYou = p.userId === userId;
          const canEdit = p.role !== 'viewer';
          const listed = meta?.editors.includes(p.userId) ?? false;

          return (
            <GlassPanel key={p.userId} level="row" radius={Radius.lg} border={Colors.border}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 11 }}>
                <Avatar name={p.nickname} color={p.color} size={36} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Txt weight="bold" size={13.5} leading={1.2} numberOfLines={1}>
                    {p.nickname}
                    {isYou && !isOwner ? ` · ${t.roleYou}` : ''}
                  </Txt>
                  <Txt weight="semibold" size={11} tone="secondary">
                    {isOwner ? (isYou ? t.roleOwner : t.roleOwnerOther) : t.roleGuest}
                  </Txt>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${p.nickname}: ${isOwner ? t.pillOwner : canEdit ? t.pillCan : t.pillCannot}`}
                  accessibilityState={{ selected: canEdit, disabled: isOwner || !isCreator }}
                  disabled={isOwner || !isCreator || busy}
                  onPress={() => toggleEditor(p.userId, listed)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: Radius.pill,
                    borderWidth: 1,
                    borderColor: canEdit ? 'transparent' : Colors.borderStrong,
                    backgroundColor: canEdit ? Colors.accentSoft : '#FFFFFF',
                    opacity: isCreator || isOwner ? 1 : 0.7,
                  }}
                >
                  <Txt
                    weight="extrabold"
                    size={10.5}
                    color={canEdit ? Colors.accent : Colors.textSecondary}
                  >
                    {isOwner ? t.pillOwner : canEdit ? t.pillCan : t.pillCannot}
                  </Txt>
                </Pressable>
              </View>
            </GlassPanel>
          );
        })}

        <Txt size={11.5} leading={1.4} tone="secondary" style={{ paddingHorizontal: 2, paddingVertical: 4 }}>
          {isCreator ? t.peopleHint : t.ownerOnlyHint}
        </Txt>
      </View>
    </Sheet>
  );
}
