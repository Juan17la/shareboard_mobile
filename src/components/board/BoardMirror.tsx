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
import { useCallback, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { useBoardStore } from '@/features/board/store';

import type { SceneSize } from '../ui/Glass';

const ENABLED = Platform.OS === 'android';
/** Snapshot cadence while the board is changing. */
const EVERY_MS = 90;

export function useBoardMirror(canvasRef: RefObject<CanvasRef | null>) {
  const [image, setImage] = useState<SkImage | null>(null);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!ENABLED) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let again = false;
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
      setImage(next);
    };

    const schedule = () => {
      if (timer) {
        again = true;
        return;
      }
      void capture();
      timer = setTimeout(() => {
        timer = null;
        if (again) {
          again = false;
          schedule();
        }
      }, EVERY_MS);
    };

    const unsub = useBoardStore.subscribe((s, prev) => {
      if (
        s.elements !== prev.elements ||
        s.camera !== prev.camera ||
        s.liveStroke !== prev.liveStroke ||
        s.liveShape !== prev.liveShape
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

  // Frees each snapshot once the next one has replaced it, and the last one on
  // unmount.
  useEffect(() => () => image?.dispose(), [image]);

  return useCallback(
    (size: SceneSize): ReactNode => (
      <>
        {/* The canvas surface is transparent where nothing is drawn; the white
            comes from the view behind it, so paint it here too. */}
        <Rect x={0} y={0} width={size.width} height={size.height} color="#FFFFFF" />
        {image ? (
          <Image image={image} x={0} y={0} width={size.width} height={size.height} fit="fill" />
        ) : null}
      </>
    ),
    [image],
  );
}
