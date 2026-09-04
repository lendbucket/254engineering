/**
 * The authorization matrix, asserted twice: once as a table and once over HTTP.
 *
 *   BASE_URL=http://localhost:3225 npx tsx scripts/roles-audit.mjs
 *
 * WHY THE EXPECTATIONS BELOW ARE WRITTEN OUT BY HAND
 * --------------------------------------------------
 * The obvious way to test an authorization module is to loop over its own matrix
 * and assert that can() agrees with it. That passes forever, including on the day
 * somebody adds "ledger.read_all" to field_tech, because the thing being tested
 * and the thing testing it are the same list.
 *
 * So EXPECTED below is a second, independent statement of who may do what,
 * typed out deliberately. When the two disagree, one of them is wrong and a
 * human has to decide which. That friction is the entire value: it is what makes
 * widening a role a decision rather than a diff nobody read.
 *
 * This repo has lost twelve hours to audits that passed while looking at the
 * wrong thing. This one is built so it cannot.
 *
 * PART TWO IS THE PART THAT COULD ACTUALLY BE WRONG
 * -------------------------------------------------
 * A pure matrix proves the policy module is self consistent. It proves nothing
 * about whether the route handlers call it. So part two creates one real account
 * per role, signs each of them in through the real endpoint, and attempts the
 * things they must not be able to do. A technician POSTing to the people
 * endpoint has to come back 403, from the deployed code path, or this fails.
 *
 * The accounts are torn down afterwards and the teardown is VERIFIED, because
 * forms-audit once filled production tables while reporting green and the
 * lesson was that a delete which matched nothing still returned no error.
 *
 * DEVELOPMENT ONLY, WITH NO OVERRIDE
 * ----------------------------------
 * The teardown removes the accounts. It cannot remove the audit trail rows their
 * sign ins produced, because that table refuses deletes by design, so a run
 * against production would permanently seed the firm's regulatory memory with
 * probe events. Ruled development only on 2026-09-02, enforced by
 * neverProduction below rather than by remembering.
 */
import { auditClient, describeTarget } from "./lib/db-target.mjs";
import { can, actionsFor, visibleFiles, canSeeFile, redactFile, ROLES } from "../src/lib/ops-authz.ts";

const BASE = process.env.BASE_URL || "http://localhost:3225";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

// ===========================================================================
// PART 1: the matrix, stated independently.
// ===========================================================================

/**
 * Who may do what, according to this file rather than according to the module.
 *
 * The operator's three rules, written out action by action:
 *   admins see everything;
 *   engineers see files assigned to them and the review queue;
 *   techs see only jobs offered to or accepted by them, and nothing about other
 *   techs or pricing.
 */
const EXPECTED = {
  "profiles.list":                { admin: true,  engineer: false, field_tech: false },
  "profiles.create":              { admin: true,  engineer: false, field_tech: false },
  "profiles.update":              { admin: true,  engineer: false, field_tech: false },
  "profiles.suspend":             { admin: true,  engineer: false, field_tech: false },
  "profiles.force_reset":         { admin: true,  engineer: false, field_tech: false },
  "profiles.read_self":           { admin: true,  engineer: true,  field_tech: true },
  "profiles.update_self":         { admin: true,  engineer: true,  field_tech: true },

  "clients.list":                 { admin: true,  engineer: true,  field_tech: false },
  "clients.create":               { admin: true,  engineer: false, field_tech: false },
  "clients.update":               { admin: true,  engineer: false, field_tech: false },

  "files.list":                   { admin: true,  engineer: true,  field_tech: true },
  "files.create":                 { admin: true,  engineer: false, field_tech: false },
  "files.update":                 { admin: true,  engineer: true,  field_tech: false },
  "files.assign":                 { admin: true,  engineer: false, field_tech: false },
  "files.transition":             { admin: true,  engineer: true,  field_tech: false },
  "files.cancel":                 { admin: true,  engineer: false, field_tech: false },

  "offers.list_own":              { admin: true,  engineer: false, field_tech: true },
  "offers.respond":               { admin: true,  engineer: false, field_tech: true },
  "offers.dispatch":              { admin: true,  engineer: false, field_tech: false },
  "evidence.capture":             { admin: false, engineer: false, field_tech: true },
  // Moving a file INTO and OUT OF capture. All three, and for a reason each:
  // a tech starts and finishes their own job, an engineer sends one back for
  // revision, an admin does both on somebody's behalf. What a tech still cannot
  // do is pull a file out of review, because that destination is reached under
  // review.decide rather than evidence.submit. See actionFor in ops-files.ts.
  "evidence.start":               { admin: true,  engineer: true,  field_tech: true },
  "evidence.submit":              { admin: true,  engineer: true,  field_tech: true },
  "evidence.review":              { admin: true,  engineer: true,  field_tech: false },

  "protocols.author":             { admin: true,  engineer: true,  field_tech: false },
  "protocols.publish":            { admin: true,  engineer: true,  field_tech: false },
  "review.queue":                 { admin: true,  engineer: true,  field_tech: false },
  "review.decide":                { admin: true,  engineer: true,  field_tech: false },
  "documents.seal":               { admin: true,  engineer: true,  field_tech: false },
  "documents.deliver":            { admin: true,  engineer: true,  field_tech: false },

  /*
   * A deliverable and its supporting record. An engineer is handed any file in
   * the queue, so a document they cannot open is one they will be asked about
   * and cannot read. A technician gets neither: their evidence reaches them on
   * the job screen, and the document centre is where sealed work and firm
   * papers live.
   */
  "documents.read":               { admin: true,  engineer: true,  field_tech: false },

  /*
   * pricing.read is what a file is worth. billing.read is what the firm makes,
   * across every file, including what each technician costs.
   *
   * They are deliberately separate. An engineer sees the first because they are
   * paid production against a tier and a number they cannot see is one they
   * cannot check. The second is the firm's own margin and belongs to the
   * operator alone.
   */
  "pricing.read":                 { admin: true,  engineer: true,  field_tech: false },
  "billing.read":                 { admin: true,  engineer: false, field_tech: false },
  "ledger.read_own":              { admin: true,  engineer: true,  field_tech: true },
  "ledger.read_all":              { admin: true,  engineer: false, field_tech: false },
  "ledger.approve":               { admin: true,  engineer: false, field_tech: false },

  /*
   * Reconciliation asks Stripe what really happened and can record a payment
   * the platform missed, which releases the work and issues the customer their
   * link. That is the operator's decision to take, not an engineer's, and a
   * technician has no business knowing an order exists before it is dispatched.
   */
  "payments.reconcile":           { admin: true,  engineer: false, field_tech: false },

  /*
   * Cancelling a paid order and refunding it in full. Admin alone, and an
   * engineer is excluded on purpose rather than by omission: the whole reason
   * this case exists separately from review.decide is that a commercial
   * withdrawal must never be reachable from the screen where somebody is
   * deciding whether to seal a document.
   */
  "payments.refund":              { admin: true,  engineer: false, field_tech: false },

  /*
   * Customer ordering accounts: credit terms, closing a period, issuing a
   * statement. The firm deciding who may owe it money, which is the operator
   * alone. An engineer has no more business here than in the ledger.
   */
  "accounts.manage":              { admin: true,  engineer: false, field_tech: false },

  /*
   * Everybody. A task list and a conversation are not privileges; a platform
   * where a technician cannot write down their own next action is one where
   * they keep a separate list beside it, and a platform where they cannot ask a
   * question is one where the question goes unasked.
   */
  "tasks.use":                    { admin: true,  engineer: true,  field_tech: true },
  "messages.use":                 { admin: true,  engineer: true,  field_tech: true },

  "audit.read":                   { admin: true,  engineer: false, field_tech: false },
  "time.log_own":                 { admin: true,  engineer: true,  field_tech: false },
  "responsible_charge.read_own":  { admin: true,  engineer: true,  field_tech: false },
  "responsible_charge.read_all":  { admin: true,  engineer: false, field_tech: false },
};

const active = (role) => ({ id: `${role}-1`, role, status: "active" });

let matrixFailures = 0;
for (const [action, expectations] of Object.entries(EXPECTED)) {
  for (const role of ROLES) {
    const expected = expectations[role];
    const actual = can(active(role), action);
    if (expected !== actual) {
      matrixFailures++;
      rec(`${role} may ${action}`, false, `expected ${expected}, module says ${actual}`);
    }
  }
}
rec(
  `authorization matrix agrees with the independent expectation (${Object.keys(EXPECTED).length} actions x ${ROLES.length} roles)`,
  matrixFailures === 0,
  matrixFailures ? `${matrixFailures} disagreements` : "",
);

// Every action the module knows must appear in EXPECTED, or the table is stale
// and a new capability slipped in unreviewed.
const declared = new Set(Object.keys(EXPECTED));
const known = new Set(ROLES.flatMap((r) => actionsFor(r)));
const missing = [...known].filter((a) => !declared.has(a));
rec(
  "every action the module grants is listed in this audit's expectation table",
  missing.length === 0,
  missing.join(", "),
);

// ---- suspended and signed out ----
for (const role of ROLES) {
  const suspended = { id: "x", role, status: "suspended" };
  const anyAllowed = [...known].some((a) => can(suspended, a));
  rec(`a suspended ${role} may do nothing at all`, !anyAllowed);
}
rec("a signed out actor may do nothing at all", ![...known].some((a) => can(null, a)));

// ---- file scoping ----
{
  const engineer = active("engineer");
  const tech = active("field_tech");

  const mine = { id: "f1", status: "intake", assigned_tech_id: null, assigned_engineer_id: "engineer-1" };
  const queue = { id: "f2", status: "evidence_submitted", assigned_tech_id: null, assigned_engineer_id: "someone-else" };
  const other = { id: "f3", status: "intake", assigned_tech_id: null, assigned_engineer_id: "someone-else" };
  const techJob = { id: "f4", status: "dispatched", assigned_tech_id: "field_tech-1", assigned_engineer_id: null };
  const offered = { id: "f5", status: "needs_dispatch", assigned_tech_id: null, assigned_engineer_id: null, offered_tech_ids: ["field_tech-1"] };
  const notMine = { id: "f6", status: "dispatched", assigned_tech_id: "another-tech", assigned_engineer_id: null };

  rec("engineer sees a file assigned to them", canSeeFile(engineer, mine));
  rec("engineer sees the shared review queue", canSeeFile(engineer, queue));
  rec("engineer does NOT see another engineer's file outside the queue", !canSeeFile(engineer, other));
  rec("tech sees a job assigned to them", canSeeFile(tech, techJob));
  rec("tech sees a job offered to them", canSeeFile(tech, offered));
  rec("tech does NOT see another tech's job", !canSeeFile(tech, notMine));
  rec("admin scope is unrestricted", visibleFiles(active("admin")).kind === "all");
  rec("signed out scope is nothing", visibleFiles(null).kind === "none");
}

// ---- pricing redaction ----
{
  const row = {
    id: "f1",
    property_address: "1 Example St",
    client_price_cents: 45000,
    tech_cost_cents: 12000,
    engineer_cost_cents: 15000,
  };
  const forTech = redactFile(active("field_tech"), row);
  const leaked = ["client_price_cents", "tech_cost_cents", "engineer_cost_cents"].filter((k) => k in forTech);
  rec("a technician receives no pricing fields at all", leaked.length === 0, leaked.join(", "));
  rec("a technician still receives the file itself", forTech.property_address === "1 Example St");
  rec("an engineer keeps pricing", "client_price_cents" in redactFile(active("engineer"), row));
  rec("an admin keeps pricing", "client_price_cents" in redactFile(active("admin"), row));
}

// ===========================================================================
// PART 2: the same rules, over HTTP, against the running app.
// ===========================================================================

const STAMP = Date.now();
const PROBE_DOMAIN = "roles-audit.invalid";
const created = [];

async function makeProbe(db, role) {
  const email = `probe-${role}-${STAMP}@${PROBE_DOMAIN}`;
  const password = `probe-${STAMP}-${role}-Aa1!longenough`;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error(`could not create ${role}: ${error?.message}`);
  const isTech = role === "field_tech";
  const { error: pErr } = await db.from("eng_profiles").insert({
    id: data.user.id,
    email,
    display_name: `Probe ${role}`,
    role,
    status: "active",
    tdi_appointment: role === "engineer" ? "none" : null,
    certification_status: isTech ? "none" : null,
    coverage_counties: isTech ? [] : [],
  });
  if (pErr) throw new Error(`could not profile ${role}: ${pErr.message}`);
  created.push({ id: data.user.id, email, role, password });
  return { id: data.user.id, email, password };
}

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/portal/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get("set-cookie") ?? "";
  const match = cookie.match(/eng_ops=([^;]+)/);
  return { ok: res.ok, cookie: match ? `eng_ops=${match[1]}` : null };
}

/*
 * neverProduction, and it is not a precaution: it is the operator's ruling of
 * 2026-09-02. This audit writes, and what it writes into the audit trail cannot
 * be deleted afterwards. Development only, with no override.
 */
const db = auditClient("roles-audit", { neverProduction: true });

if (!db) {
  rec("live cross role probes ran", false, "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing, so the HTTP half was SKIPPED");
} else {
  let sessions = {};
  try {
    for (const role of ROLES) {
      const probe = await makeProbe(db, role);
      const signedIn = await signIn(probe.email, probe.password);
      rec(`probe ${role} can sign in through the real endpoint`, signedIn.ok && Boolean(signedIn.cookie));
      sessions[role] = signedIn.cookie;
    }

    // The forbidden matrix, over HTTP. Each of these must be refused.
    const attempts = [
      {
        role: "field_tech",
        label: "a technician cannot create an account",
        req: () =>
          fetch(`${BASE}/api/portal/people`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: sessions.field_tech },
            body: JSON.stringify({ action: "create", role: "admin", displayName: "Escalated", email: `esc-${STAMP}@${PROBE_DOMAIN}` }),
          }),
        expect: 403,
      },
      {
        role: "engineer",
        label: "an engineer cannot create an account",
        req: () =>
          fetch(`${BASE}/api/portal/people`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: sessions.engineer },
            body: JSON.stringify({ action: "create", role: "admin", displayName: "Escalated", email: `esc2-${STAMP}@${PROBE_DOMAIN}` }),
          }),
        expect: 403,
      },
      {
        role: "field_tech",
        label: "a technician cannot suspend anybody",
        req: () =>
          fetch(`${BASE}/api/portal/people`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: sessions.field_tech },
            body: JSON.stringify({ action: "suspend", profileId: created[0]?.id }),
          }),
        expect: 403,
      },
      {
        role: "engineer",
        label: "an engineer cannot force a password reset",
        req: () =>
          fetch(`${BASE}/api/portal/people`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: sessions.engineer },
            body: JSON.stringify({ action: "force_reset", profileId: created[0]?.id }),
          }),
        expect: 403,
      },
    ];

    for (const attempt of attempts) {
      const res = await attempt.req();
      rec(attempt.label, res.status === attempt.expect, `HTTP ${res.status}, expected ${attempt.expect}`);
    }

    // Pages a role must not reach return 404, not a 403 that confirms the route.
    const pageProbes = [
      { role: "field_tech", path: "/portal/people" },
      { role: "field_tech", path: "/portal/audit" },
      { role: "engineer", path: "/portal/people" },
      { role: "engineer", path: "/portal/audit" },
    ];
    for (const probe of pageProbes) {
      const res = await fetch(`${BASE}${probe.path}`, { headers: { cookie: sessions[probe.role] }, redirect: "manual" });
      rec(
        `${probe.role} gets 404 on ${probe.path} rather than a page`,
        res.status === 404,
        `HTTP ${res.status}`,
      );
    }

    // And the pages they SHOULD reach must actually work, or the audit is only
    // proving that everything is broken.
    const allowed = [
      { role: "field_tech", path: "/portal/jobs" },
      { role: "engineer", path: "/portal/review" },
      { role: "admin", path: "/portal/people" },
      { role: "admin", path: "/portal/audit" },
    ];
    for (const probe of allowed) {
      const res = await fetch(`${BASE}${probe.path}`, { headers: { cookie: sessions[probe.role] }, redirect: "manual" });
      rec(`${probe.role} can open ${probe.path}`, res.status === 200, `HTTP ${res.status}`);
    }

    // A suspended account loses access immediately, not when the cookie expires.
    {
      const tech = created.find((c) => c.role === "field_tech");
      await db.from("eng_profiles").update({ status: "suspended" }).eq("id", tech.id);
      const res = await fetch(`${BASE}/portal/jobs`, { headers: { cookie: sessions.field_tech }, redirect: "manual" });
      rec(
        "a suspension takes effect on the next request, with the old cookie still held",
        res.status !== 200,
        `HTTP ${res.status}`,
      );
      await db.from("eng_profiles").update({ status: "active" }).eq("id", tech.id);
    }

    // The trail recorded the sign ins. A writer that has quietly stopped is the
    // failure this check exists to catch.
    {
      const { data: events } = await db
        .from("eng_audit_events")
        .select("id, action, actor_email")
        .eq("action", "auth.sign_in")
        .in("actor_email", created.map((c) => c.email));
      rec(
        "every probe sign in was recorded in the audit trail",
        (events?.length ?? 0) >= ROLES.length,
        `${events?.length ?? 0} of ${ROLES.length}`,
      );
    }
  } catch (err) {
    rec("live cross role probes ran", false, String(err.message).slice(0, 160));
  } finally {
    // ---- teardown, and it is verified ----
    for (const c of created) {
      await db.from("eng_profiles").delete().eq("id", c.id);
      await db.auth.admin.deleteUser(c.id).catch(() => {});
    }
    const { data: survivors } = await db
      .from("eng_profiles")
      .select("id, email")
      .like("email", `%@${PROBE_DOMAIN}`);
    rec(
      "probe accounts were removed",
      (survivors?.length ?? 0) === 0,
      survivors?.length ? `${survivors.length} left behind: ${survivors.map((s) => s.email).join(", ")}` : "",
    );
  }
}

// ===========================================================================

console.log("================ ROLES AUDIT ================");
console.log(`${BASE}, matrix asserted against an independent table, then over HTTP`);
console.log(`database: ${describeTarget(process.env.SUPABASE_URL)}\n`);
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Every role can do what it should and nothing it should not.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
