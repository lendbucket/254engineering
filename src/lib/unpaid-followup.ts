import "server-only";
import { supabaseAdmin } from "./supabase";
import { captureError } from "./ops-observability";
import { raiseSystemTask } from "./system-work";
import { money } from "./ops-money";
import { business } from "@/config/business";

/**
 * ===========================================================================
 * A JOB TAKEN BY TELEPHONE AND NOT PAID IN 24 HOURS IS GIVEN BACK TO THE REP
 * WHO TOOK IT. The Killeen call, item 6 (Robert, 2026-11-14).
 * ===========================================================================
 *
 * The orders screen already flags an order waiting past the 24 hour checkout
 * window (order-attention.ts), and the Part 1 report found that the follow-up
 * belonged to nobody. This raises one task per order, assigned to the person
 * who took the job (eng_files.created_by, written by takeJob), linking to the
 * file, where "Send the payment link again" is (resendPaymentLink).
 *
 * WHICH ORDERS. A card order raised against a file (a telephoned job) still
 * awaiting payment 24 hours after it was raised. A web checkout abandoned
 * before payment has no file and nobody took it, so it is not one of these.
 *
 * ONCE PER ORDER, by the task's key, which raiseSystemTask makes unique; a
 * completed follow-up is answered as already done and is not raised again.
 * Bounded per run, and the note says how many it raised, never how many exist.
 */
export const UNPAID_AFTER_HOURS = 24;
export const UNPAID_BATCH = 100;

export async function sweepUnpaidJobs(now: number = Date.now()): Promise<{ looked: boolean; raised: number; note: string }> {
  try {
    const db = supabaseAdmin();
    if (!db) return { looked: false, raised: 0, note: "the database is not configured" };
    const before = new Date(now - UNPAID_AFTER_HOURS * 3600_000).toISOString();
    const { data, error } = await db
      .from("eng_service_orders")
      .select("id, reference, total_cents, customer_name, customer_email, file_id, eng_files(file_number, created_by)")
      .eq("status", "awaiting_payment")
      .eq("billing_mode", "card")
      .not("file_id", "is", null)
      .lt("created_at", before)
      /*
       * NEWEST FIRST. Oldest first with a limit would fill every run with
       * orders already followed up once a hundred are waiting, and the order
       * that has just crossed 24 hours would never be reached.
       */
      .order("created_at", { ascending: false })
      .limit(UNPAID_BATCH);
    if (error) {
      await captureError(new Error(`The unpaid jobs could not be read: ${error.message}`), { kind: "unpaid-followup", route: "/api/cron/jobs" });
      return { looked: false, raised: 0, note: `the read failed: ${error.message}` };
    }

    let raised = 0;
    for (const o of data ?? []) {
      const file = o.eng_files as { file_number?: string; created_by?: string | null } | null;
      const fileNumber = file?.file_number ?? "the job";
      const result = await raiseSystemTask({
        key: `unpaid-followup:${o.id as string}`,
        title: `Chase the payment for ${fileNumber}: ${money(Number(o.total_cents))} not paid after ${UNPAID_AFTER_HOURS} hours`,
        description:
          `${o.customer_name as string} (${o.customer_email as string}) was sent a payment link for ${o.reference as string} ` +
          `${UNPAID_AFTER_HOURS} or more hours ago and has not paid. Call them, and send the link again from the file: ` +
          `${business.url}/portal/files?id=${o.file_id as string}`,
        assigneeId: file?.created_by ?? null,
        fileId: o.file_id as string,
      });
      if (!result.ok) {
        await captureError(new Error(`The unpaid follow-up for ${o.reference as string} could not be raised: ${result.error}`), { kind: "unpaid-followup", route: "/api/cron/jobs" });
        continue;
      }
      if (!result.already) raised += 1;
    }
    return {
      looked: true,
      raised,
      note: raised === 0 ? "no new unpaid follow-up" : `${raised} unpaid follow-up(s) raised this run${(data ?? []).length === UNPAID_BATCH ? ", more may be waiting" : ""}`,
    };
  } catch (err) {
    await captureError(err, { kind: "unpaid-followup", route: "/api/cron/jobs" });
    return { looked: false, raised: 0, note: `the sweep threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}
