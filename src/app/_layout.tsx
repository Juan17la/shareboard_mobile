import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppFonts } from '@/hooks/use-app-fonts';
import '@/global.css';

/**
 * The app is light-only. The design specifies a single frosted-white surface
 * system with no dark counterpart, and half-inventing one would leave the glass
 * panels — which get their depth from a light blur over a light ground —
 * looking like flat grey boxes. `userInterfaceStyle` in app.json pins the
 * system chrome to match.
 */
export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Nothing renders until Nunito is decoded: every surface in the app is
            typeset in it, and a frame of system font first is a visible jolt. */}
        {fontsLoaded ? (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="board/[id]" />
          </Stack>
        ) : (
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
        )}
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
