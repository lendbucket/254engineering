/**
 * A REVIEW REQUEST GOES ONCE, OR NOT AT ALL.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-review-request-goes-once-or-not-at-all.mjs
 *
 * Run item 25 of 2026-10-10. One Google review request per delivered order,
 * after a delay, to every customer alike; never twice; nothing while the link
 * is empty; the suppression list respected.
 *
 * The rulings are PINNED here as literals (CLAUDE.md 6c): the link is empty
 * until Robert gives the Business Profile URL, and the delay is the run's
 * default of seven days pending his ruling.
 *
 * Live on development against a probe order (@audit-probe.invalid, status
 * complete, no payment, so it can be removed with its events). Every email the
 * run queues is queued no_external_effect, so nothing can reach a mailbox, and
 * the jobs are removed at the end.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { REVIEW_LINK, REVIEW_REQUEST_DELAY_DAYS } = await import("../../src/config/review-request.ts");
check("the review link is empty until the Business Profile URL is given", REVIEW_LINK === "");
check("the delay is seven days, the run's default pending a ruling", REVIEW_REQUEST_DELAY_DAYS === 7);

/* The shape the code must keep: no happiness screen, the gate before the queue, the marketing list. */
const src = readFileSync("src/lib/review-request.ts", "utf8");
const run = src.slice(src.indexOf("export async function runReviewRequest("));
const at = (s) => run.indexOf(s);
check("the run checks the link, the order and the suppression list before it queues", at("if (!link)") > 0 && at("isSuppressed(") > at("if (!link)") && at("queueEmail(") > at("isSuppressed("));
check("and records the request as queued only after the email is queued", at("REVIEW_SENT_EVENT, false") > at("queueEmail("));
check("and passes the job's effect mode to the email it queues", run.includes("job.effectMode,"));
const crm = readFileSync("src/lib/ops-crm.ts", "utf8");
check("delivery schedules it, in the one door to delivered", /if \(to === "delivered"\) \{[\s\S]*?scheduleReviewRequest\(id\)/.test(crm));
const templates = readFileSync("src/lib/email-templates.ts", "utf8");
const tpl = templates.slice(templates.indexOf("export function reviewRequest("), templates.indexOf("export function reviewRequest(") + 2500);
check("the email asks every customer alike, with no question about whether they were happy", !/happy|satisf|enjoy|if you liked|rate us/i.test(tpl));
check("and offers nothing for a review", !/discount|gift|coupon|reward|free |entry|chance to win/i.test(tpl));

const { auditClient } = await import("../lib/db-target.mjs");
const db = auditClient("the review request proof", { neverProduction: true });
if (!db) {
  console.log("  COULD NOT TELL: no development database client, so the live half did not run.");
} else {
  const { runReviewRequest, REVIEW_SENT_EVENT } = await import("../../src/lib/review-request.ts");
  const stamp = Date.now();
  const email = `review-proof-${stamp}@audit-probe.invalid`;
  let orderId = null;
  const quiet = { effectMode: "no_external_effect" };
  const events = async (name) =>
    ((await db.from("eng_order_events").select("id").eq("order_id", orderId).eq("event", name)).data ?? []).length;
  const emailJobs = async () =>
    ((await db.from("eng_jobs").select("id, effect_mode").eq("kind", "email.send").eq("payload->>to", email)).data ?? []);
  try {
    const { data: order, error } = await db
      .from("eng_service_orders")
      .insert({
        site: "254engineering",
        /* A demo order's reference carries -DEMO- (0027's check), so reports never count it. */
        reference: `254-DEMO-${String(stamp).slice(-8)}`,
        service_slug: "roof-inspections",
        order_type: "desk",
        status: "complete",
        customer_name: "Review proof customer, not a real person",
        customer_email: email,
        property_address: "1 Probe Street, Nowhere",
        county: "Nueces",
        is_demo: true,
      })
      .select("id")
      .single();
    if (error || !order) throw new Error(`probe order: ${error?.message}`);
    orderId = order.id;

    const empty = await runReviewRequest(orderId, quiet);
    check("with no link configured, the run finishes and sends nothing", empty.kind === "done" && (await emailJobs()).length === 0);
    check("and the order's timeline says why", (await events("review_request.not_sent")) === 1);

    const sent = await runReviewRequest(orderId, quiet, "https://example.invalid/review");
    const jobs = await emailJobs();
    check("with a link, one email is queued", sent.kind === "done" && jobs.length === 1, `${jobs.length} queued`);
    check("and it is queued with no external effect, because the run's mode travels with it", jobs[0]?.effect_mode === "no_external_effect");
    check("and the order records it as queued", (await events(REVIEW_SENT_EVENT)) === 1);

    const again = await runReviewRequest(orderId, quiet, "https://example.invalid/review");
    check("run again, it finds its own record and queues nothing more", again.kind === "done" && (await emailJobs()).length === 1 && (await events(REVIEW_SENT_EVENT)) === 1);
  } catch (err) {
    wrong += 1;
    console.log(`  FAIL: the live half could not run (${err instanceof Error ? err.message : String(err)})`);
  } finally {
    const { error: jErr } = await db.from("eng_jobs").delete().eq("kind", "email.send").eq("payload->>to", email);
    if (jErr) console.log(`  note: probe email jobs not removed: ${jErr.message}`);
    if (orderId) {
      const { error: oErr } = await db.from("eng_service_orders").delete().eq("id", orderId);
      if (oErr) console.log(`  note: the probe order was not removed: ${oErr.message}`);
    }
  }
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a review request goes once, or not at all.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
