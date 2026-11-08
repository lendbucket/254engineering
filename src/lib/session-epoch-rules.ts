/**
 * THE SESSION EPOCH, AUTH M2. Robert's ruling of 2026-11-02 on issue #1
 * (answer to 6586517364): option A, rollout 1.
 *
 * All three session cookies were signed and stateless with no version, so a
 * password change, a reset, a suspension or a replaced second factor changed
 * the record and left every cookie already issued valid until it expired:
 * twelve hours for staff, fourteen days for a partner, thirty for a customer.
 *
 * Each of eng_profiles, eng_customer_users and eng_partner_users now carries a
 * session_epoch (0120, integer, not null, default 0). Every cookie carries the
 * epoch it was issued under, and the reader that already loads the row on
 * every request compares the two: a cookie whose epoch is not the row's is
 * treated as signed out, with no extra query.
 *
 * ROLLOUT 1. A cookie in the shape before this change has one segment fewer,
 * and every reader refuses it. Everybody signs in once more, which is the same
 * price rotating a signing secret already charges, and anything else would let
 * a cookie stolen before the deploy outlive a password change.
 *
 * This file is pure so the proofs can import it without a server.
 */

/** An epoch in a cookie: digits only, no sign, no decimal point, bounded. */
const EPOCH_SEGMENT = /^\d{1,9}$/;

/** Whether a value may be written into a cookie as an epoch. */
export function validEpoch(epoch: unknown): epoch is number {
  return typeof epoch === "number" && Number.isSafeInteger(epoch) && epoch >= 0 && epoch < 1_000_000_000;
}

/** Parse a cookie segment as an epoch, or null for anything that is not one. */
export function parseEpochSegment(segment: string | undefined): number | null {
  if (!segment || !EPOCH_SEGMENT.test(segment)) return null;
  const epoch = Number(segment);
  return validEpoch(epoch) ? epoch : null;
}

/**
 * Whether a cookie issued under `claimEpoch` still stands against the row.
 * An unreadable row epoch is a mismatch: a session the record cannot vouch for
 * is not a session, the same closed door a missing secret is.
 */
export function epochStands(claimEpoch: number, rowEpoch: unknown): boolean {
  return validEpoch(claimEpoch) && validEpoch(rowEpoch) && claimEpoch === rowEpoch;
}

/** The three tables that carry an epoch, and nothing else may be bumped. */
export const EPOCH_TABLES = ["eng_profiles", "eng_customer_users", "eng_partner_users"] as const;
export type EpochTable = (typeof EPOCH_TABLES)[number];
