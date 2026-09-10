/**
 * The frosted panel every floating surface in this app is built from.
 *
 * On iOS this is a real `BlurView`: the tool rail, the sheets and the dialogs
 * are meant to sit *over* the board and let the drawing show through, which a
 * flat translucent fill cannot do — the strokes underneath turn muddy instead
 * of softening.
 *
 * Android takes a solid tint instead. `expo-blur` there needs the blurred
 * content wrapped in a `BlurTargetView` whose ref is handed to every panel,
 * which does not survive panels that overlay the whole screen (sheets, the
 * confirm dialog) — so rather than half-blur some surfaces and not others,
 * Android gets one consistent near-opaque surface at a slightly higher opacity,
 * which keeps text contrast identical to iOS.
 */
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

import { Colors, Glass, Radius } from '@/constants/theme';

const SUPPORTS_BLUR = Platform.OS === 'ios';

export type GlassLevel = 'panel' | 'row' | 'chip';

/** How opaque the fallback tint is per level, so text keeps its contrast. */
const FALLBACK: Record<GlassLevel, string> = {
  panel: 'rgba(252,253,255,0.94)',
  row: 'rgba(255,255,255,0.92)',
  chip: 'rgba(255,255,255,0.90)',
};

const TINT: Record<GlassLevel, string> = {
  panel: Glass.tint,
  row: Glass.tintSolid,
  chip: 'rgba(255,255,255,0.55)',
};

const INTENSITY: Record<GlassLevel, number> = { panel: 44, row: 30, chip: 26 };

export interface GlassPanelProps {
  children?: ReactNode;
  level?: GlassLevel;
  radius?: number;
  /** Hairline border. Pass `null` for a borderless panel. */
  border?: string | null;
  style?: ViewStyle | ViewStyle[];
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

export function GlassPanel({
  children,
  level = 'panel',
  radius = Radius.xl,
  border = Colors.border,
  style,
  pointerEvents,
}: GlassPanelProps) {
  // `overflow: hidden` is what makes the corner radius clip the blur — without
  // it the blur paints square corners on both platforms (expo-blur docs).
  const shell: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden',
    ...(border ? { borderWidth: 1, borderColor: border } : null),
  };

  if (!SUPPORTS_BLUR) {
    return (
      <View
        pointerEvents={pointerEvents}
        style={[shell, { backgroundColor: FALLBACK[level] }, style as ViewStyle]}
      >
        {children}
      </View>
    );
  }

  return (
    <View pointerEvents={pointerEvents} style={[shell, style as ViewStyle]}>
      <BlurView
        intensity={INTENSITY[level]}
        tint="light"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: TINT[level],
        }}
      />
      {children}
    </View>
  );
}
