/**
 * A made-up board for the home screen to sit on.
 *
 * Home is one step away from a board, so its background *is* one: the real
 * canvas, header and tool rail, fed this hardcoded content through the board
 * store and blurred behind the card. Nothing here reaches a server: there is
 * no socket, and the whole layer takes no touches.
 *
 * Home stays mounted under the board screen, so the demo only lives in the
 * store while home is focused — and is only ever cleared by itself, never on
 * top of a real board that has already arrived.
 *
 * Kept in step with the web app's `features/demo-board.ts`.
 */
import { useEffect } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import type { BoardElement, Participant, Point, ShapeElement } from '@/features/board/model';
import { contentBounds } from '@/features/board/geometry';
import { MIN_ZOOM, fillFor, useBoardStore } from '@/features/board/store';
import type { Lang } from '@/features/i18n/strings';
import { useSessionStore } from '@/features/session/store';

const WORDS: Record<
  Lang,
  Record<'title' | 'idea' | 'sketch' | 'review' | 'done' | 'n1' | 'n2' | 'n3', string>
> = {
  es: {
    title: 'Cómo funciona',
    idea: 'Idea',
    sketch: 'Boceto',
    review: 'Revisión',
    done: 'Listo ✓',
    n1: 'Dibuja y escribe lo que piensas',
    n2: 'Tu equipo entra con un código',
    n3: 'Comentan en vivo y lo cierran',
  },
  en: {
    title: 'How it works',
    idea: 'Idea',
    sketch: 'Sketch',
    review: 'Review',
    done: 'Done ✓',
    n1: 'Draw and write what you think',
    n2: 'Your team joins with a code',
    n3: 'They comment live and wrap it up',
  },
};

const INK = '#1B2030';
/** Notes are a quiet grey that reads on both boards (`inkFor` only flips the ink). */
const NOTE = '#8E8E93';
const base = (id: string, z: number) => ({ id, z, createdBy: 'demo', createdAt: 0, updatedAt: 0 });
const node = (
  id: string,
  z: number,
  shape: 'rectangle' | 'ellipse',
  from: Point,
  to: Point,
  color: string,
  text: string,
): ShapeElement => ({
  ...base(id, z),
  kind: 'shape',
  shape,
  from,
  to,
  stroke: color,
  strokeWidth: 2.5,
  fill: fillFor(color, 'low'),
  text,
});
/** An arrow bound to a point (u, v) of each shape's box. */
const arrow = (
  id: string,
  z: number,
  a: ShapeElement,
  from: [number, number],
  b: ShapeElement,
  to: [number, number],
  extra: Partial<ShapeElement> = {},
): ShapeElement => {
  const at = (s: ShapeElement, [u, v]: [number, number]) => ({
    x: s.from.x + (s.to.x - s.from.x) * u,
    y: s.from.y + (s.to.y - s.from.y) * v,
  });
  return {
    ...base(id, z),
    kind: 'shape',
    shape: 'arrow',
    from: at(a, from),
    to: at(b, to),
    stroke: INK,
    strokeWidth: 2,
    fromLink: { id: a.id, u: from[0], v: from[1] },
    toLink: { id: b.id, u: to[0], v: to[1] },
    ...extra,
  };
};
const note = (id: string, z: number, at: Point, text: string): BoardElement => ({
  ...base(id, z),
  kind: 'text',
  at,
  text,
  color: NOTE,
  fontSize: 17,
  italic: true,
});

/**
 * A four-step flow down the left and up the right, one short note per step:
 * the card sits in the middle, so the diagram lives around it.
 */
export function demoElements(lang: Lang): BoardElement[] {
  const w = WORDS[lang];
  const idea = node(
    'd-idea',
    2,
    'ellipse',
    { x: -620, y: -210 },
    { x: -470, y: -130 },
    '#8E4EC6',
    w.idea,
  );
  const sketch = node(
    'd-sketch',
    3,
    'rectangle',
    { x: -620, y: 20 },
    { x: -470, y: 100 },
    '#0091FF',
    w.sketch,
  );
  const review = node(
    'd-review',
    4,
    'rectangle',
    { x: 450, y: 20 },
    { x: 610, y: 100 },
    '#F76808',
    w.review,
  );
  const done = node(
    'd-done',
    5,
    'ellipse',
    { x: 450, y: -210 },
    { x: 610, y: -130 },
    '#30A46C',
    w.done,
  );
  return [
    {
      ...base('d-title', 1),
      kind: 'text',
      at: { x: -620, y: -320 },
      text: w.title,
      color: INK,
      fontSize: 28,
      bold: true,
    },
    idea,
    sketch,
    review,
    done,
    arrow('d-a1', 6, idea, [0.5, 1], sketch, [0.5, 0]),
    arrow('d-a2', 7, sketch, [1, 0.5], review, [0, 0.5], { dash: 'dashed' }),
    arrow('d-a3', 8, review, [0.5, 0], done, [0.5, 1]),
    note('d-n1', 9, { x: -525, y: -70 }, w.n1),
    note('d-n2', 10, { x: -620, y: 150 }, w.n2),
    note('d-n3', 11, { x: 350, y: 150 }, w.n3),
  ];
}

/**
 * The two collaborators. Each walks a loop of stops near the diagram, resting
 * at every one: people point at something, read, then move on.
 */
const PEERS = [
  {
    userId: 'demo-ana',
    nickname: 'Ana',
    color: '#30A46C',
    avatar: '🐸',
    stops: [
      { x: -540, y: -165, rest: 3.2 },
      { x: -470, y: -60, rest: 2.4 },
      { x: -560, y: 70, rest: 4 },
      { x: -600, y: 160, rest: 2.6 },
    ],
  },
  {
    userId: 'demo-leo',
    nickname: 'Leo',
    color: '#8E4EC6',
    avatar: '🐙',
    stops: [
      { x: 520, y: 70, rest: 3.6 },
      { x: 420, y: 165, rest: 2.8 },
      { x: 540, y: -165, rest: 4.4 },
      { x: 600, y: -40, rest: 2.2 },
    ],
  },
] as const;

/** Board units per second: an unhurried hand. */
const SPEED = 140;
const ease = (s: number) => (s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2);

/**
 * Where peer `i` is at time `t` (seconds). A move eases out and in along a
 * slight arc, like a wrist turning; a faint drift rides on top the whole time,
 * like a hand that is never quite still. Pure and continuous, so the loop
 * repeats seamlessly.
 */
export function demoCursor(i: number, t: number): Point {
  const stops = PEERS[i].stops;
  const legs = stops.map((to, k) => {
    const from = stops[(k + stops.length - 1) % stops.length];
    const move = Math.max(1.2, Math.hypot(to.x - from.x, to.y - from.y) / SPEED);
    return { from, to, move, span: move + to.rest };
  });
  const loop = legs.reduce((sum, l) => sum + l.span, 0);
  const drift = { x: Math.sin(t * 0.9) * 2.5, y: Math.cos(t * 0.7) * 2 };
  let tt = (((t + i * 3.7) % loop) + loop) % loop;
  for (const [k, l] of legs.entries()) {
    if (tt >= l.span) {
      tt -= l.span;
      continue;
    }
    const s = tt < l.move ? ease(tt / l.move) : 1;
    const dx = l.to.x - l.from.x;
    const dy = l.to.y - l.from.y;
    // The arc bows sideways by a tenth of the distance, alternating sides.
    const bow = (k % 2 ? 0.1 : -0.1) * 4 * s * (1 - s);
    return {
      x: l.from.x + dx * s - dy * bow + drift.x,
      y: l.from.y + dy * s + dx * bow + drift.y,
    };
  }
  return stops[0];
}

const DEMO_ID = 'demo';

function hydrateDemo(lang: Lang) {
  const { userId, nickname, nickColor, avatar } = useSessionStore.getState();
  const now = Date.now();
  const you: Participant = {
    userId,
    nickname: nickname || '·',
    color: nickColor,
    avatar: avatar || undefined,
    role: 'creator',
    lastSeen: now,
  };
  const store = useBoardStore.getState();
  store.hydrate({
    meta: {
      id: DEMO_ID,
      shortCode: 'K7Q2MX',
      name: WORDS[lang].title,
      access: 'public',
      editPolicy: 'everyone',
      editors: [],
      creatorId: userId,
      hasPin: false,
      createdAt: now,
      updatedAt: now,
    },
    elements: demoElements(lang),
    participants: [
      you,
      ...PEERS.map((p, i) => ({
        userId: p.userId,
        nickname: p.nickname,
        color: p.color,
        avatar: p.avatar,
        role: 'editor' as const,
        lastSeen: now,
        cursor: demoCursor(i, 0),
      })),
    ],
    you,
    seq: 0,
  });
  // Shown as live (a green dot, not "connecting…"): the layer takes no
  // touches, so no edit can come from it anyway.
  store.setConnection('online');
  fitDemo();
}

/** The whole demo framed, whatever the screen. */
function fitDemo() {
  const s = useBoardStore.getState();
  const b = contentBounds(s.visibleElements());
  const { width, height } = s.viewport;
  if (!b || !width || !height) return;
  const pad = 24;
  const scale = Math.max(
    MIN_ZOOM,
    Math.min((width - pad * 2) / b.width, (height - pad * 2) / b.height, 1),
  );
  s.setCamera({
    scale,
    x: (width - b.width * scale) / 2 - b.x * scale,
    y: (height - b.height * scale) / 2 - b.y * scale,
  });
}

/**
 * Puts the demo board in the store while mounted (home mounts it only while
 * focused), with the peers' cursors drifting.
 */
export function useDemoBoard() {
  const lang = useSessionStore((s) => s.lang);
  const still = useReducedMotion();

  useEffect(() => {
    hydrateDemo(lang);
    const unsubscribe = useBoardStore.subscribe((s, prev) => {
      // The board screen underneath resets the store as it unmounts — which,
      // on the way back, can land after home is already showing the demo.
      if (s.boardId === null) hydrateDemo(lang);
      else if (s.viewport !== prev.viewport || s.cameraPlaced !== prev.cameraPlaced) fitDemo();
    });

    const start = Date.now();
    const timer = still
      ? undefined
      : setInterval(() => {
          const t = (Date.now() - start) / 1000;
          PEERS.forEach((p, i) =>
            useBoardStore.getState().setRemoteCursor(p.userId, demoCursor(i, t)),
          );
        }, 50);

    return () => {
      unsubscribe();
      clearInterval(timer);
      // Only the demo is ours to clear: a real board may already be loaded.
      if (useBoardStore.getState().boardId === DEMO_ID) useBoardStore.getState().reset();
    };
  }, [lang, still]);
}
