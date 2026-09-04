import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { queueHealth } from "@/lib/ops-jobs";
import {
  cronStates,
  dependencyStates,
  recentErrors,
  RELEASE,
  ENVIRONMENT,
} from "@/lib/ops-observability";
import { metricsSince, METRICS } from "@/lib/ops-metrics";
import { RATE_WINDOW_MINUTES, RATE_THRESHOLD } from "@/lib/alert-rules";
import { Chip, EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { StatusClient } from "./StatusClient";

export const dynamic = "force-dynamic";

/**
 * Everything this platform knows about itself, on one screen.
 *
 * THE RULE THIS PAGE SERVES
 * -------------------------
 * A stalled cron must read as stalled. That is harder than it sounds, because
 * the natural way to build this page produces the opposite: read the last
 * successful run, print the time, done. A cron that stopped firing an hour ago
 * then shows a timestamp from an hour ago, and a timestamp is not a verdict.
 * Somebody glancing at the page sees a date and moves on.
 *
 * So every row on this page carries a verdict AND the timestamp it was derived
 * from, and the verdict is computed against the interval that cron is supposed
 * to run at. "Last run 09:12" says nothing. "Stalled, last succeeded 74 minutes
 * ago, expected every minute" says the thing.
 *
 * AND NEVER RUN IS NOT THE SAME AS STALLED
 * ----------------------------------------
 * A cron with no rows at all has either never been scheduled or has never once
 * succeeded, and those send an operator somewhere completely different from a
 * cron that was working this morning. They are separate verdicts.
 *
 * WHAT AN UNREADABLE SECTION LOOKS LIKE
 * -------------------------------------
 * A failure, never zeros. Every source function on this page returns null when
 * its read failed, and every section below renders that null as an explicit
 * "could not be read" rather than as an empty list. A status page that reports
 * everything healthy because it could not look is the precise thing a status
 * page exists to prevent.
 */

const AGO = (iso: string | null) => {
  if (!iso) return "never";
  const seconds = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 90) return `${seconds}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} hours ago`;
  return `${Math.round(seconds / 86400)} days ago`;
};

const STAMP = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "UTC", hour12: false }) + " UTC" : "";

const VERDICT_TONE = {
  healthy: "good",
  late: "warn",
  stalled: "bad",
  "never run": "bad",
  unreadable: "bad",
} as const;

export default async function StatusPage() {
  const actor = await currentActor();
  if (!can(actor, "jobs.manage")) notFound();

  const [deps, crons, queue, errors, metrics] = await Promise.all([
    dependencyStates(),
    cronStates(),
    queueHealth(),
    recentErrors(60),
    metricsSince(14),
  ]);

  const yesterday = metrics
    ? metrics.filter((m) => m.day === [...new Set(metrics.map((x) => x.day))].sort().reverse()[0])
    : [];
  const latestDay = yesterday[0]?.day ?? null;
  const figure = (metric: string) => yesterday.find((m) => m.metric === metric)?.value ?? null;

  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Platform status"
        lede={`What this deployment can reach, what has run, and what has been failing. Release ${RELEASE} on ${ENVIRONMENT}. Every figure carries the time it was read, because a number with no timestamp cannot be told from a number that stopped updating.`}
      />

      {/* ------------------------------------------------------ dependencies */}
      <Panel
        title="What this deployment depends on"
        description="Configured means the credential is present. Checked means something actually asked. They are different claims and the page never conflates them."
      >
        <ul className="divide-y divide-limestone-line">
          {deps.map((d) => (
            <li key={d.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 py-3 first:pt-0 last:pb-0">
              <span className="text-[14px] font-semibold text-slate">{d.name}</span>
              {!d.configured ? (
                <Chip label="Not configured" tone="warn" />
              ) : d.reachable === true ? (
                <Chip label="Answering" tone="good" />
              ) : d.reachable === false ? (
                <Chip label="Not answering" tone="bad" />
              ) : (
                <Chip label="Configured, not checked" tone="neutral" />
              )}
              <p className="w-full max-w-[76ch] text-[13px] leading-[1.55] text-slate-muted">
                {d.detail}
                <span className="text-slate-muted"> Read {AGO(d.checkedAt)}.</span>
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ------------------------------------------------------------- crons */}
      <Panel
        title="Scheduled jobs"
        description="The verdict is computed against how often each one is supposed to run. A timestamp on its own is not a verdict: it looks the same whether the job ran a minute ago or stopped a month ago."
        className="mt-6"
      >
        {crons === null ? (
          <ErrorState
            title="The run history could not be read"
            body="This is not an absence of runs. The read against eng_cron_runs failed, so nothing here can be trusted, and a cron could have been dead for hours without this page being able to say so."
          />
        ) : (
          <ul className="divide-y divide-limestone-line">
            {crons.map((c) => (
              <li key={c.name} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                  <span className="text-[14px] font-semibold text-slate">{c.label}</span>
                  <Chip label={c.verdict} tone={VERDICT_TONE[c.verdict]} />
                  <span className="font-mono text-[12px] text-slate-muted">{c.name}</span>
                  <span className="text-[12.5px] text-slate-muted">
                    expected every {c.everyMinutes === 1440 ? "day" : `${c.everyMinutes} min`}
                  </span>
                </div>

                <p className="mt-1.5 max-w-[76ch] text-[13px] leading-[1.55] text-slate-muted">
                  {c.verdict === "never run" ? (
                    <>
                      No run has ever been recorded for this job. Either it is not in vercel.json,
                      or CRON_SECRET is unset so every invocation is answering 404, or this
                      deployment has never been live long enough to fire it.
                    </>
                  ) : (
                    <>
                      Last succeeded {AGO(c.lastSuccessAt)}
                      {c.lastSuccessAt ? ` (${STAMP(c.lastSuccessAt)})` : ""}. Last started{" "}
                      {AGO(c.lastStartedAt)}.
                    </>
                  )}
                  {c.lastRunUnfinished ? (
                    <>
                      {" "}
                      <strong className="font-semibold text-[#8c1d18]">
                        The most recent run started and never reported.
                      </strong>{" "}
                      That is what a function killed by its timeout looks like.
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ------------------------------------------------------------- queue */}
      <Panel
        title="Queue"
        description="The same figures as the job queue screen, here so one page answers whether the platform is keeping up."
        className="mt-6"
      >
        {queue === null ? (
          <ErrorState
            title="The queue could not be read"
            body="Not an empty queue. The read failed, so work could be piling up unseen."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Waiting", value: String(queue.pending), bad: false },
              { label: "Running", value: String(queue.running), bad: false },
              {
                label: "Oldest wait",
                value:
                  queue.oldestWaitingSeconds === null
                    ? "none"
                    : `${Math.round(queue.oldestWaitingSeconds / 60)} min`,
                bad: (queue.oldestWaitingSeconds ?? 0) > 600,
              },
              { label: "Gave up", value: String(queue.dead), bad: queue.dead > 0 },
            ].map((f) => (
              <div key={f.label} className="rounded-[4px] border border-limestone-line bg-white px-4 py-3">
                <p className="text-[11px] font-bold tracking-[0.12em] text-slate-muted uppercase">
                  {f.label}
                </p>
                <p
                  className={`mt-1 font-display text-[24px] leading-[1.1] font-bold ${f.bad ? "text-[#8c1d18]" : "text-slate"}`}
                >
                  {f.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ------------------------------------------------------------ faults */}
      <Panel
        title="Faults in the last hour"
        description={`Recorded in this firm's own database, so this list is complete whether or not Sentry is configured. A fault crossing ${RATE_THRESHOLD} in ${RATE_WINDOW_MINUTES} minutes emails the operator.`}
        className="mt-6"
      >
        {errors === null ? (
          <ErrorState
            title="The fault log could not be read"
            body="Not a quiet hour. The read against eng_error_types failed, so this page cannot say what has been going wrong."
          />
        ) : errors.length === 0 ? (
          <EmptyState
            title="Nothing has failed in the last hour"
            body="Every server side fault Next catches is recorded here, including the ones no catch block was written for. An empty list means the reads succeeded and found nothing, which is a different statement from a list that could not be read."
          />
        ) : (
          <StatusClient errors={errors} windowMinutes={RATE_WINDOW_MINUTES} />
        )}
      </Panel>

      {/* ----------------------------------------------------------- metrics */}
      <Panel
        title="Yesterday"
        description="Computed once a day from the source rows and stored, so the answer survives those rows being pruned. A metric missing from this list was not computed, which is not the same as zero."
        className="mt-6"
      >
        {metrics === null ? (
          <ErrorState
            title="The metrics could not be read"
            body="The read against eng_metrics_daily failed. Nothing below would be trustworthy, so nothing is shown."
          />
        ) : latestDay === null ? (
          <EmptyState
            title="No day has been rolled up yet"
            body="The daily job writes the previous day's figures once a day. Until it has run, there is nothing here, and this is what that looks like rather than a row of zeroes."
          />
        ) : (
          <>
            <p className="mb-3 text-[12.5px] text-slate-muted">
              {latestDay}, computed {AGO(yesterday[0]?.computedAt ?? null)}.
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(
                [
                  ["Orders placed", METRICS.ORDERS_PLACED, false],
                  ["Orders paid", METRICS.ORDERS_PAID, false],
                  ["Taken", METRICS.ORDERS_REVENUE_CENTS, true],
                  ["Refunded", METRICS.ORDERS_REFUNDED_CENTS, true],
                  ["Leads", METRICS.LEADS_CAPTURED, false],
                  ["Applications", METRICS.APPLICATIONS_RECEIVED, false],
                  ["Files opened", METRICS.FILES_OPENED, false],
                  ["API requests", METRICS.API_REQUESTS, false],
                  ["Sign ins", METRICS.SIGN_INS, false],
                  ["Jobs completed", METRICS.JOBS_COMPLETED, false],
                  ["Jobs dead", METRICS.JOBS_DEAD, false],
                  ["Faults", METRICS.ERRORS_RECORDED, false],
                ] as [string, string, boolean][]
              ).map(([label, metric, money]) => {
                const value = figure(metric);
                return (
                  <li
                    key={metric}
                    className="rounded-[4px] border border-limestone-line bg-white px-3 py-2.5"
                  >
                    <p className="text-[11px] font-bold tracking-[0.1em] text-slate-muted uppercase">
                      {label}
                    </p>
                    <p className="mt-0.5 font-mono text-[16px] font-semibold text-slate">
                      {value === null
                        ? "not computed"
                        : money
                          ? `$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : value.toLocaleString("en-US")}
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </>
  );
}
