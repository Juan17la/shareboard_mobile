/**
 * Nunito for the canvas, loaded straight into Skia and shared with every text
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

import { setTextMeasure } from '@/features/board/geometry';

interface Typefaces {
  medium: SkTypeface;
  extrabold: SkTypeface;
  italic: SkTypeface;
  extraboldItalic: SkTypeface;
}

const FILES = {
  medium: require('@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf'),
  extrabold: require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
  italic: require('@expo-google-fonts/nunito/400Regular_Italic/Nunito_400Regular_Italic.ttf'),
  extraboldItalic: require('@expo-google-fonts/nunito/800ExtraBold_Italic/Nunito_800ExtraBold_Italic.ttf'),
} as const;

async function loadTypeface(module: number | string): Promise<SkTypeface> {
  const asset = await Asset.fromModule(module).downloadAsync();
  if (!asset.localUri) throw new Error(`font asset ${asset.name} has no local file`);
  const bytes = await new File(asset.localUri).bytes();
  const face = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes));
  if (!face) throw new Error(`font asset ${asset.name} is not a valid typeface`);
  return face;
}

/** One face from the platform's font manager: the baseline every text node starts on. */
function systemTypefaces(): Typefaces {
  const face = Skia.FontMgr.System().matchFamilyStyle('sans-serif', {
    weight: FontWeight.Medium,
    width: FontWidth.Normal,
    slant: FontSlant.Upright,
  });
  return { medium: face, extrabold: face, italic: face, extraboldItalic: face };
}

const useTypefaces = create<Typefaces>(systemTypefaces);

// Once per app, from the moment the board code is loaded.
Promise.all([
  loadTypeface(FILES.medium),
  loadTypeface(FILES.extrabold),
  loadTypeface(FILES.italic),
  loadTypeface(FILES.extraboldItalic),
]).then(
  ([medium, extrabold, italic, extraboldItalic]) =>
    useTypefaces.setState({ medium, extrabold, italic, extraboldItalic }),
  (err: unknown) => console.warn('[BoardFonts] Nunito could not be loaded for the canvas', err),
);

function faceFor(faces: Typefaces, bold: boolean, italic: boolean): SkTypeface {
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
useTypefaces.subscribe(() => measureFonts.clear());
setTextMeasure((text, { fontSize, bold = false, italic = false }) => {
  const key = `${fontSize}|${bold}|${italic}`;
  let font = measureFonts.get(key);
  if (!font) {
    font = Skia.Font(faceFor(useTypefaces.getState(), bold, italic), fontSize);
    measureFonts.set(key, font);
  }
  return textWidth(font, text);
});

/** A Skia font: the system face at first, Nunito once it has decoded. */
export function useBoardFont(size: number, bold = false, italic = false): SkFont {
  const faces = useTypefaces();
  return useMemo(() => Skia.Font(faceFor(faces, bold, italic), size), [faces, size, bold, italic]);
}

/** Advance width of `text`, the distance the next glyph would start at. */
export function textWidth(font: SkFont, text: string): number {
  return font.getGlyphWidths(font.getGlyphIDs(text)).reduce((sum, w) => sum + w, 0);
}
