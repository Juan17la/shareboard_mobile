/**
 * Board REST API — one function per endpoint in docs/02-backend-connection.
 *
 * Auth model: every request carries the user's id as `X-User-Id` — a guest id
 * this install made up, or the account's. Signed in, the session token goes
 * along as `Authorization: Bearer` (client.ts; it is what lets the server
 * believe an account id). `POST /boards/:id/join` returns a short-lived
 * `boardToken` that owner-only calls (rename, permissions, snapshot) send instead.
 */
import type { BoardElement, BoardMeta, BoardSnapshot, Point, UserId } from '@/features/board/model';

import { request } from './client';
import type {
  MyBoard,
  AccountProfile,
  SignedIn,
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

/**
 * Draws `prompt` centred on `at` (board coords). Nothing lands on the board:
 * the elements come back for a preview, and `addElements` puts them there.
 */
export const drawWithAi = (boardId: string, prompt: string, at: Point, auth: Auth) =>
  request<{ reply: string; elements: BoardElement[] }>('POST', `/boards/${id(boardId)}/ai`, {
    body: { prompt, at, preview: true },
    ...auth,
  });

/** The same for the offline board, which the server has never seen: always a preview. */
export const drawWithAiLocal = (prompt: string, at: Point, userId: UserId) =>
  request<{ reply: string; elements: BoardElement[] }>('POST', '/ai', { body: { prompt, at }, userId });

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

/** `deviceId`: the guest id used until now, whose boards the account takes over. -> 201 */
export const register = (body: {
  username: string;
  email: string;
  password: string;
  nickname: string;
  avatar?: string;
  deviceId: UserId;
}) => request<SignedIn>('POST', '/auth/register', { body });

/** `login`: the username or the email. errors: 401 LOGIN_INVALID, 429 */
export const login = (body: { login: string; password: string; deviceId: UserId }) =>
  request<SignedIn>('POST', '/auth/login', { body });

export const getMe = () => request<AccountProfile>('GET', '/me');

/** Adds or changes the account's email (with its password) and sends it a 6-digit code. errors: 401 LOGIN_INVALID, 409 EMAIL_TAKEN */
export const setEmail = (email: string, password: string) =>
  request<AccountProfile>('POST', '/me/email', { body: { email, password } });

/** errors: 429 (one a minute) */
export const resendEmailCode = () => request<void>('POST', '/me/email/resend');

/** errors: 400 CODE_INVALID */
export const verifyEmail = (code: string) =>
  request<AccountProfile>('POST', '/me/email/verify', { body: { code } });

/** A new token for this install comes back: every other session ends. */
export const changePassword = (password: string, newPassword: string) =>
  request<SignedIn>('POST', '/me/password', { body: { password, newPassword } });

/** Emails a reset code if the address has an account; 202 either way. */
export const forgotPassword = (email: string) =>
  request<void>('POST', '/auth/password/forgot', { body: { email } });

/** Signs in. errors: 400 CODE_INVALID */
export const resetPassword = (body: { email: string; code: string; password: string }) =>
  request<SignedIn>('POST', '/auth/password/reset', { body });

/** Every board the signed-in account made or has got into, newest first. */
export const getMyBoards = async () => (await request<{ boards: MyBoard[] }>('GET', '/me/boards')).boards;

/** Takes a board off the account's list (not the creator's own). */
export const forgetMyBoard = (boardId: string) => request<void>('DELETE', `/me/boards/${id(boardId)}`);
