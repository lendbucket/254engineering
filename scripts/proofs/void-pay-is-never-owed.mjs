/**
 * VOID PAY IS NEVER OWED, AND EVERY SCREEN ASKS THE SAME RULE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/void-pay-is-never-owed.mjs
 *
 * Product audit, 2026-10-10. The technician's dashboard counted every pay entry
 * not paid as owed, void included; the engineer's dashboard did the same under
 * a sentence saying "pending or approved"; the Pay screen summed pending and
 * approved over the newest 300 rows with demonstration files counted. Three
 * answers to one question. src/lib/pay-figures.ts is now the one rule.
 *
 * Two halves: the rule, asked with a ledger built to separate every case; and
 * the three readers, asked whether they use it rather than a filter of their
 * own (the shape the defect had). Pure: no database, no server.
 */
import { readFileSync } from "node:fs";

const { payFigures, isOwed, isPaid, OWED_STATUSES } = await import("../../src/lib/pay-figures.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  PASS`.replace("PASS", ok ? "PASS" : "FAIL") + `: ${name}${note ? ` (${note})` : ""}`);
};

/* Every status once, on a real file, plus each again on a demonstration file, plus an amount that is not a number. */
const ledger = [
  { status: "pending", amount_cents: 10_000 },
  { status: "approved", amount_cents: 2_000 },
  { status: "paid", amount_cents: 300 },
  { status: "void", amount_cents: 40 },
  { status: "pending", amount_cents: 5, is_demo: true },
  { status: "paid", amount_cents: 6, is_demo: true },
  { status: "pending", amount_cents: null },
];
const f = payFigures(ledger);
check("owed is pending plus approved, and nothing else", f.owedCents === 12_000, `${f.owedCents}`);
check("void is never owed", !isOwed("void") && f.owedCents !== 12_040, "a void entry is kept on the ledger and counted nowhere");
check("paid is paid", f.paidCents === 300 && isPaid("paid") && !isPaid("approved"), `${f.paidCents}`);
check("a demonstration file moves no figure", f.owedCents === 12_000 && f.paidCents === 300, "the 5 and 6 on demonstration files are not in either figure");
check("the owed statuses are exactly pending and approved, as a literal", JSON.stringify([...OWED_STATUSES].sort()) === JSON.stringify(["approved", "pending"]));

const read = (p) => readFileSync(p, "utf8");
const dash = read("src/lib/ops-dashboard.ts");
check(
  "both dashboards ask isOwed, and neither counts every status that is not paid",
  (dash.match(/isOwed\(r\.status\)/g) ?? []).length >= 2 && !/status\s*!==\s*"paid"/.test(dash),
  `${(dash.match(/isOwed\(r\.status\)/g) ?? []).length} isOwed call(s); a status !== "paid" filter ${/status\s*!==\s*"paid"/.test(dash) ? "IS present" : "is gone"}`,
);
const pay = read("src/app/portal/(app)/pay/page.tsx");
check("the Pay screen sums with payFigures, not a sum of its own", /payFigures\(rows\)/.test(pay) && !/sum\("pending"\)/.test(pay));
const field = read("src/lib/ops-field.ts");
const ledgerFn = field.slice(field.indexOf("export async function payLedger"), field.indexOf("export async function setLedgerStatus"));
check("and the ledger it sums is read whole, not capped at 300", /readEvery/.test(ledgerFn) && !/\.limit\(300\)/.test(ledgerFn));

console.log("");
if (wrong === 0) {
  console.log("PASS: void pay is never owed, and every screen asks the same rule.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
