/**
 * "Templates": a ready-made start for a class activity, added in the middle of
 * the screen as one undo step (`features/board/templates.ts`). Each card shows
 * the template itself, drawn by the SVG export, so you see what you are adding.
 * Same as web.
 */
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useBoardStore } from '@/features/board/store';
import { toSvg } from '@/features/board/svg';
import { TEMPLATES, templateElements, templateSpot, type TemplateKey } from '@/features/board/templates';
import { useT } from '@/features/i18n/store';
import { useColors } from '@/features/session/store';

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
  // On paper, whatever the board's theme: the thumbnails are pictures of it.
  // The <style> only imports web fonts, which react-native-svg cannot fetch.
  const previews = useMemo(
    () =>
      Object.fromEntries(
        TEMPLATES.map(({ key }) => [
          key,
          toSvg(templateElements(key, t), { padding: 24, background: '#FFFFFF' })?.replace(/<style>[\s\S]*?<\/style>/, '') ?? null,
        ]),
      ),
    [t],
  );
  return (
    <Sheet open={open} title={t.templates} onClose={onClose} closeLabel={t.close}>
      <Txt size={13} tone="secondary" style={{ marginBottom: 12 }}>
        {t.templatesHint}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, paddingBottom: 8 }}>
        {TEMPLATES.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={t[label]}
            onPress={() => add(key)}
            style={({ pressed }) => ({
              // Two to a row, the odd last one the same size as the rest.
              width: '48%',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: pressed ? c.accent : c.borderStrong,
              overflow: 'hidden',
            })}
          >
            <View
              style={{
                aspectRatio: 4 / 3,
                padding: 8,
                backgroundColor: '#FFFFFF',
                borderBottomWidth: 1,
                borderBottomColor: c.border,
              }}
            >
              {previews[key] ? <SvgXml xml={previews[key]} width="100%" height="100%" /> : null}
            </View>
            <Txt weight="semibold" size={14} style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
              {t[label]}
            </Txt>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
