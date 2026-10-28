import { quoteFileProblem } from "./ops-intake";

/**
 * THE RULES /api/orders HOLDS A SITE TO BEFORE SEALED'S ORDERING OPENS.
 * Robert's ruling 6 of 2026-10-27, 22:05 Central:
 *
 *   "a 20 a minute per-site limit on /api/orders; a signed upload door for
 *    sister-site files; and a fresh checkout returned when a repeated request
 *    finds an unpaid order."
 *
 * Pure, so each is proved without a database
 * (scripts/proofs/a-site-is-held-to-its-rate-its-files-and-one-checkout.mjs).
 * The reads and writes that feed them are in src/lib/sister-order-door.ts.
 */

/**
 * How many requests one site may make to /api/orders in a minute. Robert's
 * ruling, so it is pinned as a literal in the proof as well (CLAUDE.md 6c):
 * changing it costs two edits made on purpose. The same figure as the sister
 * intake (SISTER_RATE_PER_MINUTE), stated separately because the two doors are
 * separate rulings and one moving must not move the other.
 */
export const SITE_ORDER_RATE_PER_MINUTE = 20;

export type RateRefusal = { status: 429 | 503; error: string };

/**
 * Whether this request is over the limit, from the count of the site's requests
 * in the last minute BEFORE this one. A count that could not be read is not
 * zero: read as zero, the limit would open exactly when the database is in
 * trouble (the sister intake's audit of 2026-10-24).
 */
export function siteOrderRateRefusal(countBefore: number | null): RateRefusal | null {
  if (countBefore === null || !Number.isFinite(countBefore) || countBefore < 0) {
    return { status: 503, error: "The order door could not check its own rate just now. Nothing was placed; send it again." };
  }
  if (countBefore >= SITE_ORDER_RATE_PER_MINUTE) {
    return {
      status: 429,
      error: `More than ${SITE_ORDER_RATE_PER_MINUTE} requests in a minute from this site. Nothing was placed and nothing was charged; wait a minute and send it again.`,
    };
  }
  return null;
}

/**
 * The first attached file a site may not attach to this request, as a
 * sentence, or null. A file must be one this door signed for the same request:
 * in the order uploads bucket, under orders/<clientRequestId>/. A site that
 * names any other object in the bucket is refused, so a key cannot attach a
 * file another request uploaded.
 */
export function siteFileProblem(
  clientRequestId: string,
  files: readonly { key: string; bucket: string; storageKey: string }[],
): string | null {
  for (const f of files) {
    const problem = quoteFileProblem(clientRequestId, f);
    if (problem) return problem;
  }
  return null;
}

/**
 * What a repeated request gets for the order it already placed. An order still
 * waiting for payment gets a checkout opened again, so the calling site has a
 * page to send the customer to. Anything else gets its status and no checkout:
 * a paid order is never offered a second payment page.
 */
export function repeatAnswer(status: string): "checkout" | "status" {
  return status === "awaiting_payment" ? "checkout" : "status";
}
