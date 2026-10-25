/**
 * Ready-made starts for a class activity: brainstorm, retro, flowchart, Kanban
 * and mind map. Each is a handful of ordinary elements around (0, 0), dropped
 * on the board through `paste` — fresh ids, centred on the screen, one undo.
 * Columns and backgrounds come locked, so the notes on them move and the
 * board under them stays put.
 *
 * Same file in web (`src/features/templates.ts`): keep the two alike.
 */
import { STICKY_INK, StickyColors } from '@/constants/theme';
import type { Strings } from '@/features/i18n/strings';

import type { BoardElement, Link, Point, ShapeElement, ShapeKind } from './model';
import { STICKY_SIZE, STICKY_TEXT_SIZE, contentBounds } from './geometry';

export type TemplateKey = 'brainstorm' | 'retro' | 'flowchart' | 'kanban' | 'mindmap';

export const TEMPLATES: { key: TemplateKey; label: keyof Strings }[] = [
  { key: 'brainstorm', label: 'tplBrainstorm' },
  { key: 'retro', label: 'tplRetro' },
  { key: 'flowchart', label: 'tplFlowchart' },
  { key: 'kanban', label: 'tplKanban' },
  { key: 'mindmap', label: 'tplMindmap' },
];

/**
 * Where a template's centre goes: the middle of the screen, or — when
 * something is already drawn there — just right of everything on the board,
 * so it never lands on top of the class's notes.
 */
export function templateSpot(template: BoardElement[], board: BoardElement[], centre: Point): Point {
  const t = contentBounds(template);
  const b = contentBounds(board);
  if (!t || !b) return centre;
  const left = centre.x - t.width / 2;
  const top = centre.y - t.height / 2;
  const clear = left > b.x + b.width || left + t.width < b.x || top > b.y + b.height || top + t.height < b.y;
  return clear ? centre : { x: b.x + b.width + 120 + t.width / 2, y: b.y + b.height / 2 };
}

/** A soft grey that reads on the light and the dark board alike. */
const LINE = '#8E99AB';
const WASH = '#8E99AB1F';
const INK = '#1B2030';

let n = 0;
const base = () => ({ id: `tpl${++n}`, createdBy: 'template', createdAt: 0, updatedAt: 0, z: 0 });

function shape(kind: ShapeKind, from: Point, to: Point, extra: Partial<ShapeElement> = {}): ShapeElement {
  return { ...base(), kind: 'shape', shape: kind, from, to, stroke: INK, strokeWidth: 2, fill: null, ...extra };
}

/** A locked column or background with its title along the top. */
const column = (x: number, y: number, w: number, h: number, title: string) =>
  shape('rectangle', { x, y }, { x: x + w, y: y + h }, {
    stroke: LINE,
    fill: WASH,
    rounded: true,
    text: title,
    fontSize: 28,
    valign: 'top',
    locked: true,
  });

const sticky = (cx: number, cy: number, text: string, paper = 0) =>
  shape('rectangle', { x: cx - STICKY_SIZE / 2, y: cy - STICKY_SIZE / 2 }, { x: cx + STICKY_SIZE / 2, y: cy + STICKY_SIZE / 2 }, {
    sticky: true,
    stroke: STICKY_INK,
    strokeWidth: 1,
    fill: StickyColors[paper % StickyColors.length],
    text,
    fontSize: STICKY_TEXT_SIZE,
  });

/** An arrow from one figure's side to another's, bound at both ends so it follows them. */
function arrow(a: ShapeElement, au: Point, b: ShapeElement, bu: Point, extra: Partial<ShapeElement> = {}): ShapeElement {
  const at = (el: ShapeElement, u: Point) => ({
    x: el.from.x + (el.to.x - el.from.x) * u.x,
    y: el.from.y + (el.to.y - el.from.y) * u.y,
  });
  const link = (el: ShapeElement, u: Point): Link => ({ id: el.id, u: u.x, v: u.y });
  return shape('arrow', at(a, au), at(b, bu), { headEnd: 'arrow', fromLink: link(a, au), toLink: link(b, bu), ...extra });
}

const TOP = { x: 0.5, y: 0 };
const BOTTOM = { x: 0.5, y: 1 };
const LEFT = { x: 0, y: 0.5 };
const RIGHT = { x: 1, y: 0.5 };

/** The template's elements, its words in the board's language. */
export function templateElements(key: TemplateKey, t: Strings): BoardElement[] {
  switch (key) {
    case 'brainstorm': {
      const ideas = [
        [-320, -170],
        [320, -170],
        [-320, 170],
        [320, 170],
      ].map(([x, y], i) => sticky(x, y, t.tplIdea, i + 1));
      return [column(-560, -380, 1120, 760, t.tplBrainstorm), sticky(0, 0, t.tplTopic, 0), ...ideas];
    }
    case 'retro':
    case 'kanban': {
      const titles =
        key === 'retro' ? [t.tplWentWell, t.tplToImprove, t.tplActions] : [t.tplTodo, t.tplDoing, t.tplDone];
      const w = 360;
      const gap = 40;
      const left = -(3 * w + 2 * gap) / 2;
      const cols = titles.map((title, i) => column(left + i * (w + gap), -400, w, 800, title));
      const first = key === 'retro' ? titles.map((_, i) => sticky(left + i * (w + gap) + w / 2, -160, '', [4, 1, 2][i])) : [sticky(left + w / 2, -160, t.tplTask, 0)];
      return [...cols, ...first];
    }
    case 'flowchart': {
      const start = shape('ellipse', { x: -110, y: -430 }, { x: 110, y: -330 }, { text: t.tplStart });
      const step = shape('rectangle', { x: -130, y: -230 }, { x: 130, y: -110 }, { text: t.tplStep, rounded: true });
      const ask = shape('polygon', { x: -150, y: -10 }, { x: 150, y: 170 }, {
        text: t.tplQuestion,
        sides: 4,
        vertices: [
          { x: 0.5, y: 0 },
          { x: 1, y: 0.5 },
          { x: 0.5, y: 1 },
          { x: 0, y: 0.5 },
        ],
      });
      const end = shape('ellipse', { x: -110, y: 270 }, { x: 110, y: 370 }, { text: t.tplEnd });
      const back = shape('rectangle', { x: 300, y: 20 }, { x: 560, y: 140 }, { text: t.tplStep, rounded: true });
      return [
        start,
        step,
        ask,
        end,
        back,
        arrow(start, BOTTOM, step, TOP),
        arrow(step, BOTTOM, ask, TOP),
        arrow(ask, BOTTOM, end, TOP),
        arrow(ask, RIGHT, back, LEFT),
      ];
    }
    case 'mindmap': {
      const centre = shape('ellipse', { x: -150, y: -70 }, { x: 150, y: 70 }, { text: t.tplCentral, fontSize: 24 });
      const spots: [number, number, Point, Point][] = [
        [-520, -260, RIGHT, LEFT],
        [520, -260, LEFT, RIGHT],
        [-520, 260, RIGHT, LEFT],
        [520, 260, LEFT, RIGHT],
      ];
      return spots.flatMap(([x, y, from, to], i) => {
        const branch = shape('rectangle', { x: x - 120, y: y - 50 }, { x: x + 120, y: y + 50 }, {
          text: t.tplBranch,
          rounded: true,
          fill: StickyColors[i + 1],
        });
        // From the branch's inner side to the centre's outer side.
        return [branch, arrow(branch, from, centre, to, { route: 'curved', headEnd: 'none' })];
      }).concat(centre);
    }
  }
}
