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
    tone === "bad" ? "text-[#8c1d18]" : tone === "warn" ? "text-[#7a4c05]" : "text-slate";
  return (
    <div className="rounded-[4px] border border-limestone-line bg-white px-4 py-3">
      <p className="text-[11px] font-bold tracking-[0.12em] text-slate-muted uppercase">{label}</p>
      <p className={`mt-1 font-display text-[26px] leading-[1.1] font-bold ${colour}`}>{value}</p>
      {note ? <p className="mt-1 text-[12.5px] leading-[1.5] text-slate-muted">{note}</p> : null}
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-limestone-line">
                <th className="pb-2 text-[11px] font-bold tracking-[0.1em] text-slate-muted uppercase">
                  Kind
                </th>
                <th className="pb-2 text-[11px] font-bold tracking-[0.1em] text-slate-muted uppercase">
                  Safe to run twice because
                </th>
                <th className="pb-2 text-right text-[11px] font-bold tracking-[0.1em] text-slate-muted uppercase">
                  Waiting
                </th>
                <th className="pb-2 text-right text-[11px] font-bold tracking-[0.1em] text-slate-muted uppercase">
                  Dead
                </th>
              </tr>
            </thead>
            <tbody>
              {kinds.map((k) => (
                <tr key={k.kind} className="border-b border-limestone-line last:border-0">
                  <td className="py-2.5 pr-3 align-top font-mono text-[13px] font-semibold text-slate">
                    {k.kind}
                  </td>
                  <td className="py-2.5 pr-3 align-top text-[13px] leading-[1.5] text-slate-muted">
                    {k.natural ? (
                      <span className="mr-1.5 align-middle">
                        <Chip label="Naturally" tone="neutral" />
                      </span>
                    ) : null}
                    {k.idempotency}
                  </td>
                  <td className="py-2.5 text-right align-top font-mono text-[13px] text-slate">
                    {k.pending}
                  </td>
                  <td
                    className={`py-2.5 text-right align-top font-mono text-[13px] ${k.dead > 0 ? "font-bold text-[#8c1d18]" : "text-slate-muted"}`}
                  >
                    {k.dead}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[76ch] text-[12.5px] leading-[1.55] text-slate-muted">
          A lease can expire while a job is still running, so every kind here has to survive being
          run a second time. Each one says how, and the audit refuses a handler that does not.
        </p>
      </Panel>
    </>
  );
}
