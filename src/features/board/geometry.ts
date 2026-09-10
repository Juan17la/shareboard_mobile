/**
 * Stroke geometry: turning the flat `[x0, y0, x1, y1, ...]` buffer a gesture
 * produces into something drawable, and measuring what is on the board.
 *
 * A finger emits a point every frame, which gives two problems. There are far
 * more points than the shape needs — so `simplify` drops the ones that carry no
 * information before the stroke is stored and sent over the network — and
 * joining the survivors with straight lines looks visibly faceted. So
 * `strokeToSvgPath` fits a curve through them instead (Catmull-Rom, converted
 * to the cubic Beziers SVG understands), which is what keeps freehand lines
 * smooth: the "minimizar líneas entrecortadas" requirement in docs/01.
 */
import type { BoardElement, Point } from './model';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function flatToPoints(flat: number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < flat.length - 1; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
  return points;
}

/** Drops points closer than `min` px to the last kept one. */
export function simplify(flat: number[], min = 1.5): number[] {
  if (flat.length <= 4) return flat;

  const out = [flat[0], flat[1]];
  const min2 = min * min;
  for (let i = 2; i < flat.length - 1; i += 2) {
    const dx = flat[i] - out[out.length - 2];
    const dy = flat[i + 1] - out[out.length - 1];
    if (dx * dx + dy * dy >= min2) out.push(flat[i], flat[i + 1]);
  }
  // The last point is where the finger actually lifted, so it always survives.
  out.push(flat[flat.length - 2], flat[flat.length - 1]);
  return out;
}

/** Two decimals is well below one device pixel and keeps the path string short. */
const n = (v: number) => Math.round(v * 100) / 100;

/**
 * `smooth` is the settings-sheet switch. Off, the points are joined with
 * straight segments — faster, and closer to what was literally drawn, which a
 * few people prefer for diagrams; on (the default) they are curve-fitted.
 */
export function strokeToSvgPath(flat: number[], smooth = true): string {
  const p = flatToPoints(flat);
  if (p.length === 0) return '';
  // A tap has nowhere to curve to; the zero-length line still paints a round cap.
  if (p.length === 1) return `M ${n(p[0].x)} ${n(p[0].y)} L ${n(p[0].x)} ${n(p[0].y)}`;
  if (p.length === 2) return `M ${n(p[0].x)} ${n(p[0].y)} L ${n(p[1].x)} ${n(p[1].y)}`;

  if (!smooth) {
    return p.reduce(
      (d, point, i) => (i === 0 ? `M ${n(point.x)} ${n(point.y)}` : `${d} L ${n(point.x)} ${n(point.y)}`),
      '',
    );
  }

  let d = `M ${n(p[0].x)} ${n(p[0].y)}`;
  for (let i = 0; i < p.length - 1; i++) {
    // Each segment is steered by its neighbours, so the curve stays continuous
    // across joins. The ends have no outer neighbour and reuse the endpoint.
    const prev = p[i - 1] ?? p[i];
    const from = p[i];
    const to = p[i + 1];
    const next = p[i + 2] ?? to;

    // Catmull-Rom -> Bezier: the control points sit a sixth of the way along
    // the neighbouring chord, which is the standard uniform conversion.
    const c1x = from.x + (to.x - prev.x) / 6;
    const c1y = from.y + (to.y - prev.y) / 6;
    const c2x = to.x - (next.x - from.x) / 6;
    const c2y = to.y - (next.y - from.y) / 6;
    d += ` C ${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(to.x)} ${n(to.y)}`;
  }
  return d;
}

/**
 * Bounding box of everything drawn, or null when the board is empty. Used to
 * frame an export tightly instead of shipping the whole infinite canvas.
 * Strokes and shapes are grown by half their stroke width, since a line is
 * painted centred on its path and would otherwise be clipped in half.
 */
export function contentBounds(elements: BoardElement[]): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const grow = (x: number, y: number, pad = 0) => {
    if (x - pad < minX) minX = x - pad;
    if (y - pad < minY) minY = y - pad;
    if (x + pad > maxX) maxX = x + pad;
    if (y + pad > maxY) maxY = y + pad;
  };

  for (const el of elements) {
    switch (el.kind) {
      case 'stroke': {
        const pad = el.width / 2;
        for (let i = 0; i < el.points.length - 1; i += 2) grow(el.points[i], el.points[i + 1], pad);
        break;
      }
      case 'shape': {
        const pad = el.strokeWidth / 2;
        grow(el.from.x, el.from.y, pad);
        grow(el.to.x, el.to.y, pad);
        break;
      }
      case 'text': {
        // Skia only measures text once a font is resolved, which this module has
        // no access to, so approximate from the glyph count.
        grow(el.at.x, el.at.y);
        grow(el.at.x + el.text.length * el.fontSize * 0.55, el.at.y + el.fontSize * 1.4);
        break;
      }
      case 'image':
        grow(el.at.x, el.at.y);
        grow(el.at.x + el.width, el.at.y + el.height);
        break;
    }
  }

  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
