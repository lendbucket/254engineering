import "server-only";
import { supabaseAdmin } from "./supabase";
import { enqueue, queueEmail, type JobRecord } from "./ops-jobs";
import type { JobOutcome } from "./job-rules";
import { orderForFile } from "./order-for-file";
import { event as orderEvent } from "./ops-intake";
import { reviewRequest } from "./email-templates";
import { isSuppressed, unsubscribeUrl } from "./marketing-suppression";
import { business } from "@/config/business";
import { REVIEW_LINK, REVIEW_REQUEST_DELAY_DAYS } from "@/config/review-request";

/*
 * ===========================================================================
 * THE GOOGLE REVIEW REQUEST. Operator ruling, 2026-10-10 (run item 25).
 * ===========================================================================
 *
 * One email per delivered order, sent by the job queue REVIEW_REQUEST_DELAY_DAYS
 * after delivery, to every customer alike. No happiness screen, no incentive,
 * never sent twice, and nothing sends while REVIEW_LINK is empty.
 *
 * NEVER TWICE HAS TWO HALVES. The queue's idempotency key stops a second LIVE
 * job for the same order; it says nothing once the first has finished. So the
 * order's own event log is the durable record: the job looks for
 * `review_request.queued` before it queues anything, and writes it in the same
 * run. A second delivery of the same file, or a replayed job, finds it and stops.
 *
 * Every outcome is written on the order's timeline, internal only, in words
 * that say what happened: queued for a date, sent to the email queue, or not
 * sent and why. "Queued" rather than "sent" for the email itself, by the ruling
 * on defect 22: the email job is what sends.
 */

export const REVIEW_REQUEST_JOB = "review.request" as const;
export const REVIEW_SENT_EVENT = "review_request.queued";

/** The idempotency key for an order's one request. */
export function reviewRequestKey(orderId: string): string {
  return `review-request:${orderId}`;
}

/**
 * Called when a file reaches delivered (transitionFile, beside the partner
 * accrual). Queues the request for its order, to run after the delay. A file
 * with no order, which is a job taken by hand and never ordered, has no
 * customer address to write to and is skipped.
 */
export async function scheduleReviewRequest(fileId: string): Promise<void> {
  const order = await orderForFile(fileId, "reference");
  if (!order) return;

  const runAfter = new Date(Date.now() + REVIEW_REQUEST_DELAY_DAYS * 86_400_000);
  const queued = await enqueue(REVIEW_REQUEST_JOB, { orderId: order.id }, { runAfter });
  await orderEvent(
    order.id,
    "review_request.scheduled",
    false,
    queued.ok
      ? `A Google review request is scheduled for ${runAfter.toISOString().slice(0, 10)}. It is sent only if the review link is configured and the address is not on the do not contact list.`
      : `A Google review request could not be scheduled: ${queued.error}.`,
  );
}

/**
 * The job. Each early return records why nothing was sent. `link` is the
 * configured review link, passed in so a proof can ask both questions (empty
 * and set) without patching a module that is read once.
 */
export async function runReviewRequest(
  orderId: string,
  job: Pick<JobRecord, "effectMode">,
  link: string = REVIEW_LINK,
): Promise<JobOutcome> {
  const db = supabaseAdmin();
  if (!db) return { kind: "retry", error: "The database is not configured." };

  const { data: order, error } = await db
    .from("eng_service_orders")
    .select("id, reference, status, customer_name, customer_email, property_address")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { kind: "retry", error: error.message };
  if (!order) return { kind: "fatal", error: "The order does not exist." };

  const { data: already, error: alreadyErr } = await db
    .from("eng_order_events")
    .select("id")
    .eq("order_id", orderId)
    .eq("event", REVIEW_SENT_EVENT)
    .limit(1);
  if (alreadyErr) return { kind: "retry", error: alreadyErr.message };
  if ((already ?? []).length > 0) return { kind: "done" };

  const notSent = async (why: string): Promise<JobOutcome> => {
    await orderEvent(orderId, "review_request.not_sent", false, `No Google review request was sent: ${why}.`);
    return { kind: "done" };
  };

  if (!link) return notSent("the review link is not configured");
  if (order.status !== "complete") return notSent(`the order is ${String(order.status).replace(/_/g, " ")}, not complete`);
  if (await isSuppressed(order.customer_email as string)) return notSent("the address is on the do not contact list");

  const unsubscribe = unsubscribeUrl(order.customer_email as string);
  if (!unsubscribe) return notSent("no unsubscribe link could be signed, and this email does not go without one");

  const queued = await queueEmail(
    reviewRequest({
      customerName: order.customer_name as string,
      customerEmail: order.customer_email as string,
      reference: order.reference as string,
      propertyAddress: order.property_address as string,
      reviewUrl: `${business.url}/review`,
      unsubscribeUrl: unsubscribe,
    }),
    { orderId },
    /* The mode travels with the work, as errors.alert's does: a suppressed run never spawns a live send. */
    job.effectMode,
  );
  if (!queued.ok) return { kind: "retry", error: `Could not queue the review request: ${queued.error}` };

  await orderEvent(orderId, REVIEW_SENT_EVENT, false, `A Google review request is queued to ${order.customer_email as string}. The email job sends it.`);
  return { kind: "done" };
}
