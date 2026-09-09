/**
 * Canonical whiteboard data model — the contract shared with the Node backend
 * (`server/src/model/types.ts`) and the web client (`web/src/lib/contract.ts`).
 *
 * Each project keeps its own copy on purpose: the three stay independent and
 * only agree on the wire shape. Documented in docs/05-model-date; any change
 * here must be mirrored in the other two.
 */

export type UserId = string;
export type ElementId = string;
export type BoardAccess = 'public' | 'private';
export type EditPolicy = 'everyone' | 'selected' | 'creator-only';
export type Role = 'creator' | 'editor' | 'viewer';

/** Shapes the shape tool can draw. */
export type ShapeKind = 'rectangle' | 'ellipse' | 'line' | 'arrow';

/** Active tool on the canvas. Shape tools double as `ShapeKind`. */
export type ToolType = 'select' | 'pen' | 'eraser' | 'text' | ShapeKind;

export interface Point {
  x: number;
  y: number;
}

export interface ElementBase {
  id: ElementId;
  createdBy: UserId;
  createdAt: number;
  updatedAt: number;
  /** Paint order; higher is on top. Assigned on `add`. */
  z: number;
  /** Soft delete, so removals propagate deterministically. */
  deleted?: boolean;
}

export interface StrokeElement extends ElementBase {
  kind: 'stroke';
  /** Flat [x0, y0, x1, y1, ...]. */
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
}

export interface TextElement extends ElementBase {
  kind: 'text';
  at: Point;
  text: string;
  color: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
}

export interface ImageElement extends ElementBase {
  kind: 'image';
  at: Point;
  width: number;
  height: number;
  /** Remote URL or data: URI. */
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
  /** The PIN itself never leaves the server. */
  hasPin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Participant {
  userId: UserId;
  nickname: string;
  /** Presence color, assigned by the server on join. */
  color: string;
  role: Role;
  cursor?: Point;
  lastSeen: number;
}

/** Unit of change applied to a board. */
export type Op =
  | { t: 'add'; el: BoardElement }
  | { t: 'update'; id: ElementId; patch: Partial<BoardElement>; updatedAt: number }
  | { t: 'delete'; id: ElementId }
  | { t: 'clear' };

// --- export / import file format ------------------------------------------

export const SNAPSHOT_FORMAT = 'live-whiteboard' as const;
export const SNAPSHOT_VERSION = 1 as const;

export interface BoardSnapshot {
  format: typeof SNAPSHOT_FORMAT;
  version: typeof SNAPSHOT_VERSION;
  meta: { name: string };
  /** Visible elements only, sorted by z. */
  elements: BoardElement[];
  exportedAt: number;
}

/** Validation limits, enforced on both client and server. */
export const LIMITS = {
  maxElements: 5000,
  maxStrokePoints: 2000,
  maxTextLength: 2000,
  minStrokeWidth: 1,
  maxStrokeWidth: 64,
  minFontSize: 10,
  maxFontSize: 96,
  maxNicknameLength: 24,
  maxBoardNameLength: 80,
  colorPattern: /^#[0-9a-fA-F]{6}$/,
} as const;

/** Presence colors the server hands out in join order. */
export const PRESENCE_COLORS = [
  '#E5484D',
  '#F76808',
  '#30A46C',
  '#208AEF',
  '#8E4EC6',
  '#0EA5E9',
] as const;

// --- permission rules ------------------------------------------------------
// The server is the authority; these mirror `server/src/model/rules.ts` so the
// UI can enable/disable tools without a round trip. Both arguments are nullable
// because the store asks before a board has finished loading.

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
