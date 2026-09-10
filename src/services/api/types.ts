/**
 * REST request/response DTOs. Kept separate from the domain model so the wire
 * shape can evolve independently. See docs/02-backend-connection for the full
 * endpoint reference.
 */
import type {
  BoardAccess,
  BoardMeta,
  BoardSnapshot,
  EditPolicy,
  Participant,
  UserId,
} from '@/features/board/model';

export interface CreateBoardRequest {
  name: string;
  access: BoardAccess;
  editPolicy: EditPolicy;
  /** Required when access === 'private'. */
  pin?: string;
  creatorId: UserId;
}

export interface JoinBoardRequest {
  boardId: string;
  userId: UserId;
  nickname: string;
  pin?: string;
  /**
   * The presence colour picked on the nickname screen. Advisory: the server
   * honours it unless someone already on the board has that colour, so the
   * value that comes back in `you.color` is the one to trust.
   */
  color?: string;
}

export interface JoinBoardResponse {
  /** Short-lived token the client must present on the WebSocket. */
  boardToken: string;
  meta: BoardMeta;
  you: Participant;
}

export interface UpdatePermissionsRequest {
  access?: BoardAccess;
  editPolicy?: EditPolicy;
  editors?: UserId[];
  /** Set/replace the PIN; null clears it. */
  pin?: string | null;
}

export interface ResolveCodeResponse {
  boardId: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export type { BoardMeta, BoardSnapshot };
