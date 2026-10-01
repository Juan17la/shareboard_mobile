/**
 * Wires one board screen to the backend:
 *   REST getBoard + join  ->  WebSocket connect + join  ->  live ops
 *
 * Returns a `phase` the screen uses to gate UI (nickname prompt, PIN prompt,
 * loading, ready, error) plus `sendCursor` for the canvas. Full sequence in
 * docs/06-loading-exporting and docs/07-websockets.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { REALTIME } from '@/constants/config';
import { currentStrings } from '@/features/i18n/store';
import { splitOps } from '@/features/board/ops';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import { toast } from '@/components/ui/Toast';
import { ApiError } from '@/services/api/client';
import { getBoard, joinBoard } from '@/services/api/boards';
import { WebSocketConnection } from '@/services/realtime/socket';
import type { Point } from '@/features/board/model';
import { throttle } from '@/utils/throttle';

/** Errors that end the session even once the board is open. */
const FATAL_AFTER_JOIN = ['BOARD_NOT_FOUND', 'NICKNAME_TAKEN', 'PIN_REQUIRED', 'PIN_INVALID'];

export type SyncPhase = 'loading' | 'need-nickname' | 'need-pin' | 'ready' | 'error';

export interface BoardSync {
  phase: SyncPhase;
  error: string | null;
  /** Retry a private board with the entered PIN. */
  submitPin(pin: string): void;
  /** Save a nickname and (re)connect with it — also the retry after a clash. */
  submitNickname(nickname: string): void;
  /** Broadcast the local cursor (throttled). */
  sendCursor(at: Point): void;
  /** Reconnect now, after the socket gave up on its own. */
  retry(): void;
  /** The board is gone (deleted, or its server forgot it): the caller should let it go. */
  notFound: boolean;
}

export interface BoardSyncOptions {
  /**
   * Hold the connection back. The board screen sets this while the identity
   * step is on screen: joining with a nickname the user is in the middle of
   * changing would take the slot, then have to be replaced a second later
   * (close code 4001) for no reason.
   */
  paused?: boolean;
}

export function useBoardSync(boardId: string, options: BoardSyncOptions = {}): BoardSync {
  const paused = options.paused ?? false;
  const userId = useSessionStore((s) => s.userId);
  const nickname = useSessionStore((s) => s.nickname);
  const sessionHydrated = useSessionStore((s) => s.hydrated);
  const rememberBoard = useSessionStore((s) => s.rememberBoard);

  // `phase` for the async connect flow; the hydration and "no nickname yet"
  // gates are derived below. `need-nickname` appears here too, for the one case
  // the connect attempt itself sends us back to the identity step: a clash.
  const [connectPhase, setPhase] = useState<SyncPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const pinRef = useRef<string | undefined>(undefined);
  const connRef = useRef<WebSocketConnection | null>(null);
  const attemptRef = useRef(0);

  const phase: SyncPhase = !sessionHydrated
    ? 'loading'
    : paused || !nickname
      ? 'need-nickname'
      : connectPhase;

  const connect = useCallback(async () => {
    const attempt = ++attemptRef.current;
    try {
      // Yield before touching state. This runs from an effect, and a
      // synchronous setState there cascades an extra render on every mount.
      await Promise.resolve();
      if (attempt !== attemptRef.current) return;
      setPhase('loading');
      setError(null);
      setNotFound(false);

      const meta = await getBoard(boardId);
      const join = await joinBoard({
        boardId,
        userId,
        nickname,
        pin: pinRef.current,
        color: useSessionStore.getState().nickColor,
        avatar: useSessionStore.getState().avatar || undefined,
      });
      if (attempt !== attemptRef.current) return; // superseded

      const conn = new WebSocketConnection({
        boardId,
        userId,
        nickname,
        token: join.boardToken,
        pin: pinRef.current,
      });
      connRef.current = conn;
      const store = useBoardStore.getState();
      // Owner-only REST calls (rename, permissions) need this token later, so
      // it has to live somewhere the modal screens can reach.
      store.setBoardToken(join.boardToken);

      // Until `joined` an error means the board cannot be opened; after it, one
      // is about a single request (a refused batch, a rate limit) and the board
      // on screen stays.
      let ready = false;
      conn.on('joined', (msg) => {
        ready = true;
        store.hydrate({
          meta: msg.meta,
          elements: msg.elements,
          participants: msg.participants,
          you: msg.you,
          seq: msg.seq,
        });
        // A reconnect starts with no hold on the server: claim the selection again.
        const now = useBoardStore.getState();
        conn.send({ type: 'select', boardId, ids: now.canEditNow() ? now.selectedIds : [] });
        rememberBoard({
          id: msg.meta.id,
          shortCode: msg.meta.shortCode,
          name: msg.meta.name,
          role: msg.meta.creatorId === userId ? 'creator' : 'member',
        });
        setPhase('ready');
      });
      conn.on('op', (msg) =>
        useBoardStore.getState().applyRemote(msg.ops, msg.seq, msg.from === userId),
      );
      conn.on('participants', (msg) => useBoardStore.getState().setParticipants(msg.participants));
      // Every peer sends ~20 positions a second; applying each on arrival
      // re-rendered the cursor layer once per packet, per peer. They are
      // collected and applied once a frame — the latest per person, which is
      // all a frame could have shown anyway.
      let moves: Record<string, Point> | null = null;
      conn.on('cursor', (msg) => {
        if (!moves) {
          moves = {};
          requestAnimationFrame(() => {
            const batch = moves!;
            moves = null;
            useBoardStore.getState().moveCursors(batch);
          });
        }
        moves[msg.from] = msg.at;
      });
      conn.on('permissions', (msg) => useBoardStore.getState().setMeta(msg.meta, msg.you));
      conn.on('resync', (msg) => useBoardStore.getState().resync(msg.elements, msg.seq));
      conn.on('error', (msg) => {
        if (ready && !FATAL_AFTER_JOIN.includes(msg.code)) {
          toast(msg.message);
          return;
        }
        setError(msg.message);
        if (msg.code === 'BOARD_NOT_FOUND') setNotFound(true);
        if (msg.code === 'PIN_REQUIRED' || msg.code === 'PIN_INVALID') setPhase('need-pin');
        else setPhase('error');
      });
      conn.onStateChange((s) => useBoardStore.getState().setConnection(s));

      // Fall back to the REST metadata until `joined` arrives.
      store.setMeta(meta, join.you);
      // `connect()` sends the `join` frame itself, on this and every reconnect.
      conn.connect();
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      if (err instanceof ApiError && (err.code === 'PIN_REQUIRED' || err.code === 'PIN_INVALID')) {
        setError(err.code === 'PIN_INVALID' ? currentStrings().pinWrong : null);
        setPhase('need-pin');
        return;
      }
      if (err instanceof ApiError && err.code === 'NICKNAME_TAKEN') {
        setError(currentStrings().errNicknameTaken);
        setPhase('need-nickname');
        return;
      }
      if (err instanceof ApiError && err.code === 'BOARD_NOT_FOUND') setNotFound(true);
      setError(err instanceof Error ? err.message : 'Could not open the board');
      setPhase('error');
    }
  }, [boardId, userId, nickname, rememberBoard]);

  // Kick off once the session store is ready, identity is settled, and we have
  // a nickname.
  useEffect(() => {
    if (!sessionHydrated || !nickname || paused) return;
    // Opening the board is exactly the "subscribe to an external system" case
    // effects exist for. `connect` reaches its own setState calls only after an
    // await, so nothing here runs during the commit — but the rule cannot see
    // through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();
    return () => {
      // Bumping the attempt counter is the point of this cleanup: it is what
      // marks an in-flight connect as superseded, so reading the live value
      // here is deliberate rather than the stale-ref mistake the rule targets.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      attemptRef.current++;
      const conn = connRef.current;
      if (conn) {
        conn.send({ type: 'leave', boardId });
        conn.close();
      }
      connRef.current = null;
      useBoardStore.getState().reset();
    };
  }, [sessionHydrated, nickname, paused, boardId, connect]);

  // Drain the store outbox onto the wire.
  useEffect(() => {
    const flush = throttle(() => {
      const conn = connRef.current;
      // Not before the join has completed: the ops stay in the store, and the
      // hydrate that follows a join sends them (it hands the outbox over anew).
      if (!conn || conn.getState() !== 'online') return;
      const batch = useBoardStore.getState().drainOutbox();
      // One frame per chunk: a paste of a few photos would overflow the server's frame cap.
      if (batch) for (const ops of splitOps(batch.ops)) conn.send({ type: 'op', boardId, ops, seq: batch.seq });
    }, REALTIME.outboxFlushMs);

    const unsub = useBoardStore.subscribe((state, prev) => {
      if (state.outbox !== prev.outbox && state.outbox.length > 0) flush();
    });
    return () => {
      flush.cancel();
      unsub();
    };
  }, [boardId]);

  // Pause the socket while backgrounded; reconnect on resume.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const conn = connRef.current;
      if (!conn) return;
      if (next === 'active' && conn.getState() === 'offline') conn.retry();
    });
    return () => sub.remove();
  }, []);

  // What this user has selected is what they hold: sent as it changes,
  // throttled like the cursor. A viewer holds nothing.
  useEffect(() => {
    let last = '';
    const send = throttle(() => {
      const s = useBoardStore.getState();
      const ids = s.canEditNow() ? s.selectedIds : [];
      const key = ids.join(',');
      if (key === last) return;
      last = key;
      connRef.current?.send({ type: 'select', boardId, ids });
    }, REALTIME.cursorThrottleMs);
    const unsub = useBoardStore.subscribe((state, prev) => {
      if (state.selectedIds !== prev.selectedIds) send();
    });
    return () => {
      send.cancel();
      unsub();
    };
  }, [boardId]);

  // Throttled cursor broadcaster, rebuilt per board.
  const cursorSenderRef = useRef<((at: Point) => void) | null>(null);
  useEffect(() => {
    const send = throttle((at: Point) => {
      connRef.current?.send({ type: 'cursor', boardId, at });
    }, REALTIME.cursorThrottleMs);
    cursorSenderRef.current = send;
    return () => {
      send.cancel();
      cursorSenderRef.current = null;
    };
  }, [boardId]);
  const sendCursor = useCallback((at: Point) => cursorSenderRef.current?.(at), []);

  const submitPin = useCallback(
    (pin: string) => {
      pinRef.current = pin;
      connect();
    },
    [connect],
  );

  const submitNickname = useCallback(
    (next: string) => {
      setError(null);
      // Writing to the session store is enough to restart the connect effect
      // when the name actually changed; when it did not (the user re-confirmed
      // the same name after a clash) `connect` still has to be poked by hand.
      const changed = useSessionStore.getState().nickname !== next;
      useSessionStore.getState().setNickname(next);
      if (!changed) connect();
    },
    [connect],
  );

  const retry = useCallback(() => connRef.current?.retry(), []);

  return { phase, error, submitPin, submitNickname, sendCursor, retry, notFound };
}
