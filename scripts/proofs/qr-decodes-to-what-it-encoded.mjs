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
import { qrMatrix, qrSvg } from "../../src/lib/qr.ts";
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
   * silently carries the wrong header. */
  let threw = false;
  try {
    qrMatrix("x".repeat(400));
  } catch {
    threw = true;
  }
  rec("something too long throws rather than encoding wrongly", threw, "a wrong character count header would produce a scannable code carrying nonsense");
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
