/**
 * The board's header: who you are looking at, how to get others in, and the
 * way out.
 *
 * It floats over the canvas behind a blur with a fade to transparent rather
 * than sitting in a bar above it, so the board really does run edge to edge —
 * "enfocada en la pizarra y no en la interfaz" (docs/01). Everything in it is a
 * shortcut into a sheet, except the code chip, which the design makes directly
 * tappable to copy because that is the single most repeated action in a class.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { Colors, Radius, StatusColors } from '@/constants/theme';
import { useT, useTf } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';

import { IconButton } from '../ui/Button';
import { Avatar, AvatarOverflow } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Text';

/** A slow breathing dot — the design's "someone is actually here" signal. */
function PresenceDot({ color, animated }: { color: string; animated: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!animated) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, pulse]);

  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        opacity: animated ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }) : 1,
        transform: [
          { scale: animated ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) : 1 },
        ],
      }}
    />
  );
}

export function BoardHeader({
  landscape,
  codeCopied,
  onCopyCode,
  onOpenPeople,
  onOpenMenu,
  onOpenPrivacy,
  onOpenShare,
}: {
  landscape: boolean;
  codeCopied: boolean;
  onCopyCode: () => void;
  onOpenPeople: () => void;
  onOpenMenu: () => void;
  onOpenPrivacy: () => void;
  onOpenShare: () => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const tf = useTf();
  const meta = useBoardStore((s) => s.meta);
  const participants = useBoardStore((s) => s.participants);
  const connection = useBoardStore((s) => s.connection);
  const canEdit = useBoardStore((s) => s.canEditNow());

  const online = connection === 'online';
  const statusColor = online
    ? StatusColors.online
    : connection === 'offline'
      ? StatusColors.offline
      : StatusColors.connecting;
  const statusLabel = online
    ? participants.length === 1
      ? t.onlineOne
      : tf('onlineMany', { N: participants.length })
    : connection === 'offline'
      ? t.offline
      : t.connecting;

  // A board opened from a deep link, or replaced after an import, is the first
  // screen in the stack — there is nothing behind it to go back to, so "back"
  // has to mean "home" rather than doing nothing.
  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const shown = participants.slice(0, 3);
  const overflow = participants.length - shown.length;
  const isPrivate = meta?.access === 'private';

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + 8,
        paddingBottom: landscape ? 4 : 8,
        paddingLeft: Math.max(insets.left, landscape ? 26 : 12),
        // In landscape the tool rail owns the right edge, so the header stops
        // short of it instead of running underneath.
        paddingRight: Math.max(insets.right, landscape ? 200 : 12),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton icon="back" label={t.back} onPress={goHome} />

        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Txt weight="extrabold" size={15} leading={1.2} tracking={-0.2} numberOfLines={1}>
            {meta?.name ?? t.appName}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <PresenceDot color={statusColor} animated={online} />
            <Txt weight="semibold" size={11} tone="secondary">
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.connectedPeople}
          onPress={onOpenPeople}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexShrink: 0,
            padding: 3,
            borderRadius: Radius.pill,
            borderWidth: 1,
            borderColor: Colors.border,
            backgroundColor: 'rgba(255,255,255,0.62)',
          }}
        >
          {shown.length === 0 ? (
            <Icon name="people" size={18} color={Colors.textSecondary} />
          ) : (
            shown.map((p, i) => (
              <Avatar key={p.userId} name={p.nickname} color={p.color} size={26} overlap={i > 0} />
            ))
          )}
          {overflow > 0 ? <AvatarOverflow count={overflow} /> : null}
        </Pressable>

        <IconButton icon="more" label={t.boardMenu} onPress={onOpenMenu} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.code} ${meta?.shortCode ?? ''}`}
          onPress={onCopyCode}
          disabled={!meta}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 11,
            paddingVertical: 7,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: codeCopied ? 'transparent' : Colors.border,
            backgroundColor: codeCopied ? 'rgba(15,158,142,0.14)' : 'rgba(255,255,255,0.7)',
          }}
        >
          <Icon
            name={codeCopied ? 'check' : 'copy'}
            size={14}
            color={codeCopied ? '#0B7F72' : Colors.text}
          />
          <Txt
            weight="bold"
            size={12.5}
            mono
            tracking={0.6}
            color={codeCopied ? '#0B7F72' : Colors.text}
          >
            {meta?.shortCode ?? '——————'}
          </Txt>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.privacyShort}
          onPress={onOpenPrivacy}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: Colors.border,
            backgroundColor: 'rgba(255,255,255,0.62)',
          }}
        >
          <Icon name={isPrivate ? 'lock' : 'lock-open'} size={14} color={Colors.text} />
          <Txt weight="bold" size={11.5}>
            {t.privacyShort}
          </Txt>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.share}
          onPress={onOpenShare}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: Radius.md,
            backgroundColor: Colors.accent,
            shadowColor: Colors.accent,
            shadowOpacity: 0.28,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Icon name="share" size={15} color="#FFFFFF" />
          <Txt weight="extrabold" size={12} tone="inverse">
            {t.share}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The soft white-to-transparent wash the header sits on.
 *
 * It is a gradient rather than a blurred panel because a panel has an edge, and
 * an edge across the top of an infinite canvas looks like a bar. And it is
 * separate from the header so it can be non-interactive: it covers the top of
 * the board, and a pointer-catching layer there would eat the first stroke of
 * anyone drawing near the top.
 */
export function HeaderScrim({ height }: { height: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="headerFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.92} />
            <Stop offset="0.62" stopColor="#FFFFFF" stopOpacity={0.72} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#headerFade)" />
      </Svg>
    </View>
  );
}
