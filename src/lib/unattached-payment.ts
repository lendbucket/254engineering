import "server-only";
import { business } from "@/config/business";
import { captureError, ENVIRONMENT } from "./ops-observability";
import { queueEmail } from "./ops-jobs";
import { unattachedPaymentAlert } from "./email-templates";
import { raiseSystemTask } from "./system-work";
import { money } from "./ops-money";

/**
 * A PAID CHECKOUT THAT NAMES NO ORDER, NO BATCH AND NO STATEMENT.
 *
 * Robert's answer 7 to the evening report of 2026-11-17 (6963018405), from the
 * webhook work of 2026-10-13, item 7: "record a completed checkout with no
 * order, batch or statement id as a fault and alert the administrator." Until
 * then the webhook logged one line and answered 200, so money had moved and
 * nothing on the platform knew.
 *
 * THREE THINGS, AND WHY EACH ONE.
 *
 *   The fault, through captureError, so it is on the status page beside every
 *   other fault. Its fingerprint strips ids, so every such checkout is one
 *   fault type, and the error sweep alerts on a NEW type only: on its own it
 *   would have told the office about the first of these and never the second.
 *
 *   The task, keyed on the checkout session, so it stays until a person closes
 *   it, and so a second delivery of the same event from Stripe finds the first
 *   task (`already`) rather than raising another.
 *
 *   The alert email, to the list the owner edits (ops.payment_unattached,
 *   0099), queued ONLY when the task was newly raised. That is what makes it
 *   one email per checkout however often Stripe delivers the event.
 *
 * A task that could not be raised is the failure that matters: the fault is a
 * log, and the email is sent only beside a task. So it answers not ok, and the
 * route answers 500, so Stripe delivers the event again and the next delivery
 * raises it. The old answer was 200, which told Stripe to stop.
 *
 * An email that could not be queued is said in the console and as a second
 * fault, and does not fail the delivery: the task exists, and a retry would
 * find it and send nothing, so failing here would buy no email at all.
 */
export async function recordUnattachedPayment(input: {
  eventId: string;
  sessionRef: string;
  chargeRef: string;
  amountCents: number;
}): Promise<{ ok: true; alreadyRecorded: boolean } | { ok: false; error: string }> {
  const amount = money(input.amountCents);

  await captureError(new Error(`A paid checkout named no order, batch or statement: ${amount} on ${input.chargeRef}`), {
    route: "/api/stripe/webhook",
    kind: "webhook",
    level: "error",
    extra: { eventId: input.eventId, sessionRef: input.sessionRef, chargeRef: input.chargeRef, amountCents: input.amountCents },
  });

  const task = await raiseSystemTask({
    key: `payment-unattached:${input.sessionRef}`,
    title: `A payment of ${amount} arrived with nothing to attach it to`,
    description:
      `Stripe reported a paid checkout (${input.sessionRef}, payment ${input.chargeRef}) that names no order, batch or statement, ` +
      "so nothing on the platform is marked paid and no work was released. Find it in the Stripe dashboard by the payment reference, " +
      "work out who paid and for what, and settle it there or refund it.",
  });
  if (!task.ok) return { ok: false, error: `the task could not be raised: ${task.error}` };
  if (task.already) return { ok: true, alreadyRecorded: true };

  const queued = await queueEmail(
    unattachedPaymentAlert({
      sessionRef: input.sessionRef,
      chargeRef: input.chargeRef,
      amount,
      tasksUrl: `${business.url}/portal/tasks`,
      environment: ENVIRONMENT,
    }),
  );
  if (!queued.ok) {
    console.error(`[stripe] the unattached payment alert for ${input.sessionRef} could not be queued: ${queued.error}`);
    await captureError(new Error(`The unattached payment alert could not be queued: ${queued.error}`), {
      route: "/api/stripe/webhook",
      kind: "webhook",
      level: "error",
      extra: { sessionRef: input.sessionRef },
    });
  }
  return { ok: true, alreadyRecorded: false };
}
