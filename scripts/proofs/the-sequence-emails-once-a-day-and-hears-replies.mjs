// @runtime react-server
//
// Declared because it imports src/lib/crm-email.ts and the reply route, which carry server-only.

/**
 * PROOF: THE SALES SEQUENCE EMAILS ONCE A DAY, ON THE FIRM'S CALENDAR, NEVER TO
 * A SUPPRESSED ADDRESS, WITH THE UNSUBSCRIBE LINK, AND HEARS REPLIES ONCE.
 * Robert's sales CRM ruling of 2026-11-02, item R7: "A default sequence per
 * vertical (call day 1, email day 2, call day 5, email day 9, call day 14, then
 * dormant) that creates the next task on each outcome; email templates per
 * vertical with the unsubscribe link, From and Reply-To rules, suppression
 * consulted, one send per address per day; a reply to any email lands in the
 * existing inbox linked to the company." Migration 0115.
 *
 *   A  the timings after an email step, on the firm's calendar: weekends and
 *      the firm holidays (Thanksgiving and the day after) move the next call,
 *      due at 9:00 AM Central; the last step goes dormant; when an email is
 *      due and when it is not
 *   B  0115 on a replay: both tables with row level security and no policy;
 *      one queued send per address per firm day; a failed send frees the day;
 *      the address is stored normalized; a reply is recorded once per event
 *   C  the send path, run against a stand-in for the database: a suppressed
 *      address is not sent, writes no ledger row and no job, says why in the
 *      history and moves to the next call; a clean address writes the ledger
 *      BEFORE the job, and the job carries the unsubscribe link; a second send
 *      the same day is refused and queues nothing
 *   D  every rendered sequence email carries the unsubscribe link, and the
 *      template is a marketing one
 *   E  the reply route: 404 while RESEND_WEBHOOK_SECRET is unset, 400 on a bad
 *      signature, and an event claimed once
 */

import { PGlite } from "@electric-sql/pglite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

process.env.SUPABASE_URL = "http://sequence-email-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sequence-email-proof-not-a-key";
process.env.OPS_SESSION_SECRET = "sequence-email-proof-signing-secret-not-a-real-one";
delete process.env.VERCEL_ENV;
/* Unset for this process, so the route is in the state it ships in: closed. */
Reflect.deleteProperty(process.env, "RESEND_WEBHOOK_SECRET");

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

/* ---------------------------------------------------------------------- A */
const rules = await import("../../src/lib/crm-email-rules.ts");
const queueRules = await import("../../src/lib/crm-queue-rules.ts");
const same = (a, b) => a !== null && b !== null && Date.parse(a) === Date.parse(b);

const monday = new Date("2026-11-02T16:00:00Z");
const a1 = rules.planAfterEmail({ stage: "new", sequenceStep: 2 }, true, monday);
check("A: the day 2 email sent on Monday 2 November schedules the day 5 call for Thursday 5 November at 9:00 AM Central", a1.sequenceStep === 3 && a1.nextActionKind === "call" && same(a1.nextActionAt, "2026-11-05T15:00:00Z"), JSON.stringify(a1));
check("A: and a new company that was sent an email becomes attempted", a1.stage === "attempted");
const a2 = rules.planAfterEmail({ stage: "new", sequenceStep: 2 }, true, new Date("2026-11-23T16:00:00Z"));
check("A: three days after Monday 23 November is Thanksgiving, the day after is a holiday and then a weekend, so the call is Monday 30 November", same(a2.nextActionAt, "2026-11-30T15:00:00Z"), JSON.stringify(a2));
const a3 = rules.planAfterEmail({ stage: "attempted", sequenceStep: 4 }, true, new Date("2026-12-14T16:00:00Z"));
check("A: the day 9 email on Monday 14 December schedules the day 14 call five days on, Saturday, moved to Monday 21 December", a3.sequenceStep === 5 && a3.nextActionKind === "call" && same(a3.nextActionAt, "2026-12-21T15:00:00Z"), JSON.stringify(a3));
const a4 = rules.planAfterEmail({ stage: "new", sequenceStep: 2 }, false, monday);
check("A: an email that was not sent keeps the stage and still moves to the next call", a4.stage === "new" && a4.sequenceStep === 3 && same(a4.nextActionAt, "2026-11-05T15:00:00Z") && /Not sent/.test(a4.said), JSON.stringify(a4));
check("A: after the last step there is nothing, and the company goes dormant", queueRules.nextStepAfter(5, "2026-11-02") === null && rules.planAfterEmail({ stage: "attempted", sequenceStep: 5 }, true, monday).stage === "dormant");
check("A: the sequence is the approved one: call 1, email 2, call 5, email 9, call 14", queueRules.SEQUENCE.map((s) => `${s.kind}${s.day}`).join() === "call1,email2,call5,email9,call14");
const due = { stage: "attempted", sequenceStep: 2, nextActionKind: "email", nextActionAt: "2026-11-02T15:00:00Z", sequencePausedAt: null };
check("A: an email step whose time has come is due", rules.emailDue(due, monday).ok === true);
check("A: one whose time has not come is not", rules.emailDue({ ...due, nextActionAt: "2026-11-03T15:00:00Z" }, monday).ok === false);
check("A: a company that replied waits for a person", /replied/.test(rules.emailDue({ ...due, sequencePausedAt: "2026-11-02T14:00:00Z" }, monday).error ?? ""));
check("A: a company on do not contact or dormant is never due", rules.emailDue({ ...due, stage: "do_not_contact" }, monday).ok === false && rules.emailDue({ ...due, stage: "dormant" }, monday).ok === false);
check("A: a call step is not an email", rules.emailDue({ ...due, nextActionKind: "call" }, monday).ok === false && rules.emailDue({ ...due, sequenceStep: 3 }, monday).ok === false);
check("A: the firm day is Central: 10:30 PM on 2 November is still 2 November", rules.firmDay(new Date("2026-11-03T04:30:00Z")) === "2026-11-02" && rules.firmDay(new Date("2026-11-03T06:30:00Z")) === "2026-11-03");

/* ---------------------------------------------------------------------- B */
const pg = new PGlite();
await pg.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0115_"));
check("B: 0115 is in the chain", at >= 0, at >= 0 ? files[at] : "missing");
for (const f of files.slice(0, at + 1)) await pg.exec(readSource(join(DIR, f)));

const rls = await pg.query(`select relname, relrowsecurity from pg_class where relname in ('eng_crm_email_sends', 'eng_crm_email_replies') order by relname`);
check("B: both tables carry row level security", rls.rows.length === 2 && rls.rows.every((r) => r.relrowsecurity), JSON.stringify(rls.rows));
const policies = await pg.query(`select count(*)::int as n from pg_policies where tablename in ('eng_crm_email_sends', 'eng_crm_email_replies')`);
check("B: and no policy, so only the service role reads them", policies.rows[0].n === 0);
const paused = await pg.query(`select data_type from information_schema.columns where table_name = 'eng_prospects' and column_name = 'sequence_paused_at'`);
check("B: a company can have its sequence paused", paused.rows[0]?.data_type === "timestamp with time zone");

const REP = "00000000-0000-4000-8000-0000000007a1";
await pg.exec(`
  insert into auth.users (id) values ('${REP}');
  insert into eng_profiles (id, email, display_name, role, status)
    values ('${REP}', 'crm-r7@audit-probe.invalid', 'CRM R7 proof rep, not a real person', 'rep', 'active');
`);
const P = (await pg.query(`insert into eng_prospects (company, phone, prospect_type, created_by) values ('R7 Proof Roofing', '+1 361 555 0170', 'roofer', $1) returning id`, [REP])).rows[0].id;
const send = (address, day, status = "queued", failure = null) =>
  refused(pg, `insert into eng_crm_email_sends (prospect_id, address, firm_day, sequence_step, variant, vertical, sent_by, status, failure) values ($1, $2, $3, 2, 'prelaunch', 'roofer', $4, $5, $6)`, [P, address, day, REP, status, failure]);

const first = await send("owner@r7-proof.invalid", "2026-11-02");
check("B: the first send to an address on a firm day is recorded", !first.refused, first.message);
const second = await send("owner@r7-proof.invalid", "2026-11-02");
check("B: a second send to that address the same day is refused by the once a day index", second.refused && /eng_crm_email_sends_once_a_day/.test(second.message), second.message);
const nextDay = await send("owner@r7-proof.invalid", "2026-11-03");
check("B: the next day is a new day", !nextDay.refused, nextDay.message);
await pg.query(`update eng_crm_email_sends set status = 'failed', failure = 'proof: the queue refused it' where address = 'owner@r7-proof.invalid' and firm_day = '2026-11-02'`);
const retry = await send("owner@r7-proof.invalid", "2026-11-02");
check("B: a send that failed to queue frees the day, so the rep can press Send again", !retry.refused, retry.message);
const upper = await send("Owner@R7-Proof.invalid", "2026-11-04");
check("B: an address is stored normalized, so a capital letter cannot dodge the index", upper.refused && /eng_crm_email_sends_address_normalized/.test(upper.message), upper.message);
const silentFail = await send("other@r7-proof.invalid", "2026-11-02", "failed", null);
check("B: a failed send says why", silentFail.refused && /eng_crm_email_sends_failure_says_why/.test(silentFail.message), silentFail.message);

const reply = (event, prospect, matched) =>
  refused(pg, `insert into eng_crm_email_replies (event_id, prospect_id, matched_by, from_address, subject) values ($1, $2, $3, 'owner@r7-proof.invalid', 'Re: proof')`, [event, prospect, matched]);
const r1 = await reply("msg_proof_1", P, "sender");
check("B: a reply is recorded", !r1.refused, r1.message);
const r2 = await reply("msg_proof_1", P, "sender");
check("B: the same event delivered again is refused, so a redelivery writes nothing twice", r2.refused && /eng_crm_email_replies_event_once/.test(r2.message), r2.message);
const r3 = await reply("msg_proof_2", null, "sender");
check("B: a reply that names a match must name the company", r3.refused && /eng_crm_email_replies_match_names_a_company/.test(r3.message), r3.message);
const r4 = await reply("msg_proof_3", null, "none");
check("B: and one that matched nothing is still recorded, for the inbox", !r4.refused, r4.message);

/* ---------------------------------------------------------------------- C */
const ME = REP;
const ROWS = {
  eng_prospects: [],
  eng_prospect_contacts: [],
  eng_marketing_suppressions: [],
  eng_crm_territory_reps: [],
  eng_contact_log: [],
  eng_audit_events: [],
  eng_jobs: [],
  eng_crm_email_sends: [],
};
const state = { writes: [], conflict: new Set() };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const filterRows = (rows, params) => {
  let res = rows;
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "or", "on_conflict", "columns"].includes(k)) continue;
    if (v.startsWith("eq.")) res = res.filter((r) => String(r[k]) === v.slice(3));
    else if (v === "is.null") res = res.filter((r) => r[k] === null || r[k] === undefined);
  }
  return res;
};
let nextId = 1;
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (!url.hostname.endsWith("supabase.invalid")) return json({ message: `proof: no network, ${url.hostname}` }, 599);
  const path = url.pathname.replace("/rest/v1/", "");
  if (path.startsWith("rpc/")) return json(null);
  const table = path;
  const params = [...url.searchParams.entries()];
  const objectWanted = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
  if (req.method === "GET" || req.method === "HEAD") {
    const rows = filterRows(ROWS[table] ?? [], params);
    if (objectWanted) return rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406);
    return json(rows);
  }
  if (req.method === "POST") {
    const body = JSON.parse(await req.text());
    const list = (Array.isArray(body) ? body : [body]).map((r) => ({ id: r.id ?? `row-${nextId++}`, ...r }));
    state.writes.push({ method: "POST", table, rows: list });
    if (state.conflict.has(table)) return json({ code: "23505", message: `duplicate key value violates unique constraint on ${table}`, details: null, hint: null }, 409);
    (ROWS[table] ??= []).push(...list);
    return objectWanted ? json(list[0]) : json(list);
  }
  if (req.method === "PATCH") {
    const body = JSON.parse(await req.text());
    const matched = filterRows(ROWS[table] ?? [], params);
    for (const r of matched) Object.assign(r, body);
    state.writes.push({ method: "PATCH", table, body, params: Object.fromEntries(params), matched: matched.length });
    return objectWanted ? json(matched[0] ?? null) : json(matched.map((r) => ({ id: r.id })));
  }
  return json([]);
};

const company = (id, email) => {
  ROWS.eng_prospects.push({
    id, company: `${id} Roofing`, vertical: "roofer", stage: "attempted", status: "open", city: "San Antonio", county: "Bexar",
    owner_id: ME, sequence_step: 2, next_action_kind: "email", next_action_at: "2026-11-02T15:00:00Z", sequence_paused_at: null,
  });
  ROWS.eng_prospect_contacts.push({ id: `${id}-person`, prospect_id: id, full_name: "Pat Proof", email, is_primary: true, created_at: "2026-11-01" });
};
const ACTOR = { id: ME, role: "rep", status: "active", email: "crm-r7@audit-probe.invalid", display_name: "Jordan Proof", grants: new Set(["crm.use", "contact_log.write"]) };
const crmEmail = await import("../../src/lib/crm-email.ts");

company("c-suppressed", "gone@r7-proof.invalid");
ROWS.eng_marketing_suppressions.push({ email: "gone@r7-proof.invalid", voided_at: null });
state.writes = [];
const sup = await crmEmail.sendSequenceEmail(ACTOR, { prospectId: "c-suppressed" }, monday);
const supWrites = state.writes.map((w) => `${w.method} ${w.table}`);
check("C: a suppressed address is not sent", sup.ok && sup.sent === false && /suppression list/.test(sup.said), JSON.stringify(sup));
check("C: and writes no ledger row and queues no job", !supWrites.includes("POST eng_crm_email_sends") && !supWrites.includes("POST eng_jobs"), supWrites.join(", "));
const supNote = ROWS.eng_contact_log.find((r) => r.prospect_id === "c-suppressed" || /suppression list/.test(String(r.body ?? "")));
check("C: the reason is written to the company's history", Boolean(supNote) && /suppression list/.test(String(supNote?.body ?? "")), JSON.stringify(supNote ?? null).slice(0, 200));
const supRow = ROWS.eng_prospects.find((r) => r.id === "c-suppressed");
check("C: and the company moves to its day 5 call", supRow.sequence_step === 3 && supRow.next_action_kind === "call" && same(supRow.next_action_at, "2026-11-05T15:00:00Z"), JSON.stringify(supRow));

company("c-clean", "owner@r7-clean.invalid");
state.writes = [];
const sent = await crmEmail.sendSequenceEmail(ACTOR, { prospectId: "c-clean" }, monday);
const order = state.writes.map((w) => `${w.method} ${w.table}`);
check("C: a clean address is queued", sent.ok && sent.sent === true, JSON.stringify(sent));
const ledgerAt = order.indexOf("POST eng_crm_email_sends");
const jobAt = order.indexOf("POST eng_jobs");
check("C: the ledger row is written before the email is queued", ledgerAt >= 0 && jobAt > ledgerAt, order.join(", "));
const ledgerRow = state.writes[ledgerAt]?.rows[0] ?? {};
check("C: the ledger names the normalized address and the firm day", ledgerRow.address === "owner@r7-clean.invalid" && ledgerRow.firm_day === "2026-11-02", JSON.stringify(ledgerRow));
const job = state.writes[jobAt]?.rows[0] ?? {};
const payload = job.payload ?? {};
check("C: the job is the marketing sequence template", payload.id === "marketing.crm_sequence", JSON.stringify({ kind: job.kind, id: payload.id }));
check("C: and carries the signed unsubscribe link in the text and the HTML", /\/unsubscribe\?e=owner%40r7-clean\.invalid&t=/.test(String(payload.text ?? "")) && /\/unsubscribe\?e=owner%40r7-clean\.invalid&amp;t=|\/unsubscribe\?e=owner%40r7-clean\.invalid&t=/.test(String(payload.html ?? "")), String(payload.text ?? "").slice(-200));
check("C: Reply-To is the support mailbox until the reply address exists", payload.replyTo === null || /support@254engineering\.com/.test(String(payload.replyTo)), String(payload.replyTo));
const cleanRow = ROWS.eng_prospects.find((r) => r.id === "c-clean");
check("C: after the send the company moves to its day 5 call", cleanRow.sequence_step === 3 && same(cleanRow.next_action_at, "2026-11-05T15:00:00Z"));

company("c-twice", "owner@r7-clean.invalid");
state.writes = [];
state.conflict = new Set(["eng_crm_email_sends"]);
const twice = await crmEmail.sendSequenceEmail(ACTOR, { prospectId: "c-twice" }, monday);
state.conflict = new Set();
check("C: a second send to the same address the same day is refused in plain words", !twice.ok && /already sent a sales email today/.test(twice.error), JSON.stringify(twice));
check("C: and queues nothing and moves nothing", !state.writes.some((w) => w.table === "eng_jobs") && !state.writes.some((w) => w.method === "PATCH" && w.table === "eng_prospects"), state.writes.map((w) => `${w.method} ${w.table}`).join(", "));

const notMine = { ...ACTOR, grants: new Set(["crm.use"]) };
const refusedRole = await crmEmail.sendSequenceEmail(notMine, { prospectId: "c-clean" }, monday);
check("C: a role without contact_log.write cannot send", !refusedRole.ok);

/* ---------------------------------------------------------------------- D */
const templates = await import("../../src/lib/email-templates.ts");
check("D: the sequence email is a marketing template, so it carries the unsubscribe", templates.MARKETING_TEMPLATES.includes("marketing.crm_sequence"));
const samples = templates.allTemplatesForAudit().filter((t) => t.id === "marketing.crm_sequence");
check("D: every vertical in both variants is sampled for email-audit", samples.length === 16, `${samples.length} samples`);
check("D: and every one carries the unsubscribe link in both parts", samples.length > 0 && samples.every((t) => /\/unsubscribe\?/.test(t.text) && /\/unsubscribe\?/.test(t.html ?? "")));

/* ---------------------------------------------------------------------- E */
const inbound = await import("../../src/lib/crm-inbound.ts");
const route = await import("../../src/app/api/inbound/resend/route.ts");
/* A body that refuses to be read: the closed route must answer before it reads anything at all. */
let bodyRead = false;
const untouchable = new ReadableStream({
  pull() {
    bodyRead = true;
    throw new Error("proof: the closed route read the body");
  },
}, { highWaterMark: 0 });
let closed;
try {
  closed = await route.POST(new Request("https://254engineering.com/api/inbound/resend", { method: "POST", body: untouchable, duplex: "half" }));
} catch (e) {
  closed = { status: `threw: ${e.message}` };
}
check("E: the reply route answers 404 while RESEND_WEBHOOK_SECRET is unset, before it reads the body", closed.status === 404 && !bodyRead, String(closed.status));
check("E: and to a GET", (await route.GET()).status === 404);

const SECRET = "whsec_" + Buffer.from("sequence-email-proof-webhook-key").toString("base64");
const NOW = new Date("2026-11-02T18:00:00Z");
const sign = (id, ts, body) => "v1," + createHmac("sha256", Buffer.from(SECRET.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64");
const body = JSON.stringify({ type: "email.received", created_at: "2026-11-02T17:59:00Z", data: { email_id: "em_proof", from: "Pat Proof <owner@r7-clean.invalid>", to: ["support@254engineering.com"], subject: "Re: proof" } });
const ts = String(Math.floor(NOW.getTime() / 1000));
const recorded = new Set();
const deps = (over = {}) => ({
  secret: SECRET,
  replyDomain: null,
  now: NOW,
  fetchReceived: async () => ({ ok: true, from: "Pat Proof <owner@r7-clean.invalid>", to: ["support@254engineering.com"], subject: "Re: proof", text: "Yes, call me." }),
  companyExists: async () => ({ ok: true, exists: true }),
  companiesWithAddress: async (a) => ({ ok: true, ids: a === "owner@r7-clean.invalid" ? ["c-clean"] : [] }),
  recordReply: async (row) => {
    if (recorded.has(row.event_id)) return { ok: false, duplicate: true, error: "duplicate" };
    recorded.add(row.event_id);
    deps.last = row;
    return { ok: true };
  },
  pauseSequence: async (id) => {
    deps.paused = (deps.paused ?? 0) + 1;
    deps.pausedId = id;
    return { ok: true };
  },
  ...over,
});
const noSecret = await inbound.handleInbound({ id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, body, deps({ secret: null }));
check("E: the handler is closed without the secret too", noSecret.status === 404);
const forged = await inbound.handleInbound({ id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body + " ") }, body, deps());
check("E: a bad signature is a 400 and records nothing", forged.status === 400 && recorded.size === 0, JSON.stringify(forged));
const stale = await inbound.handleInbound({ id: "msg_1", timestamp: String(Number(ts) - 600), signature: sign("msg_1", String(Number(ts) - 600), body) }, body, deps());
check("E: a signature older than five minutes is refused", stale.status === 400 && recorded.size === 0);
const good = await inbound.handleInbound({ id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, body, deps());
check("E: a signed reply is recorded, matched to the company by its sender", good.status === 200 && good.body.matched === "sender" && deps.last?.prospect_id === "c-clean", JSON.stringify(good));
check("E: and the company's sequence is paused for a person", deps.pausedId === "c-clean");
const again = await inbound.handleInbound({ id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, body, deps());
check("E: the same event delivered again is claimed once: acknowledged, nothing recorded twice", again.status === 200 && again.body.already === true && recorded.size === 1, JSON.stringify(again));
const other = JSON.stringify({ type: "email.sent", data: {} });
const ignored = await inbound.handleInbound({ id: "msg_2", timestamp: ts, signature: sign("msg_2", ts, other) }, other, deps());
check("E: any other event is acknowledged and ignored", ignored.status === 200 && ignored.body.ignored === "email.sent" && recorded.size === 1);
const tagged = await inbound.handleInbound(
  { id: "msg_3", timestamp: ts, signature: sign("msg_3", ts, body) },
  body,
  deps({ replyDomain: "reply.254engineering.com", fetchReceived: async () => ({ ok: true, from: "someone@else.invalid", to: ["crm+00000000-0000-4000-8000-00000000c0de@reply.254engineering.com"], subject: "Re", text: "x" }) }),
);
check("E: once the reply address exists, the +tag matches the company first", tagged.status === 200 && tagged.body.matched === "tag" && deps.last?.prospect_id === "00000000-0000-4000-8000-00000000c0de", JSON.stringify(tagged));
const routeSource = readSource("src/app/api/inbound/resend/route.ts");
check("E: the route reads the raw body for the signature, never a parsed one", /await req\.text\(\)/.test(routeSource) && !/req\.json\(\)/.test(routeSource));

/* ------------------------------------------------------------------ verdict */
const failed = out.filter((c) => !c.ok);
for (const c of out) console.log(`${c.ok ? "PASS" : "FAIL"}: ${c.name}${c.note && !c.ok ? `  (${c.note})` : ""}`);
console.log(`\n${out.length - failed.length} of ${out.length} passed.`);
process.exit(failed.length ? 1 : 0);
