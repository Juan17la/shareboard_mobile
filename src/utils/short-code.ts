/**
 * Board short codes — the 6-character code users type to join a board.
 *
 * Crockford base32 without the ambiguous characters (no I L O U 0 1), so a code
 * read aloud or off a screen is unambiguous. The **backend owns generation and
 * uniqueness** (docs/02-backend-connection); the client only normalizes and
 * validates what the user types. `generateShortCode` exists for the offline
 * mock backend.
 */
import * as Crypto from 'expo-crypto';

export const SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SHORT_CODE_LENGTH = 6;

/** Mock-backend only. Real codes come from `POST /boards`. */
export function generateShortCode(): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(SHORT_CODE_LENGTH));
  let code = '';
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    code += SHORT_CODE_ALPHABET[bytes[i] % SHORT_CODE_ALPHABET.length];
  }
  return code;
}

/** Uppercases and strips the spaces or dashes a user may have typed. */
export function normalizeShortCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidShortCode(input: string): boolean {
  const code = normalizeShortCode(input);
  return (
    code.length === SHORT_CODE_LENGTH && [...code].every((c) => SHORT_CODE_ALPHABET.includes(c))
  );
}
