/**
 * Nunito for the canvas, loaded straight into Skia and shared with every text
 * node on the board.
 *
 * The bytes are read here, in JS, and handed to Skia as data — never as a URI.
 * `useTypeface(require(...))` resolves the asset to a URI and asks Skia's
 * native loader to fetch it; on Android that loader swallows any failure and
 * the promise simply never settles, so the typeface stays null and every text
 * node on the board draws nothing, silently. `expo-asset` is the path the rest
 * of the app's fonts already load through (`expo-font` uses it), and it yields
 * a real local file in a dev client, Expo Go and a store build alike.
 *
 * The four cuts are loaded once per app and cached: the provider mounts inside
 * the board's "ready" gate, so a reconnect would otherwise reload them and blank
 * the text for a moment. Until they have decoded the context is null. If they
 * cannot be decoded at all the system face stands in — wrong shapes beat no
 * text — and the reason is logged.
 */
import { FontSlant, FontWeight, FontWidth, Skia, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface Typefaces {
  medium: SkTypeface;
  extrabold: SkTypeface;
  italic: SkTypeface;
  extraboldItalic: SkTypeface;
}

const BoardFontsContext = createContext<Typefaces | null>(null);

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

/** One face from the platform's font manager, for when the bundled ones cannot load. */
function systemTypefaces(): Typefaces | null {
  const face = Skia.FontMgr.System().matchFamilyStyle('sans-serif', {
    weight: FontWeight.Medium,
    width: FontWidth.Normal,
    slant: FontSlant.Upright,
  });
  return face ? { medium: face, extrabold: face, italic: face, extraboldItalic: face } : null;
}

let typefaces: Promise<Typefaces | null> | null = null;

function loadTypefaces(): Promise<Typefaces | null> {
  return (typefaces ??= Promise.all([
    loadTypeface(FILES.medium),
    loadTypeface(FILES.extrabold),
    loadTypeface(FILES.italic),
    loadTypeface(FILES.extraboldItalic),
  ])
    .then(([medium, extrabold, italic, extraboldItalic]) => ({ medium, extrabold, italic, extraboldItalic }))
    .catch((err: unknown) => {
      console.warn('[BoardFonts] Nunito could not be loaded for the canvas, using the system face', err);
      return systemTypefaces();
    }));
}

export function BoardFontsProvider({ children }: { children: ReactNode }) {
  const [faces, setFaces] = useState<Typefaces | null>(null);
  useEffect(() => {
    let mounted = true;
    loadTypefaces().then((f) => mounted && setFaces(f));
    return () => {
      mounted = false;
    };
  }, []);
  return <BoardFontsContext.Provider value={faces}>{children}</BoardFontsContext.Provider>;
}

/** A Skia font in the app's typeface, or null until the typefaces have decoded. */
export function useBoardFont(size: number, bold = false, italic = false): SkFont | null {
  const faces = useContext(BoardFontsContext);
  return useMemo(() => {
    if (!faces) return null;
    const face = italic
      ? bold
        ? faces.extraboldItalic
        : faces.italic
      : bold
        ? faces.extrabold
        : faces.medium;
    return Skia.Font(face, size);
  }, [faces, size, bold, italic]);
}

/** Advance width of `text`, the distance the next glyph would start at. */
export function textWidth(font: SkFont, text: string): number {
  return font.getGlyphWidths(font.getGlyphIDs(text)).reduce((sum, w) => sum + w, 0);
}
