import "server-only";
import { supabaseAdmin } from "./supabase";
import type { Actor } from "./ops-authz";

/**
 * The audit trail writer.
 *
 * WHY THIS IS NOT OPTIONAL AND NOT BEST EFFORT
 * --------------------------------------------
 * This is the firm's regulatory memory. Every create, update, status change,
 * assignment, upload, review decision, and message writes a row here, and the
 * table refuses UPDATE and DELETE at the trigger level so what is written stays
 * written. A trail that can be edited proves nothing, and a trail with gaps
 * proves less than nothing because it looks complete.
 *
 * WHY A FAILED WRITE IS SWALLOWED RATHER THAN THROWN
 * --------------------------------------------------
 * This is the one deliberate compromise and it is worth stating rather than
 * discovering. If the trail insert fails, the action it describes has usually
 * already happened, so throwing would report a failure for work that succeeded
 * and invite a retry that duplicates it.
 *
 * So a failure is logged to the server and the action proceeds. The honest
 * consequence is that a database in trouble can lose trail rows, and that is
 * accepted because the alternative is worse. What is NOT accepted is silence:
 * scripts/roles-audit.mjs asserts that the actions it performs appear in the
 * trail, so a writer that has quietly stopped working fails a build rather than
 * being noticed a year later by a board investigator.
 *
 * THE ACTOR IS COPIED IN, NOT REFERENCED
 * --------------------------------------
 * actor_email and actor_role are denormalised. A trail row that says "profile
 * 7f3a" and then loses that profile has recorded an event with no actor. The
 * email is whatever it was on the day, forever.
 */

export type AuditInput = {
  actor: Pick<Actor, "id" | "role"> & { email?: string } | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  diff?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  const { error } = await db.from("eng_audit_events").insert({
    actor_id: input.actor?.id ?? null,
    actor_email: input.actor?.email ?? null,
    actor_role: input.actor?.role ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary ?? null,
    diff: input.diff ?? null,
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
  });

  if (error) {
    console.error(`[ops-audit] FAILED to record ${input.action} on ${input.entityType}:`, error.message);
  }
}

/**
 * A diff of what actually changed, for the trail's `diff` column.
 *
 * Only changed keys are kept, and both sides are recorded. A trail entry that
 * stores the whole row on every edit is a trail nobody reads, because finding
 * the one field that moved means comparing two blobs by eye.
 */
export function diffOf(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignore: string[] = ["updated_at"],
): Record<string, { from: unknown; to: unknown }> | null {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (ignore.includes(key)) continue;
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out[key] = { from: a ?? null, to: b ?? null };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Fields that must never be written into the trail, whatever a caller passes.
 *
 * A diff is generated from row data, and a row could one day gain a column that
 * should not be copied into an immutable table. Stripping here rather than
 * trusting every call site means a mistake at a call site is contained.
 */
const NEVER_LOGGED = ["password", "token", "token_hash", "storage_key"];

export function safeDiff(
  diff: Record<string, { from: unknown; to: unknown }> | null,
): Record<string, { from: unknown; to: unknown }> | null {
  if (!diff) return null;
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(diff)) {
    if (NEVER_LOGGED.some((banned) => key.toLowerCase().includes(banned))) {
      out[key] = { from: "[redacted]", to: "[redacted]" };
      continue;
    }
    out[key] = value;
  }
  return out;
}
