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
/*
 * EMPTY SINCE ROBERT'S RULING OF 20:08 CENTRAL, 2026-11-15 (issue #1,
 * 6905345382): "make everything for sale that isn't up for sale yet", with the
 * real-estate structural letter named at $709 and a $175 inspection fee. It
 * came off on his word, which is the only way an entry comes off, and it now
 * sells under its line's 254-PL-001.
 *
 * THE ENTRY IT HELD, KEPT FOR ITS REASONING, because the reasoning still
 * describes the risk he accepted: "254-PL-001 covers letters for a permitting
 * authority only; this deliverable opens when the engineer of record confirms
 * in writing that it covers this too, or signs a protocol for it (Robert,
 * answer 11 of 2026-11-14)." If the engineer declines a real-estate job on
 * that scope, the customer is refunded under the line's disclosed terms.
 *
 * The mechanism stays: a future deliverable that must not borrow its line's
 * protocol is one entry here, and the gate, takeJob and order-audit all read it.
 */
export const OWN_PROTOCOL_REQUIRED: Readonly<Record<string, string>> = {};

/**
 * SOLD UNDER ITS LINE'S PROTOCOL, WHOSE DELIVERABLE SENTENCES DO NOT DESCRIBE
 * IT. A deliverable here is sold under its line's protocol, but that protocol's
 * section 11 describes a different letter, so quoting it as what the customer
 * receives would be untrue. Its `receives` stays SCOPE_PENDING until the
 * engineer states its scope. Read only by the receives check
 * (scripts/lib/receives-check.mjs); the gate does not read it and sells the
 * deliverable. Each entry says why, and the check counts them by name.
 */
export const SCOPE_NOT_STATED_BY_ITS_PROTOCOL: Readonly<Record<string, string>> = {
  "structural-letters/real-estate":
    "Sold under 254-PL-001 by Robert's ruling of 20:08 Central 2026-11-15 (6905345382). 254-PL-001's deliverable sentences describe a letter addressed to the permitting authority, which a letter for a buyer or seller is not, so its scope stays pending until the engineer states it.",
};

/** Whether a deliverable is on the list. The key is the gate's own. */
export function ownProtocolRequired(serviceSlug: string, tier: string | null | undefined): string | null {
  return OWN_PROTOCOL_REQUIRED[`${serviceSlug}/${tier ?? ""}`] ?? null;
}
