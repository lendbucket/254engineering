import { NextResponse, type NextRequest } from "next/server";
import { placeOrder, requestQuote } from "@/lib/ops-intake";
import { startCheckout } from "@/lib/ops-payments";
import { signOrderUpload } from "@/lib/order-uploads";
import { SITE_KEY } from "@/lib/supabase";
import { isPrelaunch } from "@/lib/launch";
import { attributeOrder, VISITOR_COOKIE } from "@/lib/ops-partners";

export const dynamic = "force-dynamic";

/**
 * This site's own order flow, talking to its own server.
 *
 * WHY THIS EXISTS ALONGSIDE /api/orders
 * -------------------------------------
 * /api/orders is the cross brand door: the sister sites call it server to
 * server with a key that proves which brand they are. This site is the brand,
 * running in the same process, so it calls ops-intake directly and its site is
 * SITE_KEY rather than something a request asserted.
 *
 * Routing this site's own flow through the keyed API would mean either shipping
 * the intake key to the browser, which makes it public, or one server calling
 * itself over HTTP to learn something it already knows.
 *
 * WHAT IS TRUSTED HERE: NOTHING
 * -----------------------------
 * ops-intake recomputes the price, re-evaluates the qualifiers and resolves the
 * county whatever this route passes it, so a hand crafted body reaches the same
 * refusals the flow does.
 */

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

type Body = {
  action?: "sign-upload" | "submit";
  draftId?: string;
  inputKey?: string;
  filename?: string;
  contentType?: string;
  size?: number;
  intent?: "order" | "quote";
  serviceSlug?: string;
  tier?: string;
  customer?: { name?: string; email?: string; phone?: string; company?: string };
  property?: { propertyAddress?: string; city?: string; county?: string; postalCode?: string };
  answers?: { qualifierId?: string; optionIndex?: number }[];
  inputs?: Record<string, string>;
  files?: { key?: string; bucket?: string; storageKey?: string; contentType?: string; byteSize?: number }[];
  brief?: string;
  neededBy?: string;
  attribution?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return bad("Send a JSON body.");

  /*
   * The gate is checked here as well as inside ops-intake. Here so the flow can
   * say one clear thing to a person; there because that is where it is actually
   * enforced.
   */
  if (isPrelaunch()) {
    return NextResponse.json(
      {
        ok: false,
        prelaunch: true,
        error:
          "The firm is not taking orders yet. Registration with the Texas Board of Professional Engineers and Land Surveyors is pending.",
      },
      { status: 409 },
    );
  }

  if (body.action === "sign-upload") {
    const signed = await signOrderUpload({
      draftId: body.draftId ?? "",
      inputKey: body.inputKey ?? "",
      filename: body.filename ?? "",
      contentType: body.contentType ?? "",
      size: typeof body.size === "number" ? body.size : 0,
    });
    return signed.ok ? NextResponse.json(signed) : bad(signed.error, 422);
  }

  if (body.action !== "submit") return bad("Unknown action.");
  if (!body.draftId) return bad("This form is missing its draft reference. Reload and try again.");

  const attribution = {
    utmSource: body.attribution?.utm_source ?? null,
    utmMedium: body.attribution?.utm_medium ?? null,
    utmCampaign: body.attribution?.utm_campaign ?? null,
    utmContent: body.attribution?.utm_content ?? null,
    utmTerm: body.attribution?.utm_term ?? null,
    landingPath: body.attribution?.landing_path ?? null,
    referrer: body.attribution?.referrer ?? null,
  };

  const answers = (body.answers ?? [])
    .filter((a) => typeof a.qualifierId === "string" && Number.isInteger(a.optionIndex))
    .map((a) => ({ qualifierId: a.qualifierId as string, optionIndex: a.optionIndex as number }));

  const customer = {
    name: body.customer?.name ?? "",
    email: body.customer?.email ?? "",
    phone: body.customer?.phone ?? null,
    company: body.customer?.company ?? null,
  };

  if (body.intent === "quote") {
    const result = await requestQuote({
      site: SITE_KEY,
      clientRequestId: body.draftId,
      serviceSlug: body.serviceSlug ?? "",
      tier: body.tier,
      customer,
      property: body.property,
      answers,
      brief: body.brief ?? body.inputs?.project ?? body.inputs?.matter ?? "",
      neededBy: body.neededBy ?? null,
      attribution,
    });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }

  const files = (body.files ?? [])
    .filter((f) => typeof f.key === "string" && typeof f.bucket === "string" && typeof f.storageKey === "string")
    .map((f) => ({
      key: f.key as string,
      bucket: f.bucket as string,
      storageKey: f.storageKey as string,
      contentType: f.contentType ?? null,
      byteSize: typeof f.byteSize === "number" ? f.byteSize : null,
    }));

  const result = await placeOrder({
    site: SITE_KEY,
    clientRequestId: body.draftId,
    serviceSlug: body.serviceSlug ?? "",
    tier: body.tier,
    customer,
    property: {
      propertyAddress: body.property?.propertyAddress ?? "",
      city: body.property?.city ?? null,
      county: body.property?.county ?? null,
      postalCode: body.property?.postalCode ?? null,
    },
    answers,
    inputs: body.inputs,
    files,
    attribution,
  });

  if (!result.ok) return bad(result.error, 422);

  /*
   * ATTRIBUTION, BEFORE CHECKOUT AND NEVER AFTER IT.
   *
   * The order exists and is not yet paid, which is the only window in which the
   * attribution columns are writable: 0014's trigger freezes them the moment
   * paid_at is set. Running this after startCheckout would be a race against
   * the customer's own card.
   *
   * It is awaited rather than queued. A partner's earnings hanging on a job
   * that might retry later is the kind of eventual correctness that produces a
   * dispute, and the work here is two reads and one update.
   *
   * It never throws by construction, and a failure to attribute must not fail
   * an order the customer has already completed.
   */
  await attributeOrder({
    orderId: result.orderId,
    reference: result.reference,
    customerEmail: customer.email,
    visitorKey: request.cookies.get(VISITOR_COOKIE)?.value ?? null,
    typedCode: body.attribution?.partner_code ?? null,
  });

  const checkout = await startCheckout(result.orderId);
  if (!checkout.ok) {
    /*
     * The order exists and the customer has not paid. Told plainly rather than
     * dressed up: they have a reference, the firm can see it, and nobody has
     * taken their money.
     */
    return NextResponse.json({
      ok: true,
      reference: result.reference,
      paymentUnavailable: checkout.error,
    });
  }

  return NextResponse.json({ ok: true, reference: result.reference, checkoutUrl: checkout.url });
}
