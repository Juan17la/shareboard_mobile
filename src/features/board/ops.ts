/**
 * Applying ops to the local element map.
 *
 * Everything is immutable: `applyOps` returns a new map so Zustand/React see a
 * changed reference. Semantics match `server/src/model/ops.ts` — deletes are
 * soft, re-applying an op is idempotent — so a client and the server that
 * process the same ops end up with the same board (docs/05-model-date).
 */
import type { BoardElement, ElementId, Op } from './model';

export type ElementMap = Record<ElementId, BoardElement>;

/** `null` in a patch means "unset": the key goes away rather than staying null. */
function withoutNulls(el: Record<string, unknown>): BoardElement {
  for (const key of Object.keys(el)) if (el[key] === null) delete el[key];
  return el as unknown as BoardElement;
}

/** Apply `ops` in order and return the resulting map. */
export function applyOps(elements: ElementMap, ops: Op[]): ElementMap {
  if (ops.length === 0) return elements;
  let next: ElementMap = { ...elements };

  for (const op of ops) {
    switch (op.t) {
      case 'add':
        // Re-adding the same id is a replacement, which makes replays safe.
        next[op.el.id] = op.el;
        break;
      case 'update': {
        const current = next[op.id];
        if (!current) break;
        next[op.id] = withoutNulls({ ...current, ...op.patch, updatedAt: op.updatedAt });
        break;
      }
      case 'delete': {
        const current = next[op.id];
        // Soft delete so the removal propagates deterministically.
        if (current) next[op.id] = { ...current, deleted: true, updatedAt: Date.now() };
        break;
      }
      case 'clear':
        next = {};
        break;
    }
  }
  return next;
}

/**
 * The ops that undo `ops`, already in the order they must be applied.
 * `before` is the state the ops were applied to.
 */
export function invertOps(before: ElementMap, ops: Op[]): Op[] {
  // Ops are sequential, so each inverse is computed against the state that op
  // actually saw, not against `before`.
  let state = before;
  const inverses: Op[] = [];

  for (const op of ops) {
    switch (op.t) {
      case 'add': {
        const previous = state[op.el.id];
        // An 'add' over an existing id was a replacement: restore the old one.
        inverses.push(previous ? { t: 'add', el: previous } : { t: 'delete', id: op.el.id });
        break;
      }
      case 'update': {
        const previous = state[op.id];
        if (!previous) break;
        // Restore only the keys this patch touched. A key the element did not
        // have before is restored as `null`, not `undefined`: JSON drops
        // `undefined`, and a patch that lost the key would leave the server and
        // everyone else with the value this undo removed.
        const patch: Record<string, unknown> = {};
        for (const key of Object.keys(op.patch)) {
          patch[key] = (previous as unknown as Record<string, unknown>)[key] ?? null;
        }
        inverses.push({
          t: 'update',
          id: op.id,
          patch: patch as Partial<BoardElement>,
          updatedAt: previous.updatedAt,
        });
        break;
      }
      case 'delete': {
        const previous = state[op.id];
        if (previous) inverses.push({ t: 'add', el: previous });
        break;
      }
      case 'clear': {
        for (const el of visibleSorted(state)) inverses.push({ t: 'add', el });
        break;
      }
    }
    state = applyOps(state, [op]);
  }

  // Undo runs newest change first.
  return inverses.reverse();
}

let sortedFor: ElementMap | null = null;
let sorted: BoardElement[] = [];

/**
 * Visible elements in paint order — what the canvas and snapshots consume.
 * Maps are never mutated (`applyOps` copies), so the last result is reused
 * while the map is the same one: the eraser, hit tests and line snapping ask
 * for it on every touch sample, and sorting the whole board each time was
 * most of what a sample cost. Callers must not mutate the returned array.
 */
export function visibleSorted(elements: ElementMap): BoardElement[] {
  if (elements !== sortedFor) {
    sortedFor = elements;
    sorted = Object.values(elements)
      .filter((el) => !el.deleted)
      .sort((a, b) => a.z - b.z);
  }
  return sorted;
}
