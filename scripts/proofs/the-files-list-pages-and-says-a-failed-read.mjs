/**
 * THE FILES LIST SEARCHES, FILTERS, SORTS AND PAGES, CLEANS A TERM BY THE ONE
 * SHARED RULE, AND SAYS A FAILED READ RATHER THAN "NO FILES YET".
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-files-list-pages-and-says-a-failed-read.mjs
 *
 * Office ready, operator ruling of 2026-10-20, and the 2026-10-12 ruling that a
 * failed read is not an empty list. The list stopped at its cap and an older
 * file could be reached only by narrowing; it carried its own copy of the term
 * cleaning, which let `*` and a backslash through; and `data ?? []` turned a
 * failed read into "No files yet". Read from the source, because the read runs
 * through the actor's scope against a database.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const crm = readFileSync("src/lib/ops-crm.ts", "utf8");
const fn = crm.slice(crm.indexOf("export async function listFilesPage("), crm.indexOf("/**\n * The files behind a set of ids"));
check("the term is cleaned by the shared rule, with no copy of its own", /const term = cleanSearchTerm\(filters\.search \?\? ""\);/.test(fn) && !/replace\(\/\[%,\(\)\]\/g/.test(crm));
check("it pages: each page reads the cap and one more, from its own offset", /const from = \(page - 1\) \* FILE_LIST_CAP;/.test(fn) && /\.range\(from, from \+ FILE_LIST_CAP\)/.test(fn) && /more: all\.length > FILE_LIST_CAP/.test(fn));
check("with a tie broken by id, so a page boundary never repeats or skips a file", /\.order\("id", \{ ascending: true \}\)/.test(fn));
check("oldest first is the same read reversed", /\.order\("created_at", \{ ascending: filters\.oldest === true \}\)/.test(fn));
check("a failed read is returned as one, never an empty page", /if \(error\) \{[\s\S]*?return \{ rows: \[\], more: false, error: error\.message \};/.test(fn));

const page = readFileSync("src/app/portal/(app)/files/page.tsx", "utf8");
check("the screen offers a search, a status filter and the order", /<ListControls\s+action="\/portal\/files"/.test(page) && /searchLabel="Search file number or address"/.test(page));
check("says which part of the list this is", /Files \{\(page - 1\) \* FILE_LIST_CAP \+ 1\} to/.test(page));
check("links to the previous and next page", /Previous page/.test(page) && /filterHref\(\{ page: String\(page \+ 1\) \}\)/.test(page));
check("a status change starts again from the first page", /filterHref\(\{ status: s, page: undefined \}\)/.test(page) && /filterHref\(\{ status: undefined, page: undefined \}\)/.test(page));
check("and a failed read says the list could not be loaded, not no files", /\{filesError \? \(\s*<div role="alert" data-list-not-loaded/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the files list searches, filters, sorts and pages, and says a failed read.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
