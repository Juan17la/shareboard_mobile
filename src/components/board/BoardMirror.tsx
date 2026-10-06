/**
 * A throttled snapshot of the board canvas, as the scene the board's glass
 * panels blur (see ui/Glass).
 *
 * Only Android needs it — iOS blurs natively — and only while something is
 * changing: the store is watched for the things that repaint the canvas
 * (elements, camera, the stroke under the finger) and a fresh snapshot is
 * taken at most every `EVERY_MS`. Snapshots are full-screen images, so the
 * previous one is disposed as soon as the next arrives.
 *
 * A rotation repaints the canvas too, without touching the store, and the old
 * snapshot would otherwise be stretched to the new size until the next stroke
 * — so the window size is watched as well.
 */
import { Image, Rect, type CanvasRef, type SkImage } from '@shopify/react-native-skia';
import { useCallback, useEffect, type ReactNode, type RefObject } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { create } from 'zustand';

import { useBoardStore } from '@/features/board/store';
import { useColors } from '@/features/session/store';

import { GlassScene, NoGlassScene, type SceneSize } from '../ui/Glass';

// `EXPO_PUBLIC_NO_MIRROR=1` turns the snapshots off, to measure what they cost.
const ENABLED = Platform.OS === 'android' && process.env.EXPO_PUBLIC_NO_MIRROR !== '1';
/**
 * How long the board holds still before it is photographed. Not while it
 * moves: a snapshot is a full-screen GPU read-back, and taking one every
 * ~90 ms during a pan or a stroke was a large part of what the frame rate
 * paid for the frosted panels. They show the board as it was a moment ago
 * until it settles — blurred and small, that is hard to see.
 */
const IDLE_MS = 140;
/** How long a replaced snapshot is kept: the panels' canvases render on their own schedule. */
const DISPOSE_AFTER_MS = 1000;

/**
 * The latest snapshot, in a store of its own so a new one re-renders the
 * panels' blur canvases and nothing else — it used to be board-screen state,
 * and the whole screen rendered once per snapshot.
 */
const useMirrorImage = create<{ image: SkImage | null }>(() => ({ image: null }));

function publish(next: SkImage | null) {
  const prev = useMirrorImage.getState().image;
  useMirrorImage.setState({ image: next });
  if (prev) setTimeout(() => prev.dispose(), DISPOSE_AFTER_MS);
}

/** What each panel's blur canvas paints as the scene behind it. */
function MirrorLayer({ width, height, ground }: { width: number; height: number; ground: string }) {
  const image = useMirrorImage((s) => s.image);
  return (
    <>
      {/* The canvas surface is transparent where nothing is drawn; the ground
          comes from the view behind it, so paint it here too. */}
      <Rect x={0} y={0} width={width} height={height} color={ground} />
      {image ? <Image image={image} x={0} y={0} width={width} height={height} fit="fill" /> : null}
    </>
  );
}

export function useBoardMirror(canvasRef: RefObject<CanvasRef | null>) {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!ENABLED) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let gone = false;

    const capture = async () => {
      // The canvas repaints on the frame after the store changes; waiting one
      // frame means the snapshot shows the change rather than the state before.
      // A rotation re-lays out first and repaints after, so give it two.
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      const canvas = canvasRef.current;
      if (!canvas || gone) return;
      let next: SkImage | null = null;
      try {
        next = await canvas.makeImageSnapshotAsync();
      } catch {
        return;
      }
      if (gone) {
        next.dispose();
        return;
      }
      publish(next);
    };

    // Every change pushes the snapshot back; it is taken once things go quiet.
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void capture();
      }, IDLE_MS);
    };

    const unsub = useBoardStore.subscribe((s, prev) => {
      if (
        s.elements !== prev.elements ||
        s.camera !== prev.camera ||
        s.liveStroke !== prev.liveStroke ||
        s.liveShape !== prev.liveShape ||
        s.liveSketch !== prev.liveSketch ||
        s.liveErased !== prev.liveErased
      ) {
        schedule();
      }
    });
    schedule();

    return () => {
      gone = true;
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [canvasRef, width, height]);

  // The last snapshot goes with the board screen.
  useEffect(() => () => publish(null), []);

  const c = useColors();
  return useCallback(
    (size: SceneSize): ReactNode => (
      <MirrorLayer width={size.width} height={size.height} ground={c.background} />
    ),
    [c.background],
  );
}

/**
 * The board's last snapshot as the scene for surfaces in a `Modal` (sheets,
 * dialogs), which sit outside the board screen's `GlassScene`: their panel
 * blurs the board with the modal's scrim (`veil`) painted over it, as it shows
 * on screen. A full-screen modal shares the board's coordinates, so the panels
 * line up with what is under them. Without a snapshot (iOS, no board open)
 * the panels keep their tinted fallback. What scrolls inside the panel cannot
 * be followed, so callers wrap their content in `NoGlassScene`.
 */
export function MirrorScene({ veil, children }: { veil: string; children: ReactNode }) {
  const ready = useMirrorImage((s) => s.image !== null);
  const c = useColors();
  const render = useCallback(
    (size: SceneSize) => (
      <>
        <MirrorLayer width={size.width} height={size.height} ground={c.background} />
        <Rect x={0} y={0} width={size.width} height={size.height} color={veil} />
      </>
    ),
    [c.background, veil],
  );
  if (!ready) return <NoGlassScene>{children}</NoGlassScene>;
  return <GlassScene render={render}>{children}</GlassScene>;
}
