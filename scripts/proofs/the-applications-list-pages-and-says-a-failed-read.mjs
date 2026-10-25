/**
 * THE APPLICATIONS LIST SEARCHES, FILTERS BY POSITION AND PAGES, AND SAYS A
 * FAILED READ RATHER THAN "NO APPLICATIONS".
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-applications-list-pages-and-says-a-failed-read.mjs
 *
 * Office ready, operator ruling of 2026-10-20, and the 2026-10-12 ruling that a
 * failed read is not an empty list. listApplications(limit = 200) returned
 * `data ?? []`, so a failed read showed "No applications" and the 201st
 * applicant was never shown. Read from the source.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const lib = readFileSync("src/lib/admin-data.ts", "utf8");
const fn = lib.slice(lib.indexOf("export async function listApplicationsPage("), lib.indexOf("export async function getApplication("));
check("the read still checks the session itself first", /await requireAdmin\(\);/.test(fn));
check("a search over name, email and city, cleaned by the shared rule", /const term = cleanSearchTerm\(options\.q \?\? ""\);/.test(fn) && /name\.ilike\.%\$\{term\}%,email\.ilike\.%\$\{term\}%,city\.ilike\.%\$\{term\}%/.test(fn));
check("a position filter that accepts only the two positions", /options\.role === "professional_engineer" \|\| options\.role === "field_technician"/.test(fn));
check("it pages, reading one past the page, with a tie broken by id", /\.range\(from, from \+ APPLICATION_PAGE_SIZE\)/.test(fn) && /more: all\.length > APPLICATION_PAGE_SIZE/.test(fn) && /\.order\("id", \{ ascending: true \}\)/.test(fn));
check("a failed read is returned as one", /if \(error\) \{[\s\S]*?return \{ ok: false, error: error\.message \};/.test(fn) && !/export async function listApplications\(limit/.test(lib));

const page = readFileSync("src/app/portal/(app)/applications/page.tsx", "utf8");
check("the screen offers the search and the position filter", /<ListControls\s+action="\/portal\/applications"/.test(page) && /name: "role"/.test(page));
check("a failed read says the list could not be loaded", /\{!read\.ok \? \(\s*<div role="alert" data-list-not-loaded/.test(page));
check("an empty search says nothing matches, not no applications", /title="No application matches that search"/.test(page));
check("and it links to the previous and next page", /Previous page/.test(page) && /\{ page: String\(page \+ 1\) \}/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the applications list searches, filters and pages, and says a failed read.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
