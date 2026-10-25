/**
 * What is on the board and still, drawn as recorded pictures and, while the
 * camera rests, as one image of the screen.
 *
 * Skia draws on the UI thread, and it used to draw every element on every
 * frame — a stroke under the pen repainted the 2,000 already on the board. Two
 * layers of caching take that away:
 *
 * - The elements are cut into chunks of about `CHUNK`, each recorded once into
 *   a picture (`SkPicture`) over its bounds, so it replays as one node and
 *   Skia's R-tree skips what is off screen. A chunk's cut falls after an
 *   element whose id hashes to 0 (mod `CHUNK`): it belongs to the element, not
 *   to its place in the list, so a stroke added or erased re-records only its
 *   own chunk. Until its picture is ready a chunk is drawn as ordinary nodes,
 *   so nothing blinks out or changes order.
 * - Once every chunk is recorded, they are painted together, on the UI thread,
 *   into one screen-sized image at the camera the board last settled on. While
 *   the live camera is that camera (drawing, typing, selecting: most of the
 *   time) the frame draws that image and nothing else from the board; while a
 *   pan or a pinch moves it, the pictures are drawn instead, and a new image is
 *   painted when it settles.
 *
 * Images stay ordinary nodes: `useImage` decodes asynchronously, and a picture
 * recorded before the decode would hold an empty frame. ponytail: a board with
 * an image gets the pictures but not the screen image; decode images up front
 * if boards full of photos need it.
 */
import { Group, Image, Picture, Skia, drawAsPicture, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useReducer } from 'react';
import { PixelRatio } from 'react-native';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { useTypefaces } from '@/components/board/BoardFonts';
import { ElementRenderer } from '@/components/board/ElementRenderer';
import { elementBounds, type Bounds } from '@/features/board/geometry';
import type { BoardElement } from '@/features/board/model';
import { useBoardStore, type Camera } from '@/features/board/store';

const PERF_LOG = process.env.EXPO_PUBLIC_PERF_HUD === '1';
const CHUNK = 128;
/** Board units kept round a chunk's bounds: line widths, markers, a sticky note's shadow. */
const BLEED = 64;

function cutsAfter(id: string): boolean {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 0) % CHUNK === 0;
}

function chunksOf(list: readonly BoardElement[]): BoardElement[][] {
  const chunks: BoardElement[][] = [];
  let chunk: BoardElement[] = [];
  for (const el of list) {
    chunk.push(el);
    if (cutsAfter(el.id)) {
      chunks.push(chunk);
      chunk = [];
    }
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

// Bounds once per element object (elements are replaced, never mutated).
const boxes = new WeakMap<BoardElement, Bounds>();
function boundsOf(el: BoardElement): Bounds {
  let b = boxes.get(el);
  if (!b) boxes.set(el, (b = elementBounds(el)));
  return b;
}
function union(boxes: Iterable<Bounds>, bleed: number): Bounds {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  return { x: x0 - bleed, y: y0 - bleed, width: x1 - x0 + bleed * 2, height: y1 - y0 + bleed * 2 };
}
const meets = (a: Bounds, b: Bounds) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const rect = (b: Bounds) => Skia.XYWHRect(b.x, b.y, b.width, b.height);
const rectOf = (b: Bounds) => {
  'worklet';
  return Skia.XYWHRect(b.x, b.y, Math.max(0, b.width), Math.max(0, b.height));
};

interface Recorded {
  members: readonly BoardElement[];
  /** What else the drawing depended on: the look and the loaded typefaces. */
  look: string;
  faces: object;
  picture: SkPicture;
  bounds: Bounds;
}
// By the chunk's first element; checked member by member before it is used.
const recorded = new WeakMap<BoardElement, Recorded>();
// A chunk being recorded, and for which look and typefaces: a typeface that
// lands meanwhile makes that recording stale, and the chunk is recorded again.
const recording = new WeakMap<readonly BoardElement[], { look: string; faces: object }>();

const sameMembers = (a: readonly BoardElement[], b: readonly BoardElement[]) =>
  a.length === b.length && a.every((el, i) => el === b[i]);

const EMPTY = (() => {
  const recorder = Skia.PictureRecorder();
  recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return recorder.finishRecordingAsPicture();
})();

/** The screen image: what it shows (`key`), from where (`cam`). */
interface Shot {
  image: SkImage;
  key: number;
  cam: Camera;
}
let nextKey = 1;

/** Paints `picture` as seen through `cam` into a `width`×`height` image (UI thread). */
function paintShot(target: SharedValue<Shot | null>, retired: SharedValue<SkImage | null>, picture: SkPicture, key: number, cam: Camera, width: number, height: number, ratio: number) {
  'worklet';
  const surface = Skia.Surface.MakeOffscreen(Math.ceil(width * ratio), Math.ceil(height * ratio));
  if (!surface) return;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  canvas.scale(ratio, ratio);
  canvas.translate(cam.x, cam.y);
  canvas.scale(cam.scale, cam.scale);
  canvas.drawPicture(picture);
  surface.flush();
  // The image this one replaces may still be read by a mapper for a frame:
  // it is freed one image later.
  retired.get()?.dispose();
  retired.set(target.get()?.image ?? null);
  target.set({ image: surface.makeImageSnapshot(), key, cam });
}

export function BoardPictures({
  elements,
  smooth,
  dark,
  width,
  height,
  camera,
}: {
  /** In paint order; none of them being dragged, typed, erased or held. */
  elements: readonly BoardElement[];
  smooth: boolean;
  dark: boolean;
  width: number;
  height: number;
  /** The live camera, on the UI thread. */
  camera: SharedValue<Camera>;
}) {
  const faces = useTypefaces();
  const look = `${smooth}:${dark}`;
  const [landings, landed] = useReducer((n: number) => n + 1, 0);
  const chunks = useMemo(() => chunksOf(elements), [elements]);

  const ready = (chunk: readonly BoardElement[]) => {
    const r = recorded.get(chunk[0]);
    return r && r.look === look && r.faces === faces && sameMembers(r.members, chunk) ? r : null;
  };

  useEffect(() => {
    let live = true;
    (async () => {
      for (const chunk of chunks) {
        if (!live) return;
        const pending = recording.get(chunk);
        if (ready(chunk) || (pending?.look === look && pending.faces === faces)) continue;
        if (chunk.some((el) => el.kind === 'image')) continue;
        recording.set(chunk, { look, faces });
        const bounds = union(chunk.map(boundsOf), BLEED);
        const picture = await drawAsPicture(
          <Group>
            {chunk.map((el) => (
              <ElementRenderer key={el.id} el={el} smooth={smooth} dark={dark} />
            ))}
          </Group>,
          rect(bounds),
        );
        recorded.set(chunk[0], { members: chunk, look, faces, picture, bounds });
        if (PERF_LOG) console.log(`picture: ${chunk.length} elements, ${chunks.filter((c) => ready(c)).length}/${chunks.length} chunks ready`);
        if (live) landed();
      }
    })().catch((e: unknown) => console.warn('[BoardPictures] recording failed', e));
    return () => {
      live = false;
    };
    // `ready` reads only what is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, look, faces, smooth, dark]);

  // Every chunk recorded: the whole board as one picture, and a key for it.
  const whole = useMemo(() => {
    const all = chunks.map(ready);
    if (!all.every((r) => r)) return null;
    const records = all as Recorded[];
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(rect(records.length ? union(records.map((r) => r.bounds), 0) : { x: 0, y: 0, width: 1, height: 1 }));
    for (const r of records) canvas.drawPicture(r.picture);
    return { picture: recorder.finishRecordingAsPicture(), key: nextKey++ };
    // `landings` is when a chunk's picture arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, look, faces, landings]);

  // The camera as of the last time it settled: the screen image is painted
  // from there, and the view (a screen wider on every side, so a pan of up to
  // a screen shows what was just off it) is culled to it.
  const settled = useBoardStore((s) => s.camera);
  const view = useMemo<Bounds | null>(() => {
    if (!width || !height) return null;
    const w = width / settled.scale;
    const h = height / settled.scale;
    return { x: -settled.x / settled.scale - w, y: -settled.y / settled.scale - h, width: w * 3, height: h * 3 };
  }, [settled, width, height]);

  const shot = useSharedValue<Shot | null>(null);
  const retired = useSharedValue<SkImage | null>(null);
  useEffect(() => {
    if (!whole || !width || !height) return;
    scheduleOnUI(paintShot, shot, retired, whole.picture, whole.key, settled, width, height, PixelRatio.get());
  }, [whole, settled, width, height, shot, retired]);

  // What the frame draws, worked out on the UI thread from the live camera:
  // - the image, while it shows this board at this zoom. It sits in the
  //   camera's group, where its screen lies on the board, so a pan carries it;
  // - the pictures, only where the image does not reach: nowhere while the
  //   camera rests, the strips a pan has uncovered (a band across, a band down,
  //   clipped, so the R-tree skips the rest), and everywhere during a pinch.
  const key = whole?.key ?? 0;
  const layout = useDerivedValue(() => {
    const s = shot.get();
    const c = camera.get();
    const none = { x: 0, y: 0, width: 0, height: 0 };
    if (!s || s.key !== key || s.cam.scale !== c.scale) {
      return { image: null, full: true, across: none, down: none, at: none };
    }
    const at = { x: -s.cam.x / c.scale, y: -s.cam.y / c.scale, width: width / c.scale, height: height / c.scale };
    const vx = -c.x / c.scale;
    const vy = -c.y / c.scale;
    const dx = vx - at.x;
    const dy = vy - at.y;
    const across = dy > 0
      ? { x: vx, y: at.y + at.height, width: at.width, height: dy }
      : { x: vx, y: vy, width: at.width, height: -dy };
    // The band down stops where the band across starts: nothing is drawn twice.
    const top = Math.max(vy, at.y);
    const bottom = Math.min(vy + at.height, at.y + at.height);
    const down = dx > 0
      ? { x: at.x + at.width, y: top, width: dx, height: bottom - top }
      : { x: vx, y: top, width: -dx, height: bottom - top };
    return { image: s.image, full: false, across, down, at };
  }, [key, width, height]);
  const all = whole?.picture ?? EMPTY;
  const image = useDerivedValue(() => layout.get().image);
  const full = useDerivedValue(() => (layout.get().full ? all : EMPTY), [all]);
  const bands = useDerivedValue(() => (layout.get().full ? EMPTY : all), [all]);
  const across = useDerivedValue(() => rectOf(layout.get().across));
  const down = useDerivedValue(() => rectOf(layout.get().down));
  const x = useDerivedValue(() => layout.get().at.x);
  const y = useDerivedValue(() => layout.get().at.y);
  const w = useDerivedValue(() => layout.get().at.width);
  const h = useDerivedValue(() => layout.get().at.height);

  if (whole) {
    return (
      <>
        <Picture picture={full} />
        <Image image={image} x={x} y={y} width={w} height={h} fit="fill" />
        <Group clip={across}>
          <Picture picture={bands} />
        </Group>
        <Group clip={down}>
          <Picture picture={bands} />
        </Group>
      </>
    );
  }
  return chunks.map((chunk) => {
    const r = ready(chunk);
    if (r) return view && !meets(r.bounds, view) ? null : <Picture key={chunk[0].id} picture={r.picture} />;
    return (
      <Group key={chunk[0].id}>
        {chunk.map((el) =>
          view && !meets(boundsOf(el), view) ? null : (
            <ElementRenderer key={el.id} el={el} smooth={smooth} dark={dark} />
          ),
        )}
      </Group>
    );
  });
}
