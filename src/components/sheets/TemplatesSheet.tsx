/**
 * "Templates": a ready-made start for a class activity, added in the middle of
 * the screen as one undo step (`features/board/templates.ts`). Same as web.
 */
import { Pressable, View } from 'react-native';

import { useBoardStore } from '@/features/board/store';
import { TEMPLATES, templateElements, templateSpot, type TemplateKey } from '@/features/board/templates';
import { useT } from '@/features/i18n/store';
import { useColors } from '@/features/session/store';

import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

export function TemplatesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const add = (key: TemplateKey) => {
    const s = useBoardStore.getState();
    const { x, y, scale } = s.camera;
    const centre = { x: (s.viewport.width / 2 - x) / scale, y: (s.viewport.height / 2 - y) / scale };
    const els = templateElements(key, t);
    const at = templateSpot(els, s.visibleElements(), centre);
    s.paste(at, els);
    // Wherever it landed, it is what the screen shows next.
    s.setCamera({ scale, x: s.viewport.width / 2 - at.x * scale, y: s.viewport.height / 2 - at.y * scale });
    onClose();
  };
  return (
    <Sheet open={open} title={t.templates} onClose={onClose} closeLabel={t.close}>
      <Txt size={13} tone="secondary" style={{ marginBottom: 12 }}>
        {t.templatesHint}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
        {TEMPLATES.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={t[label]}
            onPress={() => add(key)}
            style={({ pressed }) => ({
              flexBasis: '48%',
              flexGrow: 1,
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.borderStrong,
              backgroundColor: pressed ? c.text + '29' : 'transparent',
            })}
          >
            <Icon name="template" size={18} />
            <Txt weight="bold" size={14}>
              {t[label]}
            </Txt>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
