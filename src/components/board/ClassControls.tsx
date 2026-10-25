/**
 * What a class does together on a board besides drawing on it: reactions that
 * float up everyone's screen, and a countdown everyone sees. Neither is board
 * content — the server relays them and keeps nothing but the countdown's end.
 * Same as web's `ClassControls`, laid out for a thumb: one button in the
 * camera chip opens a small panel of emoji and countdowns.
 */
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { customMs, useBoardStore } from '@/features/board/store';
import { useT } from '@/features/i18n/store';
import { useColors } from '@/features/session/store';
import { useBackToClose } from '@/hooks/use-back-to-close';
import { REACTIONS, type Reaction } from '@/services/realtime/protocol';

import { GlassPanel } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

/** The countdowns offered, in minutes. */
const TIMER_MINUTES = [1, 3, 5, 10];

/** The panel the chip's smiley opens: emoji for everyone, countdowns for those who can edit. */
export function ClassPanel({
  onReact,
  onTimer,
  onClose,
}: {
  onReact: (emoji: Reaction) => void;
  onTimer: (ms: number | null) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const t = useT();
  const canEdit = useBoardStore((s) => s.canEditNow());
  const running = useBoardStore((s) => s.timerEndsAt !== null);
  const [min, setMin] = useState('2');
  const [sec, setSec] = useState('30');
  const custom = customMs(min, sec);
  const field = {
    width: 48,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: c.borderStrong,
    color: c.text,
    textAlign: 'center' as const,
    fontWeight: '700' as const,
    padding: 0,
  };
  // Android Back closes the panel before it leaves the board.
  useBackToClose(true, onClose);
  const chip = (label: string, onPress: () => void, danger = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        onPress();
        onClose();
      }}
      style={({ pressed }) => ({
        height: 40,
        minWidth: 44,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: pressed ? c.surfaceSelected : 'transparent',
      })}
    >
      <Txt weight="bold" size={label.length <= 2 ? 22 : 13} color={danger ? c.danger : undefined}>
        {label}
      </Txt>
    </Pressable>
  );
  return (
    <GlassPanel level="panel" radius={14} style={{ marginTop: 6, padding: 4 }}>
      <View accessibilityLabel={t.reactions} style={{ flexDirection: 'row' }}>
        {REACTIONS.map((emoji) => chip(emoji, () => onReact(emoji)))}
      </View>
      {canEdit ? (
        <View accessibilityLabel={t.timer} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ paddingHorizontal: 8 }}>
            <Icon name="timer" size={16} />
          </View>
          {TIMER_MINUTES.map((min) => chip(`${min} ${t.minutes}`, () => onTimer(min * 60_000)))}
          {running ? chip(t.timerStop, () => onTimer(null), true) : null}
        </View>
      ) : null}
      {canEdit ? (
        // Any time up to three hours: minutes and seconds, then Start.
        <View
          accessibilityLabel={t.timerCustom}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1, borderColor: c.border }}
        >
          <TextInput accessibilityLabel={t.minutes} keyboardType="number-pad" value={min} onChangeText={setMin} style={field} />
          <Txt weight="bold" size={12}>{t.minutes}</Txt>
          <TextInput accessibilityLabel={t.seconds} keyboardType="number-pad" value={sec} onChangeText={setSec} style={field} />
          <Txt weight="bold" size={12}>{t.seconds}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.timerStart}
            accessibilityState={{ disabled: !custom }}
            disabled={!custom}
            onPress={() => {
              if (!custom) return;
              onTimer(custom);
              onClose();
            }}
            style={{ marginLeft: 'auto', height: 36, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', backgroundColor: c.accent, opacity: custom ? 1 : 0.4 }}
          >
            <Txt weight="extrabold" size={13} color="#FFFFFF">
              {t.timerStart}
            </Txt>
          </Pressable>
        </View>
      ) : null}
    </GlassPanel>
  );
}

/** One reaction: rises from the bottom-left corner and fades as it goes. */
function Floating({ emoji, who, color, slot }: { emoji: string; who: string; color: string; slot: number }) {
  const rise = useSharedValue(0);
  const fade = useSharedValue(1);
  useEffect(() => {
    // With reduced motion the rise is skipped and the fade still shows it going.
    rise.set(withTiming(-220, { duration: 3000, reduceMotion: ReduceMotion.System }));
    fade.set(withDelay(2200, withTiming(0, { duration: 800, reduceMotion: ReduceMotion.Never })));
  }, [rise, fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: rise.get() }] }));
  return (
    <Animated.View style={[{ position: 'absolute', bottom: 0, left: slot * 40, alignItems: 'center' }, style]}>
      <Txt size={32}>{emoji}</Txt>
      {who ? (
        <View style={{ marginTop: 2, maxWidth: 96, borderRadius: 999, paddingHorizontal: 6, backgroundColor: color }}>
          <Txt weight="bold" size={11} color="#FFFFFF" numberOfLines={1}>
            {who}
          </Txt>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Reactions floating up from the bottom-left corner, each with who sent it. */
export function ReactionStream({ bottom }: { bottom: number }) {
  const reactions = useBoardStore((s) => s.reactions);
  if (!reactions.length) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, bottom, width: 160, height: 0 }}>
      {reactions.map((r, i) => (
        <Floating key={r.id} emoji={r.emoji} who={r.who} color={r.color} slot={i % 4} />
      ))}
    </View>
  );
}

/** `m:ss`, or `h:mm:ss` from an hour up. */
const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  const ss = String(s % 60).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/** The countdown, under the header, for everyone on the board. */
export function TimerPill({ top }: { top: number }) {
  const c = useColors();
  const t = useT();
  const endsAt = useBoardStore((s) => s.timerEndsAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const tick = setInterval(() => {
      const at = Date.now();
      setNow(at);
      // Over: say so once, then let it go.
      if (at >= endsAt) {
        clearInterval(tick);
        toast(t.timerUp);
        setTimeout(() => {
          if (useBoardStore.getState().timerEndsAt === endsAt) useBoardStore.getState().setTimerLeft(null);
        }, 4000);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [endsAt, t]);

  if (endsAt === null) return null;
  const left = Math.max(0, endsAt - now);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top, alignItems: 'center' }}>
      <GlassPanel level="chip" radius={16}>
        <View
          accessibilityRole="timer"
          accessibilityLabel={t.timer}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Icon name="timer" size={16} color={left === 0 ? c.accent : c.text} />
          <Txt weight="bold" size={15} mono color={left === 0 ? c.accent : undefined}>
            {left === 0 ? t.timerUp : clock(left)}
          </Txt>
        </View>
      </GlassPanel>
    </View>
  );
}
