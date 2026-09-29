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
import { Blur, Canvas, Group, Paint, type CanvasRef } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { Shadow } from '@/constants/theme';
import {
  bendFromDrag,
  bendHandleOf,
  boxOf,
  canRotate,
  elementBounds,
  elementsIn,
  handlesOf,
  isLineLike,
  linkEndpoints,
  recognizeSketch,
  resizeElement,
  rotateHandleOf,
  rotationOf,
  rotationFromDrag,
  ROTATE_HANDLE,
  shapeAt,
  shapeBounds,
  simplify,
} from '@/features/board/geometry';
import type { BoardElement, Link, Participant, Point, ShapeElement } from '@/features/board/model';
import { visibleSorted } from '@/features/board/ops';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  coveringFigure,
  editPatches,
  fillFor,
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
  LIVE_STROKE,
  HELD_ALPHA,
  LiveDotGrid,
  SelectionFrame,
} from './ElementRenderer';
import { HeldTags, PeerCursors } from './PeerCursors';
import { TextEditorOverlay } from './TextEditorOverlay';
import { GlassPanel } from '../ui/Glass';
import { Icon } from '../ui/Icon';
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

/** A line's ends bind to the shapes they land on; other shapes pass through. */
function snapLine(shape: string, from: Point, to: Point): Ends {
  if (shape !== 'line' && shape !== 'arrow') return { from, to };
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

/** The patch of an edit dragged to `p`. A line's ends are re-bound after. */
function dragPatch(edit: LiveEdit, el: BoardElement, p: Point): Partial<BoardElement> {
  if (edit.handle === BEND_HANDLE && el.kind === 'shape' && isLineLike(el)) {
    return { bend: bendFromDrag(el, p) };
  }
  if (edit.handle === ROTATE_HANDLE) return { rotation: rotationFromDrag(el, p) };
  const next = resizeElement(el, edit.handle, p) as Partial<ShapeElement>;
  if (el.kind === 'shape' && isLineLike(el) && next.from && next.to)
    return snapLine(el.shape, next.from, next.to);
  return next;
}

/** How long a finger holds still on empty board, with the cursor, before the paste menu opens. */
const HOLD_MS = 500;
/** How long a pen stroke's end is held before it is read as a figure (`recognizeSketch`). */
const SKETCH_MS = 800;
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
  const livePoints = useBoardStore((s) => s.liveStroke);
  const liveShape = useBoardStore((s) => s.liveShape);
  const liveSketch = useBoardStore((s) => s.liveSketch);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** What is being typed: painted in place by the canvas, so the editor only holds the caret. */
  const [draft, setDraft] = useState<string | null>(null);
  /** The hold menu: where it opened on screen, and the board point a paste lands on. */
  const [menu, setMenu] = useState<{ x: number; y: number; at: Point } | null>(null);
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
  const sorted = useMemo(() => visibleSorted(elements), [elements]);
  const list = useMemo(() => {
    if (editingId && draft !== null) {
      return sorted.map((el) => (el.id === editingId ? ({ ...el, text: draft } as BoardElement) : el));
    }
    if (!liveEdit) return sorted;
    // The same patches the lift will commit, so the preview is the result.
    const patches = new Map(editPatches(sorted, liveEdit).map((p) => [p.id, p.patch]));
    return sorted.map((el) =>
      patches.has(el.id) ? ({ ...el, ...patches.get(el.id) } as BoardElement) : el,
    );
  }, [sorted, liveEdit, editingId, draft]);

  // What the others hold: dimmed, framed in their colour, not for picking.
  const participants = useBoardStore((s) => s.participants);
  const you = useBoardStore((s) => s.you);
  const held = useMemo(() => heldByOthers(participants, you), [participants, you]);

  const selecting = tool === 'select' || tool === 'shape';
  const selected = useMemo(
    () => (selecting ? list.filter((e) => selectedIds.includes(e.id)) : []),
    [list, selectedIds, selecting],
  );
  const selectedShape = selected.length === 1 && selected[0].kind === 'shape' ? selected[0] : null;

  // The store's camera, on the UI thread.
  const camera = useSharedValue<Camera>(storeCamera());
  useEffect(() => {
    camera.set(storeCamera());
    return useBoardStore.subscribe((s, prev) => {
      if (s.camera !== prev.camera) camera.set(s.camera);
    });
  }, [camera]);
  const transform = useDerivedValue(() => {
    const { x, y, scale } = camera.get();
    return [{ translateX: x }, { translateY: y }, { scale }];
  });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    useBoardStore.getState().setViewport({ width, height });
  }, []);

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
      const fold = one?.kind === 'shape' ? bendHandleOf(one) : null;
      const onFold = fold ? Math.hypot(fold.x - p.x, fold.y - p.y) <= hitR : false;
      const knob = one ? rotateHandleOf(one, scale) : null;
      const onKnob = knob ? Math.hypot(knob.x - p.x, knob.y - p.y) <= hitR : false;
      const handle = onKnob
        ? ROTATE_HANDLE
        : onFold
          ? BEND_HANDLE
          : one
            ? handlesOf(one).findIndex((h) => Math.hypot(h.x - p.x, h.y - p.y) <= hitR)
            : -1;
      const onBody = !!store().elementAt(p, 6 / scale, sel);
      const mode = handle >= 0 ? 'resize' : onBody ? 'move' : null;
      if (!mode) return false;
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
    // A finger held still on empty board with the cursor opens the paste menu
    // there. A timer on this gesture rather than a long-press gesture of its
    // own: that one would have to fail before any drag could start, and a
    // hold on a figure followed by a drag must still move it. Once the menu
    // is open the rest of the touch is its, not the board's.
    const hold = { timer: null as ReturnType<typeof setTimeout> | null, open: false };
    const letGo = () => {
      if (hold.timer) clearTimeout(hold.timer);
      hold.timer = null;
    };
    // A pen stroke held still at its end for 800 ms becomes the figure it
    // was meant to be: it turns into it under the finger, and lifting draws
    // the figure instead. Moving on keeps drawing the stroke, as it was.
    const still = { x: 0, y: 0, timer: null as ReturnType<typeof setTimeout> | null };
    const stopSketch = () => {
      if (still.timer) clearTimeout(still.timer);
      still.timer = null;
    };
    const awaitSketch = (x: number, y: number) => {
      stopSketch();
      still.x = x;
      still.y = y;
      still.timer = setTimeout(() => {
        still.timer = null;
        const sketch = recognizeSketch(store().liveStroke, 24 / store().camera.scale);
        if (!sketch) return;
        store().setLiveSketch(sketch);
        tick(haptics);
      }, SKETCH_MS);
    };

    /** Drags the selection (or one of its handles) to `p`. */
    const moveEdit = (p: Point) => {
      const edit = store().liveEdit;
      if (!edit) return;
      if (edit.mode === 'move') {
        store().setLiveEdit({ ...edit, dx: p.x - edit.start.x, dy: p.y - edit.start.y });
      } else {
        store().setLiveEdit({ ...edit, patch: dragPatch(edit, store().elements[edit.ids[0]], p) });
      }
    };
    /** One undo step for the whole drag. */
    const finishEdit = () => {
      const edit = store().liveEdit;
      if (!edit) return;
      if (edit.dx || edit.dy || edit.patch) store().commitEdit(edit);
      store().setLiveEdit(null);
      // The drag is over and the selection is still there: its options come back.
      store().setRailOpen(true);
    };

    const draw = Gesture.Pan()
      // Palm rejection: a second finger belongs to the camera, never the tool.
      .maxPointers(1)
      .runOnJS(true)
      .onBegin((e) => {
        down.x = e.x;
        down.y = e.y;
        letGo();
        hold.open = false;
        if (store().tool !== 'select' || !editable()) return;
        hold.timer = setTimeout(() => {
          hold.timer = null;
          const p = screenToBoard(down.x, down.y);
          if (store().elementAt(p, 8 / store().camera.scale)) return;
          hold.open = true;
          tick(haptics);
          setMenu({ x: down.x, y: down.y, at: p });
        }, HOLD_MS);
      })
      .onFinalize(() => {
        letGo();
        stopSketch();
      })
      .onChange((e) => {
        if (!panning()) return;
        const c = store().camera;
        store().setCamera({ ...c, x: c.x + e.changeX, y: c.y + e.changeY });
      })
      .onStart((e) => {
        letGo();
        if (hold.open || panning() || !editable()) return;
        // Drawing is what the options were for; fold them away to give the
        // board back its width the moment the gesture starts.
        store().setRailOpen(false);
        const p = screenToBoard(down.x, down.y);
        const t = store().tool;
        if (t === 'eraser') store().eraseAt(p);
        else if (t === 'pen') {
          store().setLiveStroke([p.x, p.y]);
          awaitSketch(e.x, e.y);
        }
        else if (t === 'shape') {
          // The shapes tool only ever draws: moving and resizing belong to the
          // cursor. A press on a shape it had picked used to grab that shape
          // (or a handle 18pt around it) instead of starting the new one.
          // Drawing lets go of whatever was picked before: the new shape is
          // the focus, and it lands unselected (below).
          store().select(null);
          Object.assign(lineStart, p);
          store().setLiveShape(snapLine(store().config.shape, p, p));
        } else if (t === 'select' && !beginEdit(p)) {
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
        // A finger rarely lands perfectly still: the slightest movement makes
        // this a pan rather than a tap, and the one-shot tools must still fire.
        else if (t === 'text') {
          const id = store().addText(p);
          if (id) setEditingId(id);
        } else if (t === 'fill') {
          if (store().fillAt(p)) tick(haptics);
        }
        onCursorMove?.(p);
      })
      .onUpdate((e) => {
        if (hold.open || panning() || !editable()) return;
        const p = screenToBoard(e.x, e.y);
        const t = store().tool;
        if (t === 'eraser') store().eraseAt(p);
        else if (t === 'pen') {
          if (Math.hypot(e.x - still.x, e.y - still.y) > STILL_PX) {
            if (store().liveSketch) store().setLiveSketch(null);
            awaitSketch(e.x, e.y);
          }
          store().setLiveStroke([...store().liveStroke, p.x, p.y]);
        }
        else if (t === 'shape' || t === 'select') {
          const box = store().liveMarquee;
          if (store().liveEdit) moveEdit(p);
          else if (box) store().setLiveMarquee({ from: box.from, to: p });
          else if (store().liveShape) {
            store().setLiveShape(snapLine(store().config.shape, lineStart, p));
          }
        }
        onCursorMove?.(p);
      })
      .onEnd((_e, success) => {
        if (hold.open) return;
        if (!success) {
          // Cancelled — a second finger turned it into a pinch. Nothing the
          // first finger started is kept: a zoom must never move a figure.
          store().setLiveEdit(null);
          store().setLiveMarquee(null);
          store().setLiveStroke([]);
          store().setLiveShape(null);
          store().setLiveSketch(null);
          return;
        }
        // Read from the store, not through a `setState` updater: an updater
        // runs during the next render, and a store write from there is React's
        // "cannot update a component while rendering a different component".
        const { tool: t, liveStroke: pts, liveShape: shape, liveEdit: edit, liveMarquee: box } = store();
        const sketch = store().liveSketch;
        if (t === 'pen' && sketch) store().addSketch(sketch);
        else if (t === 'pen' && pts.length >= 4) store().addStroke(simplify(pts));
        store().setLiveSketch(null);
        if (edit) {
          finishEdit();
        } else if (box) {
          const ids = elementsIn(store().visibleElements(), shapeBounds(box)).map((el) => el.id);
          store().select(ids);
          // Selecting something is asking to change it: the options come up.
          store().setRailOpen(ids.length > 0);
          store().setLiveMarquee(null);
        } else if (t === 'shape' && shape) {
          // A tap with the shape tool is a mis-hit, not a zero-size rectangle.
          // Measured in screen pixels, like web: a board-space threshold made a
          // small shape drawn while zoomed in read as a mis-tap and vanish
          // instead of landing selected.
          const dragged = Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
          // A new shape lands bare — no handles, no options — so the next one
          // can be drawn straight away. A tap on it picks it (see `tap`).
          if (dragged * store().camera.scale > 6) store().addShape(store().config.shape, shape);
        }
        store().setLiveStroke([]);
        store().setLiveShape(null);
      });

    // Twice on empty board with the cursor or the hand: closer, and back home
    // from 2× on — the one-handed way to look at a detail and let it go again.
    const zoomTap = (p: Point) => {
      const cam = store().camera;
      if (cam.scale >= 2) store().setCamera(store().homeCamera());
      else store().zoomBy(2, p);
    };

    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => {
        // A release a hair before the hold's timer fired: the menu already has it.
        if (hold.open) return;
        const t = store().tool;
        if (t === 'hand' || !editable()) {
          if (isDoubleTap('')) zoomTap({ x: e.x, y: e.y });
          return;
        }
        store().setRailOpen(false);
        const p = screenToBoard(e.x, e.y);
        if (t === 'text') {
          const id = store().addText(p);
          if (id) setEditingId(id);
        } else if (t === 'eraser') {
          store().eraseAt(p);
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
          else if (again && !found) zoomTap({ x: e.x, y: e.y });
        }
        onCursorMove?.(p);
      });

    // Both camera gestures work from the per-frame delta rather than from a
    // snapshot of where the gesture started. That keeps them stateless, and it
    // means pinch and two-finger pan compose correctly while running together.
    const panCamera = Gesture.Pan()
      .minPointers(2)
      .runOnJS(true)
      .onChange((e) => {
        const c = store().camera;
        store().setCamera({ ...c, x: c.x + e.changeX, y: c.y + e.changeY });
      });

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onChange((e) => {
        const c = store().camera;
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, c.scale * e.scaleChange));
        // Hold the point under the fingers still: convert the focal point to
        // board space at the old zoom, then re-place it at the new one.
        const bx = (e.focalX - c.x) / c.scale;
        const by = (e.focalY - c.y) / c.scale;
        store().setCamera({
          scale: next,
          x: e.focalX - bx * next,
          y: e.focalY - by * next,
        });
      });

    return Gesture.Simultaneous(pinch, panCamera, Gesture.Exclusive(draw, tap));
  }, [onCursorMove, haptics]);

  const editing = editingId ? elements[editingId] : null;
  // Connection points show whenever a line or arrow could land on them.
  const anchors =
    (tool === 'shape' && (config.shape === 'line' || config.shape === 'arrow')) ||
    (selectedShape && isLineLike(selectedShape));

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
              held.has(el.id) ? (
                // Someone else holds it: dimmed, framed in their colour below.
                <Group key={el.id} opacity={HELD_ALPHA}>
                  <ElementRenderer el={el} smooth={smooth} dark={dark} />
                </Group>
              ) : (
                <ElementRenderer key={el.id} el={el} smooth={smooth} dark={dark} />
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
            ) : livePoints.length >= 4 ? (
              <ElementRenderer
                smooth={smooth}
                dark={dark}
                el={{
                  id: LIVE_STROKE,
                  kind: 'stroke',
                  points: livePoints,
                  color: config.color,
                  width: config.width,
                  createdBy: 'local',
                  createdAt: 0,
                  updatedAt: 0,
                  z: Number.MAX_SAFE_INTEGER,
                }}
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
                  fill: fillFor(config.color, config.fill),
                  createdBy: 'local',
                  createdAt: 0,
                  updatedAt: 0,
                  z: Number.MAX_SAFE_INTEGER,
                }}
              />
            ) : null}
          </Group>

          {selected.length || liveMarquee || anchors || held.size ? (
            <ScreenOverlays
              selected={selected}
              marquee={liveMarquee}
              anchors={anchors ? list : null}
              held={held}
              elements={list}
            />
          ) : null}
          </Group>
        </Canvas>
      </GestureDetector>

      <PeerCursors />
      <HeldTags elements={list} held={held} />

      {selectedShape && !editing ? (
        <LabelButton
          shape={selectedShape}
          label={t.text}
          onPress={() => setEditingId(selectedShape.id)}
        />
      ) : null}

      {menu ? (
        <HoldMenu
          x={menu.x}
          y={menu.y}
          width={size.width}
          onPaste={() => {
            useBoardStore.getState().paste(menu.at);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      ) : null}

      {editing && (editing.kind === 'text' || editing.kind === 'shape') ? (
        <TextEditorOverlay
          element={editing}
          onDraft={setDraft}
          onClose={() => {
            setEditingId(null);
            setDraft(null);
          }}
        />
      ) : null}
    </View>
  );
}

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
const MENU_WIDTH = 140;
const ROW_HEIGHT = 44;

/**
 * What a hold on empty board offers: paste, of whatever was copied or cut,
 * centred where the finger was. Greyed out while there is nothing to paste.
 * It floats just above the finger, so the hand does not hide it; a tap
 * anywhere else closes it.
 */
function HoldMenu({
  x,
  y,
  width,
  onPaste,
  onClose,
}: {
  x: number;
  y: number;
  width: number;
  onPaste: () => void;
  onClose: () => void;
}) {
  const c = useColors();
  const t = useT();
  const ready = useBoardStore((s) => s.clipboard.length > 0);
  const left = Math.max(8, Math.min(x - MENU_WIDTH / 2, width - MENU_WIDTH - 8));
  const above = y - ROW_HEIGHT - 28;
  return (
    <View style={FILL}>
      <Pressable
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        onPress={onClose}
        style={FILL}
      />
      <GlassPanel
        level="panel"
        radius={14}
        style={{ position: 'absolute', left, top: above >= 8 ? above : y + 28, width: MENU_WIDTH, ...Shadow.panel }}
      >
        <Pressable
          accessibilityRole="menuitem"
          accessibilityLabel={t.paste}
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          onPress={onPaste}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            height: ROW_HEIGHT,
            paddingHorizontal: 14,
            opacity: ready ? 1 : 0.4,
            backgroundColor: pressed ? c.surfaceSelected : 'transparent',
          })}
        >
          <Icon name="paste" size={18} color={c.text} />
          <Txt weight="bold" size={14}>
            {t.paste}
          </Txt>
        </Pressable>
      </GlassPanel>
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
 * The selection frame, the rubber band and the connection points: drawn in
 * screen space, so they follow the camera from React. Mounted only while one
 * of them shows — a render in here re-records the whole canvas, and with
 * nothing to show a pan should not cost that.
 */
function ScreenOverlays({
  selected,
  marquee,
  anchors,
  held,
  elements,
}: {
  selected: BoardElement[];
  marquee: { from: Point; to: Point } | null;
  anchors: BoardElement[] | null;
  /** What others hold, framed in their colour. */
  held: ReadonlyMap<string, Participant>;
  elements: BoardElement[];
}) {
  const camera = useBoardStore((s) => s.camera);
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
                camera={camera}
                angle={turns ? rotationOf(el) : 0}
                color={who.color}
              />
            );
          })
        : null}
      {selected.length ? <SelectionFrame elements={selected} camera={camera} /> : null}
      {marquee ? <DashedBox b={shapeBounds(marquee)} camera={camera} /> : null}
      {anchors ? <Anchors elements={anchors} camera={camera} /> : null}
    </>
  );
}

/** The label button, floating just above the selected shape. */
function LabelButton({
  shape,
  label,
  onPress,
}: {
  shape: ShapeElement;
  label: string;
  onPress: () => void;
}) {
  const c = useColors();
  const camera = useBoardStore((s) => s.camera);
  const b = shapeBounds(shape);
  const x = (b.x + b.width / 2) * camera.scale + camera.x;
  const y = b.y * camera.scale + camera.y;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        position: 'absolute',
        left: x - 24,
        top: y - 46,
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
  );
}
