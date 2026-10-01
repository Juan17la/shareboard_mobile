/**
 * Copy and paste between the board and the system clipboard: the long-press
 * menu goes through here (a hand-kept twin of `web/src/features/board-clipboard.ts`).
 *
 * Copy leaves the selection in the store *and* on the system clipboard as
 * `encodeClip` text, so it pastes as the same elements on another board, on
 * the web, or on another phone. The store copy stays as the fallback.
 */
import * as Clipboard from 'expo-clipboard';

import { toast } from '@/components/ui/Toast';

import { decodeClip, encodeClip } from './clip';
import { pasteImage } from './import';
import type { Point } from './model';
import { useBoardStore } from './store';

/** Puts what the store just copied on the system clipboard. */
export function copyToSystem(): void {
  const { clipboard } = useBoardStore.getState();
  if (clipboard.length) Clipboard.setStringAsync(encodeClip(clipboard)).catch(() => {});
}

/**
 * Pastes what the system clipboard holds at `at` (board coordinates): a
 * Shareboard copy as the same elements, a picture as an image, other text as a
 * text element — and with nothing usable the store's own clipboard.
 */
export async function pasteFromSystem(at?: Point): Promise<void> {
  let text = '';
  try {
    text = await Clipboard.getStringAsync();
  } catch {
    // Unreadable: fall through to the store's clipboard.
  }
  const s = useBoardStore.getState();
  const { camera, viewport } = s;
  const spot = at ?? {
    x: (viewport.width / 2 - camera.x) / camera.scale,
    y: (viewport.height / 2 - camera.y) / camera.scale,
  };

  const elements = decodeClip(text);
  if (elements) return s.paste(at, elements);

  try {
    if (!text.trim() && (await Clipboard.hasImageAsync())) {
      const img = await pasteImage();
      if (img.kind === 'image') {
        // Same cap as the import sheet: something that fits the screen at 100%.
        const scale = Math.min(1, 600 / Math.max(img.width, img.height));
        const w = img.width * scale;
        const h = img.height * scale;
        s.addImage({ x: spot.x - w / 2, y: spot.y - h / 2 }, w, h, img.uri);
        return;
      }
    }
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err));
    return;
  }

  const plain = text.trim();
  if (plain) {
    const id = s.addText(spot);
    if (id) s.updateText(id, { text: plain });
    return;
  }
  s.paste(at);
}
