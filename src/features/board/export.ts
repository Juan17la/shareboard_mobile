/**
 * Getting a board off the device.
 *
 * Rendering to pixels is the caller's job — the Skia canvas in the export sheet
 * produces base64 through `makeImageSnapshot().encodeToBase64()`. This module
 * turns those bytes into a real file and hands it to the OS, because both
 * destinations need a file on disk: the share sheet takes a `file://` URI, and
 * the media library imports from a path rather than from memory.
 *
 * On the way through, the board's own snapshot is written *inside* the picture
 * (`features/board/embed.ts`), which is what lets the same PNG come back as an
 * editable board rather than a flat image. A `.json` export is still offered
 * for anyone who wants the data on its own.
 *
 * See docs/06-loading-exporting.
 */
import { File, Paths } from 'expo-file-system';

import { embedSnapshot } from './embed';
import type { BoardSnapshot } from './model';

export type ImageFormat = 'png' | 'jpg';

export interface ImageExportInput {
  boardName: string;
  format: ImageFormat;
  /** Base64 image bytes, from `SkImage.encodeToBase64`. */
  base64: string;
  /**
   * Embedded so the export can be re-imported with its elements intact. Omit
   * to write a plain picture.
   */
  snapshot?: BoardSnapshot | null;
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * Board names are free text, so everything outside `[A-Za-z0-9_-]` is replaced
 * before it reaches the filesystem — a name containing `/` would otherwise be
 * read as a path.
 */
export function exportFileName(boardName: string, ext: 'png' | 'jpg' | 'json'): string {
  const safe = (boardName || 'board').replace(/[^\w-]+/g, '_').slice(0, 40);
  return `shareboard_${safe}_${stamp()}.${ext}`;
}

/**
 * Writes to the cache directory, which the OS may clear whenever it likes —
 * correct for a scratch file that is immediately handed to another app.
 */
function writeCacheFile(fileName: string, contents: string, encoding: 'base64' | 'utf8'): string {
  const file = new File(Paths.cache, fileName);
  // A repeat export within the same minute lands on the same name.
  if (file.exists) file.delete();
  file.create();
  file.write(contents, { encoding });
  return file.uri;
}

/** The picture bytes with the board tucked inside, ready to write. */
function renderBytes(input: ImageExportInput): string {
  return input.snapshot
    ? embedSnapshot(input.base64, input.format, input.snapshot)
    : input.base64;
}

export async function saveImageToPhotos(input: ImageExportInput): Promise<void> {
  // Loaded on demand rather than at module scope. The photo library is only
  // ever touched by this one function, and its native module is missing on
  // platforms that have no photo library — importing it up top makes the whole
  // export module (and so the export sheet, and so the board screen) fail to
  // load there instead of failing at the point of use.
  const MediaLibrary = await import('expo-media-library');
  // `true` asks for write-only access. Saving a picture does not require the
  // right to read the user's library, and on Android 13+ the narrower request
  // is the one the system actually grants for this.
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new Error('Photo library permission is required to save the image.');
  }

  const uri = writeCacheFile(exportFileName(input.boardName, input.format), renderBytes(input), 'base64');
  // The old `MediaLibrary.saveToLibraryAsync` still exists as an export but
  // throws as soon as it is called; `Asset.create` is its replacement.
  await MediaLibrary.Asset.create(uri);
}

async function share(uri: string, mimeType: string, dialogTitle: string, uti: string) {
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: uti });
}

export async function shareImage(input: ImageExportInput): Promise<void> {
  const uri = writeCacheFile(exportFileName(input.boardName, input.format), renderBytes(input), 'base64');
  const png = input.format === 'png';
  await share(uri, png ? 'image/png' : 'image/jpeg', 'Share whiteboard', png ? 'public.png' : 'public.jpeg');
}

export async function shareSnapshot(snapshot: BoardSnapshot): Promise<void> {
  const uri = writeCacheFile(
    exportFileName(snapshot.meta.name, 'json'),
    JSON.stringify(snapshot, null, 2),
    'utf8',
  );
  await share(uri, 'application/json', 'Export whiteboard file', 'public.json');
}
