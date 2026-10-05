/**
 * The board's header: who you are looking at, how to get others in, and the
 * two buttons everything else hangs off — the menu and the settings.
 *
 * It floats over the canvas with nothing behind the row — no bar, no glass, no
 * fade — only each button on its own small solid chip, so the board really
 * does run edge to edge — "enfocada en la pizarra y no en la interfaz"
 * (docs/01). Everything in it is a
 * shortcut into a sheet, except the code chip, which the design makes directly
 * tappable to copy because that is the single most repeated action in a class.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, StatusColors } from '@/constants/theme';
import { useColors } from '@/features/session/store';
import { useT, useTf } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';
import { formatShortCode } from '@/utils/short-code';

import { IconButton } from '../ui/Button';
import { Avatar, AvatarOverflow } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Text';
import { tip } from '../ui/Toast';

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
          {
            scale: animated ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) : 1,
          },
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
  onOpenExport,
}: {
  landscape: boolean;
  codeCopied: boolean;
  onCopyCode: () => void;
  onOpenPeople: () => void;
  onOpenMenu: () => void;
  onOpenPrivacy: () => void;
  onOpenShare: () => void;
  onOpenExport: () => void;
}) {
  const c = useColors();
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
    borderColor: c.border,
    backgroundColor: c.surface,
  } as const;

  // The header is two clusters: on the left the board (its name, the menu
  // and export), on the right who is here and who may edit (people,
  // permissions, the code to copy) and share. In portrait each is a row, the name and the
  // people on top; in landscape there is room for all of it on one row.
  const row = { flexDirection: 'row', alignItems: 'center', gap: 6 } as const;
  const left = (
    <View style={{ ...row, flexShrink: 1 }}>
      <IconButton icon="more" label={t.boardMenu} onPress={onOpenMenu} size={30} iconSize={17} />
      <IconButton
        icon="download"
        label={t.exportImage}
        onPress={onOpenExport}
        size={30}
        iconSize={16}
      />
    </View>
  );
  const people = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.connectedPeople}
      onPress={onOpenPeople}
      onLongPress={() => tip(participants.map((p) => p.nickname).join(', ') || t.connectedPeople)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        padding: 3,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      {shown.length === 0 ? (
        <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="people" size={18} color={c.textSecondary} />
        </View>
      ) : (
        shown.map((p, i) => (
          <Avatar
            key={p.userId}
            name={p.nickname}
            color={p.color}
            avatar={p.avatar}
            size={26}
            overlap={i > 0}
          />
        ))
      )}
      {overflow > 0 ? <AvatarOverflow count={overflow} /> : null}
    </Pressable>
  );
  const right = (
    <View style={{ ...row, justifyContent: 'flex-end' }}>
      {landscape ? people : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.privacyShort}
        onPress={onOpenPrivacy}
        onLongPress={() => tip(t.privacyShort)}
        style={[chip, { gap: 5 }]}
      >
        <Icon name={isPrivate ? 'lock' : 'lock-open'} size={14} color={c.text} />
        {/* Portrait has no room for both labels ("Permisos" + "Compartir" pushed
            share off the edge): the lock says it, the long-press tip names it. */}
        {landscape ? (
          <Txt weight="bold" size={11.5}>
            {t.privacyShort}
          </Txt>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.code} ${meta?.shortCode ?? ''}`}
        onPress={onCopyCode}
        onLongPress={() => tip(t.code)}
        disabled={!meta}
        style={[
          chip,
          {
            gap: 6,
            borderColor: codeCopied ? 'transparent' : c.border,
            backgroundColor: codeCopied ? 'rgba(15,158,142,0.14)' : c.surface,
          },
        ]}
      >
        <Icon
          name={codeCopied ? 'check' : 'copy'}
          size={14}
          color={codeCopied ? '#0B7F72' : c.text}
        />
        <Txt weight="extrabold" size={13} tracking={1} color={codeCopied ? '#0B7F72' : c.text}>
          {meta ? formatShortCode(meta.shortCode) : '———·———'}
        </Txt>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.share}
        onPress={onOpenShare}
        onLongPress={() => tip(t.share)}
        style={[
          chip,
          {
            gap: 6,
            paddingHorizontal: 12,
            // Last in the row: on a phone narrower still, it is what gives way.
            flexShrink: 1,
            minWidth: 0,
            borderColor: 'transparent',
            backgroundColor: c.accent,
            shadowColor: c.accent,
            shadowOpacity: 0.28,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          },
        ]}
      >
        <Icon name="share" size={15} color="#FFFFFF" />
        <Txt
          weight="extrabold"
          size={12}
          tone="inverse"
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {t.share}
        </Txt>
      </Pressable>
    </View>
  );
  const titleEl = (
    <View
      style={{
        flexShrink: 1,
        minWidth: 0,
        gap: 1,
        paddingHorizontal: 2,
      }}
    >
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
  );

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + 4,
        paddingBottom: landscape ? 2 : 4,
        paddingLeft: Math.max(insets.left, landscape ? 26 : 12),
        paddingRight: Math.max(insets.right, landscape ? 16 : 12),
        gap: 6,
      }}
    >
      {landscape ? (
        <View style={{ ...row, gap: 8 }}>
          {titleEl}
          {left}
          <View style={{ flex: 1 }} />
          {right}
        </View>
      ) : (
        <>
          <View style={{ ...row, gap: 8 }}>
            {titleEl}
            <View style={{ flex: 1 }} />
            {people}
          </View>
          <View style={{ ...row, gap: 8, justifyContent: 'space-between' }}>
            {left}
            {right}
          </View>
        </>
      )}
    </View>
  );
}
