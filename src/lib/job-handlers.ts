import "server-only";
import { createHash } from "node:crypto";
import { registerJob, enqueue, queueEmail } from "./ops-jobs";
import type { JobOutcome } from "./job-rules";
import { supabaseAdmin } from "./supabase";
import { notify } from "./notify";
import { opsNotification } from "./email-templates";
import { issueStatement } from "./ops-statements";
import { reconcileAll } from "./ops-reconcile";
import { rollupDay } from "./ops-metrics";
import { errorAlert } from "./email-templates";
import { RELEASE, ENVIRONMENT } from "./ops-observability";
import { business } from "@/config/business";
import {
  selectAlerts,
  RATE_WINDOW_MINUTES,
  COOLDOWN_MINUTES,
  type ErrorTypeSnapshot,
} from "./alert-rules";

/**
 * Every handler, and how each one survives running twice.
 *
 * WHAT MOVED ONTO THE QUEUE AND WHAT DELIBERATELY DID NOT
 * -------------------------------------------------------
 * The rule is not "everything slow". It is: does the person in front of the
 * request need this to have happened before the page renders?
 *
 * A notification ROW stays in the request, because the bell has to show it
 * immediately and it is one local insert. The EMAIL for that notification
 * leaves, because it talks to Resend and a customer should not wait on a mail
 * provider to see a page about something else.
 *
 * The same test applied to each: the binder's assembly reads a file and builds
 * a document, which nobody is watching; the reconciliation sweep talks to
 * Stripe; issuing a statement sends mail. All leave. The order itself, the
 * payment row, the audit row and the status transition all stay, because those
 * are the facts the request exists to record and a queue that lost one would
 * lose the thing that matters.
 *
 * IDEMPOTENCY IS DECLARED, NOT ASSUMED
 * ------------------------------------
 * A lease expires, so a job can run twice. Every registration below states how
 * that is survived, and jobs-audit fails the build on any kind that does not.
 */

const db = () => supabaseAdmin();

/** A stable short hash, so an idempotency key is bounded whatever goes into it. */
function keyOf(...parts: unknown[]): string {
  return createHash("sha256").update(parts.map(String).join("|")).digest("hex").slice(0, 32);
}

// --------------------------------------------------------------- email.send

/**
 * One outbound email.
 *
 * The payload carries the RENDERED message rather than a template name and
 * arguments, and that is the one place this file departs from "ids, never
 * objects". The reason is that the copy a customer was sent must be the copy
 * that was composed at the time: re-rendering at send time would email today's
 * template for something decided last week, and the refund disclosure already
 * establishes that the firm keeps what was actually shown.
 */
registerJob("email.send", {
  /*
   * Keyed on the recipient, the subject and the body. Enqueueing the identical
   * message twice is deduped; a genuinely different message to the same person
   * is not, because the subject or body differs.
   */
  idempotency: (p) => keyOf(p.to, p.subject, p.text),
  run: async (p): Promise<JobOutcome> => {
    const to = typeof p.to === "string" ? p.to : "";
    const subject = typeof p.subject === "string" ? p.subject : "";
    if (!to || !subject) {
      return { kind: "fatal", error: "An email job needs a recipient and a subject." };
    }

    /*
     * The rendered message is reconstructed from the payload rather than
     * re-composed, so the copy that goes out is the copy that was composed when
     * the work happened. id and purpose ride along because email-audit uses
     * them to name a failure and to decide which sender identity applies.
     */
    const result = await notify({
      id: (p.id as string) ?? "queued",
      purpose: (p.purpose as "operator" | "human") ?? "operator",
      to,
      subject,
      from: p.from as string,
      // Null survives a round trip through JSONB where undefined does not, so
      // the payload carries null and it is turned back into an absent header
      // here. Handing Resend a null reply-to is not the same as omitting it.
      replyTo: (p.replyTo as string) ?? undefined,
      text: (p.text as string) ?? "",
      html: (p.html as string) ?? "",
    });

    if (result.outcome === "ok") return { kind: "done" };

    /*
     * An unset key or an empty body will not fix itself, so those are fatal
     * rather than retried five times. A provider error might, so it retries.
     */
    if (result.outcome === "skipped" || result.outcome === "no content") {
      return { kind: "fatal", error: result.reason ?? result.outcome };
    }
    return { kind: "retry", error: result.reason ?? "the send failed" };
  },
});

// ------------------------------------------------------- notification.deliver

/**
 * The email for a notification row that already exists.
 *
 * The row is written synchronously by ops-notify, so the bell is correct the
 * instant the request returns. This is only the delivery.
 */
registerJob("notification.deliver", {
  /*
   * The notification's own id. One row, one email, however many times this is
   * enqueued or retried.
   */
  idempotency: (p) => keyOf("notification", p.notificationId),
  run: async (p): Promise<JobOutcome> => {
    const client = db();
    if (!client) return { kind: "retry", error: "The database is not configured." };

    const id = p.notificationId;
    if (typeof id !== "number" && typeof id !== "string") {
      return { kind: "fatal", error: "A notification job needs a notificationId." };
    }

    const { data: row } = await client
      .from("eng_notifications")
      .select("id, profile_id, kind, title, body, href, emailed_at")
      .eq("id", id)
      .maybeSingle();

    if (!row) return { kind: "fatal", error: `Notification ${id} no longer exists.` };

    /*
     * The second line of defence, and the one that actually holds when a lease
     * expires mid send. The key stops a duplicate ENQUEUE; this stops a
     * duplicate SEND, by reading the state the first run wrote.
     */
    if (row.emailed_at) return { kind: "done" };

    const { data: profile } = await client
      .from("eng_profiles")
      .select("email")
      .eq("id", row.profile_id)
      .maybeSingle();

    const address = (profile?.email as string) ?? null;
    if (!address) {
      await client
        .from("eng_notifications")
        .update({ email_error: "No address on the profile." })
        .eq("id", row.id);
      return { kind: "fatal", error: "No address on the profile." };
    }

    const sent = await notify(
      opsNotification({
        to: address,
        title: row.title as string,
        body: (row.body as string) ?? null,
        href: (row.href as string) ?? null,
      }),
    );

    if (sent.outcome === "ok") {
      await client
        .from("eng_notifications")
        .update({ emailed_at: new Date().toISOString(), email_error: null })
        .eq("id", row.id);
      return { kind: "done" };
    }

    const message = sent.reason ?? sent.outcome;
    await client.from("eng_notifications").update({ email_error: message }).eq("id", row.id);
    if (sent.outcome === "skipped" || sent.outcome === "no content") {
      return { kind: "fatal", error: message };
    }
    return { kind: "retry", error: message };
  },
});

// -------------------------------------------------------- evidence.thumbnail

/**
 * A thumbnail for one captured evidence item.
 *
 * NOT YET IMPLEMENTED, AND IT SAYS SO RATHER THAN PRETENDING
 * ----------------------------------------------------------
 * The column exists (eng_evidence_items.thumb_key, since 0001) and nothing has
 * ever written it. Generating one needs an image pipeline this deployment does
 * not have, and the honest options were to leave the kind unregistered or to
 * register one that fails loudly.
 *
 * Unregistered would mean any future enqueue dead letters with "no handler",
 * which reads like a bug. This dead letters with a sentence saying what is
 * actually missing, which is the difference between a defect and a decision.
 *
 * BACKLOG carries it. Nothing enqueues this kind today.
 */
registerJob("evidence.thumbnail", {
  idempotency: (p) => keyOf("thumb", p.evidenceItemId),
  run: async (): Promise<JobOutcome> => ({
    kind: "fatal",
    error:
      "Thumbnail generation is not built. eng_evidence_items.thumb_key has existed since 0001 and nothing writes it; it needs an image pipeline this deployment does not have. See BACKLOG.",
  }),
});

// ----------------------------------------------------------- document.binder

/**
 * Assemble an evidence binder and record it.
 *
 * The binder is built from jobView every time it is asked for, so it always
 * reflects the file as it stands. That is why this carries a file id and not a
 * binder: a retry an hour later assembles the CURRENT file, which is what
 * anybody reading it would want.
 */
registerJob("document.binder", {
  idempotency: (p) => keyOf("binder", p.fileId, p.requestedFor ?? "latest"),
  run: async (p): Promise<JobOutcome> => {
    const client = db();
    if (!client) return { kind: "retry", error: "The database is not configured." };

    const fileId = typeof p.fileId === "string" ? p.fileId : "";
    if (!fileId) return { kind: "fatal", error: "A binder job needs a fileId." };

    const { data: file } = await client
      .from("eng_files")
      .select("id, file_number")
      .eq("id", fileId)
      .maybeSingle();

    if (!file) return { kind: "fatal", error: `File ${fileId} no longer exists.` };

    /*
     * The binder is assembled on demand by the document centre rather than
     * stored, so there is nothing to write here yet. What this job DOES do is
     * record that it was asked for, which is what makes an on demand artifact
     * auditable.
     *
     * When the binder becomes a stored PDF, this is where it is generated, and
     * the idempotency key already covers a retry producing one file rather than
     * two.
     */
    await client.from("eng_file_events").insert({
      file_id: fileId,
      kind: "binder.assembled",
      body: "An evidence binder was assembled for this file.",
    });

    return { kind: "done" };
  },
});

// ------------------------------------------------------------ statement.issue

registerJob("statement.issue", {
  idempotency: (p) => keyOf("statement", p.statementId),
  run: async (p): Promise<JobOutcome> => {
    const statementId = typeof p.statementId === "string" ? p.statementId : "";
    if (!statementId) return { kind: "fatal", error: "A statement job needs a statementId." };

    const result = await issueStatement(statementId, "job-queue@254engineering.com");

    if (result.ok) return { kind: "done" };

    /*
     * issueStatement refuses a statement that is already issued, and that is
     * SUCCESS from a retry's point of view: the work is done. Treating it as a
     * failure would dead letter a job whose effect had already happened, which
     * is the same class of lie as a webhook reporting handled for a write that
     * never occurred.
     */
    if (/cannot be issued again/.test(result.error)) return { kind: "done" };
    if (/nothing on it|does not exist/.test(result.error)) {
      return { kind: "fatal", error: result.error };
    }
    return { kind: "retry", error: result.error };
  },
});

// ---------------------------------------------------------- orders.reconcile

registerJob("orders.reconcile", {
  /*
   * Naturally repeatable, and this is the one kind that earns that claim.
   *
   * reconcileAll asks Stripe what happened and records a payment only when the
   * provider says it was paid AND the amount matches the order. markPaid is
   * idempotent on the charge ref, so a second run of the same sweep finds the
   * charge already recorded and changes nothing. Running it twice produces the
   * same database as running it once.
   */
  idempotency: "naturally",
  why: "reconcileAll records through markPaid, which is idempotent on the provider's charge ref, so a second sweep finds the charge already on file and writes nothing.",
  run: async (p): Promise<JobOutcome> => {
    const apply = p.apply === true;

    /*
     * References narrow the sweep to named orders, and they have to survive
     * onto the job. Dropping them would turn "settle these three" into "settle
     * everything you find", which is a far larger act than the one the operator
     * authorised and would be invisible in the result.
     */
    const references = Array.isArray(p.references)
      ? (p.references as unknown[]).filter((r): r is string => typeof r === "string")
      : undefined;

    const report = await reconcileAll({ apply, references });

    if (!report.configured) {
      return { kind: "retry", error: "Payments are not configured on this deployment." };
    }

    const unreachable = report.findings.filter((f) => f.verdict === "unreachable");
    if (unreachable.length > 0 && unreachable.length === report.findings.length) {
      return { kind: "retry", error: "The payment provider could not be reached for any order." };
    }

    return { kind: "done" };
  },
});

// ------------------------------------------------------------ metrics.rollup

/**
 * Compute one day's operational figures.
 *
 * Keyed on the day, so a second enqueue for the same day finds the first. The
 * rollup itself recomputes rather than accumulates, so even a duplicate that
 * slipped past the key would produce the same numbers.
 */
registerJob("metrics.rollup", {
  idempotency: (p) => keyOf("rollup", p.day ?? "yesterday"),
  run: async (p): Promise<JobOutcome> => {
    const day = typeof p.day === "string" ? p.day : undefined;
    const report = day ? await rollupDay(day) : await rollupDay();

    if (!report) return { kind: "retry", error: "The database is not configured." };

    /*
     * A metric that could not be computed is a RETRY, not a success with a
     * gap. The whole point of leaving it out of the table rather than writing
     * zero is that a gap means "not computed", and a job that shrugged at the
     * gap would leave one there permanently.
     */
    if (report.unavailable.length > 0) {
      return {
        kind: "retry",
        error: `Could not compute: ${report.unavailable.join(", ")}`,
      };
    }

    return { kind: "done" };
  },
});

// ------------------------------------------------------------- errors.alert

/**
 * Look at what has been failing and decide whether to email about it.
 *
 * WHY THE SWEEP IS A JOB AND NOT PART OF THE CRON ROUTE
 * -----------------------------------------------------
 * It sends email, and email on this platform goes through the queue. Putting
 * the decision in the cron and the sending in the queue would split one piece
 * of reasoning across two places; putting both here keeps the rule and its
 * consequence together, and gives the sweep the same retry and dead letter
 * treatment as everything else.
 *
 * The alert timestamps are written BEFORE the email is queued, deliberately.
 * If this job runs twice, the second run reads the timestamp the first wrote
 * and sends nothing. The cost of that ordering is that a failure between the
 * stamp and the queue loses one alert; the alternative loses the cooldown
 * entirely and sends an alert per sweep, which is the failure that trains an
 * operator to filter the sender.
 */
registerJob("errors.alert", {
  idempotency: "naturally",
  why: "the decision is read from alerted_new_at and alerted_rate_at, which the sweep writes before it queues anything, so a second sweep in the same cooldown finds the stamps and sends nothing.",
  run: async (): Promise<JobOutcome> => {
    const client = db();
    if (!client) return { kind: "retry", error: "The database is not configured." };

    const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();

    const { data: types, error } = await client
      .from("eng_error_types")
      .select(
        "fingerprint, title, occurrences, first_seen_at, last_seen_at, alerted_new_at, alerted_rate_at, muted",
      )
      .gte("last_seen_at", since)
      .limit(200);

    if (error) return { kind: "retry", error: `Could not read the faults: ${error.message}` };
    if (!types || types.length === 0) return { kind: "done" };

    const { data: events } = await client
      .from("eng_error_events")
      .select("fingerprint")
      .gte("occurred_at", since);

    const inWindow = new Map<string, number>();
    for (const e of events ?? []) {
      const f = e.fingerprint as string;
      inWindow.set(f, (inWindow.get(f) ?? 0) + 1);
    }

    const snapshots: ErrorTypeSnapshot[] = types.map((t) => ({
      fingerprint: t.fingerprint as string,
      title: t.title as string,
      occurrences: Number(t.occurrences),
      inWindow: inWindow.get(t.fingerprint as string) ?? 0,
      firstSeenAtMs: Date.parse(t.first_seen_at as string),
      lastSeenAtMs: Date.parse(t.last_seen_at as string),
      alertedNewAtMs: t.alerted_new_at ? Date.parse(t.alerted_new_at as string) : null,
      alertedRateAtMs: t.alerted_rate_at ? Date.parse(t.alerted_rate_at as string) : null,
      muted: Boolean(t.muted),
    }));

    const { chosen, suppressed } = selectAlerts(snapshots);
    if (chosen.length === 0) return { kind: "done" };

    const now = new Date().toISOString();

    for (const { type, kind, because } of chosen) {
      await client
        .from("eng_error_types")
        .update(kind === "rate" ? { alerted_rate_at: now } : { alerted_new_at: now })
        .eq("fingerprint", type.fingerprint);

      console.warn(`[alert] ${kind}: ${type.fingerprint} (${because})`);

      const queued = await queueEmail(
        errorAlert({
          kind,
          fingerprint: type.fingerprint,
          title: type.title,
          occurrences: type.occurrences,
          inWindow: type.inWindow,
          windowMinutes: RATE_WINDOW_MINUTES,
          firstSeenAt: new Date(type.firstSeenAtMs).toISOString(),
          lastSeenAt: new Date(type.lastSeenAtMs).toISOString(),
          suppressed,
          release: RELEASE,
          environment: ENVIRONMENT,
          statusUrl: `${business.url}/portal/status`,
          cooldownMinutes: COOLDOWN_MINUTES,
        }),
      );
      if (!queued.ok) {
        return { kind: "retry", error: `Could not queue the alert: ${queued.error}` };
      }
    }

    return { kind: "done" };
  },
});
