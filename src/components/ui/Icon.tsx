/**
 * The app's icon set, transcribed from the design's SVGs.
 *
 * They are hand-written rather than pulled from an icon font because the design
 * draws them at a specific weight (1.9–2.4px strokes on a 24px grid, round caps
 * and joins) that no general-purpose set matches. Everything is stroked from
 * `currentColor` — i.e. the `color` prop — so a button can tint its icon by
 * passing one value, and filled variants are the exception rather than the rule.
 */
import { Circle, Ellipse, Path, Polyline, Rect, Svg } from 'react-native-svg';
import type { ReactElement } from 'react';

import { Colors } from '@/constants/theme';

export type IconName =
  | 'back'
  | 'chevron'
  | 'more'
  | 'close'
  | 'copy'
  | 'link'
  | 'plus'
  | 'minus'
  | 'check'
  | 'search'
  | 'lock'
  | 'lock-open'
  | 'share'
  | 'board'
  | 'people'
  | 'settings'
  | 'image'
  | 'download'
  | 'upload'
  | 'trash'
  | 'x-circle'
  | 'warning'
  | 'pencil'
  | 'eraser'
  | 'shapes'
  | 'text'
  | 'fill'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'line'
  | 'arrow'
  | 'undo'
  | 'redo'
  | 'edit';

/**
 * `s` is the stroke width the design uses for that glyph — a few are drawn
 * heavier (chevrons, the close cross) so they stay legible at 15px.
 */
const PATHS: Record<IconName, { s?: number; fill?: boolean; body: ReactElement }> = {
  back: { s: 2.2, body: <Polyline points="14.5,5 8,12 14.5,19" /> },
  chevron: { s: 2.2, body: <Polyline points="9.5,5 16,12 9.5,19" /> },
  more: {
    fill: true,
    body: (
      <>
        <Circle cx="5" cy="12" r="1.9" />
        <Circle cx="12" cy="12" r="1.9" />
        <Circle cx="19" cy="12" r="1.9" />
      </>
    ),
  },
  close: {
    s: 2.4,
    body: (
      <>
        <Path d="M6 6l12 12" />
        <Path d="M18 6L6 18" />
      </>
    ),
  },
  copy: {
    body: (
      <>
        <Rect x="9" y="9" width="11" height="11" rx="2.5" />
        <Path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6.5A2.5 2.5 0 0 0 4 5.5v6A2.5 2.5 0 0 0 6.5 14" />
      </>
    ),
  },
  link: {
    body: (
      <>
        <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7L11.5 7" />
        <Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.5-1.4" />
      </>
    ),
  },
  plus: {
    s: 2.4,
    body: (
      <>
        <Path d="M12 5v14" />
        <Path d="M5 12h14" />
      </>
    ),
  },
  minus: { s: 2.4, body: <Path d="M5 12h14" /> },
  check: { s: 2.6, body: <Polyline points="5,12.5 10,17.5 19,7" /> },
  search: {
    body: (
      <>
        <Circle cx="11" cy="11" r="6.5" />
        <Path d="M16 16l4.5 4.5" />
      </>
    ),
  },
  lock: {
    body: (
      <>
        <Rect x="4.5" y="10.5" width="15" height="10" rx="3" />
        <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </>
    ),
  },
  // The open padlock's shackle is lifted off its right post — the design uses
  // exactly this to tell a public board from a private one at a glance.
  'lock-open': {
    body: (
      <>
        <Rect x="4.5" y="10.5" width="15" height="10" rx="3" />
        <Path d="M8 10.5V8a4 4 0 0 1 7.5-2" />
      </>
    ),
  },
  share: {
    s: 2.2,
    body: (
      <>
        <Path d="M12 16V4" />
        <Polyline points="7.5,8.5 12,4 16.5,8.5" />
        <Path d="M5 14v4.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V14" />
      </>
    ),
  },
  board: {
    s: 2.2,
    body: (
      <>
        <Rect x="3" y="4.5" width="18" height="13" rx="2.5" />
        <Path d="M8 21h8" />
      </>
    ),
  },
  people: {
    body: (
      <>
        <Circle cx="9.5" cy="8.5" r="3.4" />
        <Path d="M3.8 19.5a5.8 5.8 0 0 1 11.4 0" />
        <Path d="M16 6.2a3.2 3.2 0 0 1 0 6" />
        <Path d="M17.6 14.4a5 5 0 0 1 2.7 4" />
      </>
    ),
  },
  settings: {
    body: (
      <>
        <Circle cx="12" cy="12" r="3.2" />
        <Path d="M12 3.2v2.4" />
        <Path d="M12 18.4v2.4" />
        <Path d="M3.2 12h2.4" />
        <Path d="M18.4 12h2.4" />
        <Path d="M6 6l1.7 1.7" />
        <Path d="M16.3 16.3L18 18" />
        <Path d="M18 6l-1.7 1.7" />
        <Path d="M7.7 16.3L6 18" />
      </>
    ),
  },
  image: {
    body: (
      <>
        <Rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <Circle cx="9" cy="10" r="1.6" />
        <Path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" />
      </>
    ),
  },
  download: {
    body: (
      <>
        <Path d="M12 4v12" />
        <Polyline points="7.5,11.5 12,16 16.5,11.5" />
        <Path d="M5 19h14" />
      </>
    ),
  },
  upload: {
    body: (
      <>
        <Path d="M12 20V8" />
        <Polyline points="7.5,12.5 12,8 16.5,12.5" />
        <Path d="M5 4h14" />
      </>
    ),
  },
  trash: {
    body: (
      <>
        <Path d="M4 7h16" />
        <Path d="M9.5 7V5h5v2" />
        <Path d="M6.5 7l1 13h9l1-13" />
      </>
    ),
  },
  'x-circle': {
    body: (
      <>
        <Circle cx="12" cy="12" r="8.5" />
        <Path d="M9 15l6-6" />
        <Path d="M9 9l6 6" />
      </>
    ),
  },
  warning: {
    body: (
      <>
        <Path d="M12 4.5l8.5 15H3.5z" />
        <Path d="M12 10v4" />
        <Path d="M12 16.6v.1" />
      </>
    ),
  },
  edit: {
    body: (
      <>
        <Path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
        <Path d="M14.5 6.5l3 3" />
      </>
    ),
  },
  pencil: {
    s: 1.9,
    body: (
      <>
        <Path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
        <Path d="M14.5 6.5l3 3" />
      </>
    ),
  },
  eraser: {
    s: 1.9,
    body: (
      <>
        <Rect x="3" y="11" width="13" height="9" rx="2" transform="rotate(-38 9.5 15.5)" />
        <Path d="M10 20h10" />
      </>
    ),
  },
  shapes: {
    s: 1.9,
    body: (
      <>
        <Rect x="3.5" y="4" width="11" height="11" rx="1.8" />
        <Circle cx="15.5" cy="15" r="5.2" />
      </>
    ),
  },
  text: {
    body: (
      <>
        <Path d="M5 6h14" />
        <Path d="M12 6v13" />
        <Path d="M9 19h6" />
      </>
    ),
  },
  fill: {
    s: 1.9,
    body: (
      <>
        <Path d="M12 3.5c3.2 3.6 5.5 6.3 5.5 9a5.5 5.5 0 0 1-11 0c0-2.7 2.3-5.4 5.5-9z" />
        <Path d="M9.4 13.6a2.7 2.7 0 0 0 2.6 2.6" />
      </>
    ),
  },
  rectangle: { body: <Rect x="4" y="5.5" width="16" height="13" rx="2" /> },
  ellipse: { body: <Ellipse cx="12" cy="12" rx="8" ry="8" /> },
  triangle: { body: <Path d="M12 5l8 14H4z" /> },
  line: { body: <Path d="M5 19L19 5" /> },
  arrow: {
    body: (
      <>
        <Path d="M4.5 19.5L19 5" />
        <Polyline points="11.5,5 19,5 19,12.5" />
      </>
    ),
  },
  undo: {
    body: (
      <>
        <Polyline points="9,5 4,10 9,15" />
        <Path d="M4 10h9a6 6 0 0 1 0 12h-3" />
      </>
    ),
  },
  redo: {
    body: (
      <>
        <Polyline points="15,5 20,10 15,15" />
        <Path d="M20 10h-9a6 6 0 0 0 0 12h3" />
      </>
    ),
  },
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Overrides the glyph's own stroke width. */
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color = Colors.text, strokeWidth }: IconProps) {
  const glyph = PATHS[name];
  const stroke = glyph.fill ? undefined : color;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={glyph.fill ? color : 'none'}
      stroke={stroke}
      strokeWidth={strokeWidth ?? glyph.s ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph.body}
    </Svg>
  );
}
