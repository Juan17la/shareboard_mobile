/**
 * The colour box the options strip shows instead of a row of palette swatches:
 * the colour at its own opacity over a checkerboard (so "transparent" reads as
 * transparent), ringed so white shows up on a light strip. Tapping it opens the
 * picker sheet, which keeps the palette and the full grid.
 */
import { View } from 'react-native';

import { useColors } from '@/features/session/store';

export function ColorSwatch({ color, size = 18 }: { color: string; size?: number }) {
  const c = useColors();
  const half = size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        backgroundColor: '#FFFFFF',
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: half, backgroundColor: '#C7CBD4' }} />
      <View style={{ position: 'absolute', right: 0, bottom: 0, width: half, height: half, backgroundColor: '#C7CBD4' }} />
      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: color }} />
    </View>
  );
}
