// @runtime react-server
//
// Declared because it imports src/lib/crm-queue.ts, which carries server-only.

/**
 * PROOF: THE CALL QUEUE CALLS IN ORDER, ONLY WHEN IT MAY, AND RECORDS WHAT
 * HAPPENED THE WAY ROBERT APPROVED. His sales CRM ruling of 2026-11-02, item
 * R3, with the scripts (issue #1 6587550851) and the sequence and outcome
 * table (6587551356) approved as drafted.
 *
 *   A  the order: due time first, then score; a company never scheduled after
 *      every scheduled one; only the caller's own or nobody's; nothing due later,
 *      nothing waiting on an email, nothing dormant or do not contact
 *   B  calling hours, 8 AM to 8 PM Central, in winter and in summer
 *   C  the sequence: day 1, 2, 5, 9, 14 at 9:00 AM Central, off weekends and the
 *      firm's holidays (P8)
 *   D  every outcome in the approved table: activity, stage, next action
 *   E  the scripts: both variants for every vertical, no typed price, every
 *      placeholder answered by the price book, the variant chosen by the gate,
 *      the solar ruling of 2026-10-30, no long dash, no banned phrase, and no
 *      present tense service claim in a prelaunch variant
 *   F  the server, against a stand-in database: closed outside hours with no
 *      read; do not contact and the suppression list checked before a card is
 *      drawn; an outcome moves the company conditionally, writes the call and the
 *      stage change, and a do not call suppresses every address; another rep's
 *      company and an outcome outside hours change nothing
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-call-queue-calls-in-order-and-records-what-happened.mjs
 */
import { readFileSync } from "node:fs";

process.env.SUPABASE_URL = "http://call-queue-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "call-queue-proof-not-a-key";
delete process.env.VERCEL_ENV;

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const rules = await import("../../src/lib/crm-queue-rules.ts");
const render = await import("../../src/lib/crm-script-render.ts");
const content = await import("../../src/content/crm-scripts.ts");
const crmRules = await import("../../src/lib/crm-rules.ts");
const { deliverablePriceCents } = await import("../../src/config/prices.ts");
const { findBannedPhrases, findRegulatoryClaims } = await import("../lib/voice-blocklist.mjs");

/* ------------------------------------------------------------------ A order */

const ME = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000a2";
const NOW = new Date("2026-11-03T16:00:00Z"); // 10:00 AM Central, a Tuesday
const cand = (o) => ({ id: o.id, company: o.company ?? o.id, stage: o.stage ?? "attempted", score: o.score ?? 0, nextActionAt: o.at ?? null, nextActionKind: o.kind ?? "call", ownerId: o.owner ?? null });

const pool = [
  cand({ id: "late-high", at: "2026-11-03T15:00:00Z", score: 90 }),
  cand({ id: "early-low", at: "2026-11-02T15:00:00Z", score: 10 }),
  cand({ id: "same-early-high", at: "2026-11-02T15:00:00Z", score: 50 }),
  cand({ id: "new-unscheduled", stage: "new", at: null, kind: null, score: 99 }),
  cand({ id: "mine", at: "2026-11-01T15:00:00Z", owner: ME }),
];
const ordered = pool.filter((c) => rules.isDueForCaller(c, ME, NOW)).sort(rules.queueOrder).map((c) => c.id);
check("A: due time first, then the higher score, then a company never scheduled", ordered.join(",") === "mine,same-early-high,early-low,late-high,new-unscheduled", ordered.join(","));
check("A: another rep's company is not on the caller's queue", !rules.isDueForCaller(cand({ id: "x", at: "2026-11-01T15:00:00Z", owner: OTHER }), ME, NOW));
check("A: a company due later is not on it yet", !rules.isDueForCaller(cand({ id: "x", at: "2026-11-04T15:00:00Z" }), ME, NOW));
check("A: a company whose next step is an email is not on the call queue", !rules.isDueForCaller(cand({ id: "x", at: "2026-11-01T15:00:00Z", kind: "email" }), ME, NOW));
for (const stage of ["dormant", "do_not_contact"]) {
  check(`A: a ${stage} company never comes up`, !rules.isDueForCaller(cand({ id: "x", stage, at: "2026-11-01T15:00:00Z" }), ME, NOW));
}
check("A: a scheduled company with no due time is not due unless it is new", !rules.isDueForCaller(cand({ id: "x", stage: "attempted", at: null, kind: null }), ME, NOW));

/* ------------------------------------------------------------ B calling hours */

const hoursCases = [
  ["2027-01-15T13:59:00Z", false, "7:59 AM CST"],
  ["2027-01-15T14:00:00Z", true, "8:00 AM CST"],
  ["2027-01-16T01:59:00Z", true, "7:59 PM CST"],
  ["2027-01-16T02:00:00Z", false, "8:00 PM CST"],
  ["2027-07-15T12:59:00Z", false, "7:59 AM CDT"],
  ["2027-07-15T13:00:00Z", true, "8:00 AM CDT"],
  ["2027-07-16T00:59:00Z", true, "7:59 PM CDT"],
  ["2027-07-16T01:00:00Z", false, "8:00 PM CDT"],
];
for (const [at, open, label] of hoursCases) {
  const problem = rules.callingHoursProblem(new Date(at));
  check(`B: ${label} is ${open ? "inside" : "outside"} calling hours`, open ? problem === null : typeof problem === "string" && /8 AM and 8 PM Central/.test(problem), problem ?? "open");
}
check("B: 9:00 AM Central in November is 15:00 UTC", rules.firmInstant("2026-11-02", 9) === "2026-11-02T15:00:00.000Z", rules.firmInstant("2026-11-02", 9));
check("B: 9:00 AM Central in July is 14:00 UTC", rules.firmInstant("2027-07-01", 9) === "2027-07-01T14:00:00.000Z", rules.firmInstant("2027-07-01", 9));

/* --------------------------------------------------------------- C sequence */

check("C: the sequence is call 1, email 2, call 5, email 9, call 14", rules.SEQUENCE.map((s) => `${s.kind} ${s.day}`).join(", ") === "call 1, email 2, call 5, email 9, call 14");
const fromMonday = rules.nextStepAfter(1, "2026-11-02");
check("C: after the first call on a Monday, the email is due Tuesday at 9:00 AM Central", fromMonday?.step.step === 2 && fromMonday.step.kind === "email" && fromMonday.dueAt === "2026-11-03T15:00:00.000Z", JSON.stringify(fromMonday));
const thanksgiving = rules.nextStepAfter(1, "2026-11-25");
check("C: a step landing on Thanksgiving and the day after moves to the Monday after", thanksgiving?.dueAt === "2026-11-30T15:00:00.000Z", JSON.stringify(thanksgiving));
const friday = rules.nextStepAfter(2, "2026-11-06");
check("C: three days from a Friday is a Monday, a business day, at 9:00 AM", friday?.step.step === 3 && friday.dueAt === "2026-11-09T15:00:00.000Z", JSON.stringify(friday));
check("C: there is no step after the fifth", rules.nextStepAfter(5, "2026-11-02") === null);

/* --------------------------------------------------------------- D outcomes */

const plan = (outcome, current, input = {}) => rules.planOutcome(outcome, current, input, NOW);
const na = plan("no_answer", { stage: "new", sequenceStep: 0 });
check("D: no answer on a new company: attempted, the email next", na.ok && na.plan.stage === "attempted" && na.plan.nextActionKind === "email" && na.plan.sequenceStep === 2 && na.plan.status === "open", JSON.stringify(na));
const vm = plan("voicemail", { stage: "connected", sequenceStep: 3 });
check("D: a voicemail leaves a connected company connected, the next step scheduled", vm.ok && vm.plan.stage === "connected" && vm.plan.sequenceStep === 4 && vm.plan.nextActionKind === "email", JSON.stringify(vm));
const last = plan("no_answer", { stage: "attempted", sequenceStep: 5 });
check("D: no answer at the last step leaves the company dormant, nothing next", last.ok && last.plan.stage === "dormant" && last.plan.nextActionAt === null && last.plan.status === "open", JSON.stringify(last));
const cbAt = "2026-11-04T19:30:00Z"; // 1:30 PM Central
const cb = plan("callback", { stage: "attempted", sequenceStep: 1 }, { callbackAt: cbAt });
check("D: a callback is connected, a call at the time given, the step kept", cb.ok && cb.plan.stage === "connected" && cb.plan.nextActionAt === new Date(cbAt).toISOString() && cb.plan.nextActionKind === "call" && cb.plan.sequenceStep === 1, JSON.stringify(cb));
check("D: a callback outside calling hours is refused", !plan("callback", { stage: "attempted", sequenceStep: 1 }, { callbackAt: "2026-11-05T03:00:00Z" }).ok);
check("D: a callback in the past is refused", !plan("callback", { stage: "attempted", sequenceStep: 1 }, { callbackAt: "2026-11-02T16:00:00Z" }).ok);
check("D: a callback with no time is refused", !plan("callback", { stage: "attempted", sequenceStep: 1 }, {}).ok);
const int = plan("interested", { stage: "connected", sequenceStep: 3 });
check("D: interested opens the conversion, nothing scheduled", int.ok && int.plan.stage === "interested" && int.plan.openConversion && int.plan.nextActionAt === null, JSON.stringify(int));
check("D: not interested with no reason is refused", !plan("not_interested", { stage: "attempted", sequenceStep: 1 }, {}).ok);
const ni = plan("not_interested", { stage: "attempted", sequenceStep: 1 }, { reason: "Uses another firm" });
check("D: not interested is dormant and not interested, nothing next", ni.ok && ni.plan.stage === "dormant" && ni.plan.status === "not_interested" && ni.plan.nextActionAt === null, JSON.stringify(ni));
const wnAnother = plan("wrong_number", { stage: "attempted", sequenceStep: 1 }, { anotherWorkingPhone: true });
check("D: a wrong number with another phone on file keeps the stage and schedules the next step", wnAnother.ok && wnAnother.plan.stage === "attempted" && wnAnother.plan.sequenceStep === 2 && wnAnother.plan.addTags.length === 0, JSON.stringify(wnAnother));
const wnNone = plan("wrong_number", { stage: "attempted", sequenceStep: 1 }, { anotherWorkingPhone: false });
check("D: a wrong number with no other phone holds the company as no working number", wnNone.ok && wnNone.plan.nextActionAt === null && wnNone.plan.addTags.includes("no_working_number") && wnNone.plan.stage === "attempted", JSON.stringify(wnNone));
const dnc = plan("do_not_call", { stage: "connected", sequenceStep: 3 });
check("D: do not call is do not contact, for good, every address suppressed", dnc.ok && dnc.plan.stage === "do_not_contact" && dnc.plan.status === "not_interested" && dnc.plan.suppressEmails && dnc.plan.nextActionAt === null, JSON.stringify(dnc));
check("D: nothing is recorded on a company that asked not to be contacted", !plan("no_answer", { stage: "do_not_contact", sequenceStep: 2 }).ok);
check("D: every outcome R3 names is offered", rules.CALL_OUTCOMES.join(",") === "no_answer,voicemail,callback,interested,not_interested,wrong_number,do_not_call");
check("D: every queue outcome is one 0111's check allows", rules.CALL_OUTCOMES.every((o) => crmRules.CRM_OUTCOMES.includes(o)));

/* ---------------------------------------------------------------- E scripts */

const source = readFileSync("src/content/crm-scripts.ts", "utf8");
const scriptBodies = source.slice(source.indexOf("export const CRM_SCRIPTS"), source.indexOf("export const SOLAR_WIND_LOAD_CITIES"));
check("E: the scripts were found in the file", scriptBodies.length > 2000, `${scriptBodies.length} characters`);
check("E: no price is typed into a script; every figure is a placeholder", !/\$\s?\d/.test(scriptBodies));
check("E: the scripts are marked approved, never awaiting", /APPROVED AS DRAFTED/.test(source) && !/Awaiting Robert/i.test(source));
const LONG_DASH = new RegExp("[\\u2012\\u2013\\u2014\\u2015]");
const roofPriceCents = deliverablePriceCents("roof-inspections", "standard");
check("E: the price book answers the roof line, so the priced check below has a figure to find", typeof roofPriceCents === "number" && roofPriceCents > 0, String(roofPriceCents));
const roofPrice = render.dollars(roofPriceCents ?? -1);
for (const v of crmRules.CRM_VERTICALS) {
  const pair = content.CRM_SCRIPTS[v];
  check(`E: ${v} has an open and a prelaunch script`, Boolean(pair?.open?.trim()) && Boolean(pair?.prelaunch?.trim()));
  for (const variant of ["open", "prelaunch"]) {
    const filled = render.fillScript(pair[variant], { vertical: v, rep: "Jordan", contact: "Pat Lee", company: "Proof Roofing", city: "San Antonio" });
    check(`E: ${v} ${variant}: every placeholder is answered`, filled.ok && !/\{\{/.test(filled.text), filled.ok ? "" : filled.error);
    const text = filled.ok ? filled.text : pair[variant];
    check(`E: ${v} ${variant}: no long dash`, !LONG_DASH.test(text));
    const banned = findBannedPhrases(text);
    check(`E: ${v} ${variant}: no banned phrase`, banned.length === 0, banned.map((b) => b.phrase ?? b).join(", "));
    if (variant === "prelaunch") {
      const claims = findRegulatoryClaims(text);
      check(`E: ${v} prelaunch: no present tense service claim`, claims.length === 0, claims.map((c) => c.match ?? c).join(", "));
    }
  }
}
check("E: the ongoing WPI-8 tier is never priced in a script", !/price:windstorm-wpi-8:ongoing/.test(scriptBodies) && /ongoing construction is quoted/.test(content.CRM_SCRIPTS.insurance_agent.open));
const roofOpen = render.scriptFor({ vertical: "roofer", rep: "Jordan", contact: "Pat Lee", company: "Proof Roofing", city: "San Antonio" }, true);
const roofPre = render.scriptFor({ vertical: "roofer", rep: "Jordan", contact: "Pat Lee", company: "Proof Roofing", city: "San Antonio" }, false);
check("E: a sellable line shows the open script, priced from the price book", roofOpen.ok && roofOpen.variant === "open" && roofOpen.text.includes(roofPrice) && roofOpen.text.startsWith("Hi Pat,"), roofOpen.ok ? roofOpen.text.slice(0, 80) : roofOpen.error);
check("E: a line not sellable shows the prelaunch script, with no price", roofPre.ok && roofPre.variant === "prelaunch" && !/\$\d/.test(roofPre.text));
const solarHouston = render.scriptFor({ vertical: "solar", rep: "Jordan", contact: null, company: "Proof Solar", city: "Houston" }, true);
const solarSA = render.scriptFor({ vertical: "solar", rep: "Jordan", contact: null, company: "Proof Solar", city: "San Antonio" }, true);
check("E: a solar company in a wind load city is shown the general script and the reason (Robert, 2026-10-30)", solarHouston.ok && solarHouston.usedVertical === "other" && /wind loads/.test(solarHouston.note ?? "") && !/rooftop solar|structural letters for rooftop/i.test(solarHouston.text));
check("E: a solar company elsewhere is shown the solar script", solarSA.ok && solarSA.usedVertical === "solar" && solarSA.note === null && /rooftop solar/.test(solarSA.text));
check("E: a script naming a placeholder the price book does not answer is refused, never printed", !render.fillScript("It is {{price:no-such-line}}.", { vertical: "other", rep: "J", contact: null, company: "C", city: null }).ok);
check("E: no contact name greets as \"there\"", render.fillScript("Hi {{contact}},", { vertical: "other", rep: "J", contact: null, company: "C", city: null }).text === "Hi there,");

/* --------------------------------------------------------------- F the server */

const P = (n) => `00000000-0000-4000-8000-00000000${String(n).padStart(4, "0")}`;
const ROWS = {
  eng_prospects: [
    { id: P(1), company: "Someone Else's Roofing", vertical: "roofer", stage: "attempted", status: "open", score: 90, next_action_at: "2026-11-01T15:00:00Z", next_action_kind: "call", owner_id: OTHER, sequence_step: 1, tags: [], city: "San Antonio", county: "Bexar", website: null, permit_count: 0, last_permit_on: null, converted_account_id: null },
    { id: P(2), company: "Asked Not To Roofing", vertical: "roofer", stage: "do_not_contact", status: "not_interested", score: 99, next_action_at: null, next_action_kind: null, owner_id: null, sequence_step: 1, tags: [], city: null, county: null, website: null, permit_count: 0, last_permit_on: null, converted_account_id: null },
    { id: P(3), company: "Suppressed Roofing", vertical: "roofer", stage: "attempted", status: "open", score: 80, next_action_at: "2026-11-01T15:00:00Z", next_action_kind: "call", owner_id: null, sequence_step: 1, tags: [], city: null, county: null, website: null, permit_count: 0, last_permit_on: null, converted_account_id: null },
    { id: P(4), company: "Due First Roofing", vertical: "roofer", stage: "new", status: "open", score: 20, next_action_at: "2026-11-02T15:00:00Z", next_action_kind: "call", owner_id: null, sequence_step: 0, tags: [], city: "San Antonio", county: "Bexar", website: null, permit_count: 12, last_permit_on: "2026-10-20", converted_account_id: null },
  ],
  eng_prospect_contacts: [
    { id: P(31), prospect_id: P(3), full_name: "Sam Suppressed", phone: "2105550103", email: "sam@suppressed-proof.invalid", is_primary: true },
    { id: P(41), prospect_id: P(4), full_name: "Pat Lee", phone: "2105550104", email: "pat@due-first-proof.invalid", is_primary: true },
    { id: P(42), prospect_id: P(4), full_name: "Robin Lee", phone: "2105550105", email: "robin@due-first-proof.invalid", is_primary: false },
  ],
  eng_contact_log: [],
  eng_marketing_suppressions: [{ email: "sam@suppressed-proof.invalid", voided_at: null }],
  eng_service_orders: [],
  eng_signed_records: [],
};

const state = { reads: 0, patches: [], posts: [], fail: new Set() };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const filterRows = (rows, params) => {
  let out = rows;
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "or", "on_conflict"].includes(k)) continue;
    if (v.startsWith("eq.")) out = out.filter((r) => String(r[k]) === v.slice(3));
    else if (v.startsWith("in.(")) {
      const set = v.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, ""));
      out = out.filter((r) => set.includes(String(r[k])));
    } else if (v === "is.null") out = out.filter((r) => r[k] === null || r[k] === undefined);
    else if (v === "not.is.null") out = out.filter((r) => r[k] !== null && r[k] !== undefined);
  }
  return out;
};

globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const table = url.pathname.replace("/rest/v1/", "");
  const params = [...url.searchParams.entries()];
  const objectWanted = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
  if (req.method === "GET" || req.method === "HEAD") {
    state.reads += 1;
    if (state.fail.has(table)) return json({ message: `proof: ${table} could not be read` }, 500);
    const rows = filterRows(ROWS[table] ?? [], params);
    if (objectWanted) return rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406);
    return json(rows);
  }
  if (req.method === "PATCH") {
    const body = JSON.parse(await req.text());
    const matched = filterRows(ROWS[table] ?? [], params);
    state.patches.push({ table, body, params: Object.fromEntries(params), matched: matched.length });
    return json(matched.map((r) => ({ id: r.id })));
  }
  if (req.method === "POST") {
    const body = JSON.parse(await req.text());
    state.posts.push({ table, body });
    const id = `posted-${state.posts.length}`;
    return objectWanted ? json({ id }, 201) : json([{ id }], 201);
  }
  return json([]);
};

const queue = await import("../../src/lib/crm-queue.ts");
const ACTOR = { id: ME, role: "rep", status: "active", display_name: "Jordan Proof", email: "jordan@audit-probe.invalid", grants: new Set(["crm.use", "contact_log.write", "clients.create"]) };

state.reads = 0;
const closed = await queue.queueFor(ACTOR, new Date("2026-11-03T03:00:00Z")); // 9 PM Central
check("F: outside calling hours the queue is closed and reads nothing", closed.ok && typeof closed.closed === "string" && state.reads === 0, `reads ${state.reads}`);

const open = await queue.queueFor(ACTOR, NOW);
check("F: the card is the caller's next due company, not another rep's, not do not contact, not suppressed", open.ok && !open.closed && open.card?.id === P(4), open.ok ? `card ${open.card?.id}` : open.error);
check("F: a company with somebody on the suppression list is passed over and counted", open.ok && !open.closed && open.skippedSuppressed === 1, open.ok ? `skipped ${open.skippedSuppressed}` : "");
check("F: the card carries its people with numbers, its permits, and the script", open.ok && !open.closed && open.card.contacts.length === 2 && open.card.permitCount === 12 && open.card.script.ok, open.ok && open.card ? JSON.stringify(open.card.script).slice(0, 120) : "");

state.fail = new Set(["eng_marketing_suppressions"]);
const unreadable = await queue.queueFor(ACTOR, NOW);
check("F: a suppression list that cannot be read shows no card (fails closed)", !unreadable.ok && /suppression list could not be read/.test(unreadable.error), unreadable.ok ? "a card was drawn" : unreadable.error);
state.fail = new Set();

state.patches = [];
state.posts = [];
const recorded = await queue.recordOutcome(ACTOR, { prospectId: P(4), outcome: "no_answer", contactId: P(41) }, NOW);
const move = state.patches.find((p) => p.table === "eng_prospects");
check("F: no answer moves the company conditionally on the stage and step it was read at", recorded.ok && move?.body.stage === "attempted" && move.body.sequence_step === 2 && move.body.next_action_kind === "email" && move.params.stage === "eq.new" && move.params.sequence_step === "eq.0", JSON.stringify(move));
check("F: a company nobody owned becomes the caller's", move?.body.owner_id === ME && move.params.owner_id === "is.null");
const callRow = state.posts.find((p) => p.table === "eng_contact_log" && p.body.channel === "call");
check("F: the call is written to the contact log with its CRM outcome and the person called", callRow?.body.crm_outcome === "no_answer" && callRow.body.outcome === "no_answer" && callRow.body.contact_id === P(41) && callRow.body.activity_kind === "call", JSON.stringify(callRow?.body));
const stageRow = state.posts.find((p) => p.table === "eng_contact_log" && p.body.activity_kind === "stage_change");
check("F: the stage change is written as its own entry", stageRow?.body.stage_from === "new" && stageRow.body.stage_to === "attempted" && stageRow.body.channel === "note", JSON.stringify(stageRow?.body));
check("F: every write is audited first", state.posts.filter((p) => p.table === "eng_audit_events").length >= 2);

state.patches = [];
state.posts = [];
const dncDone = await queue.recordOutcome(ACTOR, { prospectId: P(4), outcome: "do_not_call", contactId: P(41) }, NOW);
const dncMove = state.patches.find((p) => p.table === "eng_prospects");
const suppressedNow = state.posts.filter((p) => p.table === "eng_marketing_suppressions").map((p) => p.body.email);
check("F: do not call stamps the company do not contact, by whom", dncDone.ok && dncMove?.body.stage === "do_not_contact" && dncMove.body.status === "not_interested" && dncMove.body.do_not_contact_by === ME && dncMove.body.next_action_at === null, JSON.stringify(dncMove?.body));
check("F: and every address at the company goes on the suppression list", suppressedNow.length === 2 && suppressedNow.includes("pat@due-first-proof.invalid") && suppressedNow.includes("robin@due-first-proof.invalid"), suppressedNow.join(", "));

state.patches = [];
state.posts = [];
const notMine = await queue.recordOutcome(ACTOR, { prospectId: P(1), outcome: "no_answer" }, NOW);
check("F: another rep's company is refused and nothing is written", !notMine.ok && state.patches.length === 0 && state.posts.length === 0, notMine.ok ? "recorded" : notMine.error);
const night = await queue.recordOutcome(ACTOR, { prospectId: P(4), outcome: "no_answer" }, new Date("2026-11-03T03:00:00Z"));
check("F: an outcome outside calling hours is refused and nothing is written", !night.ok && state.patches.length === 0 && state.posts.length === 0);
const noNumber = await queue.recordOutcome(ACTOR, { prospectId: P(4), outcome: "wrong_number" }, NOW);
check("F: a wrong number has to say which number", !noNumber.ok && /which number/.test(noNumber.error) && state.patches.length === 0);

console.log(wrong === 0 ? "PASS: the call queue calls in order, only in calling hours, and records every outcome as Robert approved." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
