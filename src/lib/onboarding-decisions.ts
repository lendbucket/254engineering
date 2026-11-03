import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit, writeAuditOrRefuse } from "./ops-audit";
import type { Actor } from "./ops-authz";
import { mayOnboardRole } from "./onboarding-scope";
import { setItemDecision } from "./onboarding";
import { queueEmail } from "./ops-jobs";
import { onboardingItemDecision } from "./email-templates";
import { decisionProblem, type DecisionItem } from "./onboarding-decision-rules";

/**
 * ACCEPT OR REJECT ONE ONBOARDING ITEM. Robert's ruling P1, 2026-11-01: "an
 * administrator screen to accept or reject each onboarding item, with a
 * required reason on reject, an audit row, and the person told by email."
 *
 * In this order, each step refusing before the next:
 *   1. who: mayOnboardRole with profiles.update, the same test as editing the
 *      onboarding, so the operations manager decides a technician's items and
 *      never an engineer's;
 *   2. the item and the onboarding are read, and a failed read refuses;
 *   3. the rule (decisionProblem, pure and shared with the screen);
 *   4. the audit row, through writeAuditOrRefuse, so a decision that cannot be
 *      recorded is not made;
 *   5. the write (setItemDecision, which says whether a row changed); a write
 *      that fails is recorded as failed and refused;
 *   6. the email to the person, queued. A queue failure does not undo a
 *      decision already recorded; it is said back to the operator, who can tell
 *      the person another way.
 */

type Context = { ip?: string | null; userAgent?: string | null };

export async function decideOnboardingItem(
  actor: (Actor & { email: string }) | null,
  onboardingId: string,
  itemKey: string,
  decision: string,
  reason: string,
  context: Context = {},
): Promise<{ ok: true; emailed: boolean; emailError?: string } | { ok: false; error: string }> {
  if (!actor) return { ok: false, error: "Not signed in." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: onboarding, error: onboardingError } = await db
    .from("eng_onboardings")
    .select("id, person_name, email, role, activated_at")
    .eq("id", onboardingId)
    .maybeSingle();
  if (onboardingError) return { ok: false, error: `The onboarding could not be read, so nothing was decided: ${onboardingError.message}` };
  if (!onboarding) return { ok: false, error: "That onboarding does not exist." };
  if (!mayOnboardRole(actor, onboarding.role as string, "profiles.update")) return { ok: false, error: "Your role cannot decide this person's checklist." };

  const { data: row, error: itemError } = await db
    .from("eng_onboarding_items")
    .select("item_key, label, status, actor")
    .eq("onboarding_id", onboardingId)
    .eq("item_key", itemKey)
    .maybeSingle();
  if (itemError) return { ok: false, error: `The item could not be read, so nothing was decided: ${itemError.message}` };
  if (!row) return { ok: false, error: "That item is not on this person's checklist." };

  const item: DecisionItem = { itemKey: row.item_key as string, actor: row.actor as DecisionItem["actor"], status: row.status as DecisionItem["status"] };
  const problem = decisionProblem(item, decision, reason, Boolean(onboarding.activated_at));
  if (problem) return { ok: false, error: problem };

  const label = row.label as string;
  const verb = decision === "accepted" ? "Accepted" : "Rejected";
  const recorded = await writeAuditOrRefuse({
    actor,
    action: `onboarding.item_${decision}`,
    entityType: "onboarding",
    entityId: onboardingId,
    summary: `${verb} "${label}" for ${onboarding.person_name}${decision === "rejected" ? `: ${reason.trim()}` : ""}.`,
    ...context,
  });
  if (!recorded.ok) return recorded;

  const written = await setItemDecision({
    onboardingId,
    itemKey,
    decision: decision as "accepted" | "rejected",
    reason: decision === "rejected" ? reason.trim() : undefined,
  });
  if (!written.ok) {
    await writeAudit({
      actor,
      action: `onboarding.item_${decision}_failed`,
      entityType: "onboarding",
      entityId: onboardingId,
      summary: `"${label}" was not ${decision}: ${written.error}`,
      ...context,
    });
    return { ok: false, error: `"${label}" was not ${decision}: ${written.error}` };
  }

  const queued = await queueEmail(
    onboardingItemDecision({
      personName: onboarding.person_name as string,
      personEmail: onboarding.email as string,
      itemLabel: label,
      decision: decision as "accepted" | "rejected",
      reason: decision === "rejected" ? reason.trim() : null,
    }),
  );
  return queued.ok ? { ok: true, emailed: true } : { ok: true, emailed: false, emailError: queued.error };
}
