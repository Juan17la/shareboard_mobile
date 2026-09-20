import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColors, useDark } from '@/features/session/store';
import { useAppFonts } from '@/hooks/use-app-fonts';

/**
 * Light by default; the dark board is a choice made in settings and kept per
 * device (`session.theme`). The status bar follows it.
 */
export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const c = useColors();
  const dark = useDark();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Nothing renders until Nunito is decoded: every surface in the app is
            typeset in it, and a frame of system font first is a visible jolt. */}
        {fontsLoaded ? (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="board/[id]" />
          </Stack>
        ) : (
          <View style={{ flex: 1, backgroundColor: c.background }} />
        )}
        <StatusBar style={dark ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
