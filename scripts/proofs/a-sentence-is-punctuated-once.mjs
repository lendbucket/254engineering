/**
 * EVERY "STILL NEEDED" AND "CAN FOLLOW" SENTENCE IN NEW JOB IS PUNCTUATED ONCE.
 *
 * Robert, 2026-11-14, from the after walk screenshots: New job printed
 * "a permit..", "house have?." and "addressed to?, needed", because a full stop
 * or a comma was added to a label the protocol had already ended with its own
 * mark. 990ef3d fixed the screen; this proves it over every field of every
 * deliverable in the catalog, at every stage, rather than over the three seen.
 *
 * The two sentences are built by src/lib/intake-sentences.ts, which the screen
 * imports, and this proof calls the same functions on every label fieldsFor
 * returns, so a label added tomorrow is covered the day it is added.
 */
import { readFileSync } from "node:fs";
import { CATALOG } from "../../data/catalog.ts";
import { fieldsFor } from "../../data/intake-fields.ts";
import { blockers } from "../../src/lib/job-intake-rules.ts";
import { stillNeededSentence, canFollowSentence } from "../../src/lib/intake-sentences.ts";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/* Written here as a literal, never imported from the module under test. */
const TWICE = /\.\.|\?\.|\?,|!\.|!,|\.,/;

const bad = [];
let sentences = 0;
const labels = new Set();
for (const entry of CATALOG) {
  for (const f of fieldsFor(entry.serviceSlug, entry.tier)) {
    labels.add(f.label);
    const lines = [stillNeededSentence(f.label), canFollowSentence(f.label, "dispatch"), canFollowSentence(f.label, "seal")];
    for (const s of lines) {
      sentences += 1;
      if (TWICE.test(s)) bad.push(`${entry.serviceSlug}/${entry.tier} ${f.id}: "${s}"`);
    }
  }
}
check(
  `no Still needed or Can follow sentence is punctuated twice (${sentences} sentences from ${labels.size} labels over ${CATALOG.length} deliverables)`,
  bad.length === 0 && sentences > 100,
  bad.slice(0, 6).join("; ") || "none",
);

/* The blockers New job lists above them are sentences too. */
const blocks = blockers({ clientId: null, serviceSlug: null, tier: null, propertyAddress: "", city: "", county: "", channel: null });
check(
  `nor any blocker (${blocks.length})`,
  blocks.length > 0 && blocks.every((b) => !TWICE.test(b)),
  blocks.filter((b) => TWICE.test(b)).join("; "),
);

/* The three the walk read, by name, so the general check is shown to reach them. */
const seen = (fragment) => [...labels].find((l) => l.includes(fragment));
const permit = seen("a lender or a permit.");
const house = seen("does the house have?");
const addressed = seen("addressed to?");
check("the walk's three labels are in the set the check read", Boolean(permit && house && addressed));
check('"a permit." reads once', Boolean(permit) && stillNeededSentence(permit).endsWith("a permit.") && !canFollowSentence(permit, "seal").includes(".."));
check('"house have?" reads once', Boolean(house) && stillNeededSentence(house).endsWith("house have?") && !canFollowSentence(house, "dispatch").includes("?."));
check('"addressed to?" reads once', Boolean(addressed) && !canFollowSentence(addressed, "seal").includes("?,") && canFollowSentence(addressed, "seal").includes("addressed to? Needed before"));

/* The screen builds them through these functions, not a copy of them. */
const screen = codeOf(readFileSync("src/app/portal/(app)/intake/IntakeClient.tsx", "utf8"));
check("Can follow is built by canFollowSentence", /\{canFollowSentence\(f\.label, f\.stage\)\}/.test(screen));
check("Still needed is built by stillNeededSentence", /\{stillNeededSentence\(f\.label\)\}/.test(screen));
check("and the screen keeps no punctuation of its own for them", !/needed before \$\{/.test(screen) && !/\$\{f\.label\}\./.test(screen));

console.log("");
if (wrong === 0) {
  console.log(`PASS: every Still needed and Can follow sentence in New job is punctuated once (${sentences} sentences).`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
