/**
 * WebSocket client for realtime board sync.
 *
 * Responsibilities:
 *   - connect to `${WS_URL}?boardId=&token=`
 *   - JSON encode/decode `ClientMessage` / `ServerMessage`
 *   - heartbeat ping + stale detection
 *   - exponential-backoff reconnect with jitter
 *   - queue outbound messages while offline, flush on reconnect
 *
 * It does NOT know about the board store — `hooks/use-board-sync.ts` wires the two together.
 * Behavior spec: docs/07-websockets.
 */
import { REALTIME, WS_URL } from '@/constants/config';

import { CloseCode } from './protocol';
import type { ClientMessage, ServerMessage, ServerMessageType } from './protocol';

/**
 * Close codes the client must not reconnect after on its own: the board is
 * gone, the token was rejected, or another session replaced this one
 * (docs/07-websockets). `RATE_LIMITED` is deliberately absent — that one is
 * retried, just with the usual backoff.
 */
const FATAL_CLOSE_CODES: number[] = [
  CloseCode.BAD_REQUEST,
  CloseCode.REPLACED,
  CloseCode.FORBIDDEN,
  CloseCode.NOT_FOUND,
  CloseCode.PIN_REQUIRED,
];

export type ConnectionState = 'idle' | 'connecting' | 'online' | 'offline';

type Listener<T extends ServerMessage = ServerMessage> = (msg: T) => void;

export interface SocketParams {
  boardId: string;
  token: string;
  /** Identity for the `join` frame, re-sent on every (re)connect. */
  userId: string;
  nickname: string;
  pin?: string;
}

export class WebSocketConnection {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'idle';
  private listeners = new Map<string, Set<Listener>>();
  private stateListeners = new Set<(s: ConnectionState) => void>();
  private outbox: ClientMessage[] = [];
  private backoff: number = REALTIME.backoffMinMs;
  private attempt = 0;
  private lastMessageAt = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUs = false;

  constructor(private params: SocketParams) {}

  getState() {
    return this.state;
  }

  private setState(next: ConnectionState) {
    if (this.state === next) return;
    this.state = next;
    this.stateListeners.forEach((cb) => cb(next));
  }

  connect() {
    this.closedByUs = false;
    this.open();
  }

  /**
   * Detaches and closes whatever socket is current, and cancels a pending
   * reconnect. Every `open()` goes through here first: a retry tapped while
   * the backoff timer was pending used to open a second socket, the server
   * closed the older one with 4001, and *its* close handler then tore down the
   * state of the newer one — no heartbeat, so the idle check dropped that one
   * too, and the board bounced between offline and online indefinitely.
   */
  private dropSocket() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHeartbeat();
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = null;
    // Closing a socket that is still connecting reports an error; it is nobody's.
    ws.onerror = () => {};
    ws.close();
  }

  private open() {
    this.dropSocket();
    this.setState('connecting');
    const url = `${WS_URL}?boardId=${encodeURIComponent(this.params.boardId)}&token=${encodeURIComponent(
      this.params.token,
    )}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = REALTIME.backoffMinMs;
      this.attempt = 0;
      this.lastMessageAt = Date.now();
      this.startHeartbeat();
      // Every socket starts with a `join`; the server answers `joined` with the
      // full board state and rejects anything sent before it. A reconnect is a
      // brand new socket, so it has to join again (docs/07-websockets).
      ws.send(
        JSON.stringify({
          type: 'join',
          boardId: this.params.boardId,
          userId: this.params.userId,
          nickname: this.params.nickname,
          ...(this.params.pin ? { pin: this.params.pin } : {}),
        } satisfies ClientMessage),
      );
      const queued = this.outbox;
      this.outbox = [];
      queued.forEach((m) => this.send(m));
    };

    ws.onmessage = (event) => {
      this.lastMessageAt = Date.now();
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      // 'online' means "the server has us on the board", not "the socket
      // opened": an edit made before `joined` is wiped by the hydrate it
      // brings, and the store refuses edits unless online.
      if (msg.type === 'joined') this.setState('online');
      this.listeners.get(msg.type)?.forEach((cb) => cb(msg));
    };

    ws.onerror = () => {
      // `onclose` will follow and drive the reconnect.
    };

    ws.onclose = (event) => this.onClosed(event?.code);
  }

  private onClosed(code: number | undefined) {
    this.stopHeartbeat();
    this.ws = null;
    if (this.closedByUs) {
      this.setState('idle');
      return;
    }
    this.setState('offline');
    // Reconnecting after a fatal code would just loop; with REPLACED it would
    // also fight the newer session for the (userId, boardId) slot.
    if (code !== undefined && FATAL_CLOSE_CODES.includes(code)) {
      this.closedByUs = true;
      return;
    }
    // After the last automatic attempt the socket stays offline until the user
    // taps "retry" — a banner they can act on beats a silent loop.
    if (this.attempt >= REALTIME.maxReconnects) return;
    this.scheduleReconnect();
  }

  /** A user-driven reconnect: starts the backoff over. */
  retry() {
    this.attempt = 0;
    this.backoff = REALTIME.backoffMinMs;
    this.connect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.attempt += 1;
    const jitter = Math.random() * this.backoff * 0.3;
    const wait = Math.min(this.backoff, REALTIME.backoffMaxMs) + jitter;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * REALTIME.backoffFactor, REALTIME.backoffMaxMs);
      this.open();
    }, wait);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      // A phone that lost wifi keeps an "open" socket for minutes before the OS
      // notices. No pong for two beats means it is gone: drop it ourselves so
      // the reconnect (and the offline banner) start now.
      if (this.ws && Date.now() - this.lastMessageAt > REALTIME.heartbeatMs * 2) {
        this.dropSocket();
        this.onClosed(1006);
        return;
      }
      this.send({ type: 'ping', t: Date.now() });
    }, REALTIME.heartbeatMs);
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (msg.type === 'op' || msg.type === 'leave') {
      // Durable messages are queued; cursors/pings are dropped while offline.
      // `join` is never queued — `onopen` always sends a fresh one.
      this.outbox.push(msg);
    }
  }

  on<T extends ServerMessageType>(
    type: T,
    cb: (msg: Extract<ServerMessage, { type: T }>) => void,
  ) {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(cb as Listener);
    return () => set!.delete(cb as Listener);
  }

  onStateChange(cb: (s: ConnectionState) => void) {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  close() {
    this.closedByUs = true;
    this.dropSocket();
    this.setState('idle');
  }
}
