/**
 * WebSocket wire protocol — mirrors `server/src/model/protocol.ts`.
 *
 * Plain JSON frames over a standard WebSocket, one socket per (board, app).
 * Message shapes, error codes and close codes are documented in
 * docs/07-websockets; any change here must be mirrored in the server.
 */
import type { BoardElement, BoardMeta, ElementId, Op, Participant, Point, UserId } from '@/features/board/model';

export type { Op, Point };

export type ClientMessage =
  /** `tab`: which tab (page load) of this user it is, so two tabs keep a socket each. */
  | { type: 'join'; boardId: string; userId: UserId; nickname: string; pin?: string; tab?: string }
  /** `seq` is this client's own counter, echoed back for debugging. */
  | { type: 'op'; boardId: string; ops: Op[]; seq: number }
  /** `laser`: pointing with the laser; the others draw a fading trail behind the cursor. */
  | { type: 'cursor'; boardId: string; at: Point; laser?: boolean }
  /** An emoji that floats up on everyone's screen. Relayed, never stored. */
  | { type: 'react'; boardId: string; emoji: Reaction }
  /** Starts a countdown for everyone (`ms` long), or stops it (`null`). */
  | { type: 'timer'; boardId: string; ms: number | null }
  /** What this client now has selected: it holds those elements (`Participant.selection`). */
  | { type: 'select'; boardId: string; ids: string[] }
  /** What this client is drawing or dragging now; `null` when it is done. Relayed, never stored. */
  | { type: 'preview'; boardId: string; preview: Preview | null }
  | { type: 'leave'; boardId: string }
  | { type: 'ping'; t: number };

export type ServerMessage =
  | {
      type: 'joined';
      meta: BoardMeta;
      elements: BoardElement[];
      participants: Participant[];
      you: Participant;
      seq: number;
      /** A countdown running on this board: how long it still has to go. */
      timerLeft?: number;
    }
  /** `seq` is the board-wide monotonic counter; apply in order. */
  /**
   * `from` is `'server'` for a correction: the current state of elements whose
   * edit was refused because someone else holds them.
   */
  /** `tab`: the sending tab (absent from older servers). */
  | { type: 'op'; ops: Op[]; from: UserId; tab?: string; seq: number }
  | { type: 'participants'; participants: Participant[] }
  | { type: 'cursor'; from: UserId; at: Point; laser?: boolean }
  | { type: 'react'; from: UserId; emoji: Reaction }
  /** `left`: how long the countdown still runs, in ms, as of now; `null`: stopped. */
  | { type: 'timer'; from: UserId; left: number | null }
  | { type: 'preview'; from: UserId; preview: Preview | null }
  | { type: 'permissions'; meta: BoardMeta; you: Participant }
  /** The board as it stands, after a batch this client sent was refused. */
  | { type: 'resync'; elements: BoardElement[]; seq: number }
  | { type: 'error'; code: ServerErrorCode; message: string }
  | { type: 'pong'; t: number };

export type ServerMessageType = ServerMessage['type'];

/**
 * What someone is drawing or dragging right now, shown to the others and never
 * stored: `el` is a stroke or figure not on the board yet; `edit` is a drag of
 * elements that are (a `LiveEdit`, replayed here with `editPatches`).
 */
export interface Preview {
  el?: BoardElement;
  edit?: {
    ids: ElementId[];
    mode: 'move' | 'resize';
    handle: number;
    start: Point;
    dx: number;
    dy: number;
    patch: Partial<BoardElement> | null;
    patches?: Record<ElementId, Partial<BoardElement>>;
  };
}

/** The emoji a reaction may carry (the server drops any other). */
export const REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '👏'] as const;
export type Reaction = (typeof REACTIONS)[number];

export type ServerErrorCode =
  | 'BOARD_NOT_FOUND'
  | 'PIN_REQUIRED'
  | 'PIN_INVALID'
  | 'AUTH_REQUIRED'
  | 'LOGIN_INVALID'
  | 'USERNAME_TAKEN'
  | 'FORBIDDEN'
  | 'NICKNAME_TAKEN'
  | 'RATE_LIMITED'
  | 'VALIDATION'
  | 'INTERNAL';

/** Close codes the client must not reconnect after — except RATE_LIMITED. */
export const CloseCode = {
  BAD_REQUEST: 4000,
  /** Another session took this (userId, boardId) slot. */
  REPLACED: 4001,
  FORBIDDEN: 4003,
  NOT_FOUND: 4004,
  RATE_LIMITED: 4008,
  PIN_REQUIRED: 4009,
} as const;
