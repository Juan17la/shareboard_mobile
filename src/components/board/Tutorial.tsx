/**
 * The first-run walkthrough (docs/plans/33): six coach marks over the real
 * interface — the board dimmed around the thing being shown, a caption, Next
 * and Skip. The dimming lets every touch through, so a step can be done for
 * real: drawing something finishes the first, selecting it the fourth; Next
 * always works. On first run it is only offered — a card with Not now and
 * Show me around, gone with the first stroke — so nothing stands between a new
 * user and the board; it runs again from Settings (`tutorialDone`). Twin of
 * the web `Tutorial.tsx`.
 *
 * Targets register themselves with `tourRef(name)` and are measured in the
 * window while the step is up, so a toolbar that moves or wraps is followed.
 */
import { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { useT } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';
import { useColors, useSessionStore } from '@/features/session/store';
import { useBackToClose } from '@/hooks/use-back-to-close';

import { Txt } from '../ui/Text';

type Target = 'pencil' | 'options' | 'settings' | 'select' | 'shapes' | 'share';

const targets = new Map<Target, View>();
/** A ref for the view a step points at. */
export const tourRef = (name: Target) => (view: View | null) => {
  if (view) targets.set(name, view);
  else targets.delete(name);
};

interface Step {
  text: 'tourDraw' | 'tourOptions' | 'tourShape' | 'tourSelect' | 'tourArrows' | 'tourShare';
  target: Target;
  /** The pencil in hand, its options strip open. */
  pen?: boolean;
  /** Starts with nothing selected, so selecting is what finishes it. */
  deselect?: boolean;
  /** Done by doing it: the board changed in the way the step asks for. */
  done?: (count: number, selected: number) => boolean;
}

const STEPS: Step[] = [
  { text: 'tourDraw', target: 'pencil', pen: true, done: (count) => count > 0 },
  { text: 'tourOptions', target: 'options', pen: true },
  { text: 'tourShape', target: 'pencil', pen: true },
  { text: 'tourSelect', target: 'select', deselect: true, done: (_, selected) => selected > 0 },
  { text: 'tourArrows', target: 'shapes' },
  { text: 'tourShare', target: 'share' },
];

type Rect = { x: number; y: number; width: number; height: number };
const DIM = 'rgba(15, 18, 32, 0.45)';

/** `offerTop`: where the first-run offer sits. */
export function Tutorial({ offerTop }: { offerTop: number }) {
  const c = useColors();
  const t = useT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const done = useSessionStore((s) => s.tutorialDone);
  const setDone = useSessionStore((s) => s.setTutorialDone);
  const canEdit = useBoardStore((s) => s.canEditNow());
  const empty = useBoardStore((s) => !Object.values(s.elements).some((el) => !el.deleted));
  // -1 is the offer: first run asks; a replay from Settings starts at once.
  const [index, setIndex] = useState(() => (useSessionStore.getState().tutorialDone ? 0 : -1));
  const [rect, setRect] = useState<Rect | null>(null);
  const offer = index < 0;
  const step = STEPS[Math.max(0, index)];
  const text = offer ? 'tourOffer' : step.text;
  const active = !done && canEdit;

  const finish = () => {
    setIndex(0);
    setDone(true);
  };
  const next = () => (index === STEPS.length - 1 ? finish() : setIndex(index + 1));
  // Back skips the tour, as Skip does (and answers the offer, while it shows).
  useBackToClose(active && !(offer && !empty), finish);

  // Put the pencil in hand with its options open for the steps about it, and
  // advance when the step is done for real — counted from when it came up.
  useEffect(() => {
    if (!active || offer) return;
    const board = useBoardStore.getState();
    if (step.pen) {
      if (board.tool !== 'pen') board.pickTool('pen');
      board.setRailOpen(true);
    }
    if (step.deselect) board.select(null);
    if (!step.done) return;
    const visible = (s: typeof board) => Object.values(s.elements).filter((el) => !el.deleted).length;
    const start = visible(board);
    const unsub = useBoardStore.subscribe((s) => {
      if (!step.done!(visible(s) - start, s.selectedIds.length)) return;
      unsub();
      setIndex((i) => i + 1);
    });
    return unsub;
  }, [active, offer, step]);

  // Follow the target while the step is up: toolbars wrap, strips open late.
  useEffect(() => {
    if (!active || offer) return;
    const measure = () => {
      const view = targets.get(step.target);
      if (!view) return setRect(null);
      view.measureInWindow((x, y, width, height) =>
        setRect((old) =>
          old && old.x === x && old.y === y && old.width === width && old.height === height
            ? old
            : width
              ? { x, y, width, height }
              : null,
        ),
      );
    };
    measure();
    const timer = setInterval(measure, 250);
    return () => clearInterval(timer);
  }, [active, offer, step]);

  // Drawing answers the offer: they found their way without it. The pencil is
  // in hand meanwhile, so the first stroke takes no tap at all.
  useEffect(() => {
    if (!active || !offer || !empty) return;
    useBoardStore.getState().setTool('pen');
    return useBoardStore.subscribe((s) => {
      if (!Object.values(s.elements).some((el) => !el.deleted)) return;
      setIndex(0);
      setDone(true);
    });
  }, [active, offer, empty, setDone]);

  if (!active || (offer && !empty)) return null;

  const pad = 6;
  const hole = rect && {
    left: rect.x - pad,
    top: rect.y - pad,
    right: rect.x + rect.width + pad,
    bottom: rect.y + rect.height + pad,
  };
  const cardW = Math.min(300, screenW - 24);
  // Beside a target near a side edge (the toolbar standing on the left in
  // landscape), so the card doesn't cover the buttons above and below it;
  // otherwise above or below it, whichever has more room.
  const side = !hole
    ? null
    : hole.right < screenW / 3 && screenW - hole.right - 12 >= cardW + 12
      ? 'right'
      : hole.left > (screenW * 2) / 3 && hole.left - 12 >= cardW + 12
        ? 'left'
        : null;
  const below = !hole || hole.top < screenH / 2;
  const cardLeft = !hole
    ? (screenW - cardW) / 2
    : side === 'right'
      ? hole.right + 12
      : side === 'left'
        ? hole.left - 12 - cardW
        : Math.max(12, Math.min((hole.left + hole.right) / 2 - cardW / 2, screenW - cardW - 12));
  // Centred on the target when beside it, kept on screen (the card is ~110pt tall).
  const besideTop = hole && Math.max(12, Math.min((hole.top + hole.bottom) / 2 - 55, screenH - 122));

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {offer ? null : hole ? (
        <>
          {/* Four panes around the hole: React Native has no spread shadow to cut one out with. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, hole.top), backgroundColor: DIM }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: hole.bottom, bottom: 0, backgroundColor: DIM }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, width: Math.max(0, hole.left), top: hole.top, height: hole.bottom - hole.top, backgroundColor: DIM }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: hole.right, right: 0, top: hole.top, height: hole.bottom - hole.top, backgroundColor: DIM }} />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: hole.left,
              top: hole.top,
              width: hole.right - hole.left,
              height: hole.bottom - hole.top,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: c.accent,
            }}
          />
        </>
      ) : (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: DIM }} />
      )}
      <View
        accessibilityRole="alert"
        style={{
          position: 'absolute',
          left: cardLeft,
          width: cardW,
          ...(!hole
            ? { top: offer ? offerTop : screenH * 0.4 }
            : side
              ? { top: besideTop! }
              : below
                ? { top: hole.bottom + 12 }
                : { bottom: screenH - hole.top + 12 }),
          gap: 12,
          padding: 16,
          borderRadius: 16,
          backgroundColor: c.surface,
          shadowColor: '#151A2D',
          shadowOpacity: 0.2,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        <Txt weight="semibold" size={14} leading={1.35}>
          {t[text]}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt size={12} mono tone="tertiary">
            {offer ? null : `${index + 1}/${STEPS.length}`}
          </Txt>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" onPress={finish} hitSlop={6} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
            <Txt weight="bold" size={13} tone="secondary">
              {offer ? t.notNow : t.tourSkip}
            </Txt>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={next}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: c.accent }}
          >
            <Txt weight="extrabold" size={13} tone="inverse">
              {offer ? t.tourStart : index === STEPS.length - 1 ? t.tourDone : t.tourNext}
            </Txt>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
