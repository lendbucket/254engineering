import "server-only";
import { DB_NOW } from "./db-now";
import { readEvery, readEveryIn } from "./bounded-read";
import { supabaseAdmin } from "./supabase";
import { tradePriceInForce } from "./trade-pricing";
import { catalogFor, type CatalogEntry } from "@data/catalog";
import { launchMode } from "./launch";
import { orderBlockedNow } from "./line-gate";
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

/**
 * What the customer is shown before they commit. Writes nothing.
 *
 * THE AGREED PRICE IS SHOWN IN THE PREVIEW OR THE PREVIEW IS A DIFFERENT
 * NUMBER FROM THE BILL.
 *
 * Phase 13 Section 2. A trade price honoured at checkout and not in the preview
 * is the same defect as one honoured at checkout and not on the statement: the
 * customer agrees to one figure and is charged another, and the direction
 * happens to be in their favour here, which makes it harder to notice rather
 * than less wrong.
 */
export async function previewBatch(
  serviceSlug: string,
  tier: string | undefined,
  properties: BulkProperty[],
  agreedPriceCents?: number | null,
): Promise<{ ok: true; entry: CatalogEntry; split: BatchSplit } | { ok: false; error: string }> {
  const entry = catalogFor(serviceSlug, tier);
  if (!entry) {
    return { ok: false, error: "That service does not sell a single deliverable. Choose which one." };
  }

  /* A MONEY DOOR, ruling 11: the engineer's signed record is read before a batch is priced. */
  const blocked = await orderBlockedNow(entry, launchMode());
  if (blocked) return { ok: false, error: blocked };

  return { ok: true, entry, split: splitBatch(entry, properties, twiaSet(), agreedPriceCents ?? null) };
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
  const { data: existing, error: existingError } = await db
    .from("eng_order_batches")
    .select("id, reference, total_cents, status, account_id")
    .eq("client_request_id", input.clientRequestId)
    .maybeSingle();
  if (existingError) {
    return { ok: false, error: `Whether this submission was already received could not be read, so nothing was placed: ${existingError.message}` };
  }

  if (existing) {
    /*
     * THE KEY IS MATCHED ACROSS EVERY ACCOUNT, SO THE ANSWER IS ONLY EVER THIS
     * ACCOUNT'S OWN BATCH. Robert's audit of 2026-10-24, finding F5. The unique
     * index on client_request_id is global (0009), and a second account or API
     * client sending a key another account had used got that account's batch
     * back, references, shares and total, and the routes then opened checkout
     * on it with the first account's addresses on the Stripe page. Refused
     * here, naming nothing about the other batch.
     */
    if (existing.account_id !== input.accountId) {
      return {
        ok: false,
        error: "That submission key has already been used. Send this submission with a new key; nothing was placed.",
      };
    }
    const { data: orders, error: ordersError } = await db
      .from("eng_service_orders")
      .select("id, reference, batch_share_cents, billing_mode")
      .eq("batch_id", existing.id);
    if (ordersError) {
      return { ok: false, error: `This submission was already received, and its orders could not be read just now: ${ordersError.message}` };
    }
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
      /* The batch's own mode, read off its orders, not assumed to be card. */
      billingMode: (orders ?? []).some((o) => o.billing_mode === "invoice") ? "invoice" : "card",
      duplicate: true,
    };
  }

  /*
   * The compliance gate, before an order exists rather than after. A batch
   * created and then refused would leave rows for work the firm cannot lawfully
   * take, ten at a time.
   */
  /*
   * THE AGREED PRICE, LOOKED UP WHERE THE ACCOUNT IS KNOWN.
   *
   * Fetched here rather than inside splitBatch, which is pure and synchronous:
   * a database read in there would make every caller async to serve one of
   * them, including the preview the site renders.
   *
   * Null when this account has no agreed price for this deliverable, and null
   * is not zero: quoteFor then uses the published price, which is what an
   * account without an agreement pays.
   */
  const agreed = await tradePriceInForce(input.accountId, input.serviceSlug, input.tier ?? "standard");

  const preview = await previewBatch(input.serviceSlug, input.tier, input.properties, agreed);
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
    /* No new work is placed on a superseded account. See account-scope. */
    .is("superseded_at", null)
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
      placed_at: DB_NOW,
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
      /* The agreed price is the order's price (F3, Robert's answer of 2026-10-25), so its total is the share it is charged. */
      agreedPriceCents: agreed,
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

    /*
     * THE LINK IS CHECKED (audit finding F4, 2026-10-24). Its result was
     * discarded, so an order whose link failed was still counted as accepted
     * and charged in the batch, carrying no batch, no account, no share and the
     * default billing mode. A failed link is a failure for this property, the
     * same as a refused placeOrder.
     */
    const { data: linked, error: linkError } = await db
      .from("eng_service_orders")
      .update({
        batch_id: batch.id,
        account_id: input.accountId,
        batch_share_cents: item.priceCents,
        billing_mode: billingMode,
      })
      .eq("id", result.orderId)
      .select("id");
    if (linkError || !linked || linked.length !== 1) {
      failures.push({
        ref: item.ref,
        reason: `The order was created and could not be joined to this submission: ${linkError?.message ?? "no row was updated"}`,
      });
      continue;
    }

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
    await db.from("eng_order_batches").update({ status: "cancelled", cancelled_at: DB_NOW }).eq("id", batch.id);
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

  /*
   * BOTH PAGED, BECAUSE THIS IS THE CREDIT GATE.
   *
   * These two figures decide whether an account may place another order on
   * invoice. Truncating either makes the exposure read LOW, which is the
   * direction that grants credit past the limit rather than refusing it, so
   * the failure is silent and expensive rather than loud and safe.
   */
  const statementRead = await readEvery<{ total_cents: number | null; due_at: string | null }>((from, to) =>
    db
      .from("eng_statements")
      .select("total_cents, due_at")
      .eq("account_id", accountId)
      .eq("status", "issued")
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  // readEvery: exposure that reads low grants credit, so it may never be partial.
  const unbilledRead = await readEvery<{ total_cents: number | null }>((from, to) =>
    db
      .from("eng_service_orders")
      .select("total_cents")
      .eq("account_id", accountId)
      .eq("billing_mode", "invoice")
      .is("statement_id", null)
      .in("status", ["paid", "in_fulfilment", "complete"])
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  const statements = statementRead.ok ? statementRead.rows : null;
  const sErr = statementRead.ok ? null : { message: statementRead.error };
  const unbilled = unbilledRead.ok ? unbilledRead.rows : null;
  const uErr = unbilledRead.ok ? null : { message: unbilledRead.error };

  /*
   * A failed read is unknown, not zero. creditDecision refuses on an unknown
   * balance rather than assuming the flattering direction, which is what makes
   * reporting it honestly here worth doing.
   */
  if (sErr || uErr) {
    return { issuedUnpaidCents: null, unbilledCents: null, outstandingCents: null, oldestUnpaidDays: null };
  }

  return balanceFrom(statements ?? [], unbilled ?? []);
}

/**
 * Turn one account's rows into its balance.
 *
 * EXTRACTED 2026-09-24 SO THE BULK READER CANNOT DISAGREE WITH THE SINGLE ONE.
 * `accountRows` used to call `accountBalance` once per account, which is two
 * sequential round trips each and was 529 accounts' worth of them. Reading in
 * bulk is the fix; reimplementing the arithmetic in the bulk path would have
 * been the defect, because this is the credit gate and a second account of it
 * is a second answer to whether somebody may order on invoice.
 *
 * So there is one reader per shape and ONE computation, here. Both callers feed
 * it the same two row sets.
 */
export function balanceFrom(
  statements: readonly { total_cents: number | null; due_at: string | null }[],
  unbilled: readonly { total_cents: number | null }[],
  now: number = Date.now(),
): {
  issuedUnpaidCents: number | null;
  unbilledCents: number | null;
  outstandingCents: number | null;
  oldestUnpaidDays: number | null;
} {
  const issuedUnpaidCents = statements.reduce((n, s) => n + Number(s.total_cents ?? 0), 0);
  const unbilledCents = unbilled.reduce((n, o) => n + Number(o.total_cents ?? 0), 0);

  let oldestUnpaidDays: number | null = null;
  for (const s of statements) {
    if (!s.due_at) continue;
    const days = Math.floor((now - Date.parse(s.due_at)) / (24 * 60 * 60 * 1000));
    if (days > 0 && (oldestUnpaidDays === null || days > oldestUnpaidDays)) oldestUnpaidDays = days;
  }

  return {
    issuedUnpaidCents,
    unbilledCents,
    outstandingCents: issuedUnpaidCents + unbilledCents,
    oldestUnpaidDays,
  };
}

/**
 * Every account's balance, in chunked reads rather than two per account.
 *
 * WHY IT RETURNS A RESULT RATHER THAN A MAP. A failed read here must not become
 * a zero balance: `creditDecision` refuses on an UNKNOWN balance and grants on a
 * zero one, so the two differ by whether the firm extends credit it did not mean
 * to. The single-account version already returns nulls on failure for exactly
 * that reason, and this is the same rule at the set level.
 */
export async function accountBalances(
  ids: readonly string[],
): Promise<
  | { ok: true; balances: Map<string, ReturnType<typeof balanceFrom>> }
  | { ok: false; error: string }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so no balance could be read." };

  const statementRead = await readEveryIn<{ account_id: string; total_cents: number | null; due_at: string | null }>(
    ids,
    (chunk, from, to) =>
      db
        .from("eng_statements")
        .select("account_id, total_cents, due_at")
        .in("account_id", chunk as string[])
        .eq("status", "issued")
        .order("created_at", { ascending: true })
        .range(from, to),
  );
  if (!statementRead.ok) return { ok: false, error: `Issued statements: ${statementRead.error}` };

  const unbilledRead = await readEveryIn<{ account_id: string; total_cents: number | null }>(
    ids,
    (chunk, from, to) =>
      db
        .from("eng_service_orders")
        .select("account_id, total_cents")
        .in("account_id", chunk as string[])
        .eq("billing_mode", "invoice")
        .is("statement_id", null)
        .in("status", ["paid", "in_fulfilment", "complete"])
        .order("created_at", { ascending: true })
        .range(from, to),
  );
  if (!unbilledRead.ok) return { ok: false, error: `Unbilled orders: ${unbilledRead.error}` };

  const statementsBy = new Map<string, { total_cents: number | null; due_at: string | null }[]>();
  for (const s of statementRead.rows) {
    statementsBy.set(s.account_id, [...(statementsBy.get(s.account_id) ?? []), s]);
  }
  const unbilledBy = new Map<string, { total_cents: number | null }[]>();
  for (const o of unbilledRead.rows) {
    unbilledBy.set(o.account_id, [...(unbilledBy.get(o.account_id) ?? []), o]);
  }

  const balances = new Map<string, ReturnType<typeof balanceFrom>>();
  for (const id of ids) {
    balances.set(id, balanceFrom(statementsBy.get(id) ?? [], unbilledBy.get(id) ?? []));
  }
  return { ok: true, balances };
}

/**
 * EVERY ACCOUNT'S BALANCE, READ WITHOUT AN ID FILTER. The accounts list,
 * Robert's answer 4 of 2026-10-28.
 *
 * accountBalances(ids) passes every id through chunked `.in()` reads: one round
 * trip per 150 accounts, twice, one after another. Board 40733329479 timed that
 * at 4.6 to 5.2 seconds over about 3,020 accounts, for a screen that needs the
 * credit verdict of EVERY account (the warning above the list names every
 * account that cannot order) and shows fifty.
 *
 * The two row sets it reads are issued statements and unbilled invoiced orders.
 * Their size is the firm's OUTSTANDING work, not its number of accounts, so
 * reading them whole and grouping by account gives each account exactly the
 * input accountBalances builds for it, in two paged reads. The arithmetic is
 * balanceFrom, unchanged, so there is still one answer to whether somebody may
 * order on invoice. An account with neither gets balanceFrom([], []), which is
 * what accountBalances gives it too.
 */
export async function openBalancesForEveryAccount(): Promise<
  | { ok: true; balanceOf: (accountId: string) => ReturnType<typeof balanceFrom>; rowsRead: number }
  | { ok: false; error: string }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so no balance could be read." };

  const [statementRead, unbilledRead] = await Promise.all([
    readEvery<{ account_id: string; total_cents: number | null; due_at: string | null }>((from, to) =>
      db
        .from("eng_statements")
        .select("account_id, total_cents, due_at")
        .eq("status", "issued")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readEvery<{ account_id: string | null; total_cents: number | null }>((from, to) =>
      db
        .from("eng_service_orders")
        .select("account_id, total_cents")
        .not("account_id", "is", null)
        .eq("billing_mode", "invoice")
        .is("statement_id", null)
        .in("status", ["paid", "in_fulfilment", "complete"])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);
  if (!statementRead.ok) return { ok: false, error: `Issued statements: ${statementRead.error}` };
  if (!unbilledRead.ok) return { ok: false, error: `Unbilled orders: ${unbilledRead.error}` };

  const statementsBy = new Map<string, { total_cents: number | null; due_at: string | null }[]>();
  for (const s of statementRead.rows) {
    statementsBy.set(s.account_id, [...(statementsBy.get(s.account_id) ?? []), s]);
  }
  const unbilledBy = new Map<string, { total_cents: number | null }[]>();
  for (const o of unbilledRead.rows) {
    const id = o.account_id as string;
    unbilledBy.set(id, [...(unbilledBy.get(id) ?? []), o]);
  }
  const now = Date.now();
  return {
    ok: true,
    balanceOf: (accountId) => balanceFrom(statementsBy.get(accountId) ?? [], unbilledBy.get(accountId) ?? [], now),
    rowsRead: statementRead.rows.length + unbilledRead.rows.length,
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
