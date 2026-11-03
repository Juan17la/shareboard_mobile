/**
 * Frame rates over the board, for measuring a change on a real device: the UI
 * thread's (frames the screen actually got) and the JS thread's (what the
 * gestures and React run on). A pan that holds 60 on the UI thread while JS
 * sits at 15 is the target of moving it off JS; both low is the render cost.
 *
 * Off unless the build sets `EXPO_PUBLIC_PERF_HUD=1` (the `perf` EAS profile,
 * or `EXPO_PUBLIC_PERF_HUD=1 npx expo start`).
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

export const PERF_HUD = process.env.EXPO_PUBLIC_PERF_HUD === '1';

export function PerfHud() {
  const uiFrames = useSharedValue(0);
  useFrameCallback(() => {
    'worklet';
    uiFrames.set(uiFrames.get() + 1);
  });
  const [fps, setFps] = useState({ ui: 0, js: 0 });

  useEffect(() => {
    let js = 0;
    let raf = requestAnimationFrame(function tick() {
      js += 1;
      raf = requestAnimationFrame(tick);
    });
    let lastUi = uiFrames.get();
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const secs = (now - last) / 1000;
      const ui = uiFrames.get();
      setFps({ ui: Math.round((ui - lastUi) / secs), js: Math.round(js / secs) });
      lastUi = ui;
      js = 0;
      last = now;
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, [uiFrames]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 8,
        bottom: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.7)',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] }}>
        UI {fps.ui} · JS {fps.js}
      </Text>
    </View>
  );
}
