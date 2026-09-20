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
 * the text for a moment. Text never waits on that load: the platform's own
 * sans-serif — available synchronously — is the face until Nunito has decoded,
 * and stays the face if it never does. Wrong shapes beat no text.
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

const BoardFontsContext = createContext<{ faces: Typefaces | null; status: string }>({
  faces: null,
  status: 'no provider',
});

const FILES = {
  medium: require('@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf'),
  extrabold: require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
  italic: require('@expo-google-fonts/nunito/400Regular_Italic/Nunito_400Regular_Italic.ttf'),
  extraboldItalic: require('@expo-google-fonts/nunito/800ExtraBold_Italic/Nunito_800ExtraBold_Italic.ttf'),
} as const;

// Stage markers, until the phone that draws no board text has said which stage
// goes silent: the loader has never rejected there, so a warn alone tells nothing.
const log = __DEV__ ? (...args: unknown[]) => console.log('[BoardFonts]', ...args) : () => {};

async function loadTypeface(module: number | string): Promise<SkTypeface> {
  const asset = await Asset.fromModule(module).downloadAsync();
  log('downloaded', asset.name, asset.localUri);
  if (!asset.localUri) throw new Error(`font asset ${asset.name} has no local file`);
  const bytes = await new File(asset.localUri).bytes();
  log('read', asset.name, bytes.byteLength, 'bytes');
  const face = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes));
  log('typeface', asset.name, face ? 'ok' : 'null');
  if (!face) throw new Error(`font asset ${asset.name} is not a valid typeface`);
  return face;
}

/** One face from the platform's font manager: the baseline every text node starts on. */
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
      console.warn('[BoardFonts] Nunito could not be loaded for the canvas, keeping the system face', err);
      return null;
    }));
}

export function BoardFontsProvider({ children }: { children: ReactNode }) {
  const [faces, setFaces] = useState<Typefaces | null>(systemTypefaces);
  const [nunito, setNunito] = useState('loading');
  useEffect(() => {
    let mounted = true;
    loadTypefaces().then(
      (f) => {
        log('nunito', f ? 'ready' : 'unavailable');
        if (!mounted) return;
        setNunito(f ? 'ok' : 'unavailable');
        if (f) setFaces(f);
      },
      (err: unknown) => mounted && setNunito(`error ${String(err)}`),
    );
    return () => {
      mounted = false;
    };
  }, []);
  // A system font manager that lists no families hands back typeface-less
  // fonts, which draw nothing: the count is the one number that says so.
  const value = useMemo(
    () => ({ faces, status: `families=${Skia.FontMgr.System().countFamilies()} · nunito ${nunito}` }),
    [faces, nunito],
  );
  return <BoardFontsContext.Provider value={value}>{children}</BoardFontsContext.Provider>;
}

/** Where the board's fonts stand, for the dev status line on the canvas. */
export function useBoardFontStatus(): string {
  return useContext(BoardFontsContext).status;
}

/** A Skia font: the system face at first, Nunito once it has decoded. */
export function useBoardFont(size: number, bold = false, italic = false): SkFont | null {
  const { faces } = useContext(BoardFontsContext);
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
