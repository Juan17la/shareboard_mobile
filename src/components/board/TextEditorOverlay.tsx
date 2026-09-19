/**
 * The inline editor a text element is typed into.
 *
 * It is positioned over the exact spot on the board where the text will land
 * and drawn at the zoomed font size, so what is being typed sits where it will
 * end up rather than in a dialog somewhere else. Committing on blur (and on
 * return) is what makes tapping elsewhere on the board finish the text
 * naturally; an empty value deletes the element the tap created.
 */
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { shapeBounds } from '@/features/board/geometry';
import { SHAPE_TEXT_SIZE, type ShapeElement, type TextElement } from '@/features/board/model';
import type { Camera } from '@/features/board/store';
import { useBoardStore } from '@/features/board/store';

export function TextEditorOverlay({
  element,
  camera,
  onClose,
}: {
  /** A text element, or a shape whose label is being typed. */
  element: TextElement | ShapeElement;
  camera: Camera;
  onClose: () => void;
}) {
  const t = useT();
  const updateText = useBoardStore((s) => s.updateText);
  const updateShape = useBoardStore((s) => s.updateShape);
  const [value, setValue] = useState(element.text ?? '');
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

  const fontSize = (element.fontSize ?? SHAPE_TEXT_SIZE) * camera.scale;
  const width = 160;
  let left: number;
  let top: number;
  if (element.kind === 'text') {
    left = element.at.x * camera.scale + camera.x;
    top = element.at.y * camera.scale + camera.y - 4;
  } else {
    // A shape's label sits centred in its box, so the editor does too.
    const b = shapeBounds(element);
    left = (b.x + b.width / 2) * camera.scale + camera.x - width / 2;
    top = (b.y + b.height / 2) * camera.scale + camera.y - fontSize * 0.75 - 4;
  }
  const color = element.kind === 'text' ? element.color : element.stroke;
  const bold = element.kind === 'text' && element.bold;
  const italic = element.kind === 'text' && element.italic;

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
        onSubmitEditing={commit}
        placeholder={t.typeHere}
        placeholderTextColor="rgba(27,32,48,0.35)"
        accessibilityLabel={t.text}
        style={{
          position: 'absolute',
          left,
          top,
          minWidth: element.kind === 'shape' ? width : 120,
          maxWidth: 240,
          textAlign: element.kind === 'shape' ? 'center' : 'left',
          paddingHorizontal: 4,
          paddingVertical: 2,
          borderRadius: 6,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: Colors.accent,
          backgroundColor: 'rgba(255,255,255,0.9)',
          color,
          fontFamily: italic
            ? bold
              ? Fonts.extraboldItalic
              : Fonts.italic
            : bold
              ? Fonts.extrabold
              : Fonts.medium,
          fontSize,
          lineHeight: fontSize * 1.25,
        }}
      />
    </View>
  );
}
