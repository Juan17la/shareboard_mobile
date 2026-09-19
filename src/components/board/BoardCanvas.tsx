/**
 * The board itself: an infinite white canvas, the dot grid, everything drawn on
 * it, and the gestures that draw and move it.
 *
 * One finger is always the active tool and two fingers are always the camera —
 * the split the design relies on and the reason drawing never fights panning.
 * The hand tool, and a viewer with no tools at all, get one-finger panning.
 * The camera lives in the store but never on the wire: pan and zoom are
 * per-device (docs/05-model-date).
 */
import { Canvas, Group, type CanvasRef } from '@shopify/react-native-skia';
import { useCallback, useMemo, useState, type RefObject } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Colors, Shadow } from '@/constants/theme';
import {
  isLineLike,
  resizeShape,
  shapeAt,
  shapeBounds,
  shapeHandles,
  simplify,
  linkEndpoints,
} from '@/features/board/geometry';
import type { Point, ShapeElement } from '@/features/board/model';
import { visibleSorted } from '@/features/board/ops';
import { fillFor, useBoardStore, type ShapeEdit } from '@/features/board/store';
import { useT } from '@/features/i18n/store';
import { useSessionStore } from '@/features/session/store';
import { tick } from '@/utils/haptics';

import { Anchors, DotGrid, ElementRenderer, SelectionFrame } from './ElementRenderer';
import { PeerCursors } from './PeerCursors';
import { TextEditorOverlay } from './TextEditorOverlay';
import { Txt } from '../ui/Text';

/** Zoom bounds. Matches the design's 25%–600% range. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6;

function screenToBoard(x: number, y: number): Point {
  const { camera } = useBoardStore.getState();
  return { x: (x - camera.x) / camera.scale, y: (y - camera.y) / camera.scale };
}

/** A line's ends link to the shapes they land in; other shapes pass through. */
function snapLine(shape: string, from: Point, to: Point): { from: Point; to: Point } {
  if (shape !== 'line' && shape !== 'arrow') return { from, to };
  const store = useBoardStore.getState();
  return linkEndpoints(store.visibleElements(), from, to, 18 / store.camera.scale);
}

/** `from`/`to` of an edit dragged to `p`. A line's ends are re-linked after. */
function dragShape(edit: ShapeEdit, base: ShapeElement, p: Point) {
  const el = { ...base, ...edit.origin };
  if (edit.mode === 'resize') {
    const next = resizeShape(el, edit.handle, p);
    return isLineLike(el) ? snapLine(el.shape, next.from, next.to) : next;
  }
  const dx = p.x - edit.start.x;
  const dy = p.y - edit.start.y;
  return {
    from: { x: el.from.x + dx, y: el.from.y + dy },
    to: { x: el.to.x + dx, y: el.to.y + dy },
  };
}

export function BoardCanvas({
  onCursorMove,
  canvasRef,
}: {
  onCursorMove?: (at: Point) => void;
  /** Handed out so the glass panels can snapshot the board (`useBoardMirror`). */
  canvasRef?: RefObject<CanvasRef | null>;
}) {
  const camera = useBoardStore((s) => s.camera);
  const tool = useBoardStore((s) => s.tool);
  const config = useBoardStore((s) => s.config);
  const elements = useBoardStore((s) => s.elements);
  const selectedId = useBoardStore((s) => s.selectedId);
  const liveEdit = useBoardStore((s) => s.liveEdit);
  const t = useT();
  const smooth = useSessionStore((s) => s.settings.smooth);
  const haptics = useSessionStore((s) => s.settings.haptics);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const livePoints = useBoardStore((s) => s.liveStroke);
  const liveShape = useBoardStore((s) => s.liveShape);
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useMemo(() => {
    const sorted = visibleSorted(elements);
    if (!liveEdit) return sorted;
    return sorted.map((el) =>
      el.id === liveEdit.id ? { ...el, from: liveEdit.from, to: liveEdit.to } : el,
    );
  }, [elements, liveEdit]);

  const selected = useMemo(() => {
    const el = selectedId ? list.find((e) => e.id === selectedId) : null;
    return el && el.kind === 'shape' && tool === 'shape' ? el : null;
  }, [list, selectedId, tool]);

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

    // With the shape tool, a finger landing on the selected shape drags it
    // rather than drawing: a handle reshapes, the body moves.
    const beginShapeEdit = (p: Point): boolean => {
      const el = store().selectedShape();
      if (!el) return false;
      const scale = store().camera.scale;
      const hitR = 18 / scale;
      const handle = shapeHandles(el).findIndex((h) => Math.hypot(h.x - p.x, h.y - p.y) <= hitR);
      const mode = handle >= 0 ? 'resize' : shapeAt([el], p, 6 / scale) ? 'move' : null;
      if (!mode) return false;
      store().setLiveEdit({
        id: el.id,
        mode,
        handle,
        start: p,
        origin: { from: el.from, to: el.to },
        from: el.from,
        to: el.to,
      });
      return true;
    };

    // One finger moves the camera for the hand tool, and for anyone who has
    // no tools — the one gesture the board still owes a viewer.
    const panning = () => store().tool === 'hand' || !store().canEditNow();
    // Where a line was started, unsnapped: its anchor can change as the end moves.
    const lineStart = { x: 0, y: 0 };

    const draw = Gesture.Pan()
      // Palm rejection: a second finger belongs to the camera, never the tool.
      .maxPointers(1)
      .runOnJS(true)
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
        const p = screenToBoard(e.x, e.y);
        const t = store().tool;
        if (t === 'eraser') store().eraseAt(p);
        else if (t === 'pen') store().setLiveStroke([p.x, p.y]);
        else if (t === 'shape' && !beginShapeEdit(p)) {
          Object.assign(lineStart, p);
          store().setLiveShape(snapLine(store().config.shape, p, p));
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
        else if (t === 'shape') {
          const edit = store().liveEdit;
          if (edit) {
            const base = store().elements[edit.id] as ShapeElement;
            store().setLiveEdit({ ...edit, ...dragShape(edit, base, p) });
          } else {
            if (store().liveShape) store().setLiveShape(snapLine(store().config.shape, lineStart, p));
          }
        }
        onCursorMove?.(p);
      })
      .onEnd(() => {
        // Read from the store, not through a `setState` updater: an updater
        // runs during the next render, and a store write from there is React's
        // "cannot update a component while rendering a different component".
        const { tool: t, liveStroke: pts, liveShape: shape, liveEdit: edit } = store();
        if (t === 'pen' && pts.length >= 4) store().addStroke(simplify(pts));
        if (t === 'shape' && edit) {
          // One op for the whole drag, so undo takes it back in one step.
          if (edit.from !== edit.origin.from || edit.to !== edit.origin.to) {
            store().updateShape(edit.id, { from: edit.from, to: edit.to });
          }
          store().setLiveEdit(null);
        } else if (t === 'shape' && shape) {
          // A tap with the shape tool is a mis-hit, not a zero-size rectangle.
          const dragged = Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
          // A new shape comes up selected, handles ready, so it can be sized
          // right away.
          if (dragged > 6) store().select(store().addShape(store().config.shape, shape.from, shape.to));
        }
        store().setLiveStroke([]);
        store().setLiveShape(null);
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => {
        if (!editable()) return;
        store().setRailOpen(false);
        const p = screenToBoard(e.x, e.y);
        const t = store().tool;
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
        store().setCamera({ scale: next, x: e.focalX - bx * next, y: e.focalY - by * next });
      });

    return Gesture.Simultaneous(pinch, panCamera, Gesture.Exclusive(draw, tap));
  }, [onCursorMove, haptics]);

  const editing = editingId ? elements[editingId] : null;

  // The label button floats just above the selected shape.
  const labelAt = useMemo(() => {
    if (!selected) return null;
    const b = shapeBounds(selected);
    return {
      x: (b.x + b.width / 2) * camera.scale + camera.x,
      y: b.y * camera.scale + camera.y,
    };
  }, [selected, camera]);

  const transform = [
    { translateX: camera.x },
    { translateY: camera.y },
    { scale: camera.scale },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Canvas ref={canvasRef} style={{ flex: 1 }}>
          {/* Outside the camera group: the grid is spaced in screen pixels, so
              it stays crisp instead of being scaled with the drawing. */}
          <GridLayer width={size.width} height={size.height} camera={camera} />

          <Group transform={transform}>
            {list.map((el) => (
              <ElementRenderer key={el.id} el={el} smooth={smooth} />
            ))}

            {livePoints.length >= 4 ? (
              <ElementRenderer
                smooth={smooth}
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
                el={{
                  id: 'live-shape',
                  kind: 'shape',
                  shape: config.shape,
                  from: liveShape.from,
                  to: liveShape.to,
                  stroke: config.color,
                  strokeWidth: config.width,
                  fill: config.filled ? fillFor(config.color) : null,
                  createdBy: 'local',
                  createdAt: 0,
                  updatedAt: 0,
                  z: Number.MAX_SAFE_INTEGER,
                }}
              />
            ) : null}
          </Group>

          {selected ? <SelectionFrame el={selected} camera={camera} /> : null}
          {/* Connection points show whenever a line or arrow could land on them. */}
          {tool === 'shape' && (config.shape === 'line' || config.shape === 'arrow') ? (
            <Anchors elements={list} camera={camera} />
          ) : null}
        </Canvas>
      </GestureDetector>

      <PeerCursors camera={camera} />

      {labelAt && selected && !editing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.text}
          onPress={() => setEditingId(selected.id)}
          style={{
            position: 'absolute',
            left: labelAt.x - 24,
            top: labelAt.y - 46,
            paddingHorizontal: 11,
            paddingVertical: 5,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: Colors.accent,
            backgroundColor: '#FFFFFF',
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
