/** The laser trails, by who — `self` for this device, else a peer's user id (`LaserLayer`). */
import type { Point } from '@/features/board/model';

/** How long a point of the trail stays before it has faded away. */
export const FADE_MS = 1000;
export const LASER = '#FF3B30';

type Mark = Point & { t: number };
/** By who: `self` for this device, else the peer's user id. */
export const trails = new Map<string, Mark[]>();
let wake: (() => void) | null = null;
/** The layer's "paint again": set while it is mounted. */
export const setWake = (fn: (() => void) | null) => {
  wake = fn;
};

/** Adds a point to someone's trail; a gap of more than the fade starts a new trail. */
export function pushLaser(who: string, at: Point): void {
  const now = performance.now();
  const trail = trails.get(who);
  const mark = { x: at.x, y: at.y, t: now };
  if (trail?.length && now - trail[trail.length - 1].t < FADE_MS) trail.push(mark);
  else trails.set(who, [mark]);
  wake?.();
}
