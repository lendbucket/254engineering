/**
 * THE QR SCANS TO EXACTLY WHAT WENT INTO IT.
 *
 *   node scripts/proofs/qr-decodes-to-what-it-encoded.mjs
 *
 * WHY THIS IS THE ONLY CHECK WORTH RUNNING ON A QR
 * ------------------------------------------------
 * The failure that matters is a code that scans to the WRONG string. It is
 * invisible by inspection, it looks exactly like a working one, and the person
 * it fails is somebody enrolling a second factor who then cannot sign in.
 *
 * Asserting the SVG renders, or that the matrix is the right size, or that it
 * has three finder patterns, would all pass on a code carrying a corrupted
 * secret. Only decoding catches it.
 *
 * So this encodes with the platform's own encoder and decodes with jsQR, which
 * is an independent implementation and a devDependency that never ships. The
 * two share no code, so agreement between them is evidence rather than a
 * tautology.
 *
 * IT FAILS CLOSED, WHICH IS NOT A REASON TO SKIP THE CHECK
 * --------------------------------------------------------
 * A wrong secret produces codes that never verify, so nobody is let in. The
 * direction is right. What it costs is somebody standing at an enrolment screen
 * with a working phone and a code that will not be accepted, and no way to tell
 * why, which is the worst debugging position this platform can put a person in.
 */

import jsQR from "jsqr";
import {
  qrMatrix,
  qrSvg,
  qrFits,
  qrByteLength,
  qrVersionFor,
  QR_MAX_BYTES,
  QR_VERSION_CAPACITIES,
} from "../../src/lib/qr.ts";
import { otpauthUri, newTotpSecret } from "../../src/lib/totp.ts";

/**
 * Runs the cases and reports what happened.
 *
 * mfa-audit calls this on every suite run rather than leaving it to be
 * remembered, on the operator's instruction of 2026-09-07: a proof that just
 * found five bugs should run every time. Four of those five produced a QR that
 * rendered perfectly and decoded to nothing, and versions 5 and 6 worked
 * throughout, so nothing short of decoding would have caught them.
 *
 * @param {boolean} loud  Print every case. False when the audit calls it.
 * @returns {{failed: string[], total: number}}
 */
export function checkQrEncoder(loud = false) {
  const failed = [];
  let total = 0;
  const say = (line) => {
    if (loud) console.log(line);
  };
  const rec = (name, ok, note = "") => {
    total += 1;
    if (!ok) failed.push(name);
    say(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
  };

/** The matrix as the RGBA bitmap jsQR reads, scaled so it has pixels to work with. */
function bitmap(matrix, scale = 4, quiet = 4) {
  const n = matrix.length;
  const size = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!matrix[r][c]) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const y = (r + quiet) * scale + dy;
          const x = (c + quiet) * scale + dx;
          const i = (y * size + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: size, height: size };
}

  const roundTrip = (text) => {
  const img = bitmap(qrMatrix(text));
  const decoded = jsQR(img.data, img.width, img.height);
  return decoded ? decoded.data : null;
};

  say("");
  say("========== A QR SCANS TO WHAT WENT INTO IT ==========");

  say("\nTHE THING THIS IS ACTUALLY FOR");
{
  const uri = otpauthUri(
    "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    "somebody@254engineering.com",
    "254 Engineering Services",
  );
  const got = roundTrip(uri);
  rec("an otpauth uri decodes back byte for byte", got === uri, got === null ? "it did not decode at all" : got === uri ? `${uri.length} characters` : `got ${JSON.stringify(got)}`);
}

  say("\nA REAL SECRET, NOT A FIXTURE");
{
  /* A fresh secret every run, so a code that only works for one hardcoded
   * string cannot pass this. */
  let ok = 0;
  for (let i = 0; i < 5; i += 1) {
    const { base32 } = newTotpSecret();
    const uri = otpauthUri(base32, `person${i}@254engineering.com`, "254 Engineering Services");
    if (roundTrip(uri) === uri) ok += 1;
  }
  rec("five freshly generated secrets each survive the round trip", ok === 5, `${ok} of 5`);
}

  say("\nTHE EDGES OF WHAT IT CLAIMS TO HANDLE");
{
  /* Short, and long enough to push into a higher version. */
  const short = "otpauth://totp/A:b?secret=GEZDGNBVGY3TQOJQ&issuer=A";
  rec("a short uri round trips", roundTrip(short) === short);

  /* Long enough to push past version 5 and into a higher one, while staying
   * inside what level M holds at version 10. */
  const long = otpauthUri(
    "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    "a.long.address@254engineering.com",
    "254 Engineering Services",
  );
  rec(`a ${long.length} character uri round trips`, roundTrip(long) === long);

  /* Beyond what this encoder covers, it must THROW rather than emit a QR that
   * silently carries the wrong header.
   *
   * The length comes from the table rather than a literal. It used to be 400,
   * which was past the ceiling when the encoder stopped at version 10 and is
   * comfortably inside it now that it reaches 17. A check asserting a throw
   * that no longer happens goes red, which is what this one did; the same check
   * written at a number that HAPPENED to still be over would have gone quiet
   * instead, which is worse. */
  let threw = false;
  try {
    qrMatrix("x".repeat(QR_MAX_BYTES + 1));
  } catch {
    threw = true;
  }
  rec("something too long throws rather than encoding wrongly", threw, "a wrong character count header would produce a scannable code carrying nonsense");
}

  say("\nEVERY VERSION BOUNDARY, AT ITS EXACT CAPACITY");
{
  /*
   * ==========================================================================
   * THE PROOF THE RULING ASKED FOR.
   * ==========================================================================
   * Operator ruling, gate 2: the encoder extended to the version that fits the
   * longest address the platform accepts, "proven the way the original was, by
   * the independent decoder, every version boundary crossed".
   *
   * A version is CHOSEN by payload length, so the way to cross a boundary is to
   * encode a payload of exactly the length that selects each version and decode
   * it. The encoder reserves two codewords for the byte mode header and the
   * character count, so version V is selected by a payload of exactly
   * dataCodewords(V) - 2 bytes, and one byte more selects V + 1.
   *
   * This is where a wrong ecPerBlock or a wrong alignment table shows. Both
   * produce a code that renders perfectly and decodes to nothing, which is the
   * failure that shipped twice in this file's history: once for a missing
   * version information block at version 7, and once for an 8 bit character
   * count at version 10. Versions below the break were fine both times, which
   * is exactly why every boundary is crossed rather than a couple of samples.
   */
  const capacities = QR_VERSION_CAPACITIES;

  let crossed = 0;
  const failures = [];
  for (const { version, maxBytes } of capacities) {
    /*
     * Deterministic, ASCII, and NOT a repeated character: a payload of one
     * repeated byte is the easiest thing in the world for a broken interleaver
     * to get right by accident, because every block holds the same value.
     */
    const payload = Array.from({ length: maxBytes }, (_, i) =>
      String.fromCharCode(33 + ((i * 7 + version) % 94)),
    ).join("");

    const chosen = qrVersionFor(payload);
    if (chosen !== version) {
      failures.push(`${maxBytes} bytes chose version ${chosen}, expected ${version}`);
      continue;
    }
    const back = roundTrip(payload);
    if (back !== payload) {
      failures.push(
        `version ${version} at ${maxBytes} bytes decoded to ${back === null ? "nothing" : `${back.length} bytes that differ`}`,
      );
      continue;
    }
    crossed += 1;
  }

  rec(
    `every version is exercised at its exact capacity (${crossed} of ${capacities.length})`,
    crossed === capacities.length,
    failures.join(" | ") ||
      `versions ${capacities[0].version} to ${capacities[capacities.length - 1].version}, ${capacities[0].maxBytes} to ${capacities[capacities.length - 1].maxBytes} bytes`,
  );

  /*
   * AND ONE BYTE MORE MUST CHOOSE THE NEXT VERSION, which is the boundary
   * itself rather than the capacity either side of it. Without this, a table
   * whose versions all decoded but whose capacities were understated would pass
   * every check above while quietly using a larger symbol than it needs.
   */
  const stepped = [];
  for (let i = 0; i < capacities.length - 1; i += 1) {
    const justOver = capacities[i].maxBytes + 1;
    const payload = "z".repeat(justOver);
    const chosen = qrVersionFor(payload);
    if (chosen !== capacities[i + 1].version) {
      stepped.push(`${justOver} bytes chose ${chosen}, expected ${capacities[i + 1].version}`);
    }
  }
  rec(
    "and one byte past each capacity steps to the next version",
    stepped.length === 0,
    stepped.join(" | ") || `${capacities.length - 1} boundaries`,
  );
}

  say("\nTHE LONGEST ADDRESS THE PLATFORM ACCEPTS");
{
  /*
   * The platform sets no limit of its own: eng_profiles.email is `text` and no
   * input carries a maxLength, so the ceiling is the standard's. RFC 5321
   * allows 64 octets of local part and 255 of domain, 320 with the @.
   *
   * This is the case the whole extension exists for. Before it, this address
   * produced a 500 at enrolment.
   */
  const local = "a".repeat(64);
  const domain = `${"b".repeat(251)}.com`;
  const longest = `${local}@${domain}`;
  rec("the address under test is the RFC 5321 maximum", longest.length === 320, `${longest.length} characters`);

  const uri = otpauthUri(newTotpSecret().base32, longest, "254 Engineering Services");
  rec(
    `its otpauth uri is ${uri.length} bytes, inside what the encoder holds`,
    qrFits(uri),
    `${qrByteLength(uri)} bytes against a ceiling of ${QR_MAX_BYTES}`,
  );
  rec("and it round trips through the independent decoder", roundTrip(uri) === uri, `version ${qrVersionFor(uri)}`);

  /*
   * A pathological local part, every character one the URI has to percent
   * encode, so the label expands. It measures the same, because the label was
   * already encoded, and asserting that is cheaper than assuming it.
   */
  const nasty = `${"!".repeat(64)}@${domain}`;
  const nastyUri = otpauthUri(newTotpSecret().base32, nasty, "254 Engineering Services");
  rec(
    "and so does one whose every local character percent encodes",
    qrFits(nastyUri) && roundTrip(nastyUri) === nastyUri,
    `${qrByteLength(nastyUri)} bytes, version ${qrVersionFor(nastyUri)}`,
  );
}

  say("\nAND THE SVG IS THE SAME MATRIX");
{
  const uri = otpauthUri("GEZDGNBVGY3TQOJQ", "x@y.com", "254 Engineering Services");
  const svg = qrSvg(uri);
  const matrix = qrMatrix(uri);
  const dark = matrix.flat().filter(Boolean).length;
  const drawn = (svg.match(/M\d+ \d+h1v1h-1z/g) ?? []).length;
  rec("the svg draws one square per dark module", drawn === dark, `${drawn} drawn, ${dark} dark`);
  rec("it carries a quiet zone", svg.includes(`viewBox="0 0 ${matrix.length + 8} ${matrix.length + 8}`), "without one, scanners often will not acquire against a busy background");
  /*
   * "No external reference" means nothing is FETCHED. The xmlns attribute is a
   * namespace identifier that merely looks like a url and is never retrieved,
   * so matching on https was this test being wrong rather than the markup being
   * unsafe. What matters is no script, and nothing carrying a src or an href.
   */
  rec(
    "it is inert markup with no script and nothing fetched",
    !/<script/i.test(svg) && !/\s(src|href|xlink:href)=/i.test(svg),
  );
}

  say("");
  return { failed, total };
}

/* Run directly: print everything and set an exit code. */
const invokedDirectly =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());

if (invokedDirectly) {
  const { failed, total } = checkQrEncoder(true);
  if (failed.length) {
    console.log(`FAIL: ${failed.length} of ${total} cases. The QR does not carry what it was given, which would strand somebody mid enrolment.`);
    process.exit(1);
  }
  console.log(`PASS: ${total} cases, encoded here and decoded by an independent implementation, byte for byte identical.`);
}
