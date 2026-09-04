import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import {
  queueHealth,
  deadLetters,
  registeredKinds,
  handlerFor,
  loadHandlers,
} from "@/lib/ops-jobs";
import { BATCH_SIZE, LEASE_SECONDS, MAX_DELAY_MS } from "@/lib/job-rules";
import { Chip, EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { QueueClient } from "./QueueClient";

export const dynamic = "force-dynamic";

/**
 * The queue, made visible.
 *
 * THE RULE THIS SCREEN EXISTS TO SERVE
 * ------------------------------------
 * A job that did not run must be visible. Everything on this page is chosen
 * against that: the count of work waiting, how long the oldest piece has been
 * waiting, and every job that gave up entirely with the error it gave up on.
 *
 * WHY AN UNREADABLE QUEUE IS NOT A QUIET ONE
 * ------------------------------------------
 * queueHealth returns null when the read failed, and this renders that as a
 * failure rather than as zeros. A dashboard that shows "0 waiting" because it
 * could not look is the precise defect this whole section was built to remove,
 * and it would be an unusually cruel place to reintroduce it.
 *
 * WHY THE REGISTRY IS ON THE PAGE
 * -------------------------------
 * The kinds table is rendered from the live registry, not from a list typed
 * here, which is why loadHandlers is awaited before it is read: the registry is
 * populated on demand and a page that read it first would show an empty table.
 *
 * A kind that stops being registered vanishes from this screen, which is the
 * symptom an operator would otherwise chase for an hour: enqueues refused for a
 * kind nobody can see is missing.
 *
 * WHY THE KINDS ARE A LIST AND NOT A TABLE
 * ----------------------------------------
 * The first version was a four column table with a min width, scrolling inside
 * its own container. That satisfies the mobile rule and the page overflow was
 * zero, but at 390 it rendered as "SAFE TO RUN TWICE BECAU" against the edge
 * with nothing saying it could be scrolled. Content clipped with no affordance
 * is content nobody reads. Stacked, both counts sit beside the name and the
 * reason gets a full line at every width.
 */

const AGE = (seconds: number) => {
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hours`;
};

function Figure({
  label,
  value,
  tone = "neutral",
  note,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warn" | "bad";
  note?: string;
}) {
  const colour =
    tone === "bad" ? "text-[var(--red)]" : tone === "warn" ? "text-[var(--warn-ink)]" : "text-[var(--navy)]";
  return (
    <div className="rounded-[4px] border border-[var(--border)] bg-white px-4 py-3">
      <p className="portal-kicker text-[var(--secondary)]">{label}</p>
      <p className={`mt-1 font-display text-[24px] leading-[1.1] font-bold ${colour}`}>{value}</p>
      {note ? <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--secondary)]">{note}</p> : null}
    </div>
  );
}

export default async function QueuePage() {
  const actor = await currentActor();
  if (!can(actor, "jobs.manage")) notFound();

  await loadHandlers();
  const [health, dead] = await Promise.all([queueHealth(), deadLetters()]);

  const kinds = registeredKinds()
    .map((kind) => {
      const handler = handlerFor(kind);
      const counts = health?.byKind.find((k) => k.kind === kind);
      return {
        kind,
        idempotency:
          handler?.idempotency === "naturally"
            ? (handler.why ?? "declared naturally idempotent")
            : "deduped on an idempotency key",
        natural: handler?.idempotency === "naturally",
        pending: counts?.pending ?? 0,
        dead: counts?.dead ?? 0,
      };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind));

  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Job queue"
        lede={`Work that leaves a request and runs on the worker. The worker claims up to ${BATCH_SIZE} jobs a minute and holds each on a ${LEASE_SECONDS} second lease, so a job whose worker is killed comes back rather than disappearing.`}
      />

      {health === null ? (
        <ErrorState
          title="The queue could not be read"
          body="This is not an empty queue. The read against eng_jobs failed, so nothing on this page can be trusted, and jobs may be piling up unseen. Check the database connection before assuming the queue is quiet."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure
              label="Waiting"
              value={String(health.pending)}
              tone={health.overdue > 50 ? "warn" : "neutral"}
              note={
                health.overdue === health.pending
                  ? "all of it eligible now"
                  : `${health.overdue} eligible now, the rest backing off`
              }
            />
            <Figure
              label="Running"
              value={String(health.running)}
              note={`leased for up to ${LEASE_SECONDS}s each`}
            />
            <Figure
              label="Oldest wait"
              value={health.oldestWaitingSeconds === null ? "none" : AGE(health.oldestWaitingSeconds)}
              tone={
                health.oldestWaitingSeconds !== null && health.oldestWaitingSeconds > 600
                  ? "warn"
                  : "neutral"
              }
              note={
                health.oldestWaitingSeconds !== null && health.oldestWaitingSeconds > 600
                  ? "longer than a few minutes means the worker is not running"
                  : "time the oldest eligible job has been waiting"
              }
            />
            <Figure
              label="Gave up"
              value={String(health.dead)}
              tone={health.dead > 0 ? "bad" : "neutral"}
              note={health.dead > 0 ? "these need a person" : "nothing has exhausted its retries"}
            />
          </div>

          <Panel
            title="Dead letters"
            description="Jobs that used every attempt and stopped. Nothing retries these on its own, which is the point: they are here because they need a decision."
            className="mt-6"
          >
            {dead.length === 0 ? (
              <EmptyState
                title="Nothing has given up"
                body={`A job retries with a growing delay, capped at ${Math.round(MAX_DELAY_MS / 60000)} minutes, and lands here only when it has used every attempt or failed in a way that cannot be fixed by trying again. When one arrives it stays until somebody retries it by hand.`}
              />
            ) : (
              <QueueClient
                jobs={dead.map((j) => ({
                  id: j.id as number,
                  kind: j.kind as string,
                  attempts: Number(j.attempts),
                  maxAttempts: Number(j.max_attempts),
                  lastError: (j.last_error as string) ?? "",
                  payload: (j.payload ?? {}) as Record<string, unknown>,
                  createdAt: j.created_at as string,
                  finishedAt: (j.finished_at as string) ?? null,
                }))}
              />
            )}
          </Panel>
        </>
      )}

      <Panel
        title="What runs on the queue"
        description="Read from the live registry. A kind missing from this list is a kind whose enqueues are being refused."
        className="mt-6"
      >
        <ul className="divide-y divide-limestone-line">
          {kinds.map((k) => (
            <li key={k.kind} className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 py-3 first:pt-0 last:pb-0">
              <span className="font-mono text-[13.5px] font-semibold text-[var(--navy)]">{k.kind}</span>
              <span className="text-[12.5px] text-[var(--secondary)]">
                {k.pending} waiting
              </span>
              <span
                className={k.dead > 0 ? "text-[12.5px] font-bold text-[var(--red)]" : "text-[12.5px] text-[var(--secondary)]"}
              >
                {k.dead} dead
              </span>
              {k.natural ? <Chip label="Naturally" tone="neutral" /> : null}
              <p className="w-full max-w-[76ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                {k.idempotency}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-[76ch] text-[12.5px] leading-[1.55] text-[var(--secondary)]">
          A lease can expire while a job is still running, so every kind here has to survive being
          run a second time. Each one says how, and the audit refuses a handler that does not.
        </p>
      </Panel>
    </>
  );
}
