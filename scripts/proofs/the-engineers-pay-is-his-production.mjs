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

/*
 * NO TECHNICIAN SENTENCE RENDERS FOR THE ENGINEER, ANYWHERE. Robert,
 * 2026-11-14, from the after walk: the screenshot predated 9dd2233, and he
 * asked for the property over every screen, not the one page. The sentences
 * are the technician's pay terms, written here as literals. Every screen the
 * engineer's own grants put in his menu (the layout's navFor and may) is read:
 * a technician sentence may appear only after an early return that sends the
 * engineer elsewhere. His dashboard is read the same way.
 */
const TECH_SENTENCES = [
  /flat rate/i,
  /submit the evidence/i,
  /independent of what the engineer/i,
  /wait on the engineer's decision/i,
  /eyebrow="Field"/,
  /One row per job\./,
];
const { navFor } = await import("../../src/components/portal/nav.ts");
const { DEFAULT_ROLES, may } = await import("../../src/lib/ops-authz.ts");
const engRole = DEFAULT_ROLES.find((r) => r.key === "engineer");
const engineer = { id: "probe-engineer", role: "engineer", status: "active", grants: new Set(engRole?.grants ?? []) };
const menu = navFor((a) => may(engineer, a));
const leaks = [];
for (const item of menu) {
  const path = `src/app/portal/(app)${item.href.replace(/^\/portal/, "")}/page.tsx`;
  let code;
  try {
    code = codeOf(readFileSync(path, "utf8"));
  } catch {
    leaks.push(`${item.href}: no page to read`);
    continue;
  }
  const away = code.search(/if \(actor\?\.role === "engineer"\) return /);
  for (const re of TECH_SENTENCES) {
    const at = code.search(re);
    if (at >= 0 && !(away >= 0 && away < at)) leaks.push(`${item.href}: ${re}`);
  }
}
check(
  `no technician sentence renders on any of the ${menu.length} screens the engineer's grants open`,
  menu.length >= 5 && leaks.length === 0,
  leaks.join("; ") || menu.map((i) => i.href).join(", "),
);
const dash = codeOf(readFileSync("src/lib/ops-dashboard.ts", "utf8"));
const engDash = dash.slice(dash.indexOf("async function engineerDashboard("), dash.indexOf("async function techDashboard("));
check(
  "nor on his dashboard",
  engDash.length > 100 && TECH_SENTENCES.every((re) => !re.test(engDash)),
);
check(
  "and the dashboard sends him there by the review grant before the technician's",
  /if \(can\(actor, "evidence\.review"\)\) return engineerDashboard\(actor\);\s*if \(can\(actor, "offers\.list_own"\)\) return techDashboard\(actor\);/.test(dash),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: an engineer's Your pay is his own production credit, every row, by the dashboards' rule.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
