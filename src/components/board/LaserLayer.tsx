/**
 * The laser pointer: a red trail that fades out a second after it is drawn,
 * yours and everyone else's. Never on the board and never stored: peers send
 * it as their cursor with `laser: true`, and each point lives in `laser.ts`
 * until it fades. A canvas of its own, re-rendered only while a trail is
 * fading, so a trail never re-renders the board. Same as web's `LaserLayer`.
 */
import { Canvas, Circle, Line } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { Camera } from '@/features/board/store';

import { FADE_MS, LASER, setWake, trails } from './laser';

export function LaserLayer({
  camera,
  width,
  height,
}: {
  camera: SharedValue<Camera>;
  width: number;
  height: number;
}) {
  // The frame's time: each tick re-renders the trails at their new age.
  const [now, setNow] = useState(0);

  useEffect(() => {
    let raf: number | null = null;
    const step = () => {
      raf = null;
      // The clock `pushLaser` stamps with (a frame's own timestamp is not on it everywhere).
      const t = performance.now();
      for (const [who, trail] of trails) {
        while (trail.length && t - trail[0].t > FADE_MS) trail.shift();
        if (!trail.length) trails.delete(who);
      }
      setNow(t);
      // Keep going only while something is still fading.
      if (trails.size) raf = requestAnimationFrame(step);
    };
    setWake(() => {
      if (raf === null) raf = requestAnimationFrame(step);
    });
    return () => {
      setWake(null);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  if (!trails.size || !width || !height) return null;

  const { x, y, scale } = camera.get();
  const sx = (v: number) => v * scale + x;
  const sy = (v: number) => v * scale + y;
  return (
    <Canvas pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {[...trails.entries()].flatMap(([who, trail]) => [
        // Each segment fades with its age and thins toward the tail.
        ...trail.slice(1).map((p, i) => {
          const life = 1 - (now - p.t) / FADE_MS;
          return (
            <Line
              key={`${who}-${p.t}-${i}`}
              p1={{ x: sx(trail[i].x), y: sy(trail[i].y) }}
              p2={{ x: sx(p.x), y: sy(p.y) }}
              color={LASER}
              strokeWidth={2 + 3 * life}
              strokeCap="round"
              opacity={life}
            />
          );
        }),
        <Circle
          key={`${who}-tip`}
          cx={sx(trail[trail.length - 1].x)}
          cy={sy(trail[trail.length - 1].y)}
          r={4}
          color={LASER}
          opacity={1 - (now - trail[trail.length - 1].t) / FADE_MS}
        />,
      ])}
    </Canvas>
  );
}
