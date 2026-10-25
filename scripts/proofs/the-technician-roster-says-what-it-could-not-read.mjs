/**
 * THE TECHNICIAN ROSTER SEARCHES, FILTERS AND SORTS, AND SAYS WHAT IT COULD NOT
 * READ RATHER THAN SHOWING NOBODY, OR ZERO OWED.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-technician-roster-says-what-it-could-not-read.mjs
 *
 * Office ready, operator ruling of 2026-10-20, and the 2026-10-12 ruling that a
 * failed read is not an empty list. techRoster returned [] when the roster
 * could not be read, and when the pay ledger could not be read every
 * technician showed $0.00 outstanding: an understatement of what the firm owes
 * a person. The filter and sort are pure and run here on built rows; the read
 * and the screen are read for each failure path.
 */
import { readFileSync } from "node:fs";

const { techListQuery, techListRows } = await import("../../src/lib/tech-list.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const tech = (id, name, status, openJobs, pendingCents, county) => ({
  id, display_name: name, email: `${id}@audit-probe.invalid`, phone: null, status, coverage_counties: [county], base_city: null, base_county: null,
  base_lat: null, base_lng: null, certifications: [], openJobs, completedJobs: 0, pendingCents, paidCents: 0, expiringCredentials: [],
});
const rows = [tech("a", "Cole", "active", 2, 9000, "Nueces"), tech("b", "Avery", "suspended", 0, 0, "Kleberg"), tech("c", "Blair", "active", null, null, "Bexar")];
const ids = (q) => techListRows(rows, techListQuery(q)).map((t) => t.id).join("");

check("by default everyone, A to Z", ids({}) === "bca");
check("active only", ids({ status: "active" }) === "ca");
check("not active", ids({ status: "inactive" }) === "b");
check("a search reaches a coverage county", ids({ q: "kleb" }) === "b");
check("open jobs reads the most first, and a count that could not be read sorts last", ids({ sort: "open" }) === "abc");
check("and still last the other way round", ids({ sort: "open", dir: "asc" }) === "bac");
check("owed reads the most first, the unknown last", ids({ sort: "owed" }) === "abc");
check("and the rows it was given are never reordered", rows.map((t) => t.id).join("") === "abc");

const field = readFileSync("src/lib/ops-field.ts", "utf8");
const fn = field.slice(field.indexOf("export async function techRoster("), field.indexOf("export type LedgerRow"));
check("a roster that could not be read is a failed read, not an empty bench", /if \(profilesError\) \{[\s\S]*?return \{ ok: false, error: profilesError\.message \};/.test(fn));
check("a pay ledger that could not be read makes every pay figure unknown, never the sum of no rows", /pendingCents: ledger === null \? null :/.test(fn) && /paidCents: ledger === null \? null :/.test(fn));
check("job counts that could not be read are missing, not zero", /openJobs: filesError \? null :/.test(fn) && /completedJobs: filesError \? null :/.test(fn));
check("and every source that failed is named", /certsError \?/.test(fn) && /filesError \?/.test(fn) && /credsError \?/.test(fn) && /ledger === null \?/.test(fn) && /return \{ ok: true, rows, failed \};/.test(fn));

const page = readFileSync("src/app/portal/(app)/techs/page.tsx", "utf8");
check("the screen says the roster could not be loaded rather than no technicians", /!rosterRead\.ok \? \(\s*<div role="alert" data-list-not-loaded/.test(page));
check("names each failed source above the list", /rosterRead\.failed\.map\(\(f\) => <li key=\{f\}>\{f\}<\/li>\)/.test(page));
check("and shows no pay figure when pay could not be read", /"Could not be read, so not shown; it is not zero"/.test(page));
check("it offers search, a status filter and a sort", /<ListControls/.test(page) && /const shown = techListRows\(roster, query\);/.test(page) && /\{shown\.map\(\(tech\) =>/.test(page));
check("and coverage still counts the whole active bench, not the filtered list", /for \(const tech of roster\) \{/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the technician roster searches, filters and sorts, and says what it could not read.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
