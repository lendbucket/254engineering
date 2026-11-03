/**
 * PROOF: A PROBE ENGINEER'S LICENCE IS ITS RUN'S OWN, SO 0109 NEVER REFUSES A WALK.
 *
 * 0109 (Robert's Q5, audit field F5) holds one licence number to one engineer
 * profile, any status. The chat counterpart's development sitting held it
 * (issue #1 comment 6587890300): the order-path and design addendum walks made
 * a fresh engineer per run with a fixed licence and suspended it at the end, so
 * the second run would be refused, and eleven such probes already shared two
 * numbers. This proves:
 *
 *   A  consecutive start times give distinct licences, in each range
 *   B  the walk range is nine digits from 900, digits only, never a reserved
 *      fixture; the onboarding range is seven digits from 91, which activation
 *      accepts and no Texas PE number (six digits) can be
 *   C  each walk derives its engineer's licence from the helper and the run's
 *      start time, and types no fixed number
 *   D  each walk that suspends its probes releases their licence as it does
 *   E  compliance-audit refuses the ranges in shipped configuration, not only
 *      the four fixed numbers
 *
 *   node scripts/proofs/a-probe-engineers-licence-is-its-runs-own.mjs
 */
import { readFileSync } from "node:fs";
import { walkProbeLicence, onboardingProbeLicence, RESERVED_PROBE_LICENCES } from "../lib/probe-licence.mjs";

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

const start = Date.UTC(2026, 10, 2, 21, 0, 0);
const walk = Array.from({ length: 2000 }, (_, i) => walkProbeLicence(start + i));
const onboarding = Array.from({ length: 2000 }, (_, i) => onboardingProbeLicence(start + i));

check("A: two thousand consecutive start times give two thousand walk licences", new Set(walk).size === walk.length, String(new Set(walk).size));
check("A: and two thousand onboarding licences", new Set(onboarding).size === onboarding.length, String(new Set(onboarding).size));
check("B: every walk licence is nine digits from 900", walk.every((l) => /^900\d{6}$/.test(l)), walk.find((l) => !/^900\d{6}$/.test(l)) ?? "");
check("B: and never a reserved fixture (900000001 to 900000004)", walk.every((l) => !RESERVED_PROBE_LICENCES.includes(l)) && RESERVED_PROBE_LICENCES.length === 4);
check("B: and never the permanent fixture engineer 900000003", !walk.includes("900000003"));
check("B: every onboarding licence is seven digits from 91, inside activation's 4 to 7 digit rule", onboarding.every((l) => /^9[1-9]\d{5}$/.test(l) && /^\d{4,7}$/.test(l)));
check("B: a start time that is not a whole millisecond count is refused", (() => { try { walkProbeLicence(1.5); return false; } catch { return true; } })());

const walks = {
  "scripts/exercises/order-path-walk-child.mjs": { helper: "walkProbeLicence", suspends: true },
  "scripts/exercises/design-addendum-walk.mjs": { helper: "walkProbeLicence", suspends: true },
  "scripts/onboarding-walk-audit.mjs": { helper: "onboardingProbeLicence", suspends: false },
};
for (const [file, { helper, suspends }] of Object.entries(walks)) {
  const src = readFileSync(file, "utf8");
  check(`C: ${file} derives its licence from ${helper}(STARTED)`, new RegExp(`${helper}\\(STARTED\\)`).test(src));
  check(`C: and types no fixed licence`, !/licenseNumber: "\d+"|LICENCE = "\d+"|license_number: "\d+"/.test(src), file);
  if (suspends) {
    const suspensions = src.match(/update\(\{ status: "suspended"[^}]*\}\)/g) ?? [];
    check(`D: ${file} releases the licence at every suspension (${suspensions.length})`, suspensions.length >= 2 && suspensions.every((s) => s.includes("license_number: null")), suspensions.join(" | "));
  }
}

const compliance = readFileSync("scripts/compliance-audit.mjs", "utf8");
check("E: compliance-audit refuses the nine digit probe range in src/config", compliance.includes("/\\b900\\d{6}\\b/g"));
check("E: and the onboarding range", compliance.includes("/\\b9[1-9]\\d{5}\\b/g"));
check("E: and still names the four fixed numbers", ["900000001", "900000002", "900000003", "900000004"].every((n) => compliance.includes(`"${n}"`)));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: a probe engineer's licence is its run's own, in a range no person holds, released when the probe is suspended, and refused in shipped configuration by range."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
