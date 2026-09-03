import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { raise } from "./ops-notify";
import { credentialsFor } from "./ops-onboarding";
import { CREDENTIAL_LABEL, expiryState } from "./ops-credentials";
import {
  COMPLIANCE_SEEDS,
  canSeeTask,
  credentialTasks,
  firstDueFor,
  isOverdue,
  nextOccurrence,
  type Recurrence,
  type TaskPriority,
  type TaskStatus,
} from "./ops-comms";

/**
 * Tasks, including the ones nobody types.
 *
 * TWO KINDS OF TASK, ONE TABLE
 * ----------------------------
 * A task somebody wrote has no source_key. A task the platform created has one,
 * and the unique index on it means creating the same task twice produces one
 * row. That matters more than it sounds: a duplicated compliance task is worse
 * than a missing one, because somebody closes the copy in front of them and the
 * other copy makes the work look handled.
 */

type Context = { ip?: string | null; userAgent?: string | null };

export type TaskRow = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  created_by: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  file_id: string | null;
  recurrence: string | null;
  source_key: string | null;
  completed_at: string | null;
};

const TASK_COLUMNS =
  "id, created_at, title, description, assignee_id, created_by, due_at, priority, status, file_id, recurrence, source_key, completed_at";

/**
 * Tasks this person may see.
 *
 * Filtered in SQL rather than loaded and hidden. canSeeTask is the same rule and
 * is asserted by comms-audit; this is the query shape of it, and the two must
 * agree. A row a person may not see should never be selected, never serialized,
 * and never sit in a response waiting for a rendering bug.
 */
export async function listTasks(
  actor: Actor | null,
  filters: { status?: string; mine?: boolean } = {},
): Promise<TaskRow[]> {
  const db = supabaseAdmin();
  if (!db || !actor || actor.status !== "active") return [];

  let query = db.from("eng_tasks").select(TASK_COLUMNS);

  if (actor.role !== "admin") {
    query = query.or(`assignee_id.eq.${actor.id},created_by.eq.${actor.id}`);
  } else if (filters.mine) {
    query = query.eq("assignee_id", actor.id);
  }

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  else query = query.not("status", "in", "(done,cancelled)");

  const { data } = await query
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);

  return ((data ?? []) as TaskRow[]).filter((t) =>
    canSeeTask(actor, { assigneeId: t.assignee_id, createdBy: t.created_by, fileId: t.file_id }),
  );
}

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority;
  fileId?: string | null;
  recurrence?: Recurrence | null;
};

/**
 * Create a task.
 *
 * DELIBERATELY ALMOST NOTHING IS REQUIRED
 * ---------------------------------------
 * A title. That is the whole requirement, and it is what makes the two tap
 * creation on a phone possible: an operator standing somewhere thinks of
 * something, types it, and it exists. Everything else is optional and can be
 * filled in later by whoever picks it up.
 *
 * A form that demanded an assignee and a due date would be a form people stop
 * using, and the tasks would go back to living in somebody's head.
 */
export async function createTask(
  actor: Actor & { email: string },
  input: CreateTaskInput,
  context: Context = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!actor || actor.status !== "active") return { ok: false, error: "You are not signed in." };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "A task needs a title." };
  if (title.length > 200) return { ok: false, error: "That title is too long. Put the detail in the description." };

  /*
   * Only an administrator assigns work to somebody else. Anybody can make a
   * task for themselves, because a platform where you cannot write down your
   * own next action is one people keep a separate list beside.
   */
  const assigneeId =
    input.assigneeId && input.assigneeId !== actor.id
      ? can(actor, "profiles.list")
        ? input.assigneeId
        : null
      : (input.assigneeId ?? null);

  if (input.assigneeId && input.assigneeId !== actor.id && !can(actor, "profiles.list")) {
    return { ok: false, error: "Only an administrator assigns a task to somebody else." };
  }

  const { data, error } = await db
    .from("eng_tasks")
    .insert({
      title,
      description: input.description?.trim() || null,
      assignee_id: assigneeId,
      created_by: actor.id,
      due_at: input.dueAt || null,
      priority: input.priority ?? "normal",
      file_id: input.fileId || null,
      recurrence: input.recurrence ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the task." };

  if (assigneeId && assigneeId !== actor.id) {
    await notifyAssignee(assigneeId, title, data.id as string, input.dueAt ?? null);
  }

  await writeAudit({
    actor,
    action: "task.create",
    entityType: "task",
    entityId: data.id,
    summary: `Created task: ${title}`,
    ...context,
  });
  return { ok: true, id: data.id as string };
}

async function notifyAssignee(profileId: string, title: string, taskId: string, dueAt: string | null) {
  const db = supabaseAdmin();
  if (!db) return;
  const { data: person } = await db
    .from("eng_profiles")
    .select("role, email")
    .eq("id", profileId)
    .maybeSingle();
  if (!person) return;
  await raise({
    profileId,
    role: person.role as Actor["role"],
    kind: "task.assigned",
    title: `A task is assigned to you: ${title}`,
    body: dueAt ? `Due ${new Date(dueAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.` : null,
    href: "/portal/tasks",
    entityType: "task",
    entityId: taskId,
    email: person.email as string,
  });
}

/**
 * Move a task, and roll a recurring one forward.
 *
 * A RECURRING TASK COMPLETED PRODUCES THE NEXT ONE IMMEDIATELY
 * -------------------------------------------------------------
 * Not on a schedule somebody has to run. The moment a monthly compliance task is
 * marked done, the next month's exists with a due date, which means the list is
 * never empty of the thing that has to happen next and nobody has to remember
 * to re-create it.
 *
 * The new task is a fresh row with recurs_from_id pointing back, so the history
 * of a recurring obligation is a chain rather than one row that keeps being
 * reopened and loses its own past.
 */
export async function setTaskStatus(
  actor: Actor & { email: string },
  taskId: string,
  status: TaskStatus,
  context: Context = {},
): Promise<{ ok: true; nextId?: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: task } = await db.from("eng_tasks").select(TASK_COLUMNS).eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "That task does not exist." };

  const row = task as TaskRow;
  if (!canSeeTask(actor, { assigneeId: row.assignee_id, createdBy: row.created_by, fileId: row.file_id })) {
    return { ok: false, error: "That task is not yours." };
  }

  const done = status === "done";
  const { error } = await db
    .from("eng_tasks")
    .update({ status, completed_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  let nextId: string | undefined;
  if (done && row.recurrence) {
    const from = row.due_at ? new Date(row.due_at) : new Date();
    const next = nextOccurrence(row.recurrence as Recurrence, from);
    const { data: created } = await db
      .from("eng_tasks")
      .insert({
        title: row.title,
        description: row.description,
        assignee_id: row.assignee_id,
        created_by: row.created_by,
        due_at: next.toISOString(),
        priority: row.priority,
        file_id: row.file_id,
        recurrence: row.recurrence,
        recurs_from_id: taskId,
        /*
         * The source_key does NOT carry forward. It is a uniqueness constraint
         * on "this task exists", and the next occurrence is a different task;
         * carrying it would make the insert collide with the one just completed.
         */
      })
      .select("id")
      .single();
    nextId = created?.id as string | undefined;
  }

  await writeAudit({
    actor,
    action: "task.status",
    entityType: "task",
    entityId: taskId,
    summary: `${row.title}: ${status}${nextId ? ", next occurrence created" : ""}`,
    ...context,
  });
  return { ok: true, nextId };
}

export async function assignTask(
  actor: Actor & { email: string },
  taskId: string,
  assigneeId: string | null,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.list")) return { ok: false, error: "Only an administrator reassigns a task." };

  const { data: task } = await db.from("eng_tasks").select("id, title, due_at").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "That task does not exist." };

  const { error } = await db.from("eng_tasks").update({ assignee_id: assigneeId }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  if (assigneeId && assigneeId !== actor.id) {
    await notifyAssignee(assigneeId, task.title as string, taskId, (task.due_at as string | null) ?? null);
  }

  await writeAudit({
    actor,
    action: "task.assign",
    entityType: "task",
    entityId: taskId,
    summary: `${task.title}: assigned`,
    ...context,
  });
  return { ok: true };
}

// ------------------------------------------------------- the ones nobody types

export type SeedResult = { seeded: number; alreadyThere: number; derived: number };

/**
 * Create the compliance tasks, and refresh the credential derived ones.
 *
 * Safe to run repeatedly, which is the point: the source_key unique index turns
 * a second run into no change rather than a second copy. It is run from the
 * tasks screen by an administrator rather than on a timer, because there is no
 * scheduler in this stack and pretending otherwise would mean a seed that
 * silently never happens.
 */
export async function seedComplianceTasks(
  actor: Actor & { email: string },
  context: Context = {},
): Promise<{ ok: true; result: SeedResult } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.list")) return { ok: false, error: "Only an administrator seeds compliance tasks." };

  const now = new Date();
  let seeded = 0;
  let alreadyThere = 0;

  for (const seed of COMPLIANCE_SEEDS) {
    const { data: existing } = await db
      .from("eng_tasks")
      .select("id")
      .eq("source_key", `seed:${seed.key}`)
      .maybeSingle();
    if (existing) {
      alreadyThere++;
      continue;
    }
    const due = firstDueFor(seed, now);
    const { error } = await db.from("eng_tasks").insert({
      title: seed.title,
      description: seed.description,
      created_by: actor.id,
      // Unanchored obligations get NO due date. The operator sets it when the
      // real date exists, and an empty field asks a question where a guessed
      // date would answer it wrongly and stop asking.
      due_at: due ? due.toISOString() : null,
      priority: seed.priority,
      recurrence: seed.recurrence,
      source_key: `seed:${seed.key}`,
    });
    if (!error) seeded++;
  }

  const derived = await refreshCredentialTasks(actor);
  return { ok: true, result: { seeded, alreadyThere, derived } };
}

/**
 * One task per expiring or expired credential, refreshed.
 *
 * A credential that has been renewed no longer produces a task, and its old task
 * is closed rather than left open forever. That is the difference between a
 * derived list and a seeded one: the derived list is allowed to shrink.
 */
export async function refreshCredentialTasks(actor: Actor & { email: string }): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;

  const { data: techs } = await db
    .from("eng_profiles")
    .select("id, display_name")
    .in("role", ["field_tech", "engineer"]);
  if (!techs?.length) return 0;

  const nameById = new Map(techs.map((t) => [t.id as string, t.display_name as string]));
  const held = await credentialsFor(techs.map((t) => t.id as string));

  const expiring = [];
  for (const [profileId, credentials] of held) {
    for (const credential of credentials) {
      if (credential.status !== "verified") continue;
      const state = expiryState(credential.expiresOn);
      if (state !== "expiring" && state !== "expired") continue;
      expiring.push({
        credentialId: credential.id,
        profileId,
        personName: nameById.get(profileId) ?? "A technician",
        kindLabel: CREDENTIAL_LABEL[credential.kind] ?? credential.kind,
        expiresOn: credential.expiresOn as string,
        state,
      });
    }
  }

  const wanted = credentialTasks(expiring);
  const wantedKeys = new Set(wanted.map((t) => t.key));

  for (const task of wanted) {
    const { data: existing } = await db
      .from("eng_tasks")
      .select("id, status")
      .eq("source_key", task.key)
      .maybeSingle();
    if (existing) {
      // Update rather than duplicate. The date or the state may have moved.
      await db
        .from("eng_tasks")
        .update({ title: task.title, description: task.description, due_at: task.dueAt, priority: task.priority })
        .eq("id", existing.id);
      continue;
    }
    await db.from("eng_tasks").insert({
      title: task.title,
      description: task.description,
      created_by: actor.id,
      due_at: task.dueAt,
      priority: task.priority,
      source_key: task.key,
    });
  }

  /*
   * Anything that was derived and is no longer wanted has been renewed. Close
   * it rather than deleting it, so the record that it was once a problem
   * survives.
   */
  const { data: stale } = await db
    .from("eng_tasks")
    .select("id, source_key")
    .like("source_key", "credential:%")
    .not("status", "in", "(done,cancelled)");
  for (const row of stale ?? []) {
    if (!wantedKeys.has(row.source_key as string)) {
      await db
        .from("eng_tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  return wanted.length;
}

/** Counts for the dashboard and the tab bar. */
export async function taskCounts(actor: Actor | null): Promise<{ open: number; overdue: number }> {
  const tasks = await listTasks(actor);
  return {
    open: tasks.length,
    overdue: tasks.filter((t) => isOverdue(t.due_at)).length,
  };
}
