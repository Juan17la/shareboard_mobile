/**
 * Hiding a board's editable snapshot inside the image it was exported as.
 *
 * `docs/01-introduction` left open whether an imported file should be "just a
 * picture" or should come back editable. The design answers it: the import
 * sheet offers a PNG or JPG "exported from Shareboard" together with a
 * *Restore editable strokes and text* switch. For both to be true of the same
 * file, the picture has to carry the board with it.
 *
 * Both container formats have a standard place to put private text, and
 * neither affects how the image renders — a Shareboard export opens as an
 * ordinary picture in any viewer, and only this app notices the extra bytes:
 *
 *   PNG  — a `tEXt` chunk (keyword `shareboard`) inserted after `IHDR`.
 *   JPEG — one or more `COM` (0xFFFE) comment segments after `SOI`, since a
 *          single segment cannot exceed 64 KB.
 *
 * The payload is the same `BoardSnapshot` JSON the `.json` export writes,
 * base64-encoded so it survives containers that assume Latin-1 text.
 */
import {
  asciiToBytes,
  base64ToBytes,
  bytesToAscii,
  bytesToBase64,
  bytesToText,
  textToBytes,
} from '@/utils/base64';

import { parseSnapshot } from './serialization';
import type { BoardSnapshot } from './model';

const PNG_KEYWORD = 'shareboard';
const JPEG_MARKER = 'Shareboard/1';
/** COM segments carry a 16-bit length, so each one holds a little under 64 KB. */
const JPEG_CHUNK = 60_000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type ImageContainer = 'png' | 'jpg';

// --- CRC32, as PNG defines it ---------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const u32 = (value: number): Uint8Array =>
  Uint8Array.from([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);

const readU32 = (bytes: Uint8Array, at: number): number =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

// --- PNG -------------------------------------------------------------------

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typed = concat([asciiToBytes(type), data]);
  return concat([u32(data.length), typed, u32(crc32(typed))]);
}

function embedInPng(bytes: Uint8Array, payload: string): Uint8Array {
  // IHDR is always the first chunk; the text goes straight after it so a reader
  // finds it without walking the (much larger) image data.
  const ihdrEnd = 8 + 8 + readU32(bytes, 8) + 4;
  const chunk = pngChunk(
    'tEXt',
    concat([asciiToBytes(PNG_KEYWORD), Uint8Array.from([0]), asciiToBytes(payload)]),
  );
  return concat([bytes.slice(0, ihdrEnd), chunk, bytes.slice(ihdrEnd)]);
}

function extractFromPng(bytes: Uint8Array): string | null {
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = readU32(bytes, at);
    const type = bytesToAscii(bytes.slice(at + 4, at + 8));
    if (type === 'IEND') return null;
    if (type === 'tEXt') {
      const data = bytes.slice(at + 8, at + 8 + length);
      const split = data.indexOf(0);
      if (split > 0 && bytesToAscii(data.slice(0, split)) === PNG_KEYWORD) {
        return bytesToAscii(data.slice(split + 1));
      }
    }
    at += 12 + length;
  }
  return null;
}

// --- JPEG ------------------------------------------------------------------

function embedInJpeg(bytes: Uint8Array, payload: string): Uint8Array {
  const segments: Uint8Array[] = [];
  const total = Math.ceil(payload.length / JPEG_CHUNK) || 1;
  for (let i = 0; i < total; i++) {
    const body = asciiToBytes(
      `${JPEG_MARKER}:${i}/${total}:${payload.slice(i * JPEG_CHUNK, (i + 1) * JPEG_CHUNK)}`,
    );
    // The declared length includes the two length bytes themselves.
    const length = body.length + 2;
    segments.push(concat([Uint8Array.from([0xff, 0xfe, (length >> 8) & 255, length & 255]), body]));
  }
  return concat([bytes.slice(0, 2), ...segments, bytes.slice(2)]);
}

function extractFromJpeg(bytes: Uint8Array): string | null {
  const parts = new Map<number, string>();
  let expected = 0;
  let at = 2;

  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) break;
    const marker = bytes[at + 1];
    // Start of scan: everything past here is entropy-coded image data.
    if (marker === 0xda || marker === 0xd9) break;
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (marker === 0xfe) {
      const text = bytesToAscii(bytes.slice(at + 4, at + 2 + length));
      const match = /^Shareboard\/1:(\d+)\/(\d+):/.exec(text);
      if (match) {
        expected = Number(match[2]);
        parts.set(Number(match[1]), text.slice(match[0].length));
      }
    }
    at += 2 + length;
  }

  if (!expected || parts.size !== expected) return null;
  let payload = '';
  for (let i = 0; i < expected; i++) {
    const part = parts.get(i);
    if (part === undefined) return null;
    payload += part;
  }
  return payload;
}

// --- public API ------------------------------------------------------------

/**
 * Takes the base64 image Skia produced and returns the same image with the
 * snapshot tucked inside. Falls back to the original bytes if the container is
 * not what it claims to be — an export that loses its editability is far better
 * than an export that fails.
 */
export function embedSnapshot(
  imageBase64: string,
  container: ImageContainer,
  snapshot: BoardSnapshot,
): string {
  try {
    const bytes = base64ToBytes(imageBase64);
    const payload = bytesToBase64(textToBytes(JSON.stringify(snapshot)));
    if (container === 'png') {
      if (!isPng(bytes)) return imageBase64;
      return bytesToBase64(embedInPng(bytes, payload));
    }
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return imageBase64;
    return bytesToBase64(embedInJpeg(bytes, payload));
  } catch {
    return imageBase64;
  }
}

/** The snapshot inside an exported image, or null if it carries none. */
export function extractSnapshot(imageBytes: Uint8Array): BoardSnapshot | null {
  try {
    const payload = isPng(imageBytes)
      ? extractFromPng(imageBytes)
      : imageBytes[0] === 0xff && imageBytes[1] === 0xd8
        ? extractFromJpeg(imageBytes)
        : null;
    if (!payload) return null;
    return parseSnapshot(bytesToText(base64ToBytes(payload)));
  } catch {
    // A file that merely *looks* like one of ours is a normal picture, not an
    // error — the caller falls back to placing it as a flat image.
    return null;
  }
}

/** Sniffs the container so the importer can branch without trusting the name. */
export function detectContainer(bytes: Uint8Array): ImageContainer | 'json' | 'unknown' {
  if (isPng(bytes)) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  // Skip a UTF-8 BOM and any leading whitespace before looking for JSON.
  let at = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  while (at < bytes.length && bytes[at] <= 0x20) at++;
  if (bytes[at] === 0x7b) return 'json';
  return 'unknown';
}
