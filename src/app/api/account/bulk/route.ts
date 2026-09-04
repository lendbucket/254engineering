import { NextResponse, type NextRequest } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { previewBatch, placeBatch, accountBalance } from "@/lib/ops-bulk";
import { startBatchCheckout } from "@/lib/ops-payments";
import { creditDecision } from "@/lib/account-credit";
import { SITE_KEY } from "@/lib/supabase";
import { accountDefaults } from "@/lib/ops-account";
import type { BulkProperty } from "@/lib/bulk-order";

export const dynamic = "force-dynamic";

/**
 * The bulk submission endpoint.
 *
 * TWO ACTIONS, AND THE FIRST ONE WRITES NOTHING
 * ---------------------------------------------
 * "preview" computes the split and returns it. "submit" computes it again and
 * acts on it. The second computation is authoritative and the first is only
 * what the customer reads.
 *
 * A submission that carried the preview's result as data would let a browser
 * decide which properties were acceptable and what they cost, which is the rule
 * /api/order-flow already follows for a single order. So the properties are
 * sent, and everything about them is worked out here, twice.
 *
 * THE ACCOUNT COMES FROM THE SESSION
 * ----------------------------------
 * Never from the body. There is no field in which to ask, so a signed in
 * customer cannot submit against an organisation that is not theirs.
 */

function readProperties(body: Record<string, unknown> | null): BulkProperty[] {
  const raw = Array.isArray(body?.properties) ? body.properties : [];
  return raw.slice(0, 200).map((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const answers = Array.isArray(o.answers) ? o.answers : [];
    return {
      ref: typeof o.ref === "string" && o.ref.trim() ? o.ref.trim() : `row-${i + 1}`,
      propertyAddress: typeof o.propertyAddress === "string" ? o.propertyAddress : "",
      city: typeof o.city === "string" ? o.city : undefined,
      county: typeof o.county === "string" ? o.county : "",
      postalCode: typeof o.postalCode === "string" ? o.postalCode : undefined,
      answers: answers
        .map((a) => (a ?? {}) as Record<string, unknown>)
        .filter((a) => typeof a.qualifierId === "string" && typeof a.optionIndex === "number")
        .map((a) => ({ qualifierId: a.qualifierId as string, optionIndex: a.optionIndex as number })),
    };
  });
}

export async function POST(request: NextRequest) {
  const me = await currentCustomer();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const serviceSlug = typeof body?.serviceSlug === "string" ? body.serviceSlug : "";
  const tier = typeof body?.tier === "string" && body.tier ? body.tier : undefined;
  const properties = readProperties(body);

  if (!serviceSlug) {
    return NextResponse.json({ ok: false, error: "Choose a service." }, { status: 400 });
  }
  if (properties.length === 0) {
    return NextResponse.json({ ok: false, error: "Add at least one property." }, { status: 400 });
  }

  // ------------------------------------------------------------- preview
  if (action === "preview") {
    const preview = previewBatch(serviceSlug, tier, properties);
    if (!preview.ok) return NextResponse.json({ ok: false, error: preview.error }, { status: 409 });

    /*
     * The credit answer is part of the preview for an invoiced account. Somebody
     * who is over their limit should learn it while they are looking at the
     * list, not after pressing the button that places forty orders.
     */
    let credit: { ok: boolean; message: string } | null = null;
    if (me.account.billingMode === "invoice") {
      const balance = await accountBalance(me.accountId);
      const verdict = creditDecision(
        {
          billingMode: "invoice",
          status: me.account.status,
          creditLimitCents: me.account.creditLimitCents,
          outstandingCents: balance.outstandingCents,
          oldestUnpaidDays: balance.oldestUnpaidDays,
          netDays: me.account.netDays,
        },
        preview.split.totalCents,
      );
      credit = { ok: verdict.ok, message: verdict.message };
    }

    return NextResponse.json({
      ok: true,
      billingMode: me.account.billingMode,
      credit,
      totalCents: preview.split.totalCents,
      accepted: preview.split.accepted.map((a) => ({
        ref: a.ref,
        address: a.property.propertyAddress,
        county: a.property.county,
        priceCents: a.priceCents,
        twiaCounty: a.twiaCounty,
      })),
      rejected: preview.split.rejected.map((r) => ({
        ref: r.ref,
        address: r.property.propertyAddress,
        reason: r.reason,
      })),
    });
  }

  // -------------------------------------------------------------- submit
  if (action === "submit") {
    const clientRequestId = typeof body?.clientRequestId === "string" ? body.clientRequestId : "";
    if (!clientRequestId) {
      return NextResponse.json({ ok: false, error: "A submission needs a key." }, { status: 400 });
    }

    /*
     * The organisation's standing defaults, applied here rather than by the
     * browser. A default the customer's own page filled in would be a default
     * the customer could change without changing the setting, and the operator
     * would have no way to know which orders actually carried it.
     *
     * The standing access instructions become the access_notes input on every
     * order in the batch, and the preferred turnaround is recorded beside them
     * because the catalog does not price urgency. See ops-account for why that
     * one is a preference rather than a commitment.
     */
    const defaults = await accountDefaults(me.accountId);
    const inputs: Record<string, string> = {};
    if (defaults?.accessInstructions) inputs.access_notes = defaults.accessInstructions;
    if (defaults?.preferredUrgency) {
      inputs.account_turnaround_preference = defaults.preferredUrgency;
    }

    const result = await placeBatch({
      site: SITE_KEY,
      clientRequestId,
      accountId: me.accountId,
      serviceSlug,
      tier,
      customer: {
        name: me.displayName,
        email: me.email,
      },
      properties,
      inputs,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, rejected: result.rejected ?? [] },
        { status: 409 },
      );
    }

    /*
     * An invoiced batch is already accepted and the work is released. There is
     * no checkout, and offering one would charge an account that has agreed to
     * be billed.
     */
    if (result.billingMode === "invoice") {
      return NextResponse.json({
        ok: true,
        reference: result.reference,
        accepted: result.accepted.length,
        rejected: result.rejected,
        billingMode: "invoice",
        redirect: `/account/orders/${result.reference}`,
      });
    }

    const checkout = await startBatchCheckout(result.batchId);
    if (!checkout.ok) {
      /*
       * The batch exists and is waiting. Saying so matters: a customer told only
       * "payment failed" would resubmit and place everything twice, and the
       * idempotency key is in their browser, not their head.
       */
      return NextResponse.json(
        {
          ok: false,
          error: `${checkout.error} The submission ${result.reference} is saved and waiting to be paid.`,
          reference: result.reference,
          paymentUnavailable: true,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      reference: result.reference,
      accepted: result.accepted.length,
      rejected: result.rejected,
      billingMode: "card",
      checkoutUrl: checkout.url,
    });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
