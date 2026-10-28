import { NextResponse, type NextRequest } from "next/server";
import { placeOrder, requestQuote, siteFromKey } from "@/lib/ops-intake";
import { startCheckout } from "@/lib/ops-payments";
import { isOpen, notYetAcceptingEngagements } from "@/lib/launch";
import { withSaveOutcome } from "@/lib/save-outcome";
import { sisterOrderingRefusal } from "@/lib/sister-ordering";
import { SITE_KEY } from "@/lib/supabase";
import { signOrderUpload } from "@/lib/order-uploads";
import { orderStatus, siteOrderRate, type SiteOrderIntent } from "@/lib/sister-order-door";
import { repeatAnswer, siteFileProblem } from "@/lib/sister-order-door-rules";

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
 * IT RETURNS A CHECKOUT URL, AND THE ORDER SURVIVES IF IT CANNOT
 * --------------------------------------------------------------
 * One call places the order and opens a checkout, so the calling site has one
 * round trip and one thing to redirect to.
 *
 * If the checkout cannot be opened, the response still carries the order. The
 * order exists at awaiting_payment, it is visible in the portal, and somebody
 * can send the customer a payment link. Failing the whole request would throw
 * away a completed flow because a payment provider was briefly unreachable,
 * and the customer would have to answer every question again.
 */

const NOWHERE = () => NextResponse.json({ ok: false }, { status: 404 });

type Body = {
  intent?: "order" | "quote" | "upload";
  /* An upload's slot, file name, type and size (intent "upload"). */
  inputKey?: string;
  filename?: string;
  contentType?: string;
  size?: number;
  clientRequestId?: string;
  serviceSlug?: string;
  tier?: string;
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

async function handlePOST(request: NextRequest) {
  const site = siteFromKey(request.headers.get("x-intake-key"));
  if (!site) return NOWHERE();

  /*
   * THE KEY SAYS WHO IS CALLING; THE SWITCH SAYS WHETHER THEY MAY ORDER.
   * Addendum item 10: Sealed ordering stays closed until Sealed uses this door,
   * and a key alone in Vercel must not open it. Answered before the body is
   * read, so a closed site's request is never parsed, priced or written.
   */
  const closed = sisterOrderingRefusal(site, SITE_KEY);
  if (closed) {
    console.error(`[orders] refused: ordering is not open for site "${site}" (src/config/sister-ordering.ts).`);
    return NextResponse.json({ ok: false, error: closed, closed: true }, { status: 409 });
  }

  /*
   * Stated here as well as inside ops-intake. The gate is checked at the point
   * of writing, which is what actually enforces it, and answered here so the
   * calling site gets one clear sentence rather than a per service refusal it
   * has to interpret.
   */
  /*
   * Logged as well as answered, for the same reason the key diagnostics above
   * are: a preview configured to take orders and quietly refusing them looks
   * identical from outside to one nobody configured.
   */
  if (!isOpen()) {
    console.error(
      "[orders] refused: the compliance gate is closed on this deployment. LAUNCH_MODE is not live.",
    );
    return NextResponse.json(
      {
        ok: false,
        error: `${notYetAcceptingEngagements()} No order can be placed and no payment can be taken until it opens for work.`,
        prelaunch: true,
      },
      { status: 409 },
    );
  }

  /*
   * TWENTY REQUESTS A MINUTE PER SITE, COUNTED BEFORE THE BODY IS ACTED ON.
   * Robert's ruling 6 of 2026-10-27 (0100, src/lib/sister-order-door.ts). Read
   * after the switch and the gate, so a closed site or a closed gate writes
   * nothing, and before anything is priced or placed, so a refused request
   * costs a count and nothing else. A body that is not JSON still counts.
   */
  const body = (await request.json().catch(() => null)) as Body | null;
  const intent: SiteOrderIntent = !body
    ? "unreadable"
    : body.intent === "quote"
      ? "quote"
      : body.intent === "upload"
        ? "upload"
        : "order";
  const overRate = await siteOrderRate(site, intent);
  if (overRate) {
    console.error(`[orders] refused for site "${site}" with ${overRate.status}: ${overRate.error}`);
    return NextResponse.json({ ok: false, error: overRate.error }, { status: overRate.status });
  }
  if (!body) return NextResponse.json({ ok: false, error: "Send a JSON body." }, { status: 400 });

  /*
   * THE SIGNED UPLOAD DOOR FOR A SITE'S FILES. Robert's ruling 6 of 2026-10-27.
   * The same machinery as 254's own order flow (signOrderUpload, the private
   * eng-uploads bucket, a PDF to 40 MB and a photograph to 10), keyed on the
   * request's idempotency key under orders/<clientRequestId>/. The calling
   * site's server asks with its key; the customer's browser sends the file
   * straight to the signed URL, which the storage provider expires, so a plan
   * set never passes through a function. The order or quote that follows may
   * attach only files under that same request (siteFileProblem below).
   */
  if (body.intent === "upload") {
    const signed = await signOrderUpload({
      draftId: body.clientRequestId ?? "",
      inputKey: body.inputKey ?? "",
      filename: body.filename ?? "",
      contentType: body.contentType ?? "",
      size: Number(body.size ?? 0),
      space: "orders",
    });
    return signed.ok
      ? NextResponse.json(signed, { status: 200, headers: { "Cache-Control": "no-store" } })
      : NextResponse.json(signed, { status: 422 });
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

  /* Read before the quote branch, which used to return without them: a quote request's files are kept (addendum item 3). */
  const files = (body.files ?? [])
    .filter((f) => typeof f.key === "string" && typeof f.bucket === "string" && typeof f.storageKey === "string")
    .map((f) => ({
      key: f.key as string,
      bucket: f.bucket as string,
      storageKey: f.storageKey as string,
      contentType: f.contentType ?? null,
      byteSize: typeof f.byteSize === "number" ? f.byteSize : null,
    }));

  if (body.intent === "quote") {
    const result = await requestQuote({
      site,
      clientRequestId: body.clientRequestId ?? "",
      serviceSlug: body.serviceSlug ?? "",
      tier: body.tier,
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
      files,
    });

    return result.ok
      ? NextResponse.json(result, { status: result.duplicate ? 200 : 201 })
      : NextResponse.json(result, { status: 422 });
  }

  /*
   * An order may attach only files this door signed for the same request. A
   * quote already refuses anything else inside requestQuote; an order did not,
   * so a key could have named any object in the bucket (ruling 6, the upload
   * door). Refused before anything is placed.
   */
  const fileProblem = siteFileProblem(body.clientRequestId ?? "", files);
  if (fileProblem) return NextResponse.json({ ok: false, error: fileProblem, field: "files" }, { status: 422 });

  const result = await placeOrder({
    site,
    clientRequestId: body.clientRequestId ?? "",
    serviceSlug: body.serviceSlug ?? "",
    tier: body.tier,
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
  if (!result.ok) return NextResponse.json(result, { status: 422 });

  /*
   * A REPEATED REQUEST GETS A CHECKOUT FOR AN UNPAID ORDER. Robert's ruling 6
   * of 2026-10-27: "a fresh checkout returned when a repeated request finds an
   * unpaid order." Until then a duplicate answered with no checkout at all, so
   * a site whose first response was lost had nowhere to send its customer.
   *
   * startCheckout is asked again. The provider's idempotency key is the order
   * (payments-stripe.ts), so inside its window the same live session comes
   * back rather than a second payment page for one order, and after it a new
   * session is opened. Either way the link answers. A paid, canceled or
   * otherwise settled order gets its status and no checkout.
   */
  let checkout: { url: string } | { error: string } | null = null;
  let status: string | null = null;
  if (result.duplicate) {
    status = await orderStatus(result.orderId);
    if (status === null) {
      checkout = { error: "This order's state could not be read just now, so no checkout was opened. Send the request again in a minute." };
    } else if (repeatAnswer(status) === "checkout") {
      const started = await startCheckout(result.orderId);
      checkout = started.ok ? { url: started.url } : { error: started.error };
      if (!started.ok) console.error(`[orders] ${result.reference} repeated and its checkout did not open: ${started.error}`);
    }
  } else {
    const started = await startCheckout(result.orderId);
    checkout = started.ok ? { url: started.url } : { error: started.error };
    if (!started.ok) {
      console.error(`[orders] ${result.reference} placed and its checkout did not open: ${started.error}`);
    }
  }

  return NextResponse.json(
    { ...result, ...(status === null ? {} : { status }), checkout },
    { status: result.duplicate ? 200 : 201 },
  );
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
