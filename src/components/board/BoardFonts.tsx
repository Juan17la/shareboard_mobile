/**
 * Nunito for the canvas, loaded straight into Skia and shared with every text
 * node on the board.
 *
 * The four cuts are loaded as typefaces and a `SkFont` is built from the one a
 * node needs (`useBoardFont`). No family-name matching is involved: Skia's
 * `matchFont` looks a family up in a font manager, and a lookup that misses
 * hands back a font with no typeface, which draws nothing at all. A typeface
 * held directly cannot miss.
 *
 * It is a context rather than a hook per element: `useTypeface` is a hook, and
 * a board can hold hundreds of text elements. Until the files have decoded the
 * context is null and text nodes render nothing for a frame or two.
 */
import { Skia, useTypeface, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface Typefaces {
  medium: SkTypeface;
  extrabold: SkTypeface;
  italic: SkTypeface;
  extraboldItalic: SkTypeface;
}

const BoardFontsContext = createContext<Typefaces | null>(null);

/**
 * What `require()` hands back for an asset differs by platform: a numeric
 * module id on native, a plain URL string on web. Skia accepts the former or a
 * `{ uri }` object, and throws outright on a bare string — so the string case
 * is wrapped rather than passed through.
 */
type DataSource = Parameters<typeof useTypeface>[0];

function asSource(asset: unknown): DataSource {
  return (typeof asset === 'string' ? { uri: asset } : asset) as DataSource;
}

export function BoardFontsProvider({ children }: { children: ReactNode }) {
  const medium = useTypeface(asSource(require('@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf')));
  const extrabold = useTypeface(
    asSource(require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf')),
  );
  const italic = useTypeface(
    asSource(require('@expo-google-fonts/nunito/400Regular_Italic/Nunito_400Regular_Italic.ttf')),
  );
  const extraboldItalic = useTypeface(
    asSource(require('@expo-google-fonts/nunito/800ExtraBold_Italic/Nunito_800ExtraBold_Italic.ttf')),
  );

  const value = useMemo(
    () =>
      medium && extrabold && italic && extraboldItalic
        ? { medium, extrabold, italic, extraboldItalic }
        : null,
    [medium, extrabold, italic, extraboldItalic],
  );

  return <BoardFontsContext.Provider value={value}>{children}</BoardFontsContext.Provider>;
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
