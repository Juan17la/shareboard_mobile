/**
 * What Copy puts on the system clipboard, so a selection pastes as the same
 * elements in another board, on another device, or on the web (a hand-kept
 * twin of `web/src/lib/clip.ts`). The text is plain, marked by a prefix;
 * anything without it is somebody else's text and is not ours to parse.
 */
import { LIMITS, type BoardElement } from './model';

const PREFIX = 'shareboard:v1:';
const isPoint = (p: unknown) =>
  !!p && typeof (p as { x: unknown }).x === 'number' && typeof (p as { y: unknown }).y === 'number';

/** Just enough shape per kind that geometry can't throw; the server validates the rest. */
function usable(el: BoardElement): boolean {
  if (!el || typeof el.id !== 'string') return false;
  switch (el.kind) {
    case 'stroke':
      return Array.isArray(el.points);
    case 'shape':
      return isPoint(el.from) && isPoint(el.to);
    case 'text':
    case 'image':
      return isPoint(el.at);
    default:
      return false;
  }
}

export function encodeClip(elements: BoardElement[]): string {
  return PREFIX + JSON.stringify(elements);
}

/** The elements in `text`, or null when it is not a Shareboard copy. */
export function decodeClip(text: string | null | undefined): BoardElement[] | null {
  if (!text || !text.startsWith(PREFIX)) return null;
  try {
    const list: unknown = JSON.parse(text.slice(PREFIX.length));
    if (!Array.isArray(list)) return null;
    const elements = (list as BoardElement[]).filter(usable);
    return elements.length ? elements.slice(0, LIMITS.maxElements) : null;
  } catch {
    return null;
  }
}
