/**
 * In-memory stand-in for the REST backend, used when `USE_MOCKS` is true.
 * Deliberately tiny: just enough state for the app to be fully exercised with
 * no server. The realtime side has its own mock (mock-realtime.ts) and shares
 * this board registry.
 */
import type { BoardElement, BoardMeta, Participant } from '@/features/board/model';
import { roleFor } from '@/features/board/model';
import { shortId } from '@/utils/id';
import { generateShortCode } from '@/utils/short-code';

import { ApiError } from './client';
import type {
  CreateBoardRequest,
  JoinBoardRequest,
  JoinBoardResponse,
  UpdatePermissionsRequest,
} from './types';

interface MockBoard {
  meta: BoardMeta;
  pin?: string;
  elements: Map<string, BoardElement>;
  participants: Map<string, Participant>;
  seq: number;
}

const PRESENCE_COLORS = ['#E5484D', '#F76808', '#30A46C', '#208AEF', '#8E4EC6', '#0EA5E9'];

/** Exported so mock-realtime.ts can share the same boards. */
export const mockBoards = new Map<string, MockBoard>();
const codeIndex = new Map<string, string>(); // shortCode -> boardId

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

function requireBoard(id: string): MockBoard {
  const board = mockBoards.get(id);
  if (!board) throw new ApiError('BOARD_NOT_FOUND', 'Board not found', 404);
  return board;
}

export const mockApi = {
  async createBoard(body: CreateBoardRequest): Promise<BoardMeta> {
    await delay();
    const id = shortId(16);
    let shortCode = generateShortCode();
    while (codeIndex.has(shortCode)) shortCode = generateShortCode();
    const now = Date.now();
    const meta: BoardMeta = {
      id,
      shortCode,
      name: body.name.trim() || 'Untitled board',
      access: body.access,
      editPolicy: body.editPolicy,
      editors: [],
      creatorId: body.creatorId,
      hasPin: body.access === 'private' && !!body.pin,
      createdAt: now,
      updatedAt: now,
    };
    mockBoards.set(id, {
      meta,
      pin: body.pin,
      elements: new Map(),
      participants: new Map(),
      seq: 0,
    });
    codeIndex.set(shortCode, id);
    return meta;
  },

  async getBoard(id: string): Promise<BoardMeta> {
    await delay(60);
    return { ...requireBoard(id).meta };
  },

  async resolveCode(code: string): Promise<{ boardId: string }> {
    await delay(60);
    const boardId = codeIndex.get(code);
    if (!boardId) throw new ApiError('BOARD_NOT_FOUND', 'No board for that code', 404);
    return { boardId };
  },

  async join(body: JoinBoardRequest): Promise<JoinBoardResponse> {
    await delay();
    const board = requireBoard(body.boardId);
    if (board.meta.hasPin && board.pin && body.pin !== board.pin) {
      throw new ApiError(
        body.pin ? 'PIN_INVALID' : 'PIN_REQUIRED',
        body.pin ? 'Incorrect PIN' : 'This board requires a PIN',
        401,
      );
    }
    const nicknameTaken = [...board.participants.values()].some(
      (p) => p.nickname.toLowerCase() === body.nickname.toLowerCase() && p.userId !== body.userId,
    );
    if (nicknameTaken) throw new ApiError('NICKNAME_TAKEN', 'That nickname is in use here', 409);

    const taken = new Set(
      [...board.participants.values()].filter((p) => p.userId !== body.userId).map((p) => p.color),
    );
    const you: Participant = {
      userId: body.userId,
      nickname: body.nickname,
      color:
        body.color && !taken.has(body.color)
          ? body.color
          : PRESENCE_COLORS[board.participants.size % PRESENCE_COLORS.length],
      role: roleFor(board.meta, body.userId),
      lastSeen: Date.now(),
    };
    board.participants.set(body.userId, you);
    return { boardToken: `mock.${body.boardId}.${body.userId}`, meta: { ...board.meta }, you };
  },

  async deleteBoard(id: string): Promise<void> {
    await delay(80);
    const board = requireBoard(id);
    codeIndex.delete(board.meta.shortCode);
    mockBoards.delete(id);
  },

  async rename(id: string, name: string): Promise<BoardMeta> {
    await delay(60);
    const board = requireBoard(id);
    board.meta = { ...board.meta, name: name.trim() || board.meta.name, updatedAt: Date.now() };
    return { ...board.meta };
  },

  async updatePermissions(id: string, patch: UpdatePermissionsRequest): Promise<BoardMeta> {
    await delay(80);
    const board = requireBoard(id);
    if (patch.pin !== undefined) {
      board.pin = patch.pin ?? undefined;
    }
    board.meta = {
      ...board.meta,
      access: patch.access ?? board.meta.access,
      editPolicy: patch.editPolicy ?? board.meta.editPolicy,
      editors: patch.editors ?? board.meta.editors,
      hasPin: (patch.access ?? board.meta.access) === 'private' && !!board.pin,
      updatedAt: Date.now(),
    };
    // Recompute participant roles.
    for (const [uid, p] of board.participants) {
      board.participants.set(uid, { ...p, role: roleFor(board.meta, uid) });
    }
    return { ...board.meta };
  },
};
