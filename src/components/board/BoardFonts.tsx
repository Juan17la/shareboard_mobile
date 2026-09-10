/**
 * Nunito, loaded into Skia's font manager and shared with the whole canvas.
 *
 * `matchFont` looks in the *system* font list, which does not contain a font
 * bundled with the app, so text drawn on the board would silently fall back to
 * the platform default while every label around it rendered in Nunito. Loading
 * the four cuts into a `SkTypefaceFontProvider` and handing that provider to
 * `matchFont` is what keeps a heading typed on the board the same shape as the
 * heading above it.
 *
 * It is a context rather than a hook per element: `useFonts` is a hook, and a
 * board can hold hundreds of text elements.
 */
import { useFonts } from '@shopify/react-native-skia';
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia/lib/typescript/src/skia/types';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

const BoardFontsContext = createContext<SkTypefaceFontProvider | null>(null);

/**
 * What `require()` hands back for an asset differs by platform: a numeric
 * module id on native, a plain URL string on web. Skia accepts the former or a
 * `{ uri }` object, and throws outright on a bare string — so the string case
 * is wrapped rather than passed through.
 */
type DataModule = Parameters<typeof useFonts>[0][string][number];

function asDataModule(asset: unknown): DataModule {
  return (typeof asset === 'string' ? { uri: asset } : asset) as DataModule;
}

export function BoardFontsProvider({ children }: { children: ReactNode }) {
  const sources = useMemo(
    () => ({
      Nunito: [
        asDataModule(require('@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf')),
        asDataModule(require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf')),
        asDataModule(
          require('@expo-google-fonts/nunito/400Regular_Italic/Nunito_400Regular_Italic.ttf'),
        ),
        asDataModule(
          require('@expo-google-fonts/nunito/800ExtraBold_Italic/Nunito_800ExtraBold_Italic.ttf'),
        ),
      ],
    }),
    [],
  );

  const provider = useFonts(sources);

  return <BoardFontsContext.Provider value={provider}>{children}</BoardFontsContext.Provider>;
}

/** Null until the typefaces have been decoded; callers fall back to the system. */
export function useBoardFonts(): SkTypefaceFontProvider | null {
  return useContext(BoardFontsContext);
}
