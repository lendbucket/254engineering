import { createHash } from "node:crypto";

/**
 * THE PURE RULES OF THE SERVER SIDE CONVERSIONS (src/lib/ad-conversions.ts),
 * kept apart from the database and the network so a proof can drive them:
 * which credentials are missing, which conversion action a kind counts toward,
 * Google's normalisation and hashing for enhanced conversions, and the exact
 * shapes sent to the Google Ads API and the GA4 Measurement Protocol. Robert's
 * add-on of 2026-11-15, items 10 to 12.
 * Proved by scripts/proofs/a-conversion-is-owed-once-and-said-when-it-cannot-go.mjs.
 */

export type ConversionKind = "order_paid" | "offline_order" | "callback" | "email_price" | "inquiry";
export type Destination = "ga4" | "google_ads";

/** Which Google Ads names are missing from an environment. Empty means every one is set. */
export function missingAdsCredentials(env: Record<string, string | undefined>): string[] {
  const needed = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CONVERSION_ACTIONS"];
  return needed.filter((n) => !env[n]);
}

export function gaMeasurementIdFrom(env: Record<string, string | undefined>): string | null {
  const id = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return id && /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

export function missingGa4Credentials(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  if (!env.GA4_API_SECRET) missing.push("GA4_API_SECRET");
  if (!gaMeasurementIdFrom(env)) missing.push("NEXT_PUBLIC_GA_MEASUREMENT_ID");
  return missing;
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

/** A value inside a PostgREST or=() filter, double quoted, with the two characters that could end the quote removed. */
export function orValue(v: string): string {
  return `"${v.replace(/["\\]/g, "")}"`;
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
  const email = hashedEmail(input.email);
  const phone = hashedPhone(input.phone);
  const identifiers = [...(email ? [{ hashedEmail: email }] : []), ...(phone ? [{ hashedPhoneNumber: phone }] : [])];
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

/**
 * Why a price email sequence stops, or null when it may go on (item 14). The
 * order and the list are asked before every send; the first that answers stops
 * it for good.
 */
export function priceEmailStopReason(input: { ordered: boolean; suppressed: boolean; step: number; stopped: boolean }): string | null {
  if (input.stopped) return "complete";
  if (input.ordered) return "ordered";
  if (input.suppressed) return "suppressed";
  if (input.step >= 3) return "complete";
  return null;
}
