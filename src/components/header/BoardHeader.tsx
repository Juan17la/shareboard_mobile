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
import {
  Animated,
  Easing,
  Pressable,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { Colors, Radius, StatusColors } from '@/constants/theme';
import { useT, useTf } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';

import { IconButton } from '../ui/Button';
import { Avatar, AvatarOverflow } from '../ui/Avatar';
import { GlassBlur } from '../ui/Glass';
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

  // Chips share one height so the action strip reads as a single row of
  // controls rather than a mix of sizes.
  const chip = {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.62)',
  } as const;

  // Everything you can *do* with the board, as one strip: the menu, the code
  // (tap to copy), who may edit, share. In portrait it is the second row; in
  // landscape there is room for it beside the title, so the header is one row.
  const actions = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <IconButton icon="more" label={t.boardMenu} onPress={onOpenMenu} size={30} iconSize={17} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.code} ${meta?.shortCode ?? ''}`}
        onPress={onCopyCode}
        disabled={!meta}
        style={[
          chip,
          {
            gap: 6,
            borderColor: codeCopied ? 'transparent' : Colors.border,
            backgroundColor: codeCopied ? 'rgba(15,158,142,0.14)' : 'rgba(255,255,255,0.7)',
          },
        ]}
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
        style={[chip, { gap: 5 }]}
      >
        <Icon name={isPrivate ? 'lock' : 'lock-open'} size={14} color={Colors.text} />
        <Txt weight="bold" size={11.5}>
          {t.privacyShort}
        </Txt>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.share}
        onPress={onOpenShare}
        style={[
          chip,
          {
            gap: 6,
            paddingHorizontal: 12,
            borderColor: 'transparent',
            backgroundColor: Colors.accent,
            shadowColor: Colors.accent,
            shadowOpacity: 0.28,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          },
        ]}
      >
        <Icon name="share" size={15} color="#FFFFFF" />
        <Txt weight="extrabold" size={12} tone="inverse">
          {t.share}
        </Txt>
      </Pressable>
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + 6,
        paddingBottom: landscape ? 4 : 6,
        paddingLeft: Math.max(insets.left, landscape ? 26 : 12),
        // Flush with the tool rail's right edge (ToolRail mirrors this). The
        // rail starts below the header (`railTop`), so nothing has to dodge it.
        paddingRight: Math.max(insets.right, landscape ? 16 : 12),
        gap: 6,
      }}
    >
      {/* Who and where: back, the board, (the actions, in landscape) and who
          else is here. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton icon="back" label={t.back} onPress={goHome} size={34} />

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

        {/* The strip keeps its natural width; a long board name is what gives
            way (one line, ellipsised) rather than the controls. */}
        {landscape ? <View style={{ flexShrink: 0 }}>{actions}</View> : null}

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
            <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="people" size={18} color={Colors.textSecondary} />
            </View>
          ) : (
            shown.map((p, i) => (
              <Avatar key={p.userId} name={p.nickname} color={p.color} size={26} overlap={i > 0} />
            ))
          )}
          {overflow > 0 ? <AvatarOverflow count={overflow} /> : null}
        </Pressable>
      </View>

      {landscape ? null : actions}
    </View>
  );
}

/**
 * The frosted white-to-transparent wash the header sits on.
 *
 * The design's header is glass: a blur over the board with a gradient fading
 * to nothing, rather than a panel with a hairline — an edge across the top of
 * an infinite canvas would look like a bar. The blur is kept gentler than the
 * panels' so the line where it stops is soft. It is separate from the header
 * so it can be non-interactive: it covers the top of the board, and a
 * pointer-catching layer there would eat the first stroke of anyone drawing
 * near the top.
 *
 * The gradient is drawn at an explicit, measured width rather than `100%`:
 * on Android, react-native-svg keeps the size it resolved at first layout
 * when only the layout changes, so after a rotation the wash stopped at the
 * portrait width and the header showed a hard vertical seam. Numeric props
 * change with the width, which makes the native view redraw.
 */
export function HeaderScrim({ height }: { height: number }) {
  // The window width is only the first-frame guess until `onLayout` reports.
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? window.width;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setMeasured((prev) => (prev === w ? prev : w));
  };

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}
    >
      <GlassBlur intensity={28} />
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="headerFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.92} />
            <Stop offset="0.62" stopColor="#FFFFFF" stopOpacity={0.72} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#headerFade)" />
      </Svg>
    </View>
  );
}
