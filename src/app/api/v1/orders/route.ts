import { NextResponse, type NextRequest } from "next/server";
import { verifyApiKey, withinRateLimit, recordApiRequest } from "@/lib/account-api-keys";
import { previewBatch, placeBatch, accountBalance } from "@/lib/ops-bulk";
import { startBatchCheckout } from "@/lib/ops-payments";
import { accountDefaults } from "@/lib/ops-account";
import { supabaseAdmin, SITE_KEY } from "@/lib/supabase";
import { isPrelaunch } from "@/lib/launch";
import type { BulkProperty } from "@/lib/bulk-order";

export const dynamic = "force-dynamic";

/**
 * The ordering API.
 *
 * Documented in docs/ordering-api.md, in this repository, and deliberately not
 * on the public site. It is for a handful of named accounts with a key, not a
 * product anybody can sign up to, and publishing it would invite exactly the
 * traffic the rate limiter exists to survive.
 *
 * WHY IT IS NOT UNDER /api/account
 * --------------------------------
 * That prefix is gated by the customer session cookie in src/proxy.ts. An API
 * caller has a key and no cookie, so a route under that prefix would be refused
 * by the proxy before it ever saw the key. This one authenticates itself.
 *
 * EVERYTHING IS ONE SHAPE: A SUBMISSION OF ONE OR MANY PROPERTIES
 * ---------------------------------------------------------------
 * A single order is a batch of one. Two endpoints would be two code paths for
 * the same act, and the one used less often would be the one that drifted.
 *
 * THE SAME QUALIFICATION AND THE SAME PRICE AS THE WEBSITE
 * --------------------------------------------------------
 * placeBatch is what the browser flow calls, which calls placeOrder, which is
 * what order-audit's 474 checks point at. The API is a second door onto the
 * same room, not a second room.
 */

const ROUTE = "/api/v1/orders";

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
  /*
   * The key first. Everything below it needs to know which organisation this
   * is, and there is no answer that does not come from the key.
   */
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const key = await verifyApiKey(presented);

  if (!key) {
    /*
     * One refusal for an absent key, a malformed key, a wrong key, a revoked key
     * and a suspended account. Distinguishing them would tell somebody holding a
     * revoked key that it was once real.
     *
     * Not recorded, because there is no key to record it against, which is also
     * why an unauthenticated caller cannot fill this table.
     */
    return NextResponse.json({ ok: false, error: "Unauthorised." }, { status: 401 });
  }

  const limit = await withinRateLimit(key);
  if (!limit.ok) {
    await recordApiRequest({ key, route: ROUTE, status: 429 });
    return NextResponse.json(
      {
        ok: false,
        error: `Rate limit reached: ${key.rateLimitPerMinute} requests a minute on this key.`,
      },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const answer = async (status: number, payload: Record<string, unknown>, reference?: string | null) => {
    await recordApiRequest({ key, route: ROUTE, status, reference });
    return NextResponse.json(payload, { status });
  };

  /*
   * The compliance gate, before anything is validated or created. It applies to
   * the API exactly as it applies to the website: no order of any kind while
   * registration is pending.
   */
  if (isPrelaunch()) {
    return answer(409, {
      ok: false,
      error:
        "The firm is not taking orders yet. Registration with the Texas Board of Professional Engineers and Land Surveyors is pending.",
      prelaunch: true,
    });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const serviceSlug = typeof body?.serviceSlug === "string" ? body.serviceSlug : "";
  const tier = typeof body?.tier === "string" && body.tier ? body.tier : undefined;
  const clientRequestId = typeof body?.clientRequestId === "string" ? body.clientRequestId : "";
  const properties = readProperties(body);

  if (!serviceSlug) return answer(400, { ok: false, error: "serviceSlug is required." });
  if (!clientRequestId) {
    return answer(400, {
      ok: false,
      error: "clientRequestId is required. It makes a retry safe: the same value returns the same submission.",
    });
  }
  if (properties.length === 0) {
    return answer(400, { ok: false, error: "properties must contain at least one entry." });
  }

  /*
   * A dry run, so a caller can see which properties the firm will take and what
   * they cost without creating anything. This is what makes the partial failure
   * rule usable from a script: check, then submit what was accepted.
   */
  if (body?.dryRun === true) {
    const preview = previewBatch(serviceSlug, tier, properties);
    if (!preview.ok) return answer(409, { ok: false, error: preview.error });

    return answer(200, {
      ok: true,
      dryRun: true,
      totalCents: preview.split.totalCents,
      accepted: preview.split.accepted.map((a) => ({
        ref: a.ref,
        priceCents: a.priceCents,
        coastalCounty: a.twiaCounty,
      })),
      rejected: preview.split.rejected.map((r) => ({ ref: r.ref, reason: r.reason })),
    });
  }

  const defaults = await accountDefaults(key.accountId);
  const inputs: Record<string, string> = {};
  if (defaults?.accessInstructions) inputs.access_notes = defaults.accessInstructions;
  if (defaults?.preferredUrgency) inputs.account_turnaround_preference = defaults.preferredUrgency;

  /*
   * The customer named on the orders is the ACCOUNT, not a person, because an
   * API call has no signed in human behind it. The billing contact is used when
   * one is set, and the account's own record otherwise.
   */
  const db = supabaseAdmin();
  const { data: account } = db
    ? await db
        .from("eng_customer_accounts")
        .select("id, client_id, billing_email, billing_contact")
        .eq("id", key.accountId)
        .maybeSingle()
    : { data: null };

  const { data: client } = db && account
    ? await db.from("eng_clients").select("name, email").eq("id", account.client_id).maybeSingle()
    : { data: null };

  const customerName = (account?.billing_contact as string) || (client?.name as string) || "Account order";
  const customerEmail = (account?.billing_email as string) || (client?.email as string) || "";

  if (!customerEmail) {
    return answer(409, {
      ok: false,
      error:
        "This account has no billing email and its client record has no email either, so there is nowhere to send the order confirmation. Set one in the account settings.",
    });
  }

  const result = await placeBatch({
    site: SITE_KEY,
    clientRequestId,
    accountId: key.accountId,
    serviceSlug,
    tier,
    customer: { name: customerName, email: customerEmail },
    properties,
    inputs,
  });

  if (!result.ok) {
    return answer(409, { ok: false, error: result.error, rejected: result.rejected ?? [] });
  }

  if (result.billingMode === "invoice") {
    const balance = await accountBalance(key.accountId);
    return answer(
      201,
      {
        ok: true,
        reference: result.reference,
        billingMode: "invoice",
        totalCents: result.totalCents,
        accepted: result.accepted.map((a) => ({ ref: a.ref, reference: a.reference, shareCents: a.shareCents })),
        rejected: result.rejected,
        accountOutstandingCents: balance.outstandingCents,
      },
      result.reference,
    );
  }

  const checkout = await startBatchCheckout(result.batchId);
  if (!checkout.ok) {
    return answer(
      503,
      {
        ok: false,
        error: `${checkout.error} The submission ${result.reference} is saved and waiting to be paid.`,
        reference: result.reference,
      },
      result.reference,
    );
  }

  return answer(
    201,
    {
      ok: true,
      reference: result.reference,
      billingMode: "card",
      totalCents: result.totalCents,
      checkoutUrl: checkout.url,
      accepted: result.accepted.map((a) => ({ ref: a.ref, reference: a.reference, shareCents: a.shareCents })),
      rejected: result.rejected,
    },
    result.reference,
  );
}

/** Nothing is readable here yet, and a GET should say so rather than 404. */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "This endpoint accepts POST only. See docs/ordering-api.md." },
    { status: 405 },
  );
}
