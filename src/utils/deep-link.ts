/**
 * Deep-link / share-link parsing.
 *
 * Accepted inputs (see docs/02-backend-connection):
 *   - shareboard://board/<id>
 *   - https://<host>/b/<code>
 *   - https://<host>/board/<id>
 *   - a bare short code ("ABC234")
 *   - a bare board id
 */
import { isValidShortCode, normalizeShortCode } from './short-code';

export type ParsedBoardRef =
  | { kind: 'id'; boardId: string }
  | { kind: 'code'; shortCode: string }
  | null;

export function parseBoardRef(raw: string): ParsedBoardRef {
  const input = raw.trim();
  if (!input) return null;

  // Try URL forms first.
  try {
    const url = new URL(input);
    const segments = url.pathname.split('/').filter(Boolean);
    const [head, value] = segments;
    if ((head === 'b' || head === 'code') && value) {
      return { kind: 'code', shortCode: normalizeShortCode(value) };
    }
    if ((head === 'board' || url.host === 'board') && value) {
      return { kind: 'id', boardId: value };
    }
    // shareboard://board/<id> parses with host === 'board'
    if (url.protocol === 'shareboard:' && segments.length) {
      return { kind: 'id', boardId: segments[segments.length - 1] };
    }
  } catch {
    // not a URL — fall through
  }

  if (isValidShortCode(input)) {
    return { kind: 'code', shortCode: normalizeShortCode(input) };
  }
  // Assume anything else is a raw board id.
  return { kind: 'id', boardId: input };
}

/** Build the canonical web share link for a board. */
export function boardShareLink(webBaseUrl: string, shortCode: string): string {
  return `${webBaseUrl.replace(/\/$/, '')}/b/${shortCode}`;
}

/** Build the app deep link for a board. */
export function boardDeepLink(boardId: string): string {
  return `shareboard://board/${boardId}`;
}
