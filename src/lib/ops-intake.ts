import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin, SITE_KEY } from "./supabase";
import { writeAudit } from "./ops-audit";
import { createClient, createFile, SYSTEM_AUTHOR } from "./ops-crm";
import { resolveCounty, twiaStatus } from "./ops-counties";
import { isPrelaunch } from "./launch";
import { catalogFor, orderBlockedReason, type CatalogEntry } from "@data/catalog";
import {
  landingStatusFor,
  qualify,
  quoteFor,
  refundDisclosure,
  type QualifierAnswer,
} from "./ops-orders";
import { isKnown } from "./ops-money";

/**
 * Order intake: the one door every brand's customer flow comes through.
 *
 * WHY ONE FUNCTION AND NOT ONE PER SITE
 * -------------------------------------
 * Three sites take orders for the same nine services against the same catalog.
 * Three intakes would be three places to check the compliance gate, three places
 * to compute a price, and three places for the refund disclosure to drift from
 * the fee actually retained. The first time one of them lags, a customer is told
 * one thing and charged another.
 *
 * WHAT IT REFUSES, AND WHY REFUSING IS THE FEATURE
 * ------------------------------------------------
 * Nothing here trusts the caller. The price is recomputed from the catalog, not
 * read from the request, because a browser that can name its own price is a shop
 * with no till. The qualifiers are re-evaluated, because a flow can be skipped.
 * The county is resolved rather than accepted. And the compliance gate is
 * checked here, at the point of writing, rather than only on the page that
 * rendered the button.
 *
 * THE ORDER IS WRITTEN BEFORE THE FILE, DELIBERATELY
 * --------------------------------------------------
 * An order with no file is a recoverable state: somebody can see it in the
 * portal and open the file by hand. A file with no order is work nobody is
 * billed for, and nothing on any screen would show that it was owed. So the
 * order row lands first and the file is attached to it; if file creation fails,
 * there is a row saying so rather than silence.
 */

// --------------------------------------------------------------- references

/*
 * A reference the customer can read out on the phone.
 *
 * NOT A COUNT, AND THAT IS ON PURPOSE
 * -----------------------------------
 * createFile numbers files by counting the existing ones, which is fine for a
 * surface only staff touch. Two customers checking out in the same second would
 * both count the same number, and the loser gets a unique violation on the
 * reference after their card has been charged. The alphabet excludes the
 * characters people mishear and mistype: no O or 0, no I, L or 1.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function referenceFor(kind: "O" | "Q"): string {
  const bytes = randomBytes(6);
  let suffix = "";
  for (const byte of bytes) suffix += ALPHABET[byte % ALPHABET.length];
  return `${SITE_KEY}-${kind}${new Date().getFullYear()}-${suffix}`;
}

// ------------------------------------------------------------- caller auth

/**
 * Which brand is calling, proved by a key that brand alone holds.
 *
 * ONE KEY PER SITE, NOT ONE SHARED KEY
 * ------------------------------------
 * A single shared secret means a leak from the smallest of the three brands
 * authorizes orders on behalf of all three. Per site, a leak is scoped to the
 * site that leaked it and can be rotated without touching the others.
 *
 * The keys live in one JSON environment variable rather than three variables,
 * because three variables is three chances to scope one of them to the wrong
 * Vercel environment, which this project has now done twice in two days.
 */
export function siteFromKey(provided: string | null | undefined): string | null {
  const raw = process.env.ORDER_INTAKE_KEYS;
  if (!raw || !provided) return null;

  let keys: Record<string, string>;
  try {
    keys = JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }

  const givenHash = createHash("sha256").update(provided, "utf8").digest();
  for (const [site, key] of Object.entries(keys)) {
    if (typeof key !== "string" || key.length === 0) continue;
    const knownHash = createHash("sha256").update(key, "utf8").digest();
    if (timingSafeEqual(givenHash, knownHash)) return site;
  }
  return null;
}

// ----------------------------------------------------------------- placing

export type IntakeCustomer = {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
};

export type IntakeProperty = {
  propertyAddress: string;
  city?: string | null;
  county?: string | null;
  postalCode?: string | null;
};

export type IntakeAttribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  landingPath?: string | null;
  referrer?: string | null;
};

export type PlaceOrderInput = {
  site: string;
  clientRequestId: string;
  serviceSlug: string;
  customer: IntakeCustomer;
  property: IntakeProperty;
  answers: QualifierAnswer[];
  /** Text inputs the catalog asked for, keyed by input id. */
  inputs?: Record<string, string>;
  /** Files already uploaded to a private bucket by the calling site. */
  files?: { key: string; bucket: string; storageKey: string; contentType?: string | null; byteSize?: number | null }[];
  attribution?: IntakeAttribution;
};

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      reference: string;
      totalCents: number | null;
      /** True when this request had already been accepted. Not an error. */
      duplicate: boolean;
    }
  | { ok: false; error: string; field?: string };

const trimmed = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : "");

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  if (!trimmed(input.clientRequestId)) {
    return { ok: false, error: "A request needs an idempotency key.", field: "clientRequestId" };
  }

  /*
   * Idempotency first, before any validation.
   *
   * A retry after a timeout must not be told its answers are wrong on the
   * second attempt because the catalog changed in between. If this request was
   * already accepted, the answer is the order that exists.
   */
  const { data: existing } = await db
    .from("eng_service_orders")
    .select("id, reference, total_cents")
    .eq("client_request_id", input.clientRequestId)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      orderId: existing.id as string,
      reference: existing.reference as string,
      totalCents: existing.total_cents === null ? null : Number(existing.total_cents),
      duplicate: true,
    };
  }

  const entry = catalogFor(input.serviceSlug);
  const blocked = orderBlockedReason(entry, isPrelaunch());
  if (!entry || blocked) {
    return { ok: false, error: blocked ?? "That service cannot be ordered.", field: "serviceSlug" };
  }
  if (entry.orderType === "quote") {
    return {
      ok: false,
      error: "That service is quoted rather than ordered. Send a quote request instead.",
      field: "serviceSlug",
    };
  }

  if (!trimmed(input.customer.name)) return { ok: false, error: "A name is needed.", field: "customer.name" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed(input.customer.email))) {
    return { ok: false, error: "That email address does not look right.", field: "customer.email" };
  }
  if (!trimmed(input.property.propertyAddress)) {
    return { ok: false, error: "A property address is needed.", field: "property.propertyAddress" };
  }

  /*
   * Re-evaluated here rather than trusted from the flow. A customer who skipped
   * the questions, or a caller with a stale copy of the catalog, must not be
   * able to place an order the firm would refuse.
   */
  const qualified = qualify(entry, input.answers ?? []);
  if (!qualified.ok) {
    return { ok: false, error: qualified.message, field: `qualifier.${qualified.qualifierId}` };
  }

  const resolved = resolveCounty({ city: input.property.city, county: input.property.county });
  if (!resolved.valid || !resolved.county) {
    return {
      ok: false,
      error:
        "The county could not be determined from that address. It decides who can be dispatched and what the work involves, so the firm will not take the order without it.",
      field: "property.county",
    };
  }
  const county = resolved.county;
  const twia = twiaStatus(county) === "designated";

  const priced = quoteFor(entry, twia, county);
  if (priced.unavailable || !isKnown(priced.totalCents)) {
    return { ok: false, error: priced.unavailable ?? "That order cannot be priced." };
  }

  const disclosure = refundDisclosure(entry).join("\n\n");
  const reference = referenceFor("O");

  const { data: order, error: orderError } = await db
    .from("eng_service_orders")
    .insert({
      site: input.site,
      reference,
      service_slug: entry.serviceSlug,
      order_type: entry.orderType,
      status: "awaiting_payment",
      customer_name: trimmed(input.customer.name),
      customer_email: trimmed(input.customer.email).toLowerCase(),
      customer_phone: trimmed(input.customer.phone) || null,
      customer_company: trimmed(input.customer.company) || null,
      property_address: trimmed(input.property.propertyAddress),
      city: trimmed(input.property.city) || null,
      county,
      postal_code: trimmed(input.property.postalCode) || null,
      twia_county: twia,
      price_cents: entry.priceCents,
      coastal_surcharge_cents: twia ? entry.coastalSurchargeCents : null,
      inspection_fee_cents: entry.inspectionFeeCents,
      total_cents: priced.totalCents,
      catalog_snapshot: entry as unknown as Record<string, unknown>,
      refund_disclosure: disclosure,
      utm_source: input.attribution?.utmSource ?? null,
      utm_medium: input.attribution?.utmMedium ?? null,
      utm_campaign: input.attribution?.utmCampaign ?? null,
      utm_content: input.attribution?.utmContent ?? null,
      utm_term: input.attribution?.utmTerm ?? null,
      landing_path: input.attribution?.landingPath ?? null,
      referrer: input.attribution?.referrer ?? null,
      placed_at: new Date().toISOString(),
      client_request_id: input.clientRequestId,
    })
    .select("id, reference, total_cents")
    .single();

  if (orderError || !order) {
    /*
     * A unique violation here is the race the idempotency check above cannot
     * close: two identical requests in flight at once. The second one loses the
     * insert and then finds the winner's row, which is the correct answer.
     */
    if (orderError?.code === "23505") {
      const { data: raced } = await db
        .from("eng_service_orders")
        .select("id, reference, total_cents")
        .eq("client_request_id", input.clientRequestId)
        .maybeSingle();
      if (raced) {
        return {
          ok: true,
          orderId: raced.id as string,
          reference: raced.reference as string,
          totalCents: raced.total_cents === null ? null : Number(raced.total_cents),
          duplicate: true,
        };
      }
    }
    return { ok: false, error: orderError?.message ?? "The order could not be recorded." };
  }

  const orderId = order.id as string;

  await recordInputs(orderId, entry, input);
  await event(orderId, "order.placed", true, `Order ${reference} placed.`, {
    total_cents: priced.totalCents,
    order_type: entry.orderType,
  });

  /*
   * The client and the file. Authored by the order engine, which has no profile
   * id, so created_by is null and the audit row names the engine rather than
   * attributing a customer's action to a member of staff.
   */
  const client = await createClient(SYSTEM_AUTHOR, {
    kind: trimmed(input.customer.company) ? "organization" : "individual",
    name: trimmed(input.customer.company) || trimmed(input.customer.name),
    email: trimmed(input.customer.email).toLowerCase(),
    phone: trimmed(input.customer.phone) || null,
    city: trimmed(input.property.city) || null,
    county,
    /*
     * Snake case, because createClient spreads this straight into the insert and
     * the keys have to be real eng_clients columns. The first walkthrough passed
     * camelCase and every order recorded a client.failed event reading
     * "Could not find the 'landingPath' column". The order was fine and no
     * client or file was created, and the HTTP response said 201 either way.
     */
    attribution: {
      source_site: input.site,
      source_form: "order",
      utm_source: input.attribution?.utmSource ?? null,
      utm_medium: input.attribution?.utmMedium ?? null,
      utm_campaign: input.attribution?.utmCampaign ?? null,
      utm_content: input.attribution?.utmContent ?? null,
      utm_term: input.attribution?.utmTerm ?? null,
      landing_path: input.attribution?.landingPath ?? null,
      referrer: input.attribution?.referrer ?? null,
    },
  });

  if (client.ok) {
    const file = await createFile(SYSTEM_AUTHOR, {
      clientId: client.id,
      serviceSlug: entry.serviceSlug,
      propertyAddress: trimmed(input.property.propertyAddress),
      city: trimmed(input.property.city) || null,
      county,
      postalCode: trimmed(input.property.postalCode) || null,
      notes: `Opened by the order engine from ${reference}.`,
      clientPriceCents: isKnown(priced.totalCents) ? priced.totalCents : null,
    });

    if (file.ok) {
      await db
        .from("eng_service_orders")
        .update({ client_id: client.id, file_id: file.id })
        .eq("id", orderId);
      await event(orderId, "file.opened", false, `File ${file.fileNumber} opened for this order.`);
    } else {
      /*
       * Recorded rather than thrown. The customer has an order and the firm has
       * a row saying the file did not open, which somebody can act on. Failing
       * the whole request here would lose the order instead.
       */
      await event(orderId, "file.failed", false, `The file could not be opened: ${file.error}`);
    }
  } else {
    await event(orderId, "client.failed", false, `The client record could not be created: ${client.error}`);
  }

  await writeAudit({
    actor: { id: null, role: "admin", email: SYSTEM_AUTHOR.email },
    action: "order.placed",
    entityType: "service_order",
    entityId: orderId,
    summary: `${reference}: ${entry.serviceSlug} at ${trimmed(input.property.propertyAddress)}, ${county} County`,
  });

  return {
    ok: true,
    orderId,
    reference: order.reference as string,
    totalCents: priced.totalCents,
    duplicate: false,
  };
}

// ------------------------------------------------------------------ inputs

async function recordInputs(
  orderId: string,
  entry: CatalogEntry,
  input: PlaceOrderInput,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  const rows: Record<string, unknown>[] = [];

  for (const answer of input.answers ?? []) {
    const qualifier = entry.qualifiers.find((q) => q.id === answer.qualifierId);
    if (!qualifier) continue;
    rows.push({
      order_id: orderId,
      kind: "qualifier",
      key: qualifier.id,
      prompt: qualifier.prompt,
      option_index: answer.optionIndex,
      value_text: qualifier.options[answer.optionIndex] ?? null,
    });
  }

  for (const [key, value] of Object.entries(input.inputs ?? {})) {
    const spec = entry.requiredInputs.find((i) => i.id === key);
    if (!spec || !trimmed(value)) continue;
    rows.push({
      order_id: orderId,
      kind: "input",
      key,
      prompt: spec.label,
      value_text: trimmed(value),
    });
  }

  for (const file of input.files ?? []) {
    const spec = entry.requiredInputs.find((i) => i.id === file.key);
    if (!spec) continue;
    rows.push({
      order_id: orderId,
      kind: "input",
      key: file.key,
      prompt: spec.label,
      bucket: file.bucket,
      storage_key: file.storageKey,
      content_type: file.contentType ?? null,
      byte_size: file.byteSize ?? null,
    });
  }

  if (rows.length) await db.from("eng_order_inputs").insert(rows);
}

// ------------------------------------------------------------------ events

export async function event(
  orderId: string,
  name: string,
  customerVisible: boolean,
  summary: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db.from("eng_order_events").insert({
    order_id: orderId,
    event: name,
    customer_visible: customerVisible,
    summary,
    detail: detail ?? null,
  });
}

// ------------------------------------------------------------ quote requests

export type RequestQuoteInput = {
  site: string;
  clientRequestId: string;
  serviceSlug: string;
  customer: IntakeCustomer;
  property?: Partial<IntakeProperty>;
  answers?: QualifierAnswer[];
  brief: string;
  neededBy?: string | null;
  attribution?: IntakeAttribution;
};

export type RequestQuoteResult =
  | { ok: true; quoteId: string; reference: string; duplicate: boolean }
  | { ok: false; error: string; field?: string };

/**
 * A quote request. Nothing is owed and nothing is charged.
 *
 * The compliance gate still applies. A quote request is the firm taking work,
 * and taking work is what the registration governs, so orderBlockedReason
 * refuses it in prelaunch exactly as it refuses a paid order.
 */
export async function requestQuote(input: RequestQuoteInput): Promise<RequestQuoteResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };
  if (!trimmed(input.clientRequestId)) {
    return { ok: false, error: "A request needs an idempotency key.", field: "clientRequestId" };
  }

  const { data: existing } = await db
    .from("eng_quote_requests")
    .select("id, reference")
    .eq("client_request_id", input.clientRequestId)
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      quoteId: existing.id as string,
      reference: existing.reference as string,
      duplicate: true,
    };
  }

  const entry = catalogFor(input.serviceSlug);
  const blocked = orderBlockedReason(entry, isPrelaunch());
  if (!entry || blocked) {
    return { ok: false, error: blocked ?? "That service is not in the catalog.", field: "serviceSlug" };
  }

  if (!trimmed(input.customer.name)) return { ok: false, error: "A name is needed.", field: "customer.name" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed(input.customer.email))) {
    return { ok: false, error: "That email address does not look right.", field: "customer.email" };
  }
  if (!trimmed(input.brief)) {
    return { ok: false, error: "Say what the project is, so somebody can scope it.", field: "brief" };
  }

  if (entry.qualifiers.length) {
    const qualified = qualify(entry, input.answers ?? []);
    if (!qualified.ok) {
      return { ok: false, error: qualified.message, field: `qualifier.${qualified.qualifierId}` };
    }
  }

  const resolved = resolveCounty({ city: input.property?.city, county: input.property?.county });
  const county = resolved.valid ? resolved.county : null;
  const reference = referenceFor("Q");

  const { data: quote, error } = await db
    .from("eng_quote_requests")
    .insert({
      site: input.site,
      reference,
      service_slug: entry.serviceSlug,
      status: "new",
      customer_name: trimmed(input.customer.name),
      customer_email: trimmed(input.customer.email).toLowerCase(),
      customer_phone: trimmed(input.customer.phone) || null,
      customer_company: trimmed(input.customer.company) || null,
      property_address: trimmed(input.property?.propertyAddress) || null,
      city: trimmed(input.property?.city) || null,
      county,
      twia_county: county ? twiaStatus(county) === "designated" : false,
      brief: trimmed(input.brief),
      needed_by: input.neededBy || null,
      utm_source: input.attribution?.utmSource ?? null,
      utm_medium: input.attribution?.utmMedium ?? null,
      utm_campaign: input.attribution?.utmCampaign ?? null,
      utm_content: input.attribution?.utmContent ?? null,
      utm_term: input.attribution?.utmTerm ?? null,
      landing_path: input.attribution?.landingPath ?? null,
      referrer: input.attribution?.referrer ?? null,
      client_request_id: input.clientRequestId,
    })
    .select("id, reference")
    .single();

  if (error || !quote) {
    return { ok: false, error: error?.message ?? "The quote request could not be recorded." };
  }

  await writeAudit({
    actor: { id: null, role: "admin", email: SYSTEM_AUTHOR.email },
    action: "quote.requested",
    entityType: "quote_request",
    entityId: quote.id as string,
    summary: `${reference}: ${entry.serviceSlug} for ${trimmed(input.customer.name)}`,
  });

  return { ok: true, quoteId: quote.id as string, reference: quote.reference as string, duplicate: false };
}

// ------------------------------------------------------- the customer's link

/**
 * A signed link for a customer with no account.
 *
 * The token is returned once and stored only as a hash, exactly as
 * eng_auth_tokens does, so a leaked database row is not a leaked link.
 *
 * Long lived on purpose. An order takes weeks and the customer will come back to
 * it more than once; a short expiry means either mailing them a new link every
 * few days or a dead link at the moment they want to check. Revocation is the
 * control, not expiry.
 */
export async function issueCustomerLink(
  subject: { orderId: string } | { quoteId: string },
  days = 120,
): Promise<{ token: string; expiresAt: Date } | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const { error } = await db.from("eng_customer_access").insert({
    order_id: "orderId" in subject ? subject.orderId : null,
    quote_id: "quoteId" in subject ? subject.quoteId : null,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });
  if (error) return null;

  return { token, expiresAt };
}

/** The order behind a customer link, or null. Never says which of those it is. */
export async function orderForCustomerToken(token: string) {
  const db = supabaseAdmin();
  if (!db || !token) return null;

  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { data: access } = await db
    .from("eng_customer_access")
    .select("id, order_id, quote_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!access) return null;
  if (access.revoked_at) return null;
  if (new Date(access.expires_at as string).getTime() <= Date.now()) return null;

  await db
    .from("eng_customer_access")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", access.id);

  return {
    orderId: (access.order_id as string | null) ?? null,
    quoteId: (access.quote_id as string | null) ?? null,
  };
}

export { landingStatusFor };
