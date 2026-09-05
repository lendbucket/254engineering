import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listTasks } from "@/lib/ops-tasks";
import { isOverdue, RECURRENCE_LABEL, type Recurrence } from "@/lib/ops-comms";
import { supabaseAdmin } from "@/lib/supabase";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { QuickAdd, SeedButton, TaskRowControls } from "./TasksClient";

export const dynamic = "force-dynamic";

/**
 * Tasks.
 *
 * THE ADD BOX IS THE FIRST THING ON THE SCREEN
 * --------------------------------------------
 * Not behind a button, not in a modal. On a phone the whole interaction is: tap
 * the field, type, tap Add. Two taps, and the second one is the commit.
 *
 * That shape is why createTask requires only a title. A form that demanded an
 * assignee and a due date would be one people stop using, and the tasks would go
 * back to living in somebody's head, which is where they were.
 *
 * WHY COMPLIANCE TASKS SIT IN THE SAME LIST
 * -----------------------------------------
 * A separate compliance screen is a screen nobody opens. The obligations that go
 * wrong quietly do so precisely because they are filed somewhere ceremonial. Put
 * them in the list somebody already looks at every day and they get done.
 */

const PRIORITY_TONE: Record<string, "neutral" | "good" | "warn" | "bad"> = {
  low: "neutral",
  normal: "neutral",
  high: "warn",
  urgent: "bad",
};

const when = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await currentActor();
  if (!can(actor, "tasks.use")) notFound();
  const params = await searchParams;

  const tasks = await listTasks(actor, { status: params.status });

  const db = supabaseAdmin();
  const people = can(actor, "profiles.list") && db
    ? ((
        await db.from("eng_profiles").select("id, display_name, role").eq("status", "active").order("display_name")
      ).data ?? [])
    : [];

  const overdue = tasks.filter((t) => isOverdue(t.due_at));
  const seeded = tasks.filter((t) => t.source_key?.startsWith("seed:"));
  const derived = tasks.filter((t) => t.source_key?.startsWith("credential:"));

  return (
    <>
      <PageHead
        eyebrow="Work"
        title="Tasks"
        lede="What has to happen, including the compliance obligations that go wrong quietly when nobody is watching."
      />

      <QuickAdd
        people={people.map((p) => ({ id: p.id as string, name: p.display_name as string, role: p.role as string }))}
        canAssign={can(actor, "profiles.list")}
        selfId={actor!.id}
      />

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-2">
        {[
          ["", "Open"],
          ["all", "Everything"],
          ["done", "Done"],
        ].map(([value, label]) => (
          <a
            key={label}
            href={`/portal/tasks${value ? `?status=${value}` : ""}`}
            className={`inline-flex min-h-[40px] items-center rounded-[3px] border px-3 text-[13.5px] font-semibold ${
              (params.status ?? "") === value
                ? "border-slate bg-slate text-[var(--on-navy)]"
                : "border-[var(--border)] text-[var(--secondary)]"
            }`}
          >
            {label}
          </a>
        ))}
        {overdue.length > 0 ? (
          <span className="inline-flex min-h-[40px] items-center rounded-[3px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 text-[13.5px] font-semibold text-[var(--red)]">
            {overdue.length} overdue
          </span>
        ) : null}
      </div>

      {can(actor, "profiles.list") && seeded.length === 0 ? (
        <div className="mb-5 rounded-[4px] border border-[var(--border)] bg-white px-4 py-4">
          <p className="text-[13.5px] font-semibold text-[var(--navy)]">The compliance obligations are not seeded yet</p>
          <p className="mt-1.5 max-w-[75ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
            The PE licence renewal, the DWC-005 filing, the TBPELS and errors and omissions renewals,
            and the monthly credential sweep. Two of them carry no due date on purpose, because
            nobody has given one and a guessed compliance deadline is worse than an empty field.
          </p>
          <SeedButton />
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState
          title={params.status === "done" ? "Nothing finished yet" : "Nothing on the list"}
          body="Type a title above and it exists. Everything else about a task is optional and can be filled in by whoever picks it up."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => {
            const late = isOverdue(task.due_at);
            const derivedTask = task.source_key?.startsWith("credential:");
            return (
              <li
                key={task.id}
                className={`rounded-[4px] border bg-white p-4 ${
                  late
                    ? "border-[var(--warn-border)] border-l-[var(--red)]"
                    : task.priority === "urgent"
                      ? "border-[var(--border)]"
                      : "border-[var(--border)]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] leading-[1.35] font-semibold text-[var(--navy)]">{task.title}</p>
                    {task.description ? (
                      <p className="mt-1 max-w-[75ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                        {task.description}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[12.5px] text-[var(--secondary)]">
                      {task.due_at ? `Due ${when(task.due_at)}` : "No due date"}
                      {task.recurrence ? `, ${RECURRENCE_LABEL[task.recurrence as Recurrence] ?? task.recurrence}` : ""}
                      {task.assignee_id
                        ? `, ${people.find((p) => p.id === task.assignee_id)?.display_name ?? "assigned"}`
                        : ", unassigned"}
                      {derivedTask ? ", from the credentials record" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {late ? <Chip label="Overdue" tone="bad" /> : null}
                    {task.priority !== "normal" ? (
                      <Chip label={task.priority} tone={PRIORITY_TONE[task.priority] ?? "neutral"} />
                    ) : null}
                  </div>
                </div>

                <TaskRowControls
                  taskId={task.id}
                  status={task.status}
                  recurring={Boolean(task.recurrence)}
                  canAssign={can(actor, "profiles.list")}
                  assigneeId={task.assignee_id}
                  people={people.map((p) => ({ id: p.id as string, name: p.display_name as string }))}
                />
              </li>
            );
          })}
        </ul>
      )}

      {derived.length > 0 ? (
        <p className="mt-6 max-w-[75ch] text-[12.5px] leading-[1.55] text-[var(--secondary)]">
          {derived.length} of these came from the credentials record rather than from a person. They
          appear when a document is inside 45 days of expiry and close themselves when it is
          replaced, so the list shrinks on its own rather than filling with things somebody already
          handled.
        </p>
      ) : null}
    </>
  );
}
