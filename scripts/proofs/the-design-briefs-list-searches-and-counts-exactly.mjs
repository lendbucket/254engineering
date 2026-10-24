/**
 * THE DESIGN BRIEFS LIST SEARCHES, FILTERS, SORTS AND PAGES, AND ITS FIGURES
 * ARE EXACT COUNTS, NEVER THE LENGTH OF ONE READ.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-design-briefs-list-searches-and-counts-exactly.mjs
 *
 * Office ready, operator ruling of 2026-10-20. The read used to stop at 200
 * rows and the screen printed "N awaiting a reply, M answered" from them: a
 * bounded read's length stated as totals, the defect CLAUDE.md records at a
 * queue of 668 reported as 20. The query rules are pure and run here; the
 * source is read for the exact counts, the failed read, and the paging.
 */
import { readFileSync } from "node:fs";

const { inquiryListQuery, inquirySearchOr, INQUIRY_PAGE_SIZE } = await import("../../src/lib/inquiry-list.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const none = inquiryListQuery({});
check("with nothing asked: everything, the soonest promise first, page one", none.show === "all" && none.sort === "due" && none.ascending === true && none.page === 1 && none.term === "");
check("received reads newest first unless told otherwise", inquiryListQuery({ sort: "received" }).ascending === false && inquiryListQuery({ sort: "received", dir: "asc" }).ascending === true);
check("an unknown filter or sort falls back", inquiryListQuery({ show: "deleted", sort: "budget" }).show === "all" && inquiryListQuery({ sort: "budget" }).sort === "due");
check("the term loses what or() reads as syntax", !/[,()*%]/.test(inquiryListQuery({ q: "a,b)(c*%" }).term));
check("a search reaches name, email, address and the phone's digits", inquirySearchOr("361 9") === "name.ilike.%361 9%,email.ilike.%361 9%,property_address.ilike.%361 9%,phone.ilike.%3%6%1%9%");
check("a page is fifty", INQUIRY_PAGE_SIZE === 50);

const src = readFileSync("src/lib/ops-inquiries.ts", "utf8");
const fn = src.slice(src.indexOf("export async function designInquiries("));
check("the list carries an exact count of what matches", /select\(COLUMNS, \{ count: "exact" \}\)/.test(fn));
check("and the open and answered figures are exact counts of their own, over the same search", (fn.match(/select\("id", \{ count: "exact", head: true \}\)/g) ?? []).length === 1 && /const \[open, answered\] = await Promise\.all\(\[figure\(false\), figure\(true\)\]\)/.test(fn) && /if \(search\) c = c\.or\(search\);/.test(fn));
check("no read stops at a hand-written limit any more", !/\.limit\(200\)/.test(fn));
check("any of the three failing is a failed read, never a smaller number", /if \(failed \|\| count === null \|\| open\.count === null \|\| answered\.count === null\)/.test(fn) && /return \{ ok: false, error: message \}/.test(fn));
check("it pages by range with a tie broken by id", /\.order\("id", \{ ascending: true \}\)\.range\(from, from \+ INQUIRY_PAGE_SIZE - 1\)/.test(fn));

const page = readFileSync("src/app/portal/(app)/inquiries/page.tsx", "utf8");
check("the figures on screen are the counts, not the rows' length", /\{read\.open\} awaiting a reply, \{read\.answered\} answered/.test(page) && !/rows\.length - open\.length/.test(page));
check("it offers search, a filter and a sort, and pages over the matching count", /<ListControls/.test(page) && /<Pager page=\{query\.page\} pageSize=\{INQUIRY_PAGE_SIZE\} total=\{read\.total\}/.test(page));
check("a failed read still says the list could not be loaded, never no briefs", /!read\.ok \? \(\s*<div role="alert" data-list-not-loaded/.test(page));
check("and an empty search says nothing matches rather than no briefs yet", /title="Nothing matches that search"/.test(page) && /const nothingAtAll = read\.ok && read\.open \+ read\.answered === 0 && query\.term === "";/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the design briefs list searches, filters, sorts and pages, and its figures are exact counts.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
