import {
  Group,
  Image,
  Line,
  Oval,
  Path,
  RoundedRect,
  Skia,
  Text as SkText,
  matchFont,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { strokeToSvgPath } from '@/features/board/geometry';
import type { BoardElement, Point, ShapeElement } from '@/features/board/model';

import { useBoardFonts } from './BoardFonts';

function ArrowHead({
  from,
  to,
  color,
  width,
}: {
  from: Point;
  to: Point;
  color: string;
  width: number;
}) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = Math.max(10, width * 3);
  const p = Skia.Path.Make();
  p.moveTo(to.x, to.y);
  p.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  p.moveTo(to.x, to.y);
  p.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  return <Path path={p} style="stroke" strokeWidth={width} color={color} strokeCap="round" />;
}

function ShapeView({ el }: { el: ShapeElement }) {
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
    const path = Skia.Path.Make();
    path.moveTo(x + w / 2, y);
    path.lineTo(x + w, y + h);
    path.lineTo(x, y + h);
    path.close();
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
  return (
    <Group>
      <Line
        p1={vec(el.from.x, el.from.y)}
        p2={vec(el.to.x, el.to.y)}
        color={el.stroke}
        style="stroke"
        strokeWidth={el.strokeWidth}
        strokeCap="round"
      />
      {el.shape === 'arrow' ? (
        <ArrowHead from={el.from} to={el.to} color={el.stroke} width={el.strokeWidth} />
      ) : null}
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

function TextView({ el }: { el: Extract<BoardElement, { kind: 'text' }> }) {
  const provider = useBoardFonts();
  const font = useMemo(
    () =>
      matchFont(
        {
          fontFamily: provider ? 'Nunito' : 'system',
          fontSize: el.fontSize,
          fontWeight: el.bold ? '800' : '500',
          fontStyle: el.italic ? 'italic' : 'normal',
        },
        provider ?? undefined,
      ),
    [provider, el.fontSize, el.bold, el.italic],
  );
  // Skia draws text from the baseline; nudge down by ~the font size.
  return <SkText x={el.at.x} y={el.at.y + el.fontSize} text={el.text} font={font} color={el.color} />;
}

/** Renders one board element with Skia primitives. */
export function ElementRenderer({ el, smooth = true }: { el: BoardElement; smooth?: boolean }) {
  switch (el.kind) {
    case 'stroke':
      return (
        <Path
          path={strokeToSvgPath(el.points, smooth)}
          style="stroke"
          strokeWidth={el.width}
          color={el.color}
          strokeCap="round"
          strokeJoin="round"
        />
      );
    case 'shape':
      return <ShapeView el={el} />;
    case 'image':
      return <ImageView uri={el.uri} x={el.at.x} y={el.at.y} width={el.width} height={el.height} />;
    case 'text':
      return <TextView el={el} />;
    default:
      return null;
  }
}

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
  const step = 26 * camera.scale;
  const path = useMemo(() => {
    // Below ~9px apart the dots read as a grey wash, so the grid drops out —
    // the same threshold the design uses when zoomed out.
    if (step <= 9 || width <= 0 || height <= 0) return null;
    const p = Skia.Path.Make();
    const radius = camera.scale > 1.4 ? 1.4 : 1.1;
    const startX = camera.x % step;
    const startY = camera.y % step;
    for (let x = startX; x < width; x += step) {
      for (let y = startY; y < height; y += step) p.addCircle(x, y, radius);
    }
    return p;
  }, [step, width, height, camera.x, camera.y, camera.scale]);

  if (!path) return null;
  return <Path path={path} color="rgba(27,32,48,0.13)" />;
}
