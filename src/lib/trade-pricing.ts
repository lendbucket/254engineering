import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { readEvery } from "./bounded-read";
import { CATALOG } from "@data/catalog";
import { floorFor, floorKey, type TradeFloor } from "@/config/trade-floors";
import { refundDisclosure } from "./ops-orders";

/**
 * TRADE PRICING: A PRICE AN ACCOUNT IS QUOTED, AND THE FLOOR IT MAY NOT CROSS.
 *
 * The operator's rule, and every refusal below is one clause of it:
 *
 *   "A floor is a decision about money, so it is mine. Where I have not given
 *    one, the platform refuses to quote a trade price on that service and says
 *    why. It never derives a floor from cost, never falls back to the catalogue
 *    price, never treats absent as zero, and never lets an operator supply one
 *    at quote time."
 *
 * WHAT DOES NOT EXIST HERE, AND THE ABSENCES ARE THE DESIGN
 * ---------------------------------------------------------
 * There is no parameter for a floor, no parameter for an override, no role that
 * skips the check, and no branch that reaches for the catalogue price when a
 * floor is absent. Each of those would be a way to sell below a number the
 * operator set, arriving as a convenience.
 *
 * The catalogue price is never a fallback FLOOR. It is what the public pays,
 * and a trade price is by definition below it; treating it as the floor would
 * make trade pricing impossible while looking like a safety measure.
 *
 * ABSENT IS NOT ZERO. A deliverable with no floor refuses every price, at any
 * value, including zero and including the catalogue price. `pending` is a state
 * the platform behaves correctly in rather than an error to route around.
 */

export type TradePrice = {
  id: string;
  accountId: string;
  serviceSlug: string;
  tier: string;
  priceCents: number;
  floorCentsAtTime: number;
  setByEmail: string;
  createdAt: string;
  supersededAt: string | null;
};

export type SetPriceResult =
  | { ok: true; id: string; supersededId: string | null }
  | { ok: false; error: string };

/**
 * Why this deliverable cannot be trade priced, or null when it can.
 *
 * Separated from the setter so the SCREEN can ask before the operator types.
 * The operator's brief: "Setting a price shows the floor before the operator
 * types, not after they are refused." A refusal a person meets only after
 * filling in a form is a refusal that reads as the platform being broken.
 */
export function tradePricingRefusal(serviceSlug: string, tier: string): string | null {
  const floor = floorFor(serviceSlug, tier);

  /*
   * NULL IS NOT PENDING. Null means trade-floors.ts has never heard of this
   * deliverable, which is a drift the board fails on. Treating it as pending
   * would let a catalogue addition acquire the right behaviour for the wrong
   * reason, and the day somebody fixed the drift the behaviour would change
   * with no edit to explain it.
   */
  if (!floor) {
    return `${floorKey(serviceSlug, tier)} is not declared in the trade floor register, so no trade price can be set for it. That is a drift between the catalogue and the register rather than a decision, and the board fails on it.`;
  }

  if (floor.state === "pending") return floor.because;

  /*
   * AND THE REFUND TERMS MUST BE STATEABLE.
   *
   * Operator's rule: "Every quoted trade price carries its refund disclosure
   * and inspection fee, the same gate both order doors pass through. A trade
   * price that cannot state its refund terms cannot be quoted."
   *
   * refundDisclosure() is computed from the catalogue entry and, for a field
   * order, NAMES THE INSPECTION FEE AS A FIGURE. Where that fee is unknown it
   * writes "an inspection fee is retained. That fee is not published yet",
   * which is a sentence the firm must not put beside a negotiated price: the
   * customer would be agreeing to a retention nobody has stated.
   */
  const entry = CATALOG.find((e) => e.serviceSlug === serviceSlug && e.tier === tier);
  if (!entry) {
    return `${floorKey(serviceSlug, tier)} has a floor and is not in the catalogue, so there is nothing to price.`;
  }
  if (entry.orderType === "field" && entry.inspectionFeeCents === null) {
    return "This is a field service with no published inspection fee, so its refund terms cannot be stated. A trade price that cannot state what is retained on a decline cannot be quoted.";
  }

  return null;
}

/** The floor, for a screen to show BEFORE anybody types. Null when pending. */
export function floorCentsFor(serviceSlug: string, tier: string): number | null {
  const floor = floorFor(serviceSlug, tier);
  return floor && floor.state === "set" ? floor.floorCents : null;
}

/** The whole register, joined to the catalogue, for the screen. */
export function tradePricingBoard(): {
  serviceSlug: string;
  tier: string;
  name: string;
  catalogueCents: number | null;
  floor: TradeFloor | null;
  refusal: string | null;
}[] {
  return CATALOG.map((e) => ({
    serviceSlug: e.serviceSlug,
    tier: e.tier,
    name: e.name,
    catalogueCents: e.priceCents,
    floor: floorFor(e.serviceSlug, e.tier),
    refusal: tradePricingRefusal(e.serviceSlug, e.tier),
  }));
}

/**
 * Set a trade price, superseding whatever was in force.
 *
 * THE REFUSAL NAMES THE FLOOR AND ITS REASON, which is the operator's own
 * wording: "Below the floor is refused, loudly, naming the floor and its
 * reason." A refusal that says only "too low" sends somebody to ask a person
 * what the number is, and the person they ask is the operator.
 */
export async function setTradePrice(input: {
  accountId: string;
  serviceSlug: string;
  tier: string;
  priceCents: number;
  actor: { id: string; email: string; role: string };
}): Promise<SetPriceResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const refusal = tradePricingRefusal(input.serviceSlug, input.tier);
  if (refusal) return { ok: false, error: refusal };

  const floor = floorFor(input.serviceSlug, input.tier);
  /* Narrowing only. tradePricingRefusal has already refused every other state. */
  if (!floor || floor.state !== "set") {
    return { ok: false, error: "No floor is set for this deliverable." };
  }

  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
    return { ok: false, error: "A trade price is a whole number of cents above zero." };
  }

  /*
   * AT THE FLOOR IS ALLOWED. BELOW IT IS NOT, AT ANY ROLE.
   *
   * Stated as `< floor` rather than `<= floor` deliberately and asserted both
   * ways by the audit: a floor nobody may price AT is a floor one cent higher
   * than the one the operator ruled, which is the platform quietly editing a
   * decision about money.
   */
  if (input.priceCents < floor.floorCents) {
    return {
      ok: false,
      error:
        `${money(input.priceCents)} is below the floor for this service. The floor is ${money(floor.floorCents)}, ` +
        `ruled by ${floor.by} on ${floor.on}: ${floor.because} ` +
        `There is no override. If the floor should change, the floor changes.`,
    };
  }

  /*
   * ======================================================================
   * ONE STATEMENT, BECAUSE NEITHER ORDER WORKS FROM OUTSIDE A TRANSACTION.
   * ======================================================================
   *
   * The first version read the row in force, inserted the new one, then
   * superseded the old one. The reasoning written here was that inserting first
   * kept a price in force at every instant, and that superseding first would
   * leave a window in which a quote silently used the catalogue price.
   *
   * The reasoning was right and the order was impossible. 0045 puts a partial
   * unique index on (account_id, service_slug, tier) where superseded_at is
   * null, so the second in-force row is refused and supersession never happened
   * at all. trade-pricing-audit reported it as the application colliding with
   * ITSELF:
   *
   *   FAIL: a second price supersedes the first
   *     (Somebody set a price for this service a moment ago.)
   *
   * PostgREST gives one statement at a time, so the two writes can only be made
   * atomic by BEING one statement. 0047 is that statement, and inside a
   * transaction the ordering that was impossible across two requests is simply
   * correct: the index is checked at statement end, the two rows are never both
   * visible, and there is no window.
   *
   * IT DOES NOT CHECK THE FLOOR. That happened above, in TypeScript, where the
   * refusal can name who ruled the floor and why. The row's own check
   * constraint still holds on the insert the function performs, so nothing it
   * writes can be below the floor it was checked against.
   */
  const { data: written, error } = await db.rpc("eng_set_trade_price", {
    p_account_id: input.accountId,
    p_service_slug: input.serviceSlug,
    p_tier: input.tier,
    p_price_cents: input.priceCents,
    p_floor_cents_at_time: floor.floorCents,
    p_set_by_profile_id: input.actor.id,
    p_set_by_email: input.actor.email,
  });

  const row = Array.isArray(written) ? written[0] : written;
  if (error || !row?.new_id) {
    return { ok: false, error: error?.message ?? "The price could not be recorded." };
  }

  const inForce = row.superseded_id ? { id: row.superseded_id as string } : null;

  await writeAudit({
    actor: input.actor,
    action: "trade_price.set",
    entityType: "customer_account",
    entityId: input.accountId,
    summary:
      `Trade price for ${floorKey(input.serviceSlug, input.tier)} set to ${money(input.priceCents)}` +
      (inForce ? ", superseding the previous one." : "."),
    diff: {
      service: floorKey(input.serviceSlug, input.tier),
      priceCents: input.priceCents,
      floorCents: floor.floorCents,
      superseded: inForce?.id ?? null,
    },
  });

  return { ok: true, id: row.new_id as string, supersededId: inForce?.id ?? null };
}

/**
 * The price in force for an account and deliverable, or null.
 *
 * readAll is wrong here and readEvery is unnecessary: this is ONE row by
 * construction, guarded by a partial unique index on (account_id, service_slug,
 * tier) where superseded_at is null. maybeSingle is the honest shape, and if
 * two ever existed it would throw rather than silently pick one.
 */
export async function tradePriceInForce(
  accountId: string,
  serviceSlug: string,
  tier: string,
): Promise<number | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data } = await db
    .from("eng_account_trade_prices")
    .select("price_cents")
    .eq("account_id", accountId)
    .eq("service_slug", serviceSlug)
    .eq("tier", tier)
    .is("superseded_at", null)
    .maybeSingle();

  return (data?.price_cents as number | undefined) ?? null;
}

/**
 * Every trade price an account has ever had, newest first.
 *
 * readEvery, NOT readAll. This is the history a superseded price is recovered
 * from, and the question it answers is "what was this account quoted, and
 * when". A page boundary silently dropping the oldest rows would answer that
 * question wrongly for exactly the orders furthest in the past, which are the
 * ones somebody is asking about when they open this at all.
 */
export async function tradePriceHistory(accountId: string): Promise<TradePrice[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_account_trade_prices")
      .select("id, account_id, service_slug, tier, price_cents, floor_cents_at_time, set_by_email, created_at, superseded_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .range(from, to),
  );

  /*
   * A FAILED READ RETURNS EMPTY AND THAT IS WRONG HERE, SO IT THROWS.
   *
   * readEvery reports { ok: false } when a page errors. Returning [] would tell
   * the screen this account has never had a trade price, which is
   * indistinguishable from the truth for a NEW account and completely wrong for
   * an old one. mfaStateFor makes the same choice for the same reason: a failed
   * read is not an absence, and reporting it as one is the permissive direction.
   */
  if (!read.ok) throw new Error(`The trade price history could not be read: ${read.error}`);

  return read.rows.map((r) => ({
    id: r.id as string,
    accountId: r.account_id as string,
    serviceSlug: r.service_slug as string,
    tier: r.tier as string,
    priceCents: r.price_cents as number,
    floorCentsAtTime: r.floor_cents_at_time as number,
    setByEmail: r.set_by_email as string,
    createdAt: r.created_at as string,
    supersededAt: (r.superseded_at as string | null) ?? null,
  }));
}

/**
 * The refund disclosure a trade priced order must carry.
 *
 * The SAME function both order doors use, deliberately. A second disclosure
 * generator for trade orders is a second answer to "what happens to my money if
 * the engineer declines", and the two would drift within a phase.
 */
export function tradeRefundDisclosure(serviceSlug: string, tier: string): string | null {
  const entry = CATALOG.find((e) => e.serviceSlug === serviceSlug && e.tier === tier);
  if (!entry) return null;
  return refundDisclosure(entry).join("\n\n");
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
