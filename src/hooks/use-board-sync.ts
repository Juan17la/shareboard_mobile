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
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import { ApiError } from '@/services/api/client';
import { getBoard, joinBoard } from '@/services/api/boards';
import { createRealtimeConnection, type RealtimeConnection } from '@/services/realtime';
import type { Point } from '@/features/board/model';
import { throttle } from '@/utils/throttle';

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
  const pinRef = useRef<string | undefined>(undefined);
  const connRef = useRef<RealtimeConnection | null>(null);
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

      const meta = await getBoard(boardId);
      const join = await joinBoard({
        boardId,
        userId,
        nickname,
        pin: pinRef.current,
        color: useSessionStore.getState().nickColor,
      });
      if (attempt !== attemptRef.current) return; // superseded

      const conn = createRealtimeConnection({
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

      conn.on('joined', (msg) => {
        store.hydrate({
          meta: msg.meta,
          elements: msg.elements,
          participants: msg.participants,
          you: msg.you,
          seq: msg.seq,
        });
        rememberBoard({
          id: msg.meta.id,
          shortCode: msg.meta.shortCode,
          name: msg.meta.name,
          role: msg.meta.creatorId === userId ? 'creator' : 'member',
        });
        setPhase('ready');
      });
      conn.on('op', (msg) => {
        if (msg.from !== userId) useBoardStore.getState().applyRemote(msg.ops, msg.seq);
      });
      conn.on('participants', (msg) => useBoardStore.getState().setParticipants(msg.participants));
      conn.on('cursor', (msg) => useBoardStore.getState().setRemoteCursor(msg.from, msg.at));
      conn.on('permissions', (msg) => useBoardStore.getState().setMeta(msg.meta, msg.you));
      conn.on('error', (msg) => {
        setError(msg.message);
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
      if (!conn) return;
      const batch = useBoardStore.getState().drainOutbox();
      if (batch) conn.send({ type: 'op', boardId, ops: batch.ops, seq: batch.seq });
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
      if (next === 'active' && conn.getState() === 'offline') conn.connect();
    });
    return () => sub.remove();
  }, []);

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

  return { phase, error, submitPin, submitNickname, sendCursor };
}
