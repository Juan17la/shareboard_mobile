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
import type { BoardElement, Dash, Link, Marker, Point, Route, ShapeElement } from './model';

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
      (d, point, i) =>
        i === 0 ? `M ${n(point.x)} ${n(point.y)}` : `${d} L ${n(point.x)} ${n(point.y)}`,
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

// --- selecting and reshaping a shape ---------------------------------------
// A selected shape shows one handle per corner (two, the endpoints, for a line
// or an arrow). Dragging a handle moves that corner and pins the opposite one;
// for a line each handle simply moves its own endpoint, so the arrow head keeps
// pointing the way it was drawn.

export const isLineLike = (el: Pick<ShapeElement, 'shape'>): boolean =>
  el.shape === 'line' || el.shape === 'arrow';

/** Normalised box of a shape. A line's box may have zero width or height. */
export function shapeBounds(el: Pick<ShapeElement, 'from' | 'to'>): Bounds {
  const x = Math.min(el.from.x, el.to.x);
  const y = Math.min(el.from.y, el.to.y);
  return {
    x,
    y,
    width: Math.abs(el.to.x - el.from.x),
    height: Math.abs(el.to.y - el.from.y),
  };
}

/** Handle positions, in board coordinates: TL, TR, BR, BL — or from, to. */
export function shapeHandles(el: ShapeElement): Point[] {
  if (isLineLike(el)) return [el.from, el.to];
  const b = shapeBounds(el);
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height },
  ];
}

/** The shape's `from`/`to` after handle `h` is dragged to `p`. */
export function resizeShape(
  el: ShapeElement,
  h: number,
  p: Point,
): Pick<ShapeElement, 'from' | 'to'> {
  if (isLineLike(el)) return h === 0 ? { from: p, to: el.to } : { from: el.from, to: p };
  // Box shapes are drawn from their normalised bounds, so any corner order works.
  return { from: shapeHandles(el)[(h + 2) % 4], to: p };
}

// --- any element ---------------------------------------------------------
// The cursor tool works on every kind, so these are the kind-agnostic
// versions of the shape helpers above.

export function elementBounds(el: BoardElement): Bounds {
  return contentBounds([el]) ?? { x: 0, y: 0, width: 0, height: 0 };
}

/** The patch that moves `el` by (dx, dy). */
export function translate(el: BoardElement, dx: number, dy: number): Partial<BoardElement> {
  switch (el.kind) {
    case 'stroke':
      return { points: el.points.map((v, i) => v + (i % 2 ? dy : dx)) };
    case 'shape':
      return {
        from: { x: el.from.x + dx, y: el.from.y + dy },
        to: { x: el.to.x + dx, y: el.to.y + dy },
      };
    default:
      return { at: { x: el.at.x + dx, y: el.at.y + dy } };
  }
}

/** Resize handles of any element: corners for a box or an image, ends for a line, none otherwise. */
export function handlesOf(el: BoardElement): Point[] {
  if (el.kind === 'shape') return shapeHandles(el);
  if (el.kind !== 'image') return [];
  const { at, width, height } = el;
  return [
    at,
    { x: at.x + width, y: at.y },
    { x: at.x + width, y: at.y + height },
    { x: at.x, y: at.y + height },
  ];
}

/** `el` after handle `h` is dragged to `p`, as a patch. */
export function resizeElement(el: BoardElement, h: number, p: Point): Partial<BoardElement> {
  if (el.kind === 'shape') return resizeShape(el, h, p);
  if (el.kind !== 'image') return {};
  const o = handlesOf(el)[(h + 2) % 4];
  return {
    at: { x: Math.min(o.x, p.x), y: Math.min(o.y, p.y) },
    width: Math.max(8, Math.abs(p.x - o.x)),
    height: Math.max(8, Math.abs(p.y - o.y)),
  };
}

/** Elements whose box lies entirely inside `b` — the marquee's pick. */
export function elementsIn(elements: BoardElement[], b: Bounds): BoardElement[] {
  // Anything the band touches, not only what it encloses: a finger cannot
  // frame a stroke to the pixel, and a stroke's padding made it fail anyway.
  return elements.filter((el) => {
    const e = elementBounds(el);
    return e.x <= b.x + b.width && e.x + e.width >= b.x && e.y <= b.y + b.height && e.y + e.height >= b.y;
  });
}

// --- connection points -----------------------------------------------------
// A line's end dropped on an enclosed shape binds to it: the point is kept as
// a fraction (u, v) of the shape's box, so it is anywhere on the outline the
// user chose and follows the shape when it moves or resizes (`followLinks`).
// The one dot shown on a shape is its centre: dropping there aims at the other
// end instead of pinning a spot.

/** The connection hint of an enclosed shape: its centre. */
export function anchorsOf(el: ShapeElement): Point[] {
  if (isLineLike(el)) return [];
  const b = shapeBounds(el);
  return [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }];
}

/** Where a link lands on its shape's current box. */
export function linkPoint(el: Pick<ShapeElement, 'from' | 'to'>, link: Link): Point {
  const b = shapeBounds(el);
  return { x: b.x + link.u * b.width, y: b.y + link.v * b.height };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The point of the box outline nearest to `p`. */
function edgePoint(p: Point, b: Bounds): Point {
  const x = clamp(p.x, b.x, b.x + b.width);
  const y = clamp(p.y, b.y, b.y + b.height);
  const d = [x - b.x, b.x + b.width - x, y - b.y, b.y + b.height - y];
  const i = d.indexOf(Math.min(...d));
  if (i === 0) return { x: b.x, y };
  if (i === 1) return { x: b.x + b.width, y };
  if (i === 2) return { x, y: b.y };
  return { x, y: b.y + b.height };
}

/** Where the ray from the box centre towards `target` leaves the box. */
function rayToBox(target: Point, b: Bounds): Point {
  const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (!dx && !dy) return edgePoint(c, b);
  const t = Math.min(
    dx ? b.width / 2 / Math.abs(dx) : Infinity,
    dy ? b.height / 2 / Math.abs(dy) : Infinity,
  );
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/**
 * Where the two ends of a line land, and what they bind to. An end within
 * `radius` of an enclosed shape binds: near the centre dot it faces the other
 * end (so an arrow dragged from box A to box B links the two without aiming),
 * elsewhere it pins the nearest point of the outline.
 */
export function linkEndpoints(
  elements: BoardElement[],
  from: Point,
  to: Point,
  radius: number,
): { from: Point; to: Point; fromLink: Link | null; toLink: Link | null } {
  const enclosed = elements.filter((el) => el.kind === 'shape' && !isLineLike(el));
  const centre = (el: ShapeElement) => anchorsOf(el)[0];
  const bind = (el: ShapeElement | null, p: Point, other: Point) => {
    if (!el) return { p, link: null };
    const b = shapeBounds(el);
    const c = centre(el);
    const at = Math.hypot(p.x - c.x, p.y - c.y) <= radius ? rayToBox(other, b) : edgePoint(p, b);
    return {
      p: at,
      link: {
        id: el.id,
        u: b.width ? (at.x - b.x) / b.width : 0.5,
        v: b.height ? (at.y - b.y) / b.height : 0.5,
      },
    };
  };
  const a = shapeAt(enclosed, from, radius);
  const b = shapeAt(enclosed, to, radius);
  // Both ends bound: face the other shape's centre, so the ends stay put while
  // the finger wanders inside its box.
  const f = bind(a, from, b && b !== a ? centre(b) : to);
  const t = bind(b, to, a && a !== b ? centre(a) : f.p);
  return { from: f.p, to: t.p, fromLink: f.link, toLink: t.link };
}

/**
 * The endpoint patches of every line bound to a shape in `moved`, computed
 * from the shapes as they are in `elements`. A link to a shape that is gone
 * simply does nothing — no cleanup needed.
 */
export function followLinks(
  elements: BoardElement[],
  moved: Iterable<string>,
): { id: string; from?: Point; to?: Point }[] {
  const ids = new Set(moved);
  const byId = new Map(elements.map((el) => [el.id, el] as const));
  const out: { id: string; from?: Point; to?: Point }[] = [];
  for (const el of elements) {
    if (el.kind !== 'shape' || !isLineLike(el)) continue;
    // Only the end that is bound to a moved shape changes: patching the other
    // one too would make an undo rewind wherever a collaborator had put it.
    const end = (link: Link | null | undefined) => {
      const target = link && ids.has(link.id) ? byId.get(link.id) : undefined;
      return target?.kind === 'shape' ? linkPoint(target, link!) : undefined;
    };
    const from = end(el.fromLink);
    const to = end(el.toLink);
    if (from || to) out.push({ id: el.id, ...(from && { from }), ...(to && { to }) });
  }
  return out;
}

/** The topmost shape whose box (padded by `pad` board units) contains `at`. */
export function shapeAt(elements: BoardElement[], at: Point, pad: number): ShapeElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.kind === 'shape' && shapeHit(el, at, pad)) return el;
  }
  return null;
}

/**
 * Whether `at` lands on a shape, within `pad`. A box is its area; a line or an
 * arrow is only the route it is drawn along. Its bounding box would be most of
 * the board between two shapes it connects, and every tap in there took the
 * arrow instead of the shape underneath.
 */
export function shapeHit(el: ShapeElement, at: Point, pad: number): boolean {
  if (isLineLike(el)) {
    const pts = routePoints(el.from, el.to, el.route, el.bend);
    const reach = pad + el.strokeWidth / 2;
    for (let i = 1; i < pts.length; i++) {
      if (segmentDistance(pts[i - 1], pts[i], at) <= reach) return true;
    }
    return false;
  }
  const b = shapeBounds(el);
  return (
    at.x >= b.x - pad && at.x <= b.x + b.width + pad && at.y >= b.y - pad && at.y <= b.y + b.height + pad
  );
}

/** Distance from `p` to the segment ab. */
function segmentDistance(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The route as a polyline: the curve is sampled, the others are their corners. */
function routePoints(from: Point, to: Point, route: Route = 'straight', bend?: number): Point[] {
  if (route === 'elbow') return elbow(from, to, bend);
  if (route !== 'curved') return [from, to];
  const c = control(from, to, bend);
  const pts: Point[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const u = 1 - t;
    pts.push({
      x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * c.y + t * t * to.y,
    });
  }
  return pts;
}

// --- routes, dashes and markers ----------------------------------------------
// Everything a line is made of, as SVG path strings: Skia draws a string as-is
// (`<Path path=...>`) and so does react-native-svg, so the toolbar's option
// icons are drawn by the very same generators as the board.

/**
 * The bend of a curved route: `bend` board units to the side of the chord's
 * midpoint (positive: left of from→to), a quarter of the chord's length when
 * absent — the route's original fixed look.
 */
export function control(from: Point, to: Point, bend?: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const amount = bend ?? len / 4;
  return {
    x: (from.x + to.x) / 2 - (dy / len) * amount,
    y: (from.y + to.y) / 2 + (dx / len) * amount,
  };
}

/** Elbow: two right angles, the long axis first. `bend`: where along it, 0..1 (midpoint absent). */
function elbow(from: Point, to: Point, bend?: number): Point[] {
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  const t = bend ?? 0.5;
  const mx = from.x + (to.x - from.x) * t;
  const my = from.y + (to.y - from.y) * t;
  return horizontal
    ? [from, { x: mx, y: from.y }, { x: mx, y: to.y }, to]
    : [from, { x: from.x, y: my }, { x: to.x, y: my }, to];
}

export function routePath(from: Point, to: Point, route: Route = 'straight', bend?: number): string {
  if (route === 'curved') {
    const c = control(from, to, bend);
    return `M ${n(from.x)} ${n(from.y)} Q ${n(c.x)} ${n(c.y)} ${n(to.x)} ${n(to.y)}`;
  }
  const pts = route === 'elbow' ? elbow(from, to, bend) : [from, to];
  return pts.map((p, i) => `${i ? 'L' : 'M'} ${n(p.x)} ${n(p.y)}`).join(' ');
}

/** The outward direction at each end, for the markers. */
export function endAngles(
  from: Point,
  to: Point,
  route: Route = 'straight',
  bend?: number,
): { start: number; end: number } {
  const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
  if (route === 'curved') {
    const c = control(from, to, bend);
    return { start: angle(c, from), end: angle(c, to) };
  }
  const pts = route === 'elbow' ? elbow(from, to, bend) : [from, to];
  const inner = (a: Point, b: Point) => (a.x === b.x && a.y === b.y ? null : b);
  // A zero-length elbow segment has no direction; fall back to the chord.
  const s = inner(from, pts[1]) ?? to;
  const e = inner(to, pts[pts.length - 2]) ?? from;
  return { start: angle(s, from), end: angle(e, to) };
}

/**
 * Where the fold handle of a curved or elbow route sits: the curve's control
 * point, or the midpoint of an elbow's middle segment. `null` for a route
 * with no fold to drag (straight), or anything that is not a line.
 */
export function bendHandleOf(el: Pick<ShapeElement, 'shape' | 'from' | 'to' | 'route' | 'bend'>): Point | null {
  if (!isLineLike(el) || (el.route !== 'curved' && el.route !== 'elbow')) return null;
  if (el.route === 'curved') return control(el.from, el.to, el.bend);
  const pts = elbow(el.from, el.to, el.bend);
  return { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 };
}

/** The `bend` a drag of the fold handle to `p` implies, inverting `bendHandleOf`. */
export function bendFromDrag(
  el: Pick<ShapeElement, 'from' | 'to' | 'route'>,
  p: Point,
): number {
  const dx = el.to.x - el.from.x;
  const dy = el.to.y - el.from.y;
  if (el.route === 'curved') {
    const len = Math.hypot(dx, dy) || 1;
    const mx = (el.from.x + el.to.x) / 2;
    const my = (el.from.y + el.to.y) / 2;
    return ((p.x - mx) * -dy + (p.y - my) * dx) / len;
  }
  // Elbow: how far along the long axis, clamped off the very ends so the
  // route never collapses onto an endpoint.
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const t = horizontal ? (dx ? (p.x - el.from.x) / dx : 0.5) : dy ? (p.y - el.from.y) / dy : 0.5;
  return clamp(t, 0.08, 0.92);
}

/** Dash intervals for a stroke of `width`; null for solid. */
export function dashIntervals(dash: Dash | undefined, width: number): number[] | null {
  if (dash === 'dashed') return [width * 3, width * 2];
  // A hair-length dash with round caps paints as a dot.
  if (dash === 'dotted') return [0.1, width * 2];
  return null;
}

export interface MarkerPart {
  d: string;
  /** solid: the stroke colour; hollow: white, so the line does not show through; none: outline only. */
  fill: 'solid' | 'hollow' | 'none';
}

/** The default heads of a line kind when the element does not say. */
export function headsOf(
  el: Pick<ShapeElement, 'shape' | 'headStart' | 'headEnd'>,
): [Marker, Marker] {
  return [el.headStart ?? 'none', el.headEnd ?? (el.shape === 'arrow' ? 'arrow' : 'none')];
}

/**
 * A marker at `tip`, pointing along `angle` (radians, outward), `size` long.
 * Cardinality markers are the crow's-foot set: the bar and the crow sit at the
 * tip, the "zero" circle one step further back.
 */
export function markerPaths(kind: Marker, tip: Point, angle: number, size: number): MarkerPart[] {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  // Points along the line (`back` from the tip) and across it (`side`).
  const at = (back: number, side: number): Point => ({
    x: tip.x - ux * back - uy * side,
    y: tip.y - uy * back + ux * side,
  });
  const P = (p: Point) => `${n(p.x)} ${n(p.y)}`;
  const poly = (...pts: Point[]) => `M ${pts.map(P).join(' L ')} Z`;
  const circle = (back: number) => {
    const r = size / 2;
    const l = at(back + r, 0);
    const rr = at(back - r, 0);
    return `M ${P(l)} A ${n(r)} ${n(r)} 0 1 0 ${P(rr)} A ${n(r)} ${n(r)} 0 1 0 ${P(l)}`;
  };
  const bar = (back: number) => `M ${P(at(back, -size / 2))} L ${P(at(back, size / 2))}`;
  // The crow's foot spreads wider than its own length — a tight `size/2` read
  // as a narrow arrowhead rather than the three-way fork cardinality wants.
  const crow = () =>
    `M ${P(at(size, 0))} L ${P(at(0, -size * 0.8))} M ${P(at(size, 0))} L ${P(tip)} M ${P(at(size, 0))} L ${P(at(0, size * 0.8))}`;
  const triangle = poly(tip, at(size, -size / 2), at(size, size / 2));
  const diamond = poly(tip, at(size / 2, -size * 0.4), at(size, 0), at(size / 2, size * 0.4));

  switch (kind) {
    case 'none':
      return [];
    case 'arrow':
      return [
        {
          d: `M ${P(at(size, -size / 2))} L ${P(tip)} L ${P(at(size, size / 2))}`,
          fill: 'none',
        },
      ];
    case 'triangle':
      return [{ d: triangle, fill: 'solid' }];
    case 'triangle-outline':
      return [{ d: triangle, fill: 'hollow' }];
    case 'circle':
      return [{ d: circle(size / 2), fill: 'solid' }];
    case 'circle-outline':
      return [{ d: circle(size / 2), fill: 'hollow' }];
    case 'circle-half': {
      const r = size / 2;
      const half = `M ${P(at(r, -r))} A ${n(r)} ${n(r)} 0 0 1 ${P(at(r, r))} Z`;
      return [
        { d: circle(r), fill: 'hollow' },
        { d: half, fill: 'solid' },
      ];
    }
    case 'diamond':
      return [{ d: diamond, fill: 'solid' }];
    case 'diamond-outline':
      return [{ d: diamond, fill: 'hollow' }];
    case 'bar':
      return [{ d: bar(0), fill: 'none' }];
    case 'one':
      return [{ d: bar(size / 2), fill: 'none' }];
    case 'many':
      return [{ d: crow(), fill: 'none' }];
    case 'zero-one':
      return [
        { d: bar(size / 2), fill: 'none' },
        { d: circle(size * 1.5), fill: 'hollow' },
      ];
    case 'zero-many':
      return [
        { d: crow(), fill: 'none' },
        { d: circle(size * 1.5), fill: 'hollow' },
      ];
    case 'one-many':
      return [
        { d: crow(), fill: 'none' },
        { d: bar(size), fill: 'none' },
      ];
  }
}
