/**
 * Loads the two families the design is drawn in: Nunito for everything (its
 * rounded, friendly shapes are the reason the app reads as approachable to
 * both a child and a professor) and JetBrains Mono for the things that get
 * read out character by character — board codes, PINs, zoom percentages.
 *
 * Several Nunito cuts are loaded rather than one: React Native does not
 * synthesise weights or italics from a single file, so a "bold" that was never
 * loaded silently falls back to the system face.
 *
 * The `.ttf` files are required by path rather than imported from the package
 * index. The index re-exports all sixteen weights of each family, and Metro
 * bundles every asset it can see — importing four names from it shipped ~2 MB
 * of fonts the app never renders.
 */
import { useFonts } from 'expo-font';

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Nunito_400Regular: require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'),
    Nunito_400Regular_Italic: require('@expo-google-fonts/nunito/400Regular_Italic/Nunito_400Regular_Italic.ttf'),
    Nunito_500Medium: require('@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf'),
    Nunito_600SemiBold: require('@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf'),
    Nunito_700Bold: require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
    Nunito_800ExtraBold: require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
    Nunito_800ExtraBold_Italic: require('@expo-google-fonts/nunito/800ExtraBold_Italic/Nunito_800ExtraBold_Italic.ttf'),
    JetBrainsMono_500Medium: require('@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'),
    JetBrainsMono_700Bold: require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
    // The board's other typefaces, for the text editor typing over the canvas
    // (its caret has to sit where the canvas paints the glyphs).
    JetBrainsMono_500Medium_Italic: require('@expo-google-fonts/jetbrains-mono/500Medium_Italic/JetBrainsMono_500Medium_Italic.ttf'),
    JetBrainsMono_700Bold_Italic: require('@expo-google-fonts/jetbrains-mono/700Bold_Italic/JetBrainsMono_700Bold_Italic.ttf'),
    Lora_500Medium: require('@expo-google-fonts/lora/500Medium/Lora_500Medium.ttf'),
    Lora_700Bold: require('@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf'),
    Lora_500Medium_Italic: require('@expo-google-fonts/lora/500Medium_Italic/Lora_500Medium_Italic.ttf'),
    Lora_700Bold_Italic: require('@expo-google-fonts/lora/700Bold_Italic/Lora_700Bold_Italic.ttf'),
    Caveat_500Medium: require('@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf'),
    Caveat_700Bold: require('@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf'),
  });
  return loaded;
}
