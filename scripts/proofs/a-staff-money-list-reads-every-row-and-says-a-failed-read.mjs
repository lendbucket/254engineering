// @runtime react-server
//
// Declared because it imports src/lib/ops-payments.ts, src/lib/ops-engineer.ts
// and src/lib/ops-field.ts, which carry server-only.

/**
 * A STAFF MONEY LIST READS EVERY ROW, AND A READ THAT FAILS IS SAID.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-staff-money-list-reads-every-row-and-says-a-failed-read.mjs
 *
 * Robert's audit of 2026-10-24.
 *
 * F21. ordersAwaitingAccount read the OLDEST 500 events, resolved ones
 *      included, and decided afterwards which were resolved, so once 500 had
 *      accumulated a new order needing an account never reached the list.
 * F23. productionLedger read the newest 300 rows with its error ignored, and
 *      the charge log summed "This month" and "Unpaid" from them; chargeLog
 *      turned a failed read into "Nothing recorded".
 * F24. payLedger returned [] on a failed read, so the Pay screen showed
 *      "Owed to you $0.00".
 *
 * Against a fake PostgREST that pages, with a failure switch per table.
 * Nothing reaches a database.
 */
process.env.SUPABASE_URL = "http://ledger-reads-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "ledger-reads-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const pad = (n) => String(n).padStart(4, "0");
const SAID = [];
for (let i = 0; i < 600; i += 1) SAID.push({ id: `ev-${pad(i)}`, order_id: `order-${pad(i)}`, event: "account.match_needed", summary: "proof" });
SAID.push({ id: "ev-new", order_id: "order-new", event: "account.match_needed", summary: "No rule could choose an account for this order." });
const PRODUCTION = [];
for (let i = 0; i < 400; i += 1) PRODUCTION.push({ id: `prod-${pad(i)}`, created_at: "2026-10-01T00:00:00Z", engineer_id: "eng-1", file_id: null, amount_cents: i < 350 ? 5000 : 7000, decision: "seal", period: i < 350 ? "2026-09" : "2026-10", status: "pending", note: null });

const state = { fail: null };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const inList = (url, key) => {
  const v = url.searchParams.get(key);
  return v && v.startsWith("in.(") ? v.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")) : null;
};
const page = (url, rows) => {
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  return rows.slice(offset, offset + limit);
};
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (state.fail === table) return json({ message: `proof: ${table} failed`, code: "XX000" }, 500);
  if (table === "eng_order_events") {
    if (url.searchParams.get("event") === "eq.email.sent") return json([]);
    return json(page(url, SAID));
  }
  if (table === "eng_service_orders") {
    /* accountCandidatesFor reads the one order by id, for its client and paying address. */
    if (url.searchParams.get("id")?.startsWith("eq.")) return json([{ client_id: null, customer_email: "ledger-reads-proof@audit-probe.invalid" }]);
    const ids = inList(url, "id") ?? [];
    /* Every old order has been attached since; only the new one still names no account. */
    return json(page(url, ids.sort().map((id) => ({ id, reference: id.toUpperCase(), account_id: id === "order-new" ? null : "acct-1" }))));
  }
  if (table === "eng_production_ledger") return json(page(url, PRODUCTION));
  return json([]);
};

const { ordersAwaitingAccount } = await import("../../src/lib/ops-payments.ts");
const { productionLedger, chargeLog } = await import("../../src/lib/ops-engineer.ts");
const { payLedger } = await import("../../src/lib/ops-field.ts");

/* F21 */
const waiting = await ordersAwaitingAccount();
check(
  "with 600 resolved orders before it, the one order still needing an account is listed",
  Array.isArray(waiting) && waiting.length === 1 && waiting[0].orderId === "order-new",
  Array.isArray(waiting) ? waiting.map((w) => w.orderId).join(", ") || "none" : String(waiting),
);
for (const table of ["eng_order_events", "eng_service_orders"]) {
  state.fail = table;
  check(`a failed read of ${table} is null, which is not none`, (await ordersAwaitingAccount()) === null);
}
state.fail = null;

/* F23 */
const admin = { id: "eng-1", role: "admin", status: "active", grants: new Set(["ledger.read_all", "responsible_charge.read_all"]) };
const prod = await productionLedger(admin);
const october = prod.ok ? prod.rows.filter((r) => r.period === "2026-10") : [];
const september = prod.ok ? prod.rows.filter((r) => r.period === "2026-09") : [];
check("the production ledger reads all 400 rows, not the newest 300", prod.ok === true && prod.rows.length === 400, prod.ok ? String(prod.rows.length) : prod.error);
check("so an older month is summed whole", september.length === 350 && october.length === 50, `${september.length} and ${october.length}`);
state.fail = "eng_production_ledger";
const prodFailed = await productionLedger(admin);
check("a failed production read is said, never an empty month", prodFailed.ok === false && /could not be read/.test(prodFailed.error), JSON.stringify(prodFailed));
state.fail = "eng_responsible_charge_log";
const logFailed = await chargeLog(admin, { period: "2026-10" });
check("a failed charge log read is said, never \"Nothing recorded\"", logFailed.ok === false, JSON.stringify(logFailed));
state.fail = null;

/* F24 */
state.fail = "eng_tech_pay_ledger";
const payFailed = await payLedger(admin);
check("a failed pay ledger read is said, never an empty ledger", payFailed.ok === false && /could not be read/.test(payFailed.error), JSON.stringify(payFailed));
state.fail = null;
const payHealthy = await payLedger(admin);
check("and a ledger with no rows is still a known empty one", payHealthy.ok === true && payHealthy.rows.length === 0, JSON.stringify(payHealthy));

/* The screens say it. */
const log = readFileSync("src/app/portal/(app)/charge-log/page.tsx", "utf8");
check("the charge log states each failed read where its figures would be", /!logRead\.ok \? \(/.test(log) && /!productionRead\.ok \? \(/.test(log));
const pay = readFileSync("src/app/portal/(app)/pay/page.tsx", "utf8");
check("the Pay screen shows no figure on a failed read", /if \(!read\.ok\) \{\s*return \(/.test(pay) && pay.indexOf("if (!read.ok)") < pay.indexOf("payFigures(rows)"));
const techs = readFileSync("src/app/portal/(app)/techs/page.tsx", "utf8");
check("the technicians screen states a failed pay ledger read", /!ledgerRead\.ok \? \(/.test(techs));

console.log("");
if (wrong === 0) {
  console.log("PASS: a staff money list reads every row, and a read that fails is said.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
