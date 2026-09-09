import {
  Circle,
  Group,
  Image,
  Line,
  Oval,
  Path,
  Rect,
  Skia,
  Text as SkText,
  matchFont,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { strokeToSvgPath } from '@/features/board/geometry';
import type { BoardElement, ShapeElement } from '@/features/board/model';

function ArrowHead({ from, to, color, width }: { from: { x: number; y: number }; to: { x: number; y: number }; color: string; width: number }) {
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
    return (
      <Group>
        {el.fill ? <Rect x={x} y={y} width={w} height={h} color={el.fill} /> : null}
        <Rect x={x} y={y} width={w} height={h} color={el.stroke} style="stroke" strokeWidth={el.strokeWidth} />
      </Group>
    );
  }
  if (el.shape === 'ellipse') {
    return (
      <Group>
        {el.fill ? <Oval x={x} y={y} width={w} height={h} color={el.fill} /> : null}
        <Oval x={x} y={y} width={w} height={h} color={el.stroke} style="stroke" strokeWidth={el.strokeWidth} />
      </Group>
    );
  }
  // line / arrow
  return (
    <Group>
      <Line p1={vec(el.from.x, el.from.y)} p2={vec(el.to.x, el.to.y)} color={el.stroke} style="stroke" strokeWidth={el.strokeWidth} strokeCap="round" />
      {el.shape === 'arrow' ? <ArrowHead from={el.from} to={el.to} color={el.stroke} width={el.strokeWidth} /> : null}
    </Group>
  );
}

function ImageView({ uri, x, y, width, height }: { uri: string; x: number; y: number; width: number; height: number }) {
  const image = useImage(uri);
  if (!image) return null;
  return <Image image={image} x={x} y={y} width={width} height={height} fit="contain" />;
}

function TextView({ el }: { el: Extract<BoardElement, { kind: 'text' }> }) {
  const font = useMemo(
    () =>
      matchFont({
        fontFamily: 'system',
        fontSize: el.fontSize,
        fontWeight: el.bold ? 'bold' : 'normal',
        fontStyle: el.italic ? 'italic' : 'normal',
      }),
    [el.fontSize, el.bold, el.italic],
  );
  // Skia draws text from the baseline; nudge down by ~the font size.
  return <SkText x={el.at.x} y={el.at.y + el.fontSize} text={el.text} font={font} color={el.color} />;
}

/** Renders one board element with Skia primitives. */
export function ElementRenderer({ el }: { el: BoardElement }) {
  switch (el.kind) {
    case 'stroke': {
      const path = strokeToSvgPath(el.points);
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

/** A dot marking another participant's live cursor. */
export function CursorDot({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <Group>
      <Circle cx={x} cy={y} r={4} color={color} />
      <Circle cx={x} cy={y} r={7} color={color} style="stroke" strokeWidth={1.5} opacity={0.5} />
    </Group>
  );
}
