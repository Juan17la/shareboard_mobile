/**
 * The offline board (docs/plans/34): one board that lives only on this device.
 * The app opens on it, it works without a network, and it reaches the server
 * only when it is shared — as a new live board, the local one staying a
 * private copy. Twin of web `features/board-local.ts` (IndexedDB there).
 *
 * A JSON file in the app's documents: AsyncStorage's per-key limit on Android
 * is too small for a pasted photo or two.
 */
import { File, Paths } from 'expo-file-system';

import { API_BASE_URL } from '@/constants/config';
import type { BoardElement, BoardMeta, UserId } from '@/features/board/model';
import { newUserId } from '@/utils/id';

export interface LocalBoard {
  /** `loc_<uuid>`: the route is `/board/<id>` like any other board's. */
  id: string;
  name: string;
  elements: BoardElement[];
  /** The live board it was last shared as. */
  sharedAs?: string;
  updatedAt: number;
}

export const isLocalId = (id: string) => id.startsWith('loc_');

/** What the header and sheets read for it: this user's own board, with no code to share. */
export const localMeta = (board: LocalBoard, userId: UserId): BoardMeta => ({
  id: board.id,
  shortCode: '',
  name: board.name,
  access: 'public',
  editPolicy: 'everyone',
  editors: [],
  creatorId: userId,
  hasPin: false,
  createdAt: board.updatedAt,
  updatedAt: board.updatedAt,
});

const boardFile = () => new File(Paths.document, 'local-board.json');

export async function loadLocal(): Promise<LocalBoard | undefined> {
  const file = boardFile();
  if (!file.exists) return undefined;
  try {
    return JSON.parse(await file.text()) as LocalBoard;
  } catch {
    // A write cut short by the app being killed: start again rather than never open.
    return undefined;
  }
}

const saveLocal = (board: LocalBoard) => boardFile().write(JSON.stringify(board));

/** The local board, made (empty) the first time it is asked for. */
export async function ensureLocal(name: string): Promise<LocalBoard> {
  const board = await loadLocal();
  if (board) return board;
  const fresh: LocalBoard = { id: `loc_${newUserId()}`, name, elements: [], updatedAt: Date.now() };
  saveLocal(fresh);
  return fresh;
}

/** Changes the stored board, if it is still the one with this id. */
export async function updateLocal(id: string, patch: Partial<Omit<LocalBoard, 'id'>>): Promise<void> {
  const board = await loadLocal();
  if (board?.id === id) saveLocal({ ...board, ...patch, updatedAt: Date.now() });
}

// --- the five-hour rule ------------------------------------------------------

const FIVE_HOURS = 5 * 3_600_000;
const onlineFile = () => new File(Paths.document, 'last-online');
let lastSeen: number | null = null;

export function lastOnlineAt(): number {
  if (lastSeen === null) {
    try {
      const file = onlineFile();
      lastSeen = file.exists ? Number(file.textSync()) || 0 : 0;
    } catch {
      lastSeen = 0;
    }
  }
  return lastSeen;
}

/** The server answered just now. Written at most once a minute. */
export function markOnline(): void {
  const now = Date.now();
  if (now - lastOnlineAt() < 60_000) return;
  lastSeen = now;
  try {
    onlineFile().write(String(now));
  } catch {
    // Unwritable: the live boards only stay hidden a little longer.
  }
}

/** Live boards are offered while the server was reached in the last five hours. */
export const recentlyOnline = () => Date.now() - lastOnlineAt() <= FIVE_HOURS;

/** Whether the server answers now (`GET /health`, 4 s at most). */
export async function checkOnline(): Promise<boolean> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 4000);
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: abort.signal });
    if (res.ok) markOnline();
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
