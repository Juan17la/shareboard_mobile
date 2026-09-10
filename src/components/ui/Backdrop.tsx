/**
 * The ambient wash behind the home, nickname and PIN screens.
 *
 * These screens are mostly empty space, and the design fills it with soft
 * colour blooms and a few outlined shapes drifting behind the content — the
 * thing that makes an app with no content yet still feel like somewhere rather
 * than a blank form. It is purely decorative, so the whole layer is
 * `pointerEvents="none"` and carries no accessibility node.
 *
 * The blooms are SVG radial gradients (React Native has no radial gradient of
 * its own) and the outlines are plain rotated views, which is cheaper than
 * putting everything through Svg.
 */
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import { View, useWindowDimensions } from 'react-native';

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
    { cx: 1.06, cy: -0.04, r: 0.34, color: '#8E4EC6', opacity: 0.3 },
    { cx: -0.16, cy: 0.3, r: 0.3, color: '#30A46C', opacity: 0.26 },
    { cx: 1.08, cy: 1.03, r: 0.3, color: '#6D3FB5', opacity: 0.22 },
  ],
  nickname: [
    { cx: -0.12, cy: -0.03, r: 0.32, color: '#8E4EC6', opacity: 0.26 },
    { cx: 1.1, cy: 1.05, r: 0.34, color: '#30A46C', opacity: 0.24 },
  ],
  pin: [
    { cx: 0.5, cy: -0.1, r: 0.32, color: '#6D3FB5', opacity: 0.22 },
    { cx: -0.14, cy: 0.34, r: 0.28, color: '#30A46C', opacity: 0.22 },
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
    { right: -0.09, top: 0.1, size: 92, kind: 'square', color: 'rgba(142,78,198,0.22)', rotate: 17 },
    { right: -0.16, top: 0.54, size: 120, kind: 'circle', color: 'rgba(48,164,108,0.2)' },
    { left: -0.1, bottom: 0.2, size: 58, kind: 'glass', color: 'rgba(255,255,255,0.7)', rotate: -12 },
    { left: -0.11, top: 0.06, size: 64, kind: 'triangle', color: 'rgba(48,164,108,0.18)', rotate: 14 },
    { left: -0.08, top: 0.52, size: 90, kind: 'pill', color: 'rgba(109,63,181,0.16)', rotate: -8 },
    { right: 0.06, bottom: 0.06, size: 44, kind: 'dot', color: 'rgba(142,78,198,0.2)' },
  ],
  nickname: [
    { left: -0.16, top: 0.42, size: 110, kind: 'square', color: 'rgba(109,63,181,0.18)', rotate: 24 },
    { right: -0.08, bottom: 0.26, size: 74, kind: 'circle', color: 'rgba(142,78,198,0.2)' },
    { right: -0.12, top: 0.16, size: 70, kind: 'triangle', color: 'rgba(48,164,108,0.18)', rotate: -18 },
    { left: -0.06, bottom: 0.08, size: 52, kind: 'glass', color: 'rgba(255,255,255,0.7)', rotate: 11 },
  ],
  pin: [
    { right: -0.22, top: 0.32, size: 150, kind: 'square', color: 'rgba(142,78,198,0.18)', rotate: -16 },
    { left: -0.14, bottom: 0.12, size: 76, kind: 'circle', color: 'rgba(48,164,108,0.2)' },
  ],
};

function OrnamentView({ o, width, height }: { o: Ornament; width: number; height: number }) {
  const position = {
    position: 'absolute' as const,
    ...(o.left !== undefined ? { left: o.left * width } : null),
    ...(o.right !== undefined ? { right: o.right * width } : null),
    ...(o.top !== undefined ? { top: o.top * height } : null),
    ...(o.bottom !== undefined ? { bottom: o.bottom * height } : null),
    ...(o.rotate ? { transform: [{ rotate: `${o.rotate}deg` }] } : null),
  };

  switch (o.kind) {
    case 'square':
      return (
        <View
          style={[
            position,
            { width: o.size, height: o.size, borderRadius: o.size * 0.24, borderWidth: 2, borderColor: o.color },
          ]}
        />
      );
    case 'circle':
      return (
        <View
          style={[
            position,
            { width: o.size, height: o.size, borderRadius: o.size / 2, borderWidth: 2, borderColor: o.color },
          ]}
        />
      );
    case 'pill':
      return (
        <View
          style={[
            position,
            {
              width: o.size,
              height: o.size * 0.29,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: o.color,
            },
          ]}
        />
      );
    case 'dot':
      return (
        <View
          style={[position, { width: o.size, height: o.size, borderRadius: o.size / 2, backgroundColor: o.color }]}
        />
      );
    case 'glass':
      return (
        <View
          style={[
            position,
            {
              width: o.size,
              height: o.size,
              borderRadius: o.size * 0.24,
              backgroundColor: 'rgba(255,255,255,0.5)',
              borderWidth: 1,
              borderColor: o.color,
            },
          ]}
        />
      );
    case 'triangle':
      // A triangle with no clip-path: a zero-width box whose thick side borders
      // meet at a point. The standard React Native trick.
      return (
        <View
          style={[
            position,
            {
              width: 0,
              height: 0,
              borderLeftWidth: o.size / 2,
              borderRightWidth: o.size / 2,
              borderBottomWidth: o.size,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: o.color,
              backgroundColor: 'transparent',
            },
          ]}
        />
      );
  }
}

export function Backdrop({ variant }: { variant: BackdropVariant }) {
  const { width, height } = useWindowDimensions();
  const blooms = BLOOMS[variant];
  const ornaments = ORNAMENTS[variant];

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="base" cx="20%" cy="0%" r="110%">
            <Stop offset="0" stopColor="#EEF1FB" />
            <Stop offset="0.45" stopColor="#F7F8FC" />
            <Stop offset="1" stopColor="#FFFFFF" />
          </RadialGradient>
          {blooms.map((b, i) => (
            <RadialGradient key={i} id={`bloom${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
              <Stop offset="0.7" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#base)" />
        {blooms.map((b, i) => {
          const r = b.r * Math.max(width, height);
          return (
            <Rect
              key={i}
              x={b.cx * width - r}
              y={b.cy * height - r}
              width={r * 2}
              height={r * 2}
              fill={`url(#bloom${i})`}
            />
          );
        })}
      </Svg>
      {ornaments.map((o, i) => (
        <OrnamentView key={i} o={o} width={width} height={height} />
      ))}
    </View>
  );
}
