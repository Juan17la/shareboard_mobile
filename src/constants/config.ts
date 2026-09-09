/**
 * Runtime configuration.
 *
 * Resolution order for each value:
 *   1. `EXPO_PUBLIC_*` environment variables (per-developer / CI overrides)
 *   2. `app.json` -> `expo.extra.*`   (checked-in defaults)
 *   3. hard-coded localhost fallback
 *
 * See docs/02-backend-connection.
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  wsUrl?: string;
  useMocks?: boolean;
};

function bool(value: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

/**
 * Host of the Expo dev server, e.g. "192.168.1.20" — the LAN address of the
 * machine running `expo start`, which is also where the backend runs locally.
 */
const DEV_HOST: string = (Constants.expoConfig?.hostUri ?? '').split('/')[0].split(':')[0];

/**
 * On a phone or an Android emulator "localhost" is the device itself, so a
 * localhost default can never reach the dev machine. When no explicit URL was
 * configured, borrow the host Expo is already being served from. An explicit
 * `EXPO_PUBLIC_*` value or a non-localhost `extra` entry is left untouched.
 */
function withDevHost(url: string): string {
  if (!DEV_HOST || DEV_HOST === 'localhost') return url;
  return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${DEV_HOST}`);
}

/** REST base URL, no trailing slash. */
export const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')
  : withDevHost((extra.apiBaseUrl ?? 'http://localhost:3000').replace(/\/$/, ''));

/** WebSocket endpoint for realtime board sync. */
export const WS_URL: string =
  process.env.EXPO_PUBLIC_WS_URL ?? withDevHost(extra.wsUrl ?? 'ws://localhost:3000/ws');

/**
 * When true, the whole app runs against in-memory mocks and never touches the
 * network (`services/api/mocks.ts`, `services/realtime/mock-realtime.ts`).
 * Set it to true to work on the UI with no server running.
 */
export const USE_MOCKS: boolean = bool(
  process.env.EXPO_PUBLIC_USE_MOCKS ?? extra.useMocks,
  false,
);

/** Tunables shared by the realtime layer. Documented in docs/07-websockets. */
export const REALTIME = {
  /** Flush the local op outbox at most this often (ms). */
  outboxFlushMs: 50,
  /** Heartbeat ping interval (ms). */
  heartbeatMs: 20_000,
  /** Cursor broadcast throttle (ms). */
  cursorThrottleMs: 45,
  /** Reconnect backoff: min, max, multiplier. */
  backoffMinMs: 500,
  backoffMaxMs: 15_000,
  backoffFactor: 2,
} as const;
