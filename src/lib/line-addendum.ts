import "server-only";
import { supabaseAdmin } from "./supabase";
import { SCOPE_ADDENDUM_REQUIRED } from "@/config/engineer-pay";

/**
 * ===========================================================================
 * A DELIVERABLE THE ENGINEER'S AGREEMENT DOES NOT COVER OPENS ON HIS SIGNATURE.
 * ===========================================================================
 *
 * Robert's ruling of 2026-10-26, 07:10 Central (migration 0095). WPI-8 ongoing
 * construction is not in Schedule 2 of the engineer's agreement. It opens
 * through a per_job scope addendum he signs in the portal, and the moment his
 * signature is recorded the line opens at its door.
 *
 * The signed record is the one home. It replaces SIGNED_SCOPE_ADDENDA, a typed
 * list in src/config/engineer-pay.ts that a deploy would have had to keep in
 * step with the database, which is the second home this repository keeps
 * removing. Which deliverables NEED an addendum stays a declaration
 * (SCOPE_ADDENDUM_REQUIRED), because that is a ruling about the agreement and
 * not a fact a signature can change.
 *
 * Read the way every money door read is (ruling 11): a voided signature closes
 * the line at once, a replacement addendum not yet signed closes it, and a
 * failed read closes it and says so.
 */

export type LinePay =
  | { state: "signed"; payCents: number; addendumId: string; engineerId: string; signedAt: string }
  | { state: "unsigned" }
  | { state: "unknown"; why: string };

/** The deliverable key the price book and 0095 use: serviceSlug/tier. */
export function deliverableKey(serviceSlug: string, tier: string | null | undefined): string {
  return `${serviceSlug}/${tier ?? ""}`;
}

/** Whether this deliverable needs a signed scope addendum before any job. */
export function addendumRequired(serviceSlug: string, tier: string | null | undefined): boolean {
  return deliverableKey(serviceSlug, tier) in SCOPE_ADDENDUM_REQUIRED;
}

/** The live signed per_job addendum for a deliverable, through eng_line_pay (0095). */
export async function linePayFor(deliverable: string): Promise<LinePay> {
  const db = supabaseAdmin();
  if (!db) return { state: "unknown", why: "the database is not configured" };
  const { data, error } = await db.rpc("eng_line_pay", { p_deliverable: deliverable });
  if (error) return { state: "unknown", why: `the scope addendum could not be read: ${error.message}` };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { state: "unsigned" };
  return {
    state: "signed",
    payCents: Number(row.pay_cents),
    addendumId: row.addendum_id as string,
    engineerId: row.engineer_id as string,
    signedAt: row.signed_at as string,
  };
}
