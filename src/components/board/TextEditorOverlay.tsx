import { useState } from 'react';
import { TextInput, View } from 'react-native';

import type { Camera } from '@/features/board/store';
import { useBoardStore } from '@/features/board/store';
import type { TextElement } from '@/features/board/model';

/**
 * Absolutely-positioned RN TextInput shown while a text element is being edited.
 * Commits back to the store on blur; an empty value deletes the element.
 */
export function TextEditorOverlay({
  element,
  camera,
  onClose,
}: {
  element: TextElement;
  camera: Camera;
  onClose: () => void;
}) {
  const updateText = useBoardStore((s) => s.updateText);
  const [value, setValue] = useState(element.text);

  const left = element.at.x * camera.scale + camera.x;
  const top = element.at.y * camera.scale + camera.y;

  return (
    <View
      style={{ position: 'absolute', left, top, minWidth: 120 }}
      pointerEvents="box-none"
    >
      <TextInput
        autoFocus
        multiline
        value={value}
        onChangeText={setValue}
        onBlur={() => {
          updateText(element.id, { text: value });
          onClose();
        }}
        style={{
          fontSize: element.fontSize * camera.scale,
          fontWeight: element.bold ? 'bold' : 'normal',
          fontStyle: element.italic ? 'italic' : 'normal',
          color: element.color,
          padding: 2,
          borderWidth: 1,
          borderColor: '#208AEF',
          backgroundColor: 'rgba(255,255,255,0.9)',
        }}
      />
    </View>
  );
}
