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
  addStroke,
  strokeToSvgPath,
  boxOf,
  contentBounds,
  handlesOf,
  polygonPoints,
  resizeElement,
  rotationFromDrag,
  shapeHit,
  textLines,
  labelLines,
  lineLabelCentre,
  labelBox,
  labelFromDrag,
  routePointAt,
  anchorsOf,
  bendFromDrag,
  bendHandleOf,
  curveHandlesOf,
  curveFromDrag,
  elbowAxes,
  endAngles,
  elementsIn,
  followLinks,
  linkEndpoints,
  linkPoint,
  markerPaths,
  recognizeSketch,
  sketchResize,
  routePath,
  shapeAt,
  translate,
} from '../src/features/board/geometry.ts';
import { coveringFigure, editPatches, fillColorOf, fillOpacityOf, fillWith, parseHex, useBoardStore } from '../src/features/board/store.ts';
import { decodeClip, encodeClip } from '../src/features/board/clip.ts';
import { splitOps } from '../src/features/board/ops.ts';
import { toSvg } from '../src/features/board/svg.ts';

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
for (const route of ROUTES) assert.match(routePath({ from: { x: 0, y: 0 }, to: { x: 10, y: 5 }, route }), /^M 0 0 /, route);
assert.equal(routePath({ from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, route: 'elbow' }).split('L').length, 4);

// --- fill levels -----------------------------------------------------------

// --- ordering and groups, through the store --------------------------------
const meta = { id: 'b', shortCode: 'ABCDEF', name: '', access: 'public', editPolicy: 'everyone', editors: [], creatorId: 'u', hasPin: false, createdAt: 0, updatedAt: 0 };
const you = { userId: 'u', nickname: 'u', color: '#000000', role: 'creator', lastSeen: 0 };
const C = box('C', 0, 0, 10, 10, 3);
useBoardStore.getState().hydrate({ meta, elements: [A, B, C], participants: [you], you, seq: 0 });
useBoardStore.getState().setConnection('online');
const s = () => useBoardStore.getState();
// A real hydrate keeps ops that were still waiting to be sent (a reconnect);
// these checks start each scene on a clean outbox, the one that reconnects
// (`hydrateKeeping`) aside.
const hydrateKeeping = s().hydrate;
useBoardStore.setState({
  hydrate: (args) => {
    useBoardStore.setState({ outbox: [] });
    hydrateKeeping(args);
  },
});
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
s().restyle({ color: '#123456', fillOpacity: 50 });
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
assert.equal(bendHandleOf({ ...line, shape: 'arrow', route: 'curved' }), null, 'a curve is shaped by its own handles');
assert.deepEqual(bendHandleOf({ ...line, shape: 'arrow', route: 'elbow' }), { x: 50, y: 0 });
assert.equal(bendHandleOf({ ...line, shape: 'arrow', route: 'straight' }), null, 'nothing to fold on a straight line');
assert.equal(bendHandleOf({ ...line, shape: 'rectangle', route: 'curved' }), null, 'only lines fold');
// Dragging the fold handle to a point, then reading it back, must return to
// that same point. A curve only moves perpendicular to its chord — here,
// straight up/down from the midpoint (50, 0) — so that is the point dragged.
// A curve nobody has shaped is the original bow, drawn as the equivalent cubic:
// its middle is where the quadratic's was.
const bowed = { ...line, shape: 'arrow', route: 'curved' };
const near1 = (a, b, tol, msg) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < tol, `${msg}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
near1(curveHandlesOf(bowed).mid, { x: 50, y: 12.5 }, 1e-9, 'the original bow');
// Dragging a handle, then reading it back, returns to the point dragged.
const midDrag = { ...bowed, ...curveFromDrag(bowed, 'mid', { x: 50, y: -20 }) };
near1(curveHandlesOf(midDrag).mid, { x: 50, y: -20 }, 0.05, 'the middle of a curve dragged');
const startDrag = { ...bowed, ...curveFromDrag(bowed, 'start', { x: 0, y: -50 }) };
near1(curveHandlesOf(startDrag).start, { x: 0, y: -50 }, 0.01, 'the start pull dragged');
near1(curveHandlesOf(startDrag).end, curveHandlesOf(bowed).end, 0.01, 'and the far end left alone');
// A handle on its end still has a direction for the marker.
assert.ok(Number.isFinite(endAngles({ ...bowed, curveFrom: { x: 0, y: 0 }, curveTo: { x: 0, y: 0 } }).start));
// --- an elbow's ends: the long axis, the side it leaves a shape by, or a choice ---
const step = { from: { x: 0, y: 0 }, to: { x: 100, y: 50 }, route: 'elbow' };
assert.deepEqual(elbowAxes(step), ['h', 'h'], 'the long axis, both ends');
assert.equal(routePath(step).split('L').length, 4, 'three segments');
assert.deepEqual(elbowAxes({ ...step, startAxis: 'v' }), ['v', 'h']);
assert.equal(routePath({ ...step, startAxis: 'v', endAxis: 'h' }), 'M 0 0 L 0 50 L 100 50', 'up and down, then across: a single corner');
assert.equal(routePath({ ...step, startAxis: 'h', endAxis: 'v' }), 'M 0 0 L 100 0 L 100 50');
assert.equal(bendHandleOf({ ...step, shape: 'arrow', startAxis: 'v', endAxis: 'h' }), null, 'a corner has no middle to drag');
// Bound to the bottom of one shape and the left of another, it leaves and arrives the way the sides face.
assert.deepEqual(elbowAxes({ ...step, fromLink: { id: 'a', u: 0.5, v: 1 }, toLink: { id: 'b', u: 0, v: 0.5 } }), ['v', 'h']);
assert.deepEqual(elbowAxes({ ...step, startAxis: 'h', fromLink: { id: 'a', u: 0.5, v: 1 } })[0], 'h', 'a choice beats the side');
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
  assert.ok(s().liveErased.includes('K'), 'marked while the finger is down');
  s().commitErase();
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

// --- a copy that travels as text: another tab, board or device ----------------------
{
  const P = { ...box('P', 0, 0, 100, 100, 1), text: 'hola', fill: '#FF000033', rotation: 0.5 };
  const I = { ...base('I', 2), kind: 'image', at: { x: 300, y: 0 }, width: 120, height: 80, uri: 'data:image/png;base64,AAAA' };
  const L = { ...box('L', 0, 0, 0, 0, 3), shape: 'arrow', from: { x: 100, y: 50 }, to: { x: 300, y: 40 }, bend: 0.3, headEnd: 'triangle', fromLink: { id: 'P', u: 1, v: 0.5 }, toLink: { id: 'I', u: 0, v: 0.5 } };
  useBoardStore.getState().hydrate({ meta, elements: [P, I, L], participants: [you], you, seq: 0 });
  s().setConnection('online');
  s().select(['P', 'I', 'L']);
  s().copySelection();
  const text = encodeClip(s().clipboard);

  // Only the text survives: a board with nothing on it, the store's clipboard gone.
  useBoardStore.getState().hydrate({ meta, elements: [], participants: [you], you, seq: 0 });
  s().setConnection('online');
  s().paste({ x: 500, y: 500 }, decodeClip(text));
  const [p, i, l] = s().visibleElements();
  const same = (el) => {
    const rest = { ...el };
    for (const k of ['id', 'createdBy', 'createdAt', 'updatedAt', 'z', 'from', 'to', 'at', 'fromLink', 'toLink']) delete rest[k];
    return rest;
  };
  assert.deepEqual([same(p), same(i), same(l)], [same(P), same(I), same(L)], 'every other field comes across untouched');
  assert.deepEqual([l.fromLink.id, l.toLink.id], [p.id, i.id], 'the arrow still joins the pasted shape and image');
  assert.equal(i.at.x - p.to.x, I.at.x - P.to.x, 'same layout');
  assert.equal(l.to.y - l.from.y, L.to.y - L.from.y);

  // Duplicate keeps what is joined: the arrow follows the copies, not the originals.
  s().select([p.id, i.id, l.id]);
  s().duplicateSelection();
  const [, , , dp, di, dl] = s().visibleElements();
  assert.deepEqual([dl.fromLink.id, dl.toLink.id], [dp.id, di.id]);

  // Text that is not ours is not parsed, and a half-formed copy is not trusted.
  assert.equal(decodeClip('hello'), null);
  assert.equal(decodeClip('shareboard:v1:{'), null);
  assert.equal(decodeClip('shareboard:v1:[{"id":"x","kind":"shape"}]'), null);
  assert.equal(decodeClip(undefined), null);
}

// --- a burst of ops goes out in frames that fit ------------------------------------------
{
  const ops = Array.from({ length: 10 }, (_, n) => ({ t: 'delete', id: `${n}`.padEnd(100, 'x') }));
  const groups = splitOps(ops, 450);
  assert.deepEqual(groups.flat(), ops, 'nothing lost, same order');
  assert.ok(groups.length > 1 && groups.every((g) => JSON.stringify(g).length <= 450));
  assert.equal(splitOps([], 450).length, 0);
  assert.equal(splitOps(ops, 10).length, 10, 'an op over the limit still goes, alone');
}

// --- fill: a colour typed as HEX and an opacity -----------------------------------------
{
  assert.equal(parseHex('f80'), '#FF8800');
  assert.equal(parseHex(' #ff8800 '), '#FF8800');
  assert.equal(parseHex('FF8800'), '#FF8800');
  for (const bad of ['', '#', 'ff88', '#ff88001', 'gg0000', '#12 456']) assert.equal(parseHex(bad), null, bad);

  // Opacity is a whole percent and comes back as the same number; 0 is no fill.
  for (let pct = 1; pct <= 100; pct++) assert.equal(fillOpacityOf(fillWith('#336699', pct)), pct, `${pct}%`);
  assert.equal(fillWith('#336699', 0), null);
  assert.equal(fillWith('#336699', 140), '#336699FF', 'clamped');
  assert.equal(fillColorOf('#33669980'), '#336699');
  assert.equal(fillColorOf(null), null);
  // Boards drawn with the old Light / Medium / Solid levels read back as plain numbers, untouched.
  assert.deepEqual(['#FF00002E', '#FF000080', '#FF0000FF', '#FF0000', null].map(fillOpacityOf), [18, 50, 100, 100, 0]);
  assert.equal(fillWith('#FF0000', 18), '#FF00002E');
  assert.equal(fillWith('#FF0000', 50), '#FF000080');

  const R = { ...box('R', 0, 0, 100, 100, 1), stroke: '#FF0000', fill: '#FF00002E' };
  const G = { ...box('G', 200, 0, 100, 100, 2), stroke: '#FF0000', fill: '#00AA0080' };
  useBoardStore.getState().hydrate({ meta, elements: [R, G], participants: [you], you, seq: 0 });
  s().setConnection('online');

  // A fill in the line's own colour keeps following it, as it always did; one with a colour of its own stays.
  s().select(['R', 'G']);
  s().restyle({ color: '#0000FF' });
  assert.equal(s().elements.R.fill, '#0000FF2E');
  assert.equal(s().elements.G.fill, '#00AA0080');

  // Colour and opacity are set apart: changing one keeps the other.
  s().select('R');
  s().restyle({ fillOpacity: 60 });
  assert.equal(s().elements.R.fill, '#0000FF99');
  s().restyle({ fillColor: '#abcdef' });
  assert.equal(s().elements.R.fill, '#ABCDEF99');
  s().restyle({ color: '#222222' });
  assert.equal(s().elements.R.fill, '#ABCDEF99', 'its own colour now: no longer follows the line');
  s().restyle({ fillColor: null });
  assert.equal(s().elements.R.fill, '#22222299', 'same as the line again');
  s().restyle({ fillOpacity: 0 });
  assert.ok(!s().elements.R.fill, '0% is no fill');
  s().restyle({ fillOpacity: 30 });
  assert.equal(s().elements.R.fill, '#2222224D', 'back from none, in the line colour');
  s().undo();
  assert.ok(!s().elements.R.fill);

  // The next shape drawn takes the configured colour and opacity; the line is its own colour.
  s().setConfig({ color: '#E5484D', fillColor: '#00FF00', fillOpacity: 25 });
  s().select(null);
  s().addShape('ellipse', { from: { x: 0, y: 0 }, to: { x: 50, y: 50 } });
  const drawn = s().visibleElements().slice(-1)[0];
  assert.deepEqual([drawn.stroke, drawn.fill], ['#E5484D', '#00FF0040']);
  s().setConfig({ fillColor: null });
  s().addShape('rectangle', { from: { x: 0, y: 0 }, to: { x: 50, y: 50 } });
  assert.equal(s().visibleElements().slice(-1)[0].fill, '#E5484D40', 'following the line colour');
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
  s().setConfig({ color: '#E5484D', width: 5, fillOpacity: 50, route: 'curved', dash: 'dashed' });
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

// --- phase 4: a figure's label wraps inside it; a line's only where typed ---
const LBL = { ...box('lbl', 0, 0, 72, 60), text: 'aaaa bbbb cccc' };
assert.deepEqual(labelLines(LBL, 10), ['aaaa bbbb', 'cccc'], 'wrapped to the box minus its padding');
assert.deepEqual(labelLines({ ...LBL, shape: 'line' }, 10), ['aaaa bbbb cccc'], 'a line label is not wrapped');

// --- phase 5: SVG export ------------------------------------------------------
const svg = toSvg([
  { ...box('s1', 0, 0, 100, 50), text: 'a < b & c', rotation: Math.PI / 2 },
  { ...box('s2', 200, 0, 60, 60), shape: 'polygon', sides: 5 },
  { ...base('s3', 3), kind: 'stroke', points: [0, 100, 50, 120, 90, 100], color: '#123456', width: 3 },
  { ...box('s4', 100, 25, 100, 0), shape: 'arrow', dash: 'dashed' },
]);
assert.match(svg, /^<svg [^>]*viewBox="-25.5 -50 310.5 195.5"/, "framed by the content (strokes included) plus padding");
assert.match(svg, /rotate\(90 50 25\)/, 'turned about its centre');
assert.ok(svg.includes('&lt;') && svg.includes('&amp;') && !svg.includes('a < b'), 'label text escaped');
assert.equal((svg.match(/<polygon points="([^"]*)"/)[1].trim().split(' ')).length, 5, 'a pentagon');
assert.match(svg, /stroke-dasharray=/, 'dashed line');
assert.match(svg, /<path d="M 0 100 C/, 'the smoothed stroke');
assert.equal(toSvg([]), null);
assert.doesNotMatch(toSvg([box('t', 0, 0, 10, 10)], { background: null }), /<rect x="-24"/, 'transparent: no ground');

// --- a board opens on its content; a reconnect leaves the camera alone -------
{
  const st = () => useBoardStore.getState();
  const onScreen = (el, { x, y, scale }) =>
    el.from.x * scale + x >= 0 && el.to.x * scale + x <= 400 && el.from.y * scale + y >= 0 && el.to.y * scale + y <= 800;
  const far = box('far', 900, 900, 100, 100);
  const join = () => st().hydrate({ meta, elements: [far], participants: [you], you, seq: 1 });

  st().reset();
  st().setViewport({ width: 400, height: 800 });
  join();
  assert.ok(onScreen(far, st().camera), 'first join frames content that is far from the origin');
  assert.equal(st().fitPending, false, 'fitted once');

  st().setCamera({ x: 5, y: 5, scale: 1 });
  join();
  assert.deepEqual(st().camera, { x: 5, y: 5, scale: 1 }, 'a reconnect does not move the camera');

  st().reset();
  st().setViewport({ width: 0, height: 0 });
  join();
  assert.equal(st().fitPending, true, 'no size yet: still waiting');
  st().setViewport({ width: 400, height: 800 });
  assert.ok(onScreen(far, st().camera), 'fitted when the canvas gets its size');

  st().reset();
  st().hydrate({ meta, elements: [], participants: [you], you, seq: 1 });
  assert.deepEqual(st().camera, st().homeCamera(), 'an empty board stays centred on the origin');
  st().reset();
}

// --- the live stroke is the committed stroke ----------------------------------
{
  const asSvg = (flat, smooth) => {
    const d = [];
    addStroke(
      {
        moveTo: (x, y) => d.push(`M ${x} ${y}`),
        lineTo: (x, y) => d.push(`L ${x} ${y}`),
        cubicTo: (...v) => d.push(`C ${v.join(' ')}`),
      },
      flat,
      smooth,
    );
    return d.join(' ');
  };
  const wobble = (n) => Array.from({ length: 2 * n }, (_, i) => Math.round((Math.sin(i * 1.7) * 90 + i * 3.3) * 1000) / 1000);
  for (const smooth of [true, false]) {
    for (const n of [0, 1, 2, 3, 4, 57]) {
      const flat = wobble(n);
      assert.equal(asSvg(flat, smooth), strokeToSvgPath(flat, smooth), `${n} points, smooth ${smooth}`);
    }
  }
}

// --- a line's label: on the line, cut into it, movable along it -------------------
{
  const line = (extra) => ({ ...base('LBL', 1), kind: 'shape', shape: 'line', from: { x: 0, y: 0 }, to: { x: 200, y: 100 }, stroke: '#000000', strokeWidth: 2, fill: null, text: 'hello', ...extra });
  const near = (a, b, msg) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6, `${msg}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  // Centred on the line, in the middle unless it was moved.
  near(lineLabelCentre(line({})), { x: 100, y: 50 }, 'the middle');
  near(lineLabelCentre(line({ labelAt: 0.25 })), { x: 50, y: 25 }, 'a quarter along');
  // An elbow is measured along its bends: 100 across, 100 down, 100 across.
  const elbowed = line({ route: 'elbow' });
  near(routePointAt(elbowed, 0.5), { x: 100, y: 50 }, 'half the length of an elbow is the middle of its middle leg');
  near(routePointAt(elbowed, 1), { x: 200, y: 100 }, 'the end');
  // Dragging finds the same place back, and stays off the very ends.
  for (const t of [0.1, 0.5, 0.9]) {
    const at = routePointAt(line({ route: 'curved' }), t);
    assert.ok(Math.abs(labelFromDrag(line({ route: 'curved' }), at) - t) < 0.02, `drag back to ${t}`);
  }
  assert.equal(labelFromDrag(line({}), { x: -500, y: -500 }), 0.04);
  assert.equal(labelFromDrag(line({}), { x: 900, y: 900 }), 0.96);
  // The gap is centred on the label, and a touch on the label hits the line.
  const box = labelBox(line({}), ['hello'], 18);
  near({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: 100, y: 50 }, 'the gap is centred on the text');
  assert.equal(shapeHit(line({}), { x: 100, y: 50 }, 4), true, 'the label is still part of the line');
  assert.equal(shapeHit(line({ text: '' }), { x: 100, y: 62 }, 4), false, 'far from a bare line');
  assert.equal(shapeHit(line({ labelAt: 0.9 }), { x: 100, y: 50 }, 4), true, 'the line itself, where the label no longer is');
}

// --- connection points on the real outline -------------------------------------
{
  const on = (p, el, msg) => {
    const b = boxOf(el);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    if (el.shape === 'ellipse') {
      const d = Math.hypot((p.x - cx) / (b.width / 2), (p.y - cy) / (b.height / 2));
      assert.ok(Math.abs(d - 1) < 1e-6, `${msg}: not on the ellipse`);
    }
  };
  const circle = { ...base('C', 1), kind: 'shape', shape: 'ellipse', from: { x: 0, y: 0 }, to: { x: 200, y: 100 }, stroke: '#000000', strokeWidth: 2, fill: null };
  const hex = { ...circle, id: 'H', shape: 'polygon', sides: 6 };
  const tri = { ...circle, id: 'T', shape: 'triangle' };
  assert.equal(anchorsOf(circle).length, 1 + 8, 'an ellipse: its centre and eight on the outline');
  assert.equal(anchorsOf(hex).length, 1 + 12, 'a hexagon: its centre, six corners and six middles');
  assert.equal(anchorsOf(tri).length, 1 + 6, 'a triangle: its centre, three corners and three middles');
  for (const p of anchorsOf(circle).slice(1)) on(p, circle, 'an ellipse anchor');
  // A line end dropped near the outline of an ellipse lands on it, not on its box.
  const r = linkEndpoints([circle], { x: 160, y: 20 }, { x: 600, y: 600 }, 18);
  on(r.from, circle, 'a free end pinned to an ellipse');
  assert.ok(r.fromLink, 'and bound to it');
  // Near one of the eight, it takes that one exactly.
  const snap = linkEndpoints([circle], { x: 100, y: 4 }, { x: 600, y: 600 }, 18);
  near2(snap.from, { x: 100, y: 0 });
  // Aimed at another shape, it leaves by the outline towards it.
  const aim = linkEndpoints([circle], { x: 100, y: 50 }, { x: 600, y: 50 }, 18);
  near2(aim.from, { x: 200, y: 50 });
  // Resize the shape: the bound end stays on the outline.
  const bound = { ...base('L2', 2), kind: 'shape', shape: 'line', from: r.from, to: { x: 600, y: 600 }, stroke: '#000000', strokeWidth: 2, fill: null, fromLink: r.fromLink, toLink: null };
  const bigger = { ...circle, to: { x: 400, y: 300 } };
  const moved = followLinks([bigger, bound], ['C'])[0].from;
  on(moved, bigger, 'an end that followed a resized ellipse');
  function near2(a, b) { assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6, `${JSON.stringify(a)} vs ${JSON.stringify(b)}`); }
}

// --- a hand-drawn polygon is read as one --------------------------------------------
{
  let seed = 11;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const noise = (a) => (rnd() - 0.5) * 2 * a;
  const drawn = (n, rot) => {
    const pts = [];
    const corner = (i) => ({ x: 100 * Math.cos(rot + (i * 2 * Math.PI) / n), y: 100 * Math.sin(rot + (i * 2 * Math.PI) / n) });
    for (let i = 0; i <= n; i++) {
      const a = corner(i);
      const b = corner(i + 1);
      for (let k = 0; k < 14; k++) pts.push(a.x + ((b.x - a.x) * k) / 14 + noise(2.5), a.y + ((b.y - a.y) * k) / 14 + noise(2.5));
    }
    return pts;
  };
  for (const n of [5, 6, 7]) {
    const sketch = recognizeSketch(drawn(n, 0.4), 24);
    assert.equal(sketch?.shape, 'polygon', `a hand-drawn ${n}-gon is a polygon`);
    assert.equal(sketch.sides, n, `with ${n} sides`);
  }
  // `drawn` puts the first corner at the angle given: a quarter turn plus a little is a square standing on its side.
  assert.equal(recognizeSketch(drawn(4, Math.PI / 4 + 0.1), 24)?.shape, 'rectangle', 'a four-sided one is still a rectangle');
  assert.equal(recognizeSketch(drawn(3, 0.3), 24)?.shape, 'triangle', 'and three a triangle');
  const lumpy = [];
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * 2 * Math.PI * 1.03;
    const r = 100 * (1 + 0.06 * Math.sin(3 * a + 1) + noise(0.02));
    lumpy.push(r * Math.cos(a), r * Math.sin(a));
  }
  assert.equal(recognizeSketch(lumpy, 24)?.shape, 'ellipse', 'a lumpy circle is still a circle');
}

// --- four corners: a rectangle, or a diamond once it is tilted enough -----------------
{
  let seed = 3;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const through = (deg) => {
    const a = (deg * Math.PI) / 180;
    const corners = [[-100, -100], [100, -100], [100, 100], [-100, 100]].map(([x, y]) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) }));
    const pts = [];
    for (let i = 0; i <= 4; i++) {
      const p = corners[i % 4];
      const q = corners[(i + 1) % 4];
      for (let k = 0; k < 14; k++) pts.push(p.x + ((q.x - p.x) * k) / 14 + (rnd() - 0.5) * 5, p.y + ((q.y - p.y) * k) / 14 + (rnd() - 0.5) * 5);
    }
    return pts;
  };
  assert.equal(recognizeSketch(through(0), 24)?.shape, 'rectangle');
  assert.equal(recognizeSketch(through(12), 24)?.shape, 'rectangle', 'slightly tilted is still a rectangle');
  const diamond = recognizeSketch(through(45), 24);
  assert.ok(diamond?.shape === 'polygon' && diamond.sides === 4, 'a square on its corner is a four-sided polygon (a diamond)');
  // A four-sided shape with a soft corner is not a triangle.
  assert.notEqual(recognizeSketch(through(45), 24)?.shape, 'triangle');
}

// --- a figure made from the pen stays, and the pen then sizes it -----------------------
{
  const near = (a, b, msg) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-9, `${msg}: ${JSON.stringify(a)}`);
  const ring = { shape: 'ellipse', from: { x: 0, y: 0 }, to: { x: 100, y: 100 } };
  // The pen was on the ring's right edge (100, 50) when it was made; pulling out to 200 doubles it about the centre.
  let r = sketchResize(ring, { x: 100, y: 50 }, { x: 150, y: 50 });
  near(r.from, { x: -50, y: -50 }, 'grown about its centre');
  near(r.to, { x: 150, y: 150 }, 'grown about its centre');
  r = sketchResize(ring, { x: 100, y: 50 }, { x: 50, y: 50 });
  near(r.from, { x: 37.5, y: 37.5 }, 'pulled in to the centre it stops at a quarter of the size');
  // A line's tip follows the pen.
  near(sketchResize({ shape: 'arrow', from: { x: 0, y: 0 }, to: { x: 50, y: 0 } }, { x: 50, y: 0 }, { x: 90, y: 30 }).to, { x: 90, y: 30 }, 'the arrow tip');
  // In the store: the figure is added at once, resizing it joins the same undo step.
  useBoardStore.getState().reset();
  useBoardStore.getState().hydrate({ meta, elements: [], participants: [you], you, seq: 0 });
  useBoardStore.getState().setConnection('online');
  const id = s().addSketch(ring);
  assert.ok(id && s().elements[id], 'the figure is on the board the moment it is made');
  const steps = s().undoStack.length;
  s().finishFigure(id, { from: { x: -50, y: -50 }, to: { x: 150, y: 150 } });
  assert.equal(s().undoStack.length, steps, 'resizing it is not another undo step');
  assert.equal(s().elements[id].to.x, 150);
  s().undo();
  assert.equal(s().visibleElements().length, 0, 'one undo takes the whole figure back');
}

// --- history, played against the real server's rules ---------------------------
// What a client does and what the server keeps must agree, or a change is on
// one screen and nowhere else. `wire` stands in for the socket and the server.
{
  const { applyOps: serverApply } = await import('../../server/src/model/ops.ts');
  const { validateOps } = await import('../../server/src/model/validate.ts');
  const server = new Map();
  let topZ = 0;
  const wire = () => {
    const batch = s().drainOutbox();
    if (!batch) return;
    const ops = validateOps(JSON.parse(JSON.stringify(batch.ops)));
    topZ = serverApply(server, ops, topZ);
    s().applyRemote(ops, 1, true);
  };
  const order = (elements) =>
    [...elements].filter((e) => !e.deleted).sort((a, b) => a.z - b.z).map((e) => e.id).join('');
  const agree = (what) => assert.equal(order(s().visibleElements()), order(server.values()), what);
  const start = () => {
    server.clear();
    topZ = 0;
    useBoardStore.getState().reset();
    useBoardStore.getState().hydrate({ meta, elements: [], participants: [you], you, seq: 0 });
    s().setConnection('online');
  };
  const draw = (id, x) => {
    const made = s().addShape('rectangle', { from: { x, y: 0 }, to: { x: x + 50, y: 50 } });
    wire();
    return made;
  };
  const named = (ids) => (el) => ids[el.id];

  // Undoing an erase puts the element back where it was in the stack, not on top.
  start();
  const [a, b, c] = [draw('a', 0), draw('b', 100), draw('c', 200)];
  const ids = { [a]: 'A', [b]: 'B', [c]: 'C' };
  const seen = () => s().visibleElements().map(named(ids)).join('');
  s().eraseAt({ x: 110, y: 10 }, 1);
  assert.equal(s().visibleElements().length, 3, 'nothing is deleted while the finger is down');
  s().commitErase();
  wire();
  assert.equal(seen(), 'AC');
  s().undo();
  wire();
  assert.equal(seen(), 'ABC', 'back in the middle');
  agree('server agrees after undoing an erase');
  s().redo();
  wire();
  s().undo();
  wire();
  assert.equal(seen(), 'ABC');
  agree('and after redo, undo');

  // One scrub over several figures is one step; cancelling deletes nothing.
  s().eraseAt({ x: 10, y: 10 }, 1);
  s().eraseAt({ x: 210, y: 10 }, 1);
  s().discardErase();
  assert.equal(s().visibleElements().length, 3, 'a cancelled scrub leaves everything');
  const steps = s().undoStack.length;
  s().eraseAt({ x: 10, y: 10 }, 1);
  s().eraseAt({ x: 210, y: 10 }, 1);
  s().commitErase();
  wire();
  assert.equal(s().undoStack.length, steps + 1, 'one undo step for the scrub');
  s().undo();
  wire();
  assert.equal(seen(), 'ABC');
  agree('server agrees after undoing a scrub');

  // Undoing a creation lets go of it: the selection never names what is gone.
  s().select([c]);
  s().undoStack.length = 0;
  const d = draw('d', 300);
  s().select([d]);
  s().undo();
  assert.deepEqual(s().selectedIds, []);
  wire();
  agree('undo of a draw');

  // A text is one undo step, however it was typed.
  start();
  const t = s().addText({ x: 0, y: 0 });
  s().updateText(t, { text: 'hello' });
  wire();
  assert.equal(s().undoStack.length, 1, 'adding and typing are one step');
  s().undo();
  wire();
  assert.equal(s().visibleElements().length, 0, 'one undo removes the whole text');
  s().redo();
  wire();
  assert.equal(s().elements[t].text, 'hello');
  assert.equal(server.get(t).text, 'hello');
  // Left empty, it never happened: no element and nothing to undo.
  const e = s().addText({ x: 0, y: 40 });
  s().updateText(e, { text: '   ' });
  wire();
  assert.equal(s().undoStack.length, 1, 'an empty text leaves no step');
  assert.equal(s().visibleElements().length, 1);
  // Editing the text again is a step of its own.
  s().updateText(t, { text: 'bye' });
  assert.equal(s().undoStack.length, 2);
  wire();

  // A batch the server refuses must not stay applied on this screen.
  start();
  const q = draw('q', 0);
  s().commitEdit({ ids: [q], mode: 'move', handle: -1, start: { x: 0, y: 0 }, dx: 500, dy: 0, patch: null });
  // The server never sees it (say it was rejected): the board it sends back wins.
  s().drainOutbox();
  assert.equal(s().elements[q].from.x, 500);
  s().resync([...server.values()], 2);
  assert.equal(s().elements[q].from.x, 0, 'snapped back to what the server has');
  assert.equal(s().undoStack.length, 0, 'history describing it is dropped');

  // Ops waiting when the connection dropped survive the reconnect's hydrate.
  start();
  const r = draw('r', 0);
  s().commitEdit({ ids: [r], mode: 'move', handle: -1, start: { x: 0, y: 0 }, dx: 70, dy: 0, patch: null });
  const pending = s().outbox;
  assert.equal(pending.length, 1);
  hydrateKeeping({ meta, elements: [...server.values()], participants: [you], you, seq: 3 });
  assert.equal(s().elements[r].from.x, 70, 'still where it was dragged');
  assert.notEqual(s().outbox, pending, 'a fresh array, so the sync hook sends it');
  wire();
  assert.equal(server.get(r).from.x, 70, 'and the server has it');
  start();
}

console.log('geometry: ok');
