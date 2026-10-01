/**
 * Writes `bench-board.json`: a board of 500 hand-drawn strokes, 200 shapes
 * (some labelled, some rotated) and 30 texts, in a fixed pattern — the same
 * load every time, for comparing frame rates before and after a change.
 * Import it from the app (menu → Import) and read the perf HUD while panning,
 * pinching, drawing, dragging a selection and erasing.
 *
 *   node test/bench-board.mjs [out.json]
 */
import { writeFileSync } from 'node:fs';

// A tiny seeded generator so the board is identical on every run.
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const COLORS = ['#1B2030', '#E5484D', '#30A46C', '#208AEF', '#8E4EC6', '#F76808'];

const elements = [];
let z = 0;
const base = (id) => ({ id, createdBy: 'bench', createdAt: 0, updatedAt: 0, z: ++z });

for (let i = 0; i < 500; i++) {
  // A wobbly stroke of 30–120 points, the length a real one has.
  const n = 30 + Math.floor(rnd() * 90);
  let x = rnd() * 4000 - 2000;
  let y = rnd() * 3000 - 1500;
  let a = rnd() * Math.PI * 2;
  const points = [];
  for (let k = 0; k < n; k++) {
    a += (rnd() - 0.5) * 0.6;
    x += Math.cos(a) * 6;
    y += Math.sin(a) * 6;
    points.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  }
  elements.push({ ...base(`s${i}`), kind: 'stroke', points, color: pick(COLORS), width: pick([2, 4, 6]) });
}
for (let i = 0; i < 200; i++) {
  const x = rnd() * 4000 - 2000;
  const y = rnd() * 3000 - 1500;
  const shape = pick(['rectangle', 'ellipse', 'triangle', 'polygon', 'arrow']);
  const line = shape === 'arrow';
  elements.push({
    ...base(`h${i}`),
    kind: 'shape',
    shape,
    from: { x, y },
    to: { x: x + 60 + rnd() * 160, y: y + (line ? 0 : 40 + rnd() * 120) },
    stroke: pick(COLORS),
    strokeWidth: 3,
    fill: line ? null : `${pick(COLORS)}2E`,
    ...(shape === 'polygon' ? { sides: 6 } : null),
    ...(!line && i % 3 === 0 ? { text: `Box ${i}`, fontSize: 18 } : null),
    ...(!line && i % 5 === 0 ? { rotation: rnd() } : null),
  });
}
for (let i = 0; i < 30; i++) {
  elements.push({
    ...base(`t${i}`),
    kind: 'text',
    at: { x: rnd() * 4000 - 2000, y: rnd() * 3000 - 1500 },
    text: `Note ${i}\nsecond line`,
    color: pick(COLORS),
    fontSize: 24,
    bold: i % 2 === 0,
    italic: false,
  });
}

const out = process.argv[2] ?? 'bench-board.json';
writeFileSync(
  out,
  JSON.stringify({ format: 'live-whiteboard', version: 1, meta: { name: 'Bench board' }, elements, exportedAt: 0 }),
);
console.log(`${elements.length} elements -> ${out}`);
