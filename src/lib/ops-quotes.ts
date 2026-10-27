import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAudit } from "./ops-audit";
import { readEvery } from "./bounded-read";
import { DB_NOW } from "./db-now";
import { launchMode } from "./launch";
import { designQuoteBlocked, orderBlockedNow } from "./line-gate";
import { deskLines } from "@/config/launch-conditions";
import { issueCustomerLink, orderForCustomerToken, placeOrder } from "./ops-intake";
import { canTransitionQuote, convertibleToOrder, refundDisclosure, QUOTE_STATUS_LABEL, type QuoteStatus } from "./ops-orders";
import { startCheckout } from "./ops-payments";
import { queueEmail } from "./ops-jobs";
import { quoteSent } from "./email-templates";
import { money } from "./ops-money";
import { formatInFirmZone } from "./firm-calendar";
import { resolveCounty } from "./ops-counties";
import { business } from "@/config/business";
import { catalogFor } from "@data/catalog";
import {
  hasLapsed,
  parseHoldDays,
  parseQuotePrice,
  quoteOrderRequestId,
  type QuoteRow,
} from "./quote-rules";

/**
 * ===========================================================================
 * QUOTES: PRICED AND SENT BY THE OFFICE, ACCEPTED AND PAID BY THE CUSTOMER.
 * ===========================================================================
 *
 * Robert's addendum of 2026-10-25, 22:46 Central, item 3: "The office prices a
 * quote request and sends it; the customer accepts by a tokened link and pays;
 * it converts with convertibleToOrder. Quote list screen, quote email, expiry."
 *
 * eng_quote_requests has carried this whole pipeline in its columns since 0006
 * and nothing wrote it. Three doors write it now, and each reuses what the
 * platform already has rather than a second copy:
 *
 *   sendQuote    quotes.manage. new or expired moves through scoping, as
 *                QUOTE_TRANSITIONS requires, then to sent with the price, the
 *                scope and the date it lapses. The customer's link is the same
 *                eng_customer_access token every order link is (issueCustomerLink).
 *   declineQuote quotes.manage, with a reason.
 *   acceptQuote  the customer's token. A MONEY DOOR: it reads the signed record
 *                (orderBlockedNow, ruling 11) before anything changes, refuses a
 *                lapsed quote, marks it accepted, converts it through placeOrder
 *                (convertibleToOrder first), and opens the same checkout every
 *                order uses (startCheckout).
 *
 * ONCE, AND ONLY ONCE. The order is placed under one idempotency key per quote
 * (quoteOrderRequestId), so a retried acceptance finds the order it already
 * made; the quote names that order once and the database refuses a second
 * (0098, eng_quote_request_guard, and 0006's unique index). Payment is applied
 * to the order once by the webhook, as for every order.
 */

const COLUMNS =
  "id, created_at, reference, site, service_slug, tier, status, customer_name, customer_email, customer_phone, customer_company, property_address, city, county, brief, needed_by, quoted_cents, scope, sent_at, expires_at, decided_at, decline_reason, converted_order_id, eng_quote_files(count)";

function toRow(r: Record<string, unknown>): QuoteRow {
  const files = r.eng_quote_files as { count: number }[] | null;
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    reference: r.reference as string,
    site: r.site as string,
    serviceSlug: r.service_slug as string,
    tier: (r.tier as string | null) ?? null,
    status: r.status as QuoteStatus,
    customerName: r.customer_name as string,
    customerEmail: r.customer_email as string,
    customerPhone: (r.customer_phone as string | null) ?? null,
    customerCompany: (r.customer_company as string | null) ?? null,
    propertyAddress: (r.property_address as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    county: (r.county as string | null) ?? null,
    brief: (r.brief as string | null) ?? null,
    neededBy: (r.needed_by as string | null) ?? null,
    quotedCents: r.quoted_cents === null || r.quoted_cents === undefined ? null : Number(r.quoted_cents),
    scope: (r.scope as string | null) ?? null,
    sentAt: (r.sent_at as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    decidedAt: (r.decided_at as string | null) ?? null,
    declineReason: (r.decline_reason as string | null) ?? null,
    convertedOrderId: (r.converted_order_id as string | null) ?? null,
    fileCount: files?.[0]?.count ?? 0,
  };
}

export type QuoteRead = { ok: true; rows: QuoteRow[] } | { ok: false; error: string };

/** Every quote request, for the list and its CSV. A failed read is said, never shown as no quotes. */
export async function listQuotes(actor: Actor | null): Promise<QuoteRead> {
  if (!actor || !can(actor, "quotes.manage")) return { ok: false, error: "Only the office or the owner reads quote requests." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db.from("eng_quote_requests").select(COLUMNS).order("created_at", { ascending: false }).order("id").range(from, to),
  );
  if (!read.ok) return { ok: false, error: `The quote requests could not be read: ${read.error}` };
  return { ok: true, rows: read.rows.map(toRow) };
}

export type QuoteFile = { id: string; inputKey: string; storageKey: string; contentType: string | null; byteSize: number | null; createdAt: string };

export type QuoteDetail = { ok: true; quote: QuoteRow; files: QuoteFile[] } | { ok: false; error: string };

export async function getQuote(actor: Actor | null, id: string): Promise<QuoteDetail> {
  if (!actor || !can(actor, "quotes.manage")) return { ok: false, error: "Only the office or the owner reads quote requests." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };
  const { data, error } = await db.from("eng_quote_requests").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: `The quote request could not be read: ${error.message}` };
  if (!data) return { ok: false, error: "There is no quote request with that id." };
  const { data: files, error: filesError } = await db
    .from("eng_quote_files")
    .select("id, input_key, storage_key, content_type, byte_size, created_at")
    .eq("quote_id", id)
    .order("created_at");
  if (filesError) return { ok: false, error: `The quote's attached files could not be read: ${filesError.message}` };
  return {
    ok: true,
    quote: toRow(data as Record<string, unknown>),
    files: (files ?? []).map((f) => ({
      id: f.id as string,
      inputKey: f.input_key as string,
      storageKey: f.storage_key as string,
      contentType: (f.content_type as string | null) ?? null,
      byteSize: f.byte_size === null ? null : Number(f.byte_size),
      createdAt: f.created_at as string,
    })),
  };
}

/** A five minute link to one attached file, for staff who may read the quote. */
export async function quoteFileLink(actor: Actor | null, fileId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "quotes.manage")) return { ok: false, error: "Only the office or the owner opens a quote's files." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };
  const { data, error } = await db.from("eng_quote_files").select("bucket, storage_key").eq("id", fileId).maybeSingle();
  if (error) return { ok: false, error: `The file could not be read: ${error.message}` };
  if (!data) return { ok: false, error: "There is no such file on a quote." };
  const signed = await db.storage.from(data.bucket as string).createSignedUrl(data.storage_key as string, 300);
  if (signed.error || !signed.data) return { ok: false, error: `The file could not be opened: ${signed.error?.message ?? "no link"}` };
  return { ok: true, url: signed.data.signedUrl };
}

/** The customer's link to their quote. The token is the query; the reference alone opens nothing. */
export function customerQuoteUrl(reference: string, token: string): string {
  return `${business.url}/order/quote/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`;
}

export type SendQuoteInput = {
  id: string;
  price: string;
  scope: string;
  holdDays: unknown;
  propertyAddress?: string;
  county?: string;
};

const MS_PER_DAY = 86_400_000;

/**
 * PRICE AND SEND. quotes.manage, checked here as well as at the route. The
 * conversion needs an address and a county, as every order does, so a request
 * that came without them is completed here rather than sent unpayable.
 */
export async function sendQuote(actor: Actor | null, input: SendQuoteInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "quotes.manage")) return { ok: false, error: "Only the office or the owner sends a quote." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const price = parseQuotePrice(input.price ?? "");
  if (!price.ok) return price;
  const hold = parseHoldDays(input.holdDays);
  if (!hold.ok) return hold;
  const scope = String(input.scope ?? "").trim();
  if (scope.length < 10) return { ok: false, error: "Write the scope the price covers, so the customer knows what they are accepting." };

  const read = await getQuote(actor, input.id);
  if (!read.ok) return read;
  const quote = read.quote;
  const entry = catalogFor(quote.serviceSlug, quote.tier ?? undefined);
  if (!entry || entry.orderType !== "quote") return { ok: false, error: "This request is not for a quoted deliverable, so it cannot be priced here." };

  const address = String(input.propertyAddress ?? quote.propertyAddress ?? "").trim();
  if (!address) return { ok: false, error: "Record the property address. An accepted quote becomes an order, and an order needs one." };
  const county = resolveCounty({ city: quote.city, county: input.county ?? quote.county });
  if (!county.valid || !county.county) return { ok: false, error: "Record the property's county. An accepted quote becomes an order, and an order needs one." };

  /* new and expired pass through scoping, which is the transition table's own rule (order-audit). */
  if (quote.status !== "scoping") {
    if (!canTransitionQuote(quote.status, "scoping")) {
      return { ok: false, error: `This quote is ${QUOTE_STATUS_LABEL[quote.status].toLowerCase()}, so it cannot be sent.` };
    }
    const { data: moved, error } = await db
      .from("eng_quote_requests")
      .update({ status: "scoping", scoped_by: actor.id })
      .eq("id", quote.id)
      .eq("status", quote.status)
      .select("id");
    if (error) return { ok: false, error: `The quote could not be opened for pricing: ${error.message}` };
    if (!moved?.length) return { ok: false, error: "Somebody else changed this quote just now. Reload and look again." };
  }

  const expiresAt = new Date(Date.now() + hold.days * MS_PER_DAY);
  const { data: sent, error: sendError } = await db
    .from("eng_quote_requests")
    .update({
      status: "sent",
      quoted_cents: price.cents,
      scope,
      property_address: address,
      county: county.county,
      sent_at: DB_NOW,
      expires_at: expiresAt.toISOString(),
      scoped_by: actor.id,
    })
    .eq("id", quote.id)
    .eq("status", "scoping")
    .select("id");
  if (sendError) return { ok: false, error: `The quote could not be sent: ${sendError.message}` };
  if (!sent?.length) return { ok: false, error: "Somebody else changed this quote just now. Reload and look again." };

  const mailed = await mailQuote(
    { ...quote, quotedCents: price.cents, scope, expiresAt: expiresAt.toISOString() },
    entry.name,
    hold.days + 30,
  );

  await writeAudit({
    actor: { id: actor.id, role: actor.role },
    action: "quote.sent",
    entityType: "quote_request",
    entityId: quote.id,
    summary: `${quote.reference}: ${money(price.cents)}, holds ${hold.days} days`,
    diff: { quoted_cents: price.cents, hold_days: hold.days, email_queued: mailed.ok },
  });

  if (!mailed.ok) return { ok: false, error: `The quote is priced and marked sent, but ${mailed.error} Send the email again from this screen.` };
  return { ok: true };
}

/**
 * THE EMAIL, WITH A FRESH LINK. Shared by sending and sending again, so the two
 * cannot word the price, the scope or the date differently. The link outlives
 * the quote by 30 days so a customer who opens it late reads that it lapsed
 * rather than that the link is wrong.
 */
async function mailQuote(
  quote: QuoteRow,
  deliverable: string,
  linkDays: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const link = await issueCustomerLink({ quoteId: quote.id }, linkDays);
  if (!link) return { ok: false, error: "the customer's link could not be made, so no email went." };
  const queued = await queueEmail(
    quoteSent({
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      reference: quote.reference,
      deliverableName: deliverable.toLowerCase(),
      amount: money(quote.quotedCents),
      scope: quote.scope ?? "",
      expiresOn: formatInFirmZone(quote.expiresAt, { month: "long", day: "numeric", year: "numeric" }) ?? "",
      quoteUrl: customerQuoteUrl(quote.reference, link.token),
    }),
  );
  return queued.ok ? { ok: true } : { ok: false, error: `the email was not queued: ${queued.error}.` };
}

/** Send a sent quote's email again, unchanged, with a fresh link. Refused once it has lapsed. */
export async function resendQuote(actor: Actor | null, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "quotes.manage")) return { ok: false, error: "Only the office or the owner sends a quote." };
  const read = await getQuote(actor, id);
  if (!read.ok) return read;
  const { quote } = read;
  if (quote.status !== "sent") return { ok: false, error: "Only a sent quote is sent again. Price this one first." };
  if (hasLapsed(quote, Date.now())) return { ok: false, error: "This quote has lapsed. Price it again rather than resending a date that has passed." };
  const entry = catalogFor(quote.serviceSlug, quote.tier ?? undefined);
  const holdsMs = Date.parse(quote.expiresAt ?? "") - Date.now();
  const mailed = await mailQuote(quote, entry?.name ?? quote.serviceSlug, Math.ceil(holdsMs / MS_PER_DAY) + 30);
  await writeAudit({
    actor: { id: actor.id, role: actor.role },
    action: "quote.resent",
    entityType: "quote_request",
    entityId: quote.id,
    summary: `${quote.reference}: the email sent again`,
    diff: { email_queued: mailed.ok },
  });
  return mailed.ok ? { ok: true } : { ok: false, error: `The email was not sent again: ${mailed.error}` };
}

/** Decline a request with a reason the record keeps. */
export async function declineQuote(actor: Actor | null, id: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "quotes.manage")) return { ok: false, error: "Only the office or the owner declines a quote." };
  const why = String(reason ?? "").trim();
  if (why.length < 3) return { ok: false, error: "Say why it is declined, for the record." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };
  const read = await getQuote(actor, id);
  if (!read.ok) return read;
  if (!canTransitionQuote(read.quote.status, "declined")) {
    return { ok: false, error: `This quote is ${QUOTE_STATUS_LABEL[read.quote.status].toLowerCase()}, so it cannot be declined.` };
  }
  const { data, error } = await db
    .from("eng_quote_requests")
    .update({ status: "declined", decline_reason: why, decided_at: DB_NOW })
    .eq("id", id)
    .eq("status", read.quote.status)
    .select("id");
  if (error) return { ok: false, error: `The quote could not be declined: ${error.message}` };
  if (!data?.length) return { ok: false, error: "Somebody else changed this quote just now. Reload and look again." };
  await writeAudit({
    actor: { id: actor.id, role: actor.role },
    action: "quote.declined",
    entityType: "quote_request",
    entityId: id,
    summary: `${read.quote.reference}: declined`,
    diff: { reason: why },
  });
  return { ok: true };
}

// ------------------------------------------------------------ the customer

export type CustomerQuote = {
  quote: QuoteRow;
  deliverableName: string;
  refundTerms: string[];
  lapsed: boolean;
};

/** The quote behind a customer's token, or null. Never says which of the reasons it is. */
export async function customerQuote(token: string): Promise<CustomerQuote | null> {
  const db = supabaseAdmin();
  if (!db || !token) return null;
  const subject = await orderForCustomerToken(token);
  if (!subject?.quoteId) return null;
  const { data } = await db.from("eng_quote_requests").select(COLUMNS).eq("id", subject.quoteId).maybeSingle();
  if (!data) return null;
  const quote = toRow(data as Record<string, unknown>);
  const entry = catalogFor(quote.serviceSlug, quote.tier ?? undefined);
  if (!entry) return null;
  return {
    quote,
    deliverableName: entry.name,
    refundTerms: refundDisclosure(entry),
    lapsed: hasLapsed(quote, Date.now()),
  };
}

export type AcceptResult = { ok: true; checkoutUrl: string; reference: string } | { ok: false; error: string };

/**
 * THE CUSTOMER ACCEPTS AND PAYS. A MONEY DOOR, so the signed record is read
 * first (ruling 11) and a failed read closes it, in the gate's own words.
 */
export async function acceptQuote(token: string): Promise<AcceptResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };
  const view = await customerQuote(token);
  if (!view) return { ok: false, error: "This link does not open a quote. The most recent email from the firm is the one that works." };
  const { quote } = view;
  const entry = catalogFor(quote.serviceSlug, quote.tier ?? undefined);

  /*
   * A design quote is paid on its accepted quote and his signed scope addendum,
   * never on a protocol (Robert's answer 1 of 2026-10-27). Asked before the
   * acceptance is recorded, which is the act being made here; placeOrder asks
   * again with the stored status before any checkout opens.
   */
  const blocked =
    entry && deskLines.includes(entry.serviceSlug)
      ? await designQuoteBlocked(entry, quote.id, launchMode(), true)
      : await orderBlockedNow(entry, launchMode());
  if (blocked) return { ok: false, error: blocked };

  if (quote.status === "sent") {
    if (view.lapsed) {
      await db.from("eng_quote_requests").update({ status: "expired" }).eq("id", quote.id).eq("status", "sent");
      return { ok: false, error: "This quote has lapsed, so it cannot be accepted. Reply to the email it came in and the firm will look at it again." };
    }
    const { data: accepted, error } = await db
      .from("eng_quote_requests")
      .update({ status: "accepted", decided_at: DB_NOW })
      .eq("id", quote.id)
      .eq("status", "sent")
      .select("id");
    if (error) return { ok: false, error: "The quote could not be accepted just now. Nothing has been charged. Try again in a few minutes." };
    if (!accepted?.length) {
      const again = await customerQuote(token);
      if (!again || again.quote.status !== "accepted") {
        return { ok: false, error: "This quote changed while it was being accepted. Open the link again to see where it stands." };
      }
    } else {
      await writeAudit({
        actor: null,
        action: "quote.accepted",
        entityType: "quote_request",
        entityId: quote.id,
        summary: `${quote.reference}: accepted by the customer at ${money(quote.quotedCents)}`,
      });
    }
  } else if (quote.status !== "accepted") {
    return { ok: false, error: `This quote is ${QUOTE_STATUS_LABEL[quote.status].toLowerCase()}, so it cannot be accepted.` };
  }

  return convertAndCheckout(quote.id);
}

/**
 * CONVERT, ONCE, AND OPEN CHECKOUT. Read fresh rather than from the caller's
 * copy, so the status convertibleToOrder judges is the stored one.
 */
async function convertAndCheckout(quoteId: string): Promise<AcceptResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };
  const { data } = await db.from("eng_quote_requests").select(COLUMNS).eq("id", quoteId).maybeSingle();
  if (!data) return { ok: false, error: "The quote could not be read just now. Nothing has been charged." };
  const quote = toRow(data as Record<string, unknown>);
  if (!convertibleToOrder(quote.status)) return { ok: false, error: "Only an accepted quote becomes an order." };
  if (quote.quotedCents === null || quote.quotedCents <= 0) return { ok: false, error: "This quote states no price, so it cannot be paid." };

  const placed = await placeOrder({
    site: quote.site,
    clientRequestId: quoteOrderRequestId(quote.id),
    serviceSlug: quote.serviceSlug,
    tier: quote.tier ?? undefined,
    customer: { name: quote.customerName, email: quote.customerEmail, phone: quote.customerPhone, company: quote.customerCompany },
    property: { propertyAddress: quote.propertyAddress ?? "", city: quote.city, county: quote.county, postalCode: null },
    answers: [],
    fromQuote: { quoteId: quote.id, quotedCents: quote.quotedCents },
  });
  if (!placed.ok) return { ok: false, error: `The quote could not become an order: ${placed.error} Nothing has been charged.` };

  if (quote.convertedOrderId !== placed.orderId) {
    const { error } = await db
      .from("eng_quote_requests")
      .update({ converted_order_id: placed.orderId })
      .eq("id", quote.id)
      .is("converted_order_id", null);
    if (error) return { ok: false, error: "The order was made but could not be tied to the quote just now. Nothing has been charged. Try again." };
    if (!placed.duplicate) {
      await writeAudit({
        actor: null,
        action: "quote.converted",
        entityType: "quote_request",
        entityId: quote.id,
        summary: `${quote.reference} became order ${placed.reference}`,
      });
    }
  }

  const checkout = await startCheckout(placed.orderId);
  if (!checkout.ok) return { ok: false, error: `${checkout.error} Nothing has been charged.` };
  return { ok: true, checkoutUrl: checkout.url, reference: placed.reference };
}
