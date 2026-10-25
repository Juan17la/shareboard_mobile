/**
 * The board's header: which board this is, how to get others in, and the one
 * button everything else hangs off.
 *
 * It floats over the canvas with nothing behind the row — no bar, no glass, no
 * fade — only each button on its own small solid chip, so the board really
 * does run edge to edge — "enfocada en la pizarra y no en la interfaz"
 * (docs/01). One row in both orientations: an identity chip on the left (the
 * board's tile, its name and status, and the avatars of whoever is drawing
 * with you), Share and the menu on the right. Settings, other boards, export,
 * access, people and the assistant all live in the menu, grouped.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusColors } from '@/constants/theme';
import { useColors } from '@/features/session/store';
import { useT, useTf } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';

import { Avatar, AvatarOverflow } from '../ui/Avatar';
import { IconButton } from '../ui/Button';
import { tourRef } from '../board/Tutorial';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Text';
import { tip } from '../ui/Toast';

/** Whether the system asks for less motion; the pulse and the entrance honour it. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/** A slow breathing dot — the design's "someone is actually here" signal. */
function PresenceDot({ color, animated: wanted, size = 8 }: { color: string; animated: boolean; size?: number }) {
  const [pulse] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  const animated = wanted && !reduced;

  useEffect(() => {
    if (!animated) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, pulse]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: animated ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) : 1,
        transform: [{ scale: animated ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) : 1 }],
      }}
    />
  );
}

/** The board's mark: its first letter on a tint, with the connection as a badge on the corner. */
function BoardTile({ name, status, live }: { name: string; status: string; live: boolean }) {
  const c = useColors();
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '·';
  return (
    <View style={{ width: 36, height: 36 }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          backgroundColor: c.accentSoft,
          borderWidth: 1,
          borderColor: 'rgba(0,113,227,0.22)',
        }}
      >
        <Txt weight="extrabold" size={17} color={c.accentText}>
          {initial}
        </Txt>
      </View>
      <View
        style={{
          position: 'absolute',
          right: -3,
          bottom: -3,
          padding: 2,
          borderRadius: 8,
          backgroundColor: c.surface,
        }}
      >
        <PresenceDot color={status} animated={live} />
      </View>
    </View>
  );
}

export function BoardHeader({
  onOpenPeople,
  onOpenMenu,
  onOpenShare,
}: {
  onOpenPeople: () => void;
  onOpenMenu: () => void;
  onOpenShare: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const tf = useTf();
  const meta = useBoardStore((s) => s.meta);
  const participants = useBoardStore((s) => s.participants);
  const connection = useBoardStore((s) => s.connection);
  const canEdit = useBoardStore((s) => s.canEditNow());
  const reduced = useReducedMotion();

  const online = connection === 'online';
  // The offline board (plans/34): nobody else is on it, and there is no code yet — Share makes one.
  const local = connection === 'local';
  const statusColor = online
    ? StatusColors.online
    : local
      ? c.textSecondary
      : connection === 'offline'
      ? StatusColors.offline
      : StatusColors.connecting;
  const statusLabel = online
    ? participants.length === 1
      ? t.onlineOne
      : tf('onlineMany', { N: participants.length })
    : local
      ? t.localStatus
      : connection === 'offline'
      ? t.offline
      : t.connecting;
  const name = meta?.name ?? t.appName;

  // The chip settles in once, when the board opens.
  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, { toValue: 1, duration: 360, easing: Easing.bezier(0.22, 0.9, 0.26, 1), useNativeDriver: true }).start();
  }, [enter, reduced]);

  const shown = participants.slice(0, 3);
  const overflow = participants.length - shown.length;

  const identity = (
    <>
      <BoardTile name={name} status={statusColor} live={online} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Txt weight="extrabold" size={15} leading={1.2} tracking={-0.2} numberOfLines={1}>
          {name}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Txt weight="semibold" size={11} tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {statusLabel}
          </Txt>
          {!canEdit && meta ? (
            <>
              <Txt weight="semibold" size={11} tone="tertiary">
                ·
              </Txt>
              <Txt weight="bold" size={11} tone="tertiary">
                {t.viewOnly}
              </Txt>
            </>
          ) : null}
        </View>
      </View>
      {shown.length > 0 && !local ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }}>
          {shown.map((p, i) => (
            <Avatar key={p.userId} name={p.nickname} color={p.color} avatar={p.avatar} size={26} overlap={i > 0} />
          ))}
          {overflow > 0 ? <AvatarOverflow count={overflow} /> : null}
        </View>
      ) : null}
    </>
  );
  const chipStyle = {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
    shadowColor: '#151A2D',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  } as const;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + 4,
        paddingBottom: 4,
        paddingLeft: Math.max(insets.left, 12),
        paddingRight: Math.max(insets.right, 12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Animated.View
        style={{
          flex: 1,
          minWidth: 0,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
        }}
      >
        {/* Who is here is one tap away: the chip opens the list. */}
        {local ? (
          <View style={chipStyle}>{identity}</View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${name}. ${t.connectedPeople}: ${statusLabel}`}
            onPress={onOpenPeople}
            onLongPress={() => tip(participants.map((p) => p.nickname).join(', ') || t.connectedPeople)}
            style={({ pressed }) => [chipStyle, pressed ? { backgroundColor: c.surfaceSelected } : null]}
          >
            {identity}
          </Pressable>
        )}
      </Animated.View>

      <Pressable
        ref={tourRef('share')}
        accessibilityRole="button"
        accessibilityLabel={t.share}
        onPress={onOpenShare}
        onLongPress={() => tip(t.share)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 48,
          paddingHorizontal: 16,
          borderRadius: 18,
          backgroundColor: pressed ? c.accentDeep : c.accent,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(0,55,130,0.45)',
          shadowColor: c.accent,
          shadowOpacity: 0.28,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        })}
      >
        <Icon name="share" size={17} color="#FFFFFF" />
        <Txt weight="extrabold" size={13.5} tone="inverse" numberOfLines={1}>
          {t.share}
        </Txt>
      </Pressable>
      <IconButton icon="more" label={t.boardMenu} onPress={onOpenMenu} size={48} iconSize={19} radius={18} />
    </View>
  );
}
