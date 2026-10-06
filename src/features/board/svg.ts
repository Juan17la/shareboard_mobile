/**
 * The board as an SVG document: vector, so it stays sharp at any size and
 * opens in any browser or design tool. Built from the same geometry the canvas
 * paints with — routes, markers, polygons, wrapped labels, rotation — so the
 * file matches the board. Same code as web's `lib/svg.ts`.
 */
import { SHAPE_TEXT_SIZE, type BoardElement, type FontKey, type ShapeElement } from './model';
import {
  boxOf,
  contentBounds,
  dashIntervals,
  endAngles,
  headsOf,
  labelBox,
  labelLines,
  labelPlacement,
  textAnchor,
  markerPaths,
  shapeCorners,
  cornerRadius,
  roundedPolygonPath,
  rotationOf,
  routePath,
  shapeBounds,
  strokeToSvgPath,
  textLines,
  TEXT_LINE_HEIGHT,
} from './geometry';

/** The CSS family of each board typeface, with fallbacks. */
export const FONT_FAMILIES: Record<FontKey, string> = {
  sans: 'Nunito, system-ui, sans-serif',
  serif: 'Lora, Georgia, serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  hand: 'Caveat, "Comic Sans MS", cursive',
};

/** The typefaces, fetched by whatever opens the file (a viewer offline falls back). */
const FONT_CSS =
  "@import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,500;0,800;1,400;1,800&family=Lora:ital,wght@0,500;0,700;1,500;1,700&family=JetBrains+Mono:ital,wght@0,500;0,700;1,500;1,700&family=Caveat:wght@500;700&display=swap');";

/** A marker's size grows with the stroke, and never below a fingertip's worth. */
export const markerSize = (width: number) => Math.max(10, width * 3);

const r = (v: number) => Math.round(v * 100) / 100;
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * `elements` framed by their bounds plus `padding`. `background` null leaves
 * the document transparent. Null when there is nothing to draw.
 */
export function toSvg(
  elements: BoardElement[],
  { padding = 24, background = '#FFFFFF' as string | null } = {},
): string | null {
  const b = contentBounds(elements);
  if (!b) return null;
  const x = r(b.x - padding);
  const y = r(b.y - padding);
  const w = r(b.width + padding * 2);
  const h = r(b.height + padding * 2);
  const ground = background ?? '#FFFFFF';
  const body = elements.map((el) => faded(el, turned(el, elementSvg(el, ground)))).join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">`,
    `<style>${FONT_CSS}</style>`,
    background ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${background}"/>` : '',
    body,
    '</svg>',
    '',
  ].join('\n');
}

const ANCHOR = { left: 'start', center: 'middle', right: 'end' } as const;

/** Wraps a translucent element in its opacity. */
function faded(el: BoardElement, inner: string): string {
  return el.opacity != null && el.opacity < 1 ? `<g opacity="${r(el.opacity)}">${inner}</g>` : inner;
}

/** Wraps a turned element in a rotation about the centre of its box. */
function turned(el: BoardElement, inner: string): string {
  const angle = rotationOf(el);
  if (!angle) return inner;
  const b = boxOf(el);
  return `<g transform="rotate(${r((angle * 180) / Math.PI)} ${r(b.x + b.width / 2)} ${r(b.y + b.height / 2)})">${inner}</g>`;
}

function elementSvg(el: BoardElement, ground: string): string {
  switch (el.kind) {
    case 'stroke':
      return `<path d="${strokeToSvgPath(el.points)}" fill="none" stroke="${el.color}" stroke-width="${el.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'shape':
      return shapeSvg(el, ground) + labelSvg(el);
    case 'text': {
      const step = el.fontSize * TEXT_LINE_HEIGHT;
      const { x, align } = textAnchor(el);
      return textLines(el)
        .map(
          (line, i) =>
            `<text x="${r(x)}" text-anchor="${ANCHOR[align]}" y="${r(el.at.y + el.fontSize + i * step)}" ${fontAttrs(el.font, el.fontSize, !!el.bold, !!el.italic)}${el.underline ? ' text-decoration="underline"' : ''} fill="${el.color}">${esc(line)}</text>`,
        )
        .join('');
    }
    case 'image':
      return `<image href="${esc(el.uri)}" x="${r(el.at.x)}" y="${r(el.at.y)}" width="${r(el.width)}" height="${r(el.height)}" preserveAspectRatio="none"/>`;
  }
}

function fontAttrs(font: FontKey | undefined, size: number, bold: boolean, italic: boolean): string {
  return `font-family='${FONT_FAMILIES[font ?? 'sans']}' font-size="${size}" font-weight="${bold ? 800 : 500}"${italic ? ' font-style="italic"' : ''} xml:space="preserve"`;
}

function shapeSvg(el: ShapeElement, ground: string): string {
  const { x, y, width: w, height: h } = shapeBounds(el);
  const outline = dashIntervals(el.dash, el.strokeWidth);
  const paint = `fill="${el.fill ?? 'none'}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round"${outline ? ` stroke-linecap="round" stroke-dasharray="${outline.join(' ')}"` : ''}`;
  if (el.shape === 'rectangle') {
    const rx = el.rounded ? cornerRadius(w, h) : 0;
    return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${r(rx)}" ${paint}/>`;
  }
  if (el.shape === 'ellipse') {
    return `<ellipse cx="${r(x + w / 2)}" cy="${r(y + h / 2)}" rx="${r(w / 2)}" ry="${r(h / 2)}" ${paint}/>`;
  }
  if (el.shape === 'triangle' || el.shape === 'polygon') {
    const pts = shapeCorners(el);
    if (el.rounded) return `<path d="${roundedPolygonPath(pts, cornerRadius(w, h))}" ${paint}/>`;
    return `<polygon points="${pts.map((p) => `${r(p.x)},${r(p.y)}`).join(' ')}" ${paint}/>`;
  }
  // line / arrow: the route, dashed if asked, then a marker at each end.
  const dash = dashIntervals(el.dash, el.strokeWidth);
  // The line is cut away behind its label: a clip that is everything but the label's box.
  const size0 = el.fontSize ?? SHAPE_TEXT_SIZE;
  const gap = el.text ? labelBox(el, labelLines(el, size0), size0) : null;
  const cut = gap
    ? `<clipPath id="gap-${el.id}"><path clip-rule="evenodd" d="M-10000000 -10000000H10000000V10000000H-10000000Z M${r(gap.x)} ${r(gap.y)}h${r(gap.width)}v${r(gap.height)}h${r(-gap.width)}Z"/></clipPath>`
    : '';
  const route = `${cut}<path d="${routePath(el)}" fill="none" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash.join(' ')}"` : ''}${gap ? ` clip-path="url(#gap-${el.id})"` : ''}/>`;
  const [headStart, headEnd] = headsOf(el);
  const angles = endAngles(el);
  const size = markerSize(el.strokeWidth);
  const markers = (
    [
      [headStart, el.from, angles.start],
      [headEnd, el.to, angles.end],
    ] as const
  )
    .flatMap(([kind, tip, angle]) => markerPaths(kind, tip, angle, size))
    .map(
      (part) =>
        `<path d="${part.d}" fill="${part.fill === 'solid' ? el.stroke : part.fill === 'hollow' ? ground : 'none'}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="miter"/>`,
    )
    .join('');
  return route + markers;
}

/** A figure's label: centred in its box (wrapped inside it), or just above a line's midpoint. */
function labelSvg(el: ShapeElement): string {
  if (!el.text) return '';
  const fontSize = el.fontSize ?? SHAPE_TEXT_SIZE;
  const step = fontSize * TEXT_LINE_HEIGHT;
  const lines = labelLines(el, fontSize);
  const at = labelPlacement(el, fontSize, lines.length);
  return lines
    .map(
      (line, i) =>
        `<text x="${r(at.x)}" y="${r(at.y + i * step)}" text-anchor="${ANCHOR[at.align]}" dominant-baseline="central" ${fontAttrs(el.font, fontSize, false, false)} fill="${el.stroke}">${esc(line)}</text>`,
    )
    .join('');
}
