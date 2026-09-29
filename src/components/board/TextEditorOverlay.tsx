/**
 * The inline editor a text element is typed into.
 *
 * What is typed is painted by the board itself, in place — a figure's label
 * centred and wrapped inside the figure, a text in its own font and turn — so
 * it looks exactly as it will once committed. The input over it only holds the
 * caret and the selection: same box, font and line height, glyphs clear. Committing on blur (and on
 * return) is what makes tapping elsewhere on the board finish the text
 * naturally; an empty value deletes the element the tap created, so nothing
 * is left behind. No confirm button: return or a tap outside is the finish.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { inkFor } from '@/constants/theme';
import { useColors, useDark } from '@/features/session/store';
import { useT } from '@/features/i18n/store';
import {
  boxOf,
  isLineLike,
  labelLines,
  LABEL_PAD,
  rotationOf,
  shapeBounds,
  TEXT_LINE_HEIGHT,
} from '@/features/board/geometry';
import { SHAPE_TEXT_SIZE, type ShapeElement, type TextElement } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';

import { FAMILIES } from './BoardFonts';

export function TextEditorOverlay({
  element,
  onDraft,
  onClose,
}: {
  /** A text element, or a shape whose label is being typed. */
  element: TextElement | ShapeElement;
  /** Every keystroke's text, for the board to paint in place. */
  onDraft: (text: string) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const dark = useDark();
  const t = useT();
  const camera = useBoardStore((s) => s.camera);
  const updateText = useBoardStore((s) => s.updateText);
  const updateShape = useBoardStore((s) => s.updateShape);
  const [value, setValue] = useState(element.text ?? '');
  useEffect(() => onDraft(value), [value, onDraft]);
  const committed = useRef(false);

  const commit = () => {
    // Blur fires after the backdrop tap has already committed; without the
    // guard the second call would send the same op twice.
    if (committed.current) return;
    committed.current = true;
    if (element.kind === 'text') updateText(element.id, { text: value });
    else updateShape(element.id, { text: value.trim() });
    onClose();
  };

  // The canvas paints the draft (`onDraft`) exactly as it will look; this
  // input lies over it in the same font, size, line height and turn, with its
  // own glyphs invisible — only the caret and the selection show.
  const s = camera.scale;
  const draft = { ...element, text: value } as TextElement | ShapeElement;
  const fontSize = (element.fontSize ?? SHAPE_TEXT_SIZE) * s;
  const step = fontSize * TEXT_LINE_HEIGHT;
  let box: { x: number; y: number; width: number; height: number };
  let paddingTop = 0;
  let paddingX = 0;
  if (draft.kind === 'text') {
    const b = boxOf(draft);
    // Unwrapped text grows to the right as it is typed: leave the input room
    // so it never wraps a line the board does not.
    const width = draft.width ? draft.width * s : Math.max(b.width * s + fontSize * 2, 80);
    box = { x: b.x * s + camera.x, y: b.y * s + camera.y, width, height: b.height * s };
  } else if (isLineLike(draft)) {
    // A line's label floats just above its midpoint (ShapeLabel).
    const b = shapeBounds(draft);
    const lines = labelLines(draft, fontSize / s).length;
    const cx = (b.x + b.width / 2) * s + camera.x;
    const cy = (b.y + b.height / 2) * s + camera.y - (lines * step) / 2 - fontSize * 0.4;
    box = { x: cx - 120, y: cy - (lines * step) / 2, width: 240, height: lines * step };
  } else {
    // A box's label is centred in it, wrapped inside its padding.
    const b = shapeBounds(draft);
    const lines = labelLines(draft, fontSize / s).length;
    box = { x: b.x * s + camera.x, y: b.y * s + camera.y, width: b.width * s, height: b.height * s };
    paddingTop = Math.max(0, (box.height - lines * step) / 2);
    paddingX = LABEL_PAD * s;
  }
  const angle = rotationOf(element);
  const origin = boxOf(element);
  // The stored colour is the light-theme ink by default; flip it to the dark
  // board's ink the same way the committed element already paints (`inked` in
  // ElementRenderer) — otherwise the caret is black on black.
  const color = inkFor(element.kind === 'text' ? element.color : element.stroke, dark);
  const bold = element.kind === 'text' && !!element.bold;
  const italic = element.kind === 'text' && !!element.italic;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Tapping anywhere else finishes the text rather than leaving a stray
          editor open behind the next stroke. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.close}
        onPress={commit}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <TextInput
        autoFocus
        multiline
        value={value}
        onChangeText={setValue}
        onBlur={commit}
        // Return finishes the text (like web's Enter) instead of adding a line.
        submitBehavior="blurAndSubmit"
        onSubmitEditing={commit}
        placeholder={t.typeHere}
        placeholderTextColor={c.borderDashed}
        accessibilityLabel={t.text}
        cursorColor={color}
        selectionColor={c.accent}
        textAlignVertical="top"
        scrollEnabled={false}
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y,
          width: box.width,
          height: Math.max(box.height, step),
          padding: 0,
          paddingTop,
          paddingHorizontal: paddingX,
          textAlign: element.kind === 'shape' ? 'center' : 'left',
          transform: angle ? [{ rotate: `${angle}rad` }] : undefined,
          transformOrigin: [
            (origin.x + origin.width / 2) * s + camera.x - box.x,
            (origin.y + origin.height / 2) * s + camera.y - box.y,
            0,
          ],
          color: 'transparent',
          fontFamily: FAMILIES[element.font ?? 'sans'][italic ? (bold ? 3 : 2) : bold ? 1 : 0],
          fontSize,
          lineHeight: step,
        }}
      />
    </View>
  );
}
