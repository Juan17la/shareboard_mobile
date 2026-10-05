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
import {
  DEFAULT_SIDES,
  SHAPE_TEXT_SIZE,
  LIMITS,
  type Axis,
  type BoardElement,
  type Dash,
  type HAlign,
  type Link,
  type Marker,
  type Point,
  type Route,
  type ShapeElement,
  type TextElement,
} from './model';

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
export const n = (v: number) => {
  'worklet';
  return Math.round(v * 100) / 100;
};

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
  for (let i = 0; i < p.length - 1; i++) d += ` C ${curveSegment(p, i).join(' ')}`;
  return d;
}

/** What a path is written to: a Skia path builder, or anything else with these three. */
export interface PathSink {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  cubicTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): unknown;
}

/**
 * Segment `i` of the smoothed stroke through `p` (from `p[i]` to `p[i + 1]`),
 * as the cubic's rounded `c1x c1y c2x c2y x y`. Shared with the live stroke
 * (`livePath`), which builds the same curve a point at a time.
 *
 * Declared before `addStroke` on purpose: a worklet captures what it calls
 * where it is declared, not hoisted, so `addStroke` above this one got
 * `undefined` and crashed the app on the UI thread with the first smoothed stroke.
 */
export function curveSegment(p: Point[], i: number): number[] {
  'worklet';
  // Each segment is steered by its neighbours, so the curve stays continuous
  // across joins. The ends have no outer neighbour and reuse the endpoint.
  const prev = p[i - 1] ?? p[i];
  const from = p[i];
  const to = p[i + 1];
  const next = p[i + 2] ?? to;

  // Catmull-Rom -> Bezier: the control points sit a sixth of the way along
  // the neighbouring chord, which is the standard uniform conversion.
  return [
    n(from.x + (to.x - prev.x) / 6),
    n(from.y + (to.y - prev.y) / 6),
    n(to.x - (next.x - from.x) / 6),
    n(to.y - (next.y - from.y) / 6),
    n(to.x),
    n(to.y),
  ];
}

/**
 * `strokeToSvgPath`'s path, written straight to a path builder. The live stroke
 * is drawn with this on the UI thread (hence the worklet), so what shows under
 * the finger is the curve that will be committed — the geometry is pinned to
 * `strokeToSvgPath` by the geometry check.
 */
export function addStroke(b: PathSink, flat: number[], smooth: boolean): void {
  'worklet';
  const m = flat.length >> 1;
  if (m === 0) return;
  b.moveTo(n(flat[0]), n(flat[1]));
  // A dot: the zero-length line still paints a round cap.
  if (m === 1) {
    b.lineTo(n(flat[0]), n(flat[1]));
    return;
  }
  if (!smooth || m === 2) {
    for (let i = 1; i < m; i++) b.lineTo(n(flat[2 * i]), n(flat[2 * i + 1]));
    return;
  }
  const p: Point[] = [];
  for (let i = 0; i < m; i++) p.push({ x: flat[2 * i], y: flat[2 * i + 1] });
  for (let i = 0; i < m - 1; i++) {
    const seg = curveSegment(p, i);
    b.cubicTo(seg[0], seg[1], seg[2], seg[3], seg[4], seg[5]);
  }
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
        if (!isLineLike(el)) {
          growTurned(shapeBounds(el), el.strokeWidth / 2, el.rotation ?? 0, grow);
          break;
        }
        const pad = el.strokeWidth / 2;
        grow(el.from.x, el.from.y, pad);
        grow(el.to.x, el.to.y, pad);
        break;
      }
      case 'text':
      case 'image':
        growTurned(boxOf(el), 0, el.rotation ?? 0, grow);
        break;
    }
  }

  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Feeds the four corners of `b` (grown by `pad`), turned by `angle` about its centre, to `grow`. */
function growTurned(b: Bounds, pad: number, angle: number, grow: (x: number, y: number) => void) {
  const c = centreOf(b);
  const x0 = b.x - pad;
  const y0 = b.y - pad;
  const x1 = b.x + b.width + pad;
  const y1 = b.y + b.height + pad;
  for (const corner of [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]) {
    const q = angle ? turn(corner, c, angle) : corner;
    grow(q.x, q.y);
  }
}

// --- text layout -------------------------------------------------------------
// Text is measured by whoever can: the board fonts install Skia's
// `measureText` (`setTextMeasure`); without one (tests) a glyph-count estimate.

/** Text is drawn from its baseline, so a line sits `fontSize` below `at.y`; lines are this far apart. */
export const TEXT_LINE_HEIGHT = 1.25;

type TextFont = Pick<TextElement, 'fontSize' | 'bold' | 'italic' | 'font'>;
type TextMeasure = (text: string, font: TextFont) => number;

let measureWidth: TextMeasure = (text, font) => text.length * font.fontSize * 0.55;
// One cache per element object (elements are replaced, never mutated), dropped
// whenever the measure changes — e.g. a typeface finished loading.
let textBoxes = new WeakMap<TextElement, Bounds>();

export function setTextMeasure(measure: TextMeasure): void {
  measureWidth = measure;
  textBoxes = new WeakMap();
}

/** The lines a text element draws: its own newlines, then word-wrapped to `width` if it has one. */
export function textLines(el: Pick<TextElement, 'text' | 'width'> & TextFont): string[] {
  const paragraphs = el.text.split('\n');
  if (!el.width) return paragraphs;
  const out: string[] = [];
  for (const para of paragraphs) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      // A single word longer than the width keeps its own line rather than being cut.
      if (line && measureWidth(next, el) > el.width) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

/** A text element's block, unturned: its wrap width (or longest line) by its lines. */
export function textBox(el: TextElement): Bounds {
  const cached = textBoxes.get(el);
  if (cached) return cached;
  const lines = textLines(el);
  const longest = Math.max(...lines.map((line) => measureWidth(line, el)));
  const box = {
    x: el.at.x,
    y: el.at.y,
    width: Math.max(el.width ?? longest, el.fontSize),
    height: el.fontSize * (0.15 + lines.length * TEXT_LINE_HEIGHT),
  };
  textBoxes.set(el, box);
  return box;
}

/** How far a figure's label keeps from its outline, each side. */
export const LABEL_PAD = 6;

/**
 * The lines of a figure's label: wrapped to the inside of its box, so typing
 * a long label fills the figure rather than running out of it. A line's label
 * floats above it and only breaks where it was typed to.
 */
export function labelLines(
  el: Pick<ShapeElement, 'shape' | 'from' | 'to' | 'text' | 'fontSize' | 'font'>,
  fontSize: number,
): string[] {
  const text = el.text ?? '';
  if (isLineLike(el)) return text.split('\n');
  const inner = shapeBounds(el).width - LABEL_PAD * 2;
  return textLines({ text, fontSize, font: el.font, width: Math.max(fontSize, inner) });
}

/**
 * Where a figure's label is drawn: the x it is anchored at with its alignment,
 * and the y of the middle of its first line. A line's label is always centred
 * on its route. A box's sits in the box inside `LABEL_PAD`; a triangle whose
 * vertical alignment was chosen keeps to its wide lower half, where the text
 * fits, instead of the whole box, whose top corner is a point.
 */
export function labelPlacement(
  el: Pick<ShapeElement, 'shape' | 'from' | 'to' | 'labelAt' | 'align' | 'valign'>,
  fontSize: number,
  lineCount: number,
): { x: number; y: number; align: HAlign } {
  const step = fontSize * TEXT_LINE_HEIGHT;
  if (isLineLike(el)) {
    const c = lineLabelCentre(el);
    return { x: c.x, y: c.y - ((lineCount - 1) * step) / 2, align: 'center' };
  }
  const b = shapeBounds(el);
  const lower = el.shape === 'triangle' && !!el.valign;
  const top = b.y + (lower ? b.height / 2 : 0) + LABEL_PAD;
  const height = b.height * (lower ? 0.5 : 1) - LABEL_PAD * 2;
  const left = b.x + LABEL_PAD;
  const width = b.width - LABEL_PAD * 2;
  const align = el.align ?? 'center';
  const valign = el.valign ?? 'middle';
  return {
    x: align === 'left' ? left : align === 'right' ? left + width : left + width / 2,
    y:
      valign === 'top'
        ? top + step / 2
        : valign === 'bottom'
          ? top + height - step / 2 - (lineCount - 1) * step
          : top + height / 2 - ((lineCount - 1) * step) / 2,
    align,
  };
}

/** The x a text element's lines are anchored at: its left, middle or right edge. */
export function textAnchor(el: TextElement): { x: number; align: HAlign } {
  const align = el.align ?? 'left';
  const w = align === 'left' ? 0 : textBox(el).width;
  return { x: el.at.x + (align === 'center' ? w / 2 : align === 'right' ? w : 0), align };
}

/** A line's label: how far along its route it stands, 0..1 (the middle when absent). */
export const LABEL_DEFAULT_AT = 0.5;
/** Room left round a label's text where it cuts the line. */
const LABEL_GAP = 6;

/** The route as a polyline to measure along: a curve sampled, an elbow as it is. */
const routeSamples = (el: RouteSpec): Point[] => routePoints(el);

/** The point `t` (0..1) of the way along a line's route, by length. */
export function routePointAt(el: RouteSpec, t: number): Point {
  const pts = routeSamples(el);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (left <= d && d > 0) {
      const k = left / d;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
    left -= d;
  }
  return pts[pts.length - 1];
}

/**
 * Where a line's label is centred: on the line itself, `labelAt` of the way
 * along it. The line is cut away behind the text (`labelBox`), so it reads as
 * one thing; the label is dragged along the line to move it.
 */
export function lineLabelCentre(el: RouteSpec & Pick<ShapeElement, 'labelAt'>): Point {
  return routePointAt(el, el.labelAt ?? LABEL_DEFAULT_AT);
}

/**
 * The room a line's label takes: the gap cut in the line behind it, and what a
 * touch on the label hits. The text's width is estimated (half an em a
 * character) rather than measured, so the canvases, the editors and the SVG
 * export, which measure differently, all cut the same gap.
 */
export function labelBox(
  el: RouteSpec & Pick<ShapeElement, 'labelAt'>,
  lines: string[],
  fontSize: number,
): Bounds {
  const c = lineLabelCentre(el);
  const width = Math.max(1, ...lines.map((l) => l.length)) * fontSize * 0.5 + 2 * LABEL_GAP;
  const height = lines.length * fontSize * TEXT_LINE_HEIGHT + 4;
  return { x: c.x - width / 2, y: c.y - height / 2, width, height };
}

/** The `labelAt` a drag to `p` implies: the nearest point of the route, kept off its very ends. */
export function labelFromDrag(el: RouteSpec, p: Point): number {
  const pts = routeSamples(el);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  if (!total) return LABEL_DEFAULT_AT;
  let best = Infinity;
  let at = LABEL_DEFAULT_AT * total;
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = dist(a, b);
    const k = d ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (d * d))) : 0;
    const q = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    const off = dist(p, q);
    if (off < best) {
      best = off;
      at = walked + d * k;
    }
    walked += d;
  }
  return Math.max(0.04, Math.min(0.96, at / total));
}

// --- rotation ----------------------------------------------------------------
// A box, a text or an image turns about the centre of its unturned box
// (`boxOf`). Hit tests and handles work in that unturned ("local") frame: the
// pointer is turned back first (`toLocal`), and answers turned forward (`toWorld`).

const centreOf = (b: Bounds): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

function turn(p: Point, c: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** Whether `el` can turn: boxes, text and images; lines and strokes cannot. */
export const canRotate = (el: BoardElement): boolean =>
  el.kind === 'text' || el.kind === 'image' || (el.kind === 'shape' && !isLineLike(el));

export const rotationOf = (el: BoardElement): number => (canRotate(el) ? (el.rotation ?? 0) : 0);

/** The box an element is drawn in before it is turned. */
export function boxOf(el: BoardElement): Bounds {
  switch (el.kind) {
    case 'shape':
      return shapeBounds(el);
    case 'text':
      return textBox(el);
    case 'image':
      return { x: el.at.x, y: el.at.y, width: el.width, height: el.height };
    default:
      return contentBounds([el]) ?? { x: 0, y: 0, width: 0, height: 0 };
  }
}

/** A board point in `el`'s unturned frame. */
export function toLocal(el: BoardElement, p: Point): Point {
  const angle = rotationOf(el);
  return angle ? turn(p, centreOf(boxOf(el)), -angle) : p;
}

/** A point of `el`'s unturned frame on the board. */
export function toWorld(el: BoardElement, p: Point): Point {
  const angle = rotationOf(el);
  return angle ? turn(p, centreOf(boxOf(el)), angle) : p;
}

const inBox = (p: Point, b: Bounds, pad: number) =>
  p.x >= b.x - pad && p.x <= b.x + b.width + pad && p.y >= b.y - pad && p.y <= b.y + b.height + pad;

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

/** The handle on a text's right edge: drags its wrap width (the corners scale it). */
export const TEXT_WIDTH_HANDLE = 4;
/** The knob above a box, a text or an image that turns it (`rotateHandleOf`). */
export const ROTATE_HANDLE = 5;

const cornersOfBox = (b: Bounds): Point[] => [
  { x: b.x, y: b.y },
  { x: b.x + b.width, y: b.y },
  { x: b.x + b.width, y: b.y + b.height },
  { x: b.x, y: b.y + b.height },
];

/**
 * Resize handles of any element, on the board: TL, TR, BR, BL of its turned
 * box — plus the right edge's middle for a text (`TEXT_WIDTH_HANDLE`) — or the
 * two ends of a line; none for a stroke.
 */
export function handlesOf(el: BoardElement): Point[] {
  if (el.kind === 'stroke') return [];
  if (el.kind === 'shape' && isLineLike(el)) return [el.from, el.to];
  const b = boxOf(el);
  const local = cornersOfBox(b);
  if (el.kind === 'text') local.push({ x: b.x + b.width, y: b.y + b.height / 2 });
  return local.map((p) => toWorld(el, p));
}

/** Where the rotate knob sits: 24 screen px above the top edge's middle. Null if `el` can't turn. */
export function rotateHandleOf(el: BoardElement, scale: number): Point | null {
  if (!canRotate(el)) return null;
  const b = boxOf(el);
  return toWorld(el, { x: b.x + b.width / 2, y: b.y - 24 / scale });
}

/** The rotation a drag of the knob to `p` implies; within 4° of a 15° step it snaps there. */
export function rotationFromDrag(el: BoardElement, p: Point): number {
  const c = centreOf(boxOf(el));
  const angle = Math.atan2(p.y - c.y, p.x - c.x) + Math.PI / 2;
  const step = Math.PI / 12;
  const snapped = Math.round(angle / step) * step;
  const out = Math.abs(angle - snapped) < Math.PI / 45 ? snapped : angle;
  return Math.atan2(Math.sin(out), Math.cos(out));
}

/**
 * The patch that makes `el`'s unturned box `nb` (given in its current local
 * frame) while it keeps its rotation — so whatever `nb` shares with the old
 * box, e.g. the pinned corner, stays exactly where it was on the board.
 */
function placeBox(el: BoardElement, nb: Bounds): Partial<BoardElement> {
  const c = toWorld(el, centreOf(nb));
  const at = { x: c.x - nb.width / 2, y: c.y - nb.height / 2 };
  if (el.kind === 'shape') return { from: at, to: { x: at.x + nb.width, y: at.y + nb.height } };
  if (el.kind === 'image') return { at, width: nb.width, height: nb.height };
  return { at };
}

/**
 * `el` after handle `h` is dragged to `p`, as a patch. A box stretches freely;
 * an image and a text scale (an image keeps its proportions, a text grows its
 * font); a text's edge handle re-wraps it. The opposite corner stays put.
 */
export function resizeElement(el: BoardElement, h: number, p: Point): Partial<BoardElement> {
  if (el.kind === 'stroke') return {};
  if (el.kind === 'shape' && isLineLike(el)) return resizeShape(el, h, p);
  const b = boxOf(el);
  const q = toLocal(el, p);

  if (el.kind === 'text' && h === TEXT_WIDTH_HANDLE) {
    const width = Math.max(el.fontSize, q.x - b.x);
    const nb = textBox({ ...el, width });
    return { width, ...placeBox(el, { ...nb, x: b.x, y: b.y }) };
  }

  const o = cornersOfBox(b)[(h + 2) % 4];
  // The new box grows from the pinned corner `o` towards the pointer.
  const boxFrom = (width: number, height: number): Bounds => ({
    x: q.x < o.x ? o.x - width : o.x,
    y: q.y < o.y ? o.y - height : o.y,
    width,
    height,
  });
  const dw = Math.abs(q.x - o.x);
  const dh = Math.abs(q.y - o.y);
  if (el.kind === 'shape') return placeBox(el, boxFrom(Math.max(1, dw), Math.max(1, dh)));

  const s = Math.max(dw / (b.width || 1), dh / (b.height || 1));
  if (el.kind === 'image') {
    return placeBox(el, boxFrom(Math.max(8, b.width * s), Math.max(8, b.height * s)));
  }
  const fontSize = Math.round(clamp(el.fontSize * s, LIMITS.minFontSize, LIMITS.maxFontSize));
  const k = fontSize / el.fontSize;
  const width = el.width ? el.width * k : undefined;
  const nb = textBox({ ...el, fontSize, width });
  return { fontSize, ...(width ? { width } : null), ...placeBox(el, boxFrom(nb.width, nb.height)) };
}

const MIN_SIDES = LIMITS.minSides;
const MAX_SIDES = LIMITS.maxSides;

/** A regular polygon's corners inside `b`, the first straight up, on the box's inscribed ellipse. */
export function polygonPoints(b: Bounds, sides = DEFAULT_SIDES): Point[] {
  'worklet';
  // Nothing captured but plain numbers and functions declared above it: a
  // worklet takes what it names when it is created, so a `const` helper
  // declared further down the file is `undefined` in it (this once named
  // `clamp`), and `LIMITS` holds a RegExp, which cannot cross to the UI thread.
  const n = Math.round(Math.max(MIN_SIDES, Math.min(MAX_SIDES, sides)));
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    out.push({ x: b.x + (b.width / 2) * (1 + Math.cos(a)), y: b.y + (b.height / 2) * (1 + Math.sin(a)) });
  }
  return out;
}

/** Figures with corners to round: not the ellipse, not the lines. */
export const canRound = (shape: ShapeElement['shape']): boolean => shape === 'rectangle' || shape === 'triangle' || shape === 'polygon';

/** How round a rounded figure's corners are: a share of its shorter side. */
export function cornerRadius(width: number, height: number): number {
  return Math.min(width, height) * 0.18;
}

/**
 * A closed polygon as an SVG path with every corner rounded: the corner is cut
 * back `r` along both edges (at most half of each, so neighbours never overlap)
 * and joined by a curve through the original vertex.
 */
export function roundedPolygonPath(pts: Point[], r: number): string {
  const f = (v: number) => Math.round(v * 100) / 100;
  const n = pts.length;
  let d = '';
  pts.forEach((p, i) => {
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a.x - p.x, a.y - p.y);
    const lb = Math.hypot(b.x - p.x, b.y - p.y);
    const k = Math.min(r, la / 2, lb / 2);
    const s = la ? { x: p.x + ((a.x - p.x) / la) * k, y: p.y + ((a.y - p.y) / la) * k } : p;
    const e = lb ? { x: p.x + ((b.x - p.x) / lb) * k, y: p.y + ((b.y - p.y) / lb) * k } : p;
    d += `${i ? 'L' : 'M'}${f(s.x)} ${f(s.y)}Q${f(p.x)} ${f(p.y)} ${f(e.x)} ${f(e.y)}`;
  });
  return `${d}Z`;
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
// a fraction (u, v) of the shape's box, so it follows the shape when it moves
// or resizes (`followLinks`). What a shape offers is on its real outline — an
// ellipse's eight, a triangle's and a polygon's corners and the middle of each
// side, a rectangle's corners and sides' middles — plus its centre: dropping
// there aims at the other end instead of pinning a spot. Near none of them, the
// end pins the nearest point of the outline.

/** What a line end can bind to: an enclosed shape or an image. */
export const isLinkTarget = (el: BoardElement): boolean =>
  el.kind === 'image' || (el.kind === 'shape' && !isLineLike(el));

/** A link target's outline in its own unturned frame: an ellipse's box, or a polygon's corners. */
type Outline = { ellipse: Bounds } | { poly: Point[] };

function outlineOf(el: BoardElement): Outline {
  const b = boxOf(el);
  if (el.kind === 'shape') {
    if (el.shape === 'ellipse') return { ellipse: b };
    if (el.shape === 'triangle') {
      return { poly: [{ x: b.x + b.width / 2, y: b.y }, { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }] };
    }
    if (el.shape === 'polygon') return { poly: polygonPoints(b, el.sides) };
  }
  return { poly: cornersOfBox(b) };
}

/** The connection points on the outline, in the element's unturned frame. */
function localAnchors(el: BoardElement): Point[] {
  const o = outlineOf(el);
  if ('ellipse' in o) {
    const { x, y, width, height } = o.ellipse;
    return Array.from({ length: 8 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / 4;
      return { x: x + (width / 2) * (1 + Math.cos(a)), y: y + (height / 2) * (1 + Math.sin(a)) };
    });
  }
  const out: Point[] = [];
  o.poly.forEach((p, i) => {
    const next = o.poly[(i + 1) % o.poly.length];
    out.push(p, { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 });
  });
  return out;
}

/** The connection points of a link target on the board: its centre, then the ones on its outline. */
export function anchorsOf(el: BoardElement): Point[] {
  if (!isLinkTarget(el)) return [];
  return [centreOf(boxOf(el)), ...localAnchors(el).map((p) => toWorld(el, p))];
}

/** Where a link lands on its target's current (turned) box. */
export function linkPoint(el: BoardElement, link: Link): Point {
  const b = boxOf(el);
  return toWorld(el, { x: b.x + link.u * b.width, y: b.y + link.v * b.height });
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

/** The point of the segment `a`→`b` nearest to `p`. */
function nearestOnSegment(a: Point, b: Point, p: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1) : 0;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** The point of a link target's real outline nearest to `p` (unturned frame). */
function outlinePoint(el: BoardElement, p: Point): Point {
  const o = outlineOf(el);
  if ('ellipse' in o) {
    const { x, y, width, height } = o.ellipse;
    const rx = width / 2;
    const ry = height / 2;
    const dx = rx ? (p.x - x - rx) / rx : 0;
    const dy = ry ? (p.y - y - ry) / ry : -1;
    const len = Math.hypot(dx, dy) || 1;
    return { x: x + rx + (dx / len) * rx, y: y + ry + (dy / len) * ry };
  }
  if (o.poly.length === 4 && (el.kind === 'image' || (el.kind === 'shape' && el.shape === 'rectangle'))) {
    return edgePoint(p, boxOf(el));
  }
  let best = o.poly[0];
  for (let i = 0; i < o.poly.length; i++) {
    const q = nearestOnSegment(o.poly[i], o.poly[(i + 1) % o.poly.length], p);
    if (dist(q, p) < dist(best, p)) best = q;
  }
  return best;
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

/** Where the ray from a link target's centre towards `target` leaves its real outline (unturned frame). */
function rayToOutline(el: BoardElement, target: Point): Point {
  const o = outlineOf(el);
  const b = boxOf(el);
  if (!('ellipse' in o) && o.poly.length === 4 && (el.kind === 'image' || (el.kind === 'shape' && el.shape === 'rectangle'))) {
    return rayToBox(target, b);
  }
  const c = centreOf(b);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (!dx && !dy) return outlinePoint(el, c);
  if ('ellipse' in o) {
    const k = 1 / Math.hypot(dx / (b.width / 2 || 1), dy / (b.height / 2 || 1));
    return { x: c.x + dx * k, y: c.y + dy * k };
  }
  // The nearest crossing of the ray with a side.
  let best: Point | null = null;
  let bestT = Infinity;
  for (let i = 0; i < o.poly.length; i++) {
    const a = o.poly[i];
    const e = o.poly[(i + 1) % o.poly.length];
    const sx = e.x - a.x;
    const sy = e.y - a.y;
    const den = dx * sy - dy * sx;
    if (!den) continue;
    const t = ((a.x - c.x) * sy - (a.y - c.y) * sx) / den;
    const s = ((a.x - c.x) * dy - (a.y - c.y) * dx) / den;
    if (t > 0 && s >= 0 && s <= 1 && t < bestT) {
      bestT = t;
      best = { x: c.x + dx * t, y: c.y + dy * t };
    }
  }
  return best ?? outlinePoint(el, c);
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
  const enclosed = elements.filter(isLinkTarget);
  const centre = (el: BoardElement) => centreOf(boxOf(el));
  // Worked out in the target's unturned frame, then turned back onto the board.
  const bind = (el: BoardElement | null, p: Point, other: Point) => {
    if (!el) return { p, link: null };
    const b = boxOf(el);
    const c = centre(el);
    const lp = toLocal(el, p);
    // The nearest connection point, when the end is within reach of one.
    let near: Point | null = null;
    for (const a of localAnchors(el)) {
      if (Math.hypot(a.x - lp.x, a.y - lp.y) <= radius && (!near || dist(a, lp) < dist(near, lp))) near = a;
    }
    const at =
      Math.hypot(lp.x - c.x, lp.y - c.y) <= radius
        ? rayToOutline(el, toLocal(el, other))
        : (near ?? outlinePoint(el, lp));
    return {
      p: toWorld(el, at),
      link: {
        id: el.id,
        u: b.width ? (at.x - b.x) / b.width : 0.5,
        v: b.height ? (at.y - b.y) / b.height : 0.5,
      },
    };
  };
  const a = targetAt(enclosed, from, radius);
  const b = targetAt(enclosed, to, radius);
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
    // Only arrows bind; a plain line from an older board keeps its ends where they are.
    if (el.kind !== 'shape' || el.shape !== 'arrow') continue;
    // Only the end that is bound to a moved shape changes: patching the other
    // one too would make an undo rewind wherever a collaborator had put it.
    const end = (link: Link | null | undefined) => {
      const target = link && ids.has(link.id) ? byId.get(link.id) : undefined;
      return target && isLinkTarget(target) ? linkPoint(target, link!) : undefined;
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

/** The topmost link target (shape or image) under `at`. */
function targetAt(elements: BoardElement[], at: Point, pad: number): BoardElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.kind === 'shape' ? shapeHit(el, at, pad) : inBox(toLocal(el, at), boxOf(el), pad)) return el;
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
    const pts = routePoints(el);
    const reach = pad + el.strokeWidth / 2;
    for (let i = 1; i < pts.length; i++) {
      if (segmentDistance(pts[i - 1], pts[i], at) <= reach) return true;
    }
    // The line is cut away behind its label, which is still part of it.
    if (el.text) {
      const size = el.fontSize ?? SHAPE_TEXT_SIZE;
      return inBox(at, labelBox(el, labelLines(el, size), size), pad);
    }
    return false;
  }
  return inBox(toLocal(el, at), shapeBounds(el), pad);
}

/** Distance from `p` to the segment ab. */
function segmentDistance(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * What a route is drawn from: a line's own fields (a `ShapeElement` fits), or
 * just two points and a kind for an icon.
 */
export interface RouteSpec {
  from: Point;
  to: Point;
  route?: Route;
  bend?: number;
  startAxis?: Axis | null;
  endAxis?: Axis | null;
  curveFrom?: Point | null;
  curveTo?: Point | null;
  fromLink?: Link | null;
  toLink?: Link | null;
}

/** The route as a polyline: the curve is sampled, the others are their corners. */
function routePoints(r: RouteSpec): Point[] {
  if (r.route === 'elbow') return elbowPoints(r);
  if (r.route !== 'curved') return [r.from, r.to];
  const pts: Point[] = [];
  for (let i = 0; i <= 24; i++) pts.push(curvePoint(r, i / 24));
  return pts;
}

// --- routes, dashes and markers ----------------------------------------------
// Everything a line is made of, as SVG path strings: Skia draws a string as-is
// (`<Path path=...>`) and so does react-native-svg, so the toolbar's option
// icons are drawn by the very same generators as the board.

/**
 * The bow of a curved route in its original form: `bend` board units to the
 * side of the chord's midpoint (positive: left of from→to), a quarter of the
 * chord's length when absent. A curve nobody has shaped still has this look.
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

// An elbow is a run of right angles. A bound end decides its own direction: it
// leaves its shape straight out of the side it sits on, `ELBOW_GAP` units, and
// the route goes around that shape rather than through it — the way a
// diagramming tool draws it. A free end runs along the long axis, or along the
// one its corner handle was dragged to. Two ends on the same axis make three
// segments (and a middle to drag); two different axes, a single corner.

/** How far an elbow leaves a bound shape before it may turn, and keeps clear of it after. */
const ELBOW_GAP = 18;
/** What a corner costs, in units of length: of two routes, the one with fewer corners wins. */
const ELBOW_TURN = 40;

type Dir = 0 | 1 | 2 | 3; // +x, -x, +y, -y
const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
const opposite = (d: Dir): Dir => (d ^ 1) as Dir;
const axisOfDir = (d: Dir): Axis => (d < 2 ? 'h' : 'v');
const grow = (b: Bounds, g: number): Bounds => ({
  x: b.x - g,
  y: b.y - g,
  width: b.width + 2 * g,
  height: b.height + 2 * g,
});

/** The boxes of the shapes lines are bound to, set once by the store so a route can go around them. */
let boxLookup: ((id: string) => Bounds | undefined) | null = null;
export function setBoxLookup(lookup: (id: string) => Bounds | undefined) {
  boxLookup = lookup;
}

/** Where a bound end leaves its shape: which way, the tip of the stub it runs out to, and the shape's box. */
interface Exit {
  d: Dir;
  tip: Point;
  box: Bounds | null;
}

/**
 * How a bound end leaves its shape: straight out, away from the shape's
 * centre along whichever axis the end sits furthest along — so every kind of
 * link has one (a side's middle, a corner, any point of an ellipse's or a
 * triangle's outline, a turned shape), not only a rectangle's four sides. The
 * stub runs on to the edge of the shape's box and a gap beyond it, so the turn
 * is always clear of the shape. Rank 1 is the second-best way out. Null for a free end.
 */
function exitOf(link: Link | null | undefined, p: Point, gap = ELBOW_GAP, rank = 0): Exit | null {
  if (!link) return null;
  const box = boxLookup?.(link.id) ?? null;
  if (!box) {
    // No box to measure against: the side the link sits on, if it sits on one.
    const d: Dir | null = link.u <= 0.02 ? 1 : link.u >= 0.98 ? 0 : link.v <= 0.02 ? 3 : link.v >= 0.98 ? 2 : null;
    return d === null ? null : { d, tip: { x: p.x + DIRS[d].x * gap, y: p.y + DIRS[d].y * gap }, box };
  }
  const nx = (p.x - (box.x + box.width / 2)) / Math.max(box.width / 2, 1);
  const ny = (p.y - (box.y + box.height / 2)) / Math.max(box.height / 2, 1);
  const horizontal: Dir = nx >= 0 ? 0 : 1;
  const vertical: Dir = ny >= 0 ? 2 : 3;
  // Rank 1 is the other way out, for when something stands in the first.
  const d = (Math.abs(nx) >= Math.abs(ny)) === (rank === 0) ? horizontal : vertical;
  const wall = grow(box, gap);
  const tip =
    d === 0 ? { x: wall.x + wall.width, y: p.y }
    : d === 1 ? { x: wall.x, y: p.y }
    : d === 2 ? { x: p.x, y: wall.y + wall.height }
    : { x: p.x, y: wall.y };
  return { d, tip, box };
}

/** The axis an elbow leaves its start along, and arrives at its end along. */
export function elbowAxes(r: RouteSpec): [Axis, Axis] {
  const long: Axis = Math.abs(r.to.x - r.from.x) >= Math.abs(r.to.y - r.from.y) ? 'h' : 'v';
  const a = exitOf(r.fromLink, r.from);
  const b = exitOf(r.toLink, r.to);
  return [a ? axisOfDir(a.d) : (r.startAxis ?? long), b ? axisOfDir(b.d) : (r.endAxis ?? long)];
}

/** Whether a corner handle can turn this elbow: only when no end is held by its shape. */
function turnable(r: RouteSpec): boolean {
  return !r.fromLink && !r.toLink;
}

/** Drops repeated points and the middle of any three in a straight line. */
function tidy(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    const same = (u: number, v: number) => Math.abs(u - v) <= 1e-6;
    if (last && same(last.x, p.x) && same(last.y, p.y)) continue;
    const before = out[out.length - 2];
    if (before && last && ((same(before.x, last.x) && same(last.x, p.x)) || (same(before.y, last.y) && same(last.y, p.y)))) {
      out[out.length - 1] = p;
    } else out.push(p);
  }
  return out;
}

/**
 * The cheapest run of right angles from `s` to `e` that keeps off every wall:
 * length plus a price per corner, leaving by `da` and arriving by `db` where
 * they are known, otherwise along `a` and `b`. Null when there is none.
 */
function runBetween(
  s: Point,
  e: Point,
  a: Axis,
  b: Axis,
  da: Dir | null,
  db: Dir | null,
  t: number,
  walls: Bounds[],
): Point[] | null {
  // The lines a route may run along: where the ends are, the bend, the walls' edges.
  // Exact values, merged when a hair apart: a corner must land on the very coordinate of the end it meets.
  const uniq = (v: number[]) =>
    [...v].sort((p, q) => p - q).filter((x, i, all) => i === 0 || x - all[i - 1] > 1e-6);
  const xs = uniq([s.x, e.x, s.x + (e.x - s.x) * t, ...walls.flatMap((w) => [w.x, w.x + w.width])]);
  const ys = uniq([s.y, e.y, s.y + (e.y - s.y) * t, ...walls.flatMap((w) => [w.y, w.y + w.height])]);
  const at = (arr: number[], v: number) => arr.findIndex((x) => Math.abs(x - v) <= 1e-6);
  const blocked = (p: Point, q: Point) => {
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    return walls.some((w) => mx > w.x && mx < w.x + w.width && my > w.y && my < w.y + w.height);
  };

  const W = xs.length;
  const idx = (i: number, j: number, d: number) => (j * W + i) * 4 + d;
  const dist = new Array<number>(W * ys.length * 4).fill(Infinity);
  const prev = new Array<number>(dist.length).fill(-1);
  const open: number[] = [];
  const si = at(xs, s.x);
  const sj = at(ys, s.y);
  // A free start may leave along its axis only; a bound one has already left, and may turn at the stub's tip.
  for (const d of [0, 1, 2, 3] as Dir[]) {
    if (da === null ? axisOfDir(d) === a : d === da) {
      dist[idx(si, sj, d)] = 0;
      open.push(idx(si, sj, d));
    }
  }
  while (open.length) {
    let best = 0;
    for (let k = 1; k < open.length; k++) if (dist[open[k]] < dist[open[best]]) best = k;
    const cur = open.splice(best, 1)[0];
    const d = (cur % 4) as Dir;
    const cell = (cur - d) / 4;
    const i = cell % W;
    const j = (cell - i) / W;
    const isStart = i === si && j === sj && dist[cur] === 0;
    for (const nd of [0, 1, 2, 3] as Dir[]) {
      if (nd === opposite(d)) continue;
      // From a free start the first move runs along its axis, whichever way it points.
      if (isStart && da === null && axisOfDir(nd) !== a) continue;
      const ni = i + DIRS[nd].x;
      const nj = j + DIRS[nd].y;
      if (ni < 0 || nj < 0 || ni >= W || nj >= ys.length) continue;
      if (blocked({ x: xs[i], y: ys[j] }, { x: xs[ni], y: ys[nj] })) continue;
      const cost =
        dist[cur] + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]) + (nd === d ? 0 : ELBOW_TURN);
      const next = idx(ni, nj, nd);
      if (cost < dist[next]) {
        dist[next] = cost;
        prev[next] = cur;
        if (!open.includes(next)) open.push(next);
      }
    }
  }
  let end = -1;
  let endCost = Infinity;
  for (const d of [0, 1, 2, 3] as Dir[]) {
    const node = idx(at(xs, e.x), at(ys, e.y), d);
    // A bound end is entered by the way in (a turn at the stub's tip costs a corner); a free one along its axis.
    const arrive =
      db === null ? (axisOfDir(d) === b ? 0 : Infinity) : d === opposite(db) ? 0 : d === db ? Infinity : ELBOW_TURN;
    if (dist[node] + arrive < endCost) {
      endCost = dist[node] + arrive;
      end = node;
    }
  }
  if (end < 0 || endCost === Infinity) return null;
  const path: Point[] = [];
  for (let n = end; n >= 0; n = prev[n]) {
    const cell = (n - (n % 4)) / 4;
    path.push({ x: xs[cell % W], y: ys[(cell - (cell % W)) / W] });
  }
  return path.reverse();
}

/** What an elbow is made of: its corners, the two ends' exits (null for a free end), and what it keeps clear of. */
interface ElbowPlan {
  /** The route as it runs when nobody has moved its middle. */
  base: Point[];
  /** The route as drawn: `base` with the middle segment where `bend` put it. */
  pts: Point[];
  start: Exit | null;
  end: Exit | null;
  walls: Bounds[];
}

/**
 * An elbow's corners. Never through a shape the line is bound to: each end
 * tries its best way out first, then the other; the gap tightens when the
 * shapes are close, so a stub never reaches into the other one.
 */
function elbowBase(r: RouteSpec): Omit<ElbowPlan, 'pts'> {
  const { from, to } = r;
  const long: Axis = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? 'h' : 'v';
  for (const [ra, rb] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    for (const gap of [ELBOW_GAP, ELBOW_GAP / 2, ELBOW_GAP / 4, 2, 1, 0.25]) {
      const ex = exitOf(r.fromLink, from, gap, ra);
      const ey = exitOf(r.toLink, to, gap, rb);
      // A bound end's axis is the way it leaves; a free one's, its own or the long one.
      const a = ex ? axisOfDir(ex.d) : (r.startAxis ?? long);
      const b = ey ? axisOfDir(ey.d) : (r.endAxis ?? long);
      const walls = [ex?.box, ey?.box].filter((x): x is Bounds => !!x).map((x) => grow(x, gap));
      const path = runBetween(ex?.tip ?? from, ey?.tip ?? to, a, b, ex ? ex.d : null, ey ? ey.d : null, 0.5, walls);
      if (path) return { base: tidy([from, ...path, to]), start: ex, end: ey, walls };
    }
  }
  // Shapes touching or overlapping: no way round either; out and in by the shortest.
  const ex = exitOf(r.fromLink, from);
  const ey = exitOf(r.toLink, to);
  const a = ex ? axisOfDir(ex.d) : (r.startAxis ?? long);
  const b = ey ? axisOfDir(ey.d) : (r.endAxis ?? long);
  const path = runBetween(ex?.tip ?? from, ey?.tip ?? to, a, b, ex ? ex.d : null, ey ? ey.d : null, 0.5, []);
  return { base: tidy([from, ...(path ?? []), to]), start: ex, end: ey, walls: [] };
}

/**
 * The segment a line's handle moves: the middle one, when the route has
 * corners on both sides of it (three segments or more). -1 for a straight
 * line or a single corner, which have none.
 */
const middleOf = (pts: Point[]): number => (pts.length >= 4 ? Math.floor((pts.length - 1) / 2) : -1);

/** Whether the segment `k` runs up and down (and so is moved sideways). */
const isVertical = (pts: Point[], k: number): boolean => pts[k].x === pts[k + 1].x;

/** Where `bend` puts the middle segment: a fraction of the way from one end's tip to the other's. */
function bendTarget(plan: Omit<ElbowPlan, 'pts'>, r: RouteSpec, k: number, bend: number): number {
  const along = isVertical(plan.base, k) ? 'x' : 'y';
  const S = (plan.start?.tip ?? r.from)[along];
  const E = (plan.end?.tip ?? r.to)[along];
  // Ends level with each other leave no span to measure by; a fixed one stands in.
  return S + bend * (Math.abs(E - S) >= 1 ? E - S : ELBOW_GAP * 4);
}

/**
 * The route with its middle segment at `c`, or null if that is not a route
 * this line can take: the segments either side of it would turn back on
 * themselves, run short of a stub's tip, or cross a shape it keeps clear of.
 */
function shifted(plan: Omit<ElbowPlan, 'pts'>, k: number, c: number): Point[] | null {
  const { base, start, end, walls } = plan;
  const vertical = isVertical(base, k);
  const get = (p: Point) => (vertical ? p.x : p.y);
  const before = base[k - 1];
  const after = base[k + 2];
  const lim0 = k - 1 === 0 && start ? start.tip : before;
  const lim1 = k + 2 === base.length - 1 && end ? end.tip : after;
  const d0 = Math.sign(get(base[k]) - get(before));
  const d1 = Math.sign(get(after) - get(base[k + 1]));
  if ((c - get(lim0)) * d0 < 0 || (get(lim1) - c) * d1 < 0) return null;
  if (lim0 === before && (c - get(lim0)) * d0 === 0) return null;
  if (lim1 === after && (get(lim1) - c) * d1 === 0) return null;
  const q = base.map((p) => ({ ...p }));
  if (vertical) {
    q[k].x = c;
    q[k + 1].x = c;
  } else {
    q[k].y = c;
    q[k + 1].y = c;
  }
  // A stub starts inside its shape's wall: measured from its tip on.
  const check = q.map((p) => ({ ...p }));
  if (start) check[0] = start.tip;
  if (end) check[check.length - 1] = end.tip;
  for (let i = 1; i < check.length; i++) {
    const p = check[i - 1];
    const o = check[i];
    const x0 = Math.min(p.x, o.x);
    const x1 = Math.max(p.x, o.x);
    const y0 = Math.min(p.y, o.y);
    const y1 = Math.max(p.y, o.y);
    if (walls.some((w) => x1 > w.x && x0 < w.x + w.width && y1 > w.y && y0 < w.y + w.height)) return null;
  }
  return q;
}

function elbowPlan(r: RouteSpec): ElbowPlan {
  const plan = elbowBase(r);
  const k = middleOf(plan.base);
  const moved = k >= 0 && r.bend !== undefined ? shifted(plan, k, bendTarget(plan, r, k, r.bend)) : null;
  return { ...plan, pts: moved ?? plan.base };
}

const elbowPoints = (r: RouteSpec): Point[] => elbowPlan(r).pts;

// A curve is a cubic with a handle at each end: how far and which way the line
// pulls as it leaves the start and as it arrives. A curve nobody has shaped is
// the original quadratic bow, which the same cubic draws exactly.

/** Where a curve's two control points stand, as offsets from the start and from the end. */
function curveOffsets(r: RouteSpec): [Point, Point] {
  const q = control(r.from, r.to, r.bend);
  const own: [Point, Point] = [
    { x: ((q.x - r.from.x) * 2) / 3, y: ((q.y - r.from.y) * 2) / 3 },
    { x: ((q.x - r.to.x) * 2) / 3, y: ((q.y - r.to.y) * 2) / 3 },
  ];
  return [r.curveFrom ?? own[0], r.curveTo ?? own[1]];
}

/** A curve's two control points on the board. */
export function curveControls(r: RouteSpec): [Point, Point] {
  const [a, b] = curveOffsets(r);
  return [
    { x: r.from.x + a.x, y: r.from.y + a.y },
    { x: r.to.x + b.x, y: r.to.y + b.y },
  ];
}

/** The point `t` (0..1) of the way along a curve, by its parameter. */
function curvePoint(r: RouteSpec, t: number): Point {
  const [c1, c2] = curveControls(r);
  const u = 1 - t;
  return {
    x: u * u * u * r.from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * r.to.x,
    y: u * u * u * r.from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * r.to.y,
  };
}

export function routePath(r: RouteSpec): string {
  if (r.route === 'curved') {
    const [c1, c2] = curveControls(r);
    return `M ${n(r.from.x)} ${n(r.from.y)} C ${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(r.to.x)} ${n(r.to.y)}`;
  }
  const pts = r.route === 'elbow' ? elbowPoints(r) : [r.from, r.to];
  return pts.map((p, i) => `${i ? 'L' : 'M'} ${n(p.x)} ${n(p.y)}`).join(' ');
}

/** The outward direction at each end, for the markers. */
export function endAngles(r: RouteSpec): { start: number; end: number } {
  const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
  const { from, to } = r;
  if (r.route === 'curved') {
    const [c1, c2] = curveControls(r);
    // A handle lying on its end has no direction; look at the other handle, then the chord.
    const out = (end: Point, own: Point, other: Point, far: Point) => {
      if (own.x !== end.x || own.y !== end.y) return angle(own, end);
      return other.x !== end.x || other.y !== end.y ? angle(other, end) : angle(far, end);
    };
    return { start: out(from, c1, c2, to), end: out(to, c2, c1, from) };
  }
  const pts = r.route === 'elbow' ? elbowPoints(r) : [from, to];
  const inner = (a: Point, b: Point) => (a.x === b.x && a.y === b.y ? null : b);
  // A zero-length elbow segment has no direction; fall back to the chord.
  const s = inner(from, pts[1]) ?? to;
  const e = inner(to, pts[pts.length - 2]) ?? from;
  return { start: angle(s, from), end: angle(e, to) };
}

/**
 * Where an elbow's handle sits: the centre of its middle segment, on any route
 * with corners either side of one — drag it to put the line where you want it.
 * A single corner between two free ends has the corner itself: drag it across
 * to the other corner of the box to turn the route over. Null for anything else.
 */
export function bendHandleOf(el: RouteSpec & Pick<ShapeElement, 'shape'>): Point | null {
  if (!isLineLike(el) || el.route !== 'elbow') return null;
  const pts = elbowPoints(el);
  const k = middleOf(pts);
  if (k >= 0) return { x: (pts[k].x + pts[k + 1].x) / 2, y: (pts[k].y + pts[k + 1].y) / 2 };
  return pts.length === 3 && turnable(el) ? pts[1] : null;
}

/**
 * The patch a drag of an elbow's handle to `p` makes: where the middle segment
 * stands (`bend`), as far as the route allows — it stops where the segments
 * beside it would turn back, or the line would reach a shape — or which way
 * the single corner turns.
 */
export function elbowDragPatch(el: RouteSpec, p: Point): { bend: number } | { startAxis: Axis; endAxis: Axis } {
  const plan = elbowBase(el);
  const k = middleOf(plan.base);
  if (k < 0) {
    const along = Math.abs(p.x - el.to.x) + Math.abs(p.y - el.from.y) <= Math.abs(p.x - el.from.x) + Math.abs(p.y - el.to.y);
    return along ? { startAxis: 'h', endAxis: 'v' } : { startAxis: 'v', endAxis: 'h' };
  }
  const vertical = isVertical(plan.base, k);
  const want = vertical ? p.x : p.y;
  let c = want;
  if (!shifted(plan, k, c)) {
    // The nearest place towards the finger that the route can still take.
    let ok = vertical ? plan.base[k].x : plan.base[k].y;
    let bad = want;
    for (let i = 0; i < 12; i++) {
      const mid = (ok + bad) / 2;
      if (shifted(plan, k, mid)) ok = mid;
      else bad = mid;
    }
    c = ok;
  }
  const along = vertical ? 'x' : 'y';
  const S = (plan.start?.tip ?? el.from)[along];
  const E = (plan.end?.tip ?? el.to)[along];
  return { bend: (c - S) / (Math.abs(E - S) >= 1 ? E - S : ELBOW_GAP * 4) };
}

/** The three handles of a curved line: its pull at the start, at the end, and its middle. `null` for any other line. */
export function curveHandlesOf(
  el: RouteSpec & Pick<ShapeElement, 'shape'>,
): { start: Point; end: Point; mid: Point } | null {
  if (!isLineLike(el) || el.route !== 'curved') return null;
  const [start, end] = curveControls(el);
  return { start, end, mid: curvePoint(el, 0.5) };
}

/** The patch a drag of one of a curve's handles to `p` makes: the pull at an end, or the whole bow sideways. */
export function curveFromDrag(el: RouteSpec, which: 'start' | 'end' | 'mid', p: Point): { curveFrom: Point; curveTo: Point } {
  const [a, b] = curveOffsets(el);
  const r2 = (q: Point) => ({ x: n(q.x), y: n(q.y) });
  if (which === 'start') return { curveFrom: r2({ x: p.x - el.from.x, y: p.y - el.from.y }), curveTo: r2(b) };
  if (which === 'end') return { curveFrom: r2(a), curveTo: r2({ x: p.x - el.to.x, y: p.y - el.to.y }) };
  // Moving the middle of a cubic by d takes both control points 4/3 d.
  const m = curvePoint(el, 0.5);
  const dx = ((p.x - m.x) * 4) / 3;
  const dy = ((p.y - m.y) * 4) / 3;
  return { curveFrom: r2({ x: a.x + dx, y: a.y + dy }), curveTo: r2({ x: b.x + dx, y: b.y + dy }) };
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

// --- a sketched shape, recognised ----------------------------------------------
// A pen stroke held still at its end is read as the figure it was meant to be
// (`recognizeSketch`): a loop becomes an ellipse — a circle when it is about as
// tall as wide — a loop with four corners a rectangle (a square), with three a
// triangle; a straight run becomes a line, and a straight run with a hook at
// its tip an arrow. Anything else stays the stroke it was.

export interface Sketch {
  shape: 'ellipse' | 'rectangle' | 'triangle' | 'polygon' | 'line' | 'arrow';
  /** A polygon's corner count. */
  sides?: number;
  from: Point;
  to: Point;
}

/** How sharply the loop has to turn, in degrees, for a corner. */
const CORNER_DEG = 55;
/** The gentler turn a polygon's corners are looked for at: five or more corners turn less. */
const SOFT_CORNER_DEG = 30;

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function pathLength(p: Point[]): number {
  let total = 0;
  for (let i = 1; i < p.length; i++) total += dist(p[i - 1], p[i]);
  return total;
}

function boundsOf(p: Point[]): Bounds {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const q of p) {
    x0 = Math.min(x0, q.x);
    y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x);
    y1 = Math.max(y1, q.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** `n` points evenly spaced round the closed loop through `p`: fast and slow parts of a stroke weigh the same. */
function resampleLoop(p: Point[], n: number): Point[] {
  const loop = [...p, p[0]];
  const step = pathLength(loop) / n;
  const out: Point[] = [loop[0]];
  let carried = 0;
  for (let i = 1; i < loop.length && out.length < n; i++) {
    let a = loop[i - 1];
    const b = loop[i];
    let d = dist(a, b);
    while (carried + d >= step && out.length < n) {
      const t = (step - carried) / d;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(a);
      d = dist(a, b);
      carried = 0;
    }
    carried += d;
  }
  return out;
}

/** The loop's corners — where it turns sharply, one per turn — with how sharply. */
function cornersOf(q: Point[], minTurn = CORNER_DEG): { i: number; turn: number }[] {
  const n = q.length;
  const k = 3;
  const turn = q.map((p, i) => {
    const a = q[(i - k + n) % n];
    const b = q[(i + k) % n];
    const ux = p.x - a.x;
    const uy = p.y - a.y;
    const vx = b.x - p.x;
    const vy = b.y - p.y;
    const cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1);
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  });
  const out: { i: number; turn: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (turn[i] < minTurn) continue;
    let peak = true;
    for (let d = 1; d <= k && peak; d++) {
      peak = turn[i] >= turn[(i + d) % n] && turn[i] > turn[(i - d + n) % n];
    }
    if (peak) out.push({ i, turn: turn[i] });
  }
  return out;
}

/** Mean distance from the loop to the polygon through `corners`, relative to its size. */
function polygonError(q: Point[], corners: Point[], size: number): number {
  let sum = 0;
  for (const p of q) {
    let best = Infinity;
    for (let i = 0; i < corners.length; i++) {
      best = Math.min(best, segmentDistance(corners[i], corners[(i + 1) % corners.length], p));
    }
    sum += best;
  }
  return sum / q.length / size;
}

/** Mean radial distance from the loop to the ellipse inscribed in `b`, relative to its size. */
function ellipseError(q: Point[], b: Bounds): number {
  const rx = b.width / 2;
  const ry = b.height / 2;
  if (!rx || !ry) return Infinity;
  const cx = b.x + rx;
  const cy = b.y + ry;
  let sum = 0;
  for (const p of q) sum += Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1);
  return sum / q.length;
}

/** The figure over `b`; about as tall as wide, it was meant square (round), so it is. */
function boxed(shape: Sketch['shape'], b: Bounds): Sketch {
  if (shape !== 'triangle' && Math.abs(b.width - b.height) <= 0.15 * Math.max(b.width, b.height)) {
    const s = (b.width + b.height) / 2;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    return { shape, from: { x: cx - s / 2, y: cy - s / 2 }, to: { x: cx + s / 2, y: cy + s / 2 } };
  }
  return { shape, from: { x: b.x, y: b.y }, to: { x: b.x + b.width, y: b.y + b.height } };
}

function closedSketch(loop: Point[]): Sketch | null {
  const b = boundsOf(loop);
  const q = resampleLoop(loop, 64);
  const size = (b.width + b.height) / 4;
  // The corners a sketch turns at, at the gentle threshold: a corner drawn a
  // little soft is still a corner (a four-sided shape with one of them missed
  // used to be read as a triangle).
  const soft = cornersOf(q, SOFT_CORNER_DEG);
  // The strongest n corners, in their order round the loop.
  const polygon = (n: number) =>
    soft.length < n
      ? null
      : [...soft]
          .sort((a, c) => c.turn - a.turn)
          .slice(0, n)
          .sort((a, c) => a.i - c.i)
          .map((c) => q[c.i]);
  const tri = polygon(3);
  const quad = polygon(4);
  const triError = tri ? polygonError(q, tri, size) : Infinity;
  const quadError = quad ? polygonError(q, quad, size) : Infinity;
  // A fourth corner has to earn its place: a stray one on a triangle's side
  // fits about as well without it.
  const [shape, error] =
    quadError < triError * 0.7 ? (['rectangle', quadError] as const) : (['triangle', triError] as const);
  const round = ellipseError(q, b);
  // Five to eight corners: a polygon — when it fits clearly better than a
  // triangle or a rectangle with corners missing, and than the curve a lumpy
  // circle would also be read as.
  let many: { sides: number; error: number } | null = null;
  for (let sides = 5; sides <= 8; sides++) {
    const corners = polygon(sides);
    if (!corners) break;
    const fit = polygonError(q, corners, size);
    // Fewer corners win a tie: one more has to fit noticeably better.
    if (!many || fit < many.error * 0.75) many = { sides, error: fit };
  }
  if (many && many.error <= 0.06 && many.error < round * 0.5 && many.error < Math.min(triError, quadError) * 0.6) {
    return { ...boxed('polygon', b), sides: many.sides };
  }
  // Corners win only when they fit clearly better than a curve: a lumpy
  // circle has "corners" too, and is still a circle.
  if (error <= 0.15 && error < round * 0.6) {
    if (shape === 'rectangle') {
      // Four corners on the middles of the box's sides are a diamond — a
      // polygon of four sides, first corner up — not a rectangle.
      const { x, y, width: w, height: h } = b;
      const box = polygonError(q, [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], size);
      const diamond = polygonError(
        q,
        [{ x: x + w / 2, y }, { x: x + w, y: y + h / 2 }, { x: x + w / 2, y: y + h }, { x, y: y + h / 2 }],
        size,
      );
      if (diamond < box * 0.5) return { ...boxed('polygon', b), sides: 4 };
    }
    return boxed(shape, b);
  }
  // Lenient: this is what a really bad circle is for.
  if (round <= 0.28) return boxed('ellipse', b);
  return null;
}

/**
 * The figure a sketch became, as the pen keeps moving: a line or an arrow has
 * its tip follow the pen; a closed figure is scaled about its centre by how
 * much further (or nearer) the pen now is than where it was when the figure
 * was made (`p0`) — pull outwards to grow it, in to shrink it.
 */
export function sketchResize(sketch: Sketch, p0: Point, p: Point): { from: Point; to: Point } {
  if (sketch.shape === 'line' || sketch.shape === 'arrow') return { from: sketch.from, to: p };
  const c = { x: (sketch.from.x + sketch.to.x) / 2, y: (sketch.from.y + sketch.to.y) / 2 };
  const before = dist(p0, c);
  const k = before > 1 ? Math.max(0.25, Math.min(8, dist(p, c) / before)) : 1;
  const grow = (q: Point) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k });
  return { from: grow(sketch.from), to: grow(sketch.to) };
}

/** Whether every point of `p` lies near the segment `a`→`b`: within 8% of its length. */
function hugs(p: Point[], a: Point, b: Point): boolean {
  const chord = dist(a, b);
  return chord > 0 && p.every((q) => segmentDistance(a, b, q) <= 0.08 * chord);
}

function openSketch(p: Point[]): Sketch | null {
  // An arrow: a straight run out to its tip — where it first gets (about)
  // furthest from the start: a head drawn as two barbs passes the tip twice —
  // then a short hook back from the tip, off the line, for the head.
  const far = Math.max(...p.map((q) => dist(p[0], q)));
  let tip = p.findIndex((q) => dist(p[0], q) >= 0.97 * far);
  while (tip + 1 < p.length && dist(p[0], p[tip + 1]) > dist(p[0], p[tip])) tip++;
  const shaft = dist(p[0], p[tip]);
  const head = p.slice(tip);
  const reach = Math.max(...head.map((q) => dist(q, p[tip])));
  if (
    hugs(p.slice(0, tip + 1), p[0], p[tip]) &&
    reach >= 0.08 * shaft &&
    reach <= 0.5 * shaft &&
    head.some((q) => segmentDistance(p[0], p[tip], q) >= 0.04 * shaft)
  ) {
    return { shape: 'arrow', from: p[0], to: p[tip] };
  }
  if (hugs(p, p[0], p[p.length - 1])) return { shape: 'line', from: p[0], to: p[p.length - 1] };
  return null;
}

/**
 * The figure a stroke (flat `[x0, y0, ...]`) was meant to be, or null. Smaller
 * than `minSize` across, it is left alone.
 */
export function recognizeSketch(flat: number[], minSize: number): Sketch | null {
  const p = flatToPoints(flat);
  if (p.length < 3) return null;
  const all = boundsOf(p);
  if (Math.hypot(all.width, all.height) < minSize) return null;
  // Back where it started, it is a loop: cut any run past the start (the
  // point nearest the start in the last stretch), then allow a gap of up to a
  // third of its size.
  let end = p.length - 1;
  for (let i = Math.floor(p.length * 0.7); i < p.length; i++) {
    if (dist(p[i], p[0]) < dist(p[end], p[0])) end = i;
  }
  const loop = p.slice(0, end + 1);
  const lb = boundsOf(loop);
  if (loop.length >= 3 && dist(loop[end], p[0]) <= 0.35 * Math.hypot(lb.width, lb.height)) {
    return closedSketch(loop);
  }
  return openSketch(p);
}
