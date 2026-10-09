/**
 * Everything on screen for one board: elements, the active tool, the camera,
 * presence, connection status, and the outbox the realtime layer drains.
 *
 * The important rule is that **every real change goes through `commitLocal`**.
 * It does three things at once — records an inverse for undo, applies the ops
 * locally, and queues them for the network — which is what makes drawing feel
 * instant while still converging with everyone else: the stroke is on screen
 * before the server has heard about it, and `use-board-sync` flushes the outbox
 * a frame or two later.
 *
 * Ops arriving from the server go through `applyRemote` instead, which skips
 * both the outbox (they are already everyone's truth) and the undo history
 * (undo is local — you undo your own work, never a collaborator's).
 *
 * The camera is deliberately not part of the model: pan and zoom are per-device
 * and never synced (docs/05-model-date).
 */
import { create } from 'zustand';

import { DrawingPalette, StrokeSizes } from '@/constants/theme';
import type { Op } from '@/services/realtime/protocol';
import { shortId } from '@/utils/id';

import {
  boxOf,
  contentBounds,
  elementBounds,
  followLinks,
  headsOf,
  canRound,
  isLineLike,
  pickHit,
  setBoxLookup,
  shapeHit,
  toLocal,
  translate,
  type Sketch,
} from './geometry';
import {
  DEFAULT_SIDES,
  LIMITS,
  canEdit,
  isFillable,
  type BoardElement,
  type BoardMeta,
  type ElementBase,
  type Axis,
  type Dash,
  type HAlign,
  type VAlign,
  type ElementId,
  type FontKey,
  type Link,
  type Marker,
  type Participant,
  type Point,
  type Route,
  type ShapeKind,
  type ShapeElement,
  type StrokeElement,
  type TextElement,
  type ToolType,
  type UserId,
} from './model';
import { applyOps, invertOps, restoreDeleted, visibleSorted, type ElementMap } from './ops';

/** Zoom bounds. Matches the design's 25%–600% range. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6;
/** One tap of the zoom buttons. */
export const ZOOM_STEP = 1.2;

/** `local`: the offline board (`features/board/local.ts`) — no server, and every edit is kept. */
export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'local';

/** Whether an edit can be made now: one that could never reach the server is refused. */
export const writable = (connection: ConnectionStatus) => connection === 'online' || connection === 'local';

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface ToolConfig {
  color: string;
  width: number;
  /** How opaque a newly drawn enclosed shape's fill is, 0 to 100; 0 is outline only. */
  fillOpacity: number;
  /** The fill's colour; null is the line's own. */
  fillColor: string | null;
  shape: ShapeKind;
  /** Corners of a polygon. */
  sides: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** Typeface of new text and of labels. */
  font: FontKey;
  // Lines and arrows. The line/arrow buttons reset these to the kind's default.
  headStart: Marker;
  headEnd: Marker;
  route: Route;
  dash: Dash;
  /** Whole-figure opacity of new figures and of the selection, 10 to 100. */
  opacity: number;
  /** Corners of new rectangles, triangles and polygons (and of the selection). */
  rounded: boolean;
  /** Where the selected text, or the label of the selected figure, sits. */
  align: HAlign;
  valign: VAlign;
  /** An elbow's direction leaving its start and arriving at its end; null is automatic. */
  startAxis: Axis | null;
  endAxis: Axis | null;
}

/**
 * A fill is any `#RRGGBB` at any opacity, stored as `#RRGGBBAA` (the format
 * every fill was already in: the old Light/Medium/Solid levels are 18%, 50% and
 * 100%, so boards drawn with them read back as plain numbers).
 */
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** What someone typed -> `#RRGGBB`, or null when it is not a colour (`f80`, `#FF8800` and `ff8800` all work). */
export function parseHex(text: string): string | null {
  const m = HEX.exec(text.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return '#' + h.toUpperCase();
}

/** The `#RRGGBBAA` a fill is painted with, or null at 0% (no fill at all). */
export function fillWith(color: string, opacity: number): string | null {
  const pct = Math.min(100, Math.max(0, Math.round(opacity)));
  if (pct === 0) return null;
  return color.slice(0, 7).toUpperCase() + Math.round((pct * 255) / 100).toString(16).padStart(2, '0').toUpperCase();
}

/** The colour of a painted fill, or null when there is none. */
export const fillColorOf = (fill: string | null | undefined): string | null =>
  fill ? fill.slice(0, 7).toUpperCase() : null;

/** The opacity of a painted fill, 0 to 100: what the toolbar shows. */
export const fillOpacityOf = (fill: string | null | undefined): number =>
  !fill ? 0 : fill.length > 7 ? Math.round((parseInt(fill.slice(7, 9), 16) * 100) / 255) : 100;

/** What the bucket paints with when no opacity was chosen yet: the old "Light" wash. */
export const FILL_WASH = 18;

/**
 * The selection while a finger drags it. `move` shifts every selected element
 * by (dx, dy); `resize` drags one handle of a single element and keeps the
 * resulting `patch`. The elements only change (one op each) when the finger lifts.
 */
export interface LiveEdit {
  ids: ElementId[];
  mode: 'move' | 'resize';
  /** Corner index (endpoint index for a line) when resizing. */
  handle: number;
  start: Point;
  dx: number;
  dy: number;
  patch: Partial<BoardElement> | null;
  /** Several resized together (`resizeGroup`): each one's own patch, by id. */
  patches?: Record<ElementId, Partial<BoardElement>>;
}

/**
 * What the drag changes, as patches: the dragged elements, then every line
 * bound to a shape among them. Shared by the canvas (preview) and the commit,
 * so what was seen is exactly what is sent.
 */
export function editPatches(
  elements: BoardElement[],
  edit: LiveEdit,
): { id: ElementId; patch: Partial<BoardElement> }[] {
  const moved = new Set(edit.ids);
  const out: { id: ElementId; patch: Partial<BoardElement> }[] = [];
  const after = elements.map((el) => {
    if (!moved.has(el.id)) return el;
    const patch: Partial<BoardElement> =
      edit.mode === 'move' ? translate(el, edit.dx, edit.dy) : { ...(edit.patches?.[el.id] ?? edit.patch) };
    // A line carried away from what it was bound to lets go; carried together
    // with it (a group, a marquee) it keeps the link.
    if (edit.mode === 'move' && el.kind === 'shape' && isLineLike(el)) {
      const p = patch as Partial<ShapeElement>;
      if (el.fromLink && !moved.has(el.fromLink.id)) p.fromLink = null;
      if (el.toLink && !moved.has(el.toLink.id)) p.toLink = null;
    }
    out.push({ id: el.id, patch });
    return { ...el, ...patch } as BoardElement;
  });
  for (const { id, ...ends } of followLinks(after, edit.ids)) {
    const own = out.find((o) => o.id === id);
    if (own) Object.assign(own.patch, ends);
    else out.push({ id, patch: ends });
  }
  return out;
}

/**
 * A figure drawn with the shape tool, dressed in the tool's options. Shared by
 * the preview and the commit, so what shows under the pointer is what lands.
 */
export function shapeElement(
  shape: ShapeKind,
  ends: { from: Point; to: Point; fromLink?: Link | null; toLink?: Link | null },
  config: ToolConfig,
  base: ElementBase,
): ShapeElement {
  return {
    ...base,
    kind: 'shape',
    shape,
    from: ends.from,
    to: ends.to,
    stroke: config.color,
    strokeWidth: clampWidth(config.width),
    fill: isFillable(shape) ? fillWith(config.fillColor ?? config.color, config.fillOpacity) : null,
    ...(shape === 'polygon' ? { sides: config.sides } : null),
    dash: config.dash,
    ...(config.opacity < 100 ? { opacity: config.opacity / 100 } : null),
    ...(config.rounded && canRound(shape) ? { rounded: true } : null),
    ...(shape === 'line' || shape === 'arrow'
      ? {
          headStart: config.headStart,
          headEnd: config.headEnd,
          route: config.route,
          ...(config.startAxis ? { startAxis: config.startAxis } : null),
          ...(config.endAxis ? { endAxis: config.endAxis } : null),
          fromLink: ends.fromLink ?? null,
          toLink: ends.toLink ?? null,
        }
      : null),
  };
}

/**
 * The figure a recognised pen sketch becomes: the pen's colour and width, no
 * fill — it stands in for a line drawn by hand — and, for a line or an arrow,
 * the plain straight kind. Shared by the preview and the commit, so what shows
 * under the finger is what lands.
 */
export function sketchElement(sketch: Sketch, config: ToolConfig, base: ElementBase): ShapeElement {
  const line = sketch.shape === 'line' || sketch.shape === 'arrow';
  return {
    ...base,
    kind: 'shape',
    shape: sketch.shape,
    ...(sketch.shape === 'polygon' ? { sides: sketch.sides } : null),
    ...(sketch.vertices ? { vertices: sketch.vertices } : null),
    from: sketch.from,
    to: sketch.to,
    stroke: config.color,
    strokeWidth: clampWidth(config.width),
    fill: null,
    ...(line
      ? {
          headStart: 'none',
          headEnd: sketch.shape === 'arrow' ? 'arrow' : 'none',
          route: 'straight',
          dash: 'solid',
          fromLink: null,
          toLink: null,
        }
      : null),
  };
}

export type ReorderOp = 'back' | 'backward' | 'forward' | 'front';

interface HistoryEntry {
  undo: Op[];
  redo: Op[];
}

interface BoardState {
  // identity / meta
  boardId: string | null;
  meta: BoardMeta | null;
  you: Participant | null;
  participants: Participant[];
  /**
   * Where each participant's cursor is, apart from `participants` so a cursor
   * moving (dozens of times a second per person) does not hand everything
   * that lists who is here a new array. Seeded from the list's own `cursor`s.
   */
  cursors: Record<UserId, Point>;
  connection: ConnectionStatus;
  serverSeq: number;
  /**
   * Short-lived credential from `POST /boards/:id/join`. Owner-only REST calls
   * (rename, permissions, snapshot) send it as `Authorization: Bearer`, so it
   * has to outlive the join that produced it. Kept out of AsyncStorage on
   * purpose: it expires, and a new one is issued on every join.
   */
  boardToken: string | null;

  // content
  elements: ElementMap;
  zCounter: number;

  // interaction
  tool: ToolType;
  config: ToolConfig;
  camera: Camera;
  /**
   * Whether the tool rail's options column is open. Store state rather than
   * rail state because the canvas closes it the moment a gesture starts.
   */
  railOpen: boolean;
  /**
   * The selection (cursor and shape tools): tap to get handles, the options
   * strip then restyles it and `Aa` labels it. A group always selects whole.
   * Never synced — selection is a cursor, not content.
   */
  selectedIds: ElementId[];
  /** CSS-pixel size of the canvas, reported by the canvas itself. */
  viewport: { width: number; height: number };
  /** False until the first layout has put the board origin at screen centre. */
  cameraPlaced: boolean;
  /**
   * True from a fresh join until the camera has been fitted to what the board
   * holds; a reconnect's `hydrate` must not move the camera again.
   */
  fitPending: boolean;
  /**
   * The stroke / shape under the finger right now, before it becomes an
   * element. Store state rather than canvas state so the gesture that ends it
   * can read the final value synchronously and commit it in one step.
   */
  liveStroke: number[];
  liveShape: { from: Point; to: Point } | null;
  liveEdit: LiveEdit | null;
  /** The cursor tool's rubber band, in board coordinates. */
  liveMarquee: { from: Point; to: Point } | null;
  /**
   * The pen stroke under the finger, read as the figure it was meant to be
   * after a hold (`recognizeSketch`). Lifting draws that figure instead.
   */
  liveSketch: Sketch | null;
  /**
   * What the eraser has passed over in this stroke: hidden at once, deleted
   * together when the finger lifts (`commitErase`) — one undo step and one
   * message for a whole scrub rather than one per element.
   */
  liveErased: ElementId[];

  // sync / history
  outbox: Op[];
  clientSeq: number;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  /**
   * What copy or cut took, in paint order. Outlives the board: a copy made on
   * one board pastes on the next. Local, like the selection.
   */
  clipboard: BoardElement[];

  hydrate(args: {
    meta: BoardMeta;
    elements: BoardElement[];
    participants: Participant[];
    you: Participant;
    seq: number;
  }): void;
  reset(): void;
  setConnection(status: ConnectionStatus): void;
  setParticipants(list: Participant[]): void;
  setMeta(meta: BoardMeta, you?: Participant): void;
  setBoardToken(token: string | null): void;
  setRemoteCursor(userId: UserId, at: Point): void;
  /** Several cursors in one update — what arrived since the last frame. */
  moveCursors(moves: Record<UserId, Point>): void;

  setTool(tool: ToolType): void;
  /**
   * What a drawing tool does when its gesture is done: the cursor comes back
   * with the new elements selected, ready to be restyled. Not for the hand, the
   * eraser or the fill, which stay in hand.
   */
  finishCreate(ids: ElementId[]): void;
  /**
   * What a toolbar button does: drops the selection, picks the tool (and shape
   * kind), resets a line's heads to the kind's default and opens the options
   * strip. Picking the tool already in hand toggles the strip.
   */
  pickTool(tool: ToolType, shape?: ShapeKind): void;
  setConfig(patch: Partial<ToolConfig>): void;
  setCamera(camera: Camera): void;
  setRailOpen(open: boolean): void;
  setViewport(size: { width: number; height: number }): void;
  /** The "100%" camera: board (0,0) at the centre of the screen, unzoomed. */
  homeCamera(): Camera;
  /** Frame everything on the board (the empty board goes home). */
  fitCamera(): void;
  /** Multiplies the zoom about `focal` (screen px), or about the viewport centre. */
  zoomBy(factor: number, focal?: Point): void;
  setLiveStroke(points: number[]): void;
  setLiveShape(shape: { from: Point; to: Point } | null): void;
  setLiveEdit(edit: LiveEdit | null): void;
  setLiveMarquee(box: { from: Point; to: Point } | null): void;
  setLiveSketch(sketch: Sketch | null): void;
  /** Turns the drag into ops: one per element touched, all in one undo step. */
  commitEdit(edit: LiveEdit): void;

  addStroke(points: number[]): ElementId | null;
  /** Draws a recognised sketch as its figure, in the pen's ink (`sketchElement`). */
  addSketch(sketch: Sketch): ElementId | null;
  /**
   * Settles a figure made by `addSketch` after the pen kept moving (it was
   * resized meanwhile): the new corners join the step that made it, so the
   * figure is one undo.
   */
  finishFigure(id: ElementId, patch: { from: Point; to: Point }): void;
  /** Returns the new id so the caller can select it for resizing. */
  addShape(
    shape: ShapeKind,
    ends: {
      from: Point;
      to: Point;
      fromLink?: Link | null;
      toLink?: Link | null;
    },
  ): ElementId | null;
  /** Selects the ids and whatever shares a group with them. */
  select(ids: ElementId[] | ElementId | null): void;
  selectedElements(): BoardElement[];
  /** The selected shape, when exactly one shape is selected and still on the board. */
  selectedShape(): ShapeElement | null;
  /** The topmost element under `at`, `radius` board units around it — of `among`, or of everything visible. */
  elementAt(at: Point, radius: number, among?: BoardElement[]): BoardElement | null;
  /** Applies an options-strip change to every selected element, by kind. */
  restyle(patch: Partial<ToolConfig>): void;
  reorder(op: ReorderOp): void;
  group(): void;
  ungroup(): void;
  updateShape(
    id: ElementId,
    patch: Partial<
      Pick<
        ShapeElement,
        | 'from'
        | 'to'
        | 'text'
        | 'fontSize'
        | 'stroke'
        | 'strokeWidth'
        | 'fill'
        | 'shape'
        | 'headStart'
        | 'headEnd'
        | 'route'
        | 'bend'
        | 'dash'
        | 'fromLink'
        | 'toLink'
      >
    >,
  ): void;
  /** Paint bucket: tint the topmost enclosed shape under `at`. */
  fillAt(at: Point): boolean;
  addText(at: Point): ElementId | null;
  updateText(
    id: ElementId,
    patch: Partial<Pick<TextElement, 'text' | 'fontSize' | 'bold' | 'italic' | 'color'>>,
  ): void;
  addImage(at: Point, width: number, height: number, uri: string): void;
  /** The eraser over `at`: marks what is under it (`liveErased`), deleting nothing yet. */
  eraseAt(at: Point, radius?: number): void;
  /** The finger lifted: deletes everything the eraser passed over, as one undo step. */
  commitErase(): void;
  /** The scrub was cancelled (a second finger): nothing is deleted. */
  discardErase(): void;
  clearBoard(): void;
  /** Puts the selection on the clipboard. */
  copySelection(): void;
  /** Puts the selection on the clipboard and takes it off the board, in one undo step. */
  cutSelection(): void;
  /**
   * Adds a copy of the clipboard centred on `at` — fresh ids, on top of
   * everything — and selects it. Without `at`, a step off where it was copied from.
   * `elements` replaces the clipboard: a copy made in another app or on another device.
   */
  paste(at?: Point, elements?: BoardElement[]): void;
  /** Soft-deletes the selection, as one undo step. */
  deleteSelection(): void;
  /** Copies of the selection a little to the right and down. */
  duplicateSelection(): void;
  /** Adds ready-made elements (an accepted AI drawing) as one undo step and selects them. */
  addElements(elements: BoardElement[]): void;

  undo(): void;
  redo(): void;
  /**
   * Ops from the server. `own` marks this client's echo: those were applied by
   * `commitLocal` already, so only the server-assigned paint order is taken.
   */
  applyRemote(ops: Op[], seq: number, own?: boolean): void;
  /**
   * The board as the server has it, after it refused a batch this client had
   * already applied. Pending ops are laid over it; history is dropped, since
   * its steps may describe changes that never happened.
   */
  resync(elements: BoardElement[], seq: number): void;
  drainOutbox(): { ops: Op[]; seq: number } | null;

  canEditNow(): boolean;
  visibleElements(): BoardElement[];
}

const DEFAULT_CONFIG: ToolConfig = {
  color: DrawingPalette[0],
  width: StrokeSizes[1],
  // The second of each: a new figure comes out lightly filled, medium stroke.
  fillOpacity: FILL_WASH,
  fillColor: null,
  shape: 'rectangle',
  sides: DEFAULT_SIDES,
  fontSize: 28,
  bold: false,
  italic: false,
  underline: false,
  font: 'sans',
  headStart: 'none',
  headEnd: 'arrow',
  route: 'straight',
  dash: 'solid',
  opacity: 100,
  rounded: false,
  align: 'left',
  valign: 'middle',
  startAxis: null,
  endAxis: null,
};

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, scale: 1 };

const clampWidth = (w: number) =>
  Math.max(LIMITS.minStrokeWidth, Math.min(LIMITS.maxStrokeWidth, w));

/** The cursors a participant list carries, by user. */
function cursorsOf(participants: Participant[]): Record<UserId, Point> {
  const cursors: Record<UserId, Point> = {};
  for (const p of participants) if (p.cursor) cursors[p.userId] = p.cursor;
  return cursors;
}

export const useBoardStore = create<BoardState>((set, get) => {
  // An elbow goes around the shapes it is bound to: geometry asks where they are.
  setBoxLookup((id) => {
    const el = get().elements[id];
    if (!el || el.deleted) return undefined;
    const box = elementBounds(el);
    // A shape being carried is where the finger has it, not where it was.
    const live = get().liveEdit;
    return live?.mode === 'move' && live.ids.includes(id)
      ? { ...box, x: box.x + live.dx, y: box.y + live.dy }
      : box;
  });
  /**
   * `how` is what the change does to history: `push` is a step of its own;
   * `merge` folds into the last step (the typing that finishes a text just
   * added is part of adding it); `replace` takes the last step back off
   * (a text added and left empty never happened).
   */
  function commitLocal(ops: Op[], how: 'push' | 'merge' | 'replace' = 'push') {
    // Offline, an edit would only ever exist on this screen — and vanish on
    // the reconnect's hydrate. Refusing it is what makes the banner honest.
    if (ops.length === 0 || !writable(get().connection)) return;
    const { elements, undoStack, outbox, clientSeq } = get();
    const last = undoStack[undoStack.length - 1];
    let stack: HistoryEntry[];
    if (how === 'merge' && last) {
      // The inverse has to be computed against the state the ops are about to
      // change, so this runs before they are applied.
      const undo = invertOps(elements, ops);
      stack = [
        ...undoStack.slice(0, -1),
        { undo: [...undo, ...last.undo], redo: [...last.redo, ...ops] },
      ];
    } else if (how === 'replace' && last) {
      stack = undoStack.slice(0, -1);
    } else {
      // 100 steps is deep enough to feel unlimited without holding a whole
      // session's elements alive in memory.
      stack = [...undoStack.slice(-99), { undo: invertOps(elements, ops), redo: ops }];
    }
    set({
      elements: applyOps(elements, ops),
      outbox: [...outbox, ...ops],
      clientSeq: clientSeq + 1,
      undoStack: stack,
      redoStack: [],
    });
  }

  /** The text just added by `addText`, until its first commit: that commit is part of the same step. */
  let freshText: ElementId | null = null;
  /** The figure just made by `addSketch`, until the pen lets go: resizing it is part of the same step. */
  let freshFigure: ElementId | null = null;

  /**
   * Local paint order. The server overwrites `z` when it broadcasts, so this
   * only has to be right until the echo comes back.
   */
  function nextZ(): number {
    const z = get().zCounter + 1;
    set({ zCounter: z });
    return z;
  }

  function baseFields() {
    const now = Date.now();
    return {
      id: shortId(),
      createdBy: get().you?.userId ?? 'local',
      createdAt: now,
      updatedAt: now,
      z: nextZ(),
    };
  }

  /**
   * Copies of `els`, moved by (dx, dy): new ids, authored by us, on top, and a
   * group of their own so a copied group selects apart from the original. A
   * line keeps its link only to a shape that was copied with it — the rest of
   * the element (text, fill, bend, image bytes) is carried over untouched.
   */
  function cloneElements(els: BoardElement[], dx: number, dy: number): BoardElement[] {
    const ids = new Map(els.map((el) => [el.id, shortId()]));
    const groups = new Map<string, string>();
    const relink = (link: Link | null | undefined) =>
      link && ids.has(link.id) ? { ...link, id: ids.get(link.id)! } : null;
    return els.map((el) => {
      const copy = { ...el, ...translate(el, dx, dy), ...baseFields(), id: ids.get(el.id)! } as BoardElement;
      delete copy.deleted;
      if (el.group) {
        if (!groups.has(el.group)) groups.set(el.group, shortId());
        copy.group = groups.get(el.group);
      }
      if (copy.kind === 'shape' && el.kind === 'shape') {
        if (el.fromLink !== undefined) copy.fromLink = relink(el.fromLink);
        if (el.toLink !== undefined) copy.toLink = relink(el.toLink);
      }
      return copy;
    });
  }

  return {
    boardId: null,
    meta: null,
    you: null,
    participants: [],
    cursors: {},
    connection: 'idle',
    serverSeq: 0,
    boardToken: null,

    elements: {},
    zCounter: 0,

    // The cursor is the tool in hand when nothing has been asked for: it can
    // look around, pick things up and move the board, and does no harm.
    tool: 'select',
    config: DEFAULT_CONFIG,
    camera: DEFAULT_CAMERA,
    railOpen: false,
    selectedIds: [],
    viewport: { width: 0, height: 0 },
    cameraPlaced: false,
    fitPending: true,
    liveStroke: [],
    liveShape: null,
    liveEdit: null,
    liveMarquee: null,
    liveSketch: null,
    liveErased: [],

    outbox: [],
    clientSeq: 0,
    undoStack: [],
    redoStack: [],
    clipboard: [],

    /** Replaces local state wholesale with the server's `joined` payload. */
    hydrate({ meta, elements, participants, you, seq }) {
      let map: ElementMap = {};
      for (const el of elements) map[el.id] = el;
      // Ops still waiting to be sent when the socket dropped were made in this
      // session's name and never reached the server: lay them over the board
      // it sent (they go out now that the connection is up) instead of
      // throwing them away. Empty on a first join.
      const { outbox } = get();
      if (outbox.length) map = applyOps(map, outbox);
      let maxZ = 0;
      for (const id in map) if (map[id].z > maxZ) maxZ = map[id].z;
      set({
        boardId: meta.id,
        meta,
        you,
        participants,
        cursors: cursorsOf(participants),
        elements: map,
        zCounter: maxZ,
        serverSeq: seq,
        // History belongs to the old session, not this one.
        undoStack: [],
        redoStack: [],
        // A new array: the sync hook flushes on a changed outbox.
        outbox: outbox.length ? [...outbox] : outbox,
      });
      // Before the first layout there is no size to fit into: `setViewport` does it.
      if (get().fitPending && get().viewport.width > 0) {
        get().fitCamera();
        set({ fitPending: false });
      }
    },

    reset() {
      set({
        boardId: null,
        meta: null,
        you: null,
        participants: [],
        cursors: {},
        connection: 'idle',
        boardToken: null,
        elements: {},
        zCounter: 0,
        outbox: [],
        clientSeq: 0,
        serverSeq: 0,
        undoStack: [],
        redoStack: [],
        // The canvas may stay mounted across a reset (a nickname change
        // reconnects), so re-home on the size already known.
        camera: get().homeCamera(),
        cameraPlaced: get().viewport.width > 0,
        fitPending: true,
        selectedIds: [],
        liveStroke: [],
        liveShape: null,
        liveEdit: null,
        liveMarquee: null,
        liveSketch: null,
        liveErased: [],
      });
    },

    setConnection(status) {
      set({ connection: status });
    },

    setParticipants(list) {
      // Someone else got there first (both picked the same thing at once): the
      // server gave it to them, so let go of it here too.
      const held = heldByOthers(list, get().you);
      const selectedIds = get().selectedIds.filter((id) => !held.has(id));
      set({
        participants: list,
        cursors: cursorsOf(list),
        ...(selectedIds.length !== get().selectedIds.length ? { selectedIds } : null),
      });
    },

    setMeta(meta, you) {
      set((s) => ({ meta, you: you ?? s.you }));
    },

    setBoardToken(token) {
      set({ boardToken: token });
    },

    setRemoteCursor(userId, at) {
      get().moveCursors({ [userId]: at });
    },

    moveCursors(moves) {
      // Only people on the list have a cursor to show.
      const { participants, cursors } = get();
      let next: Record<UserId, Point> | null = null;
      for (const p of participants) {
        const at = moves[p.userId];
        if (at) (next ??= { ...cursors })[p.userId] = at;
      }
      if (next) set({ cursors: next });
    },

    finishCreate(ids) {
      if (!ids.length) return;
      set({ tool: 'select', selectedIds: ids, railOpen: true });
    },

    pickTool(tool, shape) {
      const s = get();
      if (s.tool === tool && (!shape || s.config.shape === shape)) {
        set({ railOpen: !s.railOpen });
        return;
      }
      // Picking a tool is about the next thing drawn: whatever was selected is
      // let go first, so a new kind never converts it.
      s.select(null);
      s.setTool(tool);
      if (shape) set((st) => ({ config: { ...st.config, shape } }));
      // A line starts bare and an arrow with a head: the kind's own default.
      if (shape === 'line') set((st) => ({ config: { ...st.config, headStart: 'none', headEnd: 'none' } }));
      if (shape === 'arrow') set((st) => ({ config: { ...st.config, headStart: 'none', headEnd: 'arrow' } }));
      // The hand has nothing to configure; an empty strip would just be noise.
      set({ railOpen: tool !== 'hand' });
    },

    setTool(tool) {
      // The selection belongs to the cursor and shape tools; any other drops it.
      const keeps = tool === 'select' || tool === 'shape';
      set((s) => ({ tool, selectedIds: keeps ? s.selectedIds : [] }));
    },

    setConfig(patch) {
      set((s) => ({ config: { ...s.config, ...patch } }));
      // With something selected the options strip edits *it*, not just the
      // next thing drawn.
      get().restyle(patch);
    },

    restyle(patch) {
      const selected = get().selectedElements();
      if (!selected.length || !get().canEditNow()) return;
      const ops: Op[] = [];
      for (const el of selected) {
        const p: Record<string, unknown> = {};
        if (el.kind === 'stroke') {
          if (patch.color !== undefined) p.color = patch.color;
          if (patch.width !== undefined) p.width = clampWidth(patch.width);
        } else if (el.kind === 'text') {
          if (patch.color !== undefined) p.color = patch.color;
          if (patch.fontSize !== undefined) p.fontSize = patch.fontSize;
          if (patch.bold !== undefined) p.bold = patch.bold;
          if (patch.italic !== undefined) p.italic = patch.italic;
          if (patch.underline !== undefined) p.underline = patch.underline;
          if (patch.font !== undefined) p.font = patch.font;
          if (patch.align !== undefined) p.align = patch.align;
        } else if (el.kind === 'shape') {
          // A kind change only comes from the strip's kind cluster (the tool
          // buttons let go of the selection first) and stays in the family:
          // box to box, line to arrow. An arrow gets a head if it had none.
          const shape = patch.shape !== undefined && isLineLike(el) === (patch.shape === 'line' || patch.shape === 'arrow') ? patch.shape : el.shape;
          if (shape !== el.shape) {
            p.shape = shape;
            if (shape === 'line') Object.assign(p, { headStart: 'none', headEnd: 'none' });
            if (shape === 'arrow' && headsOf(el).every((h) => h === 'none')) p.headEnd = 'arrow';
          }
          // The border only: the fill has a colour of its own, whatever the border is recoloured to.
          if (patch.color !== undefined) p.stroke = patch.color;
          if (patch.width !== undefined) p.strokeWidth = clampWidth(patch.width);
          if (patch.fillColor !== undefined || patch.fillOpacity !== undefined) {
            // The shape's own colour unless one was chosen: a red box gets a red wash.
            const color =
              patch.fillColor === undefined
                ? (fillColorOf(el.fill) ?? get().config.fillColor ?? patch.color ?? el.stroke)
                : (patch.fillColor ?? patch.color ?? el.stroke);
            const opacity = patch.fillOpacity ?? (el.fill ? fillOpacityOf(el.fill) : get().config.fillOpacity);
            p.fill = isFillable(shape) ? fillWith(color, opacity) : null;
          }
          if (patch.fontSize !== undefined) p.fontSize = patch.fontSize;
          if (patch.font !== undefined) p.font = patch.font;
          if (shape === 'polygon' && (patch.sides !== undefined || shape !== el.shape)) {
            p.sides = patch.sides ?? get().config.sides;
            // Choosing a corner count turns a hand-drawn polygon into the regular one.
            if (patch.sides !== undefined && el.vertices) p.vertices = null;
          }
          if (patch.align !== undefined) p.align = patch.align;
          if (patch.valign !== undefined) p.valign = patch.valign;
          if (patch.rounded !== undefined && canRound(shape)) p.rounded = patch.rounded || null;
          if (patch.opacity !== undefined) p.opacity = patch.opacity >= 100 ? null : patch.opacity / 100;
          for (const k of ['headStart', 'headEnd', 'route', 'dash', 'startAxis', 'endAxis'] as const) {
            if (patch[k] !== undefined) p[k] = patch[k];
          }
          // A custom fold is only meaningful for the route it was dragged on
          // (board-unit offset for a curve, an axis fraction for an elbow):
          // switching route drops it back to that route's default look.
          if (patch.route !== undefined && patch.route !== el.route) {
            p.bend = null;
            // The same goes for what shapes each route: a curve's handles, an elbow's axes.
            if (patch.startAxis === undefined) p.startAxis = null;
            if (patch.endAxis === undefined) p.endAxis = null;
            p.curveFrom = null;
            p.curveTo = null;
          }
        }
        if (Object.keys(p).length)
          ops.push({
            t: 'update',
            id: el.id,
            patch: p as Partial<BoardElement>,
            updatedAt: Date.now(),
          });
      }
      commitLocal(ops);
    },

    reorder(op) {
      const ids = new Set(get().selectedIds);
      const visible = get().visibleElements();
      const sel = visible.filter((el) => ids.has(el.id));
      if (!sel.length || !get().canEditNow()) return;
      const now = Date.now();
      const zOf = (el: BoardElement, z: number): Op => ({
        t: 'update',
        id: el.id,
        patch: { z },
        updatedAt: now,
      });
      const ops: Op[] = [];
      if (op === 'front') {
        const top = visible[visible.length - 1].z;
        sel.forEach((el, i) => ops.push(zOf(el, top + i + 1)));
      } else if (op === 'back') {
        const bottom = visible[0].z;
        sel.forEach((el, i) => ops.push(zOf(el, bottom - sel.length + i)));
      } else {
        // One step: trade places with the nearest outsider above (or below)
        // the selection. ponytail: outsiders interleaved within a multi-selection
        // are left where they are; a full re-pack if that ever reads wrong.
        const lo = sel[0].z;
        const hi = sel[sel.length - 1].z;
        const other =
          op === 'forward'
            ? visible.find((el) => el.z > hi && !ids.has(el.id))
            : [...visible].reverse().find((el) => el.z < lo && !ids.has(el.id));
        if (!other) return;
        const shift = op === 'forward' ? other.z - hi : other.z - lo;
        sel.forEach((el) => ops.push(zOf(el, el.z + shift)));
        ops.push(zOf(other, op === 'forward' ? lo : hi));
      }
      commitLocal(ops);
    },

    group() {
      const sel = get().selectedElements();
      if (sel.length < 2 || !get().canEditNow()) return;
      const group = shortId();
      const now = Date.now();
      commitLocal(
        sel.map((el) => ({
          t: 'update',
          id: el.id,
          patch: { group },
          updatedAt: now,
        })),
      );
    },

    ungroup() {
      const sel = get()
        .selectedElements()
        .filter((el) => el.group);
      if (!sel.length || !get().canEditNow()) return;
      const now = Date.now();
      commitLocal(
        sel.map((el) => ({
          t: 'update',
          id: el.id,
          patch: { group: null },
          updatedAt: now,
        })),
      );
    },

    setCamera(camera) {
      set({ camera });
    },

    setRailOpen(railOpen) {
      set({ railOpen });
    },

    setViewport(viewport) {
      set({ viewport });
      // The first real layout is when the camera can be placed: the same
      // board opens on the same spot — its origin, centred — on every device.
      if (!get().cameraPlaced && viewport.width > 0 && viewport.height > 0) {
        set({ camera: get().homeCamera(), cameraPlaced: true });
      }
      // The board arrived before the canvas had a size: fit it now.
      if (get().fitPending && get().boardId && viewport.width > 0 && viewport.height > 0) {
        get().fitCamera();
        set({ fitPending: false });
      }
    },

    fitCamera() {
      const b = contentBounds(get().visibleElements());
      const { width, height } = get().viewport;
      if (!b || !width || !height) {
        set({ camera: get().homeCamera() });
        return;
      }
      // Clear of the header on top and the tool bars below / beside, not just of the screen's edge.
      const padX = 72;
      const padY = 112;
      const scale = Math.max(
        MIN_ZOOM,
        Math.min((width - padX * 2) / b.width, (height - padY * 2) / b.height, 1),
      );
      set({
        camera: {
          scale,
          x: (width - b.width * scale) / 2 - b.x * scale,
          y: (height - b.height * scale) / 2 - b.y * scale,
        },
      });
    },

    homeCamera() {
      const { width, height } = get().viewport;
      return { x: width / 2, y: height / 2, scale: 1 };
    },

    zoomBy(factor, focal) {
      const { camera, viewport } = get();
      const at = focal ?? { x: viewport.width / 2, y: viewport.height / 2 };
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.scale * factor));
      // Hold the focal point still: convert it to board space at the old zoom,
      // then re-place it at the new one.
      const bx = (at.x - camera.x) / camera.scale;
      const by = (at.y - camera.y) / camera.scale;
      set({ camera: { scale: next, x: at.x - bx * next, y: at.y - by * next } });
    },

    setLiveStroke(points) {
      // Every gesture's end clears it; an empty one needs no new array.
      if (!points.length && !get().liveStroke.length) return;
      set({ liveStroke: points });
    },

    setLiveShape(shape) {
      set({ liveShape: shape });
    },

    setLiveEdit(liveEdit) {
      set({ liveEdit });
    },

    setLiveMarquee(liveMarquee) {
      set({ liveMarquee });
    },

    setLiveSketch(liveSketch) {
      set({ liveSketch });
    },

    commitEdit(edit) {
      if (!get().canEditNow()) return;
      const now = Date.now();
      commitLocal(
        editPatches(get().visibleElements(), edit).map((p) => ({
          t: 'update',
          ...p,
          updatedAt: now,
        })),
      );
    },

    // --- editing -----------------------------------------------------------
    // Each of these turns a gesture into ops. They all no-op without edit
    // rights, so a viewer's gestures die here rather than being drawn locally
    // and then rejected by the server a moment later.

    addStroke(points) {
      if (!get().canEditNow() || points.length < 4) return null;
      const { config } = get();
      const el: StrokeElement = {
        ...baseFields(),
        kind: 'stroke',
        // Two numbers per point, so the cap is doubled.
        points: points.slice(0, LIMITS.maxStrokePoints * 2),
        color: config.color,
        width: clampWidth(config.width),
      };
      commitLocal([{ t: 'add', el }]);
      return el.id;
    },

    addSketch(sketch) {
      if (!get().canEditNow()) return null;
      const el = sketchElement(sketch, get().config, baseFields());
      commitLocal([{ t: 'add', el }]);
      freshFigure = el.id;
      return el.id;
    },

    finishFigure(id, patch) {
      if (!get().canEditNow() || !get().elements[id]) return;
      const top = get().undoStack[get().undoStack.length - 1]?.redo;
      const fresh = freshFigure === id && top?.length === 1 && top[0].t === 'add' && top[0].el.id === id;
      freshFigure = null;
      commitLocal(
        [{ t: 'update', id, patch: patch as Partial<BoardElement>, updatedAt: Date.now() }],
        fresh ? 'merge' : 'push',
      );
    },

    addShape(shape, ends) {
      if (!get().canEditNow()) return null;
      const el = shapeElement(shape, ends, get().config, baseFields());
      commitLocal([{ t: 'add', el }]);
      return el.id;
    },

    select(ids) {
      // What someone else holds cannot be picked up (first come, first served).
      const held = heldByOthers(get().participants, get().you);
      const wanted = (ids === null ? [] : Array.isArray(ids) ? ids : [ids]).filter(
        (id) => !held.has(id),
      );
      const { elements } = get();
      const groups = new Set(wanted.map((id) => elements[id]?.group).filter(Boolean));
      const all = new Set(wanted);
      if (groups.size) {
        for (const el of get().visibleElements())
          if (el.group && groups.has(el.group) && !held.has(el.id)) all.add(el.id);
      }
      const next = [...all];
      // Tapping empty board (or the same thing again) keeps the selection it
      // already has; a fresh array would repaint the canvas and the toolbar.
      const { selectedIds } = get();
      if (next.length === selectedIds.length && next.every((id, i) => id === selectedIds[i])) return;
      set({ selectedIds: next });
    },

    selectedElements() {
      const { selectedIds, elements } = get();
      return selectedIds.map((id) => elements[id]).filter((el) => el && !el.deleted);
    },

    selectedShape() {
      const sel = get().selectedElements();
      return sel.length === 1 && sel[0].kind === 'shape' ? sel[0] : null;
    },

    elementAt(at, radius, among = get().visibleElements()) {
      const id = pickHit(among, hitTest(among, at, radius), at, radius);
      return id ? (among.find((el) => el.id === id) ?? null) : null;
    },

    updateShape(id, patch) {
      const current = get().elements[id];
      if (!current || current.kind !== 'shape' || !get().canEditNow()) return;
      const clean = { ...patch };
      if (clean.text !== undefined) clean.text = clean.text.slice(0, LIMITS.maxTextLength);
      // A fill only makes sense on a shape that encloses something.
      if (clean.shape && !isFillable(clean.shape)) clean.fill = null;
      commitLocal([
        {
          t: 'update',
          id,
          patch: clean as Partial<BoardElement>,
          updatedAt: Date.now(),
        },
      ]);
    },

    /**
     * The paint bucket. There are no regions to flood on a vector board, so
     * "fill" means: find the topmost enclosed shape under the finger and tint
     * it. Returns whether anything was hit, so the caller can decide between a
     * confirming haptic and a shrug.
     */
    fillAt(at) {
      if (!get().canEditNow()) return false;
      const visible = get().visibleElements();
      const held = heldByOthers(get().participants, get().you);
      for (let i = visible.length - 1; i >= 0; i--) {
        const el = visible[i];
        if (el.kind !== 'shape' || !isFillable(el.shape) || held.has(el.id)) continue;
        const minX = Math.min(el.from.x, el.to.x);
        const maxX = Math.max(el.from.x, el.to.x);
        const minY = Math.min(el.from.y, el.to.y);
        const maxY = Math.max(el.from.y, el.to.y);
        if (at.x < minX || at.x > maxX || at.y < minY || at.y > maxY) continue;
        const { color, fillColor, fillOpacity } = get().config;
        const fill = fillWith(fillColor ?? color, fillOpacity || FILL_WASH)!;
        if (el.fill === fill) return false;
        commitLocal([
          {
            t: 'update',
            id: el.id,
            patch: { fill } as Partial<BoardElement>,
            updatedAt: Date.now(),
          },
        ]);
        return true;
      }
      return false;
    },

    /** Returns the new id so the caller can open the text editor on it. */
    addText(at) {
      if (!get().canEditNow()) return null;
      const { config } = get();
      const el: TextElement = {
        ...baseFields(),
        kind: 'text',
        at,
        text: '',
        color: config.color,
        fontSize: config.fontSize,
        bold: config.bold,
        italic: config.italic,
        ...(config.underline ? { underline: true } : null),
        ...(config.font !== 'sans' ? { font: config.font } : null),
        ...(config.align !== 'left' ? { align: config.align } : null),
      };
      commitLocal([{ t: 'add', el }]);
      freshText = el.id;
      return el.id;
    },

    updateText(id, patch) {
      const current = get().elements[id];
      if (!current || current.kind !== 'text' || !get().canEditNow()) return;

      const clean =
        patch.text !== undefined
          ? { ...patch, text: patch.text.slice(0, LIMITS.maxTextLength) }
          : patch;

      // The first commit after `addText` finishes that step: typing a text is
      // one undo, not an empty element and then its words.
      const top = get().undoStack[get().undoStack.length - 1]?.redo;
      const fresh =
        freshText === id && top?.length === 1 && top[0].t === 'add' && top[0].el.id === id;
      freshText = null;

      // Clearing the text (or leaving only spaces) removes the element — an
      // empty label is just litter.
      if (clean.text !== undefined && !clean.text.trim()) {
        commitLocal([{ t: 'delete', id }], fresh ? 'replace' : 'push');
        return;
      }
      commitLocal(
        [
          {
            t: 'update',
            id,
            patch: clean as Partial<BoardElement>,
            updatedAt: Date.now(),
          },
        ],
        fresh ? 'merge' : 'push',
      );
    },

    addImage(at, width, height, uri) {
      if (!get().canEditNow()) return;
      commitLocal([
        {
          t: 'add',
          el: { ...baseFields(), kind: 'image', at, width, height, uri },
        },
      ]);
    },

    eraseAt(at, radius = 12) {
      if (!get().canEditNow()) return;
      const { liveErased } = get();
      const held = heldByOthers(get().participants, get().you);
      const hits = hitTest(get().visibleElements(), at, radius).filter(
        (id) => !held.has(id) && !liveErased.includes(id),
      );
      if (hits.length) set({ liveErased: [...liveErased, ...hits] });
    },

    commitErase() {
      const { liveErased } = get();
      if (!liveErased.length) return;
      set({ liveErased: [] });
      const held = heldByOthers(get().participants, get().you);
      const { elements } = get();
      const ids = liveErased.filter((id) => elements[id] && !elements[id].deleted && !held.has(id));
      commitLocal(ids.map((id) => ({ t: 'delete', id }) as Op));
    },

    discardErase() {
      if (get().liveErased.length) set({ liveErased: [] });
    },

    clearBoard() {
      if (!get().canEditNow()) return;
      commitLocal([{ t: 'clear' }]);
    },

    copySelection() {
      const chosen = new Set(get().selectedIds);
      const clipboard = get()
        .visibleElements()
        .filter((el) => chosen.has(el.id));
      if (clipboard.length) set({ clipboard });
    },

    cutSelection() {
      const sel = get().selectedElements();
      if (!sel.length || !get().canEditNow() || !writable(get().connection)) return;
      get().copySelection();
      commitLocal(sel.map((el) => ({ t: 'delete', id: el.id }) as Op));
      set({ selectedIds: [] });
    },

    deleteSelection() {
      const sel = get().selectedElements();
      if (!sel.length || !get().canEditNow()) return;
      commitLocal(sel.map((el) => ({ t: 'delete', id: el.id }) as Op));
      set({ selectedIds: [] });
    },

    duplicateSelection() {
      const sel = get().selectedElements();
      if (!sel.length || !get().canEditNow() || !writable(get().connection)) return;
      const copies = cloneElements(sel, 16, 16);
      commitLocal(copies.map((el) => ({ t: 'add', el }) as Op));
      get().select(copies.map((el) => el.id));
    },

    paste(at, elements = get().clipboard) {
      const b = contentBounds(elements);
      if (!b || !get().canEditNow() || !writable(get().connection)) return;
      const dx = at ? at.x - (b.x + b.width / 2) : 16;
      const dy = at ? at.y - (b.y + b.height / 2) : 16;
      const copies = cloneElements(elements, dx, dy);
      commitLocal(copies.map((el) => ({ t: 'add', el }) as Op));
      // What was pasted is in hand, ready to move: the cursor holds it, its options up.
      if (get().tool !== 'select') get().setTool('select');
      get().select(copies.map((el) => el.id));
      set({ railOpen: true });
    },

    addElements(elements) {
      if (!elements.length || !get().canEditNow() || !writable(get().connection)) return;
      // Ids are kept (lines are linked by them); authorship and order are ours.
      const added = elements.map((el) => ({ ...el, ...baseFields(), id: el.id }) as BoardElement);
      commitLocal(added.map((el) => ({ t: 'add', el }) as Op));
      if (get().tool !== 'select') get().setTool('select');
      get().select(added.map((el) => el.id));
    },

    // --- history -----------------------------------------------------------
    // Undo and redo replay stored ops through the outbox like any other edit,
    // so collaborators see them as ordinary changes.

    undo() {
      const { undoStack, redoStack, elements, outbox, liveEdit, selectedIds } = get();
      const entry = undoStack[undoStack.length - 1];
      // Not under a finger that is still dragging: the drag would land on top of it.
      if (!entry || !writable(get().connection) || liveEdit) return;
      const ops = restoreDeleted(elements, entry.undo);
      const next = applyOps(elements, ops);
      set({
        elements: next,
        outbox: [...outbox, ...ops],
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, entry],
        ...keepSelected(next, selectedIds),
      });
    },

    redo() {
      const { undoStack, redoStack, elements, outbox, liveEdit, selectedIds } = get();
      const entry = redoStack[redoStack.length - 1];
      if (!entry || !writable(get().connection) || liveEdit) return;
      const ops = restoreDeleted(elements, entry.redo);
      const next = applyOps(elements, ops);
      set({
        elements: next,
        outbox: [...outbox, ...ops],
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, entry],
        ...keepSelected(next, selectedIds),
      });
    },

    resync(elements, seq) {
      set((s) => {
        let map: ElementMap = {};
        for (const el of elements) map[el.id] = el;
        if (s.outbox.length) map = applyOps(map, s.outbox);
        let zCounter = 0;
        for (const id in map) if (map[id].z > zCounter) zCounter = map[id].z;
        return {
          elements: map,
          zCounter,
          serverSeq: Math.max(s.serverSeq, seq),
          undoStack: [],
          redoStack: [],
          liveErased: [],
          ...keepSelected(map, s.selectedIds),
        };
      });
    },

    applyRemote(ops, seq, own = false) {
      set((s) => {
        let elements = s.elements;
        if (own) {
          // The server owns `z` (model/ops.ts): without taking it back here a
          // local element keeps its provisional z and sits under everything
          // drawn later by others, however long ago it was actually drawn.
          // Usually it is the z already held, and then the map is left as it
          // is: a new one would repaint the whole board for nothing.
          let next: ElementMap | null = null;
          for (const op of ops) {
            if (op.t !== 'add') continue;
            const current = (next ?? elements)[op.el.id];
            if (current && current.z !== op.el.z) (next ??= { ...elements })[op.el.id] = { ...current, z: op.el.z };
          }
          if (next) elements = next;
        } else {
          elements = applyOps(elements, ops);
        }
        // New local elements must land above everything seen so far, remote
        // too — including something someone just brought to the front.
        let zCounter = s.zCounter;
        for (const op of ops) {
          const z = op.t === 'add' ? op.el.z : op.t === 'update' ? op.patch.z : undefined;
          if (z !== undefined && z > zCounter) zCounter = z;
        }
        return { elements, zCounter, serverSeq: Math.max(s.serverSeq, seq) };
      });
    },

    /** Hands the queued ops to the caller and clears them in one step. */
    drainOutbox() {
      const { outbox, clientSeq } = get();
      if (outbox.length === 0) return null;
      set({ outbox: [] });
      return { ops: outbox, seq: clientSeq };
    },

    canEditNow() {
      const { meta, you } = get();
      return canEdit(meta, you?.userId ?? null);
    },

    visibleElements() {
      return visibleSorted(get().elements);
    },
  };
});

/** `{ selectedIds }` without the ids that are no longer on the board, or nothing if all still are. */
function keepSelected(elements: ElementMap, selectedIds: ElementId[]) {
  const kept = selectedIds.filter((id) => elements[id] && !elements[id].deleted);
  return kept.length === selectedIds.length ? null : { selectedIds: kept };
}

/**
 * The elements other participants hold — have selected — and who holds each.
 * Theirs until they let go: this client neither selects nor changes them.
 */
export function heldByOthers(
  participants: Participant[],
  you: Participant | null,
): Map<ElementId, Participant> {
  const held = new Map<ElementId, Participant>();
  for (const p of participants) {
    if (p.userId === you?.userId) continue;
    for (const id of p.selection ?? []) held.set(id, p);
  }
  return held;
}

/**
 * The unselected figure a press at `at` lands on when it is drawn above the
 * selection there, or null when the press is the selection's.
 *
 * After "send to back" the selection sits hidden under other figures, and a
 * press on one of those must pick it rather than move (or resize) everything
 * selected behind it. Over a selected element anything painted on top of it
 * wins; off every selected element — on a handle — only a figure above the
 * whole selection does, so a handle over something lower still resizes.
 */
export function coveringFigure(
  visible: BoardElement[],
  selected: BoardElement[],
  at: Point,
  radius: number,
): BoardElement | null {
  const hits = hitTest(visible, at, radius);
  if (!hits.length) return null;
  const chosen = new Set(selected.map((el) => el.id));
  // What a press here picks: the topmost, seen through any hollow shape.
  const top = pickHit(visible, hits, at, radius)!;
  if (chosen.has(top)) return null;
  const figure = visible.find((el) => el.id === top) ?? null;
  const onSelection = hits.some((id) => chosen.has(id));
  return figure && (onSelection || figure.z > Math.max(...selected.map((el) => el.z)))
    ? figure
    : null;
}

/** A stroke's bounding box [minX, minY, maxX, maxY], by its (never mutated) points array. */
const strokeBoxes = new WeakMap<number[], number[]>();

/** Whether `(x, y)` is within `reach` of the line through a stroke's points. */
function nearStroke(points: number[], x: number, y: number, reach: number): boolean {
  // Most strokes are nowhere near the point: their box says so without a walk
  // over every segment (the eraser asks this of the whole board per sample).
  let box = strokeBoxes.get(points);
  if (!box) {
    box = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < points.length - 1; i += 2) {
      box[0] = Math.min(box[0], points[i]);
      box[1] = Math.min(box[1], points[i + 1]);
      box[2] = Math.max(box[2], points[i]);
      box[3] = Math.max(box[3], points[i + 1]);
    }
    strokeBoxes.set(points, box);
  }
  if (x < box[0] - reach || x > box[2] + reach || y < box[1] - reach || y > box[3] + reach) {
    return false;
  }
  const reach2 = reach * reach;
  for (let i = 0; i < points.length - 1; i += 2) {
    const ax = points[i];
    const ay = points[i + 1];
    // Each point to the next one; the last (or only) one on its own.
    const last = i + 3 >= points.length;
    const dx = last ? 0 : points[i + 2] - ax;
    const dy = last ? 0 : points[i + 3] - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    const ex = ax + t * dx - x;
    const ey = ay + t * dy - y;
    if (ex * ex + ey * ey <= reach2) return true;
  }
  return false;
}

/**
 * Which elements sit under a point — used by the eraser and by tap-to-select.
 * Strokes are tested along the line they draw, not only at its points: a quick
 * stroke's points are far apart, and a press between two of them landed on
 * whatever was underneath (the selection behind it, after "send to back").
 * Everything else is tested against its bounding box, which is generous but
 * matches what a fingertip expects.
 */
function hitTest(elements: BoardElement[], at: Point, radius: number): ElementId[] {
  const r2 = radius * radius;
  const hits: ElementId[] = [];

  for (const el of elements) {
    if (el.kind === 'stroke') {
      if (nearStroke(el.points, at.x, at.y, Math.sqrt(r2 + el.width * el.width))) hits.push(el.id);
    } else if (el.kind === 'shape') {
      if (shapeHit(el, at, radius)) hits.push(el.id);
    } else {
      // Tested in the element's unturned frame, against its measured box.
      const b = boxOf(el);
      const q = toLocal(el, at);
      if (
        q.x >= b.x - radius &&
        q.x <= b.x + b.width + radius &&
        q.y >= b.y - radius &&
        q.y <= b.y + b.height + radius
      ) {
        hits.push(el.id);
      }
    }
  }
  return hits;
}
