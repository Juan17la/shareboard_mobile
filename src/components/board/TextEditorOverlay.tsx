/**
 * The inline editor a text element is typed into.
 *
 * It is positioned over the exact spot on the board where the text will land
 * and drawn at the zoomed font size, so what is being typed sits where it will
 * end up rather than in a dialog somewhere else. Committing on blur (and on
 * return) is what makes tapping elsewhere on the board finish the text
 * naturally; an empty value deletes the element the tap created.
 */
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import type { TextElement } from '@/features/board/model';
import type { Camera } from '@/features/board/store';
import { useBoardStore } from '@/features/board/store';

export function TextEditorOverlay({
  element,
  camera,
  onClose,
}: {
  element: TextElement;
  camera: Camera;
  onClose: () => void;
}) {
  const t = useT();
  const updateText = useBoardStore((s) => s.updateText);
  const [value, setValue] = useState(element.text);

  const commit = () => {
    updateText(element.id, { text: value });
    onClose();
  };

  const left = element.at.x * camera.scale + camera.x;
  const top = element.at.y * camera.scale + camera.y - 4;
  const fontSize = element.fontSize * camera.scale;

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
          minWidth: 120,
          maxWidth: 240,
          paddingHorizontal: 4,
          paddingVertical: 2,
          borderRadius: 6,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: Colors.accent,
          backgroundColor: 'rgba(255,255,255,0.9)',
          color: element.color,
          fontFamily: element.italic
            ? element.bold
              ? Fonts.extraboldItalic
              : Fonts.italic
            : element.bold
              ? Fonts.extrabold
              : Fonts.medium,
          fontSize,
          lineHeight: fontSize * 1.25,
        }}
      />
    </View>
  );
}
