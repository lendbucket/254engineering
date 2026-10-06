/**
 * ===========================================================================
 * THE STAFF WALK, PHASE 1: A SEEDED PAID ORDER, AND THE FIRST SCREENS.
 * Operator ruling, 2026-10-03, option 2 with five conditions.
 * ===========================================================================
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/walk/phase1.mjs
 *
 * HIS FIVE CONDITIONS, AND WHERE EACH IS DISCHARGED.
 *
 *   1. Every permanent row carries the marking seed-field-demo uses. `is_demo`,
 *      and it is not set by care: migration 0027 adds a check constraint tying
 *      it to the reference, `check ((reference like '%-DEMO-%') = is_demo)`, so
 *      a demo row MUST carry a -DEMO- reference and an ordinary row cannot claim
 *      to be one. Postgres refuses the mistake.
 *
 *   2. The order enters SEEDED and already paid. Nothing here imports or reaches
 *      Stripe. A real checkout could not carry the marking anyway: its reference
 *      generator produces no -DEMO- segment, so the constraint would refuse
 *      is_demo on it, and demo-audit would then report a probe order as an
 *      undeclared real one.
 *
 *   3, 4. The letter release and the notification steps are phase 2, and the
 *      report names what the demo path actually uses rather than assuming.
 *
 *   5. Every permanent row is recorded AT CREATION, by table and id. Not derived
 *      afterwards: a row inserted by a path that then threw is still permanent,
 *      and a list assembled at the end would not have it.
 *
 * THE TEARDOWN IS `own` SCOPE, which is the default and cannot reach a row this
 * run did not create. The 641 historical client rows stay where they are.
 *
 * WHAT IT CANNOT CLEAN UP, STATED BEFORE IT RUNS. The probe account is
 * superseded and never deleted (migration 0048) and its client is then held by
 * `on delete restrict`. So this run adds one permanent client and one superseded
 * account, which the operator accepted. eng_audit_events refuses deletes
 * outright, so anything the platform records about this walk is permanent too.
 */
process.loadEnvFile?.(".env.local");

import { auditClient, describeTarget, refOf, DEVELOPMENT_REF } from "../lib/db-target.mjs";
import {
  PROBE_DOMAIN,
  createProbe,
  createCustomerProbe,
  destroyProbes,
  destroyCustomerProbes,
} from "../lib/portal-probe.mjs";
import { startNextServer } from "../lib/dev-server.mjs";
import { takeLock } from "../lib/machine-lock.mjs";
import { PORTS } from "../lib/ports.mjs";

const LABEL = "staff-walk";
const ROLES = ["engineer", "field_tech", "admin", "customer_service"];

/** One stamp for the whole run, so every reference is traceable to it. */
const STAMP = String(Date.now()).slice(-6);
const ORDER_REF = `254-DEMO-W${STAMP}`;
const FILE_NUMBER = `254-DEMO-F${STAMP}`;

const permanent = [];
const record = (table, id, note) => {
  permanent.push({ table, id, note });
  console.log(`  created  ${table.padEnd(24)} ${id}  ${note}`);
};

/** role, screen, action, expected, actual, pass. */
const results = [];
const check = (role, screen, action, expected, actual, pass) => {
  results.push({ role, screen, action, expected, actual, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${role.padEnd(17)} ${screen.padEnd(26)} ${action}`);
  if (!pass) console.log(`        expected ${expected}\n        actual   ${actual}`);
};

const db = auditClient(LABEL, { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no database client. Nothing created, nothing owed.");
  process.exit(1);
}
if (refOf(process.env.SUPABASE_URL) !== DEVELOPMENT_REF) {
  console.log("REFUSING: this walk writes, and it writes to development only.");
  process.exit(1);
}
console.log(describeTarget(process.env.SUPABASE_URL));
console.log(`order reference ${ORDER_REF}, file number ${FILE_NUMBER}`);
console.log("no Stripe, no Checkr, no email, no SMS, no production write\n");

const release = await takeLock({
  project: "254engineering",
  label: "staff walk phase 1",
  onWait: (h) => console.log("  waiting on " + h.project + " pid " + h.pid),
});

let server = null;
const probes = {};
let customer = null;

try {
  server = await startNextServer({ port: PORTS.overnightRoles, command: "dev", timeoutMs: 180_000 });
  console.log(`server up at ${server.base}\n`);

  console.log("=== PROBES ===");
  for (const role of ROLES) {
    const p = await createProbe(server.base, role, LABEL);
    probes[role] = p;
    if (p.fault) {
      console.log(`  FAULT    ${role}: ${p.fault}`);
      continue;
    }
    record("eng_profiles", p.id, `${role}, ${p.email}`);
  }

  customer = await createCustomerProbe(server.base, LABEL);
  if (customer.fault) {
    console.log(`  FAULT    customer: ${customer.fault}`);
  } else {
    const { data: cr } = await db
      .from("eng_clients")
      .select("id")
      .eq("email", customer.email)
      .maybeSingle();
    record("eng_clients", cr?.id ?? "(unread)", `customer's client, ${customer.email}`);
    record("eng_customer_accounts", customer.accountId, "customer account");
    record("eng_customer_users", customer.userId, "customer sign in");
    customer.clientId = cr?.id ?? null;
  }

  /* ------------------------------------------------- the seeded paid order */
  console.log("\n=== THE SEEDED PAID ORDER ===");
  console.log("Inserted already paid. No Stripe call of any kind.\n");

  const { data: order, error: orderErr } = await db
    .from("eng_service_orders")
    .insert({
      site: "254engineering",
      reference: ORDER_REF,
      service_slug: "roof-inspections",
      order_type: "field",
      status: "paid",
      customer_name: "Walk Probe",
      customer_email: customer?.email ?? `walk-${STAMP}@${PROBE_DOMAIN}`,
      property_address: "1 Nonexistent Street",
      city: "Corpus Christi",
      county: "Nueces",
      twia_county: true,
      price_cents: 54900,
      coastal_surcharge_cents: 7500,
      total_cents: 62400,
      client_id: customer?.clientId ?? null,
      account_id: customer?.accountId ?? null,
      is_demo: true,
    })
    .select("id, reference, status, is_demo, total_cents")
    .single();

  if (orderErr) {
    console.log(`  REFUSED: ${orderErr.message}`);
  } else {
    record("eng_service_orders", order.id, `${order.reference}, ${order.status}`);
    check(
      "setup",
      "eng_service_orders",
      "a seeded order is marked is_demo",
      "is_demo true, enforced by the 0027 check constraint against the -DEMO- reference",
      `is_demo ${order.is_demo}, reference ${order.reference}`,
      order.is_demo === true,
    );
    check(
      "setup",
      "eng_service_orders",
      "it enters already paid, with no Stripe call",
      "status paid, total 62400",
      `status ${order.status}, total ${order.total_cents}`,
      order.status === "paid" && Number(order.total_cents) === 62400,
    );
  }

  /*
   * AND THE CONSTRAINT IS EXERCISED RATHER THAN TRUSTED. An ordinary reference
   * with is_demo true must be refused by Postgres. If it is not, every claim
   * about the marking in this report is worth nothing.
   */
  const { error: badErr } = await db.from("eng_service_orders").insert({
    site: "254engineering",
    reference: `254-NOTDEMO-${STAMP}`,
    service_slug: "roof-inspections",
    order_type: "field",
    status: "paid",
    customer_name: "Walk Probe",
    customer_email: `walk-${STAMP}@${PROBE_DOMAIN}`,
    property_address: "1 Nonexistent Street",
    county: "Nueces",
    is_demo: true,
  });
  check(
    "setup",
    "eng_service_orders",
    "an ordinary reference cannot claim is_demo",
    "refused by the check constraint",
    badErr ? badErr.message.slice(0, 90) : "ACCEPTED, which would mean the marking is a convention rather than a rule",
    Boolean(badErr),
  );

  /* --------------------------------------------------------------- the file */
  let file = null;
  if (customer?.clientId) {
    const { data: f, error: fErr } = await db
      .from("eng_files")
      .insert({
        file_number: FILE_NUMBER,
        client_id: customer.clientId,
        service_slug: "roof-inspections",
        property_address: "1 Nonexistent Street",
        county: "Nueces",
        twia_county: true,
        status: "needs_dispatch",
        is_demo: true,
      })
      .select("id, file_number, status, is_demo")
      .single();
    if (fErr) console.log(`  REFUSED (file): ${fErr.message}`);
    else {
      file = f;
      record("eng_files", f.id, `${f.file_number}, ${f.status}`);
    }
  }

  console.log("\n=== TEARDOWN, own SCOPE ===");
  const swept = await destroyProbes(LABEL);
  const sweptC = await destroyCustomerProbes(LABEL);
  console.log(`  staff:    ok=${swept.ok} left=${swept.left}`);
  console.log(`  customer: ok=${sweptC.ok} left=${sweptC.left} kept=${sweptC.keptCount ?? 0}`);
  for (const k of sweptC.kept ?? []) console.log(`    KEPT  ${k}`);
  for (const e of sweptC.errors ?? []) console.log(`    ERROR ${e}`);

  console.log("\n=== VERIFIED AGAINST auth.users ===");
  const { data: page, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) console.log(`  COULD NOT TELL: ${listErr.message}`);
  else {
    const strays = (page?.users ?? []).filter((u) => (u.email ?? "").endsWith(`@${PROBE_DOMAIN}`));
    console.log(`  auth users read ${page?.users?.length ?? 0}, on the probe domain ${strays.length}`);
    for (const s of strays) console.log(`    STRAY ${s.id} ${s.email}`);
  }

  console.log("\n=== PERMANENT ROWS CREATED BY THIS RUN ===");
  for (const r of permanent) console.log(`  ${r.table.padEnd(24)} ${r.id}  ${r.note}`);

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n${results.length - failed.length} of ${results.length} checks passed${failed.length ? `: ${failed.map((f) => f.action).join("; ")}` : ""}`,
  );
} finally {
  if (server) await server.stop();
  release();
  console.log("\nserver stopped, lock released");
}
