/**
 * base64 <-> bytes.
 *
 * Hermes has no `atob`/`btoa` and no Node `Buffer`, but every image that
 * crosses this app's boundaries is base64: Skia hands back an encoded snapshot
 * as base64, `expo-file-system` reads and writes it as base64, and an inline
 * image element carries a `data:` URI. Turning that into real bytes is what
 * lets `features/board/embed.ts` reach inside a PNG or JPEG.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP = (() => {
  const table = new Uint8Array(128).fill(255);
  for (let i = 0; i < ALPHABET.length; i++) table[ALPHABET.charCodeAt(i)] = i;
  return table;
})();

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + '=';
  }
  return out;
}

export function base64ToBytes(base64: string): Uint8Array {
  // Tolerate whitespace and the URL-safe alphabet; a base64 string that has
  // been through a file, a data: URI and a JSON round trip picks up both.
  const clean = base64.replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const length = Math.floor((clean.length * 3) / 4) - padding;
  const out = new Uint8Array(Math.max(0, length));

  let outIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)] ?? 0;
    const b = LOOKUP[clean.charCodeAt(i + 1)] ?? 0;
    const c = LOOKUP[clean.charCodeAt(i + 2)] ?? 0;
    const d = LOOKUP[clean.charCodeAt(i + 3)] ?? 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (outIndex < out.length) out[outIndex++] = (n >> 16) & 255;
    if (outIndex < out.length) out[outIndex++] = (n >> 8) & 255;
    if (outIndex < out.length) out[outIndex++] = n & 255;
  }
  return out;
}

/** UTF-8 text -> bytes. */
export function textToBytes(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
  }
  return Uint8Array.from(out);
}

/** bytes -> UTF-8 text. Invalid sequences become U+FFFD rather than throwing. */
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
export function asciiToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

export function bytesToAscii(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}
