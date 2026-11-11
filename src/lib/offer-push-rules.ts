/**
 * WEB PUSH FOR A NEW OFFER: WHAT THE LOCK SCREEN SAYS, AND HOW THE SERVER
 * PROVES ITSELF TO THE PUSH SERVICE. Robert's T9 and his answers 6 and 7 of
 * 2026-11-07 (6717223376):
 *
 *   6. "Build web push now as T9. Email stays on by default beside it until
 *      push is proven on Robert's own phone."
 *   7. "'A job is offered to you: county, service', with no address and no
 *      price on the lock screen."
 *
 * Pure, so the proof runs every rule with no network:
 * scripts/proofs/a-phone-hears-of-an-offer-and-the-lock-screen-says-little.mjs.
 *
 * WHY A PUSH CARRIES NO PAYLOAD. A push with a body must be encrypted to the
 * phone's own keys (RFC 8291), which is a second cryptographic system to get
 * right. A push with no body needs only the server's VAPID signature (RFC
 * 8292), and the phone's service worker then asks the firm's own server what
 * to show, over the technician's signed in session. So nothing about a job
 * ever crosses the push service, and the wording is decided where every other
 * rule about what a technician may see is decided.
 */

/** The lock screen's title and line for an offer. County and service, and nothing else. */
export function offerPushText(county: string | null, serviceName: string | null): { title: string; body: string } {
  const where = county ? `${county} County` : null;
  const parts = [where, serviceName].filter((p): p is string => Boolean(p && p.trim()));
  return {
    title: "A job is offered to you",
    body: parts.length ? `A job is offered to you: ${parts.join(", ")}` : "A job is offered to you. Open My jobs to see it.",
  };
}

/** What the lock screen shows when the firm's server cannot be reached to ask. */
export const OFFER_PUSH_FALLBACK = { title: "A job is offered to you", body: "Open My jobs to see it." } as const;

/** Base64url without padding, as VAPID and the Push API use. */
export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(text: string): Uint8Array {
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * The unsigned half of a VAPID token: header and claims, base64url, joined by
 * a dot. The audience is the push service's origin, the expiry is twelve hours
 * on (RFC 8292 allows at most twenty four), and the subject is the firm's
 * contact address so a push service can reach the sender.
 */
export function vapidSigningInput(endpoint: string, subject: string, nowSeconds: number): string {
  const audience = new URL(endpoint).origin;
  const enc = (o: unknown) => base64url(new TextEncoder().encode(JSON.stringify(o)));
  return `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud: audience, exp: nowSeconds + 12 * 60 * 60, sub: subject })}`;
}

/** A push service answering 404 or 410 has forgotten this phone: the subscription is gone for good. */
export function subscriptionGone(status: number): boolean {
  return status === 404 || status === 410;
}

/** The three push services a phone may be reached through (0124's channel column). */
export type PushChannel = "web" | "fcm" | "apns";

/** The channel a request names, defaulting to the browser's, or null when it names something else. */
export function pushChannelFrom(value: unknown): PushChannel | null {
  if (value === undefined || value === null || value === "") return "web";
  return value === "web" || value === "fcm" || value === "apns" ? value : null;
}

/**
 * Whether an endpoint fits its channel, the same rule 0124's check holds: a
 * browser's is an https address, a native one is a device token with no
 * whitespace, of a sane length.
 */
export function endpointFitsChannel(channel: PushChannel, endpoint: unknown): endpoint is string {
  if (channel === "web") return endpointAcceptable(endpoint);
  return typeof endpoint === "string" && endpoint.length >= 16 && endpoint.length <= 4096 && !/\s/.test(endpoint);
}

/** Only an https endpoint, of a sane length, is ever stored or sent to. */
export function endpointAcceptable(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2000) return false;
  try {
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}
