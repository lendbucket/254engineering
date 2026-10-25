// @runtime react-server
//
// Declared because it imports src/lib/letter-seal.ts, which carries server-only.

/**
 * A LETTER IS SEALED ONLY AS HE READ IT, AND THE PREVIEW SHOWS THE LETTERHEAD
 * AND SEAL BLOCK IT WILL CARRY.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-letter-is-sealed-only-as-he-read-it.mjs
 *
 * Robert's answer on L2d, 2026-10-25: hash the previewed draft; sealing
 * refuses if the rebuilt draft differs, and says what changed; the preview
 * shows the seal block and letterhead. The draft was rebuilt at sealing with
 * nothing tying it to what he read, and the office's facts are newest-wins, so
 * a fact recorded between reading and sealing printed in a letter he never
 * read.
 *
 * The digest is exercised directly. sealLetter's ordering is read from the
 * source: in this process the launch gate is shut, which refuses before the
 * digest is reached, so a run here could only prove the gate.
 */
process.env.SUPABASE_URL = "http://letter-digest-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "letter-digest-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { draftDigest } = await import("../../src/lib/letter-seal.ts");
const draft = { title: "Roof certification, 1 Proof Way, file 254-PROOF-1", lines: [{ kind: "re", text: "Re: 1 Proof Way" }, { kind: "body", text: "The roof was inspected on October 20, 2026." }] };
const frame = { letterhead: { brand: "254 Engineering", registrationLine: "254 Engineering LLC, TBPELS Firm F-29811" }, sealBlock: { name: "Proof Engineer", licenseNumber: "000000", role: "Engineer of Record, 254 Engineering LLC" } };
const base = draftDigest(draft, frame);
check("the digest is a SHA-256", /^[0-9a-f]{64}$/.test(base));
check("the same draft and frame give the same digest", draftDigest(structuredClone(draft), structuredClone(frame)) === base);
const lineChanged = { ...draft, lines: [draft.lines[0], { kind: "body", text: "The roof was inspected on October 21, 2026." }] };
check("one changed word in one line changes the digest", draftDigest(lineChanged, frame) !== base);
check("a line added changes it", draftDigest({ ...draft, lines: [...draft.lines, { kind: "body", text: "An added line." }] }, frame) !== base);
check("the title changing changes it", draftDigest({ ...draft, title: `${draft.title}.` }, frame) !== base);
check("the letterhead changing changes it", draftDigest(draft, { ...frame, letterhead: { ...frame.letterhead, registrationLine: "Another line" } }) !== base);
check("the seal block changing changes it", draftDigest(draft, { ...frame, sealBlock: { ...frame.sealBlock, licenseNumber: "000001" } }) !== base);
check("a line's kind changing changes it", draftDigest({ ...draft, lines: [{ kind: "body", text: "Re: 1 Proof Way" }, draft.lines[1]] }, frame) !== base);

const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
const sealBody = seal.slice(seal.indexOf("export async function sealLetter("), seal.indexOf("export type AwaitingLetter"));
const digestAt = sealBody.indexOf("draftDigest(draft, frame) !== input.previewSha256");
const codeAt = sealBody.indexOf("verifyFreshCode(actor!.id, input.code)");
const imagesAt = sealBody.indexOf('readImageForSealing(actor!.id, "seal")');
check("sealing compares the rebuilt draft with the digest he read", digestAt > 0);
check("before the code is spent and before his images are read", digestAt > 0 && digestAt < codeAt && digestAt < imagesAt);
check("and refuses with no digest at all", /if \(!input\.previewSha256\) \{\s*return \{ ok: false,/.test(sealBody));
check("and names what changed", /changedLines\(input\.previewLines, draft\.lines\)/.test(sealBody));
check(
  "the sealed PDF carries the same letterhead and seal block the digest covered",
  /brand: frame\.letterhead\.brand,/.test(sealBody) && /registrationLine: frame\.letterhead\.registrationLine,/.test(sealBody) && /\.\.\.frame\.sealBlock,/.test(sealBody),
);

const route = readFileSync("src/app/api/portal/letters/route.ts", "utf8");
check("the draft answer carries the letterhead, the seal block and the digest", /letterhead: draft\.letterhead,/.test(route) && /sealBlock: draft\.sealBlock,/.test(route) && /draftSha256: draft\.draftSha256,/.test(route));
check("and the seal request passes the digest and the lines read", /previewSha256: typeof body\.previewSha256 === "string"/.test(route) && /previewLines,/.test(route));
const panel = readFileSync("src/app/portal/(app)/review/LetterSealPanel.tsx", "utf8");
check("the panel sends the digest of the draft it showed", /previewSha256: frame\.draftSha256, previewLines: lines/.test(panel));
check("and shows the letterhead and the seal block as text", /frame\.letterhead\.brand/.test(panel) && /Texas P\.E\. No\. \{frame\.sealBlock\.licenseNumber\}/.test(panel));
check("and no image of his seal or signature reaches it", !/sealPng|signaturePng|readImageForSealing|<img/.test(panel));

console.log("");
if (wrong === 0) {
  console.log("PASS: a letter is sealed only as he read it, and the preview shows the letterhead and seal block it will carry.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
