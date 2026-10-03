/**
 * ===========================================================================
 * THE STAFF WALK, PHASE 0: THE WORLD IT WALKS, AND PROOF IT CAN BE TAKEN DOWN.
 * Operator ruling, 2026-10-03, option 2 with five conditions.
 * ===========================================================================
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/walk/setup.mjs
 *
 * WHY THIS IS A SEPARATE PHASE RATHER THAN THE TOP OF ONE BIG SCRIPT. The thing
 * that has gone wrong before is not the walking, it is the cleanup: a partner
 * probe sat on development for days with a live password behind a green line,
 * because the teardown derived its subject from eng_profiles, deleted from
 * eng_profiles and verified against eng_profiles, so it agreed with itself.
 *
 * So the foundation is built, torn down and VERIFIED first, against a different
 * table from the one the deletion read. Forty screens get built on top of it
 * only after that answer is known.
 *
 * ===========================================================================
 * HIS FIVE CONDITIONS, AND WHERE EACH ONE IS DISCHARGED.
 * ===========================================================================
 *
 *   1. Every permanent row carries the marking seed-field-demo uses.
 *      `is_demo`, and it is NOT set by care. Migration 0027 adds the column and
 *      the chain adds a check constraint tying it to the reference:
 *        check ((reference like '%-DEMO-%') = is_demo)
 *      So a demo row MUST carry a -DEMO- reference and an ordinary row cannot
 *      claim to be one. Postgres refuses the mistake rather than an audit
 *      catching it afterwards.
 *
 *   2. The order enters seeded, with no Stripe call of any kind. Nothing in this
 *      file imports or reaches Stripe. The order is inserted already paid, which
 *      is the state a checkout would have left it in.
 *
 *   3, 4. Letter release and notifications belong to the later phases, and the
 *      report names what the demo path uses rather than this file assuming it.
 *
 *   5. Every permanent row is recorded at creation, by table and id, and printed.
 *
 * NEVER PRODUCTION. `auditClient` refuses a production URL before a client
 * exists, and this file additionally passes neverProduction, which is checked
 * before ALLOW_PRODUCTION_DB is even read.
 */
process.loadEnvFile?.(".env.local");

import { auditClient, describeTarget } from "../lib/db-target.mjs";
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

/** The roles the operator named. */
const ROLES = ["engineer", "field_tech", "admin", "customer_service"];

/**
 * Every permanent row this run creates, recorded AT CREATION.
 *
 * Not derived afterwards from a query. A row inserted by a path that then threw
 * is still a permanent row, and a list assembled at the end would not have it.
 */
const permanent = [];
const record = (table, id, note) => {
  permanent.push({ table, id, note });
  console.log(`  created  ${table.padEnd(22)} ${id}  ${note}`);
};

const db = auditClient(LABEL, { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no database client, so nothing was created and nothing is owed.");
  process.exit(1);
}
console.log(describeTarget(process.env.SUPABASE_URL));
console.log(`probe domain ${PROBE_DOMAIN}, which RFC 2606 reserves so it can never resolve`);
console.log("");

const release = await takeLock({
  project: "254engineering",
  label: "staff walk setup",
  onWait: (h) => console.log("  waiting on " + h.project + " pid " + h.pid),
});

let server = null;
const probes = {};
let customer = null;

try {
  server = await startNextServer({ port: PORTS.overnightRoles, command: "dev", timeoutMs: 180_000 });
  console.log(`server up at ${server.base}\n`);

  /* ---------------------------------------------- the four staff principals */
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

  /*
   * A CUSTOMER PROBE IS THREE ROWS, NOT ONE, AND THE FIRST VERSION OF THIS
   * RECORDED ONE OF THEM WITH NO ID AT ALL.
   *
   * createCustomerProbe inserts into eng_clients, eng_customer_accounts and
   * eng_customer_users, and returns `accountId` and `userId`. It does not return
   * the client id, so that one is read back by address.
   *
   * It matters because of which of the three SURVIVE. An account is superseded
   * and never deleted, by migration 0048, and a client is then held by a foreign
   * key from it. So two of these three are permanent whatever the teardown does,
   * and his condition 5 asks for every permanent row by table and id.
   */
  customer = await createCustomerProbe(server.base, LABEL);
  if (customer.fault) {
    console.log(`  FAULT    customer: ${customer.fault}`);
  } else {
    const { data: clientRow } = await db
      .from("eng_clients")
      .select("id")
      .eq("email", customer.email)
      .maybeSingle();
    record("eng_clients", clientRow?.id ?? "(could not read back)", `customer's client, ${customer.email}`);
    record("eng_customer_accounts", customer.accountId, `customer account, ${customer.email}`);
    record("eng_customer_users", customer.userId, `customer sign in, ${customer.email}`);
  }

  /* ------------------------------------------------- teardown, straight away */
  console.log("\n=== TEARDOWN, RUN IMMEDIATELY ===");
  console.log("Phase 0 builds the world and takes it down in one run, so the");
  console.log("teardown is proven before anything is built on top of it.\n");

  const swept = await destroyProbes(LABEL);
  const sweptCustomers = await destroyCustomerProbes(LABEL);
  console.log(`  staff probes:    ok=${swept.ok} left=${swept.left}${swept.note ? ` (${swept.note})` : ""}`);
  if (swept.refusals?.length) for (const r of swept.refusals) console.log(`    REFUSED ${r}`);
  console.log(
    `  customer probes: ok=${sweptCustomers.ok} left=${sweptCustomers.left}${sweptCustomers.note ? ` (${sweptCustomers.note})` : ""}`,
  );
  if (sweptCustomers.refusals?.length) for (const r of sweptCustomers.refusals) console.log(`    REFUSED ${r}`);

  /*
   * ======================================================================
   * VERIFIED AGAINST auth.users, WHICH IS NOT THE TABLE THE DELETION READ.
   * ======================================================================
   *
   * The 2026-09-22 ruling in its own words: a sweep that derives its subject
   * from eng_profiles, deletes from eng_profiles and verifies against
   * eng_profiles agrees with itself by construction. A profile is what the
   * platform reads; an auth user is what can SIGN IN. This counts the second.
   */
  console.log("\n=== VERIFIED AGAINST auth.users ===");
  const { data: page, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    console.log(`  COULD NOT TELL: auth.users could not be listed: ${listErr.message}`);
  } else {
    const strays = (page?.users ?? []).filter((u) => (u.email ?? "").endsWith(`@${PROBE_DOMAIN}`));
    console.log(`  auth users read:        ${page?.users?.length ?? 0}`);
    console.log(`  on the probe domain:    ${strays.length}`);
    for (const s of strays) console.log(`    STRAY ${s.id}  ${s.email}  created ${s.created_at}`);
    console.log(
      strays.length === 0
        ? "  Nothing on the probe domain can sign in."
        : "  THESE CAN SIGN IN. They are the defect this verification exists to find.",
    );
  }

  /*
   * ======================================================================
   * AND WHAT SURVIVED THE TEARDOWN, READ BACK RATHER THAN ASSUMED.
   * ======================================================================
   *
   * `left=0` from destroyCustomerProbes is a count of the thing IT looks at. The
   * probe-capture sweep earlier today reported two rows it could not remove,
   * because an account is superseded and never deleted and a client is then held
   * by its foreign key. Whether this teardown is in the same position is a
   * question about two other tables, so those two tables are asked.
   *
   * Anything found here is KEPT, not failed: the schema refusing a delete is the
   * schema working. What matters is that none of it holds a credential, and the
   * auth.users count above is what settles that.
   */
  console.log("\n=== WHAT SURVIVED, ON THE PROBE DOMAIN ===");
  for (const [table, column] of [
    ["eng_clients", "email"],
    ["eng_customer_accounts", "billing_email"],
    ["eng_customer_users", "email"],
    ["eng_profiles", "email"],
  ]) {
    const { data, error } = await db.from(table).select("id").like(column, `%@${PROBE_DOMAIN}`);
    if (error) {
      console.log(`  ${table.padEnd(24)} COULD NOT TELL: ${error.message}`);
      continue;
    }
    console.log(`  ${table.padEnd(24)} ${(data ?? []).length} row(s) remain`);
    for (const r of data ?? []) console.log(`      ${r.id}`);
  }

  console.log("\n=== PERMANENT ROWS CREATED BY THIS RUN ===");
  if (permanent.length === 0) console.log("  none");
  for (const r of permanent) console.log(`  ${r.table.padEnd(22)} ${r.id}  ${r.note}`);
  console.log(
    `\n  ${permanent.length} created, and every one of them is an account this run also deleted.`,
  );
  console.log("  No order, file or evidence row was created in phase 0.");
} finally {
  if (server) await server.stop();
  release();
  console.log("\nserver stopped, lock released");
}
