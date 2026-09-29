/**
 * The board's typefaces for the canvas — Nunito, Lora, JetBrains Mono and
 * Caveat (`FontKey`) — loaded straight into Skia and shared with every text
 * node on the board.
 *
 * The typefaces live in a zustand store, not a React context, and the reason
 * is not taste: Skia's `<Canvas>` renders its children in a React root of its
 * own, and a context from the app tree never reaches that root. A `useContext`
 * inside the canvas reads the default value, which is how every text node on
 * the board drew nothing for a week while the fonts were loading fine. A store
 * subscription works in any root.
 *
 * The bytes are read in JS and handed to Skia as data — never as a URI, whose
 * native loader swallows failures on Android. `expo-asset` is the path the
 * app's UI fonts already load through, so the files are usually cached by the
 * time the board opens. Text never waits on it: the platform's sans-serif is
 * the face until Nunito has decoded, and stays the face if it never does.
 */
import {
  FontSlant,
  FontWeight,
  FontWidth,
  Skia,
  type SkFont,
  type SkTypeface,
} from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useMemo } from 'react';
import { create } from 'zustand';

import { Fonts } from '@/constants/theme';
import { setTextMeasure } from '@/features/board/geometry';
import { FONTS, type FontKey } from '@/features/board/model';

interface Faces {
  medium: SkTypeface;
  extrabold: SkTypeface;
  italic: SkTypeface;
  extraboldItalic: SkTypeface;
}
type Typefaces = Record<FontKey, Faces>;

/**
 * The cuts of each board typeface, in the order of `Faces`. Caveat has no
 * italic: its upright cuts stand in.
 */
const FILES: Record<FontKey, [number, number, number, number]> = {
  sans: [
    require('@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf'),
    require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
    require('@expo-google-fonts/nunito/400Regular_Italic/Nunito_400Regular_Italic.ttf'),
    require('@expo-google-fonts/nunito/800ExtraBold_Italic/Nunito_800ExtraBold_Italic.ttf'),
  ],
  serif: [
    require('@expo-google-fonts/lora/500Medium/Lora_500Medium.ttf'),
    require('@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf'),
    require('@expo-google-fonts/lora/500Medium_Italic/Lora_500Medium_Italic.ttf'),
    require('@expo-google-fonts/lora/700Bold_Italic/Lora_700Bold_Italic.ttf'),
  ],
  mono: [
    require('@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'),
    require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
    require('@expo-google-fonts/jetbrains-mono/500Medium_Italic/JetBrainsMono_500Medium_Italic.ttf'),
    require('@expo-google-fonts/jetbrains-mono/700Bold_Italic/JetBrainsMono_700Bold_Italic.ttf'),
  ],
  hand: [
    require('@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf'),
    require('@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf'),
    require('@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf'),
    require('@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf'),
  ],
};

async function loadTypeface(module: number | string): Promise<SkTypeface> {
  const asset = await Asset.fromModule(module).downloadAsync();
  if (!asset.localUri) throw new Error(`font asset ${asset.name} has no local file`);
  const bytes = await new File(asset.localUri).bytes();
  const face = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes));
  if (!face) throw new Error(`font asset ${asset.name} is not a valid typeface`);
  return face;
}

/** The platform's sans-serif, for every typeface: the baseline every text node starts on. */
function systemTypefaces(): Typefaces {
  const face = Skia.FontMgr.System().matchFamilyStyle('sans-serif', {
    weight: FontWeight.Medium,
    width: FontWidth.Normal,
    slant: FontSlant.Upright,
  });
  const faces = { medium: face, extrabold: face, italic: face, extraboldItalic: face };
  return { sans: faces, serif: faces, mono: faces, hand: faces };
}

const useTypefaces = create<Typefaces>(systemTypefaces);

// Once per app, from the moment the board code is loaded; each typeface
// arrives on its own, and one that fails keeps the system face.
for (const font of FONTS) {
  Promise.all(FILES[font].map(loadTypeface)).then(
    ([medium, extrabold, italic, extraboldItalic]) =>
      useTypefaces.setState({ [font]: { medium, extrabold, italic, extraboldItalic } }),
    (err: unknown) => console.warn(`[BoardFonts] the ${font} typeface could not be loaded`, err),
  );
}

function faceFor(typefaces: Typefaces, bold: boolean, italic: boolean, font: FontKey): SkTypeface {
  const faces = typefaces[font];
  return italic
    ? bold
      ? faces.extraboldItalic
      : faces.italic
    : bold
      ? faces.extrabold
      : faces.medium;
}

// Board geometry (bounds, wrapping, hit tests) measures text with the faces the
// canvas paints it in. Fonts are kept per size/style until the faces change.
const measureFonts = new Map<string, SkFont>();
useTypefaces.subscribe(() => {
  measureFonts.clear();
  setTextMeasure(measure);
});
function measure(
  text: string,
  { fontSize, bold = false, italic = false, font = 'sans' }: {
    fontSize: number;
    bold?: boolean;
    italic?: boolean;
    font?: FontKey;
  },
): number {
  const key = `${font}|${fontSize}|${bold}|${italic}`;
  let skFont = measureFonts.get(key);
  if (!skFont) {
    skFont = Skia.Font(faceFor(useTypefaces.getState(), bold, italic, font), fontSize);
    measureFonts.set(key, skFont);
  }
  return textWidth(skFont, text);
}
setTextMeasure(measure);

/** A Skia font: the system face at first, the typeface once it has decoded. */
export function useBoardFont(size: number, bold = false, italic = false, font: FontKey = 'sans'): SkFont {
  const faces = useTypefaces();
  return useMemo(
    () => Skia.Font(faceFor(faces, bold, italic, font), size),
    [faces, size, bold, italic, font],
  );
}

/** The React Native families of each board typeface: medium, bold, italic, bold italic. */
export const FAMILIES: Record<FontKey, [string, string, string, string]> = {
  sans: [Fonts.medium, Fonts.extrabold, Fonts.italic, Fonts.extraboldItalic],
  serif: ['Lora_500Medium', 'Lora_700Bold', 'Lora_500Medium_Italic', 'Lora_700Bold_Italic'],
  mono: [
    'JetBrainsMono_500Medium',
    'JetBrainsMono_700Bold',
    'JetBrainsMono_500Medium_Italic',
    'JetBrainsMono_700Bold_Italic',
  ],
  hand: ['Caveat_500Medium', 'Caveat_700Bold', 'Caveat_500Medium', 'Caveat_700Bold'],
};

/** Advance width of `text`, the distance the next glyph would start at. */
export function textWidth(font: SkFont, text: string): number {
  return font.getGlyphWidths(font.getGlyphIDs(text)).reduce((sum, w) => sum + w, 0);
}
