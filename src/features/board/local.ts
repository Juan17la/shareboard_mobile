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
import { writeAsStringAsync } from 'expo-file-system/legacy';

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

// The board as last read or written. Only this module writes the file, so after
// the first read it never has to be parsed again: an edit's save is one write,
// not a read, a parse and a write of the whole board.
let current: LocalBoard | undefined;

const PERF_LOG = process.env.EXPO_PUBLIC_PERF_HUD === '1';

export async function loadLocal(): Promise<LocalBoard | undefined> {
  if (current) return current;
  const file = boardFile();
  if (!file.exists) return undefined;
  try {
    const t0 = PERF_LOG ? performance.now() : 0;
    current = JSON.parse(await file.text()) as LocalBoard;
    if (PERF_LOG) console.log(`local load: ${current.elements.length} elements, ${Math.round(performance.now() - t0)} ms`);
    return current;
  } catch {
    // A write cut short by the app being killed: start again rather than never open.
    return undefined;
  }
}

// The write itself runs on a native thread, off the JS thread the gestures
// commit on; only the stringify is ours. One at a time, in order, so an older
// board never lands after a newer one.
let writing: Promise<void> = Promise.resolve();

function saveLocal(board: LocalBoard): void {
  current = board;
  const t0 = PERF_LOG ? performance.now() : 0;
  const json = JSON.stringify(board);
  const t1 = PERF_LOG ? performance.now() : 0;
  writing = writing
    .then(() => writeAsStringAsync(boardFile().uri, json))
    .then(
      () => {
        if (PERF_LOG) console.log(`local save: ${board.elements.length} elements, JS ${Math.round(t1 - t0)} ms, written after ${Math.round(performance.now() - t0)} ms`);
      },
      // ponytail: a failed write is dropped like before (sync `write` threw into a
      // fire-and-forget promise); the next edit writes the whole board again.
      () => {},
    );
}

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
