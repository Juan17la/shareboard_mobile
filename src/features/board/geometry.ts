/**
 * Stroke geometry helpers. Turns a flat point buffer into a smooth SVG path
 * string (Catmull-Rom -> cubic Bezier) so freehand lines are not jagged —
 * addresses "minimizar líneas entrecortadas" from docs/01-introduction.
 */
import type { Point } from './model';

export function flatToPoints(flat: number[]): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < flat.length - 1; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  return pts;
}

/** Drop points closer than `min` px to the previous kept point. */
export function simplify(flat: number[], min = 1.5): number[] {
  if (flat.length <= 4) return flat;
  const out = [flat[0], flat[1]];
  const min2 = min * min;
  for (let i = 2; i < flat.length - 1; i += 2) {
    const dx = flat[i] - out[out.length - 2];
    const dy = flat[i + 1] - out[out.length - 1];
    if (dx * dx + dy * dy >= min2) out.push(flat[i], flat[i + 1]);
  }
  // Always keep the last point.
  out.push(flat[flat.length - 2], flat[flat.length - 1]);
  return out;
}

/** Catmull-Rom spline through the points, emitted as an SVG path `d` string. */
export function strokeToSvgPath(flat: number[]): string {
  const p = flatToPoints(flat);
  if (p.length === 0) return '';
  if (p.length === 1) {
    const { x, y } = p[0];
    return `M ${x} ${y} L ${x + 0.1} ${y + 0.1}`;
  }
  if (p.length === 2) return `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y}`;

  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Axis-aligned bounding box of every visible element, in board coords. */
export function contentBounds(
  elements: {
    kind: string;
    points?: number[];
    from?: Point;
    to?: Point;
    at?: Point;
    width?: number;
    height?: number;
    fontSize?: number;
    text?: string;
  }[],
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const el of elements) {
    if (el.points) {
      for (let i = 0; i < el.points.length - 1; i += 2) grow(el.points[i], el.points[i + 1]);
    } else if (el.from && el.to) {
      grow(el.from.x, el.from.y);
      grow(el.to.x, el.to.y);
    } else if (el.at) {
      const w = el.width ?? Math.max(40, (el.text?.length ?? 4) * (el.fontSize ?? 20) * 0.55);
      const h = el.height ?? (el.fontSize ?? 20) * 1.4;
      grow(el.at.x, el.at.y);
      grow(el.at.x + w, el.at.y + h);
    }
  }
  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
