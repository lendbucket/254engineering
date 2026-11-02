/**
 * PROOF: /coverage/san-antonio MAKES NO SOIL OR GEOTECHNICAL CLAIM.
 *
 * Robert, 2026-11-01, round 3 item i: the page ranks 3.5 for "soil engineering
 * san antonio" and the firm offers no geotechnical engineering. "Check that the
 * page makes no soil or geotechnical claim; where it mentions expansive clay,
 * it must be in the context of foundation inspections only."
 *
 *   A  no string in the region record offers geotechnical work, soil testing,
 *      soil borings, a soils report or soil engineering, except the one
 *      sentence saying they are not offered
 *   B  every sentence that names clay or plasticity also names a foundation
 *   C  that sentence exists, and the soils section's heading still frames the
 *      ground by what it does to a foundation
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-san-antonio-page-claims-no-soil-engineering.mjs
 */
import { readFileSync } from "node:fs";

const { regions } = await import("../../src/content/regions.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

const sa = regions.find((r) => r.slug === "san-antonio");
check("the San Antonio region exists", Boolean(sa));

const strings = [
  sa.title, sa.h1, sa.description, sa.summary,
  ...sa.wind, ...sa.soils, ...sa.permitting,
  ...sa.emphasis.map((e) => e.why),
];
check("the record's strings were read, so the scan is not over nothing", strings.length >= 15, `${strings.length}`);

const DISCLAIMER = "254 Engineering does not offer geotechnical engineering, soil testing or soil borings.";
const OFFER = /\b(geotechnical|soil (?:testing|tests?|borings?|engineering|engineer|report|investigation)|soils (?:report|engineer)|foundation investigation|borings?)\b/i;
const sentences = strings.flatMap((s) => s.split(/(?<=\.)\s+/));
const offering = sentences.filter((s) => OFFER.test(s) && s !== DISCLAIMER);
check("no sentence offers geotechnical work, soil testing, borings or a soils report", offering.length === 0, offering.join(" | "));
check("the record says plainly that geotechnical work is not offered", sa.soils.some((p) => p.startsWith(DISCLAIMER)));

const clay = sentences.filter((s) => /\b(clays?|plasticity|expansive|shrink|swell)\b/i.test(s));
check("the scan found the clay sentences it is meant to judge", clay.length >= 1, `${clay.length}`);
const unframed = clay.filter((s) => !/\bfoundation\b/i.test(s));
check("every clay sentence names a foundation", unframed.length === 0, unframed.join(" | "));

const page = readFileSync("src/app/(site)/coverage/[slug]/page.tsx", "utf8");
check("the soils section heading frames the ground by what it does to a foundation", page.includes('title="What the ground does, and what it does to a foundation"'));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: /coverage/san-antonio offers no geotechnical work, says so in one sentence, and every clay sentence on it names a foundation."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
