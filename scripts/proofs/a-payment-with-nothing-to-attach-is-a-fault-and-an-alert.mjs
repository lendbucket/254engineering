/**
 * A PAYMENT WITH NOTHING TO ATTACH IT TO IS A FAULT, A TASK AND ONE ALERT.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-payment-with-nothing-to-attach-is-a-fault-and-an-alert.mjs
 *
 * Robert's answer 7 to the evening report of 2026-11-17 (6963018405): a
 * completed checkout carrying no order, batch or statement id is recorded as a
 * fault and the administrator is alerted. Until then the webhook logged a line
 * and answered 200, which told Stripe to stop while nothing on the platform
 * knew money had moved.
 *
 *   A  the route's branch for a checkout naming no order calls
 *      recordUnattachedPayment, answers 500 when it fails, and no longer
 *      answers 200 with nothing written
 *   B  recordUnattachedPayment records the fault, raises a task keyed on the
 *      checkout session, and queues the alert only when that task is new, so
 *      a second delivery of the event sends nothing more
 *   C  the alert is a rendered office alert, so it reaches the list the owner
 *      edits, and it names the amount and both Stripe references
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* A: the route. */
const route = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const completed = route.slice(route.indexOf('parsed.kind === "checkout.completed"'), route.indexOf('parsed.kind === "checkout.expired"'));
const branchAt = completed.indexOf("if (!parsed.orderId) {");
const branch = completed.slice(branchAt, completed.indexOf("const result = await markPaid(", branchAt));
check("A: the completed branch still has its no-order case", branchAt !== -1 && branch.length > 0);
check("A: it calls recordUnattachedPayment with the session, the charge and the amount", /await recordUnattachedPayment\(\{[\s\S]*sessionRef: parsed\.sessionRef,[\s\S]*chargeRef: parsed\.chargeRef,[\s\S]*amountCents: parsed\.amountCents,/.test(branch));
check("A: and answers 500 when it could not record it, so Stripe delivers it again", /if \(!result\.ok\) \{[\s\S]*status: 500/.test(branch));
check("A: it no longer answers 200 with nothing written", !/handled: false/.test(branch));

/* B: the module. */
const lib = readFileSync("src/lib/unattached-payment.ts", "utf8");
const taskAt = lib.indexOf("await raiseSystemTask(");
const queueAt = lib.indexOf("await queueEmail(");
check("B: the fault is recorded, through captureError, before anything else", lib.indexOf("await captureError(") !== -1 && lib.indexOf("await captureError(") < taskAt);
check("B: the task is keyed on the checkout session", /key: `payment-unattached:\$\{input\.sessionRef\}`/.test(lib));
check("B: a task that could not be raised fails the delivery", /if \(!task\.ok\) return \{ ok: false/.test(lib));
check(
  "B: the alert is queued only after a NEW task, so a redelivery sends nothing more",
  taskAt !== -1 && queueAt > taskAt && /if \(task\.already\) return \{ ok: true, alreadyRecorded: true \};/.test(lib.slice(taskAt, queueAt)),
);

/* C: the alert itself, rendered. */
const { OFFICE_ALERT_IDS } = await import("../../src/lib/alert-recipient-rules.ts");
const { unattachedPaymentAlert } = await import("../../src/lib/email-templates.ts");
const email = unattachedPaymentAlert({
  sessionRef: "cs_test_proof",
  chargeRef: "pi_test_proof",
  amount: "$884.00",
  tasksUrl: "https://254engineering.com/portal/tasks",
  environment: "test",
});
check("C: it is an office alert, so it reaches the list the owner edits", OFFICE_ALERT_IDS.includes(email.id) && email.id === "ops.payment_unattached" && !email.to);
check("C: it names the amount, the payment and the checkout", ["$884.00", "pi_test_proof", "cs_test_proof"].every((s) => email.text.includes(s)));

console.log(wrong === 0 ? "PASS: a payment with nothing to attach it to is a fault, a task and one alert." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
