/**
 * base64 <-> bytes.
 *
 * Every image that crosses this app's boundaries is base64: Skia hands back an
 * encoded snapshot as base64, `expo-file-system` reads and writes it as base64,
 * and an inline image element carries a `data:` URI. Turning that into real
 * bytes is what lets `features/board/embed.ts` reach inside a PNG or JPEG.
 *
 * Hermes ships `atob`/`btoa` and `TextEncoder` (React Native ≥ 0.74), so only
 * the decoder is still written by hand.
 */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  // Chunked: `String.fromCharCode(...bytes)` blows the argument limit on a
  // multi-megabyte image.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  // Tolerate whitespace and the URL-safe alphabet; a base64 string that has
  // been through a file, a data: URI and a JSON round trip picks up both.
  const clean = base64.replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
}

/** UTF-8 text -> bytes. */
export const textToBytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * bytes -> UTF-8 text. Invalid sequences become U+FFFD rather than throwing.
 * ponytail: hand-rolled because `TextDecoder` is not guaranteed on Hermes;
 * swap for `new TextDecoder().decode(bytes)` once the RN target ships it.
 */
export function bytesToText(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let cp: number;
    let width: number;
    if (b < 0x80) {
      cp = b;
      width = 1;
    } else if ((b & 0xe0) === 0xc0) {
      cp = b & 0x1f;
      width = 2;
    } else if ((b & 0xf0) === 0xe0) {
      cp = b & 0x0f;
      width = 3;
    } else if ((b & 0xf8) === 0xf0) {
      cp = b & 0x07;
      width = 4;
    } else {
      out += '�';
      i += 1;
      continue;
    }
    if (i + width > bytes.length) {
      out += '�';
      break;
    }
    for (let k = 1; k < width; k++) cp = (cp << 6) | (bytes[i + k] & 0x3f);
    out += String.fromCodePoint(cp);
    i += width;
  }
  return out;
}

/** ASCII/Latin-1 text -> bytes, for the fixed markers inside image containers. */
export const asciiToBytes = (text: string): Uint8Array =>
  Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);

export const bytesToAscii = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => String.fromCharCode(b)).join('');
