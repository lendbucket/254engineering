import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { business } from "@/config/business";
import { outageAlert } from "@/lib/email-templates";
import { notify } from "@/lib/notify";
import { enqueue } from "@/lib/ops-jobs";
import { cronStarted, cronFinished } from "@/lib/ops-observability";
import {
  HEALTH_PROBE_PATH,
  HEALTH_WATCH_EVERY_MINUTES,
  classifyProbe,
  shouldAlert,
  type ProbeOutcome,
} from "@/lib/health-watch";

export const dynamic = "force-dynamic";

/**
 * The watcher. Asks the portal whether it is alive, and emails the operator
 * when it is not.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-09-03 production ran for about two hours unable to reach its
 * database. Nobody could sign in, and the way it was discovered was the
 * operator trying to sign in and failing. The platform had outage diagnosis and
 * no outage detection.
 *
 * WHY IT PROBES OVER HTTP RATHER THAN CHECKING IN PROCESS
 * -------------------------------------------------------
 * It could import supabaseAdmin and run the query itself, in the same lambda,
 * and that would be simpler and faster. It would also only test the half of the
 * path that is inside this function.
 *
 * What broke was reachable only from outside: the environment variables the
 * deployment was built with. And what a customer meets is the alias, the proxy,
 * a cold lambda, and then the query. So the probe goes over the wire to the
 * canonical hostname, exactly as a person does. A watcher that exercises a
 * different path from the one people use is a watcher that can be green while
 * the site is down, which is the defect this whole pair of changes is about.
 *
 * WHY IT KEEPS NO STATE, AND THEREFORE REPEATS
 * --------------------------------------------
 * Alerting once per outage needs somewhere to record "already alerted". The only
 * durable store this platform has is the database being watched, so the flag
 * would be unavailable in precisely the situation it is for.
 *
 * The alternative, some third store, buys deduplication at the cost of another
 * dependency that can itself fail silently. So it repeats every run, the email
 * says it will, and the operator reads duration from how many arrived. For a
 * fault that went unnoticed for two hours, noisy is the correct direction.
 *
 * WHY ITS ALERT DOES NOT GO ON THE JOB QUEUE
 * ------------------------------------------
 * Every other outbound email on this platform is enqueued. This one is not, and
 * the reason is the same one written above about state: the queue lives in the
 * database being watched. An outage alert routed through it would be an alert
 * that cannot leave during precisely the outage it exists to report, and the
 * symptom would be silence, which is indistinguishable from everything working.
 *
 * jobs-audit asserts this route still calls notify directly, so a later pass
 * tidying "the last unqueued send" cannot quietly remove the exception.
 *
 * WHY IT REFUSES WITHOUT CRON_SECRET
 * ----------------------------------
 * This endpoint sends email. Reachable without a secret it is a way for anybody
 * to fill the operator's inbox, so an unset secret is a refusal rather than an
 * open door. Same reasoning as OPS_UNLOCK_TOKEN, which answers 404 when it is
 * not configured.
 */

/** Constant time compare that does not leak length through an early return. */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected) {
    /*
     * 404 rather than 503, so an unconfigured watcher is indistinguishable from
     * a route that does not exist. There is nothing to learn from probing it.
     */
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  /*
   * The canonical hostname from config, not VERCEL_URL. VERCEL_URL is this
   * deployment's own address, and probing it would pass while the alias pointed
   * at a broken deployment. What matters is the address customers use.
   */
  const host = business.url;
  const checkedAt = new Date().toISOString();

  /*
   * Recorded before the probe, so a run killed by a timeout leaves a row with
   * no finished_at. The status page reads that as "started and never
   * reported", which is what a cron dying every five minutes actually looks
   * like and is invisible if only completions are written.
   */
  const runId = await cronStarted("health-watch");

  /*
   * The error alert sweep rides along on this schedule rather than having a
   * cron of its own.
   *
   * Every five minutes is the right cadence for it: the alert rules already
   * carry an hour long cooldown, so sweeping more often changes nothing except
   * the number of no-op jobs, and sweeping less often delays the news. Putting
   * it on the minutely worker would write 1440 rows a day to say nothing 1439
   * times.
   *
   * It is enqueued rather than run here, because it sends email and email on
   * this platform goes through the queue. This route's own alert is the one
   * deliberate exception, for reasons written below.
   */
  const sweep = await enqueue("errors.alert", {});
  if (!sweep.ok) console.error(`[health-watch] could not queue the error sweep: ${sweep.error}`);

  let status: number | null = null;
  let detail = "";

  try {
    const res = await fetch(`${host}${HEALTH_PROBE_PATH}`, {
      redirect: "manual",
      cache: "no-store",
      headers: { "user-agent": "254-health-watch" },
    });
    status = res.status;
    detail = (await res.text()).trim().slice(0, 400);
  } catch (err) {
    detail = (err instanceof Error ? err.message : "the request failed").slice(0, 400);
  }

  /*
   * Classified, not guessed. The first version treated anything that was not a
   * healthy 200 as a database outage, and the first time it ran for real it
   * emailed one because a firewall answered 403 with a challenge page. See
   * health-watch.ts for why the four outcomes are separate.
   */
  const outcome: ProbeOutcome = classifyProbe(status, detail);

  if (!shouldAlert(outcome)) {
    /*
     * Deliberately silent. A watcher that emails on success trains the operator
     * to ignore its emails, and the one that matters then looks like the rest.
     */
    console.log(`[health-watch] ok ${host}${HEALTH_PROBE_PATH} ${status}`);
    await cronFinished(runId, true, `healthy, ${status}`);
    return NextResponse.json({ ok: true, outcome, host, status, checkedAt });
  }

  console.error(
    `[health-watch] ${outcome.toUpperCase()} ${host}${HEALTH_PROBE_PATH} status=${status} detail=${detail.slice(0, 200)}`,
  );

  /*
   * ok: true on the run row even though the site is down.
   *
   * The row records whether the WATCHER worked, not whether the site did. A
   * watcher that marked itself failed every time it found a fault would make
   * the status page say the watcher is broken during exactly the outage it
   * successfully detected, and an operator would then distrust the one signal
   * that was working.
   */
  await cronFinished(runId, true, `${outcome}, status ${status ?? "none"}`);

  const result = await notify(
    outageAlert({
      outcome,
      host,
      status,
      detail: (detail || "no body").slice(0, 200),
      checkedAt,
      everyMinutes: HEALTH_WATCH_EVERY_MINUTES,
    }),
  );

  /*
   * 200 even though the site is down, because this reports on the watcher and
   * not on the site. A non-200 here would make Vercel's cron dashboard show a
   * failing job, which is a second signal saying something different from the
   * first. The body carries the finding.
   */
  return NextResponse.json({
    ok: true,
    outcome,
    host,
    status,
    checkedAt,
    alerted: result.sent,
    alertOutcome: result.outcome,
  });
}
