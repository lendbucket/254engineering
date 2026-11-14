/**
 * THE ENGINEER'S "YOUR PAY" IS HIS PRODUCTION CREDIT, AND ONLY HIS.
 *
 * Part 1 finding 7, Robert's answer 1 of 2026-11-14. The engineer holds
 * ledger.read_own, so /portal/pay opened payLedger, the TECHNICIAN's ledger,
 * under the eyebrow "Field" and a sentence about submitting evidence. It read
 * $0.00 for ever; his real pay is the production ledger.
 *
 * What must hold:
 *   1. The page sends an engineer to ownProductionPay before payLedger is read.
 *   2. ownProductionPay reads eng_production_ledger for engineer_id = the actor,
 *      every row (readEvery), with each row's demonstration flag, so payFigures
 *      applies the dashboards' rule.
 *   3. An unrecorded amount stays null rather than becoming zero.
 *   4. The engineer's view carries none of the technician's words.
 *   5. Ruling 6b-i: it is his own pay only; nothing here holds read_all.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const page = codeOf(readFileSync("src/app/portal/(app)/pay/page.tsx", "utf8"));
const main = page.slice(page.indexOf("export default async function PayPage("));
const branch = main.indexOf('if (actor?.role === "engineer") return <EngineerPay actor={actor} />;');
const tech = main.indexOf("await payLedger(actor)");
check("the page sends an engineer to his own production pay", branch > 0);
check("before the technician ledger is read", branch > 0 && tech > branch);

const view = page.slice(page.indexOf("async function EngineerPay("), page.indexOf("export default async function PayPage("));
check("the engineer's view reads ownProductionPay", /await ownProductionPay\(actor\)/.test(view));
check("and never payLedger", !view.includes("payLedger"));
check("its figures come from payFigures", /payFigures\(rows\)/.test(view));
check("it carries none of the technician's words", !/eyebrow="Field"|submit the evidence|flat rate/.test(view));

const eng = codeOf(readFileSync("src/lib/ops-engineer.ts", "utf8"));
const fn = eng.slice(eng.indexOf("export async function ownProductionPay("), eng.indexOf("export type TimeRow"));
check("ownProductionPay reads the production ledger", /\.from\("eng_production_ledger"\)/.test(fn));
check("for the actor alone", /\.eq\("engineer_id", actor\.id\)/.test(fn) && !fn.includes("ledger.read_all"));
check("every row, through readEvery", /await readEvery</.test(fn) && /\.range\(from, to\)/.test(fn));
check("with each file's demonstration flag", /eng_files\(is_demo\)/.test(fn) && /is_demo: \(r\.eng_files/.test(fn));
check("an unrecorded amount stays null", /amount_cents: r\.amount_cents === null \|\| r\.amount_cents === undefined \? null : Number\(r\.amount_cents\)/.test(fn));

console.log("");
if (wrong === 0) {
  console.log("PASS: an engineer's Your pay is his own production credit, every row, by the dashboards' rule.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
