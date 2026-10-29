// @runtime react-server
/**
 * W2: WALK EVERY WORKFLOW THE MAP NAMES, AS THE ROLE THE MAP NAMES.
 *
 * Robert's instruction of 22:05 Central, 2026-10-26, phase W2, and his
 * overnight ruling of 22:48 Central, 2026-10-27: the walk writes probe accounts
 * to development, so it runs only on a board, and W3 is built from what this
 * prints in the board's sealed log.
 *
 * THE SUBJECT IS docs/workflows.md, READ AS DATA (scripts/lib/workflow-map.mjs).
 * Every step of 254-WF-001 to 254-WF-036 gets exactly one result per width:
 *
 *   works      the page opened for the role, said something, and carries a
 *              control where the step is something a person does
 *   friction   it opened and something is in the way; the reason says what
 *   broken     the role the map names could not use it; the reason says why
 *   missing    the map itself marks the step [NO SCREEN] or
 *              [NEEDS SQL, A SCRIPT OR A CODE EDIT]
 *
 * and two results that say what the walk could not see, counted rather than
 * folded into one of the four, because folding them in would claim a finding
 * nobody made:
 *
 *   off-screen the step happens outside this platform's pages (Stripe's card
 *              page, an email, a notice), so a browser here has nothing to open
 *   unreached  the page needs a record (an id in the path) and the list it is
 *              opened from offered none on development; or the page opened
 *              on its empty state (data-empty-state), so the control the step
 *              names, which belongs to a row, had no row to sit on
 *
 * THE SECOND HALF OF "unreached" CAME FROM THE FIRST RUN (board 40635489767).
 * Twelve steps read "no control to do ..." as friction: refunding an order,
 * retrying a dead job, accepting an offer. Every one of those controls exists
 * in the source and renders on a row, and the probe's list had no rows. A page
 * with nothing to act on and a page with no way to act read the same to a
 * count of buttons, so the empty state now says which it is. A page with no
 * control and no empty state is still friction.
 *
 * NOTHING IS DRIVEN. The walk opens pages and reads them; it never submits a
 * form or presses a button, so nothing is charged, sent, sealed or written by
 * a step. A step whose control is present reads "control present, not driven".
 * The only rows written are the probe accounts, on @audit-probe.invalid, and
 * the teardown removes them and reads the removal back.
 *
 * THE VERDICT IS ABOUT THE WALK, NOT ABOUT THE PLATFORM. It passes when every
 * mapped step was walked and given a result, and fails only when a step could
 * not be walked or classified, which is a fault in this harness. A principal
 * that could not be built is COULD NOT TELL with its fault named (CLAUDE.md
 * section 6c): no probe means nothing was measured, not that a door is open.
 * The findings themselves are the "W2 RESULT:" lines, one per step and width.
 */

import { chromium } from "playwright";

import { readWorkflowMap, mapChecks } from "./lib/workflow-map.mjs";
import { SURFACES, roleForRoute } from "./lib/surfaces.mjs";
import { AUDIT_BASE_URL } from "./lib/ports.mjs";
import { navigationVerdict, orCouldNotTell, COULD_NOT_TELL } from "./lib/reachable.mjs";
import {
  createProbe,
  cookieFor,
  destroyProbes,
  createPartnerProbe,
  partnerCookieFor,
  destroyPartnerProbes,
  createCustomerProbe,
  customerCookieFor,
  destroyCustomerProbes,
} from "./lib/portal-probe.mjs";
import { auditClient } from "./lib/db-target.mjs";

const BASE = process.env.BASE_URL ?? AUDIT_BASE_URL;
const LABEL = "w2-walk";
const WIDTHS = [1280, 390];

/*
 * ===========================================================================
 * THE RECORDS A STEP NEEDS, Robert's order of 2026-10-28, 08:18 Central:
 * "records for the walk's 34 unreached steps".
 * ===========================================================================
 *
 * A step that names a page with an id in its path, or a list whose control
 * sits on a row, is unreached when the probe owns nothing to open. Each such
 * step gets a record in one of three ways, and CLAUDE.md 6b decides which: a
 * run may remove only rows it made, on development, and most eng_ tables
 * refuse a delete.
 *
 *   READ        a record development already holds, read and never written:
 *               the newest demonstration order (order lookup), and the
 *               demonstration partner's code "demo-title" (scripts/
 *               seed-field-demo.mjs) for the referred order page. The same
 *               choices v10-layout-audit makes for those routes.
 *   PER RUN     a row this run makes in a table that allows the delete, and
 *               removes in teardown before the probes, swept by its mark so a
 *               crashed run's goes too: one prospect (eng_prospects, created
 *               by the rep probe, on delete restrict, which is why it goes
 *               first) and one dead job (eng_jobs, one of the five telemetry
 *               tables, of a kind no handler knows, with no external effect).
 *   SIGNED LINK the order status page opens only with a signed link, so one is
 *               issued through issueCustomerLink, the product's own issuer, for
 *               the newest demonstration order, expiring in a day: the same
 *               access row v10-layout-audit already leaves each run, recorded
 *               in docs/audit-2026-10/GAPS.md.
 *
 *   TECHNICIAN  Robert's order of 2026-10-28 (issue #1 comment 6480742347,
 *               item 5): "give the probes the records they need (an assigned
 *               job, an order reference, an offer)". Two DEMONSTRATION files
 *               on a demonstration client, numbered 254-DEMO-W2..., each with
 *               an eng_assignments row for the walk's own technician probe:
 *               one offered at a rate (/portal/jobs, 254-WF-029) and one
 *               accepted with the file assigned and dispatched
 *               (/portal/jobs/[id], 254-WF-030). Written directly, the shape
 *               scripts/proofs/an-offer-without-a-rate-cannot-be-accepted.mjs
 *               uses, NOT through sendOffers or acceptOffer: those raise a
 *               notification and tell the buyer, and a fixture tells nobody.
 *   ORDER       one DEMONSTRATION order left awaiting payment, reference
 *               254-O2026-DEMO-W2..., buyer at the probe domain, so
 *               /portal/orders has a row to cancel and refund (254-WF-015
 *               step 3, 254-WF-023). The shape demo-audit inserts. Nothing
 *               is written against it (no event, no payment), which is what
 *               keeps it deletable: eng_order_events and eng_order_payments
 *               refuse a delete, and either would pin the order for good.
 *
 * All three go in teardown by their marks, files with their assignments and
 * file events, and the removal is read back. PER RUN, ON DEVELOPMENT, NOTHING
 * PERMANENT: no audit row, no order event, no payment, no notification. A run
 * that dies mid-walk leaves them for the next run's first sweep, which looks
 * for the marks rather than this run's ids.
 *
 * AND ONE KIND STAYS UNREACHED, WITH ITS REASON IN ITS OWN LINE: an onboarding
 * link (254-WF-016 step 4). Its token exists only when issued, and issuing
 * writes an onboarding record that cannot be deleted, and Robert's order named
 * the job, the order and the offer, not the invitation.
 */
const db = auditClient(LABEL, { neverProduction: true });
const WALK_PROSPECT = "W2 walk probe prospect";
const WALK_DEAD_KIND = "w2_walk.probe_dead_letter";
const WALK_FILE_PREFIX = "254-DEMO-W2";
const WALK_FILE_ADDRESS = "W2 Walk Probe Way";
const WALK_ORDER_PREFIX = "254-O2026-DEMO-W2";
const WALK_RATE_CENTS = 18_500;
const NOT_SEEDED = {
  "/onboarding/[token]":
    "not seeded: an onboarding link's token exists only when issued, and issuing one writes an onboarding record that cannot be deleted",
};
const EMPTY_NOT_SEEDED = {};
const fixtures = { prospectId: null, deadJobId: null, offerFileId: null, jobFileId: null, orderId: null, faults: [] };

/** Removes what this walk makes, from this run or one that died, before the probes. */
async function removeWalkFixtures() {
  if (!db) return { ok: true, faults: [] };
  const faults = [];
  const p = await db.from("eng_prospects").delete().like("company", `${WALK_PROSPECT}%`);
  if (p.error) faults.push(`prospect: ${p.error.message}`);
  const j = await db.from("eng_jobs").delete().eq("kind", WALK_DEAD_KIND);
  if (j.error) faults.push(`dead job: ${j.error.message}`);
  /*
   * The technician's files: assignments first, then the files. File events are
   * NOT deleted directly: eng_forbid_mutation_allow_cascade refuses a direct
   * DELETE on eng_file_events and allows only the cascade from eng_files, so a
   * direct delete would fail the teardown the first time any event existed.
   */
  const { data: walkFiles, error: wfe } = await db.from("eng_files").select("id").like("file_number", `${WALK_FILE_PREFIX}%`).eq("is_demo", true);
  if (wfe) faults.push(`the walk's files could not be read: ${wfe.message}`);
  const fileIds = (walkFiles ?? []).map((f) => f.id);
  if (fileIds.length) {
    const r = await db.from("eng_assignments").delete().in("file_id", fileIds);
    if (r.error) faults.push(`eng_assignments: ${r.error.message}`);
    const f = await db.from("eng_files").delete().in("id", fileIds);
    if (f.error) faults.push(`files: ${f.error.message}`);
  }
  const o = await db.from("eng_service_orders").delete().like("reference", `${WALK_ORDER_PREFIX}%`).eq("is_demo", true);
  if (o.error) faults.push(`order: ${o.error.message}`);
  const left = [];
  const { count: pc, error: pe } = await db.from("eng_prospects").select("id", { count: "exact", head: true }).like("company", `${WALK_PROSPECT}%`);
  const { count: jc, error: je } = await db.from("eng_jobs").select("id", { count: "exact", head: true }).eq("kind", WALK_DEAD_KIND);
  const { count: fc, error: fe } = await db.from("eng_files").select("id", { count: "exact", head: true }).like("file_number", `${WALK_FILE_PREFIX}%`);
  const { count: oc, error: oe } = await db.from("eng_service_orders").select("id", { count: "exact", head: true }).like("reference", `${WALK_ORDER_PREFIX}%`);
  const readFault = pe ?? je ?? fe ?? oe;
  if (readFault) faults.push(`the read-back failed: ${readFault.message}`);
  if (pc) left.push(`${pc} prospect(s)`);
  if (jc) left.push(`${jc} dead job(s)`);
  if (fc) left.push(`${fc} technician file(s)`);
  if (oc) left.push(`${oc} unpaid order(s)`);
  return { ok: faults.length === 0 && left.length === 0, faults: [...faults, ...left.map((l) => `${l} left`)] };
}

/** One demonstration file with one assignment for the technician probe. Returns the file id, or null with a fault named. */
async function walkFileFor(techId, clientId, n, assigned) {
  const tail = `${String(Date.now()).slice(-6)}${n}`;
  const { data: file, error } = await db
    .from("eng_files")
    .insert({
      file_number: `${WALK_FILE_PREFIX}${tail}`,
      is_demo: true,
      client_id: clientId,
      service_slug: "roof-inspections",
      property_address: `${n} ${WALK_FILE_ADDRESS}`,
      county: "Kenedy",
      status: assigned ? "dispatched" : "needs_dispatch",
      assigned_tech_id: assigned ? techId : null,
      notes: "A W2 walk fixture, not a real job: removed in teardown.",
    })
    .select("id")
    .single();
  if (error || !file) {
    fixtures.faults.push(`the ${assigned ? "assigned job" : "offer"} file could not be made: ${error?.message ?? "no row came back"}`);
    return null;
  }
  const { error: aErr } = await db.from("eng_assignments").insert({
    file_id: file.id,
    tech_id: techId,
    state: assigned ? "accepted" : "offered",
    offer_amount_cents: WALK_RATE_CENTS,
  });
  if (aErr) {
    fixtures.faults.push(`the ${assigned ? "assignment" : "offer"} could not be made: ${aErr.message}`);
    return null;
  }
  return file.id;
}

/** The records made for this run, after the sessions exist. Each failure is named, never fatal. */
async function makeWalkFixtures() {
  if (!db) return;
  const owner = sessions.rep?.probe?.id ?? sessions.admin?.probe?.id ?? null;
  if (owner) {
    const { data, error } = await db
      .from("eng_prospects")
      .insert({
        company: `${WALK_PROSPECT} ${Date.now()}`,
        contact_name: "Probe Contact",
        phone: "+13615550100",
        email: "prospect@audit-probe.invalid",
        city: "Corpus Christi",
        prospect_type: "roofer",
        created_by: owner,
      })
      .select("id")
      .single();
    if (error) fixtures.faults.push(`the probe prospect could not be made: ${error.message}`);
    fixtures.prospectId = data?.id ?? null;
  }
  const { data: job, error: jobError } = await db
    .from("eng_jobs")
    .insert({
      kind: WALK_DEAD_KIND,
      status: "dead",
      payload: { probe: LABEL, note: "a dead job for the W2 walk to find on /portal/queue; removed in teardown" },
      attempts: 5,
      max_attempts: 5,
      effect_mode: "no_external_effect",
      last_error: "no handler is registered for this kind: a W2 walk fixture, removed in teardown",
    })
    .select("id")
    .single();
  if (jobError) fixtures.faults.push(`the dead job could not be made: ${jobError.message}`);
  fixtures.deadJobId = job?.id ?? null;

  /* The technician's offer and assigned job, on a demonstration client. */
  const techId = sessions.field_tech?.probe?.id ?? null;
  if (techId) {
    const { data: client, error: cErr } = await db.from("eng_clients").select("id").eq("is_demo", true).limit(1).maybeSingle();
    if (cErr || !client) {
      fixtures.faults.push(`no demonstration client to hang the technician's files on${cErr ? ` (${cErr.message})` : ""}`);
    } else {
      fixtures.offerFileId = await walkFileFor(techId, client.id, 1, false);
      fixtures.jobFileId = await walkFileFor(techId, client.id, 2, true);
    }
  } else if (rolesNeeded.includes("field_tech")) {
    fixtures.faults.push("no technician probe, so no offer or assigned job was made");
  }

  /* One demonstration order left awaiting payment, with nothing written against it. */
  const { data: order, error: orderError } = await db
    .from("eng_service_orders")
    .insert({
      site: "254engineering",
      reference: `${WALK_ORDER_PREFIX}${String(Date.now()).slice(-6)}`,
      service_slug: "roof-inspections",
      order_type: "field",
      status: "awaiting_payment",
      customer_name: "W2 Walk Probe Buyer",
      customer_email: "w2-walk-order@audit-probe.invalid",
      property_address: `3 ${WALK_FILE_ADDRESS}`,
      county: "Kenedy",
      twia_county: false,
      total_cents: 600_00,
      is_demo: true,
    })
    .select("id")
    .single();
  if (orderError) fixtures.faults.push(`the unpaid order could not be made: ${orderError.message}`);
  fixtures.orderId = order?.id ?? null;
}

/** A record for a dynamic route when no page links to one. A path, or the reason there is none. */
async function resolveDirect(pattern) {
  if (NOT_SEEDED[pattern]) return { path: null, reason: NOT_SEEDED[pattern] };
  if (!db) return { path: null, reason: "no development database client, so no record could be read" };
  if (pattern === "/portal/jobs/[id]") {
    return fixtures.jobFileId
      ? { path: `/portal/jobs/${fixtures.jobFileId}`, how: "the run's job assigned to the technician probe" }
      : { path: null, reason: "the technician probe's assigned job was not made" };
  }
  if (pattern === "/portal/prospects/[id]") {
    return fixtures.prospectId ? { path: `/portal/prospects/${fixtures.prospectId}`, how: "the run's probe prospect" } : { path: null, reason: "the probe prospect was not made" };
  }
  if (pattern === "/portal/order-lookup/[id]" || pattern === "/order/[reference]") {
    const { data, error } = await db
      .from("eng_service_orders")
      .select("id, reference")
      .eq("is_demo", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const order = data?.[0];
    if (error || !order) return { path: null, reason: `no demonstration order on development${error ? ` (${error.message})` : ""}` };
    if (pattern === "/portal/order-lookup/[id]") return { path: `/portal/order-lookup/${order.id}`, how: `demonstration order ${order.reference}` };
    const { issueCustomerLink } = await import("../src/lib/ops-intake.ts");
    const link = await issueCustomerLink({ orderId: order.id }, 1);
    return link
      ? { path: `/order/${order.reference}?token=${encodeURIComponent(link.token)}`, how: `a one day signed link to demonstration order ${order.reference}` }
      : { path: null, reason: "the signed link could not be issued" };
  }
  if (pattern === "/order/referred/[code]") {
    const { data, error } = await db.from("eng_partners").select("code, status").eq("code", "demo-title").maybeSingle();
    if (error || !data) return { path: null, reason: `the demonstration partner code demo-title is not on development${error ? ` (${error.message})` : ""}` };
    return { path: "/order/referred/demo-title", how: "the demonstration partner's code" };
  }
  return { path: null, reason: null };
}

/*
 * WHAT THE MAP SAYS ABOUT ITSELF, PINNED AS LITERALS. An audit never imports
 * its expectation from the thing it audits (CLAUDE.md section 6), so the
 * counts are typed here and compared with what the parser found: 36
 * workflows, at least 138 steps, and the marks as the map's own table counts
 * them (8 steps needing SQL, a script or a code edit; 12 with no screen). A
 * step added to the map raises the floor on purpose, in two places. No screen
 * went from 13 to 12 on 2026-10-29 when WF-016 step 3 gained its screen (W3
 * round 2, the invite emailed from /portal/onboarding).
 */
const MAP_WORKFLOWS = 36;
const MAP_STEPS_AT_LEAST = 138;
const MAP_NEEDS_CODE = 8;
const MAP_NO_SCREEN = 12;

/** The office-ready standard, CLAUDE.md section 2d: a staff page is interactive in under 2 seconds. */
const STAFF_INTERACTIVE_MS = 2000;

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ W2, EVERY WORKFLOW WALKED AS ITS ROLE ================");

// ------------------------------------------------------------------ the map
const workflows = readWorkflowMap();
const steps = workflows.flatMap((w) => w.steps.map((s) => ({ ...s, wf: w.id, section: w.section })));
/* The four static checks, one function shared with scripts/preflight.mjs (scripts/lib/workflow-map.mjs). */
for (const c of mapChecks(workflows, { workflows: MAP_WORKFLOWS, stepsAtLeast: MAP_STEPS_AT_LEAST, needsCode: MAP_NEEDS_CODE, noScreen: MAP_NO_SCREEN })) {
  rec(c.name, c.ok, c.note);
}

// ------------------------------------------------------------------ who walks each step
const portal = SURFACES.find((s) => s.key === "portal");
const SIGNED_OUT_PAGES = /\/(login|sign-up|forgot-password|set-password)$/;

/** The staff role a "Who" cell names, read from its first words. Null when it names none. */
function staffRoleFor(who) {
  const w = who.toLowerCase().replace(/`/g, "");
  if (/^(engineer|office staff and engineer)/.test(w)) return "engineer";
  if (/^rep\b/.test(w)) return "rep";
  if (/^ops manager/.test(w)) return "ops_manager";
  if (/^(technician|the technician)/.test(w)) return "field_tech";
  if (/^customer service/.test(w)) return "customer_service";
  if (/^(admin|the owner|the operator|staff with [a-z]|enrolled staff)/.test(w) && !/^staff with no enrolment/.test(w)) return "admin";
  if (/^(any staff|staff with no enrolment)/.test(w)) return "rep";
  return null;
}

/** The principal that opens one route of one step. "The same" is whoever did the step before it. */
function principalFor(step, route, previousStaff) {
  if (SIGNED_OUT_PAGES.test(route)) return "signed out";
  if (route === "/portal" || route.startsWith("/portal/")) {
    if (/^the same\b/i.test(step.who.trim()) && previousStaff) return previousStaff;
    return staffRoleFor(step.who) ?? roleForRoute(portal, route) ?? "admin";
  }
  if (route === "/partner" || route.startsWith("/partner/")) return "partner";
  if (route === "/account" || route.startsWith("/account/")) return "customer";
  return "signed out";
}

const previousStaffIn = new Map();
const plan = steps.map((s) => {
  if (s.malformed) return { step: s, kind: "fault" };
  if (s.marks.needsCode || s.marks.noScreen) return { step: s, kind: "missing" };
  if (!s.routes.length) return { step: s, kind: "off-screen" };
  const routes = s.routes.map((r) => ({ route: r, who: principalFor(s, r, previousStaffIn.get(s.wf)) }));
  const staffWho = routes.find((r) => r.route.startsWith("/portal") && r.who !== "signed out")?.who;
  if (staffWho) previousStaffIn.set(s.wf, staffWho);
  return { step: s, kind: "walk", routes };
});
const rolesNeeded = [...new Set(plan.flatMap((p) => (p.routes ?? []).map((r) => r.who)))].filter((r) => r !== "signed out");

// ------------------------------------------------------------------ principals
const sessions = {};
async function teardown() {
  /* The walk's own rows first: a prospect's created_by is on delete restrict, so it would hold its probe. */
  const records = await removeWalkFixtures();
  const staff = await destroyProbes(LABEL);
  const partners = await destroyPartnerProbes(LABEL);
  const customers = await destroyCustomerProbes(LABEL);
  return { records, staff, partners, customers };
}

/* A crashed run's records, before anything new is made. */
await removeWalkFixtures();

await orCouldNotTell(
  async () => {
    for (const role of rolesNeeded) {
      if (role === "partner") sessions.partner = { probe: await createPartnerProbe(BASE, LABEL), cookie: partnerCookieFor };
      else if (role === "customer") sessions.customer = { probe: await createCustomerProbe(BASE, LABEL), cookie: customerCookieFor };
      else sessions[role] = { probe: await createProbe(BASE, role, LABEL), cookie: cookieFor };
    }
  },
  `the server at ${BASE}`,
  teardown,
);

const faulted = Object.entries(sessions).filter(([, s]) => !s.probe?.cookie);
if (faulted.length) {
  await teardown();
  console.log("");
  for (const [role, s] of faulted) {
    console.log(`  COULD NOT TELL: no ${role} session, so no ${role} step was walked (${s.probe?.fault ?? "no session cookie came back"}).`);
  }
  console.log("");
  console.log("  Nothing was walked, and that is not a pass and not a failure. A probe that");
  console.log("  could not be built says nothing about the screens it was meant to open.");
  process.exit(COULD_NOT_TELL);
}
rec(
  "a probe session was built for every role the map's steps need",
  rolesNeeded.every((r) => sessions[r]?.probe?.cookie),
  rolesNeeded.join(", "),
);

/* The records some steps need, made now that the probes exist. A failure is named on the steps it touches. */
await makeWalkFixtures();
for (const f of fixtures.faults) console.log(`  NOTE: ${f}`);

// ------------------------------------------------------------------ the walk
/** Runs in the page: what a person would meet on it. */
function readPage() {
  const main = document.querySelector("main") ?? document.body;
  const text = (main.innerText ?? "").replace(/\s+/g, " ").trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const controls = [...main.querySelectorAll("button, input, select, textarea, form, a[href]")].filter(
    (el) => visible(el) && !el.disabled,
  ).length;
  const nav = performance.getEntriesByType("navigation")[0];
  return {
    text: text.slice(0, 400),
    chars: text.length,
    controls,
    empty: main.querySelector("[data-empty-state]") !== null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    interactive: nav ? Math.round(nav.domInteractive) : null,
    links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
  };
}

const PASSIVE = /^(reads|opens|arrives|sees|looks|follows|waits|receives|is told|gets|lands)\b/i;
/*
 * "This link does not open an order" is the order status page's failure, and it
 * answers 200 with the reference still on the page (CLAUDE.md section 6), so a
 * signed link that failed must read as broken, never as works.
 */
const ERROR_TEXT = /application error|internal server error|something went wrong|this page could not be found|this link does not open an order/i;
const NOT_DRIVEN = /pay|charge|refund|send|sends|email|text|sms|seal|sign/i;

const rank = { works: 0, friction: 1, broken: 2 };
const contexts = {};
let browser = null;

async function contextFor(who, width) {
  const key = `${who}@${width}`;
  if (contexts[key]) return contexts[key];
  browser ??= await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
  const s = sessions[who];
  if (s) await ctx.addCookies(s.cookie(s.probe, BASE));
  contexts[key] = ctx;
  return ctx;
}

/** Opens one path and judges it. Throws only on a fault in the harness or a vanished server. */
async function openAndJudge(ctx, target, step, width, staff) {
  /*
   * What is fetched and what is reported are two things: a signed link carries
   * its token in the query, and the token is fetched and never printed. Every
   * reason and every comparison below uses the path alone.
   */
  const path = target.split("?")[0];
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120));
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e.message ?? e).slice(0, 120)));
  try {
    let res;
    try {
      res = await page.goto(BASE + target, { waitUntil: "load", timeout: 45000 });
    } catch (err) {
      const v = navigationVerdict(err);
      if (v.unreachable) throw err;
      if (/timeout/i.test(String(err?.message))) return { result: "broken", reason: `${path} did not load in 45 seconds` };
      throw err;
    }
    await page.waitForTimeout(400);
    const status = res?.status() ?? 0;
    const landed = new URL(page.url()).pathname;
    const seen = await page.evaluate(readPage);
    const notes = [];
    if (landed !== path) notes.push(`landed on ${landed}`);
    if (status >= 500) return { result: "broken", reason: `${path} answered HTTP ${status}`, seen };
    if (status === 404 || ERROR_TEXT.test(seen.text)) return { result: "broken", reason: `${path} shows an error page (HTTP ${status})`, seen };
    if (status >= 400) return { result: "broken", reason: `${path} refused the role the map names (HTTP ${status})`, seen };
    if (/\/login$/.test(landed) && !/\/login$/.test(path)) {
      return { result: "broken", reason: `${path} sent the role the map names to sign in (${landed})`, seen };
    }
    const friction = [];
    if (seen.chars < 60) friction.push(`the page says almost nothing (${seen.chars} characters)`);
    /* No control on an EMPTY list is nothing to act on yet, not no way to act (see the header). */
    const noControl = !PASSIVE.test(step.does.trim()) && seen.controls === 0;
    if (noControl && !seen.empty) friction.push(`no control to do "${step.does.slice(0, 60)}"`);
    if (noControl && seen.empty) {
      const why = EMPTY_NOT_SEEDED[path];
      notes.push(`opened on its empty state, so no row to "${step.does.slice(0, 60)}" on development${why ? `; ${why}` : ""}`);
    }
    if (seen.overflow > 1) friction.push(`scrolls sideways by ${seen.overflow}px`);
    if (consoleErrors.length) friction.push(`${consoleErrors.length} console error(s), first: ${consoleErrors[0]}`);
    if (staff && width === 1280 && seen.interactive && seen.interactive > STAFF_INTERACTIVE_MS) {
      friction.push(`interactive in ${seen.interactive} ms, over the 2 second standard`);
    }
    if (!PASSIVE.test(step.does.trim()) && seen.controls > 0 && NOT_DRIVEN.test(step.does)) notes.push("control present, not driven");
    if (friction.length) return { result: "friction", reason: [...friction, ...notes].join("; "), seen };
    if (noControl && seen.empty) return { result: "unreached", reason: [`${path} opened`, ...notes].join("; "), seen };
    return { result: "works", reason: [`${path} opened`, ...notes].join("; "), seen };
  } finally {
    await page.close();
  }
}

/**
 * A path with an id in it is reached the way a person reaches it: from a page
 * that links to it. The step's own fixed pages are tried first (the orders list
 * beside an order, the statements list beside a statement), then each page
 * above the id, nearest first.
 */
async function reachDynamic(ctx, pattern, step, width, staff) {
  const segs = pattern.split("/");
  const at = segs.findIndex((s) => s.startsWith("["));
  const ancestors = [];
  for (let i = at; i >= 1; i--) ancestors.push(segs.slice(0, i).join("/") || "/");
  const from = [...new Set([...step.routes.filter((r) => !r.includes("[")), ...ancestors])];
  const shape = new RegExp(
    "^" + segs.map((s) => (s.startsWith("[") ? "[^/?#]+" : s.replace(/[.*+?^${}()|[\]]/g, (c) => "\\" + c))).join("/") + "$",
  );
  let target = null;
  let via = null;
  for (const parent of from) {
    const page = await ctx.newPage();
    try {
      try {
        await page.goto(BASE + parent, { waitUntil: "load", timeout: 45000 });
      } catch (err) {
        if (navigationVerdict(err).unreachable) throw err;
        continue;
      }
      const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
      target = hrefs.map((h) => (h ?? "").split(/[?#]/)[0]).find((h) => shape.test(h)) ?? null;
    } finally {
      await page.close();
    }
    if (target) {
      via = parent;
      break;
    }
  }
  if (!target) {
    /* No page links to one: the record this walk reads or makes for it (see THE RECORDS A STEP NEEDS). */
    const direct = await resolveDirect(pattern);
    if (!direct.path) {
      return {
        result: "unreached",
        reason: `no link to ${pattern} on ${from.join(", ")} on development${direct.reason ? `; ${direct.reason}` : ""}`,
      };
    }
    const judged = await openAndJudge(ctx, direct.path, step, width, staff);
    return { ...judged, reason: `by ${direct.how}: ${judged.reason}` };
  }
  const judged = await openAndJudge(ctx, target, step, width, staff);
  return { ...judged, reason: `via ${via}: ${judged.reason}` };
}

const lines = [];
const harnessFaults = [];
const tally = { works: 0, friction: 0, broken: 0, missing: 0, "off-screen": 0, unreached: 0 };

for (const p of plan) {
  const s = p.step;
  const tag = `${s.wf} step ${s.n}`;
  if (p.kind === "fault") {
    harnessFaults.push(`${tag}: ${s.malformed}`);
    continue;
  }
  if (p.kind === "missing") {
    const why = [s.marks.needsCode ? "[NEEDS SQL, A SCRIPT OR A CODE EDIT]" : "", s.marks.noScreen ? "[NO SCREEN]" : ""].filter(Boolean).join(" ");
    lines.push({ tag, who: s.who, width: "-", result: "missing", reason: `the map marks it ${why}` });
    tally.missing += 1;
    continue;
  }
  if (p.kind === "off-screen") {
    lines.push({ tag, who: s.who, width: "-", result: "off-screen", reason: `happens outside this platform's pages: ${s.screen.replace(/`/g, "").slice(0, 80)}` });
    tally["off-screen"] += 1;
    continue;
  }
  for (const width of WIDTHS) {
    const parts = [];
    try {
      for (const { route, who } of p.routes) {
        const ctx = await contextFor(who, width);
        const staff = route.startsWith("/portal");
        const judged = route.includes("[")
          ? await reachDynamic(ctx, route, s, width, staff)
          : await openAndJudge(ctx, route, s, width, staff);
        parts.push({ who, ...judged });
      }
    } catch (err) {
      if (navigationVerdict(err).unreachable) {
        await teardown();
        console.log("");
        console.log(`  COULD NOT TELL: the server at ${BASE} went away during ${tag} (${navigationVerdict(err).reason}).`);
        process.exit(COULD_NOT_TELL);
      }
      harnessFaults.push(`${tag} at ${width}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
      continue;
    }
    const reached = parts.filter((x) => x.result !== "unreached");
    let result;
    if (!reached.length) result = "unreached";
    else result = reached.reduce((a, b) => (rank[b.result] > rank[a.result] ? b : a)).result;
    const who = [...new Set(parts.map((x) => x.who))].join(", ");
    lines.push({ tag, who, width: String(width), result, reason: parts.map((x) => x.reason).join(" | ") });
    tally[result] += 1;
  }
}

for (const ctx of Object.values(contexts)) await ctx.close().catch(() => {});
if (browser) await browser.close();

// ------------------------------------------------------------------ the findings
console.log("");
console.log("  W2 RESULT: workflow step | role | width | result | reason");
for (const l of lines) console.log(`  W2 RESULT: ${l.tag} | ${l.who.replace(/`/g, "")} | ${l.width} | ${l.result} | ${l.reason}`);
console.log("");
console.log(
  `  NOTE: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}. Each walked step is one line per width; nothing was submitted.`,
);

const walkedSteps = new Set(lines.map((l) => l.tag));
rec(
  "every step the map names was walked and given a result",
  walkedSteps.size === steps.length && harnessFaults.length === 0,
  harnessFaults.length ? `${harnessFaults.length} could not be walked: ${harnessFaults.slice(0, 4).join("; ")}` : `${walkedSteps.size} of ${steps.length}`,
);

// ------------------------------------------------------------------ teardown, read back
{
  const t = await teardown();
  const left = (t.staff.left ?? 0) + (t.partners.left ?? 0) + (t.customers.left ?? 0);
  rec(
    "the probe accounts were removed",
    t.staff.ok && t.partners.ok && t.customers.ok && left === 0,
    `staff ${t.staff.left ?? "?"} left, partners ${t.partners.left ?? "?"} left, customers ${t.customers.left ?? "?"} left`,
  );
  rec(
    "and the walk's own prospect, dead job, technician files and unpaid order were removed, read back",
    t.records.ok,
    t.records.faults.join("; ") || "0 prospects, 0 dead jobs, 0 technician files and 0 unpaid orders of the walk's left",
  );
}

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok).length;
console.log("");
if (failed) {
  console.log(`FAIL: ${failed} of ${out.length} checks.`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${out.length} checks. Every workflow step was walked as its role and given a result.`);
}
