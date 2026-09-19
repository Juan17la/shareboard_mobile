/**
 * The frosted panel every floating surface in this app is built from.
 *
 * On iOS this is a real `BlurView`: the tool rail, the sheets and the dialogs
 * are meant to sit *over* the board and let the drawing show through, which a
 * flat translucent fill cannot do — the strokes underneath turn muddy instead
 * of softening.
 *
 * Android blurs with Skia instead. expo-blur's Android path was tried and drew
 * the blurred target displaced by a whole screen-width on a Galaxy S25 (a hard
 * seam across the header in landscape, nothing at all in portrait), so panels
 * here draw the *scene behind them* themselves: the screen hands a description
 * of its background to a `GlassScene`, and each panel renders that scene into
 * its own small canvas, shifted by the panel's position on screen and run
 * through a Gaussian blur. The home, nickname and PIN screens' wash is
 * procedural Skia already (`BackdropScene`); the board hands over a throttled
 * snapshot of its canvas (`useBoardMirror`). Panels with no scene in scope —
 * sheets and dialogs live in a `Modal` over a scrim — fall back to a denser
 * translucent tint.
 *
 * Panels find their place with `measureLayout` against the scene's own view,
 * not `measureInWindow`: on Fabric the window position includes the root
 * view's on-screen offset, which the Galaxy S25 reports wrongly in landscape
 * (the scene came out shifted sideways and the header showed a hard vertical
 * seam where the shifted scene ended).
 */
import { Blur, Canvas, Group, Paint, type Transforms3d } from '@shopify/react-native-skia';
import { BlurView } from 'expo-blur';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Platform, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { Colors, Glass, Radius } from '@/constants/theme';

const ABSOLUTE_FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const NATIVE_BLUR = Platform.OS === 'ios';

export type GlassLevel = 'panel' | 'row' | 'chip';

/** Tint painted over the blur. */
const TINT: Record<GlassLevel, string> = {
  panel: Glass.tint,
  row: Glass.tintSolid,
  chip: 'rgba(255,255,255,0.55)',
};

/** Tint with nothing blurred under it, so it has to carry the contrast alone. */
const TINT_UNBLURRED: Record<GlassLevel, string> = {
  panel: 'rgba(255,255,255,0.86)',
  row: 'rgba(255,255,255,0.8)',
  chip: 'rgba(255,255,255,0.8)',
};

const INTENSITY: Record<GlassLevel, number> = { panel: 44, row: 30, chip: 26 };

/** iOS `intensity` → Skia sigma, eyeballed to read the same on both. */
const sigmaFor = (intensity: number) => 6 + intensity * 0.2;

// --- the scene behind the glass ---------------------------------------------

export interface SceneSize {
  width: number;
  height: number;
}

interface SceneValue {
  /** Skia nodes for what is behind the panels, in the scene's coordinates. */
  render: (size: SceneSize) => ReactNode;
  size: SceneSize;
  /** The scene's view — what panels measure their position against. */
  host: RefObject<View | null>;
  /**
   * How far the content the panels sit in has scrolled, as a Skia transform
   * kept on the UI thread. Panels are measured unscrolled (`measureLayout`
   * ignores the scroll view's offset), so this is added on top, live.
   */
  shift: SharedValue<Transforms3d>;
}

const SceneContext = createContext<SceneValue | null>(null);

/**
 * Declares what the glass panels inside it are floating over. Wraps the whole
 * screen so its measured size is the scene's size; its view is also what the
 * panels measure their own position against.
 */
export function GlassScene({
  render,
  scroll,
  children,
  style,
}: {
  render: (size: SceneSize) => ReactNode;
  scroll?: SharedValue<number>;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const host = useRef<View>(null);
  const [size, setSize] = useState<SceneSize>({ width: 0, height: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // A reaction rather than a derived value: `useDerivedValue` seeds itself by
  // running the worklet on the JS thread mid-render, and Reanimated warns
  // about reading `scroll.value` there. The mapper runs once on registration,
  // so the shift is right before the first frame.
  const shift = useSharedValue<Transforms3d>([{ translateY: 0 }]);
  useAnimatedReaction(
    () => scroll?.value ?? 0,
    (y) => {
      shift.value = [{ translateY: y }];
    },
    [scroll],
  );

  const value = useMemo(() => ({ render, size, host, shift }), [render, size, shift]);

  return (
    <SceneContext.Provider value={value}>
      <View ref={host} style={[{ flex: 1 }, style]} onLayout={onLayout}>
        {children}
      </View>
    </SceneContext.Provider>
  );
}

/**
 * Takes the panels inside it out of any scene, back to the tinted fallback —
 * for surfaces in a `Modal`, whose own scrolling the scene cannot follow.
 */
export function NoGlassScene({ children }: { children: ReactNode }) {
  return <SceneContext.Provider value={null}>{children}</SceneContext.Provider>;
}

/**
 * The scene, blurred, filling the parent. Measures where the parent sits on
 * screen and draws the scene shifted by that much, so what shows through is
 * exactly what is underneath.
 */
function SceneBlur({ sigma }: { sigma: number }) {
  const scene = useContext(SceneContext);
  const ref = useRef<View>(null);
  // Position of this layer in the scene, unscrolled (see `SceneValue.shift`).
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const measure = () => {
    const relativeTo = scene?.host.current;
    if (!relativeTo) return;
    ref.current?.measureLayout(relativeTo, (x, y) => setOrigin({ x, y }));
  };

  if (!scene) return null;

  return (
    <View ref={ref} onLayout={measure} pointerEvents="none" style={ABSOLUTE_FILL}>
      {origin ? (
        <Canvas style={{ flex: 1 }}>
          <Group transform={[{ translateX: -origin.x }, { translateY: -origin.y }]}>
            <Group transform={scene.shift}>
              <Group
                layer={
                  <Paint>
                    <Blur blur={sigma} mode="clamp" />
                  </Paint>
                }
              >
                {scene.render(scene.size)}
              </Group>
            </Group>
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}

/** Whether panels here can blur: natively, or through a scene. */
function useBlurs(): boolean {
  const scene = useContext(SceneContext);
  return NATIVE_BLUR || scene !== null;
}

// --- public surfaces ----------------------------------------------------------

/**
 * The bare blur layer, filling its parent, with nothing painted on top —
 * callers bring their own tint or gradient. Renders nothing where blur is
 * unavailable, so a caller that needs a fallback fill has to bring that too.
 */
export function GlassBlur({ intensity }: { intensity: number }) {
  if (NATIVE_BLUR) return <BlurView intensity={intensity} tint="light" style={ABSOLUTE_FILL} />;
  return <SceneBlur sigma={sigmaFor(intensity)} />;
}

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
  const blurs = useBlurs();

  // `overflow: hidden` is what makes the corner radius clip the blur — without
  // it the blur paints square corners (expo-blur docs).
  const shell: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden',
    ...(border ? { borderWidth: 1, borderColor: border } : null),
  };

  if (!blurs) {
    // A translucent view with `elevation` shows its own shadow through itself
    // on Android — the darker lower half that read as "two tones". Without a
    // blur underneath the panel is translucent, so the elevation goes.
    const flat = Object.assign({}, ...(Array.isArray(style) ? style : [style])) as ViewStyle;
    delete flat.elevation;
    return (
      <View
        pointerEvents={pointerEvents}
        style={[shell, { backgroundColor: TINT_UNBLURRED[level] }, flat]}
      >
        {children}
      </View>
    );
  }

  // Android's elevation needs an opaque background to cast a shadow from; the
  // scene canvas paints over it entirely, so it never shows. iOS must stay
  // transparent or the native blur has nothing to look through.
  const ground = NATIVE_BLUR ? null : { backgroundColor: '#FFFFFF' };

  return (
    <View pointerEvents={pointerEvents} style={[shell, ground, style as ViewStyle]}>
      <GlassBlur intensity={INTENSITY[level]} />
      <View pointerEvents="none" style={[ABSOLUTE_FILL, { backgroundColor: TINT[level] }]} />
      {children}
    </View>
  );
}
