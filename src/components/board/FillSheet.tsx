/**
 * A shape's fill, as the two things it is: a colour (typed as HEX or picked)
 * and an opacity. Every change applies at once, so the shape — or the next one
 * drawn — is the preview; 0% is no fill at all. A hand-kept twin of
 * `web/src/components/board/FillSheet.tsx` (a stepper instead of a slider: no
 * slider ships with Expo).
 */
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DrawingPalette, Fonts } from '@/constants/theme';
import { parseHex } from '@/features/board/store';
import { useT } from '@/features/i18n/store';
import { useColors } from '@/features/session/store';

import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

const PRESETS = [0, 25, 50, 75, 100];
const STEP = 5;

export function FillSheet({
  open,
  color,
  custom,
  opacity,
  onColor,
  onOpacity,
  onClose,
}: {
  open: boolean;
  /** The colour in effect, shown as the HEX field's value. */
  color: string;
  /** Whether it was chosen, rather than following the line. */
  custom: boolean;
  opacity: number;
  /** null: follow the line's colour. */
  onColor: (color: string | null) => void;
  onOpacity: (opacity: number) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const t = useT();
  // What is being typed, until the colour changes some other way (a swatch,
  // another shape selected): then the field shows what is now true.
  const [typed, setTyped] = useState<{ for: string; text: string } | null>(null);
  const text = typed && typed.for === color ? typed.text : color;
  const valid = parseHex(text) !== null;
  const same = (swatch: string) => custom && color.toUpperCase() === swatch.toUpperCase();
  const alpha = Math.round((opacity * 255) / 100)
    .toString(16)
    .padStart(2, '0');

  const stepper = (label: string, glyph: string, next: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onOpacity(Math.min(100, Math.max(0, next)))}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.surfaceSelected : c.surface,
      })}
    >
      <Txt weight="bold" size={20}>
        {glyph}
      </Txt>
    </Pressable>
  );

  return (
    <Sheet open={open} title={t.fill} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: c.border,
              backgroundColor: `${color}${alpha}`,
            }}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Txt weight="extrabold" size={10.5} tracking={0.9} tone="secondary">
              {t.hexCode.toUpperCase()}
            </Txt>
            <TextInput
              value={text}
              maxLength={7}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              accessibilityLabel={t.hexCode}
              onChangeText={(value) => {
                const hex = parseHex(value);
                // A valid colour is the new value, so what is typed is for that.
                setTyped({ for: hex ?? color, text: value });
                if (hex) onColor(hex);
              }}
              style={{
                height: 44,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: valid ? c.borderField : c.dangerBright,
                backgroundColor: c.surface,
                color: c.text,
                paddingHorizontal: 13,
                fontFamily: Fonts.monoBold,
                fontSize: 15,
                letterSpacing: 1.5,
              }}
            />
          </View>
        </View>
        {valid ? null : (
          <Txt size={12} tone="danger">
            {t.hexInvalid}
          </Txt>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {DrawingPalette.map((swatch) => (
            <Pressable
              key={swatch}
              accessibilityRole="button"
              accessibilityLabel={`${t.fillColor} ${swatch}`}
              accessibilityState={{ selected: same(swatch) }}
              onPress={() => onColor(swatch)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: swatch,
                borderWidth: 2.5,
                borderColor: same(swatch) ? c.accent : c.background,
              }}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !custom }}
            onPress={() => onColor(null)}
            style={{
              height: 36,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: custom ? c.border : c.accent,
              paddingHorizontal: 12,
              justifyContent: 'center',
            }}
          >
            <Txt weight="bold" size={12.5} tone={custom ? 'secondary' : 'accent'}>
              {t.sameAsLine}
            </Txt>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <Txt weight="extrabold" size={10.5} tracking={0.9} tone="secondary">
            {t.opacity.toUpperCase()}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {stepper(`${t.opacity} −${STEP}%`, '−', opacity - STEP)}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 22, color: c.text }}>{`${opacity}%`}</Text>
            </View>
            {stepper(`${t.opacity} +${STEP}%`, '+', opacity + STEP)}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityState={{ selected: opacity === p }}
                onPress={() => onOpacity(p)}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: opacity === p ? c.accent : c.surface,
                }}
              >
                <Txt weight="bold" size={12.5} tone={opacity === p ? 'inverse' : 'default'}>
                  {`${p}%`}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Sheet>
  );
}
