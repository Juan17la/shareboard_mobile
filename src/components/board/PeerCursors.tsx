/**
 * Other people's cursors, floating over the board with their names attached.
 *
 * These sit in a React Native layer above the Skia canvas rather than being
 * painted into it. A cursor is a pointer plus a name label, and text on the
 * canvas would have to be laid out by hand at every zoom level; a view gets the
 * app's own typography for free and, because the labels must stay a constant
 * size however far the board is zoomed out, they were never going to live in
 * board space anyway.
 */
import { View } from 'react-native';

import type { Camera } from '@/features/board/store';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';

import { Txt } from '../ui/Text';

export function PeerCursors({ camera }: { camera: Camera }) {
  const participants = useBoardStore((s) => s.participants);
  const you = useBoardStore((s) => s.you);
  const show = useSessionStore((s) => s.settings.peers);

  if (!show) return null;

  const peers = participants.filter((p) => p.userId !== you?.userId && p.cursor);
  if (peers.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {peers.map((p) => (
        <View
          key={p.userId}
          style={{
            position: 'absolute',
            left: p.cursor!.x * camera.scale + camera.x,
            top: p.cursor!.y * camera.scale + camera.y,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 2,
          }}
        >
          {/* A teardrop: three round corners and one sharp one, tipped slightly
              so it reads as a pointer rather than as a dot. */}
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              borderBottomLeftRadius: 2,
              transform: [{ rotate: '-8deg' }],
              backgroundColor: p.color,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 3,
            }}
          />
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: p.color,
            }}
          >
            <Txt weight="bold" size={10} leading={1.3} tone="inverse" numberOfLines={1}>
              {p.nickname}
            </Txt>
          </View>
        </View>
      ))}
    </View>
  );
}
