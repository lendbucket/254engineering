/**
 * A PAYMENT LINK IS RECORDED AS QUEUED, NEVER AS SENT, AND A LINK THAT COULD NOT
 * BE QUEUED SAYS NOTHING WAS SENT.
 *
 *   node scripts/proofs/a-payment-link-is-queued-not-sent.mjs
 *
 * Robert's answer 4 of 2026-11-21 (issue #1, 7072967992), on Q5 of the morning
 * of 2026-10-15, which nobody had answered: `sendPaymentLink` queued the email
 * without reading the answer, then wrote "Payment link sent to ..." on the file
 * and "a payment link was sent" in the audit trail. A queue that failed read as
 * a link that had gone out. Queued is what is known when the job is put on the
 * queue; delivery is known only when the provider accepts it, and the email
 * handler writes that to the order's own timeline.
 *
 * Read from the source, as the other proofs on this path are, because the
 * function needs a database, a checkout and the queue. What it pins:
 *   1. the first send reads the queue's answer and passes the order, so the
 *      handler can write delivery to that order's timeline;
 *   2. a failed queue returns a refusal saying "Nothing was sent" and naming the
 *      order and Resend, and the file note and audit say the same;
 *   3. a queued link is recorded as queued, on the first send and on a resend;
 *   4. neither path records "sent" for the act of queueing.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const src = readFileSync("src/lib/ops-job-billing.ts", "utf8");
const body = (name) => {
  const start = src.indexOf(`export async function ${name}(`);
  const next = src.indexOf("\nexport ", start + 10);
  return start < 0 ? "" : src.slice(start, next < 0 ? undefined : next);
};
const send = body("sendPaymentLink");
const resend = body("resendPaymentLink");
check("both functions were found", send.length > 500 && resend.length > 500, `${send.length} and ${resend.length} characters`);

console.log("the first send");
check("reads the queue's answer", /const queued = await queueEmail\(/.test(send));
check("passes the order, so delivery is written to its timeline", /\{ orderId: order\.orderId \}/.test(send));
check(
  "a failed queue is a refusal that says nothing was sent, names the order and points at Resend",
  /queued\.ok\s*\?\s*null/.test(send) &&
    /could not be queued: \$\{queued\.error\}\. Nothing was sent\. Use Resend on this file\./.test(send) &&
    /if \(notSent\) return \{ ok: false, error: notSent \}/.test(send),
);
check("the file note and the audit carry the same sentence on a failure", /payment_note: notSent \?\?/.test(send) && /summary: notSent/.test(send));
check("a queued link is recorded as queued", /Payment link queued to \$\{client\.email\}/.test(send) && /a payment link was queued to/.test(send));
/* Comments stripped first: the comment above the fix quotes the old sentence it replaced. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
check("and no code on the first send says sent", !/Payment link sent to|link was sent to/.test(code(send)));

console.log("the resend");
check("still refuses on a failed queue with Nothing was sent", /if \(!queued\.ok\) return \{ ok: false, error: `The payment link for \$\{order\.reference\} could not be queued: \$\{queued\.error\}\. Nothing was sent\.` \}/.test(resend));
check("records a resend as queued again", /was queued again to/.test(resend) && !/was sent again to/.test(resend));

console.log("");
if (wrong === 0) {
  console.log("PASS: a payment link is recorded as queued, and one that could not be queued says nothing was sent.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
