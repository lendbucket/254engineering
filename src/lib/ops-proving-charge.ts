import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { stripeAccount } from "@/config/launch-readiness";
import { deploymentOrigin } from "./site-url";
import { paymentProvider } from "./ops-payments";
import { money } from "./ops-money";

/**
 * =============================================================================
 * THE FIRST LIVE ORDER, AND THE ONE CHARGE THAT OPENS THE GATE.
 * =============================================================================
 *
 * Operator ruling, 2026-09-24: OPTION B, a separate narrow proving path.
 *
 * THE DEADLOCK THIS EXISTS TO BREAK, STATED PLAINLY BECAUSE IT IS EASY TO READ
 * AS A BUG IN THE GATE. `stripe` is one of the nine launch conditions and it
 * reads: "A live Stripe account belonging to 254, proven by a charge and its
 * refund." So the gate cannot open until a charge has been taken, and
 * `chargesBlockedReason()` refuses every charge until the gate opens. The
 * condition requires the act the gate forbids. Nothing is broken; the firm has
 * simply reached the one point where the ordinary path cannot be used.
 *
 * THE FORK, AND WHY B. Three shapes were put to the operator:
 *
 *   A  a bypass flag on placeOrder        one code path, but the ability to
 *                                         create an order without the gate
 *                                         becomes a PARAMETER living in the
 *                                         ordinary path for ever
 *   B  a separate narrow proving path     the capability is isolated, but it
 *                                         is a second way to create an order,
 *                                         which can drift from the real one
 *   C  teach the webhook a proof branch   no order at all, but it changes the
 *                                         money path's event handling
 *
 * B was ruled, on the argument the original design missed: THIS PATH RUNS ONCE,
 * EVER, and disables itself permanently the moment `stripeAccount.proof` is non
 * null. Drift between two order paths accrues over time and this one has no
 * time in which to accrue. A's parameter is permanent.
 *
 * =============================================================================
 * WHAT THE RULING DID NOT COVER, AND THIS IS THE PART TO READ
 * =============================================================================
 *
 * The fork was settled for creating the ORDER, because the gate check sits in
 * `placeOrder`. The CHARGE has the identical deadlock and its own enforcement:
 * `money-audit` reads every function in src/lib whose body reaches
 * `createCheckout(` and requires each to call `chargesBlockedReason()`. It
 * derives that set rather than listing it, deliberately, so a fourth charge
 * path cannot be added without the gate.
 *
 * So option B applied to the order alone would have produced an order nothing
 * could pay. Extending B to the charge is the consistent reading of the ruling
 * rather than a second fork, and it is flagged for confirmation rather than
 * assumed settled.
 *
 * THE EXEMPTION IS NOT AN ALLOWLIST, because the operator has already refused
 * that shape once, in his words: "an allowlist of names is a list somebody
 * grows until the scan checks nothing." money-audit's subject is SHARPENED
 * instead. A charge path is gated when it calls `chargesBlockedReason()` OR
 * `provingChargeBlockers()`, exactly one path may call the second, and that one
 * must read `stripeAccount.proof`, which is what makes it self-closing. All
 * three clauses can fail, and the count is named in the audit's output.
 *
 * =============================================================================
 * THE FOUR CONDITIONS, AND THEY ARE INDEPENDENT ON PURPOSE
 * =============================================================================
 *
 * Each is checked by a different mechanism, so no single mistake opens this.
 *
 *   1  configuration  stripeAccount.proof is null. Once the operator records
 *                     the charge and refund, this path is shut for ever, and
 *                     shutting it costs no code change.
 *   2  authorisation  the actor holds payments.charge, which is admin only.
 *   3  deliberation   PROVING_CHARGE=1 is set in the environment, spelled the
 *                     way ALLOW_PRODUCTION_DB is spelled, so it is a thing
 *                     somebody types on purpose rather than a default.
 *   4  the database   the reference is FIXED, and eng_service_orders.reference
 *                     is `not null unique`. A second proving order is refused
 *                     by Postgres rather than by this file's judgement.
 *
 * The fourth is the strongest because it depends on nobody's care. The other
 * three can all be got wrong by a person; that one cannot.
 *
 * =============================================================================
 * WHAT THIS PATH DOES NOT DO
 * =============================================================================
 *
 * IT DOES NOT WRITE ITS OWN PROOF. The charge id and the refund id are pasted
 * into `stripeAccount.proof` by the operator, because a platform that can set
 * its own gate condition is a gate with one home. The whole point of the
 * condition is that a person looked at Stripe and saw the money move.
 *
 * IT DOES NOT REFUND. `cancelAndRefund` already refunds, refunds are
 * deliberately NOT gated so that money going back keeps working while the gate
 * is shut, and money-audit asserts that. A second refund path here would be a
 * capability nobody asked for.
 *
 * IT TAKES NO AMOUNT FROM THE REQUEST. The amount is a constant in this file.
 */

/**
 * THE REFERENCE, FIXED, WHICH IS CONDITION FOUR.
 *
 * It carries the DEMO segment because 0027's check constraint is two
 * directional: `(reference like '%-DEMO-%') = is_demo`. A proving order is not
 * revenue and must reach no figure, so is_demo is true, and the constraint then
 * REQUIRES this spelling rather than merely permitting it.
 */
export const PROVING_REFERENCE = "254-O2026-DEMO-PROOF";

/**
 * A DOLLAR, IN SOURCE, NEVER FROM A REQUEST.
 *
 * Large enough to clear Stripe's fifty cent minimum, small enough that the
 * worst case of every guard failing at once is a dollar moved and returned.
 * The figure the operator records in `stripeAccount.proof.amountCents` must
 * equal this, and the launch screen shows both.
 */
export const PROVING_AMOUNT_CENTS = 100;

/** The environment switch, condition three. Compared exactly, as the db guard is. */
const PROVING_SWITCH = "PROVING_CHARGE";

/**
 * Every unmet condition, as a sentence, in the order a reader should meet them.
 *
 * A LIST RATHER THAN A BOOLEAN, for the reason `launchBlockers()` is a list: a
 * false tells somebody they are refused and a sentence tells them what to do,
 * and this path is used exactly once by exactly one person who will not have
 * read this file recently.
 *
 * It is exported because the route, the checkout and the audit all ask it, and
 * three copies of four conditions would be three answers that can disagree.
 */
export function provingChargeBlockers(actor: Actor | null): string[] {
  const blockers: string[] = [];

  if (stripeAccount.proof !== null) {
    blockers.push(
      `The proving charge has already been taken and recorded in stripeAccount.proof on ${stripeAccount.proof.on}. This path is closed permanently and needs no code change to keep it closed.`,
    );
  }

  if (!can(actor, "payments.charge")) {
    blockers.push("Only somebody holding payments.charge can take the proving charge, which is the operator.");
  }

  if (process.env[PROVING_SWITCH] !== "1") {
    blockers.push(
      `${PROVING_SWITCH} is not set to 1 on this deployment. It is compared exactly, so 0, true and yes are all refusals.`,
    );
  }

  return blockers;
}

type ProvingResult =
  | { ok: true; orderId: string; reference: string; totalCents: number; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Create the one proving order.
 *
 * It asks `provingChargeBlockers` and NOT `orderBlockedReason`, which is the
 * whole of the bypass and is the reason this lives in its own file rather than
 * as a parameter on `placeOrder`. Everything else about the row is ordinary.
 */
export async function placeProvingOrder(actor: Actor | null): Promise<ProvingResult> {
  const blocked = provingChargeBlockers(actor);
  if (blocked.length > 0) return { ok: false, error: blocked.join(" ") };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  /*
   * Condition four is the insert itself, but an existing row is not an error:
   * the operator may be running this a second time because the first charge
   * failed at Stripe. Found first so the answer is the order rather than a
   * unique violation.
   */
  const { data: existing } = await db
    .from("eng_service_orders")
    .select("id, reference, total_cents, status")
    .eq("reference", PROVING_REFERENCE)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      orderId: existing.id as string,
      reference: existing.reference as string,
      totalCents: Number(existing.total_cents),
      duplicate: true,
    };
  }

  const { data: order, error } = await db
    .from("eng_service_orders")
    .insert({
      site: "254engineering",
      reference: PROVING_REFERENCE,
      service_slug: "roof-inspections",
      tier: null,
      order_type: "fixed",
      status: "awaiting_payment",
      is_demo: true,
      customer_name: "254 Engineering, proving charge",
      customer_email: "proving.charge@254engineering.com",
      property_address: "The firm's own office, for a charge that proves the account",
      county: "Nueces",
      twia_county: false,
      price_cents: PROVING_AMOUNT_CENTS,
      total_cents: PROVING_AMOUNT_CENTS,
      /*
       * A REAL SENTENCE RATHER THAN AN EMPTY COLUMN. The telephone door once
       * reached payment with no refund_disclosure and the web door refused
       * exactly that, which is recorded in CLAUDE.md 2c. This door is new and
       * would have repeated it.
       */
      refund_disclosure:
        "This charge exists to prove that the firm's Stripe account can take money and give it back. It is refunded in full, immediately, by the operator, and no engineering work is ordered or performed.",
      placed_at: new Date().toISOString(),
      client_request_id: PROVING_REFERENCE,
    })
    .select("id, reference, total_cents")
    .single();

  if (error || !order) {
    return { ok: false, error: error?.message ?? "The proving order could not be recorded." };
  }

  return {
    ok: true,
    orderId: order.id as string,
    reference: order.reference as string,
    totalCents: Number(order.total_cents),
    duplicate: false,
  };
}

/**
 * Open a checkout for the proving order.
 *
 * THIS IS THE FUNCTION money-audit FINDS. It reaches `createCheckout(` and does
 * NOT call `chargesBlockedReason()`, which is the deadlock being broken, and
 * the audit's sharpened subject is what makes that legible rather than a hole.
 * See the header: exactly one path may do this, it must read
 * `stripeAccount.proof`, and both are asserted.
 */
export async function startProvingCheckout(actor: Actor | null): Promise<{ ok: true; url: string; sessionRef: string } | { ok: false; error: string }> {
  const blocked = provingChargeBlockers(actor);
  if (blocked.length > 0) return { ok: false, error: blocked.join(" ") };

  const placed = await placeProvingOrder(actor);
  if (!placed.ok) return { ok: false, error: placed.error };

  const provider = paymentProvider();
  if (!provider.configured()) {
    return { ok: false, error: "Payments are not configured on this deployment, so no charge can be proved from it." };
  }

  const session = await provider.createCheckout({
    reference: placed.reference,
    orderId: placed.orderId,
    amountCents: PROVING_AMOUNT_CENTS,
    currency: "usd",
    customerEmail: "proving.charge@254engineering.com",
    description: `Proving charge, ${money(PROVING_AMOUNT_CENTS)}, refunded immediately`,
    lines: [{ label: "Proving charge, refunded immediately", amountCents: PROVING_AMOUNT_CENTS }],
    successUrl: `${deploymentOrigin()}/order/${placed.reference}?paid=1`,
    cancelUrl: `${deploymentOrigin()}/order/${placed.reference}?cancelled=1`,
  });

  return { ok: true, url: session.url, sessionRef: session.ref };
}
