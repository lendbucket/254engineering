/**
 * THE AUDIT TRAIL SEARCHES AND PAGES EVERY EVENT, AND IS NO LONGER CAPPED AT 200.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-audit-trail-pages-every-event.mjs
 *
 * Office ready, CLAUDE.md section 2d. The screen read the newest 200 events
 * and said "capped at 200 for now", so nothing older was reachable from the
 * portal. It now asks the database for one page and an exact count of the
 * whole matching set, and a count that does not come back is a failed read,
 * never a total of zero. Asked of the pure query and of the source; the live
 * refusal of every other role at the export door is roles-audit's.
 */
import { readFileSync } from "node:fs";

const { auditTrailQuery, AUDIT_PAGE_SIZE } = await import("../../src/lib/audit-trail-list.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const q = auditTrailQuery({ q: "a,b(c)%", who: "system", dir: "asc", page: "3" });
check("a term loses the characters or() treats as syntax", q.term === "a b c", JSON.stringify(q.term));
check("the filter, the order and the page are read", q.who === "system" && q.ascending === true && q.page === 3);
const d = auditTrailQuery({ who: "everyone", page: "-4" });
check("an unknown filter is everyone, newest first, page one", d.who === "" && d.ascending === false && d.page === 1);
check("a page is a hundred events", AUDIT_PAGE_SIZE === 100);

const lib = readFileSync("src/lib/audit-trail-list.ts", "utf8");
check("the page asks for an exact count beside its rows", /select\(COLUMNS, count \? \{ count: "exact" \} : undefined\)/.test(lib) && /matching\(db, query, true\)\.range\(from, from \+ AUDIT_PAGE_SIZE - 1\)/.test(lib));
check("and a missing count is a failed read, never zero", /if \(count === null \|\| count === undefined\) return \{ ok: false,/.test(lib));
check("the export reads every matching event through readEvery and the same builder", /readEvery<Record<string, unknown>>\(\(from, to\) => matching\(db, query, false\)\.range\(from, to\)\)/.test(lib));
check("the builder carries no cap of its own", !/\.limit\(/.test(lib));

const page = readFileSync("src/app/portal/(app)/audit/page.tsx", "utf8");
check("the screen reads through the builder, not a select of its own", /await auditTrailPage\(query\)/.test(page) && !/\.from\("eng_audit_events"\)/.test(page) && !/capped at 200/.test(page));
check("its title is the exact total, not the length of the page", /title=\{searching \? `\$\{total\} matching` : `\$\{total\} events`\}/.test(page) && !/events\.length/.test(page));
check("with controls, a pager and the export for the grant", /<ListControls\b/.test(page) && /<Pager page=\{query\.page\} pageSize=\{AUDIT_PAGE_SIZE\} total=\{total\}/.test(page) && /can\(actor, LIST_EXPORT_GRANT\)/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the audit trail searches and pages every event, with an exact count and no cap.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
