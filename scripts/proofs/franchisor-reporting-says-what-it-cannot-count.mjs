/**
 * FRANCHISOR REPORTING SAYS WHAT IT CANNOT COUNT (platform item X6). Robert's
 * standing list: "system wide revenue by territory, franchisee health,
 * royalty collection, Item 19 data set."
 *
 *   A  the rules: this month and last; a system total that is unknown when
 *      any part is, never zero; certificates expiring within 45 days, live
 *      ones only; collection and Item 19 are lines that say why nothing is
 *      shown.
 *   B  the code: the report asks franchise.manage; it reads every franchisee's
 *      territory in one pass through the one territory reader; a month whose
 *      statement total is unknown stays unknown; nothing reads a payment, so
 *      nothing claims a collection; the list screen shows it.
 */
import { readSource } from "../lib/read-source.mjs";

const rules = await import("../../src/lib/franchisor-report-rules.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------------ A, the rules */

check("A: this month and last, mid year", JSON.stringify(rules.thisAndLastMonth("2026-11-11")) === JSON.stringify({ thisMonth: "2026-11", lastMonth: "2026-10" }));
check("A: and across the year end", JSON.stringify(rules.thisAndLastMonth("2027-01-03")) === JSON.stringify({ thisMonth: "2027-01", lastMonth: "2026-12" }));
check("A: a total of known parts is their sum", rules.sumKnown([100, 250]) === 350);
check("A: a total with an unknown part is unknown, not the sum of the rest", rules.sumKnown([100, null, 250]) === null);
check("A: a total of nothing is zero", rules.sumKnown([]) === 0);
const today = "2026-11-11";
const c = (expiresOn, withdrawn = false) => ({ expiresOn, withdrawn });
check("A: a certificate expiring in exactly 45 days is flagged", rules.expiringSoon([c("2026-12-26")], today) === 1);
check("A: one expiring in 46 days is not", rules.expiringSoon([c("2026-12-27")], today) === 0);
check("A: one expiring today is flagged", rules.expiringSoon([c("2026-11-11")], today) === 1);
check("A: one already expired is not counted as expiring", rules.expiringSoon([c("2026-11-10")], today) === 0);
check("A: a withdrawn one is not counted", rules.expiringSoon([c("2026-11-20", true)], today) === 0);
check("A: the warning window is 45 days", rules.CERTIFICATE_WARNING_DAYS === 45);
check("A: collection is said not to be recorded", /Not recorded/.test(rules.COLLECTION_LINE) && /not shown as collected/.test(rules.COLLECTION_LINE));
check("A: Item 19 is said to be silent in year one, by FR4", /Silent in year one/.test(rules.ITEM_19_LINE) && /FR4/.test(rules.ITEM_19_LINE));

/* ------------------------------------------------------------------- B, the code */

const lib = readSource("src/lib/franchisor-report.ts");
check("B: the report asks franchise.manage first", /if \(!actor \|\| !can\(actor, "franchise\.manage"\)\) return refuse\(/.test(lib));
check(
  "B: every franchisee's territory is read in one pass, through the one reader",
  (lib.match(/territoryFactsForMany\(/g) ?? []).length === 1 && !/territoryFacts\(/.test(lib) && /const territory = await territoryFactsForMany\(db, franchiseeIds\);/.test(lib),
);
check("B: a month whose statement total is unknown stays unknown", /dueThisMonthCents: dueRow \? dueRow\.totalCents : 0,/.test(lib) && !/totalCents \?\? 0/.test(lib));
check("B: an unknown month's revenue stays unknown", /revenueThisMonthCents: monthOf\(thisMonth\) \? monthOf\(thisMonth\)!\.revenueCents : 0,/.test(lib));
check("B: the system totals keep unknown as unknown", (lib.match(/sumKnown\(/g) ?? []).length === 3);
check("B: nothing reads a payment, so nothing claims a collection", !/eng_order_payments|collected/i.test(lib.replace(/\/\*[\s\S]*?\*\//g, "")));
const page = readSource("src/app/portal/(app)/franchisees/page.tsx");
check("B: the list asks the report about every franchisee it holds", /const report = await franchisorReport\(actor, rows\.map\(\(r\) => r\.id\)\);/.test(page));
check("B: and shows collection and Item 19 as lines, not figures", /\{COLLECTION_LINE\}/.test(page) && /\{ITEM_19_LINE\}/.test(page));

console.log(wrong === 0 ? "PASS: franchisor reporting says what it cannot count." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
