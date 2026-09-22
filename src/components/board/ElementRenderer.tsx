import {
  DashPathEffect,
  Group,
  Image,
  Oval,
  Path,
  Rect,
  RoundedRect,
  Circle,
  Skia,
  useImage,
  type SkFont,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import { Palettes, inkFor } from '@/constants/theme';
import { useColors } from '@/features/session/store';
import {
  anchorsOf,
  bendHandleOf,
  dashIntervals,
  elementBounds,
  endAngles,
  handlesOf,
  headsOf,
  isLineLike,
  markerPaths,
  routePath,
  shapeBounds,
  strokeToSvgPath,
  type Bounds,
} from '@/features/board/geometry';
import {
  SHAPE_TEXT_SIZE,
  type BoardElement,
  type Marker,
  type Point,
  type ShapeElement,
} from '@/features/board/model';

import { textWidth, useBoardFont } from './BoardFonts';

/** A marker's size grows with the stroke, and never below a fingertip's worth. */
export const markerSize = (width: number) => Math.max(10, width * 3);

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
        <Group key={i}>
          {part.fill !== 'none' ? (
            <Path path={part.d} color={part.fill === 'solid' ? color : ground} />
          ) : null}
          <Path
            path={part.d}
            style="stroke"
            strokeWidth={width}
            color={color}
            strokeCap="round"
            strokeJoin="miter"
          />
        </Group>
      ))}
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
}: {
  b: Bounds;
  camera: { x: number; y: number; scale: number };
}) {
  const c = useColors();
  return (
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
  return (
    <Group>
      {line ? (
        // A line has no box to frame, so the line itself lights up: a soft
        // accent halo along its route, and round handles at the two ends it
        // can be dragged by — unmistakably not the square corners of a box.
        <Group transform={[{ translateX: camera.x }, { translateY: camera.y }, { scale: camera.scale }]}>
          <Path
            path={routePath(line.from, line.to, line.route, line.bend)}
            color={c.accent}
            opacity={0.28}
            style="stroke"
            strokeWidth={line.strokeWidth + 8 / camera.scale}
            strokeCap="round"
            strokeJoin="round"
          />
        </Group>
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

  if (el.shape === 'triangle') {
    // Apex centred on the top edge, base along the bottom — the shape the tool
    // icon promises, drawn inside the dragged box.
    const path = Skia.PathBuilder.Make()
      .moveTo(x + w / 2, y)
      .lineTo(x + w, y + h)
      .lineTo(x, y + h)
      .close()
      .detach();
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
  return (
    <Group>
      <Path
        path={routePath(el.from, el.to, el.route, el.bend)}
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
  // Skia draws text from the baseline; nudge down by ~the font size.
  return (
    <TextPath x={el.at.x} y={el.at.y + el.fontSize} text={el.text} font={font} color={el.color} />
  );
}

/**
 * The path is memoised on the points: while a stroke is being drawn the canvas
 * re-renders on every touch sample, and rebuilding the SVG string of every
 * other stroke on the board each time is what made the JS thread drop samples.
 */
function StrokeView({
  el,
  smooth,
}: {
  el: Extract<BoardElement, { kind: 'stroke' }>;
  smooth: boolean;
}) {
  const path = useMemo(() => strokeToSvgPath(el.points, smooth), [el.points, smooth]);
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
        el.kind === 'shape'
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
 * The dot grid the settings sheet can turn off.
 *
 * It is drawn as a single tiled shader rather than as thousands of circles:
 * the board is infinite, so at a low zoom a per-dot approach would be asked to
 * paint tens of thousands of nodes every frame.
 */
export function DotGrid({
  width,
  height,
  camera,
}: {
  width: number;
  height: number;
  camera: { x: number; y: number; scale: number };
}) {
  const c = useColors();
  const step = 26 * camera.scale;
  const path = useMemo(() => {
    // Below ~9px apart the dots read as a grey wash, so the grid drops out —
    // the same threshold the design uses when zoomed out.
    if (step <= 9 || width <= 0 || height <= 0) return null;
    const p = Skia.PathBuilder.Make();
    const radius = camera.scale > 1.4 ? 1.4 : 1.1;
    const startX = camera.x % step;
    const startY = camera.y % step;
    for (let x = startX; x < width; x += step) {
      for (let y = startY; y < height; y += step) p.addCircle(x, y, radius);
    }
    return p.detach();
  }, [step, width, height, camera.x, camera.y, camera.scale]);

  if (!path) return null;
  return <Path path={path} color={c.borderStrong} />;
}
