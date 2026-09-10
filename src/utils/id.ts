import * as Crypto from 'expo-crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Short, collision-resistant id for board elements and ops.
 * Not a UUID — elements are scoped to a single board, so 12 chars is plenty.
 */
export function shortId(size = 12): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(size));
  let out = '';
  for (let i = 0; i < size; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Stable per-install user id (UUID v4). Persisted by the session store. */
export function newUserId(): string {
  return Crypto.randomUUID();
}
