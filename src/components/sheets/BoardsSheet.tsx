/**
 * "My whiteboards": the boards this device has opened, newest first. Tap one to
 * go there; the cross takes it off the list (it does not delete it).
 */
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { relativeTime, useT } from '@/features/i18n/store';
import { useColors, useSessionStore } from '@/features/session/store';
import { formatShortCode } from '@/utils/short-code';

import { Avatar } from '../ui/Avatar';
import { GlassPanel } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

export function BoardsSheet({
  open,
  onClose,
  currentId,
}: {
  open: boolean;
  onClose: () => void;
  /** The board on screen: marked, and not offered as somewhere to go. */
  currentId: string;
}) {
  const c = useColors();
  const t = useT();
  const recent = useSessionStore((s) => s.recent);
  const nickColor = useSessionStore((s) => s.nickColor);
  const forgetBoard = useSessionStore((s) => s.forgetBoard);

  return (
    <Sheet open={open} title={t.myWhiteboards} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 8, paddingBottom: 8 }}>
        {recent.length === 0 ? (
          <Txt
            size={12.5}
            leading={1.4}
            tone="secondary"
            style={{ textAlign: 'center', paddingVertical: 24 }}
          >
            {t.noRecent}
          </Txt>
        ) : (
          recent.map((board) => {
            const here = board.id === currentId;
            return (
              <GlassPanel key={board.id} level="row" radius={Radius.lg} border={c.border}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${board.name}, ${board.shortCode}`}
                    accessibilityState={{ selected: here }}
                    onPress={() => {
                      onClose();
                      if (!here) router.replace({ pathname: '/board/[id]', params: { id: board.id } });
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      paddingHorizontal: 13,
                      paddingVertical: 12,
                    }}
                  >
                    <Avatar name={board.name} color={nickColor} size={38} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Txt weight="bold" size={13.5} leading={1.2} numberOfLines={1}>
                        {board.name}
                      </Txt>
                      <Txt size={11} mono tone="secondary" numberOfLines={1}>
                        {formatShortCode(board.shortCode)} · {relativeTime(t, board.lastOpenedAt)}
                      </Txt>
                    </View>
                    {here ? <Icon name="check" size={16} color={c.accent} /> : null}
                  </Pressable>
                  {here ? null : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.forget}
                      hitSlop={6}
                      onPress={() => {
                        forgetBoard(board.id);
                        toast(t.forget);
                      }}
                      style={{ padding: 12 }}
                    >
                      <Icon name="close" size={14} color={c.textTertiary} />
                    </Pressable>
                  )}
                </View>
              </GlassPanel>
            );
          })
        )}
      </View>
    </Sheet>
  );
}
