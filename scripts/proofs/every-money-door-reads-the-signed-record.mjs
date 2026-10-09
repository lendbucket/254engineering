/**
 * EVERY MONEY DOOR READS THE ENGINEER'S SIGNED RECORD BEFORE IT TAKES MONEY.
 *
 * Ruling 11 and ruling 13 of 2026-10-06: lineIsSellable (offered in
 * configuration AND signed in the database with a hash matching the
 * transcription) is called from every door that takes money, and "a check
 * fails the board if any money door does not call it, proven red by removing
 * one call".
 *
 * The doors call it through orderBlockedNow in src/lib/line-gate.ts. Three
 * assertions, read from the source:
 *
 *   1. every declared door calls orderBlockedNow, the number of times declared;
 *   2. nothing else in src asks the catalogue with the protocol answered by
 *      configuration alone: orderBlockedReason is called with a literal false or
 *      from line-gate.ts and nowhere else, so a new door that copies the old
 *      shape goes red here rather than selling a voided line;
 *   3. serviceLineIsOffered, the configuration-only predicate, is read only by
 *      the gate itself and by the DISPLAY surfaces the ruling accepted
 *      (OfferCta and lineOffer), never by anything that takes money.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* The doors, declared: the file and how many calls it makes. */
const DOORS = {
  "src/app/(order)/order/start/[slug]/page.tsx": 1,
  "src/app/account/order/page.tsx": 1,
  "src/lib/ops-bulk.ts": 1,
  "src/lib/ops-intake.ts": 2,
  "src/lib/ops-job-billing.ts": 1,
};

for (const [file, want] of Object.entries(DOORS)) {
  const got = readFileSync(file, "utf8").split("orderBlockedNow(").length - 1;
  check(`${file} reads the signed record (${want} call${want === 1 ? "" : "s"})`, got === want, `${got} found`);
}

const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p.split("\\").join("/"));
  }
};
walk("src");
check("the source tree was read", files.length > 200, `${files.length} files`);

const askedByConfig = [];
for (const f of files) {
  if (f === "src/lib/line-gate.ts") continue;
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/orderBlockedReason\(([^;]*?)\)/g)) {
    if (!/,\s*false\s*$/.test(m[1].trim())) askedByConfig.push(`${f}: orderBlockedReason(${m[1].slice(0, 60)})`);
  }
}
check(
  "nothing outside the line gate asks the catalogue with a protocol answer of its own",
  askedByConfig.length === 0,
  askedByConfig.join(" | ") || "every other call passes false, the shut answer",
);

const DISPLAY_AND_GATE = new Set([
  "src/lib/launch.ts",
  "src/lib/line-gate.ts",
  "src/lib/ordering.ts",
  "src/components/launch/OfferCta.tsx",
]);
const configReaders = files.filter((f) => !DISPLAY_AND_GATE.has(f) && readFileSync(f, "utf8").includes("serviceLineIsOffered("));
check(
  "the configuration-only predicate is read by the gate and the display surfaces alone",
  configReaders.length === 0,
  configReaders.join(", ") || "OfferCta and lineOffer only, as ruled",
);

console.log("");
if (wrong === 0) {
  console.log("PASS: every money door reads the engineer's signed record before it takes money.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
