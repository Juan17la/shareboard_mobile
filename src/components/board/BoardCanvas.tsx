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
 */
import { Blur, Canvas, Group, Paint, type CanvasRef } from '@shopify/react-native-skia';
import { useCallback, useMemo, useState, type RefObject } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Shadow } from '@/constants/theme';
import {
  bendFromDrag,
  bendHandleOf,
  elementsIn,
  handlesOf,
  isLineLike,
  linkEndpoints,
  resizeElement,
  shapeAt,
  shapeBounds,
  simplify,
} from '@/features/board/geometry';
import type { BoardElement, Link, Point, ShapeElement } from '@/features/board/model';
import { visibleSorted } from '@/features/board/ops';
import { MAX_ZOOM, MIN_ZOOM, editPatches, fillFor, useBoardStore, type LiveEdit } from '@/features/board/store';
import { useT } from '@/features/i18n/store';
import { useSessionStore, useColors } from '@/features/session/store';
import { tick } from '@/utils/haptics';

import { Anchors, DashedBox, DotGrid, ElementRenderer, SelectionFrame } from './ElementRenderer';
import { PeerCursors } from './PeerCursors';
import { TextEditorOverlay } from './TextEditorOverlay';
import { Txt } from '../ui/Text';

function screenToBoard(x: number, y: number): Point {
  const { camera } = useBoardStore.getState();
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
  const next = resizeElement(el, edit.handle, p) as Partial<ShapeElement>;
  if (el.kind === 'shape' && isLineLike(el) && next.from && next.to)
    return snapLine(el.shape, next.from, next.to);
  return next;
}

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
  const camera = useBoardStore((s) => s.camera);
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
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sorted once per change to the elements, not once per finger move: the
  // drag preview below only patches the sorted list.
  const sorted = useMemo(() => visibleSorted(elements), [elements]);
  const list = useMemo(() => {
    if (!liveEdit) return sorted;
    // The same patches the lift will commit, so the preview is the result.
    const patches = new Map(editPatches(sorted, liveEdit).map((p) => [p.id, p.patch]));
    return sorted.map((el) =>
      patches.has(el.id) ? ({ ...el, ...patches.get(el.id) } as BoardElement) : el,
    );
  }, [sorted, liveEdit]);

  const selecting = tool === 'select' || tool === 'shape';
  const selected = useMemo(
    () => (selecting ? list.filter((e) => selectedIds.includes(e.id)) : []),
    [list, selectedIds, selecting],
  );
  const selectedShape = selected.length === 1 && selected[0].kind === 'shape' ? selected[0] : null;

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
      // to back" the selection sits hidden under another figure; a finger on
      // that figure must pick it, not move or resize the one behind.
      const top = store().elementAt(p, 6 / scale);
      if (top && !sel.some((el) => el.id === top.id) && top.z > Math.max(...sel.map((el) => el.z))) return false;
      const hitR = 18 / scale;
      const one = sel.length === 1 ? sel[0] : null;
      const fold = one?.kind === 'shape' ? bendHandleOf(one) : null;
      const onFold = fold ? Math.hypot(fold.x - p.x, fold.y - p.y) <= hitR : false;
      const handle = onFold
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
      })
      .onChange((e) => {
        if (!panning()) return;
        const c = store().camera;
        store().setCamera({ ...c, x: c.x + e.changeX, y: c.y + e.changeY });
      })
      .onStart((e) => {
        if (panning() || !editable()) return;
        // Drawing is what the options were for; fold them away to give the
        // board back its width the moment the gesture starts.
        store().setRailOpen(false);
        const p = screenToBoard(down.x, down.y);
        const t = store().tool;
        if (t === 'eraser') store().eraseAt(p);
        else if (t === 'pen') store().setLiveStroke([p.x, p.y]);
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
        if (panning() || !editable()) return;
        const p = screenToBoard(e.x, e.y);
        const t = store().tool;
        if (t === 'eraser') store().eraseAt(p);
        else if (t === 'pen') store().setLiveStroke([...store().liveStroke, p.x, p.y]);
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
        if (!success) {
          // Cancelled — a second finger turned it into a pinch. Nothing the
          // first finger started is kept: a zoom must never move a figure.
          store().setLiveEdit(null);
          store().setLiveMarquee(null);
          store().setLiveStroke([]);
          store().setLiveShape(null);
          return;
        }
        // Read from the store, not through a `setState` updater: an updater
        // runs during the next render, and a store write from there is React's
        // "cannot update a component while rendering a different component".
        const { tool: t, liveStroke: pts, liveShape: shape, liveEdit: edit, liveMarquee: box } = store();
        if (t === 'pen' && pts.length >= 4) store().addStroke(simplify(pts));
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
          const hit = store().elementAt(p, 8 / store().camera.scale);
          store().select(hit?.id ?? null);
          if (hit) tick(haptics);
          store().setRailOpen(!!hit);
          // Twice on the same text or shape: type into it. Twice on nothing: zoom.
          const again = isDoubleTap(hit?.id ?? '');
          if (again && hit && (hit.kind === 'text' || hit.kind === 'shape')) setEditingId(hit.id);
          else if (again && !hit) zoomTap({ x: e.x, y: e.y });
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

  // The label button floats just above the selected shape.
  const labelAt = useMemo(() => {
    if (!selectedShape) return null;
    const b = shapeBounds(selectedShape);
    return {
      x: (b.x + b.width / 2) * camera.scale + camera.x,
      y: b.y * camera.scale + camera.y,
    };
  }, [selectedShape, camera]);

  const transform = [{ translateX: camera.x }, { translateY: camera.y }, { scale: camera.scale }];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Canvas ref={canvasRef} style={{ flex: 1 }}>
          <Group layer={blur ? <Paint><Blur blur={blur} /></Paint> : undefined}>
          {/* Outside the camera group: the grid is spaced in screen pixels, so
              it stays crisp instead of being scaled with the drawing. */}
          <GridLayer width={size.width} height={size.height} camera={camera} />

          <Group transform={transform}>
            {list.map((el) => (
              <ElementRenderer key={el.id} el={el} smooth={smooth} dark={dark} />
            ))}

            {livePoints.length >= 4 ? (
              <ElementRenderer
                smooth={smooth}
                dark={dark}
                el={{
                  id: 'live-stroke',
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

          {selected.length ? <SelectionFrame elements={selected} camera={camera} /> : null}
          {liveMarquee ? <DashedBox b={shapeBounds(liveMarquee)} camera={camera} /> : null}
          {/* Connection points show whenever a line or arrow could land on them. */}
          {(tool === 'shape' && (config.shape === 'line' || config.shape === 'arrow')) ||
          (selectedShape && isLineLike(selectedShape)) ? (
            <Anchors elements={list} camera={camera} />
          ) : null}
          </Group>
        </Canvas>
      </GestureDetector>

      <PeerCursors camera={camera} />

      {labelAt && selectedShape && !editing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.text}
          onPress={() => setEditingId(selectedShape.id)}
          style={{
            position: 'absolute',
            left: labelAt.x - 24,
            top: labelAt.y - 46,
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
      ) : null}

      {editing && (editing.kind === 'text' || editing.kind === 'shape') ? (
        <TextEditorOverlay element={editing} camera={camera} onClose={() => setEditingId(null)} />
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
  camera: { x: number; y: number; scale: number };
}) {
  const grid = useSessionStore((s) => s.settings.grid);
  if (!grid) return null;
  return <DotGrid width={width} height={height} camera={camera} />;
}
