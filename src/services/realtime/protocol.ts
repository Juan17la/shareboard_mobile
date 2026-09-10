/**
 * WebSocket wire protocol — mirrors `server/src/model/protocol.ts`.
 *
 * Plain JSON frames over a standard WebSocket, one socket per (board, app).
 * Message shapes, error codes and close codes are documented in
 * docs/07-websockets; any change here must be mirrored in the server.
 */
import type { BoardElement, BoardMeta, Op, Participant, Point, UserId } from '@/features/board/model';

export type { Op, Point };

export type ClientMessage =
  | { type: 'join'; boardId: string; userId: UserId; nickname: string; pin?: string }
  /** `seq` is this client's own counter, echoed back for debugging. */
  | { type: 'op'; boardId: string; ops: Op[]; seq: number }
  | { type: 'cursor'; boardId: string; at: Point }
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
    }
  /** `seq` is the board-wide monotonic counter; apply in order. */
  | { type: 'op'; ops: Op[]; from: UserId; seq: number }
  | { type: 'participants'; participants: Participant[] }
  | { type: 'cursor'; from: UserId; at: Point }
  | { type: 'permissions'; meta: BoardMeta; you: Participant }
  | { type: 'error'; code: ServerErrorCode; message: string }
  | { type: 'pong'; t: number };

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];

export type ServerErrorCode =
  | 'BOARD_NOT_FOUND'
  | 'PIN_REQUIRED'
  | 'PIN_INVALID'
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

export type CloseCodeValue = (typeof CloseCode)[keyof typeof CloseCode];

/** Server-side limits the client stays under. */
export const REALTIME_LIMITS = {
  idleTimeoutMs: 40_000,
  maxMessageBytes: 256 * 1024,
  maxOpsPerSecond: 60,
} as const;
