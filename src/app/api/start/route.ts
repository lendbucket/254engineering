import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { fieldErrors, startAskSchema, startCallbackSchema, startEmailPriceSchema } from "@/lib/forms";
import { insertLead } from "@/lib/intake";
import { queueEmail } from "@/lib/ops-jobs";
import { callbackRequested, leadNotification } from "@/lib/email-templates";
import { partnerForVisitor, VISITOR_COOKIE } from "@/lib/ops-partners";
import { withSaveOutcome } from "@/lib/save-outcome";
import { PUBLIC_FORM_REFUSAL, takePublicFormAttempt } from "@/lib/public-form-limits";
import { adClickOfRequest } from "@/lib/ad-click-server";
import { isAdClick } from "@/lib/ad-click";
import { callbackDueAt, letterOf, officeIsOpen, quoteFor, type Coastal } from "@/lib/start-finder";
import { startPriceEmails } from "@/lib/price-emails";
import { recordLeadConversion } from "@/lib/ad-conversions";
import { signOrderUpload } from "@/lib/order-uploads";
import { money } from "@/config/prices";
import { business } from "@/config/business";
import { displayPhone } from "@/config/contact";

export const dynamic = "force-dynamic";

/**
 * THE /start FORMS. Robert's add-on of 2026-11-15 for the Google Ads landing
 * page, items 5, 11, 14 and 15.
 *
 *   action "sign"         a signed upload for the photo or PDF the "something
 *                         else" form carries, under eng-uploads leads/<draft>.
 *   form "callback"       a lead; the office is alerted at once, and the call
 *                         falls due now, or at 8 AM Central after 8 PM.
 *   form "email_price"    a lead; the first of the three price emails goes now.
 *   form "start_ask"      a lead with what they were asked for and the file.
 *
 * Every one is a row in eng_leads the office sees in the inbox, with the ad
 * click and the partner the visitor came with. The route follows the lead
 * route's rules (src/app/api/lead/route.ts): the honeypot answers success, the
 * rate limit is taken before anything is written, and a write that did not
 * land is never answered with success.
 *
 * NOTHING THE BROWSER SAYS ABOUT MONEY IS USED. The price saved on the lead,
 * and quoted in the emails, is recomputed here from the price book for the
 * letter and county answer the person chose.
 */
async function handlePOST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  /* ---- the upload signature, before any lead exists */
  if (payload.action === "sign") {
    const draftId = typeof payload.draftId === "string" ? payload.draftId : "";
    const signed = await signOrderUpload({
      draftId,
      inputKey: "report",
      filename: typeof payload.filename === "string" ? payload.filename : "",
      contentType: typeof payload.contentType === "string" ? payload.contentType : "",
      size: typeof payload.size === "number" ? payload.size : 0,
      space: "leads",
    });
    return signed.ok ? NextResponse.json(signed) : NextResponse.json({ ok: false, message: signed.error }, { status: 422 });
  }

  const schema = payload.form === "callback" ? startCallbackSchema : payload.form === "email_price" ? startEmailPriceSchema : payload.form === "start_ask" ? startAskSchema : null;
  if (!schema) return NextResponse.json({ ok: false, message: "Unknown form." }, { status: 400 });
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ ok: false, errors: fieldErrors(parsed.error) }, { status: 422 });
  const data = parsed.data as Record<string, string | undefined> & { form: "callback" | "email_price" | "start_ask" };
  if (data.company) return NextResponse.json({ ok: true });

  /* The rate limit, counted against the typed address, or the phone where there is no address. */
  const who = data.email || (data.phone ?? "").replace(/\D/g, "");
  if (!(await takePublicFormAttempt("start", request.headers, who)).allowed) {
    return NextResponse.json({ ok: false, message: PUBLIC_FORM_REFUSAL }, { status: 429 });
  }

  const click = await adClickOfRequest();
  const partner = await partnerForVisitor((await cookies()).get(VISITOR_COOKIE)?.value);
  const now = new Date();

  /* The quote, recomputed from the price book, never read from the request. */
  const letter = letterOf(data.letter);
  const coastal = (data.coastal ?? null) as Coastal | null;
  const quote = letter ? quoteFor(letter, coastal) : { kind: "none" as const };
  const quotedCents = quote.kind === "fixed" ? quote.totalCents : null;
  const priceLine = quote.kind === "fixed" ? money(quote.totalCents) : quote.kind === "hourly" ? `${money(quote.rateCents)} an hour` : null;

  /* An attachment key is accepted only in the exact shape this route signs, under the draft the form says it used. */
  const attachmentKey =
    data.form === "start_ask" && data.attachmentKey && data.draftId && data.attachmentKey.startsWith(`leads/${data.draftId}/report/`) && /^leads\/[A-Za-z0-9][A-Za-z0-9._-]{0,80}\/report\/[0-9a-f-]{36}\.(pdf|jpg|png|heic|webp)$/.test(data.attachmentKey)
      ? data.attachmentKey
      : null;

  const due = data.form === "callback" ? callbackDueAt(now) : null;
  const write = await insertLead({
    form: data.form,
    name: data.name,
    email: data.email,
    phone: data.phone,
    city: data.city,
    service: letter?.slug,
    message: data.message,
    landingPath: "/start",
    userAgent: request.headers.get("user-agent") ?? undefined,
    partnerId: partner?.partnerId ?? null,
    partnerCode: partner?.code ?? null,
    click,
    quotedService: letter?.slug ?? null,
    quotedCents,
    quotedCoastal: coastal,
    callbackDueAt: due ? due.toISOString() : null,
    attachmentKey,
  });

  if (!write.ok || !write.id) {
    console.error(`[start] write failed (${data.form}): ${write.error}`);
    return NextResponse.json(
      { ok: false, message: `That did not save. Please call ${displayPhone() ?? "the office"} or write to ${business.email}.` },
      { status: 503 },
    );
  }
  const leadId = write.id;

  after(async () => {
    if (data.form === "callback") {
      const queued = await queueEmail(
        callbackRequested({
          name: data.name ?? "Somebody",
          phone: data.phone ?? "",
          letterName: letter?.name ?? null,
          priceLine,
          dueLine: officeIsOpen(now) ? "Due now." : "Asked after 8 PM Central, so it is due at 8 AM.",
          fromAd: isAdClick(click),
          callListUrl: `${business.url}/portal`,
        }),
      );
      if (!queued.ok) console.error(`[start] callback alert not queued: ${queued.error}`);
      await recordLeadConversion("callback", leadId, click);
    } else if (data.form === "email_price") {
      const first = await startPriceEmails(leadId);
      if (!first.sent) console.error(`[start] first price email not sent: ${first.why}`);
      await recordLeadConversion("email_price", leadId, click);
    } else {
      const queued = await queueEmail(
        leadNotification({
          form: "contact",
          name: data.name ?? "",
          email: data.email ?? "",
          phone: data.phone,
          city: data.city,
          service: letter?.name ?? "Something else, or not sure",
          message: `${data.message ?? ""}${attachmentKey ? "\n\nA photo or PDF is attached to the lead in the inbox." : ""}`,
          landingPath: "/start",
        }),
      );
      if (!queued.ok) console.error(`[start] inquiry notification not queued: ${queued.error}`);
      await recordLeadConversion("inquiry", leadId, click);
    }
  });

  return NextResponse.json({ ok: true });
}

export const POST = withSaveOutcome(handlePOST);
