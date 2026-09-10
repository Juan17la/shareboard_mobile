/**
 * Bringing content in.
 *
 * The design's import sheet is one "Choose file" button plus a *Restore
 * editable strokes and text* switch, and both branches start from the same
 * place: a file the user picked. What happens next depends on what the bytes
 * actually are, not on the file's name —
 *
 *   a `.json` snapshot            -> a new board with every element editable
 *   a Shareboard PNG/JPG          -> the same, read back out of the picture
 *                                    (`embed.ts`), unless the switch is off
 *   any other picture             -> placed on the board as one flat image
 *
 * The flat-image path has a hard constraint behind it. An image element carries
 * its bytes inline as a `data:` URI, and that element travels to the server
 * inside a normal `op` frame — which the socket caps at 256 KB
 * (`REALTIME.maxMessageBytes`). A photo straight off a modern phone is several
 * megabytes, so sending one unmodified does not fail gracefully: the WebSocket
 * layer drops the connection with close code 1009 before the server ever sees
 * the message, the client reconnects, and the image is silently lost.
 *
 * So a picked image is always re-encoded down to something that fits, and if
 * even the smallest attempt is too big it is refused with a readable error
 * rather than being put on the wire. See docs/06-loading-exporting.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

import { bytesToText } from '@/utils/base64';

import { detectContainer, extractSnapshot } from './embed';
import { parseSnapshot, SnapshotParseError } from './serialization';
import type { BoardSnapshot } from './model';

export type ImportResult =
  | { kind: 'snapshot'; snapshot: BoardSnapshot }
  | { kind: 'image'; uri: string; width: number; height: number }
  | { kind: 'canceled' };

/**
 * Budget for an embedded image. The 256 KB frame also has to hold the op
 * envelope, and the outbox may batch this op together with others, so this
 * leaves a wide margin rather than creeping up to the true ceiling.
 */
const MAX_IMAGE_BYTES = 160 * 1024;

/** Tried in order, largest first; the first result that fits is used. */
const ENCODE_ATTEMPTS = [
  { size: 1024, compress: 0.6 },
  { size: 800, compress: 0.5 },
  { size: 640, compress: 0.4 },
];

/**
 * The design's single "Choose file" action.
 *
 * `restoreEditable` is the sheet's switch: with it off, a Shareboard image is
 * treated as an ordinary picture even though it is carrying a board.
 */
export async function pickBoardFile(restoreEditable: boolean): Promise<ImportResult> {
  const picked = await File.pickFileAsync({
    mimeTypes: ['application/json', 'text/json', 'image/png', 'image/jpeg', '*/*'],
  });
  if (picked.canceled) return { kind: 'canceled' };

  let bytes: Uint8Array;
  try {
    bytes = await picked.result.bytes();
  } catch {
    throw new SnapshotParseError('Could not read the selected file.');
  }

  const container = detectContainer(bytes);

  if (container === 'json') {
    return { kind: 'snapshot', snapshot: parseSnapshot(bytesToText(bytes)) };
  }

  if (container === 'png' || container === 'jpg') {
    if (restoreEditable) {
      const embedded = extractSnapshot(bytes);
      if (embedded) return { kind: 'snapshot', snapshot: embedded };
    }
    return shrinkToElement(picked.result.uri);
  }

  throw new SnapshotParseError('That file is not a Shareboard board or an image.');
}

/** Photo-library picker, for dropping a picture onto the current board. */
export async function pickImageFile(): Promise<ImportResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to import an image.');
  }

  // No base64 here: the original is far too large to be worth encoding, and
  // the copy produced below is what actually gets embedded.
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (picked.canceled || !picked.assets?.length) return { kind: 'canceled' };

  return shrinkToElement(picked.assets[0].uri);
}

/** Re-encodes a picture until it fits inside one realtime frame. */
async function shrinkToElement(uri: string): Promise<ImportResult> {
  // One decode up front just to learn the orientation: constraining the *longer*
  // edge is what keeps a tall photo from coming back with far more pixels than
  // a wide one at the same nominal "size".
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  const portrait = probe.height > probe.width;

  for (const attempt of ENCODE_ATTEMPTS) {
    const context = ImageManipulator.manipulate(uri);
    const bound = portrait ? { height: attempt.size } : { width: attempt.size };
    const rendered = await context.resize(bound).renderAsync();
    const out = await rendered.saveAsync({
      compress: attempt.compress,
      format: SaveFormat.JPEG,
      base64: true,
    });

    if (!out.base64) continue;
    // base64 is ASCII, so one character is one byte on the wire.
    if (out.base64.length > MAX_IMAGE_BYTES) continue;

    return {
      kind: 'image',
      uri: `data:image/jpeg;base64,${out.base64}`,
      width: out.width,
      height: out.height,
    };
  }

  throw new Error(
    'That image is too detailed to add to a board. Try a smaller image, or crop it first.',
  );
}
