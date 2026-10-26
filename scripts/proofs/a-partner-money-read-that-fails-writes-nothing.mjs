// @runtime react-server
//
// Declared because it imports src/lib/ops-partner-comp.ts and
// src/lib/ops-partners-admin.ts, which carry server-only.

/**
 * A PARTNER MONEY READ THAT FAILS WRITES NOTHING AND SAYS SO, AND THE
 * PARTNER'S NET IS OVER EVERY ENTRY.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-partner-money-read-that-fails-writes-nothing.mjs
 *
 * Robert's audit of 2026-10-24.
 *
 * F26. termsInForce read a failure as "no terms in force", so a delivery wrote
 *      a blocked accrual with no figure. One accrual per file is a unique
 *      index, so the real one could never be written after. The order read in
 *      the same function did the same through orderForFile.
 * F25. accrualsInPeriod read a failed count as zero, which is the first tier's
 *      rate.
 * F22. The partner detail screen discarded every read's error ($0.00, "No
 *      terms are set", or a 404 for the partner itself) and summed only the
 *      newest 100 ledger entries as "Net on the ledger".
 * F31. Issuing a statement and recording a payout audited "issued" and "paid"
 *      without checking the update; closing a period wrote a total of $0.00 when
 *      its recompute read failed.
 *
 * Against a fake PostgREST that pages, filters by partner and counts, with a
 * failure switch per table. Nothing reaches a database.
 */
process.env.SUPABASE_URL = "http://partner-reads-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "partner-reads-proof-not-a-key";
delete process.env.VERCEL_ENV;
delete process.env.RESEND_API_KEY;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const PARTNER = "00000000-0000-4000-8000-00000000aa01";
const FILE = "00000000-0000-4000-8000-00000000aa02";
const STATEMENT = "00000000-0000-4000-8000-00000000aa03";
const pad = (n) => String(n).padStart(4, "0");
const ENTRIES = [];
for (let i = 0; i < 250; i += 1) {
  ENTRIES.push({ id: `entry-${pad(i)}`, partner_id: PARTNER, kind: "accrual", amount_cents: 1000, status: "accrued", explanation: "proof", occurred_at: `2026-09-${String(1 + (i % 28)).padStart(2, "0")}T12:00:00Z`, payable_at: "2026-10-01T00:00:00Z", statement_id: null, order_id: null });
}
const state = { fail: new Set(), countNull: false, statementStatus: "open" };
let writes = [];
const json = (b, status = 200, headers = {}) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...headers } });
const page = (url, rows) => {
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  return rows.slice(offset, offset + limit);
};
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method || "GET").toUpperCase();
  const table = url.pathname.replace("/rest/v1/", "");
  if (state.fail.has(`${method} ${table}`) || state.fail.has(table)) return json({ message: `proof: ${method} ${table} failed`, code: "XX000" }, 500);
  if (method === "HEAD") {
    return new Response(null, { status: 200, headers: { "content-range": state.countNull ? "*/*" : "0-0/3" } });
  }
  if (method !== "GET") {
    let body = null;
    try { body = JSON.parse(init.body || "null"); } catch { body = null; }
    writes.push({ method, table, body });
    if (table === "eng_partner_statements" && method === "PATCH") {
      const moves = url.searchParams.get("status") === `eq.${state.statementStatus}`;
      return json(moves ? [{ id: STATEMENT }] : []);
    }
    return json(Array.isArray(body) ? body : [{ id: "written", ...(body ?? {}) }], 201);
  }
  if (table === "eng_files") return json([{ id: FILE, file_number: "F-PROOF-1", partner_id: PARTNER, delivered_at: "2026-10-20T15:00:00Z" }]);
  if (table === "eng_service_orders") return json([{ id: "order-1", status: "complete", created_at: "2026-10-01T00:00:00Z", reference: "254-PROOF-PARTNER-1", total_cents: 100000 }]);
  if (table === "eng_partner_terms") {
    return json([{ id: "terms-1", model: "percent_of_order", percent_bps: 1000, flat_cents: null, tiers: null, holdback_days: 30, effective_from: "2026-01-01", effective_to: null, note: null }]);
  }
  if (table === "eng_partners") return json([{ id: PARTNER, organisation: "Proof Partner, not real", contact_name: "Proof", contact_email: "partner-reads-proof@audit-probe.invalid", code: "PROOF", status: "active", created_at: "2026-01-01T00:00:00Z", agreement_version: null, payout_method: null, payout_reference: null, notes: null }]);
  if (table === "eng_partner_entries") return json(page(url, ENTRIES));
  if (table === "eng_partner_statements") return json([{ id: STATEMENT, reference: "PS-PROOF-1", status: state.statementStatus, partner_id: PARTNER, total_cents: 25000 }]);
  return json([]);
};

const { accrueForDelivery, issuePartnerStatement, recordPartnerPayout } = await import("../../src/lib/ops-partner-comp.ts");
const { partnerDetail, PartnerDetailUnreadable } = await import("../../src/lib/ops-partners-admin.ts");
const entryWrites = () => writes.filter((w) => w.table === "eng_partner_entries" && w.method === "POST");
const auditWrites = () => writes.filter((w) => w.table === "eng_audit_events");

/* The healthy path first, so the failures below are failures of the reads and not of the fake. */
writes = [];
const healthy = await accrueForDelivery(FILE);
check("with every read answering, a delivery accrues ten percent of the order", healthy.ok === true && entryWrites().length === 1 && entryWrites()[0].body?.amount_cents === 10000, JSON.stringify(entryWrites().map((w) => w.body?.amount_cents)));

for (const [table, label] of [["eng_partner_terms", "terms"], ["eng_service_orders", "order"]]) {
  writes = [];
  state.fail = new Set([table]);
  const failed = await accrueForDelivery(FILE);
  check(`a failed ${label} read writes nothing to the partner's ledger and says so (F26)`, failed.ok === false && entryWrites().length === 0 && /could not be/.test(failed.error ?? ""), JSON.stringify(failed));
}
state.fail = new Set(["HEAD eng_partner_entries"]);
writes = [];
const noCount = await accrueForDelivery(FILE);
check("a failed tier count writes nothing and says the tier is unknown (F25)", noCount.ok === false && entryWrites().length === 0 && /tier is unknown/.test(noCount.error ?? ""), JSON.stringify(noCount));
state.fail = new Set();
state.countNull = true;
writes = [];
const nullCount = await accrueForDelivery(FILE);
check("and a count that comes back empty is not zero either", nullCount.ok === false && entryWrites().length === 0, JSON.stringify(nullCount));
state.countNull = false;

/* F22 */
const admin = { id: "00000000-0000-4000-8000-00000000aa09", role: "admin", status: "active", grants: new Set(["partners.manage"]) };
const detail = await partnerDetail(admin, PARTNER);
check("the partner's net is over all 250 entries, not the newest 100", detail?.netCents === 250 * 1000 && detail?.ledger.length === 250, `${detail?.netCents} over ${detail?.ledger.length}`);
for (const table of ["eng_partner_terms", "eng_partner_entries", "eng_partners"]) {
  state.fail = new Set([table]);
  let threw = null;
  try { await partnerDetail(admin, PARTNER); } catch (err) { threw = err; }
  check(`a failed read of ${table} is said, never a zero, "no terms" or a missing partner`, threw instanceof PartnerDetailUnreadable, String(threw));
}
state.fail = new Set();

/* F31 */
state.statementStatus = "issued";
writes = [];
const notIssued = await issuePartnerStatement(STATEMENT);
check("issuing a statement that is no longer open is refused, and nothing audits it as issued", notIssued.ok === false && auditWrites().length === 0, JSON.stringify(notIssued));
state.statementStatus = "open";
writes = [];
const issued = await issuePartnerStatement(STATEMENT);
check("an open statement is issued and audited", issued.ok === true && auditWrites().length === 1, JSON.stringify(issued));
state.statementStatus = "issued";
state.fail = new Set(["PATCH eng_partner_statements"]);
writes = [];
const unpaid = await recordPartnerPayout({ statementId: STATEMENT, reference: "ACH-PROOF-1" });
check("a payout whose update fails is refused, and nothing audits it as paid", unpaid.ok === false && auditWrites().length === 0, JSON.stringify(unpaid));
state.fail = new Set();

const comp = readFileSync("src/lib/ops-partner-comp.ts", "utf8");
check(
  "closing a period refuses rather than writing a total over a failed recompute",
  /if \(!attachedRead\.ok\) \{\s*return \{\s*ok: false,/.test(comp) && !/attachedRead\.ok \? attachedRead\.rows : null/.test(comp),
);
const page2 = readFileSync("src/app/partner/(app)/page.tsx", "utf8");
check("the partner's own home says a failed terms read, never \"not set yet\"", /!termsRead\.ok \? \(/.test(page2));
const crm = readFileSync("src/lib/ops-crm.ts", "utf8");
check("a converted lead's failed accrual is written on the new file's timeline", /const leadAccrual = await accrueForQualifiedLead\(leadId\);\s*if \(!leadAccrual\.ok\)/.test(crm));

console.log("");
if (wrong === 0) {
  console.log("PASS: a partner money read that fails writes nothing and says so, and the partner's net is over every entry.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
