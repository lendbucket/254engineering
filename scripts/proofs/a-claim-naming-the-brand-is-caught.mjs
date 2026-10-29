/**
 * A PRESENT TENSE CLAIM NAMING THE BRAND IS CAUGHT, NOT ONLY ONE NAMING THE
 * LEGAL NAME OR THE OLD WORDMARK.
 *
 *   node scripts/proofs/a-claim-naming-the-brand-is-caught.mjs
 *
 * The brand became "254 Engineering" on 2026-10-25. The firm names that
 * scripts/lib/regulatory.mjs matches carried the legal name and the old
 * wordmark and not the brand, so "254 Engineering performs windstorm
 * inspections" passed every present tense pattern until 2026-10-29. This asks
 * the patterns themselves, through the same findClaims that voice-audit and
 * partner-copy call, so the brand cannot drop out of the list again without a
 * red line. The sentences are literals here, never read from business.ts.
 */
import { ALL_REGULATED, findClaims } from "../lib/regulatory.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const caught = (s) => findClaims(s, ALL_REGULATED).length > 0;

check("the patterns exist (a list of none would catch nothing)", ALL_REGULATED.length > 0, `${ALL_REGULATED.length} patterns`);
for (const s of [
  "254 Engineering performs windstorm inspections across the coast.",
  "254 Engineering seals every letter it issues.",
  "Inspections are performed by 254 Engineering.",
  "254 Engineering LLC performs windstorm inspections across the coast.",
  "254 Engineering Services performs windstorm inspections across the coast.",
]) {
  check(`caught: "${s}"`, caught(s));
}
check(
  "and a sentence that names the brand and claims nothing stays clean",
  !caught("254 Engineering is the brand of 254 Engineering LLC."),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a present tense claim naming the brand, the legal name or the old wordmark is caught.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
