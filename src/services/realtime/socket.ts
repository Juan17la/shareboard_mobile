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
 * It does NOT know about the board store — `sync.ts` wires the two together.
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

export interface RealtimeConnection {
  connect(): void;
  close(): void;
  send(msg: ClientMessage): void;
  on<T extends ServerMessageType>(
    type: T,
    cb: (msg: Extract<ServerMessage, { type: T }>) => void,
  ): () => void;
  onStateChange(cb: (state: ConnectionState) => void): () => void;
  getState(): ConnectionState;
}

export interface SocketParams {
  boardId: string;
  token: string;
  /** Identity for the `join` frame, re-sent on every (re)connect. */
  userId: string;
  nickname: string;
  pin?: string;
}

export class WebSocketConnection implements RealtimeConnection {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'idle';
  private listeners = new Map<string, Set<Listener>>();
  private stateListeners = new Set<(s: ConnectionState) => void>();
  private outbox: ClientMessage[] = [];
  private backoff: number = REALTIME.backoffMinMs;
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

  private open() {
    this.setState('connecting');
    const url = `${WS_URL}?boardId=${encodeURIComponent(this.params.boardId)}&token=${encodeURIComponent(
      this.params.token,
    )}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = REALTIME.backoffMinMs;
      this.setState('online');
      this.startHeartbeat();
      // Every socket starts with a `join`; the server answers `joined` with the
      // full board state and rejects anything sent before it. A reconnect is a
      // brand new socket, so it has to join again (docs/07-websockets).
      this.sendNow({
        type: 'join',
        boardId: this.params.boardId,
        userId: this.params.userId,
        nickname: this.params.nickname,
        ...(this.params.pin ? { pin: this.params.pin } : {}),
      });
      const queued = this.outbox;
      this.outbox = [];
      queued.forEach((m) => this.send(m));
    };

    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      this.listeners.get(msg.type)?.forEach((cb) => cb(msg));
    };

    ws.onerror = () => {
      // `onclose` will follow and drive the reconnect.
    };

    ws.onclose = (event) => {
      this.stopHeartbeat();
      this.ws = null;
      if (this.closedByUs) {
        this.setState('idle');
        return;
      }
      this.setState('offline');
      // Reconnecting after a fatal code would just loop; with REPLACED it would
      // also fight the newer session for the (userId, boardId) slot.
      if (FATAL_CLOSE_CODES.includes(event?.code)) {
        this.closedByUs = true;
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
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
      this.send({ type: 'ping', t: Date.now() });
    }, REALTIME.heartbeatMs);
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  /** Write straight to the socket, bypassing the offline queue. */
  private sendNow(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.setState('idle');
  }
}
