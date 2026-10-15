import "server-only";
import { supabaseAdmin } from "./supabase";
import { DB_NOW } from "./db-now";
import { PARTNER_BILLING } from "@/config/partner-billing";
import {
  billingAllowsOrdering,
  nextBillingRow,
  partnerCheckoutParams,
  type BillingRow,
  type BillingStatus,
  type PartnerBillingEvent,
} from "./partner-billing-rules";

/**
 * PARTNER BILLING, THE WRITES. The rules are in partner-billing-rules.ts; this
 * file reads and writes eng_partner_billing and eng_partner_billing_events
 * (0074) and nothing else. It imports nothing from the order path, and the
 * order path imports nothing from it: a lapse can never touch an order, a file,
 * a payment or a sealed document, because there is no code that could.
 *
 * Operator ruling of 2026-10-11: $800 upfront and $99 a month, paid to 254
 * through 254's one Stripe account. Billing is off (src/config/partner-billing.ts).
 */

export type PartnerBilling = BillingRow & { partner_id: string };

/** A partner's billing row, or null when there is none. Throws on a failed read. */
export async function partnerBilling(partnerId: string): Promise<PartnerBilling | null> {
  const db = supabaseAdmin();
  if (!db) throw new Error("The database is not configured.");
  const { data, error } = await db
    .from("eng_partner_billing")
    .select("partner_id, status, past_due_since, current_period_end, stripe_customer_ref, stripe_subscription_ref")
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (error) throw new Error(`The partner's billing could not be read: ${error.message}`);
  return (data as PartnerBilling | null) ?? null;
}

/**
 * Whether billing lets this partner order. While billing is off it allows
 * everybody without reading anything. Once on, a failed read refuses: an
 * unknown is not paid up.
 */
export async function partnerMayOrder(partnerId: string): Promise<{ allowed: boolean; status: BillingStatus | null; why?: string }> {
  if (!PARTNER_BILLING.enabled) return { allowed: true, status: null };
  try {
    const row = await partnerBilling(partnerId);
    const status = row?.status ?? null;
    return { allowed: billingAllowsOrdering(status, true), status };
  } catch (err) {
    return { allowed: false, status: null, why: err instanceof Error ? err.message : "unreadable" };
  }
}

/**
 * Apply one verified partner billing event. The event row is written FIRST,
 * keyed by Stripe's event id, so a redelivery stops at the duplicate key and
 * changes nothing. Then the state row moves, if the event moves it.
 */
export async function applyPartnerBillingEvent(
  event: PartnerBillingEvent,
  /* The database's clock, not this process's: past_due_since is an observed
   * moment and starts the grace period (db-now.ts). The rules only copy it. */
  nowIso: string = DB_NOW,
): Promise<{ ok: true; duplicate: boolean; status: BillingStatus | null } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  let current: PartnerBilling | null;
  try {
    current = await partnerBilling(event.partnerId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unreadable" };
  }
  const next = nextBillingRow(current, event, nowIso);

  const { error: eventError } = await db.from("eng_partner_billing_events").insert({
    stripe_event_id: event.eventId,
    partner_id: event.partnerId,
    event_type: event.type,
    status_after: next?.status ?? null,
  });
  if (eventError) {
    if (eventError.code === "23505") return { ok: true, duplicate: true, status: current?.status ?? null };
    return { ok: false, error: `The billing event could not be recorded: ${eventError.message}` };
  }
  if (!next) return { ok: true, duplicate: false, status: current?.status ?? null };

  const { error } = await db
    .from("eng_partner_billing")
    .upsert({ partner_id: event.partnerId, ...next }, { onConflict: "partner_id" });
  if (error) return { ok: false, error: `The partner's billing could not be updated: ${error.message}` };
  return { ok: true, duplicate: false, status: next.status };
}

/**
 * Send a partner to checkout. Refused while billing is off, before anything
 * else is read, so development and an unconfigured deployment never reach
 * Stripe. The Stripe call itself sits in payments-stripe.ts, behind the
 * live-key guard every charge passes.
 */
export async function startPartnerCheckout(input: {
  partnerId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!PARTNER_BILLING.enabled) {
    return { ok: false, error: "Partner billing is not open yet. Nothing has been charged." };
  }
  const { createPartnerCheckout } = await import("./payments-stripe");
  const { params, idempotencyKey } = partnerCheckoutParams(input);
  try {
    return { ok: true, url: await createPartnerCheckout(params, idempotencyKey) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The checkout could not be started." };
  }
}
