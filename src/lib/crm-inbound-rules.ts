import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * THE REPLY WEBHOOK'S SIGNATURE CHECK. Robert's sales CRM ruling of
 * 2026-11-02, item R7 ("a reply to any email lands in the existing inbox
 * linked to the company"), with his answer 1 (6587550325): a reply subdomain
 * on Resend Inbound.
 *
 * Resend signs its webhooks the Svix way (resend.com/docs, "Verify webhook
 * requests", read 2026-11-02 for docs/crm-sources and the DNS note): the
 * headers svix-id, svix-timestamp and svix-signature; the signed content is
 * "<svix-id>.<svix-timestamp>.<raw body>"; the key is the base64 part of the
 * secret after its "whsec_" prefix; the signature header carries one or more
 * space separated "v1,<base64 HMAC-SHA256>" entries. The raw body is used as
 * it arrived: parsing and re-serializing the JSON breaks the signature.
 *
 * Written here rather than through a library so it is pure and the proof can
 * hold it to a known answer, and so nothing is added to the dependency tree for
 * twenty lines.
 */

/** How far the webhook's timestamp may sit from now: five minutes either way, the Svix default. */
export const TIMESTAMP_TOLERANCE_SECONDS = 300;

export type SvixHeaders = { id: string | null; timestamp: string | null; signature: string | null };

export type SignatureVerdict = { ok: true } | { ok: false; error: string };

function keyOf(secret: string): Buffer | null {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  try {
    const key = Buffer.from(raw, "base64");
    return key.length ? key : null;
  } catch {
    return null;
  }
}

/** The base64 HMAC-SHA256 Svix expects for these parts. Exported so the proof can sign a test request. */
export function svixSignature(secret: string, id: string, timestamp: string, rawBody: string): string | null {
  const key = keyOf(secret);
  if (!key) return null;
  return createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
}

export function verifySvix(secret: string, headers: SvixHeaders, rawBody: string, now: Date): SignatureVerdict {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, error: "missing signature headers" };
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return { ok: false, error: "the timestamp is not a number" };
  if (Math.abs(now.getTime() / 1000 - seconds) > TIMESTAMP_TOLERANCE_SECONDS) return { ok: false, error: "the timestamp is outside five minutes" };
  const expected = svixSignature(secret, id, timestamp, rawBody);
  if (!expected) return { ok: false, error: "the secret is not usable" };
  const want = Buffer.from(expected);
  for (const entry of signature.split(" ")) {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) continue;
    const got = Buffer.from(value);
    if (got.length === want.length && timingSafeEqual(got, want)) return { ok: true };
  }
  return { ok: false, error: "no signature matches" };
}
