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
  followLinks,
  headsOf,
  isLineLike,
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
  type Dash,
  type ElementId,
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
import { applyOps, invertOps, visibleSorted, type ElementMap } from './ops';

/** Zoom bounds. Matches the design's 25%–600% range. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6;
/** One tap of the zoom buttons. */
export const ZOOM_STEP = 1.2;

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline';

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export type FillLevel = 'none' | 'low' | 'medium' | 'full';

export interface ToolConfig {
  color: string;
  width: number;
  /** How opaque a newly drawn enclosed shape's fill is; `none` for outline only. */
  fill: FillLevel;
  shape: ShapeKind;
  /** Corners of a polygon. */
  sides: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  // Lines and arrows. The line/arrow buttons reset these to the kind's default.
  headStart: Marker;
  headEnd: Marker;
  route: Route;
  dash: Dash;
}

/**
 * A fill is the stroke colour at one of three alphas: a wash the dot grid still
 * reads through (~18%), a half, or solid.
 */
export const FILL_ALPHA: Record<Exclude<FillLevel, 'none'>, string> = {
  low: '2E',
  medium: '80',
  full: 'FF',
};

/** `#RRGGBB` -> the `#RRGGBBAA` a fill is painted with, or null for no fill. */
export function fillFor(color: string, level: FillLevel): string | null {
  return level === 'none' ? null : color.slice(0, 7) + FILL_ALPHA[level];
}

/** The level a painted fill was made with — what the toolbar highlights. */
export function fillLevelOf(fill: string | null | undefined): FillLevel {
  if (!fill) return 'none';
  const a = fill.slice(7).toUpperCase();
  return a === FILL_ALPHA.low ? 'low' : a === FILL_ALPHA.medium ? 'medium' : 'full';
}

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
      edit.mode === 'move' ? translate(el, edit.dx, edit.dy) : { ...edit.patch };
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
  /** Multiplies the zoom about `focal` (screen px), or about the viewport centre. */
  zoomBy(factor: number, focal?: Point): void;
  setLiveStroke(points: number[]): void;
  setLiveShape(shape: { from: Point; to: Point } | null): void;
  setLiveEdit(edit: LiveEdit | null): void;
  setLiveMarquee(box: { from: Point; to: Point } | null): void;
  setLiveSketch(sketch: Sketch | null): void;
  /** Turns the drag into ops: one per element touched, all in one undo step. */
  commitEdit(edit: LiveEdit): void;

  addStroke(points: number[]): void;
  /** Draws a recognised sketch as its figure, in the pen's ink (`sketchElement`). */
  addSketch(sketch: Sketch): void;
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
  eraseAt(at: Point, radius?: number): void;
  clearBoard(): void;
  /** Puts the selection on the clipboard. */
  copySelection(): void;
  /** Puts the selection on the clipboard and takes it off the board, in one undo step. */
  cutSelection(): void;
  /**
   * Adds a copy of the clipboard centred on `at` — fresh ids, on top of
   * everything — and selects it. Without `at`, a step off where it was copied from.
   */
  paste(at?: Point): void;
  /** Adds ready-made elements (an accepted AI drawing) as one undo step and selects them. */
  addElements(elements: BoardElement[]): void;

  undo(): void;
  redo(): void;
  /**
   * Ops from the server. `own` marks this client's echo: those were applied by
   * `commitLocal` already, so only the server-assigned paint order is taken.
   */
  applyRemote(ops: Op[], seq: number, own?: boolean): void;
  drainOutbox(): { ops: Op[]; seq: number } | null;

  canEditNow(): boolean;
  visibleElements(): BoardElement[];
}

const DEFAULT_CONFIG: ToolConfig = {
  color: DrawingPalette[0],
  width: StrokeSizes[1],
  // The second of each: a new figure comes out lightly filled, medium stroke.
  fill: 'low',
  shape: 'rectangle',
  sides: DEFAULT_SIDES,
  fontSize: 28,
  bold: false,
  italic: false,
  headStart: 'none',
  headEnd: 'arrow',
  route: 'straight',
  dash: 'solid',
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
  function commitLocal(ops: Op[]) {
    // Offline, an edit would only ever exist on this screen — and vanish on
    // the reconnect's hydrate. Refusing it is what makes the banner honest.
    if (ops.length === 0 || get().connection !== 'online') return;
    const { elements, undoStack, outbox, clientSeq } = get();
    // The inverse has to be computed against the state the ops are about to
    // change, so this runs before they are applied.
    const undo = invertOps(elements, ops);
    set({
      elements: applyOps(elements, ops),
      outbox: [...outbox, ...ops],
      clientSeq: clientSeq + 1,
      // 100 steps is deep enough to feel unlimited without holding a whole
      // session's elements alive in memory.
      undoStack: [...undoStack.slice(-99), { undo, redo: ops }],
      redoStack: [],
    });
  }

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
    liveStroke: [],
    liveShape: null,
    liveEdit: null,
    liveMarquee: null,
    liveSketch: null,

    outbox: [],
    clientSeq: 0,
    undoStack: [],
    redoStack: [],
    clipboard: [],

    /** Replaces local state wholesale with the server's `joined` payload. */
    hydrate({ meta, elements, participants, you, seq }) {
      const map: ElementMap = {};
      let maxZ = 0;
      for (const el of elements) {
        map[el.id] = el;
        if (el.z > maxZ) maxZ = el.z;
      }
      set({
        boardId: meta.id,
        meta,
        you,
        participants,
        cursors: cursorsOf(participants),
        elements: map,
        zCounter: maxZ,
        serverSeq: seq,
        // History and pending ops belong to the old session, not this one.
        undoStack: [],
        redoStack: [],
        outbox: [],
      });
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
        selectedIds: [],
        liveStroke: [],
        liveShape: null,
        liveEdit: null,
        liveMarquee: null,
        liveSketch: null,
      });
    },

    setConnection(status) {
      set({ connection: status });
    },

    setParticipants(list) {
      set({ participants: list, cursors: cursorsOf(list) });
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
          if (patch.color !== undefined) {
            p.stroke = patch.color;
            if (el.fill) p.fill = fillFor(patch.color, fillLevelOf(el.fill));
          }
          if (patch.width !== undefined) p.strokeWidth = clampWidth(patch.width);
          if (patch.fill !== undefined) {
            // The shape's own colour, not the config's: a red box gets a red wash.
            p.fill = isFillable(shape)
              ? fillFor(patch.color ?? el.stroke, patch.fill ?? fillLevelOf(el.fill))
              : null;
          }
          if (patch.fontSize !== undefined) p.fontSize = patch.fontSize;
          if (shape === 'polygon' && (patch.sides !== undefined || shape !== el.shape)) {
            p.sides = patch.sides ?? get().config.sides;
          }
          for (const k of ['headStart', 'headEnd', 'route', 'dash'] as const) {
            if (patch[k] !== undefined) p[k] = patch[k];
          }
          // A custom fold is only meaningful for the route it was dragged on
          // (board-unit offset for a curve, an axis fraction for an elbow):
          // switching route drops it back to that route's default look.
          if (patch.route !== undefined && patch.route !== el.route) p.bend = null;
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
      if (!get().canEditNow() || points.length < 4) return;
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
    },

    addSketch(sketch) {
      if (!get().canEditNow()) return;
      commitLocal([{ t: 'add', el: sketchElement(sketch, get().config, baseFields()) }]);
    },

    addShape(shape, ends) {
      if (!get().canEditNow()) return null;
      const { config } = get();
      const el: ShapeElement = {
        ...baseFields(),
        kind: 'shape',
        shape,
        from: ends.from,
        to: ends.to,
        stroke: config.color,
        strokeWidth: clampWidth(config.width),
        fill: isFillable(shape) ? fillFor(config.color, config.fill) : null,
        ...(shape === 'polygon' ? { sides: config.sides } : null),
        ...(shape === 'line' || shape === 'arrow'
          ? {
              headStart: config.headStart,
              headEnd: config.headEnd,
              route: config.route,
              dash: config.dash,
              fromLink: ends.fromLink ?? null,
              toLink: ends.toLink ?? null,
            }
          : null),
      };
      commitLocal([{ t: 'add', el }]);
      return el.id;
    },

    select(ids) {
      const wanted = ids === null ? [] : Array.isArray(ids) ? ids : [ids];
      const { elements } = get();
      const groups = new Set(wanted.map((id) => elements[id]?.group).filter(Boolean));
      const all = new Set(wanted);
      if (groups.size) {
        for (const el of get().visibleElements())
          if (el.group && groups.has(el.group)) all.add(el.id);
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
      const hits = hitTest(among, at, radius);
      return hits.length ? (among.find((el) => el.id === hits[hits.length - 1]) ?? null) : null;
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
      for (let i = visible.length - 1; i >= 0; i--) {
        const el = visible[i];
        if (el.kind !== 'shape' || !isFillable(el.shape)) continue;
        const minX = Math.min(el.from.x, el.to.x);
        const maxX = Math.max(el.from.x, el.to.x);
        const minY = Math.min(el.from.y, el.to.y);
        const maxY = Math.max(el.from.y, el.to.y);
        if (at.x < minX || at.x > maxX || at.y < minY || at.y > maxY) continue;
        const { color, fill: level } = get().config;
        const fill = fillFor(color, level === 'none' ? 'low' : level)!;
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
      };
      commitLocal([{ t: 'add', el }]);
      return el.id;
    },

    updateText(id, patch) {
      const current = get().elements[id];
      if (!current || current.kind !== 'text' || !get().canEditNow()) return;

      const clean =
        patch.text !== undefined
          ? { ...patch, text: patch.text.slice(0, LIMITS.maxTextLength) }
          : patch;

      // Clearing the text (or leaving only spaces) removes the element — an
      // empty label is just litter.
      if (clean.text !== undefined && !clean.text.trim()) {
        commitLocal([{ t: 'delete', id }]);
        return;
      }
      commitLocal([
        {
          t: 'update',
          id,
          patch: clean as Partial<BoardElement>,
          updatedAt: Date.now(),
        },
      ]);
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
      const hits = hitTest(get().visibleElements(), at, radius);
      if (hits.length) commitLocal(hits.map((id) => ({ t: 'delete', id }) as Op));
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
      if (!sel.length || !get().canEditNow() || get().connection !== 'online') return;
      get().copySelection();
      commitLocal(sel.map((el) => ({ t: 'delete', id: el.id }) as Op));
      set({ selectedIds: [] });
    },

    paste(at) {
      const { clipboard } = get();
      const b = contentBounds(clipboard);
      if (!b || !get().canEditNow() || get().connection !== 'online') return;
      const dx = at ? at.x - (b.x + b.width / 2) : 16;
      const dy = at ? at.y - (b.y + b.height / 2) : 16;
      // Copies are new elements: new ids, and a group of their own, so the
      // copy of a group selects apart from the original. A line keeps its
      // link only to a shape that was copied with it.
      const ids = new Map(clipboard.map((el) => [el.id, shortId()]));
      const groups = new Map<string, string>();
      const relink = (link: Link | null | undefined) =>
        link && ids.has(link.id) ? { ...link, id: ids.get(link.id)! } : null;
      const copies = clipboard.map((el) => {
        const copy = { ...el, ...translate(el, dx, dy), ...baseFields(), id: ids.get(el.id)! } as BoardElement;
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
      commitLocal(copies.map((el) => ({ t: 'add', el }) as Op));
      // What was pasted is in hand, ready to move: the cursor holds it, its options up.
      if (get().tool !== 'select') get().setTool('select');
      get().select(copies.map((el) => el.id));
      set({ railOpen: true });
    },

    addElements(elements) {
      if (!elements.length || !get().canEditNow() || get().connection !== 'online') return;
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
      const { undoStack, redoStack, elements, outbox } = get();
      const entry = undoStack[undoStack.length - 1];
      if (!entry || get().connection !== 'online') return;
      set({
        elements: applyOps(elements, entry.undo),
        outbox: [...outbox, ...entry.undo],
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, entry],
      });
    },

    redo() {
      const { undoStack, redoStack, elements, outbox } = get();
      const entry = redoStack[redoStack.length - 1];
      if (!entry || get().connection !== 'online') return;
      set({
        elements: applyOps(elements, entry.redo),
        outbox: [...outbox, ...entry.redo],
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, entry],
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
  // Hits come in paint order: the last one is what is drawn on top here.
  const top = hits[hits.length - 1];
  if (chosen.has(top)) return null;
  const figure = visible.find((el) => el.id === top) ?? null;
  const onSelection = hits.some((id) => chosen.has(id));
  return figure && (onSelection || figure.z > Math.max(...selected.map((el) => el.z)))
    ? figure
    : null;
}

/** Whether `(x, y)` is within `reach` of the line through a stroke's points. */
function nearStroke(points: number[], x: number, y: number, reach: number): boolean {
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
