import {
  DashPathEffect,
  Group,
  Image,
  Line,
  Oval,
  Path,
  Rect,
  RoundedRect,
  Circle,
  Skia,
  useImage,
  usePathValue,
  type SkFont,
  type SkPath,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { Palettes, inkFor } from '@/constants/theme';
import { useColors } from '@/features/session/store';
import {
  anchorsOf,
  bendHandleOf,
  boxOf,
  canRotate,
  curveSegment,
  dashIntervals,
  elementBounds,
  endAngles,
  handlesOf,
  headsOf,
  isLineLike,
  markerPaths,
  n as round,
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
        <MarkerPartView key={i} d={part.d} fill={part.fill} color={color} width={width} ground={ground} />
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
  const font = useBoardFont(fontSize);
  if (!el.text) return null;
  const { x, y, width, height } = shapeBounds(el);
  const step = fontSize * 1.25;
  const lines = el.text.split('\n');
  const cx = x + width / 2;
  const cy = isLineLike(el)
    ? y + height / 2 - (lines.length * step) / 2 - fontSize * 0.4
    : y + height / 2;
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
 * element, a handle on each corner (each endpoint for a line). Rendered in
 * screen space — outside the camera group — so the handles stay finger-sized
 * at any zoom.
 */
export const HANDLE_SIZE = 12;

/** A dashed screen-space box round board-space bounds: the frame, and the marquee. */
export function DashedBox({
  b,
  camera,
  angle = 0,
}: {
  b: Bounds;
  camera: { x: number; y: number; scale: number };
  /** Turns the box about its centre, for a single turned element. */
  angle?: number;
}) {
  const c = useColors();
  const origin = {
    x: (b.x + b.width / 2) * camera.scale + camera.x,
    y: (b.y + b.height / 2) * camera.scale + camera.y,
  };
  return (
    <Group transform={angle ? [{ rotate: angle }] : undefined} origin={origin}>
      <Rect
      x={b.x * camera.scale + camera.x - 4}
      y={b.y * camera.scale + camera.y - 4}
      width={b.width * camera.scale + 8}
      height={b.height * camera.scale + 8}
      color={c.accent}
      style="stroke"
      strokeWidth={1.5}
    >
      <DashPathEffect intervals={[5, 4]} />
    </Rect>
    </Group>
  );
}

export function SelectionFrame({
  elements,
  camera,
}: {
  elements: BoardElement[];
  camera: { x: number; y: number; scale: number };
}) {
  const c = useColors();
  const sx = (v: number) => v * camera.scale + camera.x;
  const sy = (v: number) => v * camera.scale + camera.y;
  const one = elements.length === 1 ? elements[0] : null;
  const line = one?.kind === 'shape' && isLineLike(one) ? one : null;
  const fold = line ? bendHandleOf(line) : null;
  const b = one ? elementBounds(one) : unionBounds(elements);
  const knob = one ? rotateHandleOf(one, camera.scale) : null;
  const top = one ? boxOf(one) : null;
  const knobStem = one && knob && top ? toWorld(one, { x: top.x + top.width / 2, y: top.y }) : null;
  return (
    <Group>
      {/* The rotate knob: a round handle on a short stem above the top edge. */}
      {knob && knobStem ? (
        <Group>
          <Line
            p1={{ x: sx(knobStem.x), y: sy(knobStem.y) }}
            p2={{ x: sx(knob.x), y: sy(knob.y) }}
            color={c.accent}
            strokeWidth={1.5}
          />
          <Circle cx={sx(knob.x)} cy={sy(knob.y)} r={HANDLE_SIZE / 2 + 1} color={c.background} />
          <Circle
            cx={sx(knob.x)}
            cy={sy(knob.y)}
            r={HANDLE_SIZE / 2 + 1}
            color={c.accent}
            style="stroke"
            strokeWidth={1.5}
          />
        </Group>
      ) : null}
      {line ? (
        // A line has no box to frame, so the line itself lights up: a soft
        // accent halo along its route, and round handles at the two ends it
        // can be dragged by — unmistakably not the square corners of a box.
        <Group transform={[{ translateX: camera.x }, { translateY: camera.y }, { scale: camera.scale }]}>
          <Halo line={line} color={c.accent} width={line.strokeWidth + 8 / camera.scale} />
        </Group>
      ) : one && canRotate(one) ? (
        // One turnable element is framed along its own (turned) box.
        <DashedBox b={boxOf(one)} camera={camera} angle={rotationOf(one)} />
      ) : (
        <DashedBox b={b} camera={camera} />
      )}
      {/* A curved or elbow line's fold: a diamond handle, dragged to reshape
          how far it bows or where it turns. */}
      {fold ? (
        <Group key="fold" transform={[{ translateX: sx(fold.x) }, { translateY: sy(fold.y) }, { rotate: Math.PI / 4 }]}>
          <Rect
            x={-HANDLE_SIZE / 2}
            y={-HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            color={c.background}
          />
          <Rect
            x={-HANDLE_SIZE / 2}
            y={-HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            color={c.accent}
            style="stroke"
            strokeWidth={1.5}
          />
        </Group>
      ) : null}
      {(one ? handlesOf(one) : []).map((h, i) =>
        line ? (
          <Group key={i}>
            <Circle cx={sx(h.x)} cy={sy(h.y)} r={HANDLE_SIZE / 2 + 1} color={c.accent} />
            <Circle
              cx={sx(h.x)}
              cy={sy(h.y)}
              r={HANDLE_SIZE / 2 + 1}
              color={c.background}
              style="stroke"
              strokeWidth={1.5}
            />
          </Group>
        ) : (
          <Group key={i}>
            <Rect
              x={sx(h.x) - HANDLE_SIZE / 2}
              y={sy(h.y) - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              color={c.background}
            />
            <Rect
              x={sx(h.x) - HANDLE_SIZE / 2}
              y={sy(h.y) - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              color={c.accent}
              style="stroke"
              strokeWidth={1.5}
            />
          </Group>
        ),
      )}
    </Group>
  );
}

/** The soft accent along a selected line's route. */
function Halo({ line, color, width }: { line: ShapeElement; color: string; width: number }) {
  const path = useSvgPath(routePath(line.from, line.to, line.route, line.bend));
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
  const route = useSvgPath(isLineLike(el) ? routePath(el.from, el.to, el.route, el.bend) : null);
  const x = Math.min(el.from.x, el.to.x);
  const y = Math.min(el.from.y, el.to.y);
  const w = Math.abs(el.to.x - el.from.x);
  const h = Math.abs(el.to.y - el.from.y);

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
        />
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
        />
      </Group>
    );
  }

  if (el.shape === 'triangle' || el.shape === 'polygon') {
    // A triangle: apex centred on the top edge, base along the bottom — the
    // shape the tool icon promises. A polygon: regular, first corner up.
    const pts =
      el.shape === 'triangle'
        ? [
            { x: x + w / 2, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ]
        : polygonPoints({ x, y, width: w, height: h }, el.sides);
    const builder = Skia.PathBuilder.Make().moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) builder.lineTo(p.x, p.y);
    const path = builder.close().detach();
    return (
      <Group>
        {el.fill ? <Path path={path} color={el.fill} /> : null}
        <Path
          path={path}
          color={el.stroke}
          style="stroke"
          strokeWidth={el.strokeWidth}
          strokeJoin="round"
        />
      </Group>
    );
  }

  // line / arrow
  const [headStart, headEnd] = headsOf(el);
  const angles = endAngles(el.from, el.to, el.route, el.bend);
  const dash = dashIntervals(el.dash, el.strokeWidth);
  if (!route) return null;
  return (
    <Group>
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
  const font = useBoardFont(el.fontSize, !!el.bold, !!el.italic);
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

/** The id the canvas gives the stroke still under the finger. */
export const LIVE_STROKE = 'live-stroke';

/**
 * How far the live stroke's path has been built (see `livePath`): the points
 * it was built from and a builder holding every segment that is final.
 */
const live = {
  points: null as number[] | null,
  smooth: true,
  builder: null as SkPathBuilder | null,
  done: 0,
};

/** Point `i` of a flat buffer of `m` points, or nothing past either end. */
const pointAt = (flat: number[], i: number, m: number) =>
  i >= 0 && i < m ? { x: flat[2 * i], y: flat[2 * i + 1] } : undefined;

function addSegment(b: SkPathBuilder, flat: number[], i: number, m: number, smooth: boolean) {
  if (!smooth) {
    b.lineTo(round(flat[2 * i + 2]), round(flat[2 * i + 3]));
    return;
  }
  const near = [-1, 0, 1, 2].map((k) => pointAt(flat, i + k, m));
  const [c1x, c1y, c2x, c2y, x, y] = curveSegment(near as Point[], 1);
  b.cubicTo(c1x, c1y, c2x, c2y, x, y);
}

/**
 * The path of the stroke under the finger, grown a point at a time.
 *
 * It used to be rebuilt as a string from the first point and re-parsed on
 * every touch sample, so a stroke got slower to draw the longer it was. The
 * finger only ever appends, and a new point changes only the segment before
 * it (a smoothed segment is steered by the point after it): everything
 * earlier stays in the builder. The segments and their rounding are
 * `strokeToSvgPath`'s own, so the curve is the same one.
 */
function livePath(flat: number[], smooth: boolean): SkPath | null {
  const m = flat.length >> 1;
  const prev = live.points;
  const grows =
    !!prev &&
    !!live.builder &&
    live.smooth === smooth &&
    prev.length <= flat.length &&
    prev.every((v, i) => v === flat[i]);
  live.points = flat;
  // A dot, or the first straight piece: nothing to grow yet.
  if (m < 3) {
    live.builder = null;
    return Skia.Path.MakeFromSVGString(strokeToSvgPath(flat, smooth));
  }
  if (!grows) {
    live.builder = Skia.PathBuilder.Make().moveTo(round(flat[0]), round(flat[1]));
    live.smooth = smooth;
    live.done = 0;
  }
  const b = live.builder!;
  // Straight segments are final at once; a smoothed one once the point after it exists.
  const final = smooth ? m - 2 : m - 1;
  for (; live.done < final; live.done++) addSegment(b, flat, live.done, m, smooth);
  if (!smooth) return b.build();
  const out = Skia.PathBuilder.MakeFromPath(b.build());
  addSegment(out, flat, m - 2, m, true);
  return out.detach();
}

/**
 * The path is memoised on the points: while a stroke is being drawn the canvas
 * re-renders on every touch sample, and rebuilding the path of every other
 * stroke on the board each time is what made the JS thread drop samples.
 */
function StrokeView({
  el,
  smooth,
}: {
  el: Extract<BoardElement, { kind: 'stroke' }>;
  smooth: boolean;
}) {
  const growing = el.id === LIVE_STROKE;
  const path = useMemo(
    () =>
      growing
        ? livePath(el.points, smooth)
        : Skia.Path.MakeFromSVGString(strokeToSvgPath(el.points, smooth)),
    [growing, el.points, smooth],
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
 * being drawn so the snap targets are visible. Screen-space dots.
 */
export function Anchors({
  elements,
  camera,
}: {
  elements: BoardElement[];
  camera: { x: number; y: number; scale: number };
}) {
  const c = useColors();
  return (
    <Group>
      {elements.map((el) =>
        anchorsOf(el).length
          ? anchorsOf(el).map((a, i) => (
              <Group key={`${el.id}-${i}`}>
                <Circle
                  cx={a.x * camera.scale + camera.x}
                  cy={a.y * camera.scale + camera.y}
                  r={4}
                  color={c.background}
                />
                <Circle
                  cx={a.x * camera.scale + camera.x}
                  cy={a.y * camera.scale + camera.y}
                  r={4}
                  color={c.accent}
                  style="stroke"
                  strokeWidth={1.5}
                />
              </Group>
            ))
          : null,
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

/**
 * Renders one board element with Skia primitives. Memoised: see `StrokeView`.
 * `dark` paints for the dark board; the export preview leaves it off, since a
 * saved picture is always ink on white.
 */
export const ElementRenderer = memo(function ElementRenderer({
  el,
  smooth = true,
  dark = false,
}: {
  el: BoardElement;
  smooth?: boolean;
  dark?: boolean;
}) {
  if (dark) el = inked(el);
  const ground = dark ? Palettes.dark.background : Palettes.light.background;
  const angle = rotationOf(el);
  if (angle) {
    // Turned about the centre of its box: the element itself paints unturned.
    const b = boxOf(el);
    return (
      <Group transform={[{ rotate: angle }]} origin={{ x: b.x + b.width / 2, y: b.y + b.height / 2 }}>
        <ElementRenderer el={{ ...el, rotation: 0 }} smooth={smooth} />
      </Group>
    );
  }
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
