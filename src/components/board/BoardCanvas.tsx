/**
 * The board itself: an infinite white canvas, the dot grid, everything drawn on
 * it, and the gestures that draw and move it.
 *
 * One finger is always the active tool and two fingers are always the camera —
 * the split the design relies on and the reason drawing never fights panning.
 * The camera lives in the store but never on the wire: pan and zoom are
 * per-device (docs/05-model-date).
 */
import { Canvas, Group } from '@shopify/react-native-skia';
import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { simplify } from '@/features/board/geometry';
import type { Point } from '@/features/board/model';
import { visibleSorted } from '@/features/board/ops';
import { fillFor, useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import { tick } from '@/utils/haptics';

import { DotGrid, ElementRenderer } from './ElementRenderer';
import { PeerCursors } from './PeerCursors';
import { TextEditorOverlay } from './TextEditorOverlay';

/** Zoom bounds. Matches the design's 25%–600% range. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6;

function screenToBoard(x: number, y: number): Point {
  const { camera } = useBoardStore.getState();
  return { x: (x - camera.x) / camera.scale, y: (y - camera.y) / camera.scale };
}

export function BoardCanvas({ onCursorMove }: { onCursorMove?: (at: Point) => void }) {
  const camera = useBoardStore((s) => s.camera);
  const config = useBoardStore((s) => s.config);
  const elements = useBoardStore((s) => s.elements);
  const smooth = useSessionStore((s) => s.settings.smooth);
  const haptics = useSessionStore((s) => s.settings.haptics);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [livePoints, setLivePoints] = useState<number[]>([]);
  const [liveShape, setLiveShape] = useState<{ from: Point; to: Point } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useMemo(() => visibleSorted(elements), [elements]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const gesture = useMemo(() => {
    const store = () => useBoardStore.getState();

    const draw = Gesture.Pan()
      // Palm rejection: a second finger belongs to the camera, never the tool.
      .maxPointers(1)
      .runOnJS(true)
      .onStart((e) => {
        const p = screenToBoard(e.x, e.y);
        const t = store().tool;
        if (t === 'eraser') store().eraseAt(p);
        else if (t === 'pen') setLivePoints([p.x, p.y]);
        else if (t === 'shape') setLiveShape({ from: p, to: p });
        onCursorMove?.(p);
      })
      .onUpdate((e) => {
        const p = screenToBoard(e.x, e.y);
        const t = store().tool;
        if (t === 'eraser') store().eraseAt(p);
        else if (t === 'pen') setLivePoints((prev) => [...prev, p.x, p.y]);
        else if (t === 'shape') setLiveShape((prev) => (prev ? { from: prev.from, to: p } : prev));
        onCursorMove?.(p);
      })
      .onEnd(() => {
        const t = store().tool;
        setLivePoints((pts) => {
          if (t === 'pen' && pts.length >= 4) store().addStroke(simplify(pts));
          return [];
        });
        setLiveShape((shape) => {
          if (!shape || t !== 'shape') return null;
          // A tap with the shape tool is a mis-hit, not a zero-size rectangle.
          const dragged = Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
          if (dragged > 6) store().addShape(store().config.shape, shape.from, shape.to);
          return null;
        });
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => {
        const p = screenToBoard(e.x, e.y);
        const t = store().tool;
        if (t === 'text') {
          const id = store().addText(p);
          if (id) setEditingId(id);
        } else if (t === 'eraser') {
          store().eraseAt(p);
        } else if (t === 'fill') {
          if (store().fillAt(p)) tick(haptics);
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
  const transform = [
    { translateX: camera.x },
    { translateY: camera.y },
    { scale: camera.scale },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ flex: 1 }}>
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
        </Canvas>
      </GestureDetector>

      <PeerCursors camera={camera} />

      {editing && editing.kind === 'text' ? (
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
