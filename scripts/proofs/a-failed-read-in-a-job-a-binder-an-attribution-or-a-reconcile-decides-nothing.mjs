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
  grants: new Set(["files.list", "evidence.review", "evidence.capture"]),
};

const state = { fail: new Set(), updates: [], audits: [] };
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

console.log("");
if (wrong === 0) {
  console.log("PASS: a failed read in a job, a binder, an attribution or a reconcile decides nothing and says what failed.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
