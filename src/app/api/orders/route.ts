import { NextResponse, type NextRequest } from "next/server";
import { placeOrder, requestQuote, siteFromKey } from "@/lib/ops-intake";
import { isPrelaunch } from "@/lib/launch";

export const dynamic = "force-dynamic";

/**
 * The order intake API. One door, called server side by all three brands.
 *
 * WHY IT IS NEVER CALLED FROM A BROWSER
 * -------------------------------------
 * The key that authorizes a brand would be in the bundle, and a key in a bundle
 * is a key anybody has. Each site's own server calls this with its own key, so
 * the customer's browser talks to its own origin and nothing more.
 *
 * That also means this route can trust nothing about who the customer is beyond
 * what the calling site sends, which is why ops-intake recomputes the price, the
 * qualification and the county rather than accepting any of them.
 *
 * WHY A 404 FOR A BAD KEY
 * -----------------------
 * Same reasoning as /api/portal/unlock and the outage watcher. An endpoint that
 * says "wrong key" confirms it is an order intake worth attacking. One that
 * behaves like a route that does not exist says nothing.
 *
 * WHAT IT DOES NOT DO YET
 * -----------------------
 * Take money. An order is created at awaiting_payment and nothing charges it.
 * The Stripe leg is the next piece of Phase 7 and needs the test keys that are
 * now on Preview. Until then this route is the whole path from a customer's
 * answers to a file in the portal, minus the till.
 */

const NOWHERE = () => NextResponse.json({ ok: false }, { status: 404 });

type Body = {
  intent?: "order" | "quote";
  clientRequestId?: string;
  serviceSlug?: string;
  customer?: { name?: string; email?: string; phone?: string; company?: string };
  property?: {
    propertyAddress?: string;
    city?: string;
    county?: string;
    postalCode?: string;
  };
  answers?: { qualifierId?: string; optionIndex?: number }[];
  inputs?: Record<string, string>;
  files?: {
    key?: string;
    bucket?: string;
    storageKey?: string;
    contentType?: string;
    byteSize?: number;
  }[];
  brief?: string;
  neededBy?: string;
  attribution?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  const site = siteFromKey(request.headers.get("x-intake-key"));
  if (!site) return NOWHERE();

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "Send a JSON body." }, { status: 400 });

  /*
   * Stated here as well as inside ops-intake. The gate is checked at the point
   * of writing, which is what actually enforces it, and answered here so the
   * calling site gets one clear sentence rather than a per service refusal it
   * has to interpret.
   */
  if (isPrelaunch()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The firm's registration with the Texas Board of Professional Engineers and Land Surveyors is pending. No order can be placed and no payment can be taken until it is active.",
        prelaunch: true,
      },
      { status: 409 },
    );
  }

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

  if (body.intent === "quote") {
    const result = await requestQuote({
      site,
      clientRequestId: body.clientRequestId ?? "",
      serviceSlug: body.serviceSlug ?? "",
      customer: {
        name: body.customer?.name ?? "",
        email: body.customer?.email ?? "",
        phone: body.customer?.phone ?? null,
        company: body.customer?.company ?? null,
      },
      property: body.property,
      answers,
      brief: body.brief ?? "",
      neededBy: body.neededBy ?? null,
      attribution,
    });

    return result.ok
      ? NextResponse.json(result, { status: result.duplicate ? 200 : 201 })
      : NextResponse.json(result, { status: 422 });
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
    site,
    clientRequestId: body.clientRequestId ?? "",
    serviceSlug: body.serviceSlug ?? "",
    customer: {
      name: body.customer?.name ?? "",
      email: body.customer?.email ?? "",
      phone: body.customer?.phone ?? null,
      company: body.customer?.company ?? null,
    },
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

  /*
   * 422 rather than 400 on a refusal, because the request was well formed and
   * the firm declined it. The calling site shows the customer the message, and
   * a disqualification is the flow working rather than an error.
   */
  return result.ok
    ? NextResponse.json(result, { status: result.duplicate ? 200 : 201 })
    : NextResponse.json(result, { status: 422 });
}
