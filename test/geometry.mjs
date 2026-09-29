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
  ROTATE_HANDLE,
  TEXT_WIDTH_HANDLE,
  boxOf,
  contentBounds,
  handlesOf,
  polygonPoints,
  resizeElement,
  rotationFromDrag,
  shapeHit,
  textLines,
  bendFromDrag,
  bendHandleOf,
  control,
  elementsIn,
  followLinks,
  linkEndpoints,
  linkPoint,
  markerPaths,
  recognizeSketch,
  routePath,
  shapeAt,
  translate,
} from '../src/features/board/geometry.ts';
import { coveringFigure, editPatches, fillFor, fillLevelOf, useBoardStore } from '../src/features/board/store.ts';

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

// --- taps ------------------------------------------------------------------
// The arrow A -> B: a tap inside A but off the arrow's route is A, on the route it is the arrow.
assert.equal(shapeAt([A, B, arrow], { x: 20, y: 90 }, 6)?.id, 'A');
assert.equal(shapeAt([A, B, arrow], { x: 200, y: 50 }, 6)?.id, 'L');

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

// --- curved/elbow fold -------------------------------------------------------
// Absent `bend` must reproduce the old fixed-fold look exactly (no visual
// change for every board saved before this field existed).
const line = { from: { x: 0, y: 0 }, to: { x: 100, y: 0 } };
assert.deepEqual(bendHandleOf({ ...line, shape: 'arrow', route: 'curved' }), control(line.from, line.to));
assert.deepEqual(bendHandleOf({ ...line, shape: 'arrow', route: 'elbow' }), { x: 50, y: 0 });
assert.equal(bendHandleOf({ ...line, shape: 'arrow', route: 'straight' }), null, 'nothing to fold on a straight line');
assert.equal(bendHandleOf({ ...line, shape: 'rectangle', route: 'curved' }), null, 'only lines fold');
// Dragging the fold handle to a point, then reading it back, must return to
// that same point. A curve only moves perpendicular to its chord — here,
// straight up/down from the midpoint (50, 0) — so that is the point dragged.
const draggedCurve = bendFromDrag({ ...line, route: 'curved' }, { x: 50, y: -20 });
assert.deepEqual(bendHandleOf({ ...line, shape: 'arrow', route: 'curved', bend: draggedCurve }), { x: 50, y: -20 });
// An elbow's fold only moves along the line's own axis (x, here); the handle
// always sits back on the chord (y stays 0).
const draggedElbow = bendFromDrag({ ...line, route: 'elbow' }, { x: 60, y: -20 });
assert.deepEqual(bendHandleOf({ ...line, shape: 'arrow', route: 'elbow', bend: draggedElbow }), { x: 60, y: 0 });

// --- after "send to back", what is on top owns the press ----------------------
// A lot selected (two boxes and a line), sent to the back under an unselected
// box and a quick stroke with far-apart points.
{
  const P = box('P', 0, 0, 200, 200, 1);
  const Q = box('Q', 300, 0, 200, 200, 2);
  const W = { ...box('W', 250, 0, 10, 10, 3), shape: 'line', from: { x: 200, y: 100 }, to: { x: 300, y: 100 } };
  const U = box('U', 50, 50, 60, 60, 4);
  const K = { ...base('K', 5), kind: 'stroke', points: [320, 20, 480, 180], color: '#000000', width: 2 };
  useBoardStore.getState().hydrate({ meta, elements: [P, Q, W, U, K], participants: [you], you, seq: 0 });
  s().setConnection('online');
  s().select(['P', 'Q', 'W']);
  s().reorder('back');
  const where = () => JSON.stringify(s().visibleElements().map((e) => [e.id, e.from, e.to, e.points]));
  const before = where();
  const sel = () => s().selectedElements();
  const owner = (x, y) => coveringFigure(s().visibleElements(), sel(), { x, y }, 6)?.id ?? null;
  assert.equal(where(), before, 'sending to the back moves nothing');
  assert.equal(owner(80, 80), 'U', 'the box on top of the hidden selection owns the press');
  assert.equal(owner(400, 100), 'K', 'so does a stroke on top, between its two points');
  assert.equal(owner(150, 150), null, 'off the covering figures the press is the selection\'s');
  // Not contiguous in paint order: the selection spans U's layer, and U, over
  // P, still wins there — the old check compared U with the highest selected z.
  s().select(['P', 'Q']);
  s().reorder('front');
  s().select(['P']);
  s().reorder('back');
  s().select(['P', 'Q']);
  assert.ok(s().elements.P.z < s().elements.U.z && s().elements.U.z < s().elements.Q.z);
  assert.equal(owner(80, 80), 'U');
  // A handle off every selected body, over a figure below the selection, still resizes.
  s().select(['U']);
  s().reorder('front');
  assert.equal(coveringFigure(s().visibleElements(), [s().elements.U], { x: 40, y: 40 }, 6), null);
  // The eraser follows the same line: a pass between the stroke's points erases it.
  s().eraseAt({ x: 400, y: 100 });
  assert.equal(s().elements.K.deleted, true);
}

// --- cut, copy, paste ----------------------------------------------------------
{
  const P = box('P', 0, 0, 100, 100, 1);
  const Q = { ...box('Q', 300, 0, 100, 100, 2), group: 'g' };
  const R = { ...box('R', 300, 200, 100, 100, 3), group: 'g' };
  const L = { ...box('L', 0, 0, 0, 0, 4), shape: 'arrow', from: { x: 100, y: 50 }, to: { x: 300, y: 50 }, fromLink: { id: 'P', u: 1, v: 0.5 }, toLink: { id: 'Q', u: 0, v: 0.5 } };
  useBoardStore.getState().hydrate({ meta, elements: [P, Q, R, L], participants: [you], you, seq: 0 });
  s().setConnection('online');
  const count = () => s().visibleElements().length;

  // Copy leaves the board alone and keeps paint order, whatever order things were picked in.
  s().select(['L', 'Q', 'P']);
  s().copySelection();
  assert.deepEqual(s().clipboard.map((e) => e.id), ['P', 'Q', 'R', 'L'], 'the group comes along, in paint order');
  assert.equal(count(), 4);

  // Paste centred on a point: fresh ids, on top, selected, a group of their own.
  s().paste({ x: 1000, y: 1000 });
  const pasted = s().selectedElements();
  assert.equal(pasted.length, 4);
  assert.equal(count(), 8);
  assert.ok(pasted.every((e) => !['P', 'Q', 'R', 'L'].includes(e.id)), 'new ids');
  assert.ok(Math.min(...pasted.map((e) => e.z)) > 4, 'on top of everything');
  const [pP, pQ, pR, pL] = s().visibleElements().slice(4);
  assert.deepEqual([pP.from, pP.to], [{ x: 800, y: 850 }, { x: 900, y: 950 }], 'the copies are centred on the point');
  assert.ok(pQ.group && pQ.group !== 'g' && pQ.group === pR.group, 'the copied group is a new group');
  assert.deepEqual([pL.fromLink.id, pL.toLink.id], [pP.id, pQ.id], 'the arrow binds to the copied shapes');
  s().select('Q');
  assert.deepEqual([...s().selectedIds].sort(), ['Q', 'R'], 'the original group selects without its copy');

  // A line copied without its shapes lets go of them.
  s().select('L');
  s().copySelection();
  s().paste();
  const lone = s().selectedElements()[0];
  assert.deepEqual([lone.fromLink, lone.toLink, lone.from], [null, null, { x: 116, y: 66 }], 'unlinked, a step off');

  // Cut: gone in one undo step, and back with one.
  const before = count();
  s().select(['P']);
  s().cutSelection();
  assert.equal(count(), before - 1);
  assert.deepEqual(s().selectedIds, []);
  assert.deepEqual(s().clipboard.map((e) => e.id), ['P']);
  s().undo();
  assert.equal(count(), before);

  // The clipboard outlives the board: it pastes on the next one.
  useBoardStore.getState().hydrate({ meta, elements: [], participants: [you], you, seq: 0 });
  s().setConnection('online');
  s().paste({ x: 0, y: 0 });
  assert.equal(count(), 1);
}

// --- a held pen stroke becomes the figure it was meant to be ---------------------
{
  // Sloppy strokes, seeded: every one of 30 hands has to come out the same.
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const shake = (r, flat, a) => flat.map((v) => v + (r() - 0.5) * 2 * a);
  const through = (r, pts, jit = 1.5) => {
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
      for (let k = 0; k < n; k++) out.push(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n);
    }
    return shake(r, [...out, ...pts.at(-1)], jit);
  };
  const wobbly = (r, rx, ry, wobble, sweep = 2 * Math.PI) => {
    const [t0, a, b] = [r() * 6.3, r() * 6.3, r() * 6.3];
    const out = [];
    for (let i = 0; i <= 90; i++) {
      const t = t0 + (sweep * i) / 90;
      const k = 1 + wobble * (0.6 * Math.sin(3 * t + a) + 0.4 * Math.sin(2 * t + b));
      out.push(rx * k * Math.cos(t), ry * k * Math.sin(t));
    }
    return shake(r, out, 1.5);
  };
  const rough = (r, corners, size) => {
    const k = Math.floor(r() * corners.length);
    const c = [...corners.slice(k), ...corners.slice(0, k)].map(([x, y]) => [x + (r() - 0.5) * 0.12 * size, y + (r() - 0.5) * 0.12 * size]);
    return through(r, [...c, c[0], [c[0][0] + (c[1][0] - c[0][0]) * 0.1, c[0][1] + (c[1][1] - c[0][1]) * 0.1]]);
  };
  const cases = [
    ['a bad circle', (r) => wobbly(r, 100, 100, 0.2), 'ellipse'],
    ['a circle left open', (r) => wobbly(r, 100, 100, 0.12, 1.85 * Math.PI), 'ellipse'],
    ['an ellipse', (r) => wobbly(r, 160, 80, 0.1), 'ellipse'],
    ['a square', (r) => rough(r, [[0, 0], [200, 0], [200, 200], [0, 200]], 200), 'rectangle'],
    ['a long rectangle', (r) => rough(r, [[0, 0], [400, 0], [400, 100], [0, 100]], 100), 'rectangle'],
    ['a triangle', (r) => rough(r, [[100, 0], [200, 170], [0, 170]], 200), 'triangle'],
    ['a right triangle', (r) => rough(r, [[0, 0], [200, 200], [0, 200]], 200), 'triangle'],
    ['a line', (r) => through(r, [[0, 0], [300, 90]], 2.5), 'line'],
    ['an arrow, two barbs', (r) => through(r, [[0, 0], [300, 0], [260, -25], [300, 0], [260, 25]], 2), 'arrow'],
    ['an arrow, one barb', (r) => through(r, [[0, 0], [250, 150], [215, 150]], 2), 'arrow'],
    ['a U', (r) => through(r, [[0, 0], [0, 200], [200, 200], [200, 0]]), undefined],
    ['a zigzag', (r) => through(r, [[0, 0], [50, 100], [100, 0], [150, 100], [200, 0]]), undefined],
    ['hatching', (r) => through(r, [[0, 0], [150, 20], [5, 40], [160, 60], [0, 80], [150, 100]]), undefined],
    ['a line and back', (r) => through(r, [[0, 0], [300, 0], [150, 0]]), undefined],
    ['a tiny loop', (r) => wobbly(r, 5, 5, 0.1), undefined],
  ];
  for (const [name, draw, want] of cases) {
    for (let seed = 1; seed <= 30; seed++) {
      assert.equal(recognizeSketch(draw(rng(seed)), 20)?.shape, want, `${name} (hand ${seed})`);
    }
  }
  // About as tall as wide, a circle comes out round and a square square.
  const circle = recognizeSketch(wobbly(rng(7), 100, 92, 0.1), 20);
  assert.ok(Math.abs(circle.to.x - circle.from.x - (circle.to.y - circle.from.y)) < 1e-9, 'a round circle');
  // An arrow runs from where the stroke started to its tip.
  const arrowSketch = recognizeSketch(through(rng(3), [[0, 0], [300, 0], [260, -25], [300, 0], [260, 25]], 0), 20);
  assert.deepEqual([arrowSketch.from, arrowSketch.to], [{ x: 0, y: 0 }, { x: 300, y: 0 }]);

  // Held and lifted, it lands as the pen's figure: its ink and width, no fill, a plain arrow.
  useBoardStore.getState().hydrate({ meta, elements: [], participants: [you], you, seq: 0 });
  s().setConnection('online');
  s().setConfig({ color: '#E5484D', width: 5, fill: 'medium', route: 'curved', dash: 'dashed' });
  s().addSketch(arrowSketch);
  const drawn = s().visibleElements()[0];
  assert.deepEqual(
    [drawn.kind, drawn.shape, drawn.stroke, drawn.strokeWidth, drawn.fill, drawn.headEnd, drawn.route, drawn.dash],
    ['shape', 'arrow', '#E5484D', 5, null, 'arrow', 'straight', 'solid'],
  );
  s().undo();
  assert.equal(s().visibleElements().length, 0, 'one undo step');
}

// --- text: whitespace-only is empty, so the element goes ---------------------
const T = { ...base('T', 9), kind: 'text', at: { x: 0, y: 0 }, text: 'hi', color: '#1B2030', fontSize: 20 };
useBoardStore.getState().hydrate({ meta, elements: [A, T], participants: [you], you, seq: 0 });
s().updateText('T', { text: '   ' });
assert.equal(s().visibleElements().some((e) => e.id === 'T'), false);

// --- phase 3: polygons, images as targets, text resize, rotation -------------
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
const closeP = (a, b, msg) => (close(a.x, b.x, msg), close(a.y, b.y, msg));

// A regular polygon: n corners, the first straight up, all on the box's ellipse.
const hex = polygonPoints({ x: 0, y: 0, width: 100, height: 100 }, 6);
assert.equal(hex.length, 6);
closeP(hex[0], { x: 50, y: 0 }, 'first corner up');
assert.equal(polygonPoints({ x: 0, y: 0, width: 10, height: 10 }, 40).length, 12, 'sides clamped');

// An image is a link target: an arrow dropped on it binds, and follows it.
const IMG = { ...base('I', 4), kind: 'image', at: { x: 300, y: 0 }, width: 100, height: 50, uri: 'data:,' };
r = linkEndpoints([A, IMG], { x: 50, y: 50 }, { x: 350, y: 25 }, 18);
assert.equal(r.toLink.id, 'I');
assert.equal(r.toLink.u, 0, 'on its left edge, facing A');
follow = followLinks(
  [A, { ...IMG, at: { x: 310, y: 10 } }, { ...arrow, fromLink: r.fromLink, toLink: r.toLink }],
  ['I'],
);
closeP(follow[0].to, { x: r.to.x + 10, y: r.to.y + 10 }, 'the bound end follows the image');

// An image scales from a corner and keeps its proportions; the opposite corner stays.
let patch = resizeElement(IMG, 2, { x: 500, y: 60 });
assert.deepEqual(patch, { at: { x: 300, y: 0 }, width: 200, height: 100 });

// Text: corners scale the font (like an image), the edge handle sets a wrap width.
const TX = { ...base('TX', 5), kind: 'text', at: { x: 0, y: 0 }, text: 'aaaa bbbb cccc', color: '#000000', fontSize: 20 };
const tb = boxOf(TX);
patch = resizeElement(TX, 2, { x: tb.width * 2, y: tb.height * 2 });
assert.equal(patch.fontSize, 40);
assert.deepEqual(patch.at, { x: 0, y: 0 }, 'top-left corner pinned');
assert.equal(handlesOf(TX).length, 5, 'four corners and the width handle');
patch = resizeElement(TX, TEXT_WIDTH_HANDLE, { x: 60, y: 0 });
assert.equal(patch.width, 60);
assert.deepEqual(textLines({ ...TX, width: 60 }), ['aaaa', 'bbbb', 'cccc'], 'wrapped at word breaks');
assert.ok(boxOf({ ...TX, width: 60 }).height > tb.height * 2, 'three lines are taller than one');

// Rotation: a box turned 90° about its centre is hit in its turned outline.
const W = { ...box('W', 0, 0, 200, 20, 6), rotation: Math.PI / 2 };
assert.ok(shapeHit(W, { x: 100, y: -80 }, 0), 'inside the turned box');
assert.ok(!shapeHit(W, { x: 10, y: 10 }, 0), 'outside it, though inside the unturned one');
const wb = contentBounds([W]);
close(wb.width, 20 + 2, 'turned bounds width');
close(wb.height, 200 + 2, 'turned bounds height');
// Its handles turn with it, and a resize keeps the pinned corner where it was.
const [tl, , br] = handlesOf(W);
closeP(tl, { x: 110, y: -90 }, 'TL turned');
patch = resizeElement(W, 2, { x: br.x - 10, y: br.y + 50 });
const after = { ...W, ...patch };
closeP(handlesOf(after)[0], tl, 'the opposite corner stays put');
// A link on a turned target lands on its turned outline.
closeP(linkPoint(W, { id: 'W', u: 1, v: 0.5 }), { x: 100, y: 110 }, 'right edge turned down');
// The knob: dragged due right of the centre it turns a quarter; near 15° steps it snaps.
close(rotationFromDrag(A, { x: 150, y: 50 }), Math.PI / 2, 'quarter turn');
close(rotationFromDrag(A, { x: 50 + Math.sin(0.27), y: 50 - Math.cos(0.27) }), Math.PI / 12, 'snapped to 15°');
assert.equal(ROTATE_HANDLE, 5);

console.log('geometry: ok');
