// @runtime react-server
//
// Declared because it imports src/lib/ops-field.ts and src/lib/ops-docs.ts, which carry server-only.

/**
 * A FAILED READ IN A JOB, A BINDER, AN ATTRIBUTION OR A RECONCILE DECIDES
 * NOTHING. The audit's section 6 sweep, severity 1 claims confirmed against the
 * source on 2026-10-25:
 *
 *   A5  the protocol items, captures, exceptions and repairs read with their
 *       errors ignored, so a failed read was an empty checklist
 *   A4  the evidence binder's conversation, decisions, engineers and charge log
 *       read the same way, and the binder still said complete
 *   A12 partner attribution's touches and prior-customer reads, so a failure
 *       wrote "no partner" onto the order, frozen by 0014 at payment
 *   A13 reconcile's checkout record read, so a failure said "No checkout was
 *       ever started for this order, so no money moved through one"
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-failed-read-in-a-job-a-binder-an-attribution-or-a-reconcile-decides-nothing.mjs
 *
 * Against a fake PostgREST that fails exactly the table named for each case.
 * Nothing reaches a database.
 */
process.env.SUPABASE_URL = "http://failed-read-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "failed-read-proof-not-a-key";
delete process.env.VERCEL_ENV;

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const FILE = "00000000-0000-4000-8000-0000000000f1";
const TEMPLATE = "00000000-0000-4000-8000-0000000000f2";
const ORDER = "00000000-0000-4000-8000-0000000000f3";
const ACTOR = {
  id: "00000000-0000-4000-8000-0000000000a1",
  role: "admin",
  status: "active",
  email: "failed-read-proof@audit-probe.invalid",
  grants: new Set(["files.list", "evidence.review", "evidence.capture", "profiles.create", "offers.dispatch"]),
};
const ONBOARDING = "00000000-0000-4000-8000-0000000000f4";

const state = { fail: new Set(), updates: [], audits: [], questionReads: 0, failQuestionRead: 0, certWrites: [] };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const failure = (table) => json({ message: `proof: ${table} could not be read`, code: "XX000" }, 500);
const one = (req, rows) => {
  const accept = (req.headers.get("accept") ?? "").toLowerCase();
  if (accept.includes("vnd.pgrst.object")) return rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406);
  return json(rows);
};

const ROWS = {
  eng_assignments: [],
  eng_files: [{
    id: FILE, file_number: "254-PROOF-FR-1", property_address: "1 Proof Way", city: "Corpus Christi", county: "Nueces",
    postal_code: null, service_slug: "roof-inspections", status: "under_review", twia_county: false, evidence_due_at: null,
    notes: null, assigned_tech_id: null, protocol_template_id: TEMPLATE,
  }],
  eng_protocol_templates: [{ id: TEMPLATE, name: "Proof protocol", version: 1, status: "published", service_slug: "roof-inspections", document_number: "254-RC-001", version_label: "1.1" }],
  eng_protocol_items: [{ id: "i1", template_id: TEMPLATE, item_key: "roof_overview", label: "Roof overview", kind: "photo", required: true, sort_order: 1, guidance: null, min_count: 1, unit: null }],
  eng_evidence_items: [],
  eng_checklist_exceptions: [],
  eng_repair_items: [],
  eng_threads: [],
  eng_messages: [],
  eng_review_sessions: [],
  eng_profiles: [],
  eng_responsible_charge_log: [],
  eng_partner_touches: [{ partner_id: "p1", code: "PROOFCODE", kind: "code", occurred_at: "2026-10-20T15:00:00Z" }],
  eng_service_orders: [],
  eng_order_events: [{ detail: { session_ref: "cs_test_proof" }, created_at: "2026-10-20T15:00:00Z" }],
  eng_onboardings: [{
    id: ONBOARDING, person_name: "Failed read proof technician, not a real person", email: "fr-tech@audit-probe.invalid", phone: null,
    role: "field_tech", status: "submitted", coverage_counties: ["Nueces"], base_city: "Corpus Christi", base_county: "Nueces",
    activated_at: null, profile_id: null,
  }],
  eng_onboarding_items: [],
  eng_certifications: [],
  eng_protocol_questions: [{ id: "q1", template_id: TEMPLATE, sort_order: 1, prompt: "Proof question", options: ["right", "wrong"], correct_index: 0, rationale: null }],
};

globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (req.method === "PATCH") {
    state.updates.push({ table, body: JSON.parse(await req.text()) });
    return json([]);
  }
  if (req.method === "POST" && table === "eng_audit_events") {
    state.audits.push(JSON.parse(await req.text()));
    return json([], 201);
  }
  /* The certification check: its two writes are recorded, and the Nth read of the questions can be made to fail. */
  if (req.method === "POST" && (table === "eng_certification_attempts" || table === "eng_certifications")) {
    state.certWrites.push(table);
    return json([], 201);
  }
  if (table === "eng_protocol_questions" && req.method === "GET") {
    state.questionReads += 1;
    if (state.failQuestionRead && state.questionReads === state.failQuestionRead) return failure(table);
  }
  if (state.fail.has(table)) return failure(table);
  return one(req, ROWS[table] ?? []);
};

const field = await import("../../src/lib/ops-field.ts");
const docs = await import("../../src/lib/ops-docs.ts");
const partners = await import("../../src/lib/ops-partners.ts");
const reconcile = await import("../../src/lib/ops-reconcile.ts");

/* A5: the job. */
const clean = await field.jobView(ACTOR, FILE);
check("the fixture reads: a clean job has its one checklist item and nothing unreadable", clean && clean.unreadable === null && clean.state.items.length === 1, JSON.stringify(clean?.unreadable));
for (const [table, what] of [
  ["eng_protocol_items", "checklist items"],
  ["eng_evidence_items", "captured evidence"],
  ["eng_checklist_exceptions", "recorded exceptions"],
  ["eng_repair_items", "repair list"],
]) {
  state.fail = new Set([table]);
  const view = await field.jobView(ACTOR, FILE);
  check(
    `A5: a failed ${what} read names itself and the job cannot be submitted`,
    Boolean(view?.unreadable?.includes(what)) && view.state.canSubmit === false && view.state.blockers[0] === view.unreadable,
    view?.unreadable ?? "no unreadable",
  );
}

/* A4: the binder. */
state.fail = new Set();
const cleanBinder = await docs.binderFor(ACTOR, FILE);
check("the binder reads clean with nothing unreadable", cleanBinder && cleanBinder.unreadable.length === 0, JSON.stringify(cleanBinder?.unreadable));
for (const [table, what] of [
  ["eng_threads", "conversation"],
  ["eng_review_sessions", "decisions"],
  ["eng_responsible_charge_log", "charge log"],
  ["eng_protocol_items", "checklist items"],
]) {
  state.fail = new Set([table]);
  const binder = await docs.binderFor(ACTOR, FILE);
  check(
    `A4: a failed ${what} read makes the binder incomplete and says so in its limitations`,
    Boolean(binder) && binder.complete === false && binder.unreadable.some((u) => u.includes(what)) && binder.limitations.some((l) => l.startsWith("Part of the record could not be read")),
    binder ? JSON.stringify(binder.unreadable) : "no binder",
  );
}

/* A12: attribution. */
for (const [table, what] of [
  ["eng_partner_touches", "partner touches could not be read"],
  ["eng_service_orders", "had paid before could not be read"],
]) {
  state.fail = new Set([table]);
  state.updates = [];
  state.audits = [];
  const result = await partners.attributeOrder({ orderId: ORDER, reference: "254-PROOF-FR-O1", customerEmail: "buyer@audit-probe.invalid", visitorKey: "visitor-proof" });
  const write = state.updates.find((u) => u.table === "eng_service_orders")?.body ?? {};
  check(
    `A12: a failed read (${what}) attributes to nobody and decides nothing`,
    result.attributed === false && result.because.includes(what) && !("partner_id" in write) && !("attributed_at" in write) && String(write.attribution_reason ?? "").startsWith("Not decided"),
    JSON.stringify(write),
  );
  check("and the audit trail says the evidence was unreadable", state.audits.some((a) => a.action === "partner.attribution_unreadable"), JSON.stringify(state.audits.map((a) => a.action)));
}
state.fail = new Set();
state.updates = [];
const decided = await partners.attributeOrder({ orderId: ORDER, reference: "254-PROOF-FR-O1", customerEmail: "buyer@audit-probe.invalid", visitorKey: "visitor-proof" });
const decidedWrite = state.updates.find((u) => u.table === "eng_service_orders")?.body ?? {};
check("with both reads clean, the order is decided and attributed_at is written", "attributed_at" in decidedWrite && typeof decided.attributed === "boolean", JSON.stringify(decidedWrite));

/* A13: reconcile. */
state.fail = new Set(["eng_order_events"]);
const finding = await reconcile.reconcileOrder({ id: ORDER, reference: "254-PROOF-FR-O1", status: "awaiting_payment", totalCents: 70900 }, { apply: false });
check(
  "A13: a failed checkout record read is unreachable, never \"no checkout was ever started\"",
  finding.verdict === "unreachable" && !/No checkout was ever started/.test(JSON.stringify(finding)),
  `${finding.verdict}: ${String(finding.detail ?? "").slice(0, 120)}`,
);

/* A15: activation. A failed read of the checklist is a blocker that says so, and nothing is activated. */
const onboarding = await import("../../src/lib/ops-onboarding.ts");
state.fail = new Set();
const cleanView = await onboarding.activationView(ACTOR, ONBOARDING);
check(
  "the onboarding reads clean, and no blocker names a failed read",
  Boolean(cleanView) && !cleanView.readiness.blockers.some((b) => /could not be read/.test(b)),
  JSON.stringify(cleanView?.readiness.blockers ?? null),
);
state.fail = new Set(["eng_onboarding_items"]);
const failedView = await onboarding.activationView(ACTOR, ONBOARDING);
check(
  "A15: a failed checklist read is not ready, and the blocker says the checklist could not be read",
  Boolean(failedView) && failedView.readiness.ready === false && failedView.readiness.blockers.some((b) => /The checklist could not be read just now/.test(b)),
  JSON.stringify(failedView?.readiness ?? null),
);
const activated = await onboarding.activateTechnician(ACTOR, ONBOARDING);
check(
  "and activation refuses on it before any account is made",
  activated.ok === false && (activated.blockers ?? []).some((b) => /checklist could not be read/.test(b)),
  JSON.stringify(activated),
);
state.fail = new Set();

/* Class A, severity 2: a file's timeline. A failed read is null, which the files page says, never []. */
const crm = await import("../../src/lib/ops-crm.ts");
const cleanTimeline = await crm.fileTimeline(FILE);
check("a file's timeline reads clean as a list", Array.isArray(cleanTimeline), JSON.stringify(cleanTimeline));
state.fail = new Set(["eng_file_events"]);
check("and a failed read of it is null, not an empty history", (await crm.fileTimeline(FILE)) === null);
state.fail = new Set();
const filesPage = (await import("node:fs")).readFileSync("src/app/portal/(app)/files/page.tsx", "utf8");
/*
 * The answer key at scoring, arguably severity 1: the screen reads the
 * questions once, scoring reads the key again. A failure of the second read
 * graded against no questions and recorded a FAILED certification.
 */
const right = [{ questionId: "q1", optionIndex: 0 }];
state.fail = new Set();
state.questionReads = 0;
state.failQuestionRead = 0;
state.certWrites = [];
const passed = await field.submitAttempt(ACTOR, "roof-inspections", right);
check("a right answer, with the key read, is scored and recorded", passed.ok === true && passed.result?.passed === true && state.certWrites.length > 0, JSON.stringify(passed).slice(0, 160));
const readsPerAttempt = state.questionReads;
state.questionReads = 0;
state.failQuestionRead = readsPerAttempt;
state.certWrites = [];
const unscored = await field.submitAttempt(ACTOR, "roof-inspections", right);
check(
  "when the key read at scoring fails, the attempt is not scored and nothing is recorded",
  unscored.ok === false && /answer key could not be read/.test(unscored.error) && state.certWrites.length === 0,
  `${JSON.stringify(unscored).slice(0, 160)}; writes ${JSON.stringify(state.certWrites)}`,
);
state.failQuestionRead = 0;

/* Class A, severity 2: a person's notification settings. A failed read shows no form, so the defaults cannot be saved over them. */
const notify = await import("../../src/lib/ops-notify.ts");
state.fail = new Set();
check("notification settings read clean as a list", Array.isArray(await notify.preferencesFor(ACTOR.id, "admin")));
state.fail = new Set(["eng_notification_prefs"]);
check("and a failed read of them is null, never the defaults", (await notify.preferencesFor(ACTOR.id, "admin")) === null);
state.fail = new Set();
const profilePage = (await import("node:fs")).readFileSync("src/app/portal/(app)/profile/page.tsx", "utf8");
check("and the profile page offers no form over settings it could not read", profilePage.indexOf("{stored === null ? (") > 0 && profilePage.indexOf("{stored === null ? (") < profilePage.indexOf("<PreferencesForm"));

/* Class A, severity 2: the recovery codes left. A failed count is null, never "none left". */
const mfa = await import("../../src/lib/ops-mfa.ts");
ROWS.eng_mfa_enrolments = [{
  secret_cipher: "proof-cipher", verified_at: "2026-10-20T15:00:00Z", pending_cipher: null, pending_started_at: null,
  last_used_at: null, recovery_codes_issued_at: "2026-10-20T15:00:00Z", recovery_codes_acknowledged_at: "2026-10-20T15:00:00Z",
}];
state.fail = new Set();
const mfaClean = await mfa.mfaStateFor(ACTOR.id);
check("the second factor state reads clean, with a count", mfaClean.enrolled === true && typeof mfaClean.recoveryRemaining === "number", JSON.stringify(mfaClean));
state.fail = new Set(["eng_mfa_recovery_codes"]);
const mfaFailed = await mfa.mfaStateFor(ACTOR.id);
check("and a failed count of the recovery codes is null, never zero", mfaFailed.recoveryRemaining === null, JSON.stringify(mfaFailed.recoveryRemaining));
state.fail = new Set();

/*
 * Class A, severity 2: dispatch. A failed read of the technicians' open jobs
 * made every one look free; any failed read now plans over nobody and says so.
 * A technician is put in the played profiles for these checks only.
 */
const savedProfiles = ROWS.eng_profiles;
ROWS.eng_profiles = [{ id: "t1", display_name: "Proof Technician, not a real person", status: "active", coverage_counties: ["Nueces"], base_lat: null, base_lng: null }];
const dispatchFile = { id: FILE, county: "Nueces", service_slug: "roof-inspections", latitude: null, longitude: null };
state.fail = new Set();
const cleanDispatch = await field.dispatchContext(ACTOR, dispatchFile);
check("a dispatch plan reads clean with nothing unreadable", Boolean(cleanDispatch) && cleanDispatch.unreadable === null, cleanDispatch?.unreadable ?? "");
for (const [table, what] of [
  ["eng_files", "open jobs"],
  ["eng_certifications", "certifications"],
  ["eng_assignments", "offers already sent"],
]) {
  state.fail = new Set([table]);
  const ctx = await field.dispatchContext(ACTOR, dispatchFile);
  check(
    `a failed read of the technicians' ${what} offers nobody and says so`,
    Boolean(ctx?.unreadable?.includes(what)) && ctx.plan.offers.length === 0,
    ctx?.unreadable ?? "no unreadable",
  );
}
state.fail = new Set();
ROWS.eng_profiles = savedProfiles;
const fieldSrc = (await import("node:fs")).readFileSync("src/lib/ops-field.ts", "utf8");
check("and sending offers refuses on it", /if \(ctx\.unreadable\) return \{ ok: false, error: ctx\.unreadable \};/.test(fieldSrc));
const bulkSrc = (await import("node:fs")).readFileSync("src/lib/ops-bulk-dispatch.ts", "utf8");
check("and bulk dispatch says it, never \"no technician covers\"", bulkSrc.indexOf("context.unreadable") > 0 && bulkSrc.indexOf("context.unreadable") < bulkSrc.indexOf("No technician covers"));

/* Class A and B, severity 2: the engineer's review queue. A failed read is null, never "Nothing waiting", and it is not capped. */
const engineerMod = await import("../../src/lib/ops-engineer.ts");
const ENGINEER_ACTOR = { id: "e1", role: "engineer", status: "active", email: "fr-eng@audit-probe.invalid", grants: new Set() };
state.fail = new Set();
const queueClean = await engineerMod.reviewQueue(ENGINEER_ACTOR);
check("the review queue reads clean as a list", Array.isArray(queueClean) && queueClean.length >= 1, JSON.stringify(queueClean?.length));
state.fail = new Set(["eng_files"]);
check("and a failed read of it is null, never an empty queue", (await engineerMod.reviewQueue(ENGINEER_ACTOR)) === null);
state.fail = new Set();
const engineerSrc = (await import("node:fs")).readFileSync("src/lib/ops-engineer.ts", "utf8");
const queueBody = engineerSrc.slice(engineerSrc.indexOf("export async function reviewQueue("), engineerSrc.indexOf("}\n", engineerSrc.indexOf("export async function reviewQueue(")));
check("and it reads every page rather than the oldest 200", /readEvery<QueueRow>/.test(queueBody) && !/\.limit\(/.test(queueBody));
const reviewPage = (await import("node:fs")).readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check("and the review page says it could not be read before it would say nothing is waiting", reviewPage.indexOf("{queue === null ? (") > 0 && reviewPage.indexOf("{queue === null ? (") < reviewPage.indexOf('title="Nothing waiting"'));

/* Class A, severity 2: the queue's dead letters. A failed read is null, which the queue page says. */
const jobs = await import("../../src/lib/ops-jobs.ts");
check("the dead letters read clean as a list", Array.isArray(await jobs.deadLetters()));
state.fail = new Set(["eng_jobs"]);
check("and a failed read of them is null, never \"nothing has given up\"", (await jobs.deadLetters()) === null);
state.fail = new Set();
const queuePage = (await import("node:fs")).readFileSync("src/app/portal/(app)/queue/page.tsx", "utf8");
check("and the queue page says they could not be read before it would say nothing has given up", queuePage.indexOf("{dead === null ? (") > 0 && queuePage.indexOf("{dead === null ? (") < queuePage.indexOf('title="Nothing has given up"'));
check(
  "and the files page says the timeline could not be read, before it would say nothing is recorded",
  filesPage.indexOf("{timelineFailed ? (") > 0 && filesPage.indexOf("{timelineFailed ? (") < filesPage.indexOf("Nothing recorded yet.</p>"),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a failed read in a job, a binder, an attribution, a reconcile or an activation decides nothing and says what failed.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
