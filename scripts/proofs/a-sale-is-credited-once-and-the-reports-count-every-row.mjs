// @runtime react-server
/**
 * PROOF: A SALE IS CREDITED ONCE, WHERE IT HAPPENS, AND THE REPORTS COUNT
 * EVERY ROW. Robert's sales CRM ruling R8 of 2026-11-02: "/portal/crm/reports:
 * dials, connects, interested, accounts opened, orders and revenue
 * attributed, per rep per day, week and month; conversion by source and
 * vertical; a leaderboard; CSV export on the admin export gate. Attribution
 * chain prospect to account to order written on conversion and on each
 * order." And the grants rule: "reps see no revenue figures beyond their own
 * attributed orders."
 *
 *   A  0116 replayed: one opening per prospect, one row per order, a kind that
 *      matches its order, and the table refuses an update or a delete; an
 *      order's removal takes its row with it (cascade).
 *   B  attributeConversion and attributeOrder, run against that database:
 *      the rep is the owner or else the converter, a repeat credits once, an
 *      account not from a prospect is not credited, and a row is never written
 *      without its account.
 *   C  where it is written: placeOrder (every door, a bulk batch included),
 *      convertProspect, and invoiceAccount (a telephoned job) call it after
 *      the fact; nothing that READS (the reports, the accounts view) writes it.
 *   D  the period rules on the firm calendar: a late evening in Chicago is that
 *      day, a week runs Monday to Sunday, a month is YYYY-MM.
 *   E  the counts and revenue: dials, connects, interested, accounts opened,
 *      orders (counted statuses only), revenue less a succeeded refund, not set
 *      when a total is absent; the leaderboard's order; conversion by vertical
 *      and by source.
 *   F  who: only crm.reports reads the reports (a rep does not hold it); the
 *      CSV asks the admin export gate first and audits before the file; a rep
 *      sees revenue only on their own attributed orders on the accounts view.
 *   G  no silent cap: every read in the reports goes through readEvery or
 *      readEveryIn, and none carries a bare limit.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-sale-is-credited-once-and-the-reports-count-every-row.mjs
 */
/* No database is reached: an unresolvable project, so captureError and supabaseAdmin go nowhere. */
process.env.SUPABASE_URL = "http://crm-r8-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "crm-r8-proof-not-a-key";

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

const rules = await import("../../src/lib/crm-report-rules.ts");
const attribution = await import("../../src/lib/crm-attribution.ts");
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");
const { todayInFirmCalendar } = await import("../../src/lib/firm-calendar.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok: Boolean(ok), note });

async function refused(db, sql, params = []) {
  try {
    await db.query(sql, params);
    return { refused: false, message: "" };
  } catch (e) {
    return { refused: true, message: e.message };
  }
}

/* ------------------------------------------------------------------ A, replay */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0116_"));
check("0116 is in the chain", at >= 0, at >= 0 ? files[at] : "missing");
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1), REP = id(2), OTHER_REP = id(3), CLIENT = id(10), CLIENT_PLAIN = id(11), CLIENT_B = id(12), ACCOUNT = id(20), PLAIN_ACCOUNT = id(21);
await db.exec(`
  insert into auth.users (id) values ('${ADMIN}'), ('${REP}'), ('${OTHER_REP}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${ADMIN}', 'crm-r8-admin@audit-probe.invalid', 'R8 proof administrator, not a real person', 'admin', 'active'),
    ('${REP}', 'crm-r8-rep@audit-probe.invalid', 'R8 proof rep, not a real person', 'rep', 'active'),
    ('${OTHER_REP}', 'crm-r8-rep2@audit-probe.invalid', 'R8 proof second rep, not a real person', 'rep', 'active');
  insert into eng_clients (id, kind, name) values
    ('${CLIENT}', 'organization', 'R8 proof client, not a real firm'),
    ('${CLIENT_PLAIN}', 'organization', 'R8 proof plain client, not a real firm'),
    ('${CLIENT_B}', 'organization', 'R8 proof second client, not a real firm');
  insert into eng_customer_accounts (id, site, client_id, billing_mode, billing_email) values
    ('${ACCOUNT}', '254engineering', '${CLIENT}', 'invoice', 'crm-r8-account@audit-probe.invalid'),
    ('${PLAIN_ACCOUNT}', '254engineering', '${CLIENT_PLAIN}', 'card', 'crm-r8-plain@audit-probe.invalid');
`);
const prospectRow = await db.query(
  `insert into eng_prospects (company, phone, prospect_type, created_by, owner_id, status, stage, converted_at, converted_by, converted_client_id, converted_account_id)
   values ('R8 Proof Roofing', '361 555 0188', 'roofer', $1, $2, 'converted', 'account_opened', now(), $1, $3, $4) returning id`,
  [ADMIN, REP, CLIENT, ACCOUNT],
);
const PROSPECT = prospectRow.rows[0].id;

let orderN = 100;
async function order(accountId, status = "paid", total = 70900) {
  orderN += 1;
  const oid = id(orderN);
  await db.query(
    `insert into eng_service_orders (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county, status, total_cents, client_id, account_id)
     values ($1, '254engineering', $2, 'roof-inspections', 'field', 'R8 proof customer, not a real person', 'crm-r8-order@audit-probe.invalid', '1 Proof Way', 'Nueces', $3, $4, $5, $6)`,
    [oid, `254-PROOF-R8-${orderN}`, status, total, CLIENT, accountId],
  );
  return oid;
}

const O1 = await order(ACCOUNT);
const opened1 = await refused(db, `insert into eng_crm_attributions (kind, prospect_id, account_id, rep_id) values ('account_opened', $1, $2, $3)`, [PROSPECT, ACCOUNT, REP]);
check("A: an opening is recorded", !opened1.refused, opened1.message);
const opened2 = await refused(db, `insert into eng_crm_attributions (kind, prospect_id, account_id, rep_id) values ('account_opened', $1, $2, $3)`, [PROSPECT, ACCOUNT, REP]);
check("A: a second opening for the same prospect is refused", opened2.refused && /eng_crm_attributions_opened_once/.test(opened2.message), opened2.message);
const ord1 = await refused(db, `insert into eng_crm_attributions (kind, prospect_id, account_id, order_id, rep_id) values ('order', $1, $2, $3, $4)`, [PROSPECT, ACCOUNT, O1, REP]);
check("A: an order is credited", !ord1.refused, ord1.message);
const ord2 = await refused(db, `insert into eng_crm_attributions (kind, prospect_id, account_id, order_id, rep_id) values ('order', $1, $2, $3, $4)`, [PROSPECT, ACCOUNT, O1, OTHER_REP]);
check("A: the same order credited twice is refused, so credit cannot move to another rep by a second row", ord2.refused && /eng_crm_attributions_order_once/.test(ord2.message), ord2.message);
const badKind = await refused(db, `insert into eng_crm_attributions (kind, prospect_id, account_id, rep_id) values ('order', $1, $2, $3)`, [PROSPECT, ACCOUNT, REP]);
check("A: an order row with no order is refused", badKind.refused && /order_matches_kind/.test(badKind.message), badKind.message);
const edit = await refused(db, `update eng_crm_attributions set rep_id = $1 where order_id = $2`, [OTHER_REP, O1]);
check("A: credit already given cannot be edited", edit.refused, edit.message);
const del = await refused(db, `delete from eng_crm_attributions where kind = 'account_opened'`);
check("A: an opening cannot be deleted", del.refused, del.message);
const O_GONE = await order(ACCOUNT);
await db.query(`insert into eng_crm_attributions (kind, prospect_id, account_id, order_id, rep_id) values ('order', $1, $2, $3, $4)`, [PROSPECT, ACCOUNT, O_GONE, REP]);
const gone = await refused(db, `delete from eng_service_orders where id = $1`, [O_GONE]);
const left = await db.query(`select count(*)::int as n from eng_crm_attributions where order_id = $1`, [O_GONE]);
check("A: an order's removal takes its credit with it, and nothing else", !gone.refused && left.rows[0].n === 0, gone.message || `rows left ${left.rows[0].n}`);
const rls = await db.query(`select relrowsecurity from pg_class where relname = 'eng_crm_attributions'`);
check("A: row level security is on", rls.rows[0]?.relrowsecurity === true);

/* ------------------------------------------- B, the functions on that database */
/*
 * A minimal client over PGlite with the calls crm-attribution.ts makes:
 * select().eq().order().limit().maybeSingle(), select().eq().maybeSingle() and
 * insert(row). Errors carry Postgres's SQLSTATE as `code`, as PostgREST's do.
 */
function pgClient(pg) {
  return {
    from(table) {
      const q = { table, cols: "*", eq: [], order: null, limit: null };
      const builder = {
        select(cols) { q.cols = cols; return builder; },
        eq(col, val) { q.eq.push([col, val]); return builder; },
        order(col, opts) { q.order = [col, opts?.ascending === false ? "desc" : "asc"]; return builder; },
        limit(n) { q.limit = n; return builder; },
        async maybeSingle() {
          const where = q.eq.map(([c], i) => `${c} = $${i + 1}`).join(" and ");
          const sql = `select ${q.cols} from ${q.table}${where ? ` where ${where}` : ""}${q.order ? ` order by ${q.order[0]} ${q.order[1]}` : ""}${q.limit ? ` limit ${q.limit}` : ""}`;
          try {
            const r = await pg.query(sql, q.eq.map(([, v]) => v));
            return { data: r.rows[0] ?? null, error: null };
          } catch (e) {
            return { data: null, error: { message: e.message, code: e.code } };
          }
        },
        async insert(row) {
          const cols = Object.keys(row);
          const sql = `insert into ${q.table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`;
          try {
            await pg.query(sql, Object.values(row));
            return { error: null };
          } catch (e) {
            return { error: { message: e.message, code: e.code } };
          }
        },
      };
      return builder;
    },
  };
}
const client = pgClient(db);

/* A second converted prospect, owned by nobody, converted by the administrator. */
const ACCOUNT_B = id(22);
await db.exec(`insert into eng_customer_accounts (id, site, client_id, billing_mode, billing_email) values ('${ACCOUNT_B}', '254engineering', '${CLIENT_B}', 'invoice', 'crm-r8-b@audit-probe.invalid');`);
const unownedRow = await db.query(
  `insert into eng_prospects (company, phone, prospect_type, created_by, status, stage, converted_at, converted_by, converted_client_id, converted_account_id)
   values ('R8 Proof Solar', '361 555 0177', 'roofer', $1, 'converted', 'account_opened', now(), $1, $2, $3) returning id`,
  [ADMIN, CLIENT_B, ACCOUNT_B],
);
const UNOWNED = unownedRow.rows[0].id;

const conv = await attribution.attributeConversion(UNOWNED, client);
const convRow = await db.query(`select rep_id, account_id from eng_crm_attributions where kind = 'account_opened' and prospect_id = $1`, [UNOWNED]);
check("B: a conversion writes its opening", conv.ok && conv.attributed === "written" && convRow.rows.length === 1, JSON.stringify(conv));
check("B: and an unowned company is credited to whoever converted it", convRow.rows[0]?.rep_id === ADMIN && convRow.rows[0]?.account_id === ACCOUNT_B, JSON.stringify(convRow.rows[0]));
const conv2 = await attribution.attributeConversion(UNOWNED, client);
check("B: converting again credits nothing new", conv2.ok && conv2.attributed === "already", JSON.stringify(conv2));

const O2 = await order(ACCOUNT);
const o2 = await attribution.attributeOrder(O2, ACCOUNT, client);
const o2Row = await db.query(`select rep_id, prospect_id from eng_crm_attributions where order_id = $1`, [O2]);
check("B: an order for a converted account is credited to its owner", o2.ok && o2.attributed === "written" && o2Row.rows[0]?.rep_id === REP && o2Row.rows[0]?.prospect_id === PROSPECT, JSON.stringify(o2Row.rows[0]));
const o2again = await attribution.attributeOrder(O2, ACCOUNT, client);
check("B: a retried placement credits once", o2again.ok && o2again.attributed === "already", JSON.stringify(o2again));
const O3 = await order(PLAIN_ACCOUNT);
const o3 = await attribution.attributeOrder(O3, PLAIN_ACCOUNT, client);
const o3Rows = await db.query(`select count(*)::int as n from eng_crm_attributions where order_id = $1`, [O3]);
check("B: an order for an account that never was a prospect is not credited", o3.ok && o3.attributed === "not_from_a_prospect" && o3Rows.rows[0].n === 0, JSON.stringify(o3));
const anon = await attribution.attributeOrder(id(999), null, client);
check("B: an anonymous order (no account) is not credited", anon.ok && anon.attributed === "not_from_a_prospect");

/* -------------------------------------------------------- C, where it is written */
const src = (p) => readFileSync(p, "utf8");
const intake = src("src/lib/ops-intake.ts");
const placeBody = intake.slice(intake.indexOf("export async function placeOrder("));
const atInsertDone = placeBody.indexOf("const orderId = order.id as string;");
const atAttr = placeBody.indexOf("await attributeOrder(orderId, accountIdForPlacement(input));");
const atClient = placeBody.indexOf("const client = await createClient(");
check("C: placeOrder credits the order after the insert and before the client and file", atInsertDone > 0 && atAttr > atInsertDone && atClient > atAttr, `${atInsertDone} ${atAttr} ${atClient}`);
const bulk = src("src/lib/ops-bulk.ts");
check("C: a bulk batch places each property through placeOrder, so each is credited", /await placeOrder\(\{/.test(bulk));
const quotes = src("src/lib/ops-quotes.ts");
check("C: a converted quote places through placeOrder too", /await placeOrder\(\{/.test(quotes));
const prospectsSrc = src("src/lib/ops-prospects.ts");
const convBody = prospectsSrc.slice(prospectsSrc.indexOf("export async function convertProspect("));
const atMarked = convBody.indexOf("converted_account_id: account.id,");
const atConvAttr = convBody.indexOf("await attributeConversion(id);");
check("C: convertProspect credits the account after the prospect is marked converted", atMarked > 0 && atConvAttr > atMarked, `${atMarked} ${atConvAttr}`);
const billing = src("src/lib/ops-job-billing.ts");
const invBody = billing.slice(billing.indexOf("export async function invoiceAccount("));
const atCreated = invBody.indexOf('await createOrderForFile(actor, file, client, "invoice");');
const atInvAttr = invBody.indexOf("await attributeOrder(order.orderId, account ? String(account.id) : null);");
check("C: a telephoned job invoiced to an account is credited after its order is created", atCreated > 0 && atInvAttr > atCreated, `${atCreated} ${atInvAttr}`);
const reports = src("src/lib/crm-reports.ts");
const accounts = src("src/lib/crm-accounts.ts");
const writesOnRead = [reports, accounts].some((s) => /crm-attribution|attributeOrder|attributeConversion|\.from\("eng_crm_attributions"\)\s*\.insert/.test(s));
check("C: nothing that reads (the reports, the accounts view) writes credit", !writesOnRead);

/* ------------------------------------------------------- D, the firm calendar */
check("D: 11:30 PM on 2 November in Chicago is 2 November", todayInFirmCalendar(new Date("2026-11-03T05:30:00Z")) === "2026-11-02");
check("D: and 12:30 AM on 3 November in Chicago is 3 November", todayInFirmCalendar(new Date("2026-11-03T06:30:00Z")) === "2026-11-03");
check("D: a day is its own key", rules.periodKey("2026-11-04", "day") === "2026-11-04");
check("D: a Wednesday's week is its Monday", rules.periodKey("2026-11-04", "week") === "2026-11-02");
check("D: a Sunday belongs to the week that began the Monday before", rules.periodKey("2026-11-08", "week") === "2026-11-02");
check("D: the next Monday starts a new week", rules.periodKey("2026-11-09", "week") === "2026-11-09");
check("D: a week can cross a month (Monday 30 November)", rules.periodKey("2026-12-02", "week") === "2026-11-30");
check("D: a month is YYYY-MM", rules.periodKey("2026-11-30", "month") === "2026-11" && rules.periodKey("2026-12-01", "month") === "2026-12");
check("D: a malformed day has no period", rules.periodKey("2026-13-40", "day") === null && rules.periodKey("nope", "week") === null);

/* ----------------------------------------------------------- E, counts, money */
const calls = [
  { repId: REP, day: "2026-11-02", crmOutcome: "no_answer" },
  { repId: REP, day: "2026-11-02", crmOutcome: "voicemail" },
  { repId: REP, day: "2026-11-02", crmOutcome: "interested" },
  { repId: REP, day: "2026-11-03", crmOutcome: "callback" },
  { repId: REP, day: "2026-11-03", crmOutcome: "wrong_number" },
  { repId: OTHER_REP, day: "2026-11-03", crmOutcome: "not_interested" },
];
const opened = [{ repId: REP, day: "2026-11-03" }];
const orders = [
  { repId: REP, day: "2026-11-04", status: "paid", totalCents: 70900, refundedCents: 10000 },
  { repId: REP, day: "2026-11-04", status: "awaiting_payment", totalCents: 70900, refundedCents: 0 },
  { repId: REP, day: "2026-11-05", status: "refunded", totalCents: 70900, refundedCents: 70900 },
];
const byDay = rules.repPeriodRows("day", { calls, opened, orders });
const repDay2 = byDay.find((r) => r.repId === REP && r.period === "2026-11-02");
check("E: dials count every call", repDay2?.dials === 3, JSON.stringify(repDay2));
check("E: a connect is a call that reached somebody; no answer and voicemail are not", repDay2?.connects === 1 && repDay2?.interested === 1);
const repDay3 = byDay.find((r) => r.repId === REP && r.period === "2026-11-03");
check("E: a callback is a connect, a wrong number is not", repDay3?.dials === 2 && repDay3?.connects === 1 && repDay3?.interested === 0);
check("E: an opening counts on its day", repDay3?.accountsOpened === 1);
const repDay4 = byDay.find((r) => r.repId === REP && r.period === "2026-11-04");
check("E: an unpaid order is not a sale", repDay4?.orders === 1, JSON.stringify(repDay4));
check("E: revenue is the paid total less the succeeded refund: 709.00 less 100.00", repDay4?.revenueCents === 60900, String(repDay4?.revenueCents));
const repDay5 = byDay.find((r) => r.repId === REP && r.period === "2026-11-05");
check("E: a refunded order counts as an order and earns nothing", repDay5?.orders === 1 && repDay5?.revenueCents === 0, JSON.stringify(repDay5));
const byWeek = rules.repPeriodRows("week", { calls, opened, orders });
const repWeek = byWeek.find((r) => r.repId === REP);
check("E: a week sums its days (Monday 2 November)", repWeek?.period === "2026-11-02" && repWeek.dials === 5 && repWeek.orders === 2 && repWeek.revenueCents === 60900, JSON.stringify(repWeek));
check("E: an absent total leaves revenue not set, never summed as zero", rules.revenueOf([{ status: "paid", totalCents: null, refundedCents: 0 }, { status: "paid", totalCents: 100, refundedCents: 0 }]) === null);
const board = rules.leaderboard(byWeek);
check("E: the leaderboard puts accounts opened first", board[0]?.repId === REP && board[0].accountsOpened === 1, JSON.stringify(board));
const conversion = [
  { prospectId: "a", vertical: "roofer", sources: ["permits_san_antonio", "tdlr_electrical"], converted: true },
  { prospectId: "b", vertical: "roofer", sources: ["permits_san_antonio"], converted: false },
  { prospectId: "c", vertical: "solar", sources: [], converted: false },
];
const byV = rules.conversionBy("vertical", conversion);
check("E: conversion by vertical: 1 of 2 roofers", byV.find((x) => x.key === "roofer")?.converted === 1 && byV.find((x) => x.key === "roofer")?.prospects === 2);
const byS = rules.conversionBy("source", conversion);
check("E: a company in two sources counts under each", byS.find((x) => x.key === "tdlr_electrical")?.prospects === 1 && byS.find((x) => x.key === "permits_san_antonio")?.prospects === 2);
check("E: a company with no source is counted, as not recorded", byS.find((x) => x.key === "not recorded")?.prospects === 1);

/* ---------------------------------------------------------------- F, who */
const holders = (action) => DEFAULT_ROLES.filter((r) => r.grants.includes(action)).map((r) => r.key).sort();
const reportHolders = holders("crm.reports");
check("F: crm.reports is held by admin and ops_manager only", JSON.stringify(reportHolders) === JSON.stringify(["admin", "ops_manager"]), reportHolders.join(", "));
check("F: the reports refuse anybody without crm.reports", /if \(!actor \|\| !can\(actor, "crm\.reports"\)\) return \{ ok: false/.test(reports));
const page = src("src/app/portal/(app)/crm/reports/page.tsx");
check("F: the page is not found for anybody without crm.reports", /if \(!actor \|\| !can\(actor, "crm\.reports"\)\) notFound\(\);/.test(page));
const route = src("src/app/api/portal/crm/reports/route.ts");
const atGate = route.indexOf('if (!mayExport(actor, "crm.reports"))');
const atRead = route.indexOf("await salesReport(actor, period);");
const atAudit = route.indexOf("await writeAuditOrRefuse({");
const atRefuse = route.indexOf("if (!recorded.ok) return bad(");
const atFile = route.indexOf("new NextResponse(body");
check("F: the CSV asks the admin export gate before it reads anything", atGate > 0 && atRead > atGate, `${atGate} ${atRead}`);
check("F: and records the export before it builds the file, refusing when the record fails", atAudit > atRead && atRefuse > atAudit && atFile > atRefuse, `${atAudit} ${atRefuse} ${atFile}`);
check("F: money in the CSV goes through moneyCell, cells through csv()", /moneyCell\(row\.revenueCents\)/.test(route) && /const body = csv\(\{/.test(route));
check("F: a rep's accounts view reads only their own attributed orders", /\.eq\("rep_id", actor\.id\)/.test(accounts) && /mineOrderIds!\.has\(o\.orderId\)/.test(accounts));
check("F: and never the lifetime figure", /lifetimeRevenueCents: money \? lifetimeRevenueCents : null,/.test(accounts));

/* ------------------------------------------------------------ G, no silent cap */
const fromCalls = [...reports.matchAll(/\.from\("([a-z_]+)"\)/g)].length;
const readEvery = [...reports.matchAll(/await readEvery(?:In)?</g)].length;
check("G: every table the reports read is read whole (readEvery or readEveryIn)", fromCalls > 0 && readEvery === fromCalls, `${readEvery} whole reads for ${fromCalls} table reads`);
check("G: and none carries a bare limit", !/\.limit\(/.test(reports));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? `PASS: a sale is credited once where it happens, the reports count every row by rep, day, week and month, and only the manager sees them (${out.length} checks).`
    : `FAIL: ${failed} of ${out.length} checks.`,
);
process.exitCode = failed === 0 ? 0 : 1;
