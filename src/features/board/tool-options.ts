/**
 * Which options of the strip a tool shows up front. Everything else it offers
 * waits behind "More", so a new user meets a handful of controls, not all of
 * them. Data, not JSX: this is the one place that says what is primary.
 * Same file as web's `lib/tool-options.ts`.
 */
import type { BoardElement, ShapeKind } from './model';

export type OptionId =
  | 'kinds'
  | 'color'
  | 'size'
  | 'fill'
  | 'dash'
  | 'opacity'
  | 'corners'
  | 'sides'
  | 'ends'
  | 'route'
  | 'text'
  | 'align';

/** What is being styled: a tool in hand, or a kind of selected element. */
export type OptionSubject = 'pen' | 'eraser' | 'text' | ShapeKind;

export const TOOL_OPTIONS: Record<OptionSubject, readonly OptionId[]> = {
  pen: ['color', 'size'],
  eraser: ['size'],
  text: ['color', 'text', 'align'],
  rectangle: ['kinds', 'color', 'fill', 'size'],
  ellipse: ['kinds', 'color', 'fill', 'size'],
  triangle: ['kinds', 'color', 'fill', 'size'],
  polygon: ['kinds', 'color', 'fill', 'sides'],
  line: ['kinds', 'color', 'size', 'dash'],
  arrow: ['kinds', 'color', 'ends', 'route', 'dash'],
};

/** The subjects in play: the selection's kinds, or the tool in hand. */
export function subjectsOf(tool: string, shape: ShapeKind, selected: BoardElement[]): OptionSubject[] {
  if (selected.length) {
    return selected.flatMap((el): OptionSubject[] =>
      el.kind === 'shape' ? [el.shape] : el.kind === 'stroke' ? ['pen'] : el.kind === 'text' ? ['text'] : [],
    );
  }
  return tool === 'pen' || tool === 'eraser' || tool === 'text' ? [tool] : tool === 'shape' ? [shape] : [];
}

/** The options shown up front for these subjects (their union). */
export function primaryOptions(subjects: OptionSubject[]): Set<OptionId> {
  return new Set(subjects.flatMap((s) => TOOL_OPTIONS[s]));
}
