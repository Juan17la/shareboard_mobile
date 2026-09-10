import { USE_MOCKS } from '@/constants/config';

import { MockRealtimeConnection } from './mock-realtime';
import { WebSocketConnection, type RealtimeConnection } from './socket';

export type { RealtimeConnection, ConnectionState } from './socket';
export * from './protocol';

/**
 * Build the realtime connection for a board. Returns the mock or the real
 * WebSocket client depending on `USE_MOCKS`. Callers only see `RealtimeConnection`.
 */
export function createRealtimeConnection(args: {
  boardId: string;
  userId: string;
  nickname: string;
  token: string;
  pin?: string;
}): RealtimeConnection {
  if (USE_MOCKS) {
    return new MockRealtimeConnection({
      boardId: args.boardId,
      userId: args.userId,
      nickname: args.nickname,
    });
  }
  return new WebSocketConnection(args);
}
