/**
 * WHO COULD TAKE THE JOB IS SAID BEFORE IT IS TAKEN, AND DISPATCH NEVER SHOWS
 * AN EMPTY LIST WITHOUT WHY. The Killeen call, item 1 (Robert, 2026-11-14).
 *
 * What must hold:
 *   1. coveragePreview runs dispatch's own candidates and plan (candidateTechs,
 *      planDispatch), so intake and dispatch cannot disagree.
 *   2. It invents no distance: no property is located before the job is taken.
 *   3. Names go to offers.dispatch alone; a failed read is said, never "nobody".
 *   4. New job asks it whenever the service or county changes, and says when
 *      nobody covers the county, who is certified and does not, and that a
 *      failed ask is a failed ask.
 *   5. The dispatch panel's empty states each say why and link to Technicians.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const field = codeOf(readFileSync("src/lib/ops-field.ts", "utf8"));
const fn = field.slice(field.indexOf("export async function coveragePreview("), field.indexOf("async function techFeeFor("));
check("it reads dispatch's own candidates", /const \{ candidates, unreadable \} = await candidateTechs\(\);/.test(fn));
check("and runs dispatch's own plan", /planDispatch\(\{ county, serviceSlug, lat: null, lng: null \}, candidates, null\)/.test(fn));
check("a failed read is said, never nobody", /if \(unreadable\.length\) return \{ known: false, why: `Who covers \$\{county\} County could not be read/.test(fn));
check("names go to offers.dispatch alone", /const names = can\(actor, "offers\.dispatch"\);/.test(fn) && /couldCover: names\s*\?/.test(fn) && /blocked: names\s*\?/.test(fn));
check("no distance is invented", !/milesBetween|distanceMiles/.test(fn));

const route = codeOf(readFileSync("src/app/api/portal/files/route.ts", "utf8"));
check("the route answers it for anybody who takes jobs or dispatches", /if \(action === "coverage_preview"\) \{\s*if \(!can\(actor, "files\.create"\) && !can\(actor, "offers\.dispatch"\)\)/.test(route));

const note = codeOf(readFileSync("src/app/portal/(app)/intake/CoverageNote.tsx", "utf8"));
check("New job asks whenever the service or county changes", /\}, \[key, serviceSlug, county\]\);/.test(note) && /action: "coverage_preview"/.test(note));
check("it says when nobody covers the county", /No certified technician covers \{preview\.county\} County for this service\./.test(note));
check("and who is certified and does not", /Certified for this service, not covering \{preview\.county\} County:/.test(note));
check("a failed ask is said", /if \(failed\) return <p role="alert"/.test(note));
const intake = codeOf(readFileSync("src/app/portal/(app)/intake/IntakeClient.tsx", "utf8"));
check("New job shows it under the county", /<CoverageNote serviceSlug=\{serviceSlug\} county=\{effectiveCounty \?\? null\} canAddCoverage=\{canAddCoverage\} \/>/.test(intake));

const panel = codeOf(readFileSync("src/app/portal/(app)/files/DispatchPanel.tsx", "utf8"));
check("an empty roster says so and links to Technicians", /offers\.length === 0 && ineligible\.length === 0 \?[\s\S]*?no field technician is on the roster[\s\S]*?href="\/portal\/techs"/.test(panel));
check("a coverage-only gap names the action", /ineligible\.every\(\(i\) => \/\^Does not cover \/\.test\(i\.reason\)\)[\s\S]*?Nobody covers this county/.test(panel));
const dispatch = codeOf(readFileSync("src/lib/ops-dispatch.ts", "utf8"));
check("the reason the panel matches is the plan's own wording", /reason: `Does not cover \$\{subject\.county\} County\.`/.test(dispatch));

const add = codeOf(readFileSync("src/lib/tech-coverage.ts", "utf8"));
check("adding a county asks profiles.update", /if \(!actor \|\| !can\(actor, "profiles\.update"\)\) return \{ ok: false/.test(add));
check("names it from the 254", /TEXAS_COUNTIES\.find\(/.test(add) && /is not one of the 254 Texas counties/.test(add));
check("only for a field technician", /if \(!tech \|\| tech\.role !== "field_tech"\)/.test(add));
check("adds and never removes", /const next = \[\.\.\.current, named\];/.test(add));
check("the audit row comes first and refuses the change if it cannot be written", add.indexOf("await writeAuditOrRefuse(") > 0 && add.indexOf("await writeAuditOrRefuse(") < add.indexOf(".update({ coverage_counties: next })"));
check("the note offers it only to whoever may", /\{canAddCoverage \? \(\s*<button/.test(note) && /canAddCoverage=\{can\(actor, "profiles\.update"\)\}/.test(codeOf(readFileSync("src/app/portal/(app)/intake/page.tsx", "utf8"))));
check("and asks again after it, on the same screen", /setRound\(\(r\) => r \+ 1\);/.test(note));

console.log("");
if (wrong === 0) {
  console.log("PASS: who could take the job is said before it is taken, by dispatch's own rules, and dispatch never shows an empty list without why.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
