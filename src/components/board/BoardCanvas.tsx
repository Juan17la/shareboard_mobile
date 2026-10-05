/**
 * The board itself: an infinite white canvas, the dot grid, everything drawn on
 * it, and the gestures that draw and move it.
 *
 * One finger is always the active tool and two fingers are always the camera —
 * the split the design relies on and the reason drawing never fights panning.
 * The cursor is no exception: a drag with it moves or rubber-bands. Only the
 * hand tool, and a viewer with no tools at all, get one-finger panning.
 * The camera lives in the store but never on the wire: pan and zoom are
 * per-device (docs/05-model-date).
 *
 * The canvas itself does not re-render when the camera moves. Skia re-records
 * every node on each render, so a pan used to re-record the whole board every
 * frame; instead the camera is mirrored into a shared value and the element
 * group's transform and the dot grid follow it on the UI thread. What sits in
 * screen space over the board (the selection, the peers' cursors, the label
 * button, the text editor) reads the camera itself, and only while it shows.
 */
import {
  Blur,
  Canvas,
  Group,
  Paint,
  type CanvasRef,
  type Transforms3d,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { REALTIME } from '@/constants/config';
import { Shadow, inkFor } from '@/constants/theme';
import {
  elbowDragPatch,
  bendHandleOf,
  curveFromDrag,
  curveHandlesOf,
  boxOf,
  canRotate,
  elementBounds,
  elementsIn,
  handlesOf,
  isLineLike,
  labelBox,
  labelFromDrag,
  labelLines,
  lineLabelCentre,
  linkEndpoints,
  recognizeSketch,
  sketchResize,
  type Sketch,
  resizeElement,
  rotateHandleOf,
  rotationOf,
  rotationFromDrag,
  ROTATE_HANDLE,
  shapeAt,
  shapeBounds,
  simplify,
} from '@/features/board/geometry';
import { LIMITS, SHAPE_TEXT_SIZE, type BoardElement, type Link, type Participant, type Point, type ShapeElement } from '@/features/board/model';
import { visibleSorted } from '@/features/board/ops';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  coveringFigure,
  editPatches,
  fillWith,
  heldByOthers,
  sketchElement,
  useBoardStore,
  type Camera,
  type LiveEdit,
} from '@/features/board/store';
import { useT } from '@/features/i18n/store';
import { useSessionStore, useColors } from '@/features/session/store';
import { tick } from '@/utils/haptics';

import {
  Anchors,
  DashedBox,
  ElementRenderer,
  LiveBoxShape,
  LiveStroke,
  ERASING_ALPHA,
  HELD_ALPHA,
  LiveDotGrid,
  SelectionFrame,
} from './ElementRenderer';
import { HoldMenu, type HoldSpot } from './HoldMenu';
import { HeldTags, PeerCursors } from './PeerCursors';
import { TextEditorOverlay } from './TextEditorOverlay';
import { Txt } from '../ui/Text';

const storeCamera = () => useBoardStore.getState().camera;

function screenToBoard(x: number, y: number): Point {
  const camera = storeCamera();
  return { x: (x - camera.x) / camera.scale, y: (y - camera.y) / camera.scale };
}

type Ends = {
  from: Point;
  to: Point;
  fromLink?: Link | null;
  toLink?: Link | null;
};

/** An arrow's ends bind to the shapes they land on; a plain line never does. */
function snapLine(shape: string, from: Point, to: Point): Ends {
  if (shape !== 'arrow') return { from, to };
  const store = useBoardStore.getState();
  // Never to itself: the line being reshaped is not a target.
  const others = store.visibleElements().filter((el) => !store.selectedIds.includes(el.id));
  return linkEndpoints(others, from, to, 18 / store.camera.scale);
}

/**
 * The handle index for a curved or elbow line's fold — past the two
 * endpoints (0, 1) `handlesOf` gives a line, so it never collides with them.
 */
const BEND_HANDLE = 2;
/** The label of a line, dragged along it (past `BEND_HANDLE` and the geometry's `ROTATE_HANDLE`). */
const LABEL_HANDLE = 6;
/** The pull of a curved line at its start and at its end. */
const CURVE_START_HANDLE = 7;
const CURVE_END_HANDLE = 8;

/** The patch of an edit dragged to `p`. A line's ends are re-bound after. */
function dragPatch(edit: LiveEdit, el: BoardElement, p: Point): Partial<BoardElement> {
  if (edit.handle === CURVE_START_HANDLE && el.kind === 'shape') return curveFromDrag(el, 'start', p);
  if (edit.handle === CURVE_END_HANDLE && el.kind === 'shape') return curveFromDrag(el, 'end', p);
  if (edit.handle === BEND_HANDLE && el.kind === 'shape' && isLineLike(el)) {
    // A curve's middle slides its whole bow; an elbow's, its middle segment.
    return el.route === 'curved' ? curveFromDrag(el, 'mid', p) : elbowDragPatch(el, p);
  }
  if (edit.handle === LABEL_HANDLE && el.kind === 'shape') return { labelAt: labelFromDrag(el, p) };
  if (edit.handle === ROTATE_HANDLE) return { rotation: rotationFromDrag(el, p) };
  const next = resizeElement(el, edit.handle, p) as Partial<ShapeElement>;
  if (el.kind === 'shape' && isLineLike(el) && next.from && next.to)
    return snapLine(el.shape, next.from, next.to);
  return next;
}

/**
 * Set while a camera gesture's commit is being written to the store, so the
 * store-to-shared-value sync leaves it alone. Module-level rather than a ref:
 * it is read from a subscription and written from a gesture callback, never
 * from render.
 */
const cameraCommit = { fromGesture: false };

/** The camera a pan or pinch ended on, into the store — once, when the fingers lift. */
function commitCamera(c: Camera) {
  const store = useBoardStore.getState();
  const cur = store.camera;
  if (cur.x === c.x && cur.y === c.y && cur.scale === c.scale) return;
  cameraCommit.fromGesture = true;
  store.setCamera(c);
  cameraCommit.fromGesture = false;
}

/** The clock, for worklets: called from a component's own body the compiler takes `Date.now` for an impure render. */
const nowMs = () => {
  'worklet';
  return Date.now();
};

/** A number, not `LIMITS`: a worklet that names `LIMITS` copies the whole object to the UI thread, and it holds a RegExp. */
const MAX_STROKE_POINTS = LIMITS.maxStrokePoints;

/** How long a finger holds still with the cursor before the menu opens: paste on empty board, the element's actions on a figure. */
const HOLD_MS = 500;
/** How long a pen stroke's end is held before it is read as a figure (`recognizeSketch`). */
const SKETCH_MS = 500;
/** Screen pixels a finger may wander and still count as held still. */
const STILL_PX = 8;

/**
 * Whether this tap on `id` is the second within 300 ms — the cursor tool's
 * double tap. The empty board counts too (`''`): that is the zoom gesture.
 */
const isDoubleTap = (() => {
  let last = { id: '', at: -1 };
  return (id: string): boolean => {
    const now = Date.now();
    const again = last.at >= 0 && id === last.id && now - last.at < 300;
    last = { id, at: again ? -1 : now };
    return again;
  };
})();

export function BoardCanvas({
  onCursorMove,
  canvasRef,
  blur,
}: {
  onCursorMove?: (at: Point) => void;
  /** Blurs everything drawn, in px: the home screen's out-of-focus board. */
  blur?: number;
  /** Handed out so the glass panels can snapshot the board (`useBoardMirror`). */
  canvasRef?: RefObject<CanvasRef | null>;
}) {
  const c = useColors();
  const tool = useBoardStore((s) => s.tool);
  const config = useBoardStore((s) => s.config);
  const elements = useBoardStore((s) => s.elements);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const liveEdit = useBoardStore((s) => s.liveEdit);
  const liveMarquee = useBoardStore((s) => s.liveMarquee);
  const t = useT();
  const smooth = useSessionStore((s) => s.settings.smooth);
  const dark = useSessionStore((s) => s.theme === 'dark');
  const haptics = useSessionStore((s) => s.settings.haptics);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const liveShape = useBoardStore((s) => s.liveShape);
  const liveSketch = useBoardStore((s) => s.liveSketch);
  const liveErased = useBoardStore((s) => s.liveErased);
  const canEdit = useBoardStore((s) => s.canEditNow());
  const online = useBoardStore((s) => s.connection === 'online');
  const [editingId, setEditingId] = useState<string | null>(null);
  /** What is being typed: painted in place by the canvas, so the editor only holds the caret. */
  const [draft, setDraft] = useState<string | null>(null);
  /** The hold menu: where it opened on screen, and the board point a paste lands on. */
  const [menu, setMenu] = useState<HoldSpot | null>(null);
  // Another tool, or another board, and the menu is not about anything any more.
  useEffect(
    () =>
      useBoardStore.subscribe((s, prev) => {
        if (s.tool !== prev.tool || s.boardId !== prev.boardId) setMenu(null);
      }),
    [],
  );

  // Sorted once per change to the elements, not once per finger move: the
  // drag preview below only patches the sorted list.
  const drawn = useMemo(() => visibleSorted(elements), [elements]);
  // What the eraser has passed over fades (`ERASING_ALPHA`) and is deleted for
  // real, as one step, when the finger lifts.
  const sorted = drawn;
  const erasing = useMemo(() => new Set(liveErased), [liveErased]);
  const list = useMemo(() => {
    if (editingId && draft !== null) {
      return sorted.map((el) => (el.id === editingId ? ({ ...el, text: draft } as BoardElement) : el));
    }
    if (!liveEdit) return sorted;
    // The same patches the lift will commit, so the preview is the result —
    // except for what is being moved: that is shifted by the UI thread
    // (`dragTransform`), so only the lines bound to it are patched here.
    const own = liveEdit.mode === 'move' ? new Set(liveEdit.ids) : null;
    const patches = new Map(
      editPatches(sorted, liveEdit)
        .filter((p) => !own?.has(p.id))
        .map((p) => [p.id, p.patch]),
    );
    if (!patches.size) return sorted;
    return sorted.map((el) =>
      patches.has(el.id) ? ({ ...el, ...patches.get(el.id) } as BoardElement) : el,
    );
  }, [sorted, liveEdit, editingId, draft]);

  // What the others hold: dimmed, framed in their colour, not for picking.
  const participants = useBoardStore((s) => s.participants);
  const you = useBoardStore((s) => s.you);
  const held = useMemo(() => heldByOthers(participants, you), [participants, you]);

  // What the cursor is carrying: drawn through the drag offset, not re-rendered.
  const movingIds = useMemo(
    () => (liveEdit?.mode === 'move' ? new Set(liveEdit.ids) : null),
    [liveEdit],
  );

  const selecting = tool === 'select' || tool === 'shape';
  const selected = useMemo(
    () => (selecting ? list.filter((e) => selectedIds.includes(e.id)) : []),
    [list, selectedIds, selecting],
  );
  const selectedShape = selected.length === 1 && selected[0].kind === 'shape' ? selected[0] : null;

  // The store's camera, on the UI thread.
  const camera = useSharedValue<Camera>(storeCamera());
  // A pan or pinch moves `camera` itself, on the UI thread, and commits to the
  // store once it ends. That commit must not be echoed back into `camera`,
  // which by then may already have moved on under a new touch.
  useEffect(() => {
    camera.set(storeCamera());
    return useBoardStore.subscribe((s, prev) => {
      if (s.camera !== prev.camera && !cameraCommit.fromGesture) camera.set(s.camera);
    });
  }, [camera]);
  // The pen stroke under the finger, as [x, y, ...] in board space: appended to
  // and drawn on the UI thread (`LiveStroke`), committed to the store on lift.
  const pen = useSharedValue<number[]>([]);
  /** Where the finger last moved on from (screen px) and when: a hold reads as a figure. */
  const penAnchor = useSharedValue({ x: 0, y: 0, at: 0 });
  const penDown = useSharedValue({ x: 0, y: 0 });
  /** Whether the stroke is currently shown as the figure it was read as. */
  const penSketch = useSharedValue(false);
  /** Where the pen last was, in board space: where it stood when a figure was made from the stroke. */
  const penLast = useSharedValue({ x: 0, y: 0 });
  const penCursorAt = useSharedValue(0);
  // A selection being moved (cursor tool): the UI thread keeps its offset here,
  // in board units, from where the finger landed; the dragged elements and
  // their frame are drawn through it. `moveLive` says the JS side has picked
  // the selection up, `followLive` that lines bound to it need JS to re-lay them.
  const drag = useSharedValue({ dx: 0, dy: 0 });
  const dragDown = useSharedValue({ x: 0, y: 0 });
  const moveLive = useSharedValue(false);
  const followLive = useSharedValue(false);
  const dragTransform = useDerivedValue<Transforms3d>(() => {
    const { dx, dy } = drag.get();
    return [{ translateX: dx }, { translateY: dy }];
  });
  // The box shape being drawn (shapes tool, not the lines): both corners in
  // board space, and whether the preview shows.
  const shapeFrom = useSharedValue({ x: 0, y: 0 });
  const shapeTo = useSharedValue({ x: 0, y: 0 });
  const shapeLive = useSharedValue(false);
  const transform = useDerivedValue(() => {
    const { x, y, scale } = camera.get();
    return [{ translateX: x }, { translateY: y }, { scale }];
  });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    useBoardStore.getState().setViewport({ width, height });
  }, []);

  // The fill a box shape is drawn with, as the committed one will be.
  const liveFill = useMemo(() => {
    const fill = fillWith(config.fillColor ?? config.color, config.fillOpacity);
    return fill && dark ? inkFor(fill, true) : fill;
  }, [config.color, config.fillColor, config.fillOpacity, dark]);

  // Who owns a one-finger touch: see `gesture`.
  const panOnly = tool === 'hand' || !canEdit;
  const penOn = tool === 'pen' && canEdit && online;
  // A box shape is previewed on the UI thread; a line or an arrow snaps to shapes, which JS does.
  const uiShape = tool === 'shape' && config.shape !== 'line' && config.shape !== 'arrow';

  const gesture = useMemo(() => {
    const store = () => useBoardStore.getState();
    // Viewers and offline clients get no draft: a stroke that cannot be sent
    // would only ever exist on this screen, and the banner is what says so.
    const editable = () => store().canEditNow() && store().connection === 'online';

    // A finger landing on the selection drags it rather than drawing: a
    // handle (one element only) reshapes, anything selected moves the lot.
    const beginEdit = (p: Point): boolean => {
      const sel = store().selectedElements();
      if (!sel.length) return false;
      const scale = store().camera.scale;
      // Something drawn above the selection owns the press there. After "send
      // to back" the selection sits hidden under other figures; a finger on
      // one of them must pick it, not move or resize everything behind it.
      if (coveringFigure(store().visibleElements(), sel, p, 6 / scale)) return false;
      const hitR = 18 / scale;
      const one = sel.length === 1 ? sel[0] : null;
      const curve = one?.kind === 'shape' ? curveHandlesOf(one) : null;
      const fold = curve ? curve.mid : one?.kind === 'shape' ? bendHandleOf(one) : null;
      const onFold = fold ? Math.hypot(fold.x - p.x, fold.y - p.y) <= hitR : false;
      const near = (q: Point | undefined) => (q ? Math.hypot(q.x - p.x, q.y - p.y) <= hitR : false);
      const knob = one ? rotateHandleOf(one, scale) : null;
      const onKnob = knob ? Math.hypot(knob.x - p.x, knob.y - p.y) <= hitR : false;
      // A line's label is dragged along the line; an end, before it, is still an end.
      const end = one ? handlesOf(one).findIndex((h) => Math.hypot(h.x - p.x, h.y - p.y) <= hitR) : -1;
      const label = one?.kind === 'shape' && isLineLike(one) && one.text ? one : null;
      const size = label?.fontSize ?? SHAPE_TEXT_SIZE;
      const box = label ? labelBox(label, labelLines(label, size), size) : null;
      const pad = 6 / scale;
      const onLabel = box
        ? p.x >= box.x - pad && p.x <= box.x + box.width + pad && p.y >= box.y - pad && p.y <= box.y + box.height + pad
        : false;
      const handle = onKnob
        ? ROTATE_HANDLE
        : end >= 0
          ? end
          : near(curve?.start)
            ? CURVE_START_HANDLE
            : near(curve?.end)
              ? CURVE_END_HANDLE
              : onLabel
                ? LABEL_HANDLE
                : onFold
                  ? BEND_HANDLE
                  : -1;
      const onBody = !!store().elementAt(p, 6 / scale, sel);
      const mode = handle >= 0 ? 'resize' : onBody ? 'move' : null;
      if (!mode) return false;
      // The finger holds a handle where it landed on it, up to `hitR` off its
      // centre: the handle keeps that distance from the finger instead of
      // jumping under it (a line's end leapt to the finger and turned the line).
      const held = onKnob
        ? knob
        : handle === LABEL_HANDLE && label
          ? lineLabelCentre(label)
          : handle === CURVE_START_HANDLE
            ? (curve?.start ?? null)
            : handle === CURVE_END_HANDLE
              ? (curve?.end ?? null)
              : handle === BEND_HANDLE
                ? fold
                : one && handle >= 0
                  ? handlesOf(one)[handle]
                  : null;
      grab.x = held ? held.x - p.x : 0;
      grab.y = held ? held.y - p.y : 0;
      store().setLiveEdit({
        ids: sel.map((el) => el.id),
        mode,
        handle,
        start: p,
        dx: 0,
        dy: 0,
        patch: null,
      });
      return true;
    };

    // One finger moves the camera only for the hand tool and for anyone who
    // has no tools — the one gesture the board still owes a viewer. Every
    // other tool, the cursor included, leaves the camera to two fingers.
    const panning = () => store().tool === 'hand' || !store().canEditNow();
    // Where a line was started, unsnapped: its anchor can change as the end moves.
    const lineStart = { x: 0, y: 0 };
    // Where the finger landed. A pan activates only after it has moved a
    // little, so `onStart` is already past the spot the user aimed at.
    const down = { x: 0, y: 0 };
    // A finger held still with the cursor opens the menu there: paste on empty
    // board, the figure's actions (copy, order, group…) on a figure. A timer on
    // this gesture rather than a long-press gesture of its own: that one would
    // have to fail before any drag could start, and a drag that starts before
    // the timer fires must still move the figure. Once the menu is open the
    // rest of the touch is its, not the board's.
    const hold = { timer: null as ReturnType<typeof setTimeout> | null, open: false };
    const letGo = () => {
      if (hold.timer) clearTimeout(hold.timer);
      hold.timer = null;
    };
    // A pen stroke held still at its end for 700 ms is made into the figure it
    // was meant to be — at once, on the board, not as a preview: the stroke
    // gives way to it, and the pen, still down, then resizes it (an outwards
    // pull grows it, a line's tip follows), so moving on never loses the
    // figure. The stroke itself lives on the UI thread; this timer only looks
    // at when the finger last moved (`penAnchor`) and reads the points when due.
    const still = { timer: null as ReturnType<typeof setTimeout> | null, tested: -1, epoch: 0 };
    /** The figure made from this stroke, while the pen is still down. */
    const figure = {
      id: null as string | null,
      sketch: null as Sketch | null,
      p0: { x: 0, y: 0 },
      patch: null as { from: Point; to: Point } | null,
      raf: 0,
      at: { x: 0, y: 0 },
    };
    const stopSketch = () => {
      if (still.timer) clearTimeout(still.timer);
      still.timer = null;
    };
    const watchSketch = () => {
      still.timer = null;
      const { at } = penAnchor.get();
      const idle = nowMs() - at;
      if (idle < SKETCH_MS) {
        still.timer = setTimeout(watchSketch, SKETCH_MS - idle);
        return;
      }
      // Once per hold: the same anchor is not read twice.
      if (at !== still.tested) {
        still.tested = at;
        const sketch = recognizeSketch(pen.get(), 24 / store().camera.scale);
        const id = sketch ? store().addSketch(sketch) : null;
        if (sketch && id) {
          figure.id = id;
          figure.sketch = sketch;
          figure.p0 = penLast.get();
          figure.patch = null;
          // From here the pen resizes the figure instead of drawing.
          penSketch.set(true);
          tick(haptics);
          // The stroke stays up until the figure has reached the canvas (a
          // render or two), so nothing blinks — unless a new one has begun.
          const epoch = still.epoch;
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (epoch === still.epoch) pen.set([]);
            }),
          );
          return;
        }
      }
      still.timer = setTimeout(watchSketch, SKETCH_MS);
    };
    /** A pen stroke began (JS side of the pen gesture). */
    const penStarted = () => {
      still.epoch++;
      still.tested = -1;
      figure.id = null;
      figure.sketch = null;
      figure.patch = null;
      // Drawing is what the options were for; fold them away to give the
      // board back its width the moment the gesture starts.
      store().setRailOpen(false);
      stopSketch();
      still.timer = setTimeout(watchSketch, SKETCH_MS);
    };
    /** The pen moved after it made a figure: the figure follows, once a frame (JS side of the pen gesture). */
    const figureMoved = (x: number, y: number) => {
      figure.at = { x, y };
      if (figure.raf) return;
      figure.raf = requestAnimationFrame(() => {
        figure.raf = 0;
        if (!figure.id || !figure.sketch) return;
        figure.patch = sketchResize(figure.sketch, figure.p0, figure.at);
        store().setLiveEdit({
          ids: [figure.id],
          mode: 'resize',
          handle: -1,
          start: figure.p0,
          dx: 0,
          dy: 0,
          patch: figure.patch,
        });
      });
    };
    /** The pen lifted (or was cancelled): commit what was drawn. */
    const penEnded = (points: number[], success: boolean) => {
      stopSketch();
      penSketch.set(false);
      if (figure.raf) cancelAnimationFrame(figure.raf);
      figure.raf = 0;
      if (figure.id) {
        // The figure is already on the board; settle its size into the same undo step.
        if (figure.patch) store().finishFigure(figure.id, figure.patch);
        store().setLiveEdit(null);
        figure.id = null;
        figure.sketch = null;
        figure.patch = null;
        return;
      }
      // The pencil stays in hand: many strokes in a row is what it is for.
      if (success && points.length >= 4) store().addStroke(simplify(points));
      if (!success) {
        pen.set([]);
        return;
      }
      // The committed stroke reaches the canvas a render or two after the
      // store has it: the live one stays until then, so there is no blink —
      // unless a new stroke has begun by then, which owns the buffer.
      const epoch = still.epoch;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (epoch === still.epoch) pen.set([]);
        }),
      );
    };

    /**
     * Drags a handle of the selection to `p`. Moving the selection itself is
     * the UI thread's (`drawGesture`): it shifts `drag`, and the dragged
     * elements and their frame are drawn through it — nothing renders per sample.
     */
    const moveEdit = (p: Point) => {
      const edit = store().liveEdit;
      if (!edit || edit.mode === 'move') return;
      const held = { x: p.x + grab.x, y: p.y + grab.y };
      store().setLiveEdit({ ...edit, patch: dragPatch(edit, store().elements[edit.ids[0]], held) });
    };
    /** One undo step for the whole drag; a move's offset is the UI thread's last. */
    const finishEdit = (dx?: number, dy?: number) => {
      const live = store().liveEdit;
      if (!live) return;
      const edit = live.mode === 'move' && dx !== undefined ? { ...live, dx, dy: dy ?? 0 } : live;
      // A nudge of a pixel or two is a tap that wobbled, not a move to commit.
      const nudged = edit.mode === 'move' && Math.hypot(edit.dx, edit.dy) * store().camera.scale < 3;
      if (!nudged && (edit.dx || edit.dy || edit.patch)) store().commitEdit(edit);
      store().setLiveEdit(null);
      // The drag is over and the selection is still there: its options come back.
      store().setRailOpen(true);
    };
    /** Where a handle sits from the finger that took hold of it (`beginEdit`). */
    const grab = { x: 0, y: 0 };
    // A move is on the UI thread from the moment the drag has picked the
    // selection up (`startMove`); lines bound to what moves are the exception,
    // re-laid by JS once a frame (`dragFollow`) — they need the route geometry.
    const follow = { raf: 0, dx: 0, dy: 0, epoch: 0 };
    const startMove = () => {
      const edit = store().liveEdit;
      if (edit?.mode !== 'move') return;
      drag.set({ dx: 0, dy: 0 });
      const own = new Set(edit.ids);
      followLive.set(editPatches(store().visibleElements(), edit).some((q) => !own.has(q.id)));
      moveLive.set(true);
    };
    const dragFollow = (dx: number, dy: number) => {
      follow.dx = dx;
      follow.dy = dy;
      if (follow.raf) return;
      follow.raf = requestAnimationFrame(() => {
        follow.raf = 0;
        const edit = store().liveEdit;
        if (edit?.mode === 'move') store().setLiveEdit({ ...edit, dx: follow.dx, dy: follow.dy });
      });
    };
    const endMove = () => {
      moveLive.set(false);
      followLive.set(false);
      if (follow.raf) cancelAnimationFrame(follow.raf);
      follow.raf = 0;
    };

    // --- the draw gesture: every tool but the pen and the hand --------------
    // A worklet gesture that hands each event to the JS handlers below — the
    // same order and arguments the JS gesture had — except while the selection
    // is being moved, or a box shape drawn: those it keeps on the UI thread.
    const drawBegan = (x: number, y: number) => {
      down.x = x;
      down.y = y;
      letGo();
      hold.open = false;
      if (store().tool !== 'select' || !editable()) return;
      hold.timer = setTimeout(() => {
        hold.timer = null;
        const p = screenToBoard(down.x, down.y);
        // A hold on a figure picks it (unless it is already part of the
        // selection) and opens the menu for the selection.
        const hit = store().elementAt(p, 8 / store().camera.scale);
        if (hit && !store().selectedIds.includes(hit.id)) store().select(hit.id);
        else if (!hit) store().select(null);
        hold.open = true;
        tick(haptics);
        setMenu({ x: down.x, y: down.y, at: p });
      }, HOLD_MS);
    };
    const drawFinalized = () => {
      letGo();
      stopSketch();
    };
    const drawStarted = () => {
      letGo();
      if (hold.open || panning() || !editable()) return;
      // Drawing is what the options were for; fold them away to give the
      // board back its width the moment the gesture starts.
      store().setRailOpen(false);
      const p = screenToBoard(down.x, down.y);
      const t = store().tool;
      if (t === 'eraser') store().eraseAt(p);
      else if (t === 'shape') {
        // The shapes tool only ever draws: moving and resizing belong to the
        // cursor. A press on a shape it had picked used to grab that shape
        // (or a handle 18pt around it) instead of starting the new one.
        // Drawing lets go of whatever was picked before: the new shape is
        // the focus, and it lands unselected (below).
        store().select(null);
        if (!uiShape) {
          Object.assign(lineStart, p);
          store().setLiveShape(snapLine(store().config.shape, p, p));
        }
      } else if (t === 'select') {
        if (!beginEdit(p)) {
          // On something not yet selected: pick it up and carry it at once.
          // Off everything: rubber-band a new selection.
          const hit = store().elementAt(p, 8 / store().camera.scale);
          if (hit) {
            store().select(hit.id);
            beginEdit(p);
          } else {
            store().select(null);
            store().setLiveMarquee({ from: p, to: p });
          }
        }
        startMove();
      }
      // A finger rarely lands perfectly still: the slightest movement makes
      // this a pan rather than a tap, and the one-shot tools must still fire.
      else if (t === 'text') {
        const id = store().addText(p);
        if (id) setEditingId(id);
      } else if (t === 'fill') {
        if (store().fillAt(p)) tick(haptics);
      }
      onCursorMove?.(p);
    };
    const drawMoved = (x: number, y: number) => {
      if (hold.open || panning() || !editable()) return;
      const p = screenToBoard(x, y);
      const t = store().tool;
      if (t === 'eraser') store().eraseAt(p);
      else if (t === 'shape' || t === 'select') {
        const box = store().liveMarquee;
        if (store().liveEdit) moveEdit(p);
        else if (box) store().setLiveMarquee({ from: box.from, to: p });
        else if (store().liveShape) {
          store().setLiveShape(snapLine(store().config.shape, lineStart, p));
        }
      }
      onCursorMove?.(p);
    };
    const drawEnded = (success: boolean, dx: number, dy: number, from: Point, to: Point) => {
      endMove();
      if (hold.open) return;
      if (!success) {
        // Cancelled — a second finger turned it into a pinch. Nothing the
        // first finger started is kept: a zoom must never move a figure.
        store().setLiveEdit(null);
        store().setLiveMarquee(null);
        store().setLiveShape(null);
        store().setLiveSketch(null);
        store().discardErase();
        shapeLive.set(false);
        return;
      }
      store().commitErase();
      // Read from the store, not through a `setState` updater: an updater
      // runs during the next render, and a store write from there is React's
      // "cannot update a component while rendering a different component".
      const { tool: t, liveShape: shape, liveEdit: edit, liveMarquee: box } = store();
      if (edit) {
        finishEdit(dx, dy);
      } else if (box) {
        const ids = elementsIn(store().visibleElements(), shapeBounds(box)).map((el) => el.id);
        store().select(ids);
        // Selecting something is asking to change it: the options come up.
        store().setRailOpen(ids.length > 0);
        store().setLiveMarquee(null);
      } else if (t === 'shape' && uiShape) {
        // A tap with the shape tool is a mis-hit, not a zero-size rectangle.
        // Measured in screen pixels, like web: a board-space threshold made a
        // small shape drawn while zoomed in read as a mis-tap and vanish
        // instead of landing selected.
        // A new shape comes up selected with the cursor back, handles ready.
        if (Math.hypot(to.x - from.x, to.y - from.y) * store().camera.scale > 6) {
          const id = store().addShape(store().config.shape, { from, to });
          if (id) store().finishCreate([id]);
        }
        // The preview stays until the canvas has the committed shape (a render
        // or two), unless a new one has begun by then and owns it.
        const epoch = ++follow.epoch;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (epoch === follow.epoch) shapeLive.set(false);
          }),
        );
      } else if (t === 'shape' && shape) {
        const dragged = Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
        if (dragged * store().camera.scale > 6) {
          const id = store().addShape(store().config.shape, shape);
          if (id) store().finishCreate([id]);
        }
      }
      store().setLiveShape(null);
    };

    const drawGesture = Gesture.Pan()
      // Palm rejection: a second finger belongs to the camera, never the tool.
      .maxPointers(1)
      .onBegin((e) => {
        'worklet';
        dragDown.set({ x: e.x, y: e.y });
        // The last drag's offset must not be read as this one's if the gesture
        // ends before JS has picked the selection up.
        drag.set({ dx: 0, dy: 0 });
        scheduleOnRN(drawBegan, e.x, e.y);
      })
      .onFinalize(() => {
        'worklet';
        scheduleOnRN(drawFinalized);
      })
      .onStart(() => {
        'worklet';
        if (uiShape) {
          const c = camera.get();
          const d = dragDown.get();
          const at = { x: (d.x - c.x) / c.scale, y: (d.y - c.y) / c.scale };
          shapeFrom.set(at);
          shapeTo.set(at);
          shapeLive.set(true);
        }
        scheduleOnRN(drawStarted);
      })
      .onUpdate((e) => {
        'worklet';
        const c = camera.get();
        if (moveLive.get()) {
          // The selection follows the finger from where it landed, on this
          // thread: a move is an offset, which the dragged elements' transform
          // and their frame both read.
          const d = dragDown.get();
          const dx = (e.x - d.x) / c.scale;
          const dy = (e.y - d.y) / c.scale;
          drag.set({ dx, dy });
          if (followLive.get()) scheduleOnRN(dragFollow, dx, dy);
          const now = nowMs();
          if (onCursorMove && now - penCursorAt.get() >= REALTIME.cursorThrottleMs) {
            penCursorAt.set(now);
            scheduleOnRN(onCursorMove, { x: (e.x - c.x) / c.scale, y: (e.y - c.y) / c.scale });
          }
        } else if (uiShape) {
          shapeTo.set({ x: (e.x - c.x) / c.scale, y: (e.y - c.y) / c.scale });
          const now = nowMs();
          if (onCursorMove && now - penCursorAt.get() >= REALTIME.cursorThrottleMs) {
            penCursorAt.set(now);
            scheduleOnRN(onCursorMove, shapeTo.get());
          }
        } else {
          scheduleOnRN(drawMoved, e.x, e.y);
        }
      })
      .onEnd((_e, success) => {
        'worklet';
        const v = drag.get();
        scheduleOnRN(drawEnded, success, v.dx, v.dy, shapeFrom.get(), shapeTo.get());
      });

    // Twice on empty board with the cursor or the hand: closer, and back home
    // from 2× on — the one-handed way to look at a detail and let it go again.
    const zoomTap = (p: Point) => {
      const cam = store().camera;
      if (cam.scale >= 2) store().setCamera(store().homeCamera());
      else store().zoomBy(2, p);
    };

    const tapped = (x: number, y: number) => {
      // A release a hair before the hold's timer fired: the menu already has it.
      if (hold.open) return;
      const t = store().tool;
      if (t === 'hand' || !editable()) {
        if (isDoubleTap('')) zoomTap({ x, y });
        return;
      }
      store().setRailOpen(false);
      const p = screenToBoard(x, y);
      if (t === 'text') {
        const id = store().addText(p);
        if (id) setEditingId(id);
      } else if (t === 'eraser') {
        store().eraseAt(p);
        store().commitErase();
      } else if (t === 'fill') {
        if (store().fillAt(p)) tick(haptics);
      } else if (t === 'shape') {
        // A tap with the shape tool picks the shape under it (or nothing).
        const hit = shapeAt(store().visibleElements(), p, 8 / store().camera.scale);
        store().select(hit?.id ?? null);
        if (hit) tick(haptics);
        // Selecting something is asking to change it: the options come up.
        store().setRailOpen(!!hit);
      } else if (t === 'select') {
        const found = store().elementAt(p, 8 / store().camera.scale);
        store().select(found?.id ?? null);
        // What someone else holds is not picked up (`select` leaves it out).
        const hit = found && store().selectedIds.includes(found.id) ? found : null;
        if (hit) tick(haptics);
        store().setRailOpen(!!hit);
        // Twice on the same text or shape: type into it. Twice on nothing: zoom.
        const again = isDoubleTap(hit?.id ?? '');
        if (again && hit && (hit.kind === 'text' || hit.kind === 'shape')) setEditingId(hit.id);
        else if (again && !found) zoomTap({ x, y });
      }
      onCursorMove?.(p);
    };
    const tap = Gesture.Tap().onEnd((e, success) => {
      'worklet';
      if (success) scheduleOnRN(tapped, e.x, e.y);
    });

    // The camera is moved on the UI thread: these gestures write `camera` (the
    // shared value the canvas transform, the selection overlay and the peers'
    // cursors all follow) and touch neither React nor the JS thread while the
    // fingers are down. The store gets the camera once, when they lift.
    // Both work from the per-frame delta rather than from a snapshot of where
    // the gesture started. That keeps them stateless, and it means pinch and
    // two-finger pan compose correctly while running together.
    const panCamera = Gesture.Pan()
      .minPointers(2)
      .onChange((e) => {
        'worklet';
        const c = camera.get();
        camera.set({ x: c.x + e.changeX, y: c.y + e.changeY, scale: c.scale });
      })
      .onFinalize(() => {
        'worklet';
        scheduleOnRN(commitCamera, camera.get());
      });

    const pinch = Gesture.Pinch()
      .onChange((e) => {
        'worklet';
        const c = camera.get();
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, c.scale * e.scaleChange));
        // Hold the point under the fingers still: convert the focal point to
        // board space at the old zoom, then re-place it at the new one.
        const bx = (e.focalX - c.x) / c.scale;
        const by = (e.focalY - c.y) / c.scale;
        camera.set({ scale: next, x: e.focalX - bx * next, y: e.focalY - by * next });
      })
      .onFinalize(() => {
        'worklet';
        scheduleOnRN(commitCamera, camera.get());
      });

    // One finger moves the camera only for the hand tool and for anyone who
    // has no tools — the one gesture the board still owes a viewer.
    const handPan = Gesture.Pan()
      .maxPointers(1)
      .onChange((e) => {
        'worklet';
        const c = camera.get();
        camera.set({ x: c.x + e.changeX, y: c.y + e.changeY, scale: c.scale });
      })
      .onFinalize(() => {
        'worklet';
        scheduleOnRN(commitCamera, camera.get());
      });

    // The pen draws on the UI thread: each sample appends to `pen` and the
    // live path follows, with no JS and no React per touch sample. The JS side
    // is three calls — start, the finger moving on from a figure, and the end.
    const penGesture = Gesture.Pan()
      // Palm rejection: a second finger belongs to the camera, never the tool.
      .maxPointers(1)
      .onBegin((e) => {
        'worklet';
        penDown.set({ x: e.x, y: e.y });
      })
      .onStart((e) => {
        'worklet';
        // Where the finger landed, as the draw gesture always did: a pan
        // activates only after it has moved a little.
        const c = camera.get();
        const d = penDown.get();
        pen.set([(d.x - c.x) / c.scale, (d.y - c.y) / c.scale]);
        penAnchor.set({ x: e.x, y: e.y, at: nowMs() });
        penSketch.set(false);
        penLast.set({ x: (d.x - c.x) / c.scale, y: (d.y - c.y) / c.scale });
        scheduleOnRN(penStarted);
      })
      .onUpdate((e) => {
        'worklet';
        const c = camera.get();
        const x = (e.x - c.x) / c.scale;
        const y = (e.y - c.y) / c.scale;
        penLast.set({ x, y });
        if (penSketch.get()) {
          // A figure has been made from the stroke: the pen now sizes it.
          scheduleOnRN(figureMoved, x, y);
          return;
        }
        const a = penAnchor.get();
        if (Math.hypot(e.x - a.x, e.y - a.y) > STILL_PX) {
          penAnchor.set({ x: e.x, y: e.y, at: nowMs() });
        }
        if (pen.get().length / 2 < MAX_STROKE_POINTS) {
          pen.modify((pts) => {
            'worklet';
            pts.push(x, y);
            return pts;
          });
        }
        const now = nowMs();
        if (onCursorMove && now - penCursorAt.get() >= REALTIME.cursorThrottleMs) {
          penCursorAt.set(now);
          scheduleOnRN(onCursorMove, { x, y });
        }
      })
      .onEnd((_e, success) => {
        'worklet';
        scheduleOnRN(penEnded, pen.get(), success);
      });

    // Who owns a one-finger touch is decided by the tool: a pan for the hand
    // and for viewers, the pen's own gesture, or the draw gesture (every other
    // tool). Only that one is built, so nothing waits on a gesture that is off.
    const primary = panOnly ? handPan : penOn ? penGesture : drawGesture;
    return Gesture.Simultaneous(pinch, panCamera, Gesture.Exclusive(primary, tap));
  }, [
    onCursorMove,
    haptics,
    panOnly,
    penOn,
    camera,
    pen,
    penAnchor,
    penDown,
    penSketch,
    penLast,
    penCursorAt,
    uiShape,
    drag,
    dragDown,
    moveLive,
    followLive,
    shapeFrom,
    shapeTo,
    shapeLive,
  ]);

  const editing = editingId ? elements[editingId] : null;
  // Connection points show whenever an arrow could land on them.
  const anchors =
    (tool === 'shape' && config.shape === 'arrow') ||
    (selectedShape && selectedShape.shape === 'arrow');

  return (
    <View style={{ flex: 1, backgroundColor: c.background }} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Canvas ref={canvasRef} style={{ flex: 1 }}>
          <Group layer={blur ? <Paint><Blur blur={blur} /></Paint> : undefined}>
          {/* Outside the camera group: the grid is spaced in screen pixels, so
              it stays crisp instead of being scaled with the drawing. */}
          <GridLayer width={size.width} height={size.height} camera={camera} />

          <Group transform={transform}>
            {list.map((el) =>
              held.has(el.id) || erasing.has(el.id) ? (
                // Someone else holds it (dimmed, framed in their colour below),
                // or the eraser is about to take it (fainter).
                <Group key={el.id} opacity={erasing.has(el.id) ? ERASING_ALPHA : HELD_ALPHA}>
                  <ElementRenderer el={el} smooth={smooth} dark={dark} />
                </Group>
              ) : (
                <ElementRenderer
                  key={el.id}
                  el={el}
                  smooth={smooth}
                  dark={dark}
                  shift={movingIds?.has(el.id) ? dragTransform : undefined}
                />
              ),
            )}

            {liveSketch ? (
              <ElementRenderer
                dark={dark}
                el={sketchElement(liveSketch, config, {
                  id: 'live-sketch',
                  createdBy: 'local',
                  createdAt: 0,
                  updatedAt: 0,
                  z: Number.MAX_SAFE_INTEGER,
                })}
              />
            ) : tool === 'pen' ? (
              <LiveStroke
                points={pen}
                color={dark ? inkFor(config.color, true) : config.color}
                width={config.width}
                smooth={smooth}
              />
            ) : null}

            {liveShape ? (
              <ElementRenderer
                dark={dark}
                el={{
                  id: 'live-shape',
                  kind: 'shape',
                  shape: config.shape,
                  from: liveShape.from,
                  to: liveShape.to,
                  stroke: config.color,
                  strokeWidth: config.width,
                  fill: fillWith(config.fillColor ?? config.color, config.fillOpacity),
                  dash: config.dash,
                  createdBy: 'local',
                  createdAt: 0,
                  updatedAt: 0,
                  z: Number.MAX_SAFE_INTEGER,
                }}
              />
            ) : null}

            {uiShape ? (
              <LiveBoxShape
                from={shapeFrom}
                to={shapeTo}
                active={shapeLive}
                shape={config.shape}
                sides={config.sides}
                stroke={dark ? inkFor(config.color, true) : config.color}
                strokeWidth={config.width}
                fill={liveFill}
                rounded={config.rounded}
              />
            ) : null}

            {selected.length || liveMarquee || anchors || held.size ? (
              <ScreenOverlays
                shift={movingIds ? dragTransform : undefined}
                selected={selected}
                marquee={liveMarquee}
                anchors={anchors ? list : null}
                held={held}
                elements={list}
              />
            ) : null}
          </Group>
          </Group>
        </Canvas>
      </GestureDetector>

      <PeerCursors camera={camera} />
      <HeldTags elements={list} held={held} camera={camera} />

      {selectedShape && !editing && !liveEdit ? (
        <LabelButton
          camera={camera}
          shape={selectedShape}
          label={t.text}
          onPress={() => setEditingId(selectedShape.id)}
        />
      ) : null}

      {menu ? (
        <HoldMenu spot={menu} width={size.width} height={size.height} onClose={() => setMenu(null)} />
      ) : null}

      {editing && (editing.kind === 'text' || editing.kind === 'shape') ? (
        <TextEditorOverlay
          element={editing}
          onDraft={setDraft}
          onClose={() => {
            // A new text that kept its words comes up selected, with the cursor.
            const { tool: t, elements: all, finishCreate } = useBoardStore.getState();
            const done = all[editing.id];
            if (t === 'text' && done?.kind === 'text' && !done.deleted && done.text) finishCreate([done.id]);
            setEditingId(null);
            setDraft(null);
          }}
        />
      ) : null}
    </View>
  );
}

/** Split out so toggling the grid off does not re-render the element list. */
function GridLayer({
  width,
  height,
  camera,
}: {
  width: number;
  height: number;
  camera: SharedValue<Camera>;
}) {
  const grid = useSessionStore((s) => s.settings.grid);
  if (!grid) return null;
  return <LiveDotGrid width={width} height={height} camera={camera} />;
}

/**
 * The selection frame, the rubber band and the connection points, drawn with
 * the board (inside the camera's group): they follow a pan or a pinch on the
 * UI thread, and a move through `shift`. Mounted only while one of them shows.
 */
function ScreenOverlays({
  shift,
  selected,
  marquee,
  anchors,
  held,
  elements,
}: {
  /** While the selection is carried: its offset, which its frame follows. */
  shift?: DerivedValue<Transforms3d>;
  selected: BoardElement[];
  marquee: { from: Point; to: Point } | null;
  anchors: BoardElement[] | null;
  /** What others hold, framed in their colour. */
  held: ReadonlyMap<string, Participant>;
  elements: BoardElement[];
}) {
  const scale = useBoardStore((s) => s.camera.scale);
  return (
    <>
      {held.size
        ? elements.map((el) => {
            const who = held.get(el.id);
            if (!who) return null;
            const turns = canRotate(el);
            return (
              <DashedBox
                key={`held-${el.id}`}
                b={turns ? boxOf(el) : elementBounds(el)}
                scale={scale}
                angle={turns ? rotationOf(el) : 0}
                color={who.color}
              />
            );
          })
        : null}
      {selected.length ? (
        <Group transform={shift}>
          <SelectionFrame elements={selected} scale={scale} />
        </Group>
      ) : null}
      {marquee ? <DashedBox b={shapeBounds(marquee)} scale={scale} /> : null}
      {anchors ? <Anchors elements={anchors} scale={scale} /> : null}
    </>
  );
}

/** The label button, floating just above the selected shape; follows the camera on the UI thread. */
function LabelButton({
  shape,
  label,
  camera,
  onPress,
}: {
  shape: ShapeElement;
  label: string;
  camera: SharedValue<Camera>;
  onPress: () => void;
}) {
  const c = useColors();
  const b = shapeBounds(shape);
  const at = { x: b.x + b.width / 2, y: b.y };
  const follow = useAnimatedStyle(() => {
    const { x, y, scale } = camera.get();
    return {
      transform: [{ translateX: at.x * scale + x - 24 }, { translateY: at.y * scale + y - 46 }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, follow]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          paddingHorizontal: 11,
          paddingVertical: 5,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: c.accent,
          backgroundColor: c.surface,
          ...Shadow.panel,
        }}
      >
        <Txt weight="extrabold" size={12} tone="accent">
          Aa
        </Txt>
      </Pressable>
    </Animated.View>
  );
}
