/**
 * Board store (Zustand). Holds everything on screen for one board: elements,
 * the active tool + its config, the local camera, presence, connection status,
 * and the op outbox the realtime layer drains.
 *
 * Mutations that represent a real change go through `commitLocal(ops)`, which:
 *   1. records an inverse for local undo,
 *   2. applies the ops to `elements`,
 *   3. pushes the ops onto `outbox` for `sync.ts` to send.
 *
 * Remote ops arrive via `applyRemote(ops)` and skip the outbox + history.
 */
import { create } from 'zustand';

import { DrawingPalette } from '@/constants/theme';
import type { Op } from '@/services/realtime/protocol';
import { shortId } from '@/utils/id';

import {
  LIMITS,
  canEdit,
  type BoardElement,
  type BoardMeta,
  type ElementId,
  type Participant,
  type Point,
  type ShapeKind,
  type ShapeElement,
  type StrokeElement,
  type TextElement,
  type ToolType,
  type UserId,
} from './model';
import { applyOps, invertOps, visibleSorted, type ElementMap } from './ops';

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline';

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface ToolConfig {
  color: string;
  width: number;
  fill: string | null;
  shape: ShapeKind;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

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
  connection: ConnectionStatus;
  serverSeq: number;
  /**
   * Short-lived credential from `POST /boards/:id/join`. Owner-only REST calls
   * (rename, permissions) send it as `Authorization: Bearer`, so it has to
   * outlive the join call that produced it. Kept out of AsyncStorage on
   * purpose: it expires, and it is re-issued on every join.
   */
  boardToken: string | null;

  // content
  elements: ElementMap;
  zCounter: number;
  selection: ElementId[];

  // interaction
  tool: ToolType;
  config: ToolConfig;
  camera: Camera;

  // sync / history
  outbox: Op[];
  clientSeq: number;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // --- lifecycle ---
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

  // --- tools ---
  setTool(tool: ToolType): void;
  setConfig(patch: Partial<ToolConfig>): void;
  setCamera(camera: Camera): void;

  // --- editing (produce ops) ---
  addStroke(points: number[]): void;
  addShape(shape: ShapeKind, from: Point, to: Point): void;
  addText(at: Point): ElementId | null;
  updateText(id: ElementId, patch: Partial<Pick<TextElement, 'text' | 'fontSize' | 'bold' | 'italic' | 'color'>>): void;
  addImage(at: Point, width: number, height: number, uri: string): void;
  eraseAt(at: Point, radius?: number): void;
  deleteSelected(): void;
  clearBoard(): void;

  // --- history / sync ---
  undo(): void;
  redo(): void;
  applyRemote(ops: Op[], seq: number): void;
  drainOutbox(): { ops: Op[]; seq: number } | null;

  // --- selectors (non-reactive helpers) ---
  canEditNow(): boolean;
  visibleElements(): BoardElement[];
}

const DEFAULT_CONFIG: ToolConfig = {
  color: DrawingPalette[0],
  width: 4,
  fill: null,
  shape: 'rectangle',
  fontSize: 20,
  bold: false,
  italic: false,
};

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, scale: 1 };

const clampWidth = (w: number) =>
  Math.max(LIMITS.minStrokeWidth, Math.min(LIMITS.maxStrokeWidth, w));

export const useBoardStore = create<BoardState>((set, get) => {
  /** Apply a local change: record undo, mutate, enqueue for the network. */
  function commitLocal(ops: Op[]) {
    if (ops.length === 0) return;
    const { elements, undoStack, outbox, clientSeq } = get();
    const undo = invertOps(elements, ops);
    set({
      elements: applyOps(elements, ops),
      outbox: [...outbox, ...ops],
      clientSeq: clientSeq + 1,
      undoStack: [...undoStack.slice(-99), { undo, redo: ops }],
      redoStack: [],
    });
  }

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
    connection: 'idle',
    serverSeq: 0,
    boardToken: null,

    elements: {},
    zCounter: 0,
    selection: [],

    tool: 'pen',
    config: DEFAULT_CONFIG,
    camera: DEFAULT_CAMERA,

    outbox: [],
    clientSeq: 0,
    undoStack: [],
    redoStack: [],

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
        elements: map,
        zCounter: maxZ,
        serverSeq: seq,
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
        connection: 'idle',
        boardToken: null,
        elements: {},
        zCounter: 0,
        selection: [],
        outbox: [],
        clientSeq: 0,
        serverSeq: 0,
        undoStack: [],
        redoStack: [],
        camera: DEFAULT_CAMERA,
      });
    },

    setConnection(status) {
      set({ connection: status });
    },
    setParticipants(list) {
      set({ participants: list });
    },
    setMeta(meta, you) {
      set((s) => ({ meta, you: you ?? s.you }));
    },
    setBoardToken(token) {
      set({ boardToken: token });
    },
    setRemoteCursor(userId, at) {
      set((s) => ({
        participants: s.participants.map((p) => (p.userId === userId ? { ...p, cursor: at } : p)),
      }));
    },

    setTool(tool) {
      set({ tool, selection: tool === 'select' ? get().selection : [] });
    },
    setConfig(patch) {
      set((s) => ({ config: { ...s.config, ...patch } }));
    },
    setCamera(camera) {
      set({ camera });
    },

    addStroke(points) {
      if (!get().canEditNow() || points.length < 4) return;
      const { config } = get();
      const capped = points.slice(0, LIMITS.maxStrokePoints * 2);
      const el: StrokeElement = {
        ...baseFields(),
        kind: 'stroke',
        points: capped,
        color: config.color,
        width: clampWidth(config.width),
      };
      commitLocal([{ t: 'add', el }]);
    },

    addShape(shape, from, to) {
      if (!get().canEditNow()) return;
      const { config } = get();
      const el: ShapeElement = {
        ...baseFields(),
        kind: 'shape',
        shape,
        from,
        to,
        stroke: config.color,
        strokeWidth: clampWidth(config.width),
        fill: shape === 'line' || shape === 'arrow' ? null : config.fill,
      };
      commitLocal([{ t: 'add', el }]);
    },

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
      const cur = get().elements[id];
      if (!cur || cur.kind !== 'text' || !get().canEditNow()) return;
      const clean =
        patch.text !== undefined ? { ...patch, text: patch.text.slice(0, LIMITS.maxTextLength) } : patch;
      // Empty text -> delete the element.
      if (clean.text === '') {
        commitLocal([{ t: 'delete', id }]);
        return;
      }
      commitLocal([{ t: 'update', id, patch: clean as Partial<BoardElement>, updatedAt: Date.now() }]);
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

    deleteSelected() {
      const { selection } = get();
      if (!selection.length || !get().canEditNow()) return;
      commitLocal(selection.map((id) => ({ t: 'delete', id }) as Op));
      set({ selection: [] });
    },

    clearBoard() {
      if (!get().canEditNow()) return;
      commitLocal([{ t: 'clear' }]);
    },

    undo() {
      const { undoStack, redoStack, elements, outbox } = get();
      const entry = undoStack[undoStack.length - 1];
      if (!entry) return;
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
      if (!entry) return;
      set({
        elements: applyOps(elements, entry.redo),
        outbox: [...outbox, ...entry.redo],
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, entry],
      });
    },

    applyRemote(ops, seq) {
      set((s) => ({ elements: applyOps(s.elements, ops), serverSeq: Math.max(s.serverSeq, seq) }));
    },

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

// --- hit testing (eraser / select) ----------------------------------------

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function hitTest(elements: BoardElement[], at: Point, radius: number): ElementId[] {
  const r2 = radius * radius;
  const hits: ElementId[] = [];
  for (const el of elements) {
    if (el.kind === 'stroke') {
      for (let i = 0; i < el.points.length - 1; i += 2) {
        if (dist2(el.points[i], el.points[i + 1], at.x, at.y) <= r2 + el.width * el.width) {
          hits.push(el.id);
          break;
        }
      }
    } else if (el.kind === 'shape') {
      const minX = Math.min(el.from.x, el.to.x) - radius;
      const maxX = Math.max(el.from.x, el.to.x) + radius;
      const minY = Math.min(el.from.y, el.to.y) - radius;
      const maxY = Math.max(el.from.y, el.to.y) + radius;
      if (at.x >= minX && at.x <= maxX && at.y >= minY && at.y <= maxY) hits.push(el.id);
    } else if (el.kind === 'text' || el.kind === 'image') {
      const w = el.kind === 'image' ? el.width : Math.max(40, el.text.length * el.fontSize * 0.55);
      const h = el.kind === 'image' ? el.height : el.fontSize * 1.4;
      if (at.x >= el.at.x - radius && at.x <= el.at.x + w + radius && at.y >= el.at.y - radius && at.y <= el.at.y + h + radius) {
        hits.push(el.id);
      }
    }
  }
  return hits;
}
