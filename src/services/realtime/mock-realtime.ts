/**
 * In-memory realtime backend used when `USE_MOCKS` is true.
 *
 * A process-global event bus keyed by boardId lets multiple mounts of the board
 * screen (or a reload) behave like separate clients: ops and cursors made in one
 * are broadcast to the others. Board state is shared with `mocks.ts`.
 */
import type { BoardElement } from '@/features/board/model';
import { mockBoards } from '@/services/api/mocks';

import type { ClientMessage, ServerMessage } from './protocol';
import type { ConnectionState, RealtimeConnection } from './socket';

type Sink = (msg: ServerMessage) => void;

const rooms = new Map<string, Set<MockRealtimeConnection>>();

function room(boardId: string): Set<MockRealtimeConnection> {
  let set = rooms.get(boardId);
  if (!set) {
    set = new Set();
    rooms.set(boardId, set);
  }
  return set;
}

export interface MockSocketParams {
  boardId: string;
  userId: string;
  nickname: string;
}

export class MockRealtimeConnection implements RealtimeConnection {
  private state: ConnectionState = 'idle';
  private listeners = new Map<string, Set<Sink>>();
  private stateListeners = new Set<(s: ConnectionState) => void>();

  constructor(private params: MockSocketParams) {}

  getState() {
    return this.state;
  }

  private setState(next: ConnectionState) {
    if (this.state === next) return;
    this.state = next;
    this.stateListeners.forEach((cb) => cb(next));
  }

  private emitLocal(msg: ServerMessage) {
    this.listeners.get(msg.type)?.forEach((cb) => cb(msg));
  }

  broadcast(msg: ServerMessage, includeSelf = false) {
    for (const conn of room(this.params.boardId)) {
      if (conn === this && !includeSelf) continue;
      conn.emitLocal(msg);
    }
  }

  connect() {
    room(this.params.boardId).add(this);
    // Simulate a tiny connect latency, then join like the real socket does.
    setTimeout(() => {
      this.setState('online');
      this.send({
        type: 'join',
        boardId: this.params.boardId,
        userId: this.params.userId,
        nickname: this.params.nickname,
      });
    }, 80);
  }

  close() {
    room(this.params.boardId).delete(this);
    const board = mockBoards.get(this.params.boardId);
    if (board) {
      board.participants.delete(this.params.userId);
      this.broadcast({ type: 'participants', participants: [...board.participants.values()] });
    }
    this.setState('idle');
  }

  send(msg: ClientMessage) {
    const board = mockBoards.get(this.params.boardId);
    if (!board) {
      this.emitLocal({ type: 'error', code: 'BOARD_NOT_FOUND', message: 'Board not found' });
      return;
    }

    switch (msg.type) {
      case 'join': {
        this.emitLocal({
          type: 'joined',
          meta: { ...board.meta },
          elements: [...board.elements.values()],
          participants: [...board.participants.values()],
          you: board.participants.get(msg.userId) ?? {
            userId: msg.userId,
            nickname: msg.nickname,
            color: '#208AEF',
            role: 'viewer',
            lastSeen: Date.now(),
          },
          seq: board.seq,
        });
        this.broadcast({ type: 'participants', participants: [...board.participants.values()] });
        break;
      }
      case 'op': {
        for (const op of msg.ops) {
          if (op.t === 'add') board.elements.set(op.el.id, op.el);
          else if (op.t === 'update') {
            const cur = board.elements.get(op.id);
            if (cur) {
              board.elements.set(op.id, { ...cur, ...(op.patch as Partial<BoardElement>) } as BoardElement);
            }
          } else if (op.t === 'delete') {
            const cur = board.elements.get(op.id);
            if (cur) board.elements.set(op.id, { ...cur, deleted: true });
          } else if (op.t === 'clear') {
            board.elements.clear();
          }
        }
        board.seq += 1;
        this.broadcast({ type: 'op', ops: msg.ops, from: this.params.userId, seq: board.seq });
        break;
      }
      case 'cursor': {
        const p = board.participants.get(this.params.userId);
        if (p) p.cursor = msg.at;
        this.broadcast({ type: 'cursor', from: this.params.userId, at: msg.at });
        break;
      }
      case 'leave':
        this.close();
        break;
      case 'ping':
        this.emitLocal({ type: 'pong', t: msg.t });
        break;
    }
  }

  on<T extends ServerMessage['type']>(
    type: T,
    cb: (msg: Extract<ServerMessage, { type: T }>) => void,
  ): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const sink = cb as Sink;
    set.add(sink);
    return () => {
      set!.delete(sink);
    };
  }

  onStateChange(cb: (s: ConnectionState) => void): () => void {
    this.stateListeners.add(cb);
    return () => {
      this.stateListeners.delete(cb);
    };
  }
}
