/**
 * A minimal QR Code encoder — byte mode, error-correction level M, versions 1
 * to 10 (up to 216 data bytes, comfortably more than any board link).
 *
 * It is here rather than in a dependency because the only thing the app needs
 * is one small matrix of booleans for one short URL. The available React Native
 * QR packages each pull in a full generator plus their own renderer, and the
 * renderer is the part that would have to be fought to match the design's
 * rounded, inset code block anyway.
 *
 * The implementation follows ISO/IEC 18004: encode the payload into codewords,
 * split them into blocks, append Reed-Solomon error correction over GF(256),
 * interleave, lay the bits into the matrix in the zig-zag order, then pick the
 * mask that scores lowest against the four penalty rules.
 *
 * Verified module-for-module against the `qrcode` npm package for a spread of
 * payload lengths across every supported version (see `encode.test.ts` notes in
 * docs/06-loading-exporting).
 */

/** Error-correction level. Only M is used, but the format bits need the value. */
const ECC_M_FORMAT_BITS = 0b00;

interface VersionSpec {
  /** Error-correction codewords per block. */
  ecPerBlock: number;
  /** [blockCount, dataCodewordsPerBlock] for the one or two block groups. */
  groups: [number, number][];
}

/** Versions 1-10 at ECC level M (ISO/IEC 18004 table 9). */
const VERSIONS: Record<number, VersionSpec> = {
  1: { ecPerBlock: 10, groups: [[1, 16]] },
  2: { ecPerBlock: 16, groups: [[1, 28]] },
  3: { ecPerBlock: 26, groups: [[1, 44]] },
  4: { ecPerBlock: 18, groups: [[2, 32]] },
  5: { ecPerBlock: 24, groups: [[2, 43]] },
  6: { ecPerBlock: 16, groups: [[4, 27]] },
  7: { ecPerBlock: 18, groups: [[4, 31]] },
  8: { ecPerBlock: 22, groups: [[2, 38], [2, 39]] },
  9: { ecPerBlock: 22, groups: [[3, 36], [2, 37]] },
  10: { ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
};

/** Row/column centres of the alignment patterns, by version. */
const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const dataCapacity = (version: number): number =>
  VERSIONS[version].groups.reduce((sum, [blocks, size]) => sum + blocks * size, 0);

// --- GF(256) ---------------------------------------------------------------
// Reed-Solomon works over the field defined by the primitive polynomial 0x11D.
// Precomputing the log/antilog tables turns every multiply into two lookups.

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** The generator polynomial for `degree` error-correction codewords. */
function generatorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let d = 0; d < degree; d++) {
    const next = new Uint8Array(poly.length + 1);
    for (let i = 0; i < poly.length; i++) {
      next[i] ^= poly[i];
      next[i + 1] ^= gfMul(poly[i], EXP[d]);
    }
    poly = next;
  }
  return poly;
}

/** Polynomial division remainder — the block's error-correction codewords. */
function ecCodewords(data: Uint8Array, count: number): Uint8Array {
  const gen = generatorPoly(count);
  const remainder = new Uint8Array(count);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[count - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < count; i++) remainder[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return remainder;
}

// --- bit stream ------------------------------------------------------------

class BitBuffer {
  private bits: number[] = [];

  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }

  get length(): number {
    return this.bits.length;
  }

  /** Pads to a byte boundary and returns the codewords. */
  toBytes(): Uint8Array {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, i) => {
      if (bit) out[i >> 3] |= 0x80 >> (i & 7);
    });
    return out;
  }
}

/** UTF-8 bytes of the payload — byte mode is defined over octets, not chars. */
function utf8Bytes(text: string): number[] {
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
  return out;
}

function chooseVersion(byteLength: number): number {
  for (let v = 1; v <= 10; v++) {
    // 4 mode bits + the character-count field, rounded up to whole codewords.
    const countBits = v < 10 ? 8 : 16;
    if (byteLength + Math.ceil((4 + countBits) / 8) <= dataCapacity(v)) return v;
  }
  throw new Error('Payload is too long for a version-10 QR code');
}

/** Data codewords for the payload: header, bytes, terminator, alternating pad. */
function encodePayload(bytes: number[], version: number): Uint8Array {
  const capacity = dataCapacity(version);
  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // byte mode
  buffer.put(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) buffer.put(byte, 8);
  // Terminator: up to four zero bits, then zero-fill to the byte boundary.
  buffer.put(0, Math.min(4, capacity * 8 - buffer.length));
  if (buffer.length % 8 !== 0) buffer.put(0, 8 - (buffer.length % 8));

  const out = new Uint8Array(capacity);
  out.set(buffer.toBytes());
  for (let i = buffer.toBytes().length; i < capacity; i++) {
    out[i] = i % 2 === buffer.toBytes().length % 2 ? 0xec : 0x11;
  }
  return out;
}

/** Splits into blocks, adds EC, and interleaves both halves as the spec requires. */
function buildCodewords(data: Uint8Array, version: number): Uint8Array {
  const { ecPerBlock, groups } = VERSIONS[version];
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  let offset = 0;
  for (const [blockCount, size] of groups) {
    for (let b = 0; b < blockCount; b++) {
      const block = data.slice(offset, offset + size);
      offset += size;
      dataBlocks.push(block);
      ecBlocks.push(ecCodewords(block, ecPerBlock));
    }
  }

  const out: number[] = [];
  const longest = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < longest; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return Uint8Array.from(out);
}

// --- matrix ----------------------------------------------------------------

type Matrix = (boolean | null)[][];

function blankMatrix(size: number): Matrix {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

function placeFinder(m: Matrix, row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
      const onRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      m[rr][cc] = onRing || inCore;
    }
  }
}

function placeFunctionPatterns(m: Matrix, version: number): void {
  const size = m.length;
  placeFinder(m, 0, 0);
  placeFinder(m, 0, size - 7);
  placeFinder(m, size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }

  // Alignment patterns, skipping the three that would sit on a finder.
  const centres = ALIGNMENT[version];
  for (const r of centres) {
    for (const c of centres) {
      const nearFinder =
        (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          m[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        }
      }
    }
  }

  // The always-dark module just above the bottom-left finder.
  m[size - 8][8] = true;

  // Reserve the format areas so data placement skips them.
  for (let i = 0; i <= 8; i++) {
    if (m[8][i] === null) m[8][i] = false;
    if (m[i][8] === null) m[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = false;
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = false;
  }

  // Version information blocks (version 7 and up).
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1;
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      m[r][c] = bit;
      m[c][r] = bit;
    }
  }
}

/** 18-bit BCH version information. */
function versionBits(version: number): number {
  let value = version << 12;
  for (let i = 0; i < 6; i++) {
    if (value & (1 << (17 - i))) value ^= 0x1f25 << (5 - i);
  }
  return (version << 12) | value;
}

/** 15-bit BCH format information, masked with the fixed pattern. */
function formatBits(mask: number): number {
  const data = (ECC_M_FORMAT_BITS << 3) | mask;
  let value = data << 10;
  for (let i = 0; i < 5; i++) {
    if (value & (1 << (14 - i))) value ^= 0x537 << (4 - i);
  }
  return ((data << 10) | value) ^ 0x5412;
}

function placeFormat(m: Matrix, mask: number): void {
  const size = m.length;
  const bits = formatBits(mask);
  for (let i = 0; i < 15; i++) {
    const bit = ((bits >> i) & 1) === 1;
    // Copy 1: down the left column and along the top row, skipping timing.
    if (i < 6) m[i][8] = bit;
    else if (i < 8) m[i + 1][8] = bit;
    else if (i === 8) m[8][7] = bit;
    else m[8][14 - i] = bit;
    // Copy 2: bottom-left column and top-right row.
    if (i < 8) m[8][size - 1 - i] = bit;
    else m[size - 15 + i][8] = bit;
  }
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Lays the codeword bits in the upward/downward zig-zag over the free modules. */
function placeData(m: Matrix, codewords: Uint8Array): [number, number][] {
  const size = m.length;
  const free: [number, number][] = [];
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    // Column 6 is the vertical timing pattern; the zig-zag steps over it.
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (m[row][col] !== null) continue;
        const byte = codewords[bitIndex >> 3] ?? 0;
        m[row][col] = ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
        free.push([row, col]);
        bitIndex++;
      }
    }
    upward = !upward;
  }
  return free;
}

/**
 * The four penalty rules of ISO/IEC 18004 §8.8.2; the mask scoring lowest wins.
 *
 * The rules are stated in the standard as prose about "adjacent modules of the
 * same colour", and implementations differ in the rounding of rule 4 and in
 * whether rule 3 counts a pattern with clear runs on *both* sides once or
 * twice. This follows the widely-deployed reading (the same one the `qrcode`
 * npm package uses), which is what the module-for-module comparison in the
 * header comment is against.
 */
function penalty(m: boolean[][]): number {
  const size = m.length;
  let score = 0;

  // Rule 1 — runs of five or more same-coloured modules in a row or column.
  const runs = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i++) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (get(i, j) === get(i, j - 1)) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  };
  runs((r, c) => m[r][c]);
  runs((c, r) => m[r][c]);

  // Rule 2 — every 2x2 block of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 3 — the finder-like 1:1:3:1:1 sequence with four light modules on one
  // side. Both orientations are looked for with an 11-module sliding window, so
  // a run that is clear on both sides scores twice.
  const BEFORE = 0b00001011101;
  const AFTER = 0b10111010000;
  for (let i = 0; i < size; i++) {
    let row = 0;
    let col = 0;
    for (let j = 0; j < size; j++) {
      row = ((row << 1) & 0x7ff) | (m[i][j] ? 1 : 0);
      col = ((col << 1) & 0x7ff) | (m[j][i] ? 1 : 0);
      if (j < 10) continue;
      if (row === BEFORE || row === AFTER) score += 40;
      if (col === BEFORE || col === AFTER) score += 40;
    }
  }

  // Rule 4 — how far the proportion of dark modules strays from 50%.
  let dark = 0;
  for (const row of m) for (const cell of row) if (cell) dark++;
  score += Math.abs(Math.ceil((dark * 100) / (size * size) / 5) - 10) * 10;

  return score;
}

export interface QrMatrix {
  size: number;
  /** `true` is a dark module. */
  modules: boolean[][];
}

/** Encodes `text` as a QR code matrix. Throws if it does not fit version 10. */
export function encodeQr(text: string): QrMatrix {
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length);
  const codewords = buildCodewords(encodePayload(bytes, version), version);

  const size = version * 4 + 17;
  const base = blankMatrix(size);
  placeFunctionPatterns(base, version);
  const free = placeData(base, codewords);

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row) => row.slice()) as boolean[][];
    for (const [r, c] of free) {
      if (MASKS[mask](r, c)) candidate[r][c] = !candidate[r][c];
    }
    placeFormat(candidate, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return { size, modules: best! };
}
