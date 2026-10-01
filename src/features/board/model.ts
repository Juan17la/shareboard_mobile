/**
 * The whiteboard data model — the contract this app shares with the Node
 * backend (`server/src/model/types.ts`) and the web client
 * (`web/src/lib/contract.ts`). Documented in docs/05-model-date.
 *
 * The three projects each keep their own copy rather than importing a shared
 * package, so none of them depends on the others at build time. The cost is
 * that a change here must be mirrored in the other two.
 *
 * Two conventions run through the whole model. Elements are discriminated by
 * `kind` and carry a `z` for paint order, which the server reassigns on `add`
 * so concurrent draws from different clients cannot land on the same layer.
 * And deletes are *soft* (`deleted: true`) rather than removals, so a delete
 * arriving twice, or out of order against an edit, still converges everywhere.
 */

export type UserId = string;
export type ElementId = string;
export type BoardAccess = 'public' | 'private';
export type EditPolicy = 'everyone' | 'selected' | 'creator-only';
export type Role = 'creator' | 'editor' | 'viewer';

export type ShapeKind = 'rectangle' | 'ellipse' | 'triangle' | 'polygon' | 'line' | 'arrow';

/**
 * The active tool. The shape *kind* is not a tool: it lives in
 * `ToolConfig.shape`, though the toolbar shows one button per kind so any of
 * them is a single tap away. `hand` only moves the camera.
 */
export type ToolType = 'hand' | 'select' | 'pen' | 'eraser' | 'shape' | 'text' | 'fill';

/** What a line or arrow ends in. Grouped as the toolbar shows them. */
export const MARKERS = {
  default: ['none', 'arrow', 'triangle', 'triangle-outline'],
  other: ['circle', 'circle-outline', 'circle-half', 'diamond', 'diamond-outline', 'bar'],
  cardinality: ['one', 'many', 'zero-one', 'zero-many', 'one-many'],
} as const;
export type Marker = (typeof MARKERS)[keyof typeof MARKERS][number];
export const ALL_MARKERS: Marker[] = [...MARKERS.default, ...MARKERS.other, ...MARKERS.cardinality];

/** How a line gets from `from` to `to`: sharp, curved, or elbowed. */
export const ROUTES = ['straight', 'curved', 'elbow'] as const;
export type Route = (typeof ROUTES)[number];
/** Which way a line runs at one of an elbow's ends: across (`h`) or up and down (`v`). */
export const AXES = ['h', 'v'] as const;
export type Axis = (typeof AXES)[number];
export const DASHES = ['solid', 'dashed', 'dotted'] as const;
export type Dash = (typeof DASHES)[number];
/** Typefaces a text or a figure's label can be set in; absent is `sans` (Nunito). */
export const FONTS = ['sans', 'serif', 'mono', 'hand'] as const;
export type FontKey = (typeof FONTS)[number];

/** A line end bound to a shape: the point is (u, v) ∈ [0,1]² of that shape's box. */
export interface Link {
  id: ElementId;
  u: number;
  v: number;
}

/** Shape kinds that enclose an area, and so can carry a fill. */
export const FILLABLE_SHAPES: ShapeKind[] = ['rectangle', 'ellipse', 'triangle', 'polygon'];

export function isFillable(shape: ShapeKind): boolean {
  return FILLABLE_SHAPES.includes(shape);
}

/** Default size of a label inside a shape. Smaller than the text tool's: it has to fit. */
export const SHAPE_TEXT_SIZE = 18;

/** Corners of a new polygon. */
export const DEFAULT_SIDES = 5;

export interface Point {
  x: number;
  y: number;
}

export interface ElementBase {
  id: ElementId;
  createdBy: UserId;
  createdAt: number;
  updatedAt: number;
  z: number;
  deleted?: boolean;
  /** Elements sharing a group id select and move as one. */
  group?: string | null;
  /**
   * Radians, clockwise, about the centre of the element's box. Only boxes
   * (enclosed shapes), text and images turn; lines and strokes ignore it —
   * their points already say which way they go.
   */
  rotation?: number;
}

export interface StrokeElement extends ElementBase {
  kind: 'stroke';
  /** Flat [x0, y0, x1, y1, ...] — half the JSON of an array of objects. */
  points: number[];
  color: string;
  width: number;
}

export interface ShapeElement extends ElementBase {
  kind: 'shape';
  shape: ShapeKind;
  from: Point;
  to: Point;
  stroke: string;
  strokeWidth: number;
  fill?: string | null;
  /** Optional label, centred inside the shape (on the midpoint of a line). */
  text?: string;
  /** Label size; `SHAPE_TEXT_SIZE` when absent. */
  fontSize?: number;
  /** Label typeface; `sans` when absent. */
  font?: FontKey;
  /** A line's label: how far along its route it stands, 0..1; the middle when absent. */
  labelAt?: number;
  /** A polygon's corner count, `LIMITS.minSides`..`maxSides`; `DEFAULT_SIDES` when absent. */
  sides?: number;
  // Lines and arrows only. Absent: no start marker, an `arrow` head on an arrow.
  headStart?: Marker;
  headEnd?: Marker;
  route?: Route;
  /**
   * How far a curved or elbow route is folded from its default: a curve's
   * sideways offset in board units (signed, left/right of the chord); an
   * elbow's turn point as a fraction (0..1) along the long axis. Absent is
   * the route's default fold — a quarter-length curve, a midpoint elbow.
   */
  bend?: number;
  dash?: Dash;
  /**
   * Elbow only: the direction the line leaves its start / arrives at its end
   * along. Absent: the long axis — or, at an end bound to a side of a shape,
   * straight out of that side. Two different axes make a single corner.
   */
  startAxis?: Axis;
  endAxis?: Axis;
  /**
   * Curved only: where the two control points of the curve stand, as offsets
   * from the start and from the end — the direction and pull of the line
   * there. Absent: the original fixed bow (`bend`).
   */
  curveFrom?: Point;
  curveTo?: Point;
  /** Ends bound to a shape follow it when it moves. Null: unbound. */
  fromLink?: Link | null;
  toLink?: Link | null;
}

export interface TextElement extends ElementBase {
  kind: 'text';
  at: Point;
  text: string;
  color: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  /** Typeface; `sans` when absent. */
  font?: FontKey;
  /** Wrap width in board units; absent, each line is as long as it is typed. */
  width?: number;
}

export interface ImageElement extends ElementBase {
  kind: 'image';
  at: Point;
  width: number;
  height: number;
  /** Remote URL or a data: URI. */
  uri: string;
}

export type BoardElement = StrokeElement | ShapeElement | TextElement | ImageElement;

export interface BoardMeta {
  id: string;
  shortCode: string;
  name: string;
  access: BoardAccess;
  editPolicy: EditPolicy;
  /** userIds allowed to edit when editPolicy is 'selected'. */
  editors: UserId[];
  creatorId: UserId;
  /** Whether a PIN is set. The PIN itself never leaves the server. */
  hasPin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Participant {
  userId: UserId;
  nickname: string;
  /** Presence color, assigned by the server on join. */
  color: string;
  /** Presence icon (an emoji) picked on the identity screen; the initial when absent. */
  avatar?: string;
  role: Role;
  /** Latest known position; never persisted. */
  cursor?: Point;
  /**
   * Element ids this participant has selected — and so holds: first to select
   * wins, and nobody else can select or change them until they are let go
   * (deselected, or the participant leaves).
   */
  selection?: string[];
  lastSeen: number;
}

/** The unit of change. Every edit becomes one of these, local or remote. */
export type Op =
  | { t: 'add'; el: BoardElement }
  | { t: 'update'; id: ElementId; patch: Partial<BoardElement>; updatedAt: number }
  | { t: 'delete'; id: ElementId }
  | { t: 'clear' };

export const SNAPSHOT_FORMAT = 'live-whiteboard' as const;
export const SNAPSHOT_VERSION = 1 as const;

/** The export/import file format. `version` only rises on a breaking change. */
export interface BoardSnapshot {
  format: typeof SNAPSHOT_FORMAT;
  version: typeof SNAPSHOT_VERSION;
  meta: { name: string };
  /** Visible elements only, sorted by z. */
  elements: BoardElement[];
  exportedAt: number;
}

/** The server closes the socket on a frame over this many bytes (`REALTIME_LIMITS.maxMessageBytes` there). */
export const MAX_MESSAGE_BYTES = 256 * 1024;

/** Enforced on both ends: the client keeps the UI honest, the server decides. */
export const LIMITS = {
  maxElements: 5000,
  maxStrokePoints: 2000,
  maxTextLength: 2000,
  minStrokeWidth: 1,
  maxStrokeWidth: 64,
  minFontSize: 10,
  maxFontSize: 400,
  minSides: 4,
  maxSides: 12,
  maxNicknameLength: 40,
  maxBoardNameLength: 80,
  /** #RRGGBB, or #RRGGBBAA for the translucent fills the shape tool paints. */
  colorPattern: /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/,
} as const;

/** Presence colors, handed out by the server in join order. */
export const PRESENCE_COLORS = [
  '#E5484D',
  '#F76808',
  '#30A46C',
  '#208AEF',
  '#8E4EC6',
  '#0EA5E9',
] as const;

/**
 * Permission rules, mirroring `server/src/model/rules.ts`. The server is the
 * authority — it re-checks every op — but the UI needs the same answer locally
 * to grey out tools without a round trip. Both arguments are nullable because
 * the store asks these before a board has finished loading.
 */
export function roleFor(meta: BoardMeta | null, userId: UserId | null): Role {
  if (!meta || !userId) return 'viewer';
  if (userId === meta.creatorId) return 'creator';
  if (meta.editPolicy === 'everyone') return 'editor';
  if (meta.editPolicy === 'selected' && meta.editors.includes(userId)) return 'editor';
  return 'viewer';
}

export function canEdit(meta: BoardMeta | null, userId: UserId | null): boolean {
  return roleFor(meta, userId) !== 'viewer';
}
