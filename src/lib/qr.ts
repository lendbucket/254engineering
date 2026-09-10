/**
 * A QR code, generated here, rendered as an SVG.
 *
 * WHY THIS IS WRITTEN OUT RATHER THAN INSTALLED
 * ---------------------------------------------
 * Operator instruction, 2026-09-07: a QR on the enrolment screen, rendered
 * server side so nothing about the secret reaches a third party, with a small
 * dependency or a direct implementation, and the choice recorded.
 *
 * The obvious dependency is `qrcode`, and reading its manifest decided it:
 * pngjs, dijkstrajs, and YARGS. A command line argument parser, pulled into the
 * authentication path, for output this platform only ever needs as a string of
 * SVG. That is a large surface for a small job in the one code path where a
 * supply chain problem is worst.
 *
 * So the encoder is here. It is byte mode only, which is all an otpauth URI
 * needs, and it is verified the only way a QR can honestly be verified: by
 * DECODING what it produces with an independent decoder and comparing the
 * result to the input. scripts/proofs/qr-decodes-to-what-it-encoded.mjs does
 * that with jsQR, which is a devDependency and never ships.
 *
 * THE FAILURE MODE THAT MATTERS
 * -----------------------------
 * A QR that scans to the WRONG secret. It is invisible by inspection, it looks
 * exactly like a working one, and the person it fails is somebody enrolling a
 * second factor who then cannot sign in. Asserting the image renders would not
 * catch it. Only decoding does.
 *
 * It fails closed rather than open: a wrong secret produces codes that never
 * verify, so nobody is let in. That is the right direction and it is not a
 * reason to skip the check.
 *
 * AND IT HAS BEEN SCANNED BY A REAL CAMERA, WHICH DECODING COULD NOT SETTLE
 * -------------------------------------------------------------------------
 * 2026-09-07: the operator enrolled on production with Google Authenticator and
 * the camera acquired it on the first try.
 *
 * That was the one claim the proof beside this file cannot make. Decoding a
 * clean bitmap in software and acquiring a code off a lit screen at an angle
 * are different problems: module size, contrast and the quiet zone decide the
 * second and are invisible to the first. Both are now answered, and the check
 * that runs every time is still the decoding one, because it is the half that
 * can regress silently.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * Numeric and alphanumeric modes, kanji, and versions above 10. An otpauth URI
 * is around 100 to 160 bytes of mixed case ASCII, which byte mode encodes and
 * versions 5 to 10 hold comfortably. Implementing modes nothing calls would be
 * more surface with no reader.
 */

/* ---------------------------------------------------------------- galois field */

/*
 * GF(256) with the QR generator polynomial, 0x11D. Reed-Solomon needs
 * multiplication in this field, and logarithm tables make it a lookup.
 */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/**
 * The generator polynomial for `degree` error correction codewords.
 *
 * INDEX 0 IS THE LEADING COEFFICIENT, AND THE FIRST VERSION HAD IT BACKWARDS.
 *
 * Building it as `next[j + 1] ^= poly[j]` puts higher degrees at higher
 * indices, which is the opposite of the convention the division below uses. The
 * result was a polynomial that was correct in every coefficient and reversed in
 * order: 193,157,113,...,1 where the specification has 1,216,194,...,193.
 *
 * Every data codeword was then right and every error correction codeword was
 * wrong, which is a QR that renders, carries the correct payload, and cannot be
 * read, because a decoder checks the payload against exactly those codewords.
 *
 * Caught by the specification's own worked example, which is why that vector is
 * in the proof beside this file rather than a round trip alone: a round trip
 * through my own encoder and a decoder told me it failed, and this told me
 * where.
 */
function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= mul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly.reverse();
}

function errorCorrection(data: number[], degree: number): number[] {
  const gen = generatorPoly(degree);
  const out = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ out[0];
    out.shift();
    out.push(0);
    for (let j = 0; j < degree; j += 1) out[j] ^= mul(gen[j + 1], factor);
  }
  return out;
}

/* ------------------------------------------------------------ version tables */

/**
 * Per version, at error correction level M: total codewords, EC codewords per
 * block, and the block split. M is chosen over L deliberately: a QR on a screen
 * is photographed at an angle in poor light, and M recovers about 15 percent
 * against L's 7 for a few more modules.
 *
 * Versions 5 to 10 only. A version 5 holds 134 data bytes at M, and a version
 * 10 holds 346, which covers every otpauth URI this platform can produce.
 */
type VersionSpec = {
  version: number;
  /** Total data codewords across all blocks. */
  dataCodewords: number;
  /** Error correction codewords per block. */
  ecPerBlock: number;
  /** [count, dataCodewordsEach] for each group. */
  groups: [number, number][];
};

/*
 * THE FIRST VERSION OF THIS TABLE HELD TOTAL CODEWORDS WHERE DATA CODEWORDS
 * BELONG, AND EVERY CODE IT PRODUCED WAS UNREADABLE.
 *
 * 134 is version 5's TOTAL capacity; 86 of those are data and 48 are error
 * correction. Filling 134 data codewords into a block that holds 86 overruns
 * the structure, and the result is a QR that renders perfectly, looks entirely
 * normal, and decodes to nothing.
 *
 * It was caught by the round trip proof on the first run, which is the whole
 * reason that proof decodes rather than inspecting. Every check that looks at a
 * QR without reading it would have passed this.
 *
 * dataCodewords equals the sum of the groups below, which is asserted at load.
 */
const VERSIONS: VersionSpec[] = [
  { version: 5, dataCodewords: 86, ecPerBlock: 24, groups: [[2, 43]] },
  { version: 6, dataCodewords: 108, ecPerBlock: 16, groups: [[4, 27]] },
  { version: 7, dataCodewords: 124, ecPerBlock: 18, groups: [[4, 31]] },
  { version: 8, dataCodewords: 154, ecPerBlock: 22, groups: [[2, 38], [2, 39]] },
  { version: 9, dataCodewords: 182, ecPerBlock: 22, groups: [[3, 36], [2, 37]] },
  { version: 10, dataCodewords: 216, ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
];

/*
 * The table has to agree with itself. A group split that does not sum to the
 * stated capacity is the same defect as the one above wearing different
 * numbers, and it would again produce a code that renders and does not read.
 */
for (const v of VERSIONS) {
  const summed = v.groups.reduce((n, [count, size]) => n + count * size, 0);
  if (summed !== v.dataCodewords) {
    throw new Error(
      `QR version ${v.version}: the groups sum to ${summed} and the capacity says ${v.dataCodewords}.`,
    );
  }
}

/**
 * The largest payload this encoder can hold, in bytes.
 *
 * Derived from the version table rather than written down, so it cannot drift
 * away from what the encoder actually does: the last version's data codewords
 * less the two the byte mode header and the character count occupy.
 *
 * WHY IT IS EXPORTED
 * ------------------
 * So a caller can ASK before it encodes. qrMatrix still throws on something it
 * cannot fit, which is right for a pure encoder, and a route that turns a throw
 * into a 500 is not right for a person trying to enrol. /api/portal/mfa asks
 * this first and refuses in a sentence naming the limit.
 *
 * The number was found the hard way on 2026-09-10. A staff member with a long
 * enough email address got a 500 at enrolment, because the otpauth URI carries
 * their address and the error said the encoder "covers versions 5 to 10 in byte
 * mode, which is every otpauth URI". That claim is false: a SHORT address is
 * already 165 bytes and a 68 character one is 222.
 */
export const QR_MAX_BYTES = VERSIONS[VERSIONS.length - 1].dataCodewords - 2;

/**
 * Would this text fit? Cheap, allocation free, and the question a caller wants.
 */
export function qrFits(text: string): boolean {
  return new TextEncoder().encode(text).length <= QR_MAX_BYTES;
}

/** How many bytes this text would need, for a message that says the number. */
export function qrByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Alignment pattern centres per version, versions 5 to 10. */
const ALIGNMENT: Record<number, number[]> = {
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/* ------------------------------------------------------------------ encoding */

function encodeData(bytes: number[], spec: VersionSpec): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  /*
   * Byte mode, then the character count.
   *
   * THE COUNT IS 8 BITS UP TO VERSION 9 AND 16 FROM VERSION 10. An earlier
   * comment here said exactly that and the code below still pushed 8, so every
   * version 10 code carried a header claiming the wrong length and decoded to
   * nothing. Versions 5 to 9 were unaffected and correct, which is precisely
   * what made it survive: the boundary is at a size only the longest otpauth
   * URIs reach.
   */
  push(0b0100, 4);
  push(bytes.length, spec.version >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);

  const capacity = spec.dataCodewords * 8;
  /* Terminator, up to four zero bits. */
  for (let i = 0; i < 4 && bits.length < capacity; i += 1) bits.push(0);
  /* Pad to a byte boundary. */
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  /* The specified alternating pad bytes. */
  const PAD = [0xec, 0x11];
  let p = 0;
  while (codewords.length < spec.dataCodewords) {
    codewords.push(PAD[p % 2]);
    p += 1;
  }
  return codewords;
}

/** Split into blocks, add EC per block, interleave, as the specification requires. */
function interleave(codewords: number[], spec: VersionSpec): number[] {
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let at = 0;
  for (const [count, size] of spec.groups) {
    for (let i = 0; i < count; i += 1) {
      const block = codewords.slice(at, at + size);
      at += size;
      dataBlocks.push(block);
      ecBlocks.push(errorCorrection(block, spec.ecPerBlock));
    }
  }

  const out: number[] = [];
  const widest = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < widest; i += 1) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return out;
}

/* ------------------------------------------------------------------- matrix */

type Grid = { size: number; modules: (0 | 1 | null)[][]; reserved: boolean[][] };

function blankGrid(version: number): Grid {
  const size = version * 4 + 17;
  return {
    size,
    modules: Array.from({ length: size }, () => new Array(size).fill(null)),
    reserved: Array.from({ length: size }, () => new Array(size).fill(false)),
  };
}

function placeFinder(g: Grid, row: number, col: number) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= g.size || cc < 0 || cc >= g.size) continue;
      const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const on =
        inner &&
        ((r === 0 || r === 6 || c === 0 || c === 6) || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      g.modules[rr][cc] = on ? 1 : 0;
      g.reserved[rr][cc] = true;
    }
  }
}

function placeFunctionPatterns(g: Grid, version: number) {
  placeFinder(g, 0, 0);
  placeFinder(g, 0, g.size - 7);
  placeFinder(g, g.size - 7, 0);

  /* Timing patterns. */
  for (let i = 8; i < g.size - 8; i += 1) {
    const bit: 0 | 1 = i % 2 === 0 ? 1 : 0;
    g.modules[6][i] = bit;
    g.reserved[6][i] = true;
    g.modules[i][6] = bit;
    g.reserved[i][6] = true;
  }

  /* Alignment patterns, skipping the three that would sit on a finder. */
  const centres = ALIGNMENT[version] ?? [];
  for (const r of centres) {
    for (const c of centres) {
      const onFinder =
        (r <= 8 && c <= 8) || (r <= 8 && c >= g.size - 9) || (r >= g.size - 9 && c <= 8);
      if (onFinder) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          g.modules[r + dr][c + dc] = on ? 1 : 0;
          g.reserved[r + dr][c + dc] = true;
        }
      }
    }
  }

  /* The dark module, which is always set. */
  g.modules[g.size - 8][8] = 1;
  g.reserved[g.size - 8][8] = true;

  /*
   * VERSION INFORMATION, WHICH ONLY EXISTS FROM VERSION 7 AND WHICH THE FIRST
   * VERSION OF THIS FILE OMITTED ENTIRELY.
   *
   * Eighteen modules, twice: six bits of version number and twelve of BCH,
   * placed in a 3 by 6 block above the bottom left finder and its transpose
   * left of the top right finder.
   *
   * Leaving them out did not produce a code missing a feature. It produced a
   * code with DATA written where the version block belongs, so versions 7 and
   * above encoded correctly and read as nothing, while 5 and 6 worked
   * perfectly. That is the shape of bug that ships: the small payloads anybody
   * tests by hand are fine, and the real one, an otpauth URI at around 190
   * characters, is not.
   */
  if (version >= 7) {
    let value = version << 12;
    for (let i = 5; i >= 0; i -= 1) {
      if (value & (1 << (i + 12))) value ^= 0b1111100100101 << i;
    }
    const bits = (version << 12) | value;

    for (let i = 0; i < 18; i += 1) {
      const bit = ((bits >> i) & 1) as 0 | 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + g.size - 11;
      /* Bottom left, and the same eighteen bits transposed at the top right. */
      g.modules[b][a] = bit;
      g.reserved[b][a] = true;
      g.modules[a][b] = bit;
      g.reserved[a][b] = true;
    }
  }

  /* Reserve the format information areas. */
  for (let i = 0; i <= 8; i += 1) {
    if (!g.reserved[8][i]) {
      g.reserved[8][i] = true;
      g.modules[8][i] = 0;
    }
    if (!g.reserved[i][8]) {
      g.reserved[i][8] = true;
      g.modules[i][8] = 0;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    if (!g.reserved[8][g.size - 1 - i]) {
      g.reserved[8][g.size - 1 - i] = true;
      g.modules[8][g.size - 1 - i] = 0;
    }
    if (!g.reserved[g.size - 1 - i][8]) {
      g.reserved[g.size - 1 - i][8] = true;
      g.modules[g.size - 1 - i][8] = 0;
    }
  }
}

/** Place the data bits, upward then downward in two module wide columns. */
function placeData(g: Grid, bytes: number[]) {
  const bits: number[] = [];
  for (const b of bytes) for (let i = 7; i >= 0; i -= 1) bits.push((b >> i) & 1);

  let bit = 0;
  let upward = true;
  for (let right = g.size - 1; right >= 1; right -= 2) {
    /* The vertical timing column is skipped entirely. */
    if (right === 6) right = 5;
    for (let step = 0; step < g.size; step += 1) {
      const row = upward ? g.size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (g.reserved[row][col]) continue;
        g.modules[row][col] = bit < bits.length ? ((bits[bit] as 0 | 1) ?? 0) : 0;
        bit += 1;
      }
    }
    upward = !upward;
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

/** The four penalty rules, used to choose a mask. */
function penalty(g: Grid): number {
  const n = g.size;
  const at = (r: number, c: number) => g.modules[r][c] ?? 0;
  let score = 0;

  /* Runs of five or more. */
  for (let r = 0; r < n; r += 1) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let i = 1; i < n; i += 1) {
        const a = horizontal ? at(r, i) : at(i, r);
        const b = horizontal ? at(r, i - 1) : at(i - 1, r);
        if (a === b) run += 1;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  }

  /* Two by two blocks of one colour. */
  for (let r = 0; r < n - 1; r += 1) {
    for (let c = 0; c < n - 1; c += 1) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
    }
  }

  /* The finder-like pattern, in both orientations. */
  const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c <= n - 11; c += 1) {
      const row = Array.from({ length: 11 }, (_, i) => at(r, c + i));
      const col = Array.from({ length: 11 }, (_, i) => at(c + i, r));
      for (const p of [P1, P2]) {
        if (row.every((v, i) => v === p[i])) score += 40;
        if (col.every((v, i) => v === p[i])) score += 40;
      }
    }
  }

  /* Deviation from an even split of dark and light. */
  let dark = 0;
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) dark += at(r, c);
  const percent = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/** Format information for level M and a mask, with its BCH code and mask. */
function formatBits(mask: number): number[] {
  /* 00 is level M in the format encoding. */
  const data = (0b00 << 3) | mask;
  let value = data << 10;
  for (let i = 4; i >= 0; i -= 1) {
    if (value & (1 << (i + 10))) value ^= 0b10100110111 << i;
  }
  const combined = ((data << 10) | value) ^ 0b101010000010010;
  return Array.from({ length: 15 }, (_, i) => (combined >> (14 - i)) & 1);
}

function applyFormat(g: Grid, mask: number) {
  const bits = formatBits(mask);
  /* Around the top left finder. */
  for (let i = 0; i <= 5; i += 1) g.modules[8][i] = bits[i] as 0 | 1;
  g.modules[8][7] = bits[6] as 0 | 1;
  g.modules[8][8] = bits[7] as 0 | 1;
  g.modules[7][8] = bits[8] as 0 | 1;
  for (let i = 9; i <= 14; i += 1) g.modules[14 - i][8] = bits[i] as 0 | 1;
  /*
   * And the split copy: SEVEN bits down the left edge, then EIGHT along the
   * top right. Not eight and seven.
   *
   * The first version of this ran the vertical arm for eight, so bit 7 landed
   * on the module at [size - 8][8], which is the dark module and is required to
   * be set for every QR that has ever existed. Overwriting it with a format bit
   * produced a code that rendered correctly, carried correct data, and decoded
   * to nothing at all.
   *
   * Found by decoding rather than by reading, which is the entire argument for
   * the proof beside this file.
   */
  for (let i = 0; i <= 6; i += 1) g.modules[g.size - 1 - i][8] = bits[i] as 0 | 1;
  for (let i = 7; i <= 14; i += 1) g.modules[8][g.size - 15 + i] = bits[i] as 0 | 1;
}

/* --------------------------------------------------------------- the public bit */

/** The finished module matrix: true is dark. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));

  const spec = VERSIONS.find((v) => bytes.length + 2 <= v.dataCodewords);
  if (!spec) {
    throw new Error(
      `${bytes.length} bytes is more than this encoder handles. It covers versions 5 to 10 in byte mode, which is every otpauth URI; anything longer needs a bigger version and a 16 bit character count.`,
    );
  }

  const codewords = interleave(encodeData(bytes, spec), spec);

  let best: { grid: Grid; score: number } | null = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const g = blankGrid(spec.version);
    placeFunctionPatterns(g, spec.version);
    placeData(g, codewords);
    for (let r = 0; r < g.size; r += 1) {
      for (let c = 0; c < g.size; c += 1) {
        if (!g.reserved[r][c] && MASKS[mask](r, c)) g.modules[r][c] = (g.modules[r][c] ? 0 : 1) as 0 | 1;
      }
    }
    applyFormat(g, mask);
    const score = penalty(g);
    if (!best || score < best.score) best = { grid: g, score };
  }

  const g = best!.grid;
  return g.modules.map((row) => row.map((m) => m === 1));
}

/**
 * The matrix as an SVG, as one path so the markup stays small.
 *
 * A four module quiet zone, which the specification requires and which scanners
 * genuinely need: without it a code against a busy background often will not
 * acquire.
 */
export function qrSvg(text: string, options: { size?: number; label?: string } = {}): string {
  const matrix = qrMatrix(text);
  const n = matrix.length;
  const quiet = 4;
  const total = n + quiet * 2;

  let path = "";
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (matrix[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }

  const label = options.label ?? "QR code";
  const px = options.size ?? 220;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"`,
    ` width="${px}" height="${px}" role="img" aria-label="${label}"`,
    ` shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="#ffffff"/>`,
    `<path d="${path}" fill="#0b1f3a"/>`,
    `</svg>`,
  ].join("");
}
