// @runtime react-server
//
// Declared because it imports src/lib/ops-partner-comp.ts, ops-partners-admin.ts,
// ops-field.ts and ops-engineer.ts, which carry server-only.

/**
 * PROOF: A PARTNER'S CLOSE CLAIMS EVERY PAYABLE ENTRY PAST THE 150-ID CLIFF,
 * AND THREE READS EITHER REACH EVERY ROW OR SAY THEY FAILED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-long-claim-and-three-reads-reach-every-row.mjs
 *
 * The rest of the `.in()` and capped-read survey owed in BACKLOG.md ("OPEN:
 * SCREEN READS THAT STILL HIDE A FAILURE"), Robert's all-day add-on of
 * 2026-11-24, item 3:
 *
 *   A  closePartnerPeriod claimed every payable entry with ONE .in(). Past
 *      about 150 entries the request is refused, so that partner's period
 *      could never be closed or paid. It claims in chunks now, and a chunk
 *      that fails says how many went through and that closing again finishes.
 *   B  partnerRoster read the referred orders and the partner people in one
 *      request each. Past 1,000 orders the transport stops with no error, so
 *      partners after the cut read fewer referrals than they have; past about
 *      150 partners every one of its three reads was refused.
 *   C  revisionFor read the OLDEST 500 revision events. On a longer file the
 *      newest round was the part left out, and that round decides whether a
 *      package may be submitted.
 *   D  timeLog dropped its error, so a failed read rendered "Nothing logged by
 *      hand yet" over hours somebody had logged.
 *
 * The real functions run against a stub PostgREST held here. It applies the
 * filters these queries use, sorts by their order keys, applies an update to
 * the rows its filters select, REFUSES an in() list longer than 150 ids as the
 * measured cliff in src/lib/bounded-read.ts does, and never answers more than
 * 1,000 rows, as PostgREST does. No request leaves this process.
 */
import { readFileSync } from "node:fs";

const tables = {};
const failing = new Set();
/* table -> how many more writes succeed before the next one is refused */
const writesBeforeFailure = new Map();
let refusedForLength = 0;

const unquote = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);
function splitTop(inner) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (const ch of inner) {
    if (ch === '"') quoted = !quoted;
    if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.length) out.push(cur);
  return out;
}
const listOf = (value) => splitTop(value.slice(value.indexOf("(") + 1, value.lastIndexOf(")"))).map(unquote);

function matches(row, key, raw) {
  const v = row[key];
  if (raw.startsWith("eq.")) return String(v) === unquote(raw.slice(3));
  if (raw === "is.null") return v === null || v === undefined;
  if (raw.startsWith("lte.")) return String(v) <= raw.slice(4);
  if (raw.startsWith("gt.")) return String(v) > raw.slice(3);
  if (raw.startsWith("in.")) return listOf(raw).includes(String(v));
  throw new Error(`stub: filter ${key}=${raw} is not understood, so this proof would be guessing`);
}

function select(table, params) {
  let rows = [...(tables[table] ?? [])];
  for (const [key, raw] of params) {
    if (["select", "order", "offset", "limit"].includes(key)) continue;
    if (key === "or") {
      const terms = listOf(raw).length ? splitTop(raw.slice(1, -1)) : [];
      rows = rows.filter((r) =>
        terms.some((t) => {
          const dot = t.indexOf(".");
          return matches(r, t.slice(0, dot), t.slice(dot + 1));
        }),
      );
      continue;
    }
    if (raw.startsWith("in.") && listOf(raw).length > 150) return { refused: true };
    rows = rows.filter((r) => matches(r, key, raw));
  }
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((k) => {
      const [col, dir] = k.split(".");
      return { col, desc: dir === "desc" };
    });
    rows.sort((a, b) => {
      for (const { col, desc } of keys) {
        const x = a[col] ?? "";
        const y = b[col] ?? "";
        if (x < y) return desc ? 1 : -1;
        if (x > y) return desc ? -1 : 1;
      }
      return 0;
    });
  }
  return { rows };
}

let nextId = 1;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const table = url.pathname.split("/rest/v1/")[1] ?? "";
  const headers = new Headers(init.headers ?? {});
  const json = { "content-type": "application/json" };
  const fail = (message, status = 500) => new Response(JSON.stringify({ message, code: "XX000" }), { status, headers: json });
  if (failing.has(table)) return fail(`stub failure on ${table}`);

  if (method === "POST") {
    const body = JSON.parse(init.body ?? "null");
    const list = (Array.isArray(body) ? body : [body]).map((r) => ({ id: `row-${nextId++}`, created_at: new Date().toISOString(), ...r }));
    (tables[table] ??= []).push(...list);
    const single = (headers.get("accept") ?? "").includes("vnd.pgrst.object");
    return new Response(JSON.stringify(single ? list[0] : list), { status: 201, headers: json });
  }

  const found = select(table, url.searchParams);
  if (found.refused) {
    refusedForLength += 1;
    return fail("TypeError: fetch failed (stub: in() past the cliff)", 400);
  }

  if (method === "PATCH") {
    if (writesBeforeFailure.has(table)) {
      const left = writesBeforeFailure.get(table);
      if (left <= 0) return fail(`stub write refused on ${table}`);
      writesBeforeFailure.set(table, left - 1);
    }
    const patch = JSON.parse(init.body ?? "{}");
    for (const r of found.rows) Object.assign(r, patch);
    return new Response("[]", { status: 200, headers: json });
  }

  const rows = found.rows;
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const asked = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  const page = rows.slice(offset, offset + Math.min(asked, 1000));
  const range = { ...json, "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${rows.length}` };
  if (method === "HEAD") return new Response(null, { status: 200, headers: range });
  return new Response(JSON.stringify(page), { status: 200, headers: range });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const { closePartnerPeriod } = await import("../../src/lib/ops-partner-comp.ts");
const { partnerRoster } = await import("../../src/lib/ops-partners-admin.ts");
const { revisionFor } = await import("../../src/lib/ops-field.ts");
const { timeLog } = await import("../../src/lib/ops-engineer.ts");
const { IN_FILTER_CHUNK } = await import("../../src/lib/bounded-read.ts");
const { REVISION_REPLY, REVISIONS_REQUESTED } = await import("../../src/lib/revision-rules.ts");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}
const uuid = (prefix, i) => `${prefix}${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`;
const iso = (minute) => new Date(Date.UTC(2026, 9, 1, 0, minute)).toISOString();

console.log("the stub's limits are the real transport's");
check("the chunk the code uses is under the stub's cliff", IN_FILTER_CHUNK <= 150, `IN_FILTER_CHUNK ${IN_FILTER_CHUNK}`);

/* ------------------------------------------------------------------ A */
console.log("A  a partner's close claims every payable entry");
function seedLedger(partnerId, count) {
  for (let i = 0; i < count; i += 1) {
    tables.eng_partner_entries.push({
      id: uuid(`${partnerId}e`, i),
      partner_id: partnerId,
      statement_id: null,
      amount_cents: 1000,
      status: "accrued",
      kind: "commission",
      payable_at: iso(i % 600),
      occurred_at: iso(i % 600),
    });
  }
}
{
  tables.eng_partner_entries = [];
  tables.eng_partner_statements = [];
  tables.eng_audit_events = [];
  seedLedger("pa", 400);

  const before = refusedForLength;
  const r = await closePartnerPeriod("pa", "2026-10", { now: new Date(Date.UTC(2026, 10, 5)) });
  check("a close over 400 payable entries succeeds", r.ok === true, r.ok ? "" : r.error);
  check("no request fell off the cliff", refusedForLength === before, `${refusedForLength - before} refused`);
  if (r.ok) {
    check("it attaches all 400", r.entries === 400, `entries ${r.entries}`);
    check("and its total is all 400 of them", r.totalCents === 400000, `total ${r.totalCents}`);
    const loose = tables.eng_partner_entries.filter((e) => e.partner_id === "pa" && e.statement_id !== r.statementId);
    check("not one entry is left without the statement", loose.length === 0, `${loose.length} loose`);
    const header = tables.eng_partner_statements.find((s) => s.id === r.statementId);
    check("the statement's header carries the same total", header && Number(header.total_cents) === 400000);
  }
}
{
  seedLedger("pb", 400);
  /* Two chunks go through, the third is refused. */
  writesBeforeFailure.set("eng_partner_entries", 2);
  const first = await closePartnerPeriod("pb", "2026-10", { now: new Date(Date.UTC(2026, 10, 5)) });
  writesBeforeFailure.delete("eng_partner_entries");
  check("a close whose third chunk is refused does not say it closed", first.ok === false);
  if (!first.ok) {
    check("it says how many went through", first.error.includes(`${2 * IN_FILTER_CHUNK} of 400 entries were attached`), first.error);
    check("and that closing again finishes it", first.error.includes("Close the period again to finish it."));
  }
  const statements = () => tables.eng_partner_statements.filter((s) => s.partner_id === "pb");
  const again = await closePartnerPeriod("pb", "2026-10", { now: new Date(Date.UTC(2026, 10, 5)) });
  check("closing again succeeds", again.ok === true, again.ok ? "" : again.error);
  if (again.ok) {
    check("onto the same statement, not a second one", statements().length === 1, `${statements().length} statements`);
    check("with all 400 attached and a total of all 400", again.entries === 400 && again.totalCents === 400000, `entries ${again.entries}, total ${again.totalCents}`);
  }
}

/* ------------------------------------------------------------------ B */
console.log("B  the partner roster counts every referral and every person");
const admin = { id: "admin-1", role: "admin", status: "active", email: "proof@example.com", grants: new Set(["partners.manage"]) };
{
  tables.eng_partners = [];
  tables.eng_service_orders = [];
  tables.eng_partner_users = [];
  tables.eng_partner_entries = [];
  for (let i = 0; i < 200; i += 1) {
    const id = uuid("p", i);
    tables.eng_partners.push({ id, organisation: `Partner ${String(i).padStart(3, "0")}`, contact_name: "c", contact_email: "c@example.com", code: `C${i}`, status: "active", created_at: iso(0), agreement_version: null });
    /* Seven referred orders each: 1,400 in all, past the 1,000-row cap. */
    for (let k = 0; k < 7; k += 1) tables.eng_service_orders.push({ id: uuid(`o${k}`, i), partner_id: id });
    tables.eng_partner_users.push({ id: uuid("u", i), partner_id: id, status: "active" });
    tables.eng_partner_users.push({ id: uuid("s", i), partner_id: id, status: "suspended" });
  }
  const before = refusedForLength;
  const r = await partnerRoster(admin);
  check("the roster of 200 partners is read", r.ok === true, r.ok ? "" : r.error);
  check("no request fell off the cliff", refusedForLength === before, `${refusedForLength - before} refused`);
  if (r.ok) {
    check("nothing is reported as unreadable", r.failed.length === 0, r.failed.join(" | "));
    const wrongReferrals = r.rows.filter((p) => p.referrals !== 7);
    check("every partner reads all 7 referrals, 1,400 orders read past the cap", wrongReferrals.length === 0, `${wrongReferrals.length} wrong`);
    const wrongPeople = r.rows.filter((p) => p.people !== 1);
    check("every partner reads its one active person", wrongPeople.length === 0, `${wrongPeople.length} wrong`);
  }
  /*
   * Under the cliff and past the cap: 100 partners with 12 referred orders
   * each. One request is not refused here, it is answered with 1,000 of 1,200
   * rows and no error, which is the silent half of the defect.
   */
  tables.eng_partners = tables.eng_partners.slice(0, 100);
  const kept = new Set(tables.eng_partners.map((p) => p.id));
  tables.eng_partner_users = tables.eng_partner_users.filter((u) => kept.has(u.partner_id));
  tables.eng_service_orders = [];
  for (const id of kept) for (let k = 0; k < 12; k += 1) tables.eng_service_orders.push({ id: `${id}-o${String(k).padStart(2, "0")}`, partner_id: id });
  const capped = await partnerRoster(admin);
  if (capped.ok) {
    const short = capped.rows.filter((p) => p.referrals !== 12);
    check("100 partners under the cliff read all 12 referrals each, 1,200 orders past the cap", short.length === 0, `${short.length} read short`);
  } else check("100 partners under the cliff read all 12 referrals each, 1,200 orders past the cap", false, capped.error);

  failing.add("eng_service_orders");
  const broken = await partnerRoster(admin);
  failing.delete("eng_service_orders");
  check("a failed referrals read still answers the roster", broken.ok === true);
  if (broken.ok) {
    check("with every referral count missing, not zero", broken.rows.every((p) => p.referrals === null));
    check("and the failure named", broken.failed.some((f) => f.startsWith("Referrals could not be counted")), broken.failed.join(" | "));
  }
}

/* ------------------------------------------------------------------ C */
console.log("C  a returned file's latest round is read however long its history");
{
  tables.eng_file_events = [];
  tables.eng_evidence_items = [];
  tables.eng_checklist_exceptions = [];
  let id = 1;
  /* 300 earlier rounds, each a request and a reply: 600 events. */
  for (let i = 0; i < 300; i += 1) {
    tables.eng_file_events.push({ id: id++, file_id: "f1", kind: "status", to_status: REVISIONS_REQUESTED, body: `round ${i}`, created_at: iso(2 * i) });
    tables.eng_file_events.push({ id: id++, file_id: "f1", kind: REVISION_REPLY, to_status: null, body: `reply ${i}`, created_at: iso(2 * i + 1) });
  }
  /* The newest round, the one the screen must show. */
  tables.eng_file_events.push({ id: id++, file_id: "f1", kind: "status", to_status: REVISIONS_REQUESTED, body: "the newest round", created_at: iso(900) });
  /* Noise the filter must leave out. */
  tables.eng_file_events.push({ id: id++, file_id: "f1", kind: "status", to_status: "in_review", body: "not a revision", created_at: iso(901) });

  const r = await revisionFor("f1");
  check("it answers on a file with 601 revision events", r !== null);
  if (r) {
    check("the round it reads is the newest", r.round?.note === "the newest round", `read "${r.round?.note}"`);
    check("and the newest round has no reply yet", r.round?.reply === null);
  }
  failing.add("eng_file_events");
  const broken = await revisionFor("f1");
  failing.delete("eng_file_events");
  check("a failed read is null, never \"never sent back\"", broken === null);
}

/* ------------------------------------------------------------------ D */
console.log("D  the time log says a failed read");
{
  const engineer = { id: "eng-1", role: "engineer", status: "active", email: "e@example.com", grants: new Set(["time.log_own"]) };
  tables.eng_time_log = [
    { id: "t1", created_at: iso(1), profile_id: "eng-1", file_id: null, kind: "site_visit", started_at: iso(1), ended_at: iso(2), minutes: 60, note: null, entered_manually: true },
  ];
  const ok = await timeLog(engineer);
  check("a readable log answers its rows", ok.ok === true && ok.rows.length === 1);
  failing.add("eng_time_log");
  const broken = await timeLog(engineer);
  failing.delete("eng_time_log");
  check("a failed read is a failed read, not an empty log", broken.ok === false);

  const page = readFileSync(new URL("../../src/app/portal/(app)/charge-log/page.tsx", import.meta.url), "utf8");
  const failedAt = page.indexOf("!time.ok");
  const emptyAt = page.indexOf("Nothing logged by hand yet");
  check("the screen tests the failed read", failedAt > 0);
  check("before it can say nothing was logged", failedAt > 0 && emptyAt > failedAt);
  check("and says the failure in words", page.includes("this is a failed read, not an empty time log"));
}

console.log("");
if (failures) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("A long claim and three reads reach every row, or say they could not.");
