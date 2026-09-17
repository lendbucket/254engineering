/**
 * PHASE 14 RANK 8: A REFUND EVENT DRIVEN THROUGH THE REAL WEBHOOK ROUTE.
 *
 *   npm run build   (once, beforehand)
 *   npx tsx scripts/exercises/stripe-refund-webhook.mjs
 *
 * What proved it before tonight: `order-audit` reads the webhook's and the
 * adapter's SOURCE and asserts the refund branch calls `recordExternalRefund(`,
 * takes `charge.amount_refunded`, and does not test `if (!intent || !latest)`.
 * Checks on wording, over the path that on 2026-09-03 answered four real refunds
 * with 200 and recorded nothing.
 *
 * WHAT THIS DRIVES, AND WHERE IT DELIBERATELY STOPS
 * -------------------------------------------------
 * The built app under `next start`, a `charge.refunded` event in the shape Stripe
 * actually sends (refunds NOT expanded), signed with the Stripe SDK's own test
 * header against a webhook secret that exists only in this process. So the
 * signature boundary, the parse that cost four refunds, and the route's branch
 * all run for real.
 *
 * It STOPS before the ledger. Recording a refund needs a charge on file, and a
 * charge on file is a row in eng_order_payments, which refuses DELETE by 0006's
 * ruling. `demo-audit` already declines to insert one for exactly that reason,
 * and this follows it: the charge the event names does not exist, so the
 * recorder's refusal is the deepest point reached, and the delta arithmetic and
 * the idempotency on the refund id are NOT proven here. The payments table is
 * counted before and after to prove nothing was written.
 *
 * Nothing leaves this machine. The Stripe key is a test-shaped string that
 * reaches no account; constructEvent is a local HMAC.
 */

import { spawn, execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

process.loadEnvFile?.(".env.local");
const { auditClient, refOf, DEVELOPMENT_REF } = await import("../lib/db-target.mjs");

const PORT = 3228;
const BASE = `http://localhost:${PORT}`;
const SECRET = `whsec_exercise_${randomUUID().replace(/-/g, "")}`;
const WRONG_SECRET = `whsec_exercise_${randomUUID().replace(/-/g, "")}`;
const FAKE_KEY = `sk_test_exercise_${randomUUID().replace(/-/g, "")}`;
const INTENT = `pi_exercise_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

let failures = 0;
const rec = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
};

if (refOf(process.env.SUPABASE_URL ?? "") !== DEVELOPMENT_REF) {
  console.error("REFUSED: this exercise runs against development by name.");
  process.exit(1);
}
const db = auditClient("stripe refund webhook exercise", { neverProduction: true });
const busy = await fetch(`${BASE}/`).then(() => true).catch(() => false);
if (busy) {
  console.error(`REFUSED: something already answers on ${PORT}.`);
  process.exit(1);
}

const stripe = new Stripe(FAKE_KEY);

/* A charge.refunded event as Stripe delivers it: the refunds list is NOT expanded on the charge. */
function refundEvent({ withIntent = true } = {}) {
  return JSON.stringify({
    id: `evt_exercise_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    object: "event",
    type: "charge.refunded",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `ch_exercise_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
        object: "charge",
        amount: 67500,
        amount_refunded: 17500,
        payment_intent: withIntent ? INTENT : null,
        refunded: false,
      },
    },
  });
}

async function post(payload, secret = SECRET) {
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const r = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

const payments = async () => {
  const { count, error } = await db.from("eng_order_payments").select("id", { count: "exact", head: true });
  if (error || typeof count !== "number") throw new Error(`could not count eng_order_payments: ${error?.message ?? "null count"}`);
  return count;
};

console.log("stripe refund webhook exercise, against the built application and development\n");

const { count: onFile } = await db
  .from("eng_order_payments").select("id", { count: "exact", head: true }).eq("provider_ref", INTENT);
rec("the charge the event names is not on file, so the recorder cannot write", onFile === 0, INTENT);
const before = await payments();

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  env: { ...process.env, STRIPE_SECRET_KEY: FAKE_KEY, STRIPE_WEBHOOK_SECRET: SECRET, ORDER_PAYMENTS_FAKE: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

try {
  let up = false;
  for (let i = 0; i < 60 && !up; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    up = await fetch(`${BASE}/`).then((r) => r.status === 200).catch(() => false);
  }
  if (!up) throw new Error(`the server did not come up:\n${log.slice(-600)}`);

  const good = refundEvent();
  const r1 = await post(good);
  rec("a signed refund event in Stripe's real shape is verified, parsed, and reaches the recorder",
    r1.status === 200 && r1.body?.handled === false && r1.body?.reason === "no charge on file",
    `${r1.status} ${JSON.stringify(r1.body)}`);
  await new Promise((r) => setTimeout(r, 300));
  rec("and the server says, in its own log, which refund and why it did not attach",
    log.includes(INTENT) && /no record of/.test(log), (log.split(/\r?\n/).find((l) => l.includes(INTENT)) ?? "").trim().slice(0, 110));

  const r2 = await post(good);
  rec("a redelivery of the same event answers the same, and still writes nothing",
    r2.status === 200 && r2.body?.reason === "no charge on file");

  const forged = await post(refundEvent(), WRONG_SECRET);
  rec("an event signed with any other secret is refused at the boundary", forged.status === 400, `${forged.status}`);
  rec("and the refusal is logged", /refused a webhook/.test(log));

  /*
   * INJECTION: the shape of the 2026-09-03 failure. Then, the parse returned
   * null and the route answered 200 with nothing anywhere. An event the adapter
   * cannot attach (here, no payment_intent) must take that same null branch, and
   * the check above must be able to tell it apart from a refund that reached the
   * recorder: no `reason`, and a log line naming the charge.
   */
  const orphan = await post(refundEvent({ withIntent: false }));
  await new Promise((r) => setTimeout(r, 300));
  rec("INJECTION: an event the adapter cannot parse answers without the recorder's reason, so the first check cannot pass on a swallowed refund",
    orphan.status === 200 && orphan.body?.handled === false && orphan.body?.reason === undefined,
    JSON.stringify(orphan.body));
  rec("and that swallow is not silent: the adapter logs the charge it could not attach",
    /carried no payment_intent/.test(log));

  const after = await payments();
  rec("eng_order_payments holds exactly as many rows as before", after === before, `${before} before, ${after} after`);
} catch (err) {
  failures += 1;
  console.log(`  STOP: ${err.message}`);
} finally {
  try {
    execSync(`taskkill /T /F /PID ${child.pid}`, { stdio: "ignore" });
  } catch {
    child.kill();
  }
}

console.log("\n  NOT PROVEN HERE: writing a refund against a charge on file, the delta against earlier refunds,");
console.log("  and idempotency on the refund id. Each needs a payment row, which can never be removed.");
console.log(`\n${failures ? "FAIL" : "PASS"}: ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
