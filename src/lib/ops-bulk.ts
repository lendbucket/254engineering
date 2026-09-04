import "server-only";
import { supabaseAdmin } from "./supabase";
import { catalogFor, orderBlockedReason, type CatalogEntry } from "@data/catalog";
import { isPrelaunch } from "./launch";
import { placeOrder, event } from "./ops-intake";
import { acceptOnInvoice } from "./ops-payments";
import { creditDecision } from "./account-credit";
import { splitBatch, type BatchSplit, type BulkProperty } from "./bulk-order";
import { FIRST_TIER_COASTAL } from "@/content/windstorm";
import { money } from "./ops-money";
import { writeAudit } from "./ops-audit";

/**
 * Placing many properties in one submission.
 *
 * WHY THIS CALLS placeOrder RATHER THAN WRITING ORDERS ITSELF
 * -----------------------------------------------------------
 * Every property still becomes a full order and a full file, with its own
 * qualification, its own price snapshot, its own refund disclosure and its own
 * event trail. placeOrder already does all of that, correctly, and it is the
 * thing order-audit has 449 checks pointing at.
 *
 * A second implementation here would be a second answer to "may the firm take
 * this work" and "what does it cost", and the two would drift. The batch is a
 * wrapper: it decides WHICH properties go through, and then puts each one
 * through the same door a single order uses.
 *
 * THE SPLIT IS COMPUTED TWICE ON PURPOSE
 * --------------------------------------
 * Once by preview(), which writes nothing and is what the customer reads, and
 * again by place(), which is what actually happens. The second one is
 * authoritative. A submission that carried the first result as data would let a
 * browser decide which properties were acceptable and what they cost, which is
 * the rule /api/order-flow already follows for a single order.
 */

export type BatchOutcome =
  | {
      ok: true;
      batchId: string;
      reference: string;
      accepted: { ref: string; orderId: string; reference: string; shareCents: number | null }[];
      rejected: { ref: string; reason: string }[];
      totalCents: number | null;
      /** 'card' means a checkout is next. 'invoice' means the work is already released. */
      billingMode: "card" | "invoice";
      duplicate: boolean;
    }
  | { ok: false; error: string; rejected?: { ref: string; reason: string }[] };

/**
 * The fourteen TWIA designated counties, as a set of names.
 *
 * Read from the same list the public site guards, so the surcharge a batch
 * applies and the windstorm content a visitor reads can never disagree.
 */
function twiaSet(): Set<string> {
  return new Set<string>(FIRST_TIER_COASTAL);
}

/** What the customer is shown before they commit. Writes nothing. */
export function previewBatch(
  serviceSlug: string,
  tier: string | undefined,
  properties: BulkProperty[],
): { ok: true; entry: CatalogEntry; split: BatchSplit } | { ok: false; error: string } {
  const entry = catalogFor(serviceSlug, tier);
  if (!entry) {
    return { ok: false, error: "That service does not sell a single deliverable. Choose which one." };
  }

  const blocked = orderBlockedReason(entry, isPrelaunch());
  if (blocked) return { ok: false, error: blocked };

  return { ok: true, entry, split: splitBatch(entry, properties, twiaSet()) };
}

export async function placeBatch(input: {
  site: string;
  clientRequestId: string;
  accountId: string;
  serviceSlug: string;
  tier?: string;
  customer: { name: string; email: string; phone?: string; company?: string };
  properties: BulkProperty[];
  inputs?: Record<string, string>;
}): Promise<BatchOutcome> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  if (!input.clientRequestId?.trim()) {
    return { ok: false, error: "A submission needs an idempotency key." };
  }

  /*
   * Idempotency first, exactly as placeOrder does it. A retry after a timeout
   * must find the batch that exists rather than creating ten more orders.
   */
  const { data: existing } = await db
    .from("eng_order_batches")
    .select("id, reference, total_cents, status")
    .eq("client_request_id", input.clientRequestId)
    .maybeSingle();

  if (existing) {
    const { data: orders } = await db
      .from("eng_service_orders")
      .select("id, reference, batch_share_cents")
      .eq("batch_id", existing.id);
    return {
      ok: true,
      batchId: existing.id as string,
      reference: existing.reference as string,
      accepted: (orders ?? []).map((o) => ({
        ref: o.reference as string,
        orderId: o.id as string,
        reference: o.reference as string,
        shareCents: o.batch_share_cents === null ? null : Number(o.batch_share_cents),
      })),
      rejected: [],
      totalCents: existing.total_cents === null ? null : Number(existing.total_cents),
      billingMode: "card",
      duplicate: true,
    };
  }

  /*
   * The compliance gate, before an order exists rather than after. A batch
   * created and then refused would leave rows for work the firm cannot lawfully
   * take, ten at a time.
   */
  const preview = previewBatch(input.serviceSlug, input.tier, input.properties);
  if (!preview.ok) return { ok: false, error: preview.error };

  const { entry, split } = preview;

  if (split.empty) {
    return {
      ok: false,
      error:
        "None of these properties can be taken, so nothing has been placed and nothing will be charged.",
      rejected: split.rejected.map((r) => ({ ref: r.ref, reason: r.reason })),
    };
  }

  // The account, and whether it may place this at all.
  const { data: account } = await db
    .from("eng_customer_accounts")
    .select("id, site, client_id, status, billing_mode, credit_limit_cents, net_days")
    .eq("id", input.accountId)
    .maybeSingle();
  if (!account) return { ok: false, error: "That account does not exist." };
  if (account.site !== input.site) return { ok: false, error: "That account belongs to another brand." };

  const billingMode = account.billing_mode as "card" | "invoice";

  if (billingMode === "invoice") {
    const balance = await accountBalance(input.accountId);
    const verdict = creditDecision(
      {
        billingMode,
        status: account.status as "active" | "suspended" | "closed",
        creditLimitCents:
          account.credit_limit_cents === null ? null : Number(account.credit_limit_cents),
        outstandingCents: balance.outstandingCents,
        oldestUnpaidDays: balance.oldestUnpaidDays,
        netDays: Number(account.net_days),
      },
      split.totalCents,
    );
    if (!verdict.ok) return { ok: false, error: verdict.message };
  } else if (account.status !== "active") {
    return { ok: false, error: "This account is not currently active. Speak to the firm." };
  }

  // The batch row, before any order, so every order has something to point at.
  const reference = batchReference();
  const { data: batch, error: batchError } = await db
    .from("eng_order_batches")
    .insert({
      site: input.site,
      reference,
      account_id: input.accountId,
      service_slug: input.serviceSlug,
      tier: input.tier ?? null,
      status: "draft",
      submitted_count: input.properties.length,
      accepted_count: split.accepted.length,
      rejected_count: split.rejected.length,
      total_cents: split.totalCents,
      rejections: split.rejected.map((r) => ({
        ref: r.ref,
        address: r.property.propertyAddress,
        reason: r.reason,
      })),
      client_request_id: input.clientRequestId,
      placed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return { ok: false, error: "The submission could not be recorded." };
  }

  /*
   * One order per accepted property, each through placeOrder so it gets the same
   * qualification, price snapshot and refund disclosure a single order gets.
   *
   * The per order idempotency key is derived from the batch's, so a retry of the
   * whole submission finds each order rather than creating duplicates.
   */
  const accepted: { ref: string; orderId: string; reference: string; shareCents: number | null }[] = [];
  const failures: { ref: string; reason: string }[] = [];

  for (const item of split.accepted) {
    const result = await placeOrder({
      site: input.site,
      clientRequestId: `${input.clientRequestId}:${item.ref}`,
      serviceSlug: input.serviceSlug,
      tier: input.tier,
      customer: input.customer,
      property: {
        propertyAddress: item.property.propertyAddress,
        city: item.property.city,
        county: item.property.county,
        postalCode: item.property.postalCode,
      },
      answers: item.property.answers,
      inputs: input.inputs,
    });

    if (!result.ok) {
      /*
       * placeOrder refusing here is not the same as a qualification rejection.
       * The split already qualified this property, so a refusal now is a fault
       * in the platform rather than something the customer did, and it is
       * recorded as one rather than being folded in with the rejections.
       */
      failures.push({ ref: item.ref, reason: result.error });
      continue;
    }

    await db
      .from("eng_service_orders")
      .update({
        batch_id: batch.id,
        account_id: input.accountId,
        batch_share_cents: item.priceCents,
        billing_mode: billingMode,
      })
      .eq("id", result.orderId);

    await event(
      result.orderId,
      "batch.member",
      false,
      `One of ${split.accepted.length} properties submitted together as ${reference}.`,
      { batch_reference: reference, share_cents: item.priceCents },
    );

    accepted.push({
      ref: item.ref,
      orderId: result.orderId,
      reference: result.reference,
      shareCents: item.priceCents,
    });
  }

  if (accepted.length === 0) {
    await db.from("eng_order_batches").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", batch.id);
    return {
      ok: false,
      error: "None of these properties could be placed. Nothing has been charged.",
      rejected: [...split.rejected.map((r) => ({ ref: r.ref, reason: r.reason })), ...failures],
    };
  }

  /*
   * An invoiced batch is accepted immediately: there is nothing to pay now, so
   * the work is released and the amount goes onto the account until period
   * close. A card batch waits for its checkout.
   */
  if (billingMode === "invoice") {
    for (const a of accepted) await acceptOnInvoice(a.orderId);
    await db
      .from("eng_order_batches")
      .update({ status: "accepted", accepted_count: accepted.length })
      .eq("id", batch.id);
  } else {
    await db
      .from("eng_order_batches")
      .update({ status: "awaiting_payment", accepted_count: accepted.length })
      .eq("id", batch.id);
  }

  await writeAudit({
    actor: { id: null, role: "admin", email: "order-engine@254engineering.com" },
    action: "batch.placed",
    entityType: "order_batch",
    entityId: batch.id as string,
    summary: `${reference}: ${accepted.length} of ${input.properties.length} properties taken, ${money(
      split.totalCents,
    )}, ${billingMode === "invoice" ? "on account" : "awaiting payment"}`,
  });

  return {
    ok: true,
    batchId: batch.id as string,
    reference,
    accepted,
    rejected: [...split.rejected.map((r) => ({ ref: r.ref, reason: r.reason })), ...failures],
    totalCents: split.totalCents,
    billingMode,
    duplicate: false,
  };
}

/**
 * What an account owes, split into what has been billed and what has not.
 *
 * Unbilled work counts. An account that has placed nine thousand dollars of
 * orders this month and not yet reached period close owes that money whether or
 * not a statement exists, and a credit limit that ignored it would be no limit
 * at all until the first of the month.
 */
export async function accountBalance(accountId: string): Promise<{
  issuedUnpaidCents: number | null;
  unbilledCents: number | null;
  outstandingCents: number | null;
  oldestUnpaidDays: number | null;
}> {
  const db = supabaseAdmin();
  if (!db) return { issuedUnpaidCents: null, unbilledCents: null, outstandingCents: null, oldestUnpaidDays: null };

  const { data: statements, error: sErr } = await db
    .from("eng_statements")
    .select("total_cents, due_at")
    .eq("account_id", accountId)
    .eq("status", "issued");

  const { data: unbilled, error: uErr } = await db
    .from("eng_service_orders")
    .select("total_cents")
    .eq("account_id", accountId)
    .eq("billing_mode", "invoice")
    .is("statement_id", null)
    .in("status", ["paid", "in_fulfilment", "complete"]);

  /*
   * A failed read is unknown, not zero. creditDecision refuses on an unknown
   * balance rather than assuming the flattering direction, which is what makes
   * reporting it honestly here worth doing.
   */
  if (sErr || uErr) {
    return { issuedUnpaidCents: null, unbilledCents: null, outstandingCents: null, oldestUnpaidDays: null };
  }

  const issuedUnpaidCents = (statements ?? []).reduce((n, s) => n + Number(s.total_cents ?? 0), 0);
  const unbilledCents = (unbilled ?? []).reduce((n, o) => n + Number(o.total_cents ?? 0), 0);

  let oldestUnpaidDays: number | null = null;
  for (const s of statements ?? []) {
    if (!s.due_at) continue;
    const days = Math.floor((Date.now() - Date.parse(s.due_at as string)) / (24 * 60 * 60 * 1000));
    if (days > 0 && (oldestUnpaidDays === null || days > oldestUnpaidDays)) oldestUnpaidDays = days;
  }

  return {
    issuedUnpaidCents,
    unbilledCents,
    outstandingCents: issuedUnpaidCents + unbilledCents,
    oldestUnpaidDays,
  };
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function batchReference(): string {
  let tail = "";
  for (let i = 0; i < 6; i += 1) {
    tail += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `254-B${new Date().getFullYear()}-${tail}`;
}
