import {
  DashPathEffect,
  Circle,
  Group,
  Image,
  Line,
  Oval,
  Path,
  Rect,
  RoundedRect,
  Skia,
  useImage,
  usePathValue,
  type SkFont,
  type Transforms3d,
  type SkPath,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import type { DerivedValue, SharedValue } from 'react-native-reanimated';

import { Palettes, inkFor } from '@/constants/theme';
import { useColors } from '@/features/session/store';
import {
  addStroke,
  anchorsOf,
  bendHandleOf,
  curveHandlesOf,
  boxOf,
  canRotate,
  dashIntervals,
  elementBounds,
  endAngles,
  handlesOf,
  headsOf,
  isLineLike,
  labelBox,
  labelLines,
  lineLabelCentre,
  markerPaths,
  polygonPoints,
  rotateHandleOf,
  rotationOf,
  routePath,
  shapeBounds,
  strokeToSvgPath,
  textLines,
  toWorld,
  TEXT_LINE_HEIGHT,
  type Bounds,
  type MarkerPart,
} from '@/features/board/geometry';
import {
  SHAPE_TEXT_SIZE,
  type BoardElement,
  type Marker,
  type Point,
  type ShapeElement,
  type ShapeKind,
} from '@/features/board/model';
import type { Camera } from '@/features/board/store';

import { textWidth, useBoardFont } from './BoardFonts';

/** A marker's size grows with the stroke, and never below a fingertip's worth. */
export const markerSize = (width: number) => Math.max(10, width * 3);

/**
 * An SVG path string as a Skia path, parsed once per distinct string.
 *
 * Skia re-records every node of the canvas on each repaint — every pan frame,
 * every touch sample — and a `path` given as a string is parsed again each
 * time, so a board full of strokes was re-parsed from text on every frame. A
 * path object is only copied. Same parser, so the same geometry.
 */
function useSvgPath(d: string | null): SkPath | null {
  return useMemo(() => (d === null ? null : Skia.Path.MakeFromSVGString(d)), [d]);
}

/** One end of a line: the marker's parts, painted after the line so a hollow one hides it. */
function MarkerView({
  kind,
  tip,
  angle,
  color,
  width,
  ground,
}: {
  kind: Marker;
  tip: Point;
  angle: number;
  color: string;
  width: number;
  /** What a hollow marker is filled with: the surface the board is painted on. */
  ground: string;
}) {
  return (
    <Group>
      {markerPaths(kind, tip, angle, markerSize(width)).map((part, i) => (
        <MarkerPartView
          key={i}
          d={part.d}
          fill={part.fill}
          color={color}
          width={width}
          ground={ground}
        />
      ))}
    </Group>
  );
}

function MarkerPartView({
  d,
  fill,
  color,
  width,
  ground,
}: {
  d: string;
  fill: MarkerPart['fill'];
  color: string;
  width: number;
  ground: string;
}) {
  const path = useSvgPath(d);
  if (!path) return null;
  return (
    <Group>
      {fill !== 'none' ? <Path path={path} color={fill === 'solid' ? color : ground} /> : null}
      <Path
        path={path}
        style="stroke"
        strokeWidth={width}
        color={color}
        strokeCap="round"
        strokeJoin="miter"
      />
    </Group>
  );
}

/** A shape's label: centred in its box, or floating just above a line's midpoint. */
function ShapeLabel({ el }: { el: ShapeElement }) {
  const fontSize = el.fontSize ?? SHAPE_TEXT_SIZE;
  const font = useBoardFont(fontSize, false, false, el.font);
  if (!el.text) return null;
  const { x, y, width, height } = shapeBounds(el);
  const step = fontSize * TEXT_LINE_HEIGHT;
  // Wrapped inside the figure (a line's label only breaks where typed).
  const lines = labelLines(el, fontSize);
  // Centred in a box; on a line, where it stands along it (the line is cut behind it).
  const { x: cx, y: cy } = isLineLike(el) ? lineLabelCentre(el) : { x: x + width / 2, y: y + height / 2 };
  // Skia draws from the baseline: centre the block, then sit each line on it.
  const top = cy - ((lines.length - 1) * step) / 2 + fontSize * 0.35;
  return (
    <Group>
      {lines.map((line, i) => (
        <TextPath
          key={i}
          x={cx - textWidth(font, line) / 2}
          y={top + i * step}
          text={line}
          font={font}
          color={el.stroke}
        />
      ))}
    </Group>
  );
}

/**
 * The selection frame: a dashed box round the selection and, for a single
 * element, a handle on each corner (each endpoint for a line).
 *
 * Drawn in board space, inside the camera's group, so a pan moves it with the
 * board on the UI thread; its pixel sizes (handles, hairlines, dashes) come
 * from `scale`, the zoom the store last settled on — a pinch resizes them when
 * it lifts. Plain nodes, placed with the elements they frame, so a dragged
 * frame and the thing it frames are always in the same frame of the same render.
 */
export const HANDLE_SIZE = 12;

/** How opaque an element someone else holds is painted. */
export const HELD_ALPHA = 0.45;
/** What the eraser is about to take: faint enough to read as going, visible enough to see what. */
export const ERASING_ALPHA = 0.25;

/** A dashed box round board-space bounds, 4 screen px outside them: the frame, and the marquee. */
export function DashedBox({
  b,
  scale,
  angle = 0,
  color,
}: {
  b: Bounds;
  scale: number;
  /** Turns the box about its centre, for a single turned element. */
  angle?: number;
  /** The accent unless given: a holder's presence colour. */
  color?: string;
}) {
  const c = useColors();
  const k = 1 / scale;
  return (
    <Group
      transform={angle ? [{ rotate: angle }] : undefined}
      origin={{ x: b.x + b.width / 2, y: b.y + b.height / 2 }}
    >
      <Rect
        x={b.x - 4 * k}
        y={b.y - 4 * k}
        width={b.width + 8 * k}
        height={b.height + 8 * k}
        color={color ?? c.accent}
        style="stroke"
        strokeWidth={1.5 * k}
      >
        <DashPathEffect intervals={[5 * k, 4 * k]} />
      </Rect>
    </Group>
  );
}

export function SelectionFrame({
  elements,
  scale,
}: {
  elements: BoardElement[];
  scale: number;
}) {
  const c = useColors();
  const k = 1 / scale;
  const half = (HANDLE_SIZE / 2) * k;
  const hair = 1.5 * k;
  const one = elements.length === 1 ? elements[0] : null;
  const line = one?.kind === 'shape' && isLineLike(one) ? one : null;
  const curve = line ? curveHandlesOf(line) : null;
  const fold = curve ? curve.mid : line ? bendHandleOf(line) : null;
  const b = one ? elementBounds(one) : unionBounds(elements);
  const knob = one ? rotateHandleOf(one, scale) : null;
  const top = one ? boxOf(one) : null;
  const knobStem = one && knob && top ? toWorld(one, { x: top.x + top.width / 2, y: top.y }) : null;
  return (
    <Group>
      {/* The rotate knob: a round handle on a short stem above the top edge. */}
      {knob && knobStem ? (
        <Group>
          <Line p1={knobStem} p2={knob} color={c.accent} strokeWidth={hair} />
          <Circle cx={knob.x} cy={knob.y} r={half + k} color={c.background} />
          <Circle cx={knob.x} cy={knob.y} r={half + k} color={c.accent} style="stroke" strokeWidth={hair} />
        </Group>
      ) : null}
      {line ? (
        // A line has no box to frame, so the line itself lights up: a soft
        // accent halo along its route, and round handles at the two ends it
        // can be dragged by — unmistakably not the square corners of a box.
        <>
          <Halo line={line} color={c.accent} width={line.strokeWidth + 8 * k} />
          {/* The label is held by its own frame: drag it to move it along the line. */}
          {line.text ? (
            <DashedBox
              b={labelBox(line, labelLines(line, line.fontSize ?? SHAPE_TEXT_SIZE), line.fontSize ?? SHAPE_TEXT_SIZE)}
              scale={scale}
            />
          ) : null}
        </>
      ) : one && canRotate(one) ? (
        // One turnable element is framed along its own (turned) box.
        <DashedBox b={boxOf(one)} scale={scale} angle={rotationOf(one)} />
      ) : (
        <DashedBox b={b} scale={scale} />
      )}
      {/* A curve's pull at each end: a round handle on a stem out of the end it
          shapes — drag it to change which way the line leaves, and how hard. */}
      {line && curve
        ? [
            [line.from, curve.start],
            [line.to, curve.end],
          ].map(([end, handle], i) => (
            <Group key={`pull-${i}`}>
              <Line p1={end} p2={handle} color={c.accent} strokeWidth={hair} opacity={0.6} />
              <Circle cx={handle.x} cy={handle.y} r={half * 0.8} color={c.background} />
              <Circle cx={handle.x} cy={handle.y} r={half * 0.8} color={c.accent} style="stroke" strokeWidth={hair} />
            </Group>
          ))
        : null}
      {/* A curved or elbow line's fold: a diamond handle, dragged to reshape
          how far it bows or where it turns. */}
      {fold ? (
        <Group key="fold" transform={[{ translateX: fold.x }, { translateY: fold.y }, { rotate: Math.PI / 4 }]}>
          <Rect x={-half} y={-half} width={2 * half} height={2 * half} color={c.background} />
          <Rect x={-half} y={-half} width={2 * half} height={2 * half} color={c.accent} style="stroke" strokeWidth={hair} />
        </Group>
      ) : null}
      {(one ? handlesOf(one) : []).map((h, i) =>
        line ? (
          <Group key={i}>
            <Circle cx={h.x} cy={h.y} r={half + k} color={c.accent} />
            <Circle cx={h.x} cy={h.y} r={half + k} color={c.background} style="stroke" strokeWidth={hair} />
          </Group>
        ) : (
          // Round, like a line's ends: a ring says "drag me" where a square corner did not.
          <Group key={i}>
            <Circle cx={h.x} cy={h.y} r={half + k} color={c.background} />
            <Circle cx={h.x} cy={h.y} r={half + k} color={c.accent} style="stroke" strokeWidth={2 * k} />
          </Group>
        ),
      )}
    </Group>
  );
}

/** The soft accent along a selected line's route. */
function Halo({ line, color, width }: { line: ShapeElement; color: string; width: number }) {
  const path = useSvgPath(routePath(line));
  if (!path) return null;
  return (
    <Path
      path={path}
      color={color}
      opacity={0.28}
      style="stroke"
      strokeWidth={width}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}

function unionBounds(elements: BoardElement[]): Bounds {
  const boxes = elements.map(elementBounds);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

function ShapeView({ el, ground }: { el: ShapeElement; ground: string }) {
  return (
    <Group>
      <ShapeGeometry el={el} ground={ground} />
      <ShapeLabel el={el} />
    </Group>
  );
}

function ShapeGeometry({ el, ground }: { el: ShapeElement; ground: string }) {
  // Only a line or an arrow is drawn along a route; the other kinds pay nothing.
  const route = useSvgPath(isLineLike(el) ? routePath(el) : null);
  const x = Math.min(el.from.x, el.to.x);
  const y = Math.min(el.from.y, el.to.y);
  const w = Math.abs(el.to.x - el.from.x);
  const h = Math.abs(el.to.y - el.from.y);
  // Closed shapes dash their outline; the line below does it for its own route.
  const outline = dashIntervals(el.dash, el.strokeWidth);
  const dashed = outline ? <DashPathEffect intervals={outline} /> : null;

  if (el.shape === 'rectangle') {
    // The design's rectangles are softly rounded, capped so a thin sliver does
    // not turn into a lozenge.
    const r = Math.min(8, w / 4, h / 4);
    return (
      <Group>
        {el.fill ? <RoundedRect x={x} y={y} width={w} height={h} r={r} color={el.fill} /> : null}
        <RoundedRect
          x={x}
          y={y}
          width={w}
          height={h}
          r={r}
          color={el.stroke}
          style="stroke"
          strokeWidth={el.strokeWidth}
          strokeCap="round"
        >
          {dashed}
        </RoundedRect>
      </Group>
    );
  }

  if (el.shape === 'ellipse') {
    return (
      <Group>
        {el.fill ? <Oval x={x} y={y} width={w} height={h} color={el.fill} /> : null}
        <Oval
          x={x}
          y={y}
          width={w}
          height={h}
          color={el.stroke}
          style="stroke"
          strokeWidth={el.strokeWidth}
          strokeCap="round"
        >
          {dashed}
        </Oval>
      </Group>
    );
  }

  if (el.shape === 'triangle' || el.shape === 'polygon') {
    return <PolygonView el={el} x={x} y={y} w={w} h={h} />;
  }

  // line / arrow
  const [headStart, headEnd] = headsOf(el);
  const angles = endAngles(el);
  const dash = dashIntervals(el.dash, el.strokeWidth);
  if (!route) return null;
  // The line is cut away behind its label, so the text sits in it.
  const size = el.fontSize ?? SHAPE_TEXT_SIZE;
  const gap = el.text ? labelBox(el, labelLines(el, size), size) : null;
  const stroke = (
    <Path
      path={route}
      color={el.stroke}
      style="stroke"
      strokeWidth={el.strokeWidth}
      strokeCap="round"
      strokeJoin="round"
    >
      {dash ? <DashPathEffect intervals={dash} /> : null}
    </Path>
  );
  return (
    <Group>
      {gap ? (
        <Group clip={gap} invertClip>
          {stroke}
        </Group>
      ) : (
        stroke
      )}
      <MarkerView
        kind={headStart}
        tip={el.from}
        angle={angles.start}
        color={el.stroke}
        width={el.strokeWidth}
        ground={ground}
      />
      <MarkerView
        kind={headEnd}
        tip={el.to}
        angle={angles.end}
        color={el.stroke}
        width={el.strokeWidth}
        ground={ground}
      />
    </Group>
  );
}

/**
 * A triangle: apex centred on the top edge, base along the bottom — the shape
 * the tool icon promises. A polygon: regular, first corner up. Its path is
 * built once per box, not on every render.
 */
function PolygonView({
  el,
  x,
  y,
  w,
  h,
}: {
  el: ShapeElement;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const { shape, sides } = el;
  const outline = dashIntervals(el.dash, el.strokeWidth);
  const path = useMemo(() => {
    const pts =
      shape === 'triangle'
        ? [
            { x: x + w / 2, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ]
        : polygonPoints({ x, y, width: w, height: h }, sides);
    const builder = Skia.PathBuilder.Make().moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) builder.lineTo(p.x, p.y);
    return builder.close().detach();
  }, [shape, sides, x, y, w, h]);
  return (
    <Group>
      {el.fill ? <Path path={path} color={el.fill} /> : null}
      <Path path={path} color={el.stroke} style="stroke" strokeWidth={el.strokeWidth} strokeJoin="round" strokeCap="round">
        {outline ? <DashPathEffect intervals={outline} /> : null}
      </Path>
    </Group>
  );
}

function ImageView({
  uri,
  x,
  y,
  width,
  height,
}: {
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const image = useImage(uri);
  if (!image) return null;
  return <Image image={image} x={x} y={y} width={width} height={height} fit="contain" />;
}

/**
 * Text drawn as outlines rather than through Skia's `Text` node. Glyphs go
 * through the GPU glyph atlas, which on some Android drivers paints nothing
 * while plain geometry — every stroke and shape on the board — paints fine;
 * and the native recorder silently skips a `Text` whose font it cannot read.
 * A path is the pipeline that is known to work on the same screen.
 */
function TextPath({
  text,
  x,
  y,
  font,
  color,
}: {
  text: string;
  x: number;
  y: number;
  font: SkFont;
  color: string;
}) {
  const path = useMemo(() => Skia.Path.MakeFromText(text, x, y, font), [text, x, y, font]);
  return path ? <Path path={path} color={color} /> : null;
}

function TextView({ el }: { el: Extract<BoardElement, { kind: 'text' }> }) {
  const font = useBoardFont(el.fontSize, !!el.bold, !!el.italic, el.font);
  const step = el.fontSize * TEXT_LINE_HEIGHT;
  // Its own newlines, then wrapped to its width if it has one. Skia draws text
  // from the baseline; nudge each line down by ~the font size.
  return (
    <Group>
      {textLines(el).map((line, i) => (
        <TextPath
          key={i}
          x={el.at.x}
          y={el.at.y + el.fontSize + i * step}
          text={line}
          font={font}
          color={el.color}
        />
      ))}
    </Group>
  );
}

/**
 * The stroke under the finger: its points live in a shared value that the pen
 * gesture appends to on the UI thread, and this path is rebuilt from them
 * there too. Nothing on the JS thread, and no React render, runs per touch
 * sample — the board under it could have any number of elements.
 *
 * Rebuilt whole each time rather than grown: a stroke is capped at
 * `LIMITS.maxStrokePoints`, and a few hundred segments cost far less than a
 * frame. (ponytail: grow a builder in place if a 2000-point stroke ever shows.)
 */
export function LiveStroke({
  points,
  color,
  width,
  smooth,
}: {
  points: SharedValue<number[]>;
  color: string;
  width: number;
  smooth: boolean;
}) {
  const path = usePathValue((b) => {
    'worklet';
    addStroke(b, points.get(), smooth);
  });
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={width}
      color={color}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}

/**
 * The box shape under the finger (rectangle, ellipse, triangle, polygon): its
 * two corners are shared values the shape gesture moves on the UI thread, and
 * the path is rebuilt from them there — the same figures `ShapeGeometry` draws.
 * Nothing shows while `active` is off.
 */
export function LiveBoxShape({
  from,
  to,
  active,
  shape,
  sides,
  stroke,
  strokeWidth,
  fill,
}: {
  from: SharedValue<Point>;
  to: SharedValue<Point>;
  active: SharedValue<boolean>;
  shape: ShapeKind;
  sides: number;
  stroke: string;
  strokeWidth: number;
  fill: string | null;
}) {
  const path = usePathValue((b) => {
    'worklet';
    if (!active.get()) return;
    const f = from.get();
    const t = to.get();
    const x = Math.min(f.x, t.x);
    const y = Math.min(f.y, t.y);
    const w = Math.abs(t.x - f.x);
    const h = Math.abs(t.y - f.y);
    if (shape === 'rectangle') {
      // Softly rounded, capped so a thin sliver does not turn into a lozenge.
      const r = Math.min(8, w / 4, h / 4);
      b.addRRect({ rect: { x, y, width: w, height: h }, rx: r, ry: r });
    } else if (shape === 'ellipse') {
      b.addOval({ x, y, width: w, height: h });
    } else {
      const pts =
        shape === 'triangle'
          ? [
              { x: x + w / 2, y },
              { x: x + w, y: y + h },
              { x, y: y + h },
            ]
          : polygonPoints({ x, y, width: w, height: h }, sides);
      b.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) b.lineTo(pts[i].x, pts[i].y);
      b.close();
    }
  });
  return (
    <>
      {fill ? <Path path={path} color={fill} /> : null}
      <Path path={path} color={stroke} style="stroke" strokeWidth={strokeWidth} strokeJoin="round" />
    </>
  );
}

/**
 * The path is memoised on the points: the canvas re-renders on any change, and
 * rebuilding the path of every stroke on the board each time would be costly.
 */
function StrokeView({
  el,
  smooth,
}: {
  el: Extract<BoardElement, { kind: 'stroke' }>;
  smooth: boolean;
}) {
  const path = useMemo(
    () => Skia.Path.MakeFromSVGString(strokeToSvgPath(el.points, smooth)),
    [el.points, smooth],
  );
  if (!path) return null;
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={el.width}
      color={el.color}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}

/**
 * Connection points on every enclosed shape, shown while a line or an arrow is
 * being drawn so the snap targets are visible. Board space, pixel-sized by `scale`.
 */
export function Anchors({ elements, scale }: { elements: BoardElement[]; scale: number }) {
  const c = useColors();
  const k = 1 / scale;
  return (
    <Group>
      {elements.map((el) =>
        anchorsOf(el).map((a, i) => (
          <Group key={`${el.id}-${i}`}>
            <Circle cx={a.x} cy={a.y} r={4 * k} color={c.background} />
            <Circle cx={a.x} cy={a.y} r={4 * k} color={c.accent} style="stroke" strokeWidth={1.5 * k} />
          </Group>
        )),
      )}
    </Group>
  );
}

/**
 * The element as it is painted on the dark board: the default ink swapped for
 * the dark theme's text colour (`inkFor`). The element itself is untouched.
 */
function inked(el: BoardElement): BoardElement {
  switch (el.kind) {
    case 'stroke':
    case 'text':
      return { ...el, color: inkFor(el.color, true) };
    case 'shape':
      return { ...el, stroke: inkFor(el.stroke, true), fill: el.fill && inkFor(el.fill, true) };
    default:
      return el;
  }
}

/** The element's own paint, unturned. Memoised: see `StrokeView`. */
const Painted = memo(function Painted({
  el,
  smooth,
  ground,
}: {
  el: BoardElement;
  smooth: boolean;
  ground: string;
}) {
  switch (el.kind) {
    case 'stroke':
      return <StrokeView el={el} smooth={smooth} />;
    case 'shape':
      return <ShapeView el={el} ground={ground} />;
    case 'image':
      return <ImageView uri={el.uri} x={el.at.x} y={el.at.y} width={el.width} height={el.height} />;
    case 'text':
      return <TextView el={el} />;
    default:
      return null;
  }
});

/**
 * Renders one board element with Skia primitives. Memoised: see `StrokeView`.
 * `dark` paints for the dark board; the export preview leaves it off, since a
 * saved picture is always ink on white.
 */
export const ElementRenderer = memo(function ElementRenderer({
  el,
  smooth = true,
  dark = false,
  shift,
}: {
  el: BoardElement;
  smooth?: boolean;
  dark?: boolean;
  /** A translation the UI thread drives, while the cursor carries this element. */
  shift?: DerivedValue<Transforms3d>;
}) {
  // Kept by identity: a fresh copy each render would make `Painted` repaint.
  const shown = useMemo(() => (dark ? inked(el) : el), [el, dark]);
  const ground = dark ? Palettes.dark.background : Palettes.light.background;
  const angle = rotationOf(shown);
  const painted = <Painted el={shown} smooth={smooth} ground={ground} />;
  // Turned about the centre of its box: the element itself paints unturned.
  const b = boxOf(shown);
  const placed = angle ? (
    <Group transform={[{ rotate: angle }]} origin={{ x: b.x + b.width / 2, y: b.y + b.height / 2 }}>
      {painted}
    </Group>
  ) : (
    painted
  );
  return shift ? <Group transform={shift}>{placed}</Group> : placed;
});

/**
 * The dots of the grid under `camera`, added to `b`. Nothing when they would
 * be closer than ~9px: the dots read as a grey wash then, so the grid drops
 * out — the same threshold the design uses when zoomed out.
 *
 * A single path rather than thousands of circle nodes: the board is infinite,
 * so at a low zoom a per-dot approach would be asked to paint tens of
 * thousands of nodes every frame.
 */
function addDots(b: SkPathBuilder, width: number, height: number, camera: Camera) {
  'worklet';
  const step = 26 * camera.scale;
  if (step <= 9 || width <= 0 || height <= 0) return;
  const radius = camera.scale > 1.4 ? 1.4 : 1.1;
  const startX = camera.x % step;
  const startY = camera.y % step;
  for (let x = startX; x < width; x += step) {
    for (let y = startY; y < height; y += step) b.addCircle(x, y, radius);
  }
}

/** The dot grid at a fixed camera: the wash behind the home, nickname and PIN screens. */
export function DotGrid({
  width,
  height,
  camera,
}: {
  width: number;
  height: number;
  camera: Camera;
}) {
  const c = useColors();
  const { x, y, scale } = camera;
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    addDots(b, width, height, { x, y, scale });
    return b.isEmpty() ? null : b.detach();
  }, [width, height, x, y, scale]);

  if (!path) return null;
  return <Path path={path} color={c.borderStrong} />;
}

/**
 * The board's dot grid, the one the settings sheet can turn off. It follows
 * the camera on the UI thread: a pan or a pinch rebuilds it there, with no
 * React render and no re-recording of the canvas.
 */
export function LiveDotGrid({
  width,
  height,
  camera,
}: {
  width: number;
  height: number;
  camera: SharedValue<Camera>;
}) {
  const c = useColors();
  const path = usePathValue((b) => {
    'worklet';
    addDots(b, width, height, camera.get());
  });
  return <Path path={path} color={c.borderStrong} />;
}
