/**
 * ===========================================================================
 * DELIVERABLES THAT OPEN ONLY ON A PROTOCOL OF THEIR OWN. Robert's answer 11 of
 * 2026-11-14 on issue #1: "Do not sell it until Aman confirms in writing that
 * 254-PL-001 covers it or signs a protocol for it."
 * ===========================================================================
 *
 * The gate (signedInDatabase in src/lib/line-gate.ts) falls back from a
 * deliverable with no protocol of its own to its line's general one, so a new
 * structural-letters deliverable would open on 254-PL-001's signature, whose
 * own Scope excludes "a letter for any reader other than a permitting
 * authority". A deliverable listed here is asked only for a protocol
 * registered for its exact tier; with none, the gate closes it, takeJob refuses
 * it, and order-audit holds it outside the orderable set, counted and named.
 *
 * Configuration, beside SCOPE_ADDENDUM_REQUIRED (engineer-pay.ts), so a deploy
 * made on Robert's word is the only way an entry comes off. Keyed
 * "<serviceSlug>/<tier>", the gate's deliverableKey.
 */
export const OWN_PROTOCOL_REQUIRED: Readonly<Record<string, string>> = {
  "structural-letters/real-estate":
    "254-PL-001 covers letters for a permitting authority only; this deliverable opens when the engineer of record confirms in writing that it covers this too, or signs a protocol for it (Robert, answer 11 of 2026-11-14).",
};

/** Whether a deliverable is on the list. The key is the gate's own. */
export function ownProtocolRequired(serviceSlug: string, tier: string | null | undefined): string | null {
  return OWN_PROTOCOL_REQUIRED[`${serviceSlug}/${tier ?? ""}`] ?? null;
}
