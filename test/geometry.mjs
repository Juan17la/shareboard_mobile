/**
 * Self-check of the board geometry and the store logic behind the cursor tool:
 * links, following, moving, markers, ordering. Runs the real TypeScript under
 * node through tsx (see `check:geometry` in package.json). Fails loudly.
 */
import assert from 'node:assert/strict';

import {
  ALL_MARKERS,
  ROUTES,
} from '../src/features/board/model.ts';
import {
  elementsIn,
  followLinks,
  linkEndpoints,
  linkPoint,
  markerPaths,
  routePath,
  translate,
} from '../src/features/board/geometry.ts';
import { editPatches, fillFor, fillLevelOf, useBoardStore } from '../src/features/board/store.ts';

const base = (id, z) => ({ id, createdBy: 'u', createdAt: 0, updatedAt: 0, z });
const box = (id, x, y, w, h, z = 1) => ({
  ...base(id, z), kind: 'shape', shape: 'rectangle', from: { x, y }, to: { x: x + w, y: y + h }, stroke: '#000000', strokeWidth: 2, fill: null,
});
const A = box('A', 0, 0, 100, 100, 1);
const B = box('B', 300, 0, 100, 100, 2);

// --- linking ---------------------------------------------------------------
// Centre to centre: each end faces the other box.
let r = linkEndpoints([A, B], { x: 50, y: 50 }, { x: 350, y: 50 }, 18);
assert.deepEqual(r.from, { x: 100, y: 50 });
assert.deepEqual(r.to, { x: 300, y: 50 });
assert.deepEqual(r.fromLink, { id: 'A', u: 1, v: 0.5 });
assert.deepEqual(r.toLink, { id: 'B', u: 0, v: 0.5 });
// Dropped on the outline elsewhere: pinned right there.
r = linkEndpoints([A, B], { x: 20, y: 98 }, { x: 500, y: 500 }, 18);
assert.deepEqual(r.from, { x: 20, y: 100 });
assert.deepEqual(r.fromLink, { id: 'A', u: 0.2, v: 1 });
assert.equal(r.toLink, null);
assert.deepEqual(r.to, { x: 500, y: 500 });

// --- following -------------------------------------------------------------
const arrow = { ...box('L', 100, 50, 200, 0, 3), shape: 'arrow', fromLink: r.fromLink, toLink: { id: 'B', u: 0, v: 0.5 } };
const movedB = { ...B, ...translate(B, 10, 20) };
let follow = followLinks([A, movedB, arrow], ['B']);
assert.equal(follow.length, 1);
assert.deepEqual(follow[0].to, { x: 310, y: 70 });
assert.equal(follow[0].from, undefined, 'the unmoved end is not patched');
// A dangling link does nothing.
follow = followLinks([movedB, { ...arrow, toLink: { id: 'gone', u: 0, v: 0 } }], ['B', 'gone']);
assert.equal(follow.length, 0);
assert.deepEqual(linkPoint(B, { id: 'B', u: 0.5, v: 1 }), { x: 350, y: 100 });

// --- moving every kind -----------------------------------------------------
assert.deepEqual(translate({ ...base('s', 1), kind: 'stroke', points: [1, 2, 3, 4], color: '#000000', width: 1 }, 10, 20), { points: [11, 22, 13, 24] });
assert.deepEqual(translate({ ...base('t', 1), kind: 'text', at: { x: 1, y: 1 }, text: 'x', color: '#000000', fontSize: 10 }, 1, 1), { at: { x: 2, y: 2 } });
assert.deepEqual(translate(A, 5, 5).to, { x: 105, y: 105 });

// A drag of B alone: B moves, the arrow's end follows, the arrow keeps its link.
let patches = editPatches([A, B, arrow], { ids: ['B'], mode: 'move', handle: -1, start: { x: 0, y: 0 }, dx: 10, dy: 0, patch: null });
assert.deepEqual(patches.map((p) => p.id), ['B', 'L']);
assert.deepEqual(patches[1].patch, { to: { x: 310, y: 50 } });
// A drag of the arrow alone lets go of both shapes.
patches = editPatches([A, B, arrow], { ids: ['L'], mode: 'move', handle: -1, start: { x: 0, y: 0 }, dx: 10, dy: 0, patch: null });
assert.equal(patches.length, 1);
assert.equal(patches[0].patch.fromLink, null);
assert.equal(patches[0].patch.toLink, null);
// Dragged together, the link survives.
patches = editPatches([A, B, arrow], { ids: ['B', 'L'], mode: 'move', handle: -1, start: { x: 0, y: 0 }, dx: 10, dy: 0, patch: null });
assert.equal(patches.find((p) => p.id === 'L').patch.toLink, undefined);

// --- marquee ---------------------------------------------------------------
assert.deepEqual(elementsIn([A, B], { x: -10, y: -10, width: 200, height: 200 }).map((e) => e.id), ['A']);
// Touching counts: a band that clips B's corner takes B too.
assert.deepEqual(elementsIn([A, B], { x: 50, y: 50, width: 260, height: 100 }).map((e) => e.id), ['A', 'B']);

// --- paths -----------------------------------------------------------------
for (const kind of ALL_MARKERS) {
  const parts = markerPaths(kind, { x: 10, y: 10 }, 0, 10);
  assert.equal(parts.length > 0, kind !== 'none', kind);
  for (const p of parts) assert.match(p.d, /^M /, kind);
}
for (const route of ROUTES) assert.match(routePath({ x: 0, y: 0 }, { x: 10, y: 5 }, route), /^M 0 0 /, route);
assert.equal(routePath({ x: 0, y: 0 }, { x: 10, y: 0 }, 'elbow').split('L').length, 4);

// --- fill levels -----------------------------------------------------------
assert.equal(fillFor('#FF0000', 'low'), '#FF00002E');
assert.equal(fillFor('#FF0000', 'full'), '#FF0000FF');
assert.equal(fillFor('#FF0000', 'none'), null);
assert.equal(fillLevelOf('#FF000080'), 'medium');
assert.equal(fillLevelOf(null), 'none');

// --- ordering and groups, through the store --------------------------------
const meta = { id: 'b', shortCode: 'ABCDEF', name: '', access: 'public', editPolicy: 'everyone', editors: [], creatorId: 'u', hasPin: false, createdAt: 0, updatedAt: 0 };
const you = { userId: 'u', nickname: 'u', color: '#000000', role: 'creator', lastSeen: 0 };
const C = box('C', 0, 0, 10, 10, 3);
useBoardStore.getState().hydrate({ meta, elements: [A, B, C], participants: [you], you, seq: 0 });
useBoardStore.getState().setConnection('online');
const s = () => useBoardStore.getState();
const zs = () => s().visibleElements().map((e) => e.id).join('');

s().select('A');
s().reorder('front');
assert.equal(zs(), 'BCA');
s().reorder('backward');
assert.equal(zs(), 'BAC');
s().reorder('back');
assert.equal(zs(), 'ABC');
s().reorder('forward');
assert.equal(zs(), 'BAC');
// Undo takes the last step back in one go; the next add lands on top.
s().undo();
assert.equal(zs(), 'ABC');
assert.ok(s().zCounter >= 3);

s().select(['A', 'B']);
s().group();
assert.equal(s().elements.A.group, s().elements.B.group);
s().select('C');
s().select('A');
assert.deepEqual([...s().selectedIds].sort(), ['A', 'B'], 'a group selects whole');
s().ungroup();
assert.equal(s().elements.A.group, undefined, 'null in a patch unsets the key');

// Restyle reaches every selected kind.
s().restyle({ color: '#123456', fill: 'medium' });
assert.equal(s().elements.A.stroke, '#123456');
assert.equal(s().elements.A.fill, '#12345680');

// Kind changes stay in the family: a box becomes another box, never a line.
s().select('A');
s().restyle({ shape: 'ellipse' });
assert.equal(s().elements.A.shape, 'ellipse');
s().restyle({ shape: 'arrow' });
assert.equal(s().elements.A.shape, 'ellipse', 'a box cannot become an arrow');
useBoardStore.getState().hydrate({ meta, elements: [A, B, { ...arrow, shape: 'line', headStart: 'none', headEnd: 'none' }], participants: [you], you, seq: 0 });
s().setConnection('online');
s().select('L');
s().restyle({ shape: 'arrow' });
assert.equal(s().elements.L.headEnd, 'arrow', 'an arrow with no heads gets one');
s().restyle({ shape: 'line' });
assert.deepEqual([s().elements.L.shape, s().elements.L.headEnd], ['line', 'none']);

// --- undo restores exactly what a drag changed ---------------------------
useBoardStore.getState().hydrate({ meta, elements: [A, B, arrow], participants: [you], you, seq: 0 });
s().setConnection('online');
s().commitEdit({ ids: ['B'], mode: 'move', handle: -1, start: { x: 0, y: 0 }, dx: 10, dy: 20, patch: null });
assert.deepEqual(s().elements.L.to, { x: 310, y: 70 });
// A collaborator moves the arrow's other end meanwhile.
s().applyRemote([{ t: 'update', id: 'L', patch: { from: { x: 1, y: 2 } }, updatedAt: 1 }], 1, false);
s().undo();
assert.deepEqual([s().elements.B.from, s().elements.B.to], [B.from, B.to], 'the box is back');
assert.deepEqual(s().elements.L.to, arrow.to, 'the followed end is back');
assert.deepEqual(s().elements.L.from, { x: 1, y: 2 }, 'the end nobody dragged keeps the collaborator\'s move');
s().redo();
assert.deepEqual(s().elements.B.to, { x: 410, y: 120 });
// Undoing a key the element never had must reach the wire: `undefined` would
// be dropped by JSON and the server would keep the value.
s().select('A');
s().restyle({ fontSize: 40 });
assert.equal(s().elements.A.fontSize, 40);
s().undo();
const wire = JSON.parse(JSON.stringify(s().outbox.at(-1)));
assert.deepEqual(wire.patch, { fontSize: null });
assert.equal('fontSize' in s().elements.A, false, 'the key is gone, not null');

console.log('geometry: ok');
