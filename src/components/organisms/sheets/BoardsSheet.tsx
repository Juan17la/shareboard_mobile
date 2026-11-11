/**
 * "My whiteboards": the offline board first, then the live boards — for an
 * account, every board it made or has got into, from the server, on any
 * device; for a guest, the ones this device has opened. Newest first. Tap one
 * to go there (a private one the account got into opens without its PIN); the
 * cross takes it off the list (it does not delete it).
 *
 * The live ones are only offered while they can be reached (plans/34): hidden
 * once the server has not been heard from in five hours, back as soon as it
 * answers again.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { relativeTime, useT } from '@/features/i18n/store';
import { useColors, useSessionStore } from '@/features/session/store';
import { formatShortCode } from '@/utils/short-code';
import { checkOnline, isLocalId, recentlyOnline } from '@/features/board/local';
import { forgetMyBoard, getMyBoards } from '@/services/api/boards';
import type { MyBoard } from '@/services/api/types';

import { Avatar } from '../../atoms/Avatar';
import { Icon } from '../../atoms/Icon';
import { Sheet, SheetGroup } from '../../molecules/Sheet';
import { Txt } from '../../atoms/Text';
import { toast } from '../../molecules/Toast';

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
  const signedIn = useSessionStore((s) => s.account !== null);
  const [live, setLive] = useState(recentlyOnline);
  // The account's boards, fetched each time the sheet opens; null until they arrive.
  const [mine, setMine] = useState<MyBoard[] | null>(null);
  const [mineFailed, setMineFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    void checkOnline().then((ok) => setLive(ok || recentlyOnline()));
    if (!signedIn) return;
    let cancelled = false;
    getMyBoards().then(
      (boards) => {
        if (cancelled) return;
        setMine(boards);
        setMineFailed(false);
      },
      () => {
        if (!cancelled) setMineFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, signedIn]);

  const rows = signedIn
    ? (mine ?? []).map((b) => ({ ...b, at: b.updatedAt, yours: b.role === 'creator' }))
    : recent.map((b) => ({ ...b, at: b.lastOpenedAt, yours: true, hasPin: false }));
  const forget = (id: string) => {
    forgetBoard(id);
    toast(t.forget);
    if (!signedIn) return;
    setMine((list) => list?.filter((b) => b.id !== id) ?? null);
    forgetMyBoard(id).catch((error: Error) => toast(error.message));
  };
  const onLocal = isLocalId(currentId);

  return (
    <Sheet open={open} title={t.myWhiteboards} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <SheetGroup>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.localBoardName}
            accessibilityState={{ selected: onLocal }}
            onPress={() => {
              onClose();
              if (!onLocal) router.replace('/');
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: pressed ? c.fill : 'transparent' })}
          >
            <View
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fill }}
            >
              <Icon name="pencil" size={17} color={c.text} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt size={16} leading={1.25} numberOfLines={1}>
                {t.localBoardName}
              </Txt>
              <Txt size={12} tone="secondary" numberOfLines={1}>
                {t.localRow}
              </Txt>
            </View>
            {onLocal ? <Icon name="check" size={18} color={c.accentText} /> : null}
          </Pressable>
        </SheetGroup>
        {!live || (signedIn && mineFailed && mine === null) ? (
          <Txt size={13} leading={1.4} tone="secondary" style={{ textAlign: 'center', paddingVertical: 24 }}>
            {t.liveHidden}
          </Txt>
        ) : signedIn && mine === null ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={c.accent} accessibilityLabel={t.loading} />
          </View>
        ) : rows.length === 0 ? (
          <Txt
            size={13}
            leading={1.4}
            tone="secondary"
            style={{ textAlign: 'center', paddingVertical: 24 }}
          >
            {signedIn ? t.myBoardsEmpty : t.noRecent}
          </Txt>
        ) : (
          <SheetGroup>
          {rows.map((board) => {
            const here = board.id === currentId;
            return (
                <View key={board.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${board.name}, ${board.shortCode}`}
                    accessibilityState={{ selected: here }}
                    onPress={() => {
                      onClose();
                      if (!here) router.setParams({ id: board.id });
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      minWidth: 0,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 52,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      backgroundColor: pressed ? c.fill : 'transparent',
                    })}
                  >
                    <Avatar name={board.name} color={nickColor} size={34} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Txt size={16} leading={1.25} numberOfLines={1}>
                        {board.name}
                      </Txt>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {board.hasPin ? (
                          <View accessible accessibilityLabel={t.privateBoard}>
                            <Icon name="lock" size={11} color={c.textSecondary} />
                          </View>
                        ) : null}
                        <Txt size={12} tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                          <Txt size={12} mono tone="secondary">
                            {formatShortCode(board.shortCode)}
                          </Txt>
                          {` · ${relativeTime(t, board.at)}`}
                          {signedIn && board.yours ? ` · ${t.boardYours}` : ''}
                        </Txt>
                      </View>
                    </View>
                    {here ? <Icon name="check" size={18} color={c.accentText} /> : null}
                  </Pressable>
                  {/* The account's own boards are deleted from their settings, not forgotten. */}
                  {here || (signedIn && board.yours) ? null : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.forget}
                      hitSlop={6}
                      onPress={() => forget(board.id)}
                      style={{ padding: 12 }}
                    >
                      <Icon name="close" size={14} color={c.textTertiary} />
                    </Pressable>
                  )}
                </View>
            );
          })}
          </SheetGroup>
        )}
      </View>
    </Sheet>
  );
}
