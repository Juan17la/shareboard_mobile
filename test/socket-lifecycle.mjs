/**
 * Check against a running server (`npm run dev` in ../server, then
 * `npm run check:socket`): a retry tapped while a reconnect is already pending
 * must not leave the connection broken.
 *
 * Before the teardown in `open()`, two `retry()` calls opened two sockets; the
 * server closed the older one with 4001 and that socket's close handler nulled
 * the newer one's state, so the connection sat "offline" with a live socket
 * nobody pinged — the constant disconnects seen on the phone.
 *
 * Runs the real `socket.ts` through tsx from ../server (this project has no
 * node test runner of its own).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

globalThis.WebSocket = createRequire(new URL('../../server/package.json', import.meta.url))('ws').WebSocket;

const { WebSocketConnection } = await import('../src/services/realtime/socket.ts');

const API = process.env.API_URL ?? 'http://localhost:3000';
const userId = `check-${Date.now()}`;

const json = async (path, body, headers = {}) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  assert.ok(res.ok, `${path} -> ${res.status}`);
  return res.json();
};

// One board per run; `POST /boards` allows 10 an hour, so pass BOARD_ID to reuse one.
const boardId =
  process.env.BOARD_ID ??
  (await json('/boards', { name: 'socket check', access: 'public', editPolicy: 'everyone', creatorId: userId })).id;
const { boardToken } = await json(`/boards/${boardId}/join`, { userId, nickname: 'socket check' }, { 'X-User-Id': userId });

const conn = new WebSocketConnection({ boardId, token: boardToken, userId, nickname: 'socket check' });
const states = [];
conn.onStateChange((s) => states.push(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (state) => {
  for (let i = 0; i < 50 && conn.getState() !== state; i++) await sleep(100);
  assert.equal(conn.getState(), state, `states: ${states.join(' > ')}`);
};

conn.connect();
await until('online');

// The race: two retries back to back, as the banner button and the app-resume
// handler produce when both fire during one backoff wait.
conn.retry();
conn.retry();
await until('online');

// A 4001 for the first socket would land within milliseconds and flip this.
await sleep(1500);
assert.equal(conn.getState(), 'online', `states: ${states.join(' > ')}`);

// And the socket that survived is the one being pinged: a pong must come back.
const pong = new Promise((r) => conn.on('pong', r));
conn.send({ type: 'ping', t: Date.now() });
await Promise.race([pong, sleep(2000).then(() => assert.fail('no pong: the live socket is not the tracked one'))]);

conn.close();
assert.equal(conn.getState(), 'idle');
console.log('ok: retry during a pending reconnect keeps one live socket');
