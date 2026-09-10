/**
 * ===========================================================================
 *  BACKEND CONTRACT — the REST surface the Node server must implement.
 * ===========================================================================
 *
 * Each entry is `METHOD /path` relative to `API_BASE_URL`. `:param` segments are
 * filled by `path()` below. This map is the single place the mobile app names
 * backend routes; the web app should reuse the same list.
 *
 * Auth model (docs/02-backend-connection):
 *   - No accounts. The client generates a persistent `userId` (UUID).
 *   - `POST /boards/:id/join` returns a short-lived `boardToken` used on the WS.
 *   - REST write endpoints for a board expect `X-User-Id: <userId>` and, for
 *     owner-only actions, `Authorization: Bearer <boardToken>`.
 */
export const ENDPOINTS = {
  /** Liveness probe. -> 200 { ok: true } */
  HEALTH: 'GET /health',

  /** Create a board. body: CreateBoardRequest -> 201 BoardMeta */
  CREATE_BOARD: 'POST /boards',

  /** Fetch board metadata by id. -> 200 BoardMeta | 404 BOARD_NOT_FOUND */
  GET_BOARD: 'GET /boards/:id',

  /** Resolve a short code to a board id. -> 200 { boardId } | 404 */
  RESOLVE_CODE: 'GET /boards/code/:code',

  /** Join a board (returns the WS token). body: JoinBoardRequest -> 200 JoinBoardResponse
   *  errors: 404 BOARD_NOT_FOUND, 401 PIN_REQUIRED/PIN_INVALID, 409 NICKNAME_TAKEN */
  JOIN: 'POST /boards/:id/join',

  /** Rename a board (creator only). body: { name } -> 200 BoardMeta */
  RENAME: 'PATCH /boards/:id',

  /** Change access / edit policy / editors / PIN (creator only).
   *  body: UpdatePermissionsRequest -> 200 BoardMeta */
  PERMISSIONS: 'PATCH /boards/:id/permissions',

  /** Full board snapshot as JSON (for server-side export / cold reads).
   *  -> 200 BoardSnapshot */
  SNAPSHOT: 'GET /boards/:id/snapshot',

  /** Create a new board from an imported snapshot.
   *  body: { snapshot: BoardSnapshot, creatorId } -> 201 BoardMeta */
  IMPORT: 'POST /boards/import',

  /**
   * Delete a board and free its short code (creator only). -> 204
   *
   * TODO(backend): **not implemented server-side yet.** The mobile flow is
   * complete — the settings sheet's "Delete the board" confirm calls
   * `deleteBoard()` in `services/api/boards.ts` — but `server/src/routes/
   * boards.ts` has no matching route, so the call currently 404s and the
   * client falls back to leaving the board and forgetting it locally. Adding
   * the route (evict from the in-memory store, drop the `shortCode` index
   * entry, close every socket on the board with `CloseCode.NOT_FOUND`, and
   * delete the Mongo document when persistence is on) is all that is needed;
   * nothing on this side has to change.
   */
  DELETE_BOARD: 'DELETE /boards/:id',
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;

/** Split "METHOD /path/:x" into its parts and substitute params. */
export function resolveEndpoint(
  key: EndpointKey,
  params: Record<string, string | number> = {},
): { method: string; path: string } {
  const [method, template] = ENDPOINTS[key].split(' ', 2);
  const path = template.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    if (params[name] == null) {
      throw new Error(`Missing path param ":${name}" for endpoint ${key}`);
    }
    return encodeURIComponent(String(params[name]));
  });
  return { method, path };
}
