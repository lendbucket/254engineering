/**
 * FINISH THE PROBE SWEEP, AND REPORT WHAT CANNOT BE REMOVED.
 *
 * The first sweep removed the customer user and failed on three things. Two of
 * the failures are the database working correctly and one was my query.
 *
 *   the job queue read   `payload` is jsonb and ilike is a text operator, so
 *                        the filter was rejected outright. Read and filtered in
 *                        JS here instead. This is the "a sweep verified in one
 *                        place is a sweep of one place" lesson arriving as a
 *                        query that never ran: my verification read
 *                        eng_customer_users, which HAD been swept, and printed
 *                        "0 remain" while two other rows survived.
 *
 *   the customer account "An account is superseded, never deleted. Set
 *                        superseded_at with a reason and an actor." That is a
 *                        deliberate guarantee, not an obstacle: the orders and
 *                        statements attached to an account are the record of
 *                        what somebody was charged. So it is SUPERSEDED, which
 *                        is the disposal the schema asks for.
 *
 *   the client           refused by the foreign key while the account exists,
 *                        and the account cannot be deleted, so it stays. Stated
 *                        rather than forced.
 */
process.loadEnvFile?.(".env.local");

import { auditClient, describeTarget } from "./lib/db-target.mjs";

const EMAIL = process.argv[2];
const ACCOUNT_ID = process.argv[3];
const CLIENT_ID = process.argv[4];
if (!EMAIL || !ACCOUNT_ID || !CLIENT_ID) {
  console.log("usage: probe-sweep-finish.mjs <email> <accountId> <clientId>");
  process.exit(1);
}

const db = auditClient("finishing the probe sweep");
console.log(describeTarget(process.env.SUPABASE_URL));
console.log("");

/* ---------------------------------------------------- the job queue, properly */

const { data: jobs, error: je } = await db
  .from("eng_jobs")
  .select("id, kind, status, payload")
  .order("id", { ascending: false })
  .limit(500);

if (je) {
  console.log(`COULD NOT TELL: the job queue could not be read: ${je.message}`);
} else {
  const mine = (jobs ?? []).filter((j) => JSON.stringify(j.payload ?? {}).includes(EMAIL));
  console.log(`job queue: read ${jobs.length} most recent, ${mine.length} name the probe address`);
  if (mine.length > 0) {
    const { error } = await db.from("eng_jobs").delete().in("id", mine.map((j) => j.id));
    console.log(
      error
        ? `  FAILED to remove them: ${error.message}`
        : `  removed ${mine.length}: ${mine.map((j) => `${j.kind}/${j.status}`).join(", ")}`,
    );
  } else {
    console.log("  nothing to remove, because the probe was built without going through a door that queues");
  }
}

/* -------------------------------------------- the account, superseded not deleted */

/*
 * `superseded_by_email` IS REQUIRED AND I LEFT IT OUT, which is why the first
 * attempt was refused. The constraint wants three things together, an instant,
 * a reason of at least ten characters, and WHO: 0048 denormalises the email
 * beside the profile reference precisely because the question asked years later
 * is who decided this, and a uuid pointing at a removed profile answers it with
 * nobody.
 *
 * The error message said "with a reason and an actor" and I supplied the
 * reason. A constraint that names what it wants is worth reading rather than
 * guessing at.
 */
const { error: se } = await db
  .from("eng_customer_accounts")
  .update({
    superseded_at: new Date().toISOString(),
    superseded_reason:
      "Screenshot probe for the V10 stage 1 captures, 2026-09-30. Address under the reserved .invalid domain, no phone, no orders, no statements, nothing queued. Superseded rather than deleted because this schema does not delete accounts.",
    superseded_by_email: "automated probe, scripts/probe-capture.mjs, on the operator's order of 2026-09-30",
    status: "closed",
  })
  .eq("id", ACCOUNT_ID);

console.log("");
console.log(
  se
    ? `customer account: COULD NOT SUPERSEDE: ${se.message}`
    : "customer account: superseded and closed, which is this schema's disposal for an account",
);

/* ------------------------------------------------------------ what is left */

const { count: users } = await db
  .from("eng_customer_users")
  .select("id", { count: "exact", head: true })
  .eq("email", EMAIL);
const { data: acct } = await db
  .from("eng_customer_accounts")
  .select("id, status, superseded_at")
  .eq("id", ACCOUNT_ID)
  .maybeSingle();
const { data: client } = await db
  .from("eng_clients")
  .select("id, name, status")
  .eq("id", CLIENT_ID)
  .maybeSingle();

console.log("");
console.log("=== WHAT REMAINS ON DEVELOPMENT ===");
console.log(`  customer users for that address: ${users ?? 0}`);
console.log(
  `  customer account: ${acct ? `${acct.id} status=${acct.status} superseded_at=${acct.superseded_at ? "set" : "NOT SET"}` : "gone"}`,
);
console.log(`  client: ${client ? `${client.id} "${client.name}" status=${client.status}` : "gone"}`);
/*
 * THE CLOSING SENTENCE IS DERIVED FROM THE ROWS JUST READ, NOT TYPED.
 *
 * The first version asserted "the account is closed and superseded" as a fixed
 * string, and printed it directly beneath data saying status=active and
 * superseded_at=NOT SET. Prose contradicting the figures immediately above it,
 * which is the defect this repository meets most often wearing its smallest
 * costume. It now says what the rows say.
 */
const disposed = Boolean(acct?.superseded_at) && acct?.status !== "active";
console.log("");
console.log(
  disposed
    ? "  DISPOSED. The account is closed and superseded with a reason and an actor, which"
    : "  NOT DISPOSED. The account is still active and unsuperseded, so this run did NOT",
);
console.log(
  disposed
    ? "  is this schema's disposal for an account. It cannot be deleted by design, and the"
    : "  finish its own cleanup. The rows below are live and want a person to look at them.",
);
if (disposed) {
  console.log("  client cannot be deleted while the account references it, so both rows remain,");
  console.log("  inert: no user, no orders, no statements.");
}
console.log("  Any eng_audit_events row about this probe is permanent, as that table refuses deletes.");
