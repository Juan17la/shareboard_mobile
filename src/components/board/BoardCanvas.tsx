import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { simplify, strokeToSvgPath } from '@/features/board/geometry';
import type { Point, ShapeKind } from '@/features/board/model';
import { visibleSorted } from '@/features/board/ops';
import { useBoardStore } from '@/features/board/store';

import { CursorDot, ElementRenderer } from './ElementRenderer';
import { TextEditorOverlay } from './TextEditorOverlay';

const DRAW_TOOLS = new Set(['pen', 'rectangle', 'ellipse', 'line', 'arrow']);

function screenToBoard(x: number, y: number): Point {
  const { camera } = useBoardStore.getState();
  return { x: (x - camera.x) / camera.scale, y: (y - camera.y) / camera.scale };
}

export function BoardCanvas({ onCursorMove }: { onCursorMove?: (at: Point) => void }) {
  const camera = useBoardStore((s) => s.camera);
  const tool = useBoardStore((s) => s.tool);
  const config = useBoardStore((s) => s.config);
  const elements = useBoardStore((s) => s.elements);
  const participants = useBoardStore((s) => s.participants);
  const you = useBoardStore((s) => s.you);

  const [livePoints, setLivePoints] = useState<number[]>([]);
  const [liveShape, setLiveShape] = useState<{ from: Point; to: Point } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useMemo(() => visibleSorted(elements), [elements]);

  // Camera snapshot captured at the start of a pan/pinch gesture.
  const startCam = useSharedValue({ x: 0, y: 0, scale: 1 });

  const gesture = useMemo(() => {
    const store = () => useBoardStore.getState();

    const draw = Gesture.Pan()
      .maxPointers(1)
      .runOnJS(true)
      .onStart((e) => {
        const p = screenToBoard(e.x, e.y);
        const t = store().tool;
        if (t === 'eraser') store().eraseAt(p);
        else if (t === 'pen') setLivePoints([p.x, p.y]);
        else if (DRAW_TOOLS.has(t)) setLiveShape({ from: p, to: p });
      })
      .onUpdate((e) => {
        const p = screenToBoard(e.x, e.y);
        const t = store().tool;
        if (t === 'eraser') store().eraseAt(p);
        else if (t === 'pen') setLivePoints((prev) => [...prev, p.x, p.y]);
        else setLiveShape((prev) => (prev ? { from: prev.from, to: p } : prev));
      })
      .onEnd(() => {
        const t = store().tool;
        setLivePoints((pts) => {
          if (t === 'pen' && pts.length >= 4) store().addStroke(simplify(pts));
          return [];
        });
        setLiveShape((shape) => {
          if (shape && DRAW_TOOLS.has(t)) store().addShape(t as ShapeKind, shape.from, shape.to);
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
        }
        onCursorMove?.(p);
      });

    const panCamera = Gesture.Pan()
      .minPointers(2)
      .runOnJS(true)
      .onStart(() => {
        startCam.value = { ...store().camera };
      })
      .onUpdate((e) => {
        const c = store().camera;
        store().setCamera({
          ...c,
          x: startCam.value.x + e.translationX,
          y: startCam.value.y + e.translationY,
        });
      });

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => {
        startCam.value = { ...store().camera };
      })
      .onUpdate((e) => {
        const c = store().camera;
        const next = Math.max(0.2, Math.min(5, startCam.value.scale * e.scale));
        const bx = (e.focalX - c.x) / c.scale;
        const by = (e.focalY - c.y) / c.scale;
        store().setCamera({ scale: next, x: e.focalX - bx * next, y: e.focalY - by * next });
      });

    return Gesture.Simultaneous(pinch, panCamera, Gesture.Exclusive(draw, tap));
  }, [onCursorMove, startCam]);

  const editing = editingId ? elements[editingId] : null;

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <GestureDetector gesture={gesture}>
        <Canvas style={{ flex: 1 }}>
          <Group transform={[{ translateX: camera.x }, { translateY: camera.y }, { scale: camera.scale }]}>
            {list.map((el) => (
              <ElementRenderer key={el.id} el={el} />
            ))}

            {livePoints.length >= 2 ? (
              <Path
                path={strokeToSvgPath(livePoints)}
                style="stroke"
                strokeWidth={config.width}
                color={config.color}
                strokeCap="round"
                strokeJoin="round"
              />
            ) : null}

            {liveShape ? (
              <ElementRenderer
                el={{
                  id: 'live',
                  kind: 'shape',
                  shape: (DRAW_TOOLS.has(tool) ? tool : 'rectangle') as ShapeKind,
                  from: liveShape.from,
                  to: liveShape.to,
                  stroke: config.color,
                  strokeWidth: config.width,
                  fill: config.fill,
                  createdBy: 'local',
                  createdAt: 0,
                  updatedAt: 0,
                  z: 0,
                }}
              />
            ) : null}

            {participants
              .filter((p) => p.userId !== you?.userId && p.cursor)
              .map((p) => (
                <CursorDot key={p.userId} x={p.cursor!.x} y={p.cursor!.y} color={p.color} />
              ))}
          </Group>
        </Canvas>
      </GestureDetector>

      {editing && editing.kind === 'text' ? (
        <TextEditorOverlay element={editing} camera={camera} onClose={() => setEditingId(null)} />
      ) : null}
    </View>
  );
}
