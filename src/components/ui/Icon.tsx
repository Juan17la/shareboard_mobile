/**
 * The app's icon set: [Phosphor](https://phosphoricons.com), one glyph per
 * name the UI asks for. Callers keep saying `<Icon name="plus" />`; this file
 * is the only place that knows which Phosphor glyph and weight that means, so
 * swapping one is a one-line change. A button tints its icon by passing one
 * `color`; the theme's text colour is the default.
 *
 * Same mapping as `web/src/components/ui/Icon.tsx` (which also has the
 * web-only `keyboard` and `fit`).
 */
import {
  ArrowDownIcon,
  ArrowLineDownIcon,
  ArrowLineUpIcon,
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BoundingBoxIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChalkboardSimpleIcon,
  CheckIcon,
  CircleIcon,
  ClipboardTextIcon,
  CopyIcon,
  CursorIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  EraserIcon,
  GearSixIcon,
  SlidersHorizontalIcon,
  HandIcon,
  HexagonIcon,
  ImageIcon,
  LineSegmentIcon,
  LinkIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  MoonIcon,
  PaintBucketIcon,
  PencilSimpleIcon,
  PencilSimpleLineIcon,
  PlusIcon,
  RectangleIcon,
  ScissorsIcon,
  SelectionSlashIcon,
  ShareNetworkIcon,
  ShapesIcon,
  SparkleIcon,
  SunIcon,
  TextTIcon,
  TrashIcon,
  TriangleIcon,
  UploadSimpleIcon,
  UsersIcon,
  WarningIcon,
  XCircleIcon,
  XIcon,
  type Icon as PhosphorIcon,
  type IconWeight,
} from 'phosphor-react-native';

import { useColors } from '@/features/session/store';

export type IconName =
  | 'back'
  | 'chevron'
  | 'more'
  | 'close'
  | 'copy'
  | 'cut'
  | 'paste'
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
  | 'options'
  | 'image'
  | 'download'
  | 'upload'
  | 'trash'
  | 'x-circle'
  | 'warning'
  | 'hand'
  | 'pencil'
  | 'eraser'
  | 'shapes'
  | 'text'
  | 'fill'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'polygon'
  | 'line'
  | 'arrow'
  | 'undo'
  | 'redo'
  | 'edit'
  | 'cursor'
  | 'group'
  | 'ungroup'
  | 'to-back'
  | 'backward'
  | 'forward'
  | 'to-front'
  | 'moon'
  | 'sun'
  | 'sparkle';

/** `bold` for the small marks (chevrons, the cross) so they hold up at 15px. */
const GLYPHS: Record<IconName, [PhosphorIcon, IconWeight?]> = {
  back: [CaretLeftIcon, 'bold'],
  chevron: [CaretRightIcon, 'bold'],
  more: [DotsThreeIcon, 'bold'],
  close: [XIcon, 'bold'],
  copy: [CopyIcon],
  cut: [ScissorsIcon],
  paste: [ClipboardTextIcon],
  link: [LinkIcon],
  plus: [PlusIcon, 'bold'],
  minus: [MinusIcon, 'bold'],
  check: [CheckIcon, 'bold'],
  search: [MagnifyingGlassIcon],
  lock: [LockSimpleIcon],
  'lock-open': [LockSimpleOpenIcon],
  share: [ShareNetworkIcon],
  board: [ChalkboardSimpleIcon],
  people: [UsersIcon],
  settings: [GearSixIcon],
  options: [SlidersHorizontalIcon],
  image: [ImageIcon],
  download: [DownloadSimpleIcon],
  upload: [UploadSimpleIcon],
  trash: [TrashIcon],
  'x-circle': [XCircleIcon],
  warning: [WarningIcon],
  hand: [HandIcon],
  pencil: [PencilSimpleIcon],
  eraser: [EraserIcon],
  shapes: [ShapesIcon],
  text: [TextTIcon],
  fill: [PaintBucketIcon],
  rectangle: [RectangleIcon],
  ellipse: [CircleIcon],
  triangle: [TriangleIcon],
  polygon: [HexagonIcon],
  line: [LineSegmentIcon],
  arrow: [ArrowUpRightIcon],
  undo: [ArrowUUpLeftIcon],
  redo: [ArrowUUpRightIcon],
  edit: [PencilSimpleLineIcon],
  cursor: [CursorIcon],
  group: [BoundingBoxIcon],
  ungroup: [SelectionSlashIcon],
  'to-back': [ArrowLineDownIcon],
  backward: [ArrowDownIcon],
  forward: [ArrowUpIcon],
  'to-front': [ArrowLineUpIcon],
  moon: [MoonIcon],
  sun: [SunIcon],
  sparkle: [SparkleIcon],
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color: tint }: IconProps) {
  const c = useColors();
  const [Glyph, weight = 'regular'] = GLYPHS[name];
  return <Glyph size={size} weight={weight} color={tint ?? c.text} />;
}
