// @runtime react-server
//
// Declared because this proof imports src/lib/protocol-sign.ts, which carries
// `server-only`. scripts/lib/audit-runtime.mjs works the requirement out from
// the imports, so this line and the invocation cannot drift apart.
/**
 * ONE VERSION OF A PROTOCOL IS SIGNED, AND IT IS THE ONE HE READ.
 *
 *   npx tsx --conditions=react-server scripts/proofs/one-version-of-a-protocol-is-signed.mjs
 *
 * Operator ruling, 2026-10-14: 254-WP-001 v1.2 and 254-FC-001 v1.0 join the
 * protocols the engineer signs in the portal. WP-001 is now held at two
 * versions, v1.1 from the PDFs of 2026-10-06 and v1.2 from the Word file of
 * 2026-10-09, which states it supersedes v1.1.
 *
 * Before this ruling the signing step found a protocol by its NUMBER, so with
 * two WP-001 texts on hand it would hash whichever the list held first. That
 * is the hazard: a signature recorded against v1.2 with the hash of v1.1's
 * text, or the reverse, which reads as void the moment anybody checks it, on a
 * signature he gave correctly.
 *
 * THE ANSWERS THIS SEPARATES, by calling the signing step's own hash:
 *   - WP-001 at v1.2 hashes the v1.2 text proved against his Word file;
 *   - WP-001 at v1.1 hashes nothing, so a signature on it reads as void;
 *   - FC-001 at v1.0 hashes its Word file text;
 *   - the five he signed on 2026-10-12 still hash to the content_sha256 the
 *     counterpart read on production, so this change voids none of them.
 * The expected hashes for the five are literals, never computed from the code
 * under test.
 */
import { createHash } from "node:crypto";
import { transcriptionSha256 } from "../../src/lib/protocol-sign.ts";
import { WP001_V1_2, FC001_V1_0 } from "../../src/content/protocols/docx-received.ts";
import { WP001 } from "../../src/content/protocols/wp-001.ts";

const results = [];
const check = (name, ok, note = "") => results.push({ name, ok, note });
const sha = (lines) => createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");

const v12 = transcriptionSha256("254-WP-001", "1.2");
check(
  "WP-001 at v1.2 hashes the v1.2 text from his Word file",
  v12 === sha(WP001_V1_2.text),
  v12 ? v12.slice(0, 12) : "null",
);
check(
  "and that is not the hash of v1.1's text, so the fixture separates the two",
  sha(WP001_V1_2.text) !== sha(WP001.text),
  `${sha(WP001.text).slice(0, 12)} for v1.1`,
);
const v11 = transcriptionSha256("254-WP-001", "1.1");
check("WP-001 at v1.1 hashes nothing, because v1.2 supersedes it", v11 === null, String(v11));

const fc = transcriptionSha256("254-FC-001", "1.0");
check("FC-001 at v1.0 hashes its Word file text", fc === sha(FC001_V1_0.text), fc ? fc.slice(0, 12) : "null");

const SIGNED_ON_PRODUCTION = {
  "254-MH-001": "d5fb2893f4d618dbdbf7a9d3d1c0998b1462e2adf72caa8d4ba59fb7b34a55d6",
  "254-SL-001": "c19522c86abbba90622aa3c1a41f5194a8f6c97134abb8bf8608fc22576c536d",
  "254-PL-001": "c8814496b1dd0b0f228b92447f547f7be4b8bf1553278bef5891817bdb6fb27e",
  "254-RS-001": "47e8e9ecb2d5fe07f9b37899cf5ee5494202b6a6f59648bf3ab0d85b9f616508",
  "254-DS-001": "c47536b8ab31009027e6f443a03bed1b28b6dbf443b85350b7e7bb817756958b",
};
for (const [number, signed] of Object.entries(SIGNED_ON_PRODUCTION)) {
  const now = transcriptionSha256(number, "1.1");
  check(`${number} v1.1 still hashes to his signature on production`, now === signed, now ? now.slice(0, 12) : "null");
}

check("a document never offered hashes nothing", transcriptionSha256("254-XX-001", "1.0") === null);

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? `FAIL: ${failed} of ${results.length} checks.` : `PASS: ${results.length} of ${results.length} checks.`}`);
process.exit(failed ? 1 : 0);
