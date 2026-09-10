/**
 * The "More colours" picker behind the palette's dashed button.
 *
 * The design's web prototype used `<input type="color">`, which has no mobile
 * equivalent. Sliders would be the obvious substitute and are the wrong answer
 * for this audience — the app is meant to be usable by a child and by a
 * professor who wants a slightly darker green without learning what "saturation"
 * means. So the whole space is laid out as a grid instead: every column is a
 * hue, every row a lightness, plus a greyscale row. Picking is one tap and
 * needs no dragging.
 */
import { Pressable, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useT } from '@/features/i18n/store';

import { Sheet } from './Sheet';
import { Txt } from './Text';

/** Evenly spaced hues, skewed slightly to give more room to warm colours. */
const HUES = [0, 20, 40, 60, 100, 150, 175, 195, 215, 250, 280, 320];
/** Lightness ramp, dark to light. Saturation eases off at the extremes so the
 *  darkest and lightest rows do not turn into muddy or washed-out bands. */
const RAMP = [
  { l: 26, s: 62 },
  { l: 40, s: 78 },
  { l: 52, s: 86 },
  { l: 66, s: 82 },
  { l: 80, s: 78 },
];

const GREYS = ['#000000', '#1B2030', '#3F4657', '#6B7280', '#9AA0A6', '#C7CBD4', '#E6E8EC', '#FFFFFF'];

/** HSL -> `#RRGGBB`, so every swatch matches the model's colour pattern. */
function hsl(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const hex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function ColorPickerSheet({
  open,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  value: string;
  onPick: (color: string) => void;
  onClose: () => void;
}) {
  const t = useT();

  const swatch = (color: string, key: string) => {
    const active = color.toUpperCase() === value.toUpperCase();
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={color}
        accessibilityState={{ selected: active }}
        onPress={() => onPick(color)}
        style={{
          flex: 1,
          aspectRatio: 1,
          borderRadius: 8,
          backgroundColor: color,
          borderWidth: active ? 2.5 : 1,
          borderColor: active ? Colors.accent : Colors.border,
        }}
      />
    );
  };

  return (
    <Sheet open={open} title={t.color} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 6 }}>
        {RAMP.map((step, row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
            {HUES.map((h) => swatch(hsl(h, step.s, step.l), `${h}-${row}`))}
          </View>
        ))}

        <View style={{ height: 6 }} />
        <Txt weight="extrabold" size={10.5} tracking={0.9} tone="secondary">
          {t.custom.toUpperCase()}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {GREYS.map((grey) => swatch(grey, grey))}
          {/* Keeps the last row the same cell size as the hue rows above. */}
          {Array.from({ length: HUES.length - GREYS.length }).map((_, i) => (
            <View key={`spacer-${i}`} style={{ flex: 1, aspectRatio: 1 }} />
          ))}
        </View>
      </View>
    </Sheet>
  );
}
