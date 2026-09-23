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
  Record<'title' | 'research' | 'design' | 'build' | 'launch' | 'note' | 'sticky', string>
> = {
  es: {
    title: 'Hoja de ruta',
    research: 'Investigar',
    design: 'Diseñar',
    build: 'Construir',
    launch: 'Lanzar 🚀',
    note: '¡Ideas bienvenidas!',
    sticky: '¿v2?',
  },
  en: {
    title: 'Product roadmap',
    research: 'Research',
    design: 'Design',
    build: 'Build',
    launch: 'Launch 🚀',
    note: 'Ideas welcome!',
    sticky: 'v2?',
  },
};

const INK = '#1B2030';
const base = (id: string, z: number) => ({ id, z, createdBy: 'demo', createdAt: 0, updatedAt: 0 });
const box = (
  id: string,
  z: number,
  shape: 'rectangle' | 'ellipse' | 'triangle',
  from: Point,
  to: Point,
  color: string,
  text?: string,
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

/** A loose hand-drawn loop around `c`: what a quick circle with a finger looks like. */
function scribble(c: Point, r: number): number[] {
  const points: number[] = [];
  for (let a = 0; a <= Math.PI * 2.15; a += 0.18) {
    const wobble = 1 + 0.08 * Math.sin(a * 3);
    points.push(c.x + Math.cos(a) * r * 1.3 * wobble, c.y + Math.sin(a) * r * wobble);
  }
  return points;
}

export function demoElements(lang: Lang): BoardElement[] {
  const w = WORDS[lang];
  const research = box(
    'd-research',
    3,
    'rectangle',
    { x: -620, y: -200 },
    { x: -420, y: -100 },
    '#F76808',
    w.research,
  );
  const design = box(
    'd-design',
    4,
    'rectangle',
    { x: -620, y: 20 },
    { x: -420, y: 120 },
    '#30A46C',
    w.design,
  );
  const build = box(
    'd-build',
    5,
    'rectangle',
    { x: 400, y: 20 },
    { x: 620, y: 130 },
    '#0091FF',
    w.build,
  );
  const launch = box(
    'd-launch',
    6,
    'ellipse',
    { x: 420, y: -230 },
    { x: 620, y: -110 },
    '#8E4EC6',
    w.launch,
  );
  return [
    {
      ...base('d-title', 1),
      kind: 'text',
      at: { x: -620, y: -320 },
      text: w.title,
      color: INK,
      fontSize: 30,
      bold: true,
    },
    {
      ...base('d-underline', 2),
      kind: 'stroke',
      color: '#E5484D',
      width: 4,
      points: [-620, -270, -540, -266, -460, -271, -380, -265],
    },
    research,
    design,
    build,
    launch,
    {
      ...base('d-a1', 7),
      kind: 'shape',
      shape: 'arrow',
      from: { x: -520, y: -100 },
      to: { x: -520, y: 20 },
      stroke: INK,
      strokeWidth: 2,
      fromLink: { id: research.id, u: 0.5, v: 1 },
      toLink: { id: design.id, u: 0.5, v: 0 },
    },
    {
      ...base('d-a2', 8),
      kind: 'shape',
      shape: 'arrow',
      from: { x: -420, y: 70 },
      to: { x: 400, y: 75 },
      stroke: INK,
      strokeWidth: 2,
      route: 'curved',
      dash: 'dashed',
      fromLink: { id: design.id, u: 1, v: 0.5 },
      toLink: { id: build.id, u: 0, v: 0.5 },
    },
    {
      ...base('d-a3', 9),
      kind: 'shape',
      shape: 'arrow',
      from: { x: 510, y: 20 },
      to: { x: 520, y: -110 },
      stroke: INK,
      strokeWidth: 2,
      fromLink: { id: build.id, u: 0.5, v: 0 },
      toLink: { id: launch.id, u: 0.5, v: 1 },
    },
    box('d-sticky', 10, 'rectangle', { x: 240, y: 230 }, { x: 370, y: 340 }, '#FFB224', w.sticky),
    box('d-tri', 11, 'triangle', { x: -330, y: 240 }, { x: -220, y: 340 }, '#FF8FAB'),
    {
      ...base('d-note', 12),
      kind: 'text',
      at: { x: 420, y: 190 },
      text: w.note,
      color: INK,
      fontSize: 20,
      italic: true,
    },
    {
      ...base('d-loop', 13),
      kind: 'stroke',
      color: '#E5484D',
      width: 3,
      points: scribble({ x: 305, y: 285 }, 70),
    },
    {
      ...base('d-check', 14),
      kind: 'stroke',
      color: '#30A46C',
      width: 5,
      points: [-600, 250, -570, 285, -500, 200],
    },
  ];
}

/** The collaborators "working" on the demo, each drifting around its own corner. */
const PEERS = [
  {
    userId: 'demo-ana',
    nickname: 'Ana',
    color: '#30A46C',
    avatar: '🐸',
    center: { x: -470, y: -40 },
    r: { x: 130, y: 110 },
  },
  {
    userId: 'demo-leo',
    nickname: 'Leo',
    color: '#8E4EC6',
    avatar: '🐙',
    center: { x: 480, y: 0 },
    r: { x: 110, y: 150 },
  },
  {
    userId: 'demo-mia',
    nickname: 'Mía',
    color: '#E5484D',
    avatar: '🦊',
    center: { x: 0, y: 280 },
    r: { x: 260, y: 40 },
  },
] as const;

/** Where peer `i` is at time `t` (seconds): a slow, lazy figure-eight. */
export function demoCursor(i: number, t: number): Point {
  const p = PEERS[i];
  const a = t * 0.45 + i * 2.1;
  return { x: p.center.x + Math.cos(a) * p.r.x, y: p.center.y + Math.sin(a * 2) * p.r.y * 0.6 };
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
