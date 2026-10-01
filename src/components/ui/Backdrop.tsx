/**
 * The ambient wash behind the home, nickname and PIN screens.
 *
 * These screens are mostly empty space, and the design fills it with soft
 * colour blooms and a few outlined shapes drifting behind the content — the
 * thing that makes an app with no content yet still feel like somewhere rather
 * than a blank form. It is purely decorative, so the whole layer is
 * `pointerEvents="none"` and carries no accessibility node.
 *
 * It is drawn with Skia rather than views so the very same scene can be drawn
 * again, blurred, inside every glass panel on the screen (`BackdropScene` is
 * what `GlassScene` hands to the panels — see ui/Glass). Positions are
 * fractions of the layer so the layout survives any device size.
 */
import {
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useState } from 'react';

import { useColors } from '@/features/session/store';
import { DotGrid } from '../board/ElementRenderer';
import { View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

export type BackdropVariant = 'home' | 'nickname' | 'pin';

interface Bloom {
  /** Fractions of the screen box, so the layout survives any device size. */
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity: number;
}

const BLOOMS: Record<BackdropVariant, Bloom[]> = {
  home: [
    { cx: 1.06, cy: -0.04, r: 0.4, color: '#8E4EC6', opacity: 0.34 },
    { cx: -0.16, cy: 0.3, r: 0.36, color: '#30A46C', opacity: 0.3 },
    { cx: 1.08, cy: 1.03, r: 0.36, color: '#0071E3', opacity: 0.26 },
    { cx: -0.1, cy: 0.92, r: 0.26, color: '#8E4EC6', opacity: 0.18 },
  ],
  nickname: [
    { cx: -0.12, cy: -0.03, r: 0.38, color: '#8E4EC6', opacity: 0.3 },
    { cx: 1.1, cy: 1.05, r: 0.4, color: '#30A46C', opacity: 0.28 },
    { cx: 1.05, cy: 0.3, r: 0.24, color: '#0071E3', opacity: 0.16 },
  ],
  pin: [
    { cx: 0.5, cy: -0.1, r: 0.38, color: '#0071E3', opacity: 0.24 },
    { cx: -0.14, cy: 0.34, r: 0.32, color: '#30A46C', opacity: 0.24 },
    { cx: 1.1, cy: 0.9, r: 0.3, color: '#8E4EC6', opacity: 0.2 },
  ],
};

/** Outlined / tinted geometry, positioned in fractions of the screen. */
interface Ornament {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  size: number;
  kind: 'square' | 'circle' | 'pill' | 'triangle' | 'glass' | 'dot';
  color: string;
  rotate?: number;
}

/**
 * Ornaments hug the edges: the middle of every one of these screens is a column
 * of text, and an outline crossing a heading turns decoration into noise.
 */
const ORNAMENTS: Record<BackdropVariant, Ornament[]> = {
  home: [
    { right: -0.09, top: 0.1, size: 92, kind: 'square', color: 'rgba(142,78,198,0.24)', rotate: 17 },
    { right: -0.16, top: 0.54, size: 120, kind: 'circle', color: 'rgba(48,164,108,0.22)' },
    { left: -0.1, bottom: 0.2, size: 58, kind: 'glass', color: 'rgba(255,255,255,0.35)', rotate: -12 },
    { left: -0.11, top: 0.06, size: 64, kind: 'triangle', color: 'rgba(48,164,108,0.2)', rotate: 14 },
    { left: -0.08, top: 0.52, size: 90, kind: 'pill', color: 'rgba(0,113,227,0.18)', rotate: -8 },
    { right: 0.06, bottom: 0.06, size: 44, kind: 'dot', color: 'rgba(142,78,198,0.2)' },
    { right: 0.22, top: 0.3, size: 14, kind: 'dot', color: 'rgba(0,113,227,0.16)' },
    { left: 0.16, top: 0.24, size: 10, kind: 'dot', color: 'rgba(48,164,108,0.22)' },
    { right: 0.14, top: 0.82, size: 36, kind: 'square', color: 'rgba(48,164,108,0.2)', rotate: -22 },
    { left: 0.06, bottom: 0.4, size: 22, kind: 'circle', color: 'rgba(142,78,198,0.24)' },
    { right: -0.04, bottom: 0.3, size: 48, kind: 'triangle', color: 'rgba(0,113,227,0.16)', rotate: 28 },
    { left: 0.3, bottom: 0.04, size: 70, kind: 'pill', color: 'rgba(48,164,108,0.16)', rotate: 12 },
    { left: 0.42, top: 0.08, size: 8, kind: 'dot', color: 'rgba(142,78,198,0.22)' },
  ],
  nickname: [
    { left: -0.16, top: 0.42, size: 110, kind: 'square', color: 'rgba(0,113,227,0.2)', rotate: 24 },
    { right: -0.08, bottom: 0.26, size: 74, kind: 'circle', color: 'rgba(142,78,198,0.22)' },
    { right: -0.12, top: 0.16, size: 70, kind: 'triangle', color: 'rgba(48,164,108,0.2)', rotate: -18 },
    { left: -0.06, bottom: 0.08, size: 52, kind: 'glass', color: 'rgba(255,255,255,0.35)', rotate: 11 },
    { right: 0.1, top: 0.06, size: 12, kind: 'dot', color: 'rgba(0,113,227,0.18)' },
    { right: 0.2, top: 0.5, size: 34, kind: 'square', color: 'rgba(48,164,108,0.18)', rotate: 12 },
    { left: 0.1, top: 0.2, size: 18, kind: 'circle', color: 'rgba(142,78,198,0.22)' },
    { right: -0.02, bottom: 0.06, size: 84, kind: 'pill', color: 'rgba(0,113,227,0.16)', rotate: -14 },
    { left: 0.24, bottom: 0.3, size: 9, kind: 'dot', color: 'rgba(48,164,108,0.24)' },
    { left: 0.5, top: 0.04, size: 8, kind: 'dot', color: 'rgba(142,78,198,0.2)' },
  ],
  pin: [
    { right: -0.22, top: 0.32, size: 150, kind: 'square', color: 'rgba(142,78,198,0.2)', rotate: -16 },
    { left: -0.14, bottom: 0.12, size: 76, kind: 'circle', color: 'rgba(48,164,108,0.22)' },
    { left: -0.08, top: 0.1, size: 56, kind: 'triangle', color: 'rgba(0,113,227,0.16)', rotate: 18 },
    { right: 0.08, bottom: 0.06, size: 40, kind: 'glass', color: 'rgba(255,255,255,0.35)', rotate: 9 },
    { left: 0.12, top: 0.36, size: 12, kind: 'dot', color: 'rgba(142,78,198,0.22)' },
    { right: 0.14, top: 0.08, size: 9, kind: 'dot', color: 'rgba(48,164,108,0.24)' },
    { left: 0.06, bottom: 0.4, size: 72, kind: 'pill', color: 'rgba(48,164,108,0.16)', rotate: -10 },
  ],
};

function OrnamentNode({ o, width, height }: { o: Ornament; width: number; height: number }) {
  const w = o.size;
  const h = o.kind === 'pill' ? o.size * 0.29 : o.size;
  const x = o.left !== undefined ? o.left * width : width - (o.right ?? 0) * width - w;
  const y = o.top !== undefined ? o.top * height : height - (o.bottom ?? 0) * height - h;
  const origin = vec(x + w / 2, y + h / 2);
  const transform = o.rotate ? [{ rotate: (o.rotate * Math.PI) / 180 }] : undefined;

  let shape;
  switch (o.kind) {
    case 'square':
      shape = (
        <RoundedRect x={x} y={y} width={w} height={h} r={w * 0.24} style="stroke" strokeWidth={2} color={o.color} />
      );
      break;
    case 'circle':
      shape = <Circle cx={x + w / 2} cy={y + h / 2} r={w / 2 - 1} style="stroke" strokeWidth={2} color={o.color} />;
      break;
    case 'pill':
      shape = <RoundedRect x={x} y={y} width={w} height={h} r={h / 2} style="stroke" strokeWidth={2} color={o.color} />;
      break;
    case 'dot':
      shape = <Circle cx={x + w / 2} cy={y + h / 2} r={w / 2} color={o.color} />;
      break;
    case 'glass':
      shape = (
        <>
          <RoundedRect x={x} y={y} width={w} height={h} r={w * 0.24} color={o.color} />
          <RoundedRect x={x} y={y} width={w} height={h} r={w * 0.24} style="stroke" strokeWidth={1} color={o.color} />
        </>
      );
      break;
    case 'triangle': {
      const path = Skia.PathBuilder.Make()
        .moveTo(x + w / 2, y)
        .lineTo(x + w, y + h)
        .lineTo(x, y + h)
        .close()
        .detach();
      shape = <Path path={path} color={o.color} />;
      break;
    }
  }

  return (
    <Group origin={origin} transform={transform}>
      {shape}
    </Group>
  );
}

/**
 * The wash as Skia nodes, in the coordinates of a `width` × `height` layer.
 * Rendered once as the real background and again, blurred, under each panel.
 */
export function BackdropScene({
  variant,
  width,
  height,
}: {
  variant: BackdropVariant;
  width: number;
  height: number;
}) {
  const c = useColors();
  if (width <= 0 || height <= 0) return null;
  const blooms = BLOOMS[variant];
  const ornaments = ORNAMENTS[variant];
  const far = Math.max(width, height);

  return (
    <Group>
      {/* The ground is the whiteboard itself — its colour and its dot grid —
          so the home card sits over a board rather than over a wash. */}
      <Rect x={0} y={0} width={width} height={height} color={c.background} />
      <DotGrid width={width} height={height} camera={{ x: 13, y: 13, scale: 1 }} />
      {blooms.map((b, i) => {
        const r = b.r * far;
        const cx = b.cx * width;
        const cy = b.cy * height;
        return (
          <Rect key={i} x={cx - r} y={cy - r} width={r * 2} height={r * 2}>
            <RadialGradient
              c={vec(cx, cy)}
              r={r}
              colors={[withOpacity(b.color, b.opacity), withOpacity(b.color, 0)]}
              positions={[0, 0.7]}
            />
          </Rect>
        );
      })}
      {ornaments.map((o, i) => (
        <OrnamentNode key={i} o={o} width={width} height={height} />
      ))}
    </Group>
  );
}

/** `#RRGGBB` + alpha → `rgba()`, which Skia parses like the rest of the app. */
function withOpacity(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function Backdrop({ variant }: { variant: BackdropVariant }) {
  // Drawn at the size this layer is actually given, not the window's: with
  // edge-to-edge on Android the window height stops short of the screen, and
  // the wash would end in a white band above the nav bar. The window size is
  // only the first-frame guess until `onLayout` reports.
  const window = useWindowDimensions();
  const c = useColors();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const width = size?.width ?? window.width;
  const height = size?.height ?? window.height;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  };

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.background }}
    >
      <Canvas style={{ flex: 1 }}>
        <BackdropScene variant={variant} width={width} height={height} />
      </Canvas>
    </View>
  );
}
