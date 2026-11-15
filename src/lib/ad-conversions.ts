import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { captureError } from "./ops-observability";
import { gaMeasurementId } from "./analytics";
import { AD_CLICK_DAYS, isAdClick, type AdClick } from "./ad-click";

/**
 * ===========================================================================
 * CONVERSIONS SENT FROM THE SERVER: GA4 AND GOOGLE ADS. Robert's add-on of
 * 2026-11-15, items 10 to 12.
 * ===========================================================================
 *
 * WHAT IS OWED, AND TO WHOM.
 *   - A paid order, with its value: to GA4 through the Measurement Protocol,
 *     always, and to Google Ads as the PRIMARY conversion when the order
 *     carries an ad click. Never from the browser (item 10).
 *   - A paid order whose click is on the LEAD it came from rather than on the
 *     order itself, which is how a job taken over the telephone for an ad lead
 *     arrives: to Google Ads as an offline conversion (item 12).
 *   - A callback request, an "email me the price" request and an inquiry from
 *     an ad click: to Google Ads as SECONDARY conversions (item 11). GA4 hears
 *     those from the browser, as finder events.
 *   - Calls of 60 seconds or more from an ad are counted by Google itself,
 *     through the forwarding number on /start (item 13); nothing here sends
 *     them.
 *
 * Every conversion is written to eng_ad_conversions (0137) when it happens and
 * sent by the jobs cron, so a Google outage or a missing credential delays a
 * conversion rather than losing it. A row is unique per destination, kind and
 * subject, so nothing is sent twice.
 *
 * ENHANCED CONVERSIONS (item 11): the customer's own email and phone, as they
 * typed them, normalised and hashed with SHA-256 the way Google specifies, are
 * sent with a Google Ads upload. Nothing is sent in the clear.
 *
 * WITHOUT CREDENTIALS, COULD NOT TELL. Until Robert sets the GA4 API secret
 * and the Google Ads OAuth grant, each send records `could_not_tell` with the
 * names of what is missing, and is tried again on a later run. The names are
 * in src/config/credential-inventory.ts.
 *
 * Proved by scripts/proofs/a-conversion-is-owed-once-and-said-when-it-cannot-go.mjs.
 */

export type ConversionKind = "order_paid" | "offline_order" | "callback" | "email_price" | "inquiry";
export type Destination = "ga4" | "google_ads";

/* ------------------------------------------------------------ pure helpers */

/** Which Google Ads names are missing from an environment. Empty means every one is set. */
export function missingAdsCredentials(env: Record<string, string | undefined>): string[] {
  const needed = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CONVERSION_ACTIONS"];
  return needed.filter((n) => !env[n]);
}

export function missingGa4Credentials(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  if (!env.GA4_API_SECRET) missing.push("GA4_API_SECRET");
  if (!gaMeasurementIdFrom(env)) missing.push("NEXT_PUBLIC_GA_MEASUREMENT_ID");
  return missing;
}

function gaMeasurementIdFrom(env: Record<string, string | undefined>): string | null {
  const id = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return id && /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

/** The conversion action for a kind, from the JSON Robert sets; null when it is not named. */
export function conversionActionFor(kind: ConversionKind, raw: string | undefined): string | null {
  try {
    const map = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    const v = map[kind];
    return typeof v === "string" && /^\d{1,20}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Google's normalisation for enhanced conversions, then SHA-256 hex. Email:
 * trimmed and lower cased; for gmail.com and googlemail.com the dots before the
 * @ are removed. Phone: E.164, the US assumed for ten digits. Null when there
 * is nothing usable, so an empty field never becomes the hash of an empty
 * string.
 */
export function hashedEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return null;
  const [local, domain] = e.split("@");
  const normal = domain === "gmail.com" || domain === "googlemail.com" ? `${local.replace(/\./g, "")}@${domain}` : e;
  return createHash("sha256").update(normal).digest("hex");
}

export function hashedPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
  return e164 ? createHash("sha256").update(e164).digest("hex") : null;
}

/** "yyyy-mm-dd hh:mm:ss+00:00", the format the Google Ads API asks for. */
export function adsDateTime(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 19).replace("T", " ")}+00:00`;
}

/** One click conversion as the Google Ads API's uploadClickConversions takes it. */
export function adsClickConversion(input: {
  customerId: string;
  actionId: string;
  click: { gclid: string | null; gbraid: string | null; wbraid: string | null };
  at: string;
  valueCents: number | null;
  orderId: string | null;
  email: string | null;
  phone: string | null;
}) {
  const identifiers = [
    ...(hashedEmail(input.email) ? [{ hashedEmail: hashedEmail(input.email) }] : []),
    ...(hashedPhone(input.phone) ? [{ hashedPhoneNumber: hashedPhone(input.phone) }] : []),
  ];
  return {
    ...(input.click.gclid ? { gclid: input.click.gclid } : input.click.gbraid ? { gbraid: input.click.gbraid } : { wbraid: input.click.wbraid }),
    conversionAction: `customers/${input.customerId}/conversionActions/${input.actionId}`,
    conversionDateTime: adsDateTime(input.at),
    ...(input.valueCents !== null ? { conversionValue: input.valueCents / 100, currencyCode: "USD" } : {}),
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(identifiers.length ? { userIdentifiers: identifiers } : {}),
  };
}

/**
 * The GA4 Measurement Protocol body for a paid order. client_id is required by
 * the protocol; the order's own id stands in for it, because the browser's GA
 * client id is not kept on an order. The purchase is counted with its value
 * and its reference as the transaction id, so a duplicate send is one purchase
 * in GA4's own deduplication.
 */
export function ga4PurchaseBody(input: { orderId: string; reference: string; valueCents: number; serviceSlug: string }) {
  return {
    client_id: `order.${input.orderId}`,
    non_personalized_ads: false,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: input.reference,
          value: input.valueCents / 100,
          currency: "USD",
          items: [{ item_id: input.serviceSlug, item_name: input.serviceSlug, price: input.valueCents / 100, quantity: 1 }],
        },
      },
    ],
  };
}

/* ------------------------------------------------------------- recording */

type Row = {
  destination: Destination;
  kind: ConversionKind;
  order_id?: string | null;
  lead_id?: string | null;
  value_cents?: number | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
};

async function record(rows: Row[]): Promise<void> {
  const db = supabaseAdmin();
  if (!db || rows.length === 0) return;
  for (const row of rows) {
    const { error } = await db.from("eng_ad_conversions").insert(row);
    /* 23505 is the unique index saying it is already owed, which is the point of the index, not a fault. */
    if (error && error.code !== "23505") {
      await captureError(new Error(`A conversion could not be recorded: ${error.message}`), { kind: "ad-conversions" });
    }
  }
}

/** A lead from an ad click owes Google Ads a secondary conversion (item 11). Nothing is owed without a click. */
export async function recordLeadConversion(kind: "callback" | "email_price" | "inquiry", leadId: string, click: AdClick | null): Promise<void> {
  if (!isAdClick(click)) return;
  await record([{ destination: "google_ads", kind, lead_id: leadId, gclid: click!.gclid, gbraid: click!.gbraid, wbraid: click!.wbraid }]);
}

/**
 * A paid order: GA4 always, and Google Ads when a click can be traced to it,
 * on the order (primary) or on the lead it came from (offline). The lead is
 * the one the order names, or failing that the newest lead with the same email
 * or phone and an ad click inside the 90 day window, which is how a job taken
 * by telephone for an ad lead is found.
 */
export async function recordPaidOrderConversions(orderId: string): Promise<void> {
  try {
    const db = supabaseAdmin();
    if (!db) return;
    const { data: order } = await db
      .from("eng_service_orders")
      .select("id, total_cents, is_demo, gclid, gbraid, wbraid, lead_id, customer_email, customer_phone, placed_at")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.is_demo) return;
    const value = (order.total_cents as number | null) ?? null;
    const rows: Row[] = [{ destination: "ga4", kind: "order_paid", order_id: orderId, value_cents: value }];

    if (order.gclid || order.gbraid || order.wbraid) {
      rows.push({ destination: "google_ads", kind: "order_paid", order_id: orderId, value_cents: value, gclid: order.gclid, gbraid: order.gbraid, wbraid: order.wbraid });
    } else {
      const since = new Date(Date.now() - AD_CLICK_DAYS * 86_400_000).toISOString();
      type LeadClick = { id: string; gclid: string | null; gbraid: string | null; wbraid: string | null };
      let lead: LeadClick | null = null;
      if (order.lead_id) {
        const { data } = await db.from("eng_leads").select("id, gclid, gbraid, wbraid").eq("id", order.lead_id).maybeSingle();
        lead = (data as LeadClick | null) ?? null;
      }
      if (!lead?.gclid && !lead?.gbraid && !lead?.wbraid) {
        const email = (order.customer_email as string | null)?.trim().toLowerCase() ?? null;
        const phone = (order.customer_phone as string | null) ?? null;
        const matchers = [email ? `email.eq.${email}` : null, phone ? `phone.eq.${phone}` : null].filter(Boolean).join(",");
        if (matchers) {
          const { data } = await db
            .from("eng_leads")
            .select("id, gclid, gbraid, wbraid")
            .or(matchers)
            .gte("clicked_at", since)
            .or("gclid.not.is.null,gbraid.not.is.null,wbraid.not.is.null")
            .order("clicked_at", { ascending: false })
            .limit(1);
          lead = ((data ?? [])[0] as LeadClick | undefined) ?? null;
        }
      }
      if (lead && (lead.gclid || lead.gbraid || lead.wbraid)) {
        rows.push({ destination: "google_ads", kind: "offline_order", order_id: orderId, lead_id: lead.id, value_cents: value, gclid: lead.gclid, gbraid: lead.gbraid, wbraid: lead.wbraid });
      }
    }
    await record(rows);
  } catch (err) {
    await captureError(err, { kind: "ad-conversions" });
  }
}

/* --------------------------------------------------------------- sending */

type Owed = {
  id: string;
  created_at: string;
  destination: Destination;
  kind: ConversionKind;
  order_id: string | null;
  lead_id: string | null;
  value_cents: number | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  attempts: number;
};

const MAX_ATTEMPTS = 10;
const ADS_API_VERSION = "v21";

async function mark(id: string, status: "sent" | "failed" | "could_not_tell", error: string | null, attempts: number) {
  const db = supabaseAdmin();
  if (!db) return;
  await db
    .from("eng_ad_conversions")
    .update({ status, last_error: error, attempts, sent_at: status === "sent" ? new Date().toISOString() : null })
    .eq("id", id);
}

async function adsAccessToken(env: Record<string, string | undefined>): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

async function sendOne(row: Owed, env: Record<string, string | undefined>): Promise<void> {
  const attempts = row.attempts + 1;
  const db = supabaseAdmin();
  if (!db) return;

  if (row.destination === "ga4") {
    const missing = missingGa4Credentials(env);
    if (missing.length) return mark(row.id, "could_not_tell", `not set: ${missing.join(", ")}`, attempts);
    const { data: order } = await db.from("eng_service_orders").select("id, reference, service_slug, total_cents").eq("id", row.order_id).maybeSingle();
    if (!order) return mark(row.id, "failed", "the order could not be read", attempts);
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${gaMeasurementIdFrom(env)}&api_secret=${encodeURIComponent(env.GA4_API_SECRET ?? "")}`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(ga4PurchaseBody({ orderId: order.id as string, reference: order.reference as string, valueCents: (row.value_cents ?? order.total_cents) as number, serviceSlug: order.service_slug as string })),
      signal: AbortSignal.timeout(15_000),
    });
    /* The Measurement Protocol answers 2xx whether or not it accepted the event; a 2xx is the most it will say. */
    return mark(row.id, res.ok ? "sent" : "failed", res.ok ? null : `GA4 answered ${res.status}`, attempts);
  }

  const missing = missingAdsCredentials(env);
  if (missing.length) return mark(row.id, "could_not_tell", `not set: ${missing.join(", ")}`, attempts);
  const actionId = conversionActionFor(row.kind, env.GOOGLE_ADS_CONVERSION_ACTIONS);
  if (!actionId) return mark(row.id, "could_not_tell", `GOOGLE_ADS_CONVERSION_ACTIONS names no action for ${row.kind}`, attempts);

  let email: string | null = null;
  let phone: string | null = null;
  let at = row.created_at;
  if (row.order_id) {
    const { data } = await db.from("eng_service_orders").select("customer_email, customer_phone, placed_at").eq("id", row.order_id).maybeSingle();
    email = (data?.customer_email as string | null) ?? null;
    phone = (data?.customer_phone as string | null) ?? null;
  } else if (row.lead_id) {
    const { data } = await db.from("eng_leads").select("email, phone, created_at").eq("id", row.lead_id).maybeSingle();
    email = (data?.email as string | null) ?? null;
    phone = (data?.phone as string | null) ?? null;
    at = (data?.created_at as string | null) ?? at;
  }

  const token = await adsAccessToken(env);
  if (!token) return mark(row.id, "failed", "the OAuth refresh was refused", attempts);
  const customerId = (env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/\D/g, "");
  const body = {
    conversions: [
      adsClickConversion({
        customerId,
        actionId,
        click: { gclid: row.gclid, gbraid: row.gbraid, wbraid: row.wbraid },
        at,
        valueCents: row.value_cents,
        orderId: row.order_id,
        email,
        phone,
      }),
    ],
    partialFailure: true,
  };
  const res = await fetch(`https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${customerId}:uploadClickConversions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
      "content-type": "application/json",
      ...(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { "login-customer-id": env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, "") } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { partialFailureError?: { message?: string } };
  if (!res.ok) return mark(row.id, "failed", `Google Ads answered ${res.status}`, attempts);
  if (json.partialFailureError) return mark(row.id, "failed", `Google Ads refused it: ${json.partialFailureError.message ?? "no reason given"}`, attempts);
  return mark(row.id, "sent", null, attempts);
}

/** Every conversion still owed, sent. Called by the jobs cron; it cannot fail the worker. */
export async function sweepAdConversions(env: Record<string, string | undefined> = process.env): Promise<{ looked: boolean; note: string }> {
  try {
    const db = supabaseAdmin();
    if (!db) return { looked: false, note: "the database is not configured" };
    const { data, error } = await db
      .from("eng_ad_conversions")
      .select("id, created_at, destination, kind, order_id, lead_id, value_cents, gclid, gbraid, wbraid, attempts")
      .in("status", ["pending", "failed", "could_not_tell"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(25);
    if (error) return { looked: false, note: `the read failed: ${error.message}` };
    for (const row of (data ?? []) as Owed[]) {
      try {
        await sendOne(row, env);
      } catch (err) {
        await mark(row.id, "failed", err instanceof Error ? err.message.slice(0, 300) : "the send threw", row.attempts + 1);
      }
    }
    return { looked: true, note: `${(data ?? []).length} conversion(s) tried` };
  } catch (err) {
    await captureError(err, { kind: "ad-conversions", route: "/api/cron/jobs" });
    return { looked: false, note: "the sweep threw" };
  }
}

/** Kept for callers that want the measurement id the browser uses, in one place. */
export const gaMeasurementIdNow = gaMeasurementId;
