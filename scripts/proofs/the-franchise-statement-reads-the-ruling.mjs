/**
 * THE ROYALTY AND FEE STATEMENT READS THE RULING (platform item X3, part two,
 * and 0129). Robert's fee ruling of 2026-11-10, his readings of 2026-11-11
 * (answer 8), and his answers 14 and 15 of 2026-11-11.
 *
 *   A  the arithmetic, with literal expectations: 7% and 2% of a month's
 *      territory revenue, each rounded once a month to the nearest cent, half
 *      up, never per order; the $400 technology fee from the first full
 *      calendar month after a franchisee starts operating; a month whose
 *      revenue is not known has no royalty, brand fund or total.
 *   B  the code: the statement asks franchise.manage, reads its revenue through
 *      the one territory reader the owner's screen uses, and types no fee; the
 *      CSV is audited before it is made; the status change writes the day a
 *      franchisee starts operating, once.
 *   C  0129, replayed: operating_since exists and is a nullable date.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readSource } from "../lib/read-source.mjs";

const rules = await import("../../src/lib/franchise-statement-rules.ts");
const own = await import("../../src/lib/own-franchise-rules.ts");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------- A, the arithmetic */

check("A: 7% of $1,234.56 is $86.42 (86.4192, rounded)", rules.rateOf(123_456, 700) === 8_642, String(rules.rateOf(123_456, 700)));
check("A: 2% of $1,234.56 is $24.69 (24.6912, rounded)", rules.rateOf(123_456, 200) === 2_469, String(rules.rateOf(123_456, 200)));
check("A: half a cent rounds up", rules.rateOf(50, 700) === 4 && rules.rateOf(150, 700) === 11, `${rules.rateOf(50, 700)}, ${rules.rateOf(150, 700)}`);
check("A: under half a cent rounds down", rules.rateOf(49, 700) === 3, String(rules.rateOf(49, 700)));
check("A: no revenue, no royalty", rules.rateOf(0, 700) === 0);

check("A: a franchisee that starts on the 1st owes the fee for that month", rules.technologyFeeFirstMonth("2026-11-01") === "2026-11");
check("A: one that starts later owes it from the next month", rules.technologyFeeFirstMonth("2026-11-02") === "2026-12");
check("A: and across the year end", rules.technologyFeeFirstMonth("2026-12-15") === "2027-01");
check("A: not operating, no fee", rules.technologyFeeFirstMonth(null) === null);

/* Three 50 cent orders in one month: per order would be 4 + 4 + 4 = 12 cents of royalty; per month it is 7% of $1.50, 11. */
const tiny = own.revenueByMonth([
  { status: "paid", totalCents: 50, refundedCents: 0, day: "2026-12-03" },
  { status: "paid", totalCents: 50, refundedCents: 0, day: "2026-12-04" },
  { status: "paid", totalCents: 50, refundedCents: 0, day: "2026-12-05" },
]);
const perMonth = rules.statementRows(tiny, null, "2026-12");
check("A: the royalty is rounded once a month, never per order", perMonth.length === 1 && perMonth[0].royaltyCents === 11, JSON.stringify(perMonth));

const revenue = [
  { month: "2027-01", orders: 2, revenueCents: 123_456 },
  { month: "2026-11", orders: 1, revenueCents: null },
];
const rows = rules.statementRows(revenue, "2026-11-20", "2027-02");
check(
  "A: the statement is every month with revenue and every month the fee is due, newest first",
  JSON.stringify(rows.map((r) => r.month)) === JSON.stringify(["2027-02", "2027-01", "2026-12", "2026-11"]),
  rows.map((r) => r.month).join(", "),
);
const jan = rows.find((r) => r.month === "2027-01");
check(
  "A: a month with revenue and the fee due carries all three, and their total",
  jan?.royaltyCents === 8_642 && jan?.brandFundCents === 2_469 && jan?.technologyFeeCents === 40_000 && jan?.totalCents === 51_111,
  JSON.stringify(jan),
);
const feb = rows.find((r) => r.month === "2027-02");
check("A: a month with the fee due and no order owes the fee alone", feb?.revenueCents === 0 && feb?.royaltyCents === 0 && feb?.technologyFeeCents === 40_000 && feb?.totalCents === 40_000, JSON.stringify(feb));
const nov = rows.find((r) => r.month === "2026-11");
check("A: a month before the fee is due owes none", nov?.technologyFeeCents === null);
check("A: a month whose revenue is not known has no royalty, brand fund or total", nov?.revenueCents === null && nov?.royaltyCents === null && nov?.brandFundCents === null && nov?.totalCents === null, JSON.stringify(nov));
check("A: the capacity fee is said to be not decided", /Not decided/.test(rules.CAPACITY_FEE_LINE) && /FR1/.test(rules.CAPACITY_FEE_LINE));

/* -------------------------------------------------------------------- B, the code */

const ruleSrc = readSource("src/lib/franchise-statement-rules.ts");
check("B: the rules read every fee from the fee file", /import \{ FRANCHISE_FEES \} from "@\/config\/franchise-fees";/.test(ruleSrc) && /setFee\("royalty"\)/.test(ruleSrc) && /setFee\("brandFund"\)/.test(ruleSrc) && /setFee\("technologyFee"\)/.test(ruleSrc));
check("B: and type none of the figures", !/\b(700|200|40_?000|3_?950_?000|2_?950_?000)\b/.test(ruleSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
const lib = readSource("src/lib/franchise-statement.ts");
check("B: the statement asks franchise.manage first", /if \(!actor \|\| !can\(actor, "franchise\.manage"\)\) return refuse\(/.test(lib));
check("B: its revenue is the one territory read the owner's screen uses", /const territory = await territoryFacts\(db, franchiseeId\);/.test(lib) && /territoryFacts\(db, franchiseeId\)/.test(readSource("src/lib/own-franchise.ts")));
const route = readSource("src/app/api/portal/franchisees/route.ts");
const branch = route.slice(route.indexOf('const statementId = params.get("statement");'), route.indexOf("const list = await listFranchisees("));
check("B: the CSV is on the admin export gate", route.indexOf('if (!mayExport(actor, "franchise.manage"))') > 0 && route.indexOf('if (!mayExport(actor, "franchise.manage"))') < route.indexOf('const statementId = params.get("statement");'));
check("B: and audited before the file is made", branch.indexOf("auditExportOrRefuse(") > 0 && branch.indexOf("auditExportOrRefuse(") < branch.indexOf("csv({"));
const status = readSource("src/lib/franchisees.ts");
check("B: the day it starts operating is written only when none is recorded", /const startsToday = change\.to === "operating" && !row\.operating_since \? todayInFirmCalendar\(\) : null;/.test(status) && /\.\.\.\(startsToday \? \{ operating_since: startsToday \} : \{\}\)/.test(status));

/* ------------------------------------------------------------------ C, replayed */

const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const at = files.indexOf("0129_a_franchisee_records_the_day_it_starts_operating.sql");
check("C: 0129 is in the chain", at >= 0);
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));
const col = (await db.query("select data_type, is_nullable from information_schema.columns where table_name = 'eng_franchisees' and column_name = 'operating_since'")).rows[0];
check("C: operating_since is a nullable date", col?.data_type === "date" && col?.is_nullable === "YES", JSON.stringify(col));
await db.close();

console.log(wrong === 0 ? "PASS: the royalty and fee statement reads the ruling." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
