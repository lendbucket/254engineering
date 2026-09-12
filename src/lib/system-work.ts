import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { DB_NOW } from "./db-now";
import {
  SYSTEM_ACTOR,
  SYSTEM_ACTOR_EMAIL,
  SYSTEM_ACTOR_ROLE,
  systemMay,
  type SystemCapability,
} from "./system-actor";

/**
 * THE ONLY TWO THINGS THE PLATFORM DOES IN ITS OWN NAME.
 *
 * Operator ruling, 2026-09-12. `src/lib/system-actor.ts` says what the system
 * principal IS and proves at compile time what it is not. This is where it
 * acts, and it is deliberately two functions long.
 *
 * WHY THIS IS A SEPARATE MODULE FROM ops-tasks
 * --------------------------------------------
 * `createTask` takes an `Actor`, checks `status === "active"`, and decides
 * assignment by `can(actor, "profiles.list")`. None of those questions has an
 * answer for a principal with no role, no status and no grants, and making them
 * optional would weaken the check for every human caller to accommodate one
 * non-human.
 *
 * So the platform's path is its own, it writes the same rows, and it cannot
 * reach any of the branches that exist for people. A reader comparing the two
 * can see exactly what the platform can and cannot do, which is the whole
 * reason the principal exists.
 *
 * EVERY ROW NAMES IT, which is the operator's requirement and the point. An
 * auditor reading the trail separates platform-raised work from a person's by
 * `actor_email = the-platform@system.invalid`, without knowing the uuid and
 * without asking anybody.
 */

/**
 * A guard that reads as a sentence at the call site.
 *
 * It can only ever be true, because `SystemCapability` has two members and the
 * platform holds both. That is not a reason to remove it: the day a third
 * capability is added, this is where the decision surfaces, and a call site
 * that reads `if (!allowed("tasks.raise")) return` is one somebody can audit by
 * eye.
 */
function allowed(capability: SystemCapability): boolean {
  return systemMay(capability);
}

/**
 * Raise a task in the platform's own name.
 *
 * NO ASSIGNEE. A task the platform raises is for whoever picks it up, and
 * choosing a person would be the platform deciding somebody's workload. It
 * lands unassigned in the queue everybody sees.
 */
export async function raiseSystemTask(input: {
  title: string;
  description?: string;
  /** ISO date. Optional, and absent is normal: most of these are "when you can". */
  dueAt?: string | null;
  /** For idempotency. A second raise of the same key finds the first. */
  key: string;
}): Promise<{ ok: true; id: string; already: boolean } | { ok: false; error: string }> {
  if (!allowed("tasks.raise")) return { ok: false, error: "The platform may not raise tasks." };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "A task needs a title." };

  /*
   * IDEMPOTENT, BECAUSE A SCHEDULE REPEATS.
   *
   * A monthly access review that ran twice because a cron fired twice would
   * leave two identical tasks, and the operator would attest one and wonder
   * about the other. The key is carried in the description rather than in a new
   * column, because this is the first caller and a column added for one caller
   * is a column the next one uses differently.
   *
   * Open tasks only: last month's completed review must not stop this month's
   * being raised.
   */
  const marker = `[system:${input.key}]`;
  const { data: existing } = await db
    .from("eng_tasks")
    .select("id")
    .eq("created_by", SYSTEM_ACTOR.id)
    .is("completed_at", null)
    .like("description", `%${marker}%`)
    .limit(1);

  if (existing && existing.length > 0) {
    return { ok: true, id: existing[0].id as string, already: true };
  }

  const description = [input.description?.trim(), marker].filter(Boolean).join("\n\n");

  const { data, error } = await db
    .from("eng_tasks")
    .insert({
      title,
      description,
      assignee_id: null,
      created_by: SYSTEM_ACTOR.id,
      due_at: input.dueAt || null,
      priority: "normal",
      file_id: null,
      recurrence: null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not raise the task." };

  await recordSystemAudit({
    action: "task.raise",
    entityType: "task",
    entityId: data.id as string,
    summary: `The platform raised: ${title}`,
  });

  return { ok: true, id: data.id as string, already: false };
}

/**
 * Write an audit row in the platform's own name.
 *
 * Goes through `writeAudit` rather than inserting directly, so the platform's
 * rows are written by the same code path as everybody else's and cannot drift
 * into a different shape. What it fixes is the actor: the id, the email and the
 * role are the platform's and are not parameters.
 */
export async function recordSystemAudit(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  diff?: Record<string, unknown> | null;
}): Promise<void> {
  if (!allowed("audit.write")) return;

  await writeAudit({
    actor: { id: SYSTEM_ACTOR.id, email: SYSTEM_ACTOR_EMAIL, role: SYSTEM_ACTOR_ROLE },
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    summary: input.summary,
    diff: input.diff ?? null,
    /*
     * No ip and no user agent, and that is a fact rather than an omission: the
     * platform did not arrive over the network. A blank here in the trail means
     * exactly what it looks like.
     */
    ip: null,
    userAgent: null,
  });
}

/**
 * The timestamp a system write uses.
 *
 * Re-exported so a caller never reaches for the machine clock. DB_NOW is the
 * literal Postgres resolves to transaction_timestamp(), and the reasoning is in
 * db-now.ts: on 2026-09-11 this machine was 85 seconds ahead of the database.
 */
export { DB_NOW };
