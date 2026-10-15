// @runtime react-server
//
// Declared because it imports src/lib/ops-job-billing.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * A PAYMENT LINK SAYS QUEUED, AND SAYS SO WHEN IT COULD NOT BE QUEUED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-payment-link-says-queued.mjs
 *
 * Operator ruling 5 of 2026-10-15, the way decision 10 of 2026-10-10 fixed the
 * order timeline. A payment link taken over the telephone used to write
 * "Payment link sent to ..." on the file and in the audit trail the moment it
 * was enqueued, and discarded whether the enqueue worked at all. Now:
 *
 *   1. a queued link says queued, on the file and in the audit trail, and the
 *      email names its order so the handler writes "Sent to" on the order's
 *      timeline when the provider accepts it;
 *   2. a link that could not be queued leaves the file unmarked, says it has to
 *      go out by hand, and returns the failure to the operator.
 *
 * HOW IT RUNS. sendPaymentLink is gated until launch, and everything it does
 * before the email is unchanged, so the proof drives announcePaymentLink, the
 * part the ruling changed, and asserts from the source that sendPaymentLink
 * calls it. Every migration is replayed into PGlite and served as PostgREST by
 * scripts/lib/replay-rest.mjs, because the order tables refuse deletes on
 * development. The failed enqueue is made by failing the one insert into
 * eng_jobs for the second order. Nothing reaches Stripe or an inbox.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const { PORTS } = await import("../lib/ports.mjs");
const { startReplayRest } = await import("../lib/replay-rest.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------ the database */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays", files.length > 0, `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = id(401);
const EMAIL = "payment-link-proof@audit-probe.invalid";
const CASES = { queued: 411, failed: 412 };
const fileId = (k) => id(CASES[k]);
const orderId = (k) => id(CASES[k] + 100);
const reference = (k) => `254-PROOF-L-${CASES[k]}`;

await db.exec(`
  insert into eng_clients (id, kind, name, email) values ('${CLIENT}', 'individual', 'Payment link proof client, not a real person', '${EMAIL}');
`);
for (const [k, n] of Object.entries(CASES)) {
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status, client_price_cents)
    values ('${fileId(k)}', '254-PROOF-PL-${n}', '${CLIENT}', 'roof-inspections', '${n} Link Way', 'Nueces', 'intake', 60000);
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id)
    values
      ('${orderId(k)}', '254engineering', '${reference(k)}', 'roof-inspections', 'field',
       'Payment link proof customer, not a real person', '${EMAIL}', '${n} Link Way', 'Nueces',
       'awaiting_payment', 60000, '${fileId(k)}', '${CLIENT}');
  `);
}

/* ------------------------------------------------------------- the failure */

/*
 * The admin client binds the global fetch when it is first made, so the
 * failure is armed before anything makes it, and answers only an insert into
 * eng_jobs carrying the failing order's id.
 */
let failEnqueueFor = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  const method = String((init && init.method) || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const body = typeof init?.body === "string" ? init.body : "";
  if (failEnqueueFor && method === "POST" && url.includes("/rest/v1/eng_jobs") && body.includes(failEnqueueFor)) {
    return new Response(JSON.stringify({ code: "PROOF", message: "the proof failed this insert", details: null, hint: null }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input, init);
};

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
const { announcePaymentLink } = await import("../../src/lib/ops-job-billing.ts");

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const fileRow = (k) => one(`select payment_intent, payment_note from eng_files where id = $1`, [fileId(k)]);
const jobsFor = (k) => many(`select kind from eng_jobs where kind = 'email.send' and payload->>'orderId' = $1`, [orderId(k)]);
const actionsFor = (k) => many(`select action, summary from eng_audit_events where entity_id = $1 order by created_at`, [fileId(k)]);
const actor = { id: null, role: "admin", email: EMAIL };
const fileFor = (k) => ({
  id: fileId(k),
  file_number: `254-PROOF-PL-${CASES[k]}`,
  property_address: `${CASES[k]} Link Way`,
  client_price_cents: 60000,
  service_slug: "roof-inspections",
  deliverable: null,
});
const announce = (k) =>
  announcePaymentLink(
    actor,
    fileFor(k),
    { name: "Payment link proof client, not a real person", email: EMAIL },
    { orderId: orderId(k), reference: reference(k) },
    `https://checkout.invalid/${k}`,
  );
const SAYS_SENT = /link (was )?sent to/i;

try {
  /* ========================== 1. a link that was queued ========================== */
  {
    const res = await announce("queued");
    check("a queued link is reported as done", res.ok === true && res.checkoutUrl === "https://checkout.invalid/queued", JSON.stringify(res));
    const row = await fileRow("queued");
    check(
      "the file says it is queued, never that it was sent",
      row?.payment_intent === "link_sent" && /Payment link queued to/.test(row.payment_note ?? "") && !SAYS_SENT.test(row.payment_note ?? ""),
      JSON.stringify(row),
    );
    const jobs = await jobsFor("queued");
    check("and the email names its order, so its sending lands on the order's timeline", jobs.length === 1, `${jobs.length} email job(s) carrying the order id`);
    const actions = await actionsFor("queued");
    check(
      "and the audit trail says queued",
      actions.some((a) => a.action === "file.payment_link_queued" && !SAYS_SENT.test(a.summary)) && !actions.some((a) => a.action === "file.payment_link_sent"),
      actions.map((a) => a.action).join(", ") || "no audit row",
    );
  }

  /* ======================= 2. a link that could not be queued ======================= */
  {
    failEnqueueFor = orderId("failed");
    let res;
    try {
      res = await announce("failed");
    } finally {
      failEnqueueFor = null;
    }
    check(
      "a link that could not be queued is reported as a failure naming the order",
      res?.ok === false && /could not be queued/.test(res.error) && res.error.includes(reference("failed")),
      JSON.stringify(res),
    );
    const row = await fileRow("failed");
    check(
      "the file is not marked as having a link out, and says it has to go out by hand",
      row?.payment_intent === "unset" && /has to go out by hand/.test(row.payment_note ?? "") && !SAYS_SENT.test(row.payment_note ?? ""),
      JSON.stringify(row),
    );
    const jobs = await jobsFor("failed");
    const actions = await actionsFor("failed");
    check(
      "nothing is queued, and the audit trail says it was not",
      jobs.length === 0 && actions.some((a) => a.action === "file.payment_link_not_queued") && !actions.some((a) => /payment_link_(sent|queued)$/.test(a.action)),
      `${jobs.length} job(s); ${actions.map((a) => a.action).join(", ") || "no audit row"}`,
    );
  }
} finally {
  await rest.close();
}
await db.close();

/* ===================== 3. the door the operator uses calls it ===================== */
{
  const src = readFileSync("src/lib/ops-job-billing.ts", "utf8");
  const start = src.indexOf("export async function sendPaymentLink(");
  const end = src.indexOf("export async function announcePaymentLink(");
  const body = start >= 0 && end > start ? src.slice(start, end) : "";
  check(
    "sendPaymentLink hands the email to announcePaymentLink and queues nothing itself",
    body.split("announcePaymentLink(").length - 1 === 1 && !body.includes("queueEmail("),
    body ? "" : "sendPaymentLink or announcePaymentLink not found in order",
  );
}

console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: a payment link says queued, and a link that could not be queued says so and leaves the file unmarked.");
