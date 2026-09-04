"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RECURRENCES, RECURRENCE_LABEL, type Recurrence, type TaskPriority } from "@/lib/ops-comms";

/**
 * Adding and moving tasks.
 *
 * TWO TAPS, AND THE SECOND ONE IS THE COMMIT
 * ------------------------------------------
 * The field is on the screen already, not behind a button. Tap it, type, tap
 * Add. Everything else lives behind "more", closed by default, because the
 * moment a quick add asks for an assignee and a due date it stops being quick
 * and people go back to keeping the list in their head.
 */

const field =
  "min-h-[48px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";

async function post(payload: Record<string, unknown>) {
  const res = await fetch("/api/portal/comms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string; id?: string; result?: { seeded: number; alreadyThere: number; derived: number } }
    | null;
  if (!res.ok || !body?.ok) throw new Error(body?.error ?? "That did not work.");
  return body;
}

export function QuickAdd({
  people,
  canAssign,
  selfId,
}: {
  people: { id: string; name: string; role: string }[];
  canAssign: boolean;
  selfId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [recurrence, setRecurrence] = useState<Recurrence | "">("");
  const [description, setDescription] = useState("");

  return (
    <form
      className="rounded-[4px] border border-[var(--border)] bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        setError(null);
        try {
          await post({
            action: "create_task",
            title,
            description: description || null,
            assigneeId: assigneeId || null,
            dueAt: dueAt ? new Date(`${dueAt}T09:00:00`).toISOString() : null,
            priority,
            recurrence: recurrence || null,
          });
          setTitle("");
          setDescription("");
          setDueAt("");
          setAssigneeId("");
          setPriority("normal");
          setRecurrence("");
          setMore(false);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That did not work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="task-title" className="sr-only">
        What has to happen
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What has to happen"
          className={field}
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="inline-flex min-h-[var(--tap-target)] shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-6 text-[16px] font-bold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:opacity-50"
        >
          {busy ? "Adding" : "Add"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        className="mt-2 inline-flex min-h-[40px] items-center text-[13.5px] font-semibold text-[var(--secondary)]"
      >
        {more ? "Less" : "Due date, assignee, repeat"}
      </button>

      {more ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="task-due" className="block text-[13.5px] font-semibold text-[var(--navy)]">
              Due
            </label>
            <input
              id="task-due"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={`${field} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="task-priority" className="block text-[13.5px] font-semibold text-[var(--navy)]">
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={`${field} mt-1.5`}
            >
              {(["low", "normal", "high", "urgent"] as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {canAssign ? (
            <div>
              <label htmlFor="task-assignee" className="block text-[13.5px] font-semibold text-[var(--navy)]">
                Assign to
              </label>
              <select
                id="task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className={`${field} mt-1.5`}
              >
                <option value="">Nobody yet</option>
                <option value={selfId}>Me</option>
                {people
                  .filter((p) => p.id !== selfId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
          <div>
            <label htmlFor="task-repeat" className="block text-[13.5px] font-semibold text-[var(--navy)]">
              Repeat
            </label>
            <select
              id="task-repeat"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence | "")}
              className={`${field} mt-1.5`}
            >
              <option value="">Once</option>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="task-description" className="block text-[13.5px] font-semibold text-[var(--navy)]">
              Anything else
            </label>
            <input
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${field} mt-1.5`}
            />
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function SeedButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ seeded: number; alreadyThere: number; derived: number } | null>(null);

  if (done) {
    return (
      <p className="mt-3 text-[13.5px] leading-[1.55] text-[var(--navy)]">
        {done.seeded} seeded, {done.alreadyThere} already there, and {done.derived} raised from
        credentials that are expiring.
      </p>
    );
  }

  return (
    <div className="mt-3">
      {error ? (
        <p role="alert" className="mb-2 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const body = await post({ action: "seed_compliance" });
            setDone(body.result ?? null);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "That did not work.");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white disabled:opacity-50"
      >
        {busy ? "Seeding" : "Seed the compliance tasks"}
      </button>
      <p className="mt-2 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
        Safe to press twice. Anything already there is left alone rather than duplicated, because a
        duplicated compliance task is one somebody closes without doing.
      </p>
    </div>
  );
}

export function TaskRowControls({
  taskId,
  status,
  recurring,
  canAssign,
  assigneeId,
  people,
}: {
  taskId: string;
  status: string;
  recurring: boolean;
  canAssign: boolean;
  assigneeId: string | null;
  people: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function move(next: string) {
    setBusy(true);
    setError(null);
    try {
      const body = await post({ action: "set_task_status", taskId, status: next });
      if (next === "done" && recurring) {
        setNote("Done. The next one is on the list with its date already set.");
      }
      router.refresh();
      void body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      {error ? (
        <p role="alert" className="mb-2 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}
      {note ? <p className="mb-2 text-[13.5px] text-[var(--secondary)]">{note}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {status !== "done" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void move("done")}
            className="inline-flex min-h-[44px] items-center rounded-[3px] bg-slate px-4 text-[13.5px] font-bold text-[var(--navy)]-fg disabled:opacity-50"
          >
            {busy ? "Saving" : "Done"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void move("open")}
            className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-4 text-[13.5px] font-semibold text-[var(--navy)] disabled:opacity-50"
          >
            Reopen
          </button>
        )}

        {status === "open" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void move("in_progress")}
            className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)] disabled:opacity-50"
          >
            Start
          </button>
        ) : null}

        {canAssign ? (
          <select
            aria-label="Assign this task"
            value={assigneeId ?? ""}
            onChange={async (e) => {
              setBusy(true);
              try {
                await post({ action: "assign_task", taskId, assigneeId: e.target.value || null });
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "That did not work.");
              } finally {
                setBusy(false);
              }
            }}
            className="min-h-[44px] rounded-[3px] border border-[var(--border)] bg-white px-2 text-[13.5px] text-[var(--navy)]"
          >
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}
