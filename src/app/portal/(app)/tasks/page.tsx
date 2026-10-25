import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listTasksPage } from "@/lib/ops-tasks";
import { LIST_NOT_LOADED } from "@/lib/outcome-copy";
import { RetryButton } from "@/components/portal/Unreachable";
import { isOverdue, RECURRENCE_LABEL, type Recurrence } from "@/lib/ops-comms";
import { supabaseAdmin } from "@/lib/supabase";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { QuickAdd, SeedButton, TaskRowControls } from "./TasksClient";
import { formatInFirmZone } from "@/lib/firm-calendar";

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
  value ? (formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? "") : null;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const actor = await currentActor();
  if (!can(actor, "tasks.use")) notFound();
  const params = await searchParams;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);

  /* A failed read is said, never "Nothing on the list" (the 2026-10-12 ruling; listTasks folded it to []). */
  const read = await listTasksPage(actor, { status: params.status, q: params.q, page });
  const tasks = read?.rows ?? [];
  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: params.status, q: params.q, page: n > 1 ? String(n) : undefined })) if (v) next.set(k, v);
    return `/portal/tasks${next.toString() ? `?${next}` : ""}`;
  };

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
        lede="What has to happen, including compliance deadlines."
      />

      <QuickAdd
        people={people.map((p) => ({ id: p.id as string, name: p.display_name as string, role: p.role as string }))}
        canAssign={can(actor, "profiles.list")}
        selfId={actor!.id}
      />

      {/* Only on the unfiltered first page: a search or a later page can hide the seeded tasks without their being absent. */}
      {can(actor, "profiles.list") && read && !params.q && page === 1 && seeded.length === 0 ? (
        <Panel
          title="The compliance obligations are not seeded yet"
          /*
            Operator ruling of 2026-10-08 on the copy. It said "Two of them";
            COMPLIANCE_SEEDS in ops-comms.ts has three with no anchor (the
            TBPELS renewal, the E&O renewal and the credential sweep), and
            firstDueFor gives each of those no due date.
          */
          description="The PE license renewal, the DWC-005 filing, the TBPELS and errors and omissions renewals, and the monthly credential sweep. Three of the five carry no due date until someone enters the real one."
        >
          <SeedButton />
        </Panel>
      ) : null}

      <section>
      {/*
        V10: the filter is three square controls, the chosen one in navy, and
        the overdue count is a plain bold line. It was an amber box.
      */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          ["", "Open"],
          ["all", "Everything"],
          ["done", "Done"],
        ].map(([value, label]) => (
          <a
            key={label}
            href={`/portal/tasks${value || params.q ? `?${new URLSearchParams(Object.entries({ status: value, q: params.q ?? "" }).filter((e) => e[1]))}` : ""}`}
            aria-current={(params.status ?? "") === value ? "page" : undefined}
            className={`inline-flex min-h-[40px] items-center rounded-[var(--radius-control)] border px-3 text-[14px] font-semibold active:opacity-70 ${
              (params.status ?? "") === value
                ? "border-[var(--navy)] bg-[var(--navy)] text-[var(--on-navy)]"
                : "border-[var(--border-strong)] bg-white text-[var(--ink)]"
            }`}
          >
            {label}
          </a>
        ))}
        {overdue.length > 0 ? (
          <span className="ml-2 text-[14px] font-semibold text-[var(--ink)]">
            {overdue.length} overdue{read?.more || page > 1 ? " on this page" : ""}
          </span>
        ) : null}
      </div>

      <form method="get" action="/portal/tasks" role="search" className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
        <label className="min-w-[220px] flex-1">
          <span className="block text-[14px] font-semibold text-[var(--ink)]">Search task titles</span>
          <input name="q" defaultValue={params.q ?? ""} className="mt-1 min-h-[44px] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] px-3 text-[15px]" />
        </label>
        <button type="submit" className="min-h-[44px] rounded-[var(--radius-control)] border border-[var(--navy)] bg-[var(--navy)] px-4 text-[14px] font-semibold text-[var(--on-navy)]">
          Search
        </button>
      </form>

      {!read ? (
        <div role="alert" data-list-not-loaded className="py-6">
          <p className="text-[15px] font-semibold text-[var(--ink)]">{LIST_NOT_LOADED}</p>
          <p className="mt-1 text-[14px] text-[var(--secondary)]">The tasks could not be read, so this is not an empty list.</p>
          <div className="mt-4 flex">
            <RetryButton />
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title={params.q ? "No task matches that search" : params.status === "done" ? "Nothing finished yet" : "Nothing on the list"}
          body={params.q ? "Clear the search to see the whole list." : "Add a title above. Due date, assignee and repeat are optional."}
        />
      ) : (
        /* V10 rule 4: rows separated by a 1px line-2 rule, not bordered cards. */
        <ul className="border-t border-[var(--row-rule)]">
          {tasks.map((task) => {
            const late = isOverdue(task.due_at);
            const derivedTask = task.source_key?.startsWith("credential:");
            return (
              <li key={task.id} className="border-b border-[var(--row-rule)] py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/*
                      break-words on both, because a task title and a task
                      description now routinely carry an EMAIL ADDRESS and an
                      address has no break opportunity in it.

                      Found on the board at 320 the first time a deletion
                      request raised a task: "Deletion request from
                      forgotten.1788978099569@example.com" pushed the scrolling
                      region 8px past itself. /portal/audit had exactly this in
                      Phase 12 Section 2, from suppression summaries, and the
                      fix is the same one. A screen that renders text somebody
                      else typed has to assume the longest unbreakable run in it
                      is an address.
                    */}
                    <p className="text-[15px] leading-[1.35] font-semibold break-words text-[var(--ink)]">
                      {task.title}
                    </p>
                    {task.description ? (
                      <p className="mt-1 max-w-[75ch] text-[14px] leading-[1.55] break-words whitespace-pre-line text-[var(--secondary)]">
                        {task.description}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[13px] text-[var(--secondary)]">
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
      {read && (page > 1 || read.more) ? (
        <nav aria-label="Pages of tasks" className="mt-4 flex gap-3 print:hidden">
          {page > 1 ? (
            <a href={pageHref(page - 1)} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">
              Previous page
            </a>
          ) : null}
          {read.more ? (
            <a href={pageHref(page + 1)} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">
              Next page
            </a>
          ) : null}
        </nav>
      ) : null}
      </section>

      {derived.length > 0 ? (
        <p className="max-w-[75ch] text-[13px] leading-[1.55] text-[var(--secondary)]">
          {/*
            Operator ruling of 2026-10-08 on the copy, read against the code.
            The sentence said these "close themselves when it is replaced", and
            the approved replacement said they "close on their own when the
            credential record is updated". Neither was what happened then:
            refreshCredentialTasks ran only from the seed button. Since the same
            day it runs every day from the credentials.refresh_tasks job, which
            /api/cron/daily queues, and the operator's wording below is true.
          */}
          {derived.length} of these came from the credentials record rather than from a person: one
          for each credential within 45 days of expiry or past it. These tasks are raised and closed
          each day from the credential records.
        </p>
      ) : null}
    </>
  );
}
