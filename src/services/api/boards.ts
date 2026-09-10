/**
 * Board REST API — one function per endpoint in `endpoints.ts`.
 *
 * Every function is a thin, typed wrapper. When `USE_MOCKS` is true it delegates
 * to the in-memory `mockApi`; otherwise it calls the real backend through
 * `request()`. Backend team: implement the routes in `ENDPOINTS` so the
 * `USE_MOCKS === false` path works unchanged.
 */
import { USE_MOCKS } from '@/constants/config';
import type { BoardMeta, BoardSnapshot, UserId } from '@/features/board/model';

import { request } from './client';
import { mockApi } from './mocks';
import type {
  CreateBoardRequest,
  JoinBoardRequest,
  JoinBoardResponse,
  ResolveCodeResponse,
  UpdatePermissionsRequest,
} from './types';

export async function createBoard(body: CreateBoardRequest): Promise<BoardMeta> {
  if (USE_MOCKS) return mockApi.createBoard(body);
  return request<BoardMeta>('CREATE_BOARD', { body, userId: body.creatorId });
}

export async function getBoard(id: string): Promise<BoardMeta> {
  if (USE_MOCKS) return mockApi.getBoard(id);
  return request<BoardMeta>('GET_BOARD', { params: { id } });
}

export async function resolveShortCode(code: string): Promise<string> {
  if (USE_MOCKS) return (await mockApi.resolveCode(code)).boardId;
  const res = await request<ResolveCodeResponse>('RESOLVE_CODE', { params: { code } });
  return res.boardId;
}

export async function joinBoard(body: JoinBoardRequest): Promise<JoinBoardResponse> {
  if (USE_MOCKS) return mockApi.join(body);
  return request<JoinBoardResponse>('JOIN', {
    params: { id: body.boardId },
    body,
    userId: body.userId,
  });
}

export async function renameBoard(
  id: string,
  name: string,
  auth: { userId: UserId; token: string },
): Promise<BoardMeta> {
  if (USE_MOCKS) return mockApi.rename(id, name);
  return request<BoardMeta>('RENAME', { params: { id }, body: { name }, ...auth });
}

export async function updatePermissions(
  id: string,
  patch: UpdatePermissionsRequest,
  auth: { userId: UserId; token: string },
): Promise<BoardMeta> {
  if (USE_MOCKS) return mockApi.updatePermissions(id, patch);
  return request<BoardMeta>('PERMISSIONS', { params: { id }, body: patch, ...auth });
}

/**
 * Server-side snapshot. Members only, so it needs the board token from `join`
 * (the store keeps it as `boardToken`). No mock — with `USE_MOCKS` the client
 * builds snapshots locally from the live store (see features/board/export.ts).
 */
export async function getSnapshot(
  id: string,
  auth: { userId: UserId; token: string },
): Promise<BoardSnapshot> {
  return request<BoardSnapshot>('SNAPSHOT', { params: { id }, ...auth });
}

export async function importSnapshot(
  snapshot: BoardSnapshot,
  creatorId: UserId,
): Promise<BoardMeta> {
  if (USE_MOCKS) {
    return mockApi.createBoard({
      name: snapshot.meta.name || 'Imported board',
      access: 'public',
      editPolicy: 'everyone',
      creatorId,
    });
  }
  return request<BoardMeta>('IMPORT', { body: { snapshot, creatorId }, userId: creatorId });
}

/**
 * Delete a board outright (creator only).
 *
 * The endpoint does not exist on the server yet — see the `DELETE_BOARD` note
 * in `endpoints.ts`. Callers should treat a rejection as "the board is gone
 * from this device" rather than as a hard failure, which is what the settings
 * sheet does: it leaves the board and drops it from the recent list either way.
 */
export async function deleteBoard(
  id: string,
  auth: { userId: UserId; token: string },
): Promise<void> {
  if (USE_MOCKS) return mockApi.deleteBoard(id);
  await request<void>('DELETE_BOARD', { params: { id }, ...auth });
}
