/**
 * Other people's cursors, floating over the board with their names attached.
 *
 * These sit in a React Native layer above the Skia canvas rather than being
 * painted into it. A cursor is a pointer plus a name label, and text on the
 * canvas would have to be laid out by hand at every zoom level; a view gets the
 * app's own typography for free and, because the labels must stay a constant
 * size however far the board is zoomed out, they were never going to live in
 * board space anyway.
 *
 * They follow the camera's shared value on the UI thread, so neither the canvas
 * nor React renders to move them.
 */
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { elementBounds } from '@/features/board/geometry';
import type { BoardElement, Participant, Point } from '@/features/board/model';
import { useBoardStore, type Camera } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';

import { Txt } from '../ui/Text';

/** Puts a view at a board point (plus a screen-px offset), following the camera on the UI thread. */
function useAtBoardPoint(camera: SharedValue<Camera>, at: Point, dx = 0, dy = 0) {
  return useAnimatedStyle(() => {
    const { x, y, scale } = camera.get();
    return { transform: [{ translateX: at.x * scale + x + dx }, { translateY: at.y * scale + y + dy }] };
  });
}

const PLACED = { position: 'absolute', left: 0, top: 0 } as const;

export function PeerCursors({ camera }: { camera: SharedValue<Camera> }) {
  const participants = useBoardStore((s) => s.participants);
  const cursors = useBoardStore((s) => s.cursors);
  const you = useBoardStore((s) => s.you);
  const show = useSessionStore((s) => s.settings.peers);

  if (!show) return null;

  const peers = participants.filter((p) => p.userId !== you?.userId && cursors[p.userId]);
  if (peers.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {peers.map((p) => (
        <PeerCursor key={p.userId} who={p} at={cursors[p.userId]} camera={camera} />
      ))}
    </View>
  );
}

function PeerCursor({
  who,
  at,
  camera,
}: {
  who: Participant;
  at: Point;
  camera: SharedValue<Camera>;
}) {
  const follow = useAtBoardPoint(camera, at);
  return (
    <Animated.View
      style={[PLACED, { flexDirection: 'row', alignItems: 'flex-start', gap: 2 }, follow]}
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
          backgroundColor: who.color,
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
          backgroundColor: who.color,
        }}
      >
        <Txt weight="bold" size={10} leading={1.3} tone="inverse" numberOfLines={1}>
          {who.nickname}
        </Txt>
      </View>
    </Animated.View>
  );
}

/**
 * Who holds what: the holder's name, in their presence colour, on a tag above
 * each element someone else has selected — one tag per holder. Its dashed
 * frame is drawn on the canvas (`ScreenOverlays`).
 */
export function HeldTags({
  elements,
  held,
  camera,
}: {
  elements: BoardElement[];
  held: ReadonlyMap<string, Participant>;
  camera: SharedValue<Camera>;
}) {
  if (!held.size) return null;
  const tagged = new Set<string>();
  const tags: { who: Participant; at: Point }[] = [];
  for (const el of elements) {
    const who = held.get(el.id);
    if (!who || tagged.has(who.userId)) continue;
    tagged.add(who.userId);
    const b = elementBounds(el);
    tags.push({ who, at: { x: b.x, y: b.y } });
  }
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {tags.map(({ who, at }) => (
        <HeldTag key={who.userId} who={who} at={at} camera={camera} />
      ))}
    </View>
  );
}

function HeldTag({
  who,
  at,
  camera,
}: {
  who: Participant;
  at: Point;
  camera: SharedValue<Camera>;
}) {
  // Above the element's top-left corner: 4 px left, 28 px up, whatever the zoom.
  const follow = useAtBoardPoint(camera, at, -4, -28);
  return (
    <Animated.View
      style={[
        PLACED,
        { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: who.color },
        follow,
      ]}
    >
      <Txt weight="bold" size={10} leading={1.3} tone="inverse" numberOfLines={1}>
        {who.nickname}
      </Txt>
    </Animated.View>
  );
}
