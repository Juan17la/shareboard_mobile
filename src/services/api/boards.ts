/**
 * Board REST API — one function per endpoint in docs/02-backend-connection.
 *
 * Auth model: no accounts. The device generates a persistent `userId` and
 * sends it as `X-User-Id`; `POST /boards/:id/join` returns a short-lived
 * `boardToken` that owner-only calls (rename, permissions, snapshot) send as
 * `Authorization: Bearer`.
 */
import type { BoardMeta, BoardSnapshot, UserId } from '@/features/board/model';

import { request } from './client';
import type {
  CreateBoardRequest,
  JoinBoardRequest,
  JoinBoardResponse,
  ResolveCodeResponse,
  UpdatePermissionsRequest,
} from './types';

type Auth = { userId: UserId; token: string };

const id = encodeURIComponent;

/** -> 201 BoardMeta */
export const createBoard = (body: CreateBoardRequest) =>
  request<BoardMeta>('POST', '/boards', { body, userId: body.creatorId });

/** -> 200 BoardMeta | 404 BOARD_NOT_FOUND */
export const getBoard = (boardId: string) => request<BoardMeta>('GET', `/boards/${id(boardId)}`);

/** -> 200 { boardId } | 404 */
export const resolveShortCode = async (code: string) =>
  (await request<ResolveCodeResponse>('GET', `/boards/code/${id(code)}`)).boardId;

/** Returns the WS token. errors: 404, 401 PIN_REQUIRED/PIN_INVALID, 409 NICKNAME_TAKEN */
export const joinBoard = (body: JoinBoardRequest) =>
  request<JoinBoardResponse>('POST', `/boards/${id(body.boardId)}/join`, {
    body,
    userId: body.userId,
  });

/** Creator only. */
export const renameBoard = (boardId: string, name: string, auth: Auth) =>
  request<BoardMeta>('PATCH', `/boards/${id(boardId)}`, { body: { name }, ...auth });

/** Creator only. Everyone else on the board is disconnected by the server. */
export const deleteBoard = (boardId: string, auth: Auth) =>
  request<void>('DELETE', `/boards/${id(boardId)}`, auth);

/** Creator only. */
export const updatePermissions = (boardId: string, patch: UpdatePermissionsRequest, auth: Auth) =>
  request<BoardMeta>('PATCH', `/boards/${id(boardId)}/permissions`, { body: patch, ...auth });

/** Import always creates a new board. -> 201 BoardMeta */
export const importSnapshot = (snapshot: BoardSnapshot, creatorId: UserId) =>
  request<BoardMeta>('POST', '/boards/import', { body: { snapshot, creatorId }, userId: creatorId });
