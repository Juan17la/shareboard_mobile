/**
 * The ground behind the home, nickname and PIN screens: the whiteboard itself,
 * its colour and its dot grid, so those screens sit over a board, plain as
 * signage. Purely decorative, so the layer is `pointerEvents="none"` and carries no
 * accessibility node.
 *
 * It is drawn with Skia so the same scene can be handed to a `GlassScene`.
 */
import { Group, Rect, Canvas } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { useColors } from '@/features/session/store';
import { DotGrid } from '../board/ElementRenderer';

/** The ground as Skia nodes, in the coordinates of a `width` × `height` layer. */
export function BackdropScene({ width, height }: { width: number; height: number }) {
  const c = useColors();
  if (width <= 0 || height <= 0) return null;
  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color={c.background} />
      <DotGrid width={width} height={height} camera={{ x: 13, y: 13, scale: 1 }} />
    </Group>
  );
}

export function Backdrop() {
  // Drawn at the size this layer is actually given, not the window's: with
  // edge-to-edge on Android the window height stops short of the screen, and
  // the ground would end in a white band above the nav bar. The window size is
  // only the first-frame guess until `onLayout` reports.
  const window = useWindowDimensions();
  const c = useColors();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const width = size?.width ?? window.width;
  const height = size?.height ?? window.height;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  };

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.background }}
    >
      <Canvas style={{ flex: 1 }}>
        <BackdropScene width={width} height={height} />
      </Canvas>
    </View>
  );
}
