import "server-only";
import { DB_NOW } from "./db-now";
import { READ_CAP } from "./bounded-read";
import { createHash } from "node:crypto";
import { registerJob, enqueue, queueEmail } from "./ops-jobs";
import { isFixtureIdentity } from "./fixture-identity";
import { resolveDeferred } from "./deferred-links";
import { signedDownloadUrl } from "./uploads";
import type { JobOutcome } from "./job-rules";
import { supabaseAdmin } from "./supabase";
import { notify } from "./notify";
import { event as orderEvent } from "./ops-intake";
import { opsNotification } from "./email-templates";
import { issueStatement } from "./ops-statements";
import { reconcileAll } from "./ops-reconcile";
import { rollupDay } from "./ops-metrics";
import { runRetention } from "./ops-retention";
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
  reachesOutside: true,
  reaches:
    "Resend, and therefore a message in a named person's inbox. This is the handler the effect mode exists for: on 2026-09-09 a dry run on development claimed the oldest jobs of any kind and twenty of these went out to real addresses.",
  /*
   * Keyed on the recipient, the subject and the body. Enqueueing the identical
   * message twice is deduped; a genuinely different message to the same person
   * is not, because the subject or body differs.
   */
  idempotency: (p) => keyOf(p.to, p.subject, p.text),
  run: async (p, job): Promise<JobOutcome> => {
    const to = typeof p.to === "string" ? p.to : "";
    const subject = typeof p.subject === "string" ? p.subject : "";
    if (!to || !subject) {
      return { kind: "fatal", error: "An email job needs a recipient and a subject." };
    }

    /*
     * SUPPRESSED, AND IT STOPS BEFORE THE PROVIDER RATHER THAN AFTER IT.
     *
     * Everything above still ran: the payload was validated, and a missing
     * recipient is still fatal. What does not happen is the call to Resend.
     *
     * NOTHING IS WRITTEN TO THE ORDER TIMELINE EITHER, and that is the half
     * somebody would get wrong. customer_link.emailed means a person was
     * written to. Writing it for a message nobody sent would be an entry that
     * looks like evidence of contact and is evidence of a database write,
     * which is the exact defect this platform has already found once and
     * named. The job row carries effect_mode, so what happened is on the
     * record where it belongs.
     */
    /*
     * THE SECOND GUARD, AT RUN TIME, AND IT CATCHES A DIFFERENT THING.
     *
     * The mode on the row is decided at enqueue from the actor. This asks the
     * narrower question the row cannot: is the address in front of me right
     * now one nobody can be reached at. A job that predates the actor rule, or
     * one inserted by hand, still stops here.
     */
    if (job.effectMode === "no_external_effect" || isFixtureIdentity(to)) {
      console.warn(
        "[jobs] email.send #" + job.id + " to " + to + ": suppressed, nothing was sent.",
      );
      return { kind: "done" };
    }

    /*
     * The rendered message is reconstructed from the payload rather than
     * re-composed, so the copy that goes out is the copy that was composed when
     * the work happened. id and purpose ride along because email-audit uses
     * them to name a failure and to decide which sender identity applies.
     */
    /*
     * THE LINKS ARE SIGNED HERE, AND HERE IS THE LAST MOMENT BEFORE THE DOOR.
     *
     * Everything above has already decided this message is going out. What
     * has not happened yet is the provider call, so a link minted now is a
     * link whose window starts when the recipient could first have used it.
     * A four day queue used to hand over a three day link.
     */
    const signedText = await resolveDeferred((p.text as string) ?? "", signedDownloadUrl);
    const signedHtml = await resolveDeferred((p.html as string) ?? "", signedDownloadUrl);

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
      text: signedText,
      html: signedHtml,
    });

    if (result.outcome === "ok") {
      /*
       * THE ONLY PLACE CONTACT IS RECORDED, AND IT IS RECORDED HERE BECAUSE
       * THIS IS THE ONLY PLACE THAT KNOWS.
       *
       * The order timeline used to carry customer_link.issued and nothing else,
       * so a link minted and never sent read exactly like a link the customer
       * received. That is the defect class this repository keeps finding, and
       * it was sitting inside the audit trail: an entry that looks like
       * evidence of contact and is evidence of a database write.
       *
       * Issuance and contact are now two events. This one is written only when
       * the provider has accepted the message, and it carries the id it
       * accepted it as. Acceptance is still not delivery, and the summary says
       * so rather than implying the customer read anything.
       */
      const orderId = typeof p.orderId === "string" ? p.orderId : null;
      if (orderId) {
        await orderEvent(
          orderId,
          "customer_link.emailed",
          /* Customer visible: they should be able to see that the firm sent it,
           * and to which address, so a wrong address is theirs to spot. */
          true,
          `Sent to ${to}.`,
          { message_id: result.messageId ?? null, template: (p.id as string) ?? null },
        );
      }
      return { kind: "done" };
    }

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
  reachesOutside: true,
  reaches:
    "Resend, through notify(). The notification ROW is written synchronously by ops-notify so the bell is already correct; what this adds is an email somebody receives.",
  /*
   * The notification's own id. One row, one email, however many times this is
   * enqueued or retried.
   */
  idempotency: (p) => keyOf("notification", p.notificationId),
  run: async (p, job): Promise<JobOutcome> => {
    const client = db();
    if (!client) return { kind: "retry", error: "The database is not configured." };

    /*
     * Suppressed before notify(), and emailed_at is deliberately NOT stamped.
     * That column is what the bell and the operator read to mean "this one
     * went out by email", and stamping it for a message nobody sent is the
     * same false claim of contact the order timeline nearly carried.
     */
    if (job.effectMode === "no_external_effect") {
      console.warn("[jobs] notification.deliver #" + job.id + ": suppressed, nothing was sent.");
      return { kind: "done" };
    }

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

    /*
     * The run time backstop, same as email.send. The mode on the row is decided
     * at enqueue from the actor; this asks whether the address resolved from the
     * profile a moment ago is one nobody can be reached at. Every portal probe
     * lives at audit-probe.invalid, so a notification queued for one stops here
     * whatever its row says.
     */
    if (address && isFixtureIdentity(address)) {
      console.warn(
        "[jobs] notification.deliver #" + job.id + " to " + address + ": suppressed, nobody is there.",
      );
      return { kind: "done" };
    }

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
        .update({ emailed_at: DB_NOW, email_error: null })
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
  /* It returns fatal and does nothing at all. */
  reachesOutside: false,
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
  /* Reads a file, writes a file event. Nothing leaves. */
  reachesOutside: false,
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
  /*
   * issueStatement writes rows and nothing else: it does not email the account
   * and it does not charge anything. Money moves when a payment arrives against
   * the statement, which is a different path entirely.
   */
  reachesOutside: false,
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
  reachesOutside: true,
  reaches:
    "Stripe. It reads charges rather than creating them, so nobody is charged by running it, and it is still a call to a live provider with live keys against real order references. Suppressing it is what stops a probe asking a payment provider about orders that do not exist.",
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
  run: async (p, job): Promise<JobOutcome> => {
    /*
     * Suppressed before the provider call. Reconciling reads charges rather
     * than creating them, so nobody is charged either way; what this stops is
     * a probe asking a live payment provider about order references that were
     * invented by an audit thirty seconds ago.
     */
    if (job.effectMode === "no_external_effect") {
      console.warn("[jobs] orders.reconcile #" + job.id + ": suppressed, the provider was not called.");
      return { kind: "done" };
    }

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
  /* Counts rows this platform already has and writes one row per day. */
  reachesOutside: false,
  idempotency: (p) => keyOf("rollup", p.day ?? "yesterday"),
  run: async (p): Promise<JobOutcome> => {
    const day = typeof p.day === "string" ? p.day : undefined;

    /*
     * A DAY THAT IS NOT A DAY IS FATAL, NOT RETRIED.
     *
     * Found by queue-audit on 2026-09-09, which enqueued a probe with a
     * malformed day and expected a dead letter. It got a retry: rollupDay threw
     * "Invalid time value", runOne turned the throw into a retry, and the job
     * went back on the queue to fail identically four more times over the next
     * hour.
     *
     * That is precisely the case nextState's own comment names as the reason
     * fatal exists: "a payload missing the id it needs will fail the same way
     * five times, and five identical failures spread over an hour is worse than
     * one, because it delays the moment the operator sees a queue that needs a
     * person". Nothing about a malformed date is going to be different on the
     * fifth attempt.
     *
     * The probe's expectation was not moved to match the code. The code moved.
     */
    if (day !== undefined && Number.isNaN(Date.parse(day))) {
      return { kind: "fatal", error: `"${day}" is not a date, so this rollup will never succeed.` };
    }

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
  /*
   * FALSE, AND IT IS THE ONE WHERE THAT ANSWER IS DANGEROUS ON ITS OWN.
   *
   * This handler sends nothing. It reads the faults, decides, stamps the
   * cooldown and QUEUES an email.send, so the thing a person receives is sent
   * by a different job entirely. Declaring true here would be a lie about what
   * this code does; declaring false and stopping would let a suppressed alert
   * spawn a live send, which is the leak in the only direction that matters.
   *
   * So it is false AND it passes job.effectMode to every email it queues, and
   * queue-audit asserts the second half rather than trusting the first.
   */
  reachesOutside: false,
  idempotency: "naturally",
  why: "the decision is read from alerted_new_at and alerted_rate_at, which the sweep writes before it queues anything, so a second sweep in the same cooldown finds the stamps and sends nothing.",
  run: async (_p, job): Promise<JobOutcome> => {
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
      .gte("occurred_at", since)
      .range(0, READ_CAP - 1);

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
        .update(kind === "rate" ? { alerted_rate_at: DB_NOW } : { alerted_new_at: DB_NOW })
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
        /* No order. An operator alert is about the machine. */
        undefined,
        /*
         * THE MODE TRAVELS WITH THE WORK.
         *
         * This is the only handler in the registry that queues something that
         * sends, and without this line a suppressed alert would spawn a live
         * email. The child job carries its own effect_mode on its own row, so
         * the record stays complete one hop down.
         */
        job.effectMode,
      );
      if (!queued.ok) {
        return { kind: "retry", error: `Could not queue the alert: ${queued.error}` };
      }
    }

    return { kind: "done" };
  },
});

// -------------------------------------------------------------- report.export

/**
 * Record that a report left the building.
 *
 * Phase 12 Section 2, the reporting prompt's Section 3. This does NOT assemble the CSV. The file is built and
 * returned inside the request, because the person who clicked Export is
 * standing in front of it, and docs/platform-state.md has the rule this
 * follows: a queued CSV is a CSV nobody receives. Nothing in this platform
 * delivers a file to somebody who has walked away.
 *
 * What is queued is the fact. A report is the firm's own statement about
 * itself, and once one has been handed to an accountant or a client the
 * important question stops being what the screen shows today and becomes what
 * the file said on the day it went out. So this writes an audit row carrying
 * the manifest's own totals: the period, the scope, how many figures, how many
 * rows, and how many of the figures could not be computed.
 *
 * WHY THE FIGURES ARE NOT RECOMPUTED HERE
 * ---------------------------------------
 * A retry an hour later would produce different numbers, and the audit row
 * would then describe a file nobody was ever sent. The payload carries what the
 * file actually said, and this records that. The binder job above takes the
 * opposite decision for the opposite reason, and both are right: a binder is
 * asked for by file id because a reader wants the file as it stands NOW, and a
 * report export is evidence of what was handed over THEN.
 */
registerJob("report.export", {
  /* One audit row. The CSV was built and handed over inside the request, and
   * nothing here delivers a file to anybody. */
  reachesOutside: false,
  idempotency: (p) => keyOf("report-export", p.report, p.period, p.at, p.actorId),
  run: async (p): Promise<JobOutcome> => {
    const client = db();
    if (!client) return { kind: "retry", error: "The database is not configured." };

    const report = typeof p.report === "string" ? p.report : "";
    const period = typeof p.period === "string" ? p.period : "";
    if (!report || !period) return { kind: "fatal", error: "A report export job needs a report and a period." };

    const figures = Number(p.figures ?? 0);
    const rows = Number(p.rows ?? 0);
    const notComputed = Number(p.notComputed ?? 0);

    const { error } = await client.from("eng_audit_events").insert({
      actor_id: typeof p.actorId === "string" ? p.actorId : null,
      actor_email: typeof p.actorEmail === "string" ? p.actorEmail : null,
      actor_role: typeof p.actorRole === "string" ? p.actorRole : null,
      action: "export.report.assembled",
      entity_type: "report",
      entity_id: `${report}:${period}`,
      summary:
        `The ${report} report for ${period} was assembled as a file: ` +
        `${figures} figure(s) over ${rows} row(s)` +
        (notComputed > 0
          ? `, ${notComputed} of which the report could not compute and said so in the manifest.`
          : ", all of them computed."),
      diff: { scope: p.scope ?? "real", figures, rows, notComputed },
    });

    if (error) return { kind: "retry", error: error.message };
    return { kind: "done" };
  },
});

// ----------------------------------------------------------- retention.sweep

/**
 * Take the rows a manifest already named.
 *
 * Phase 12 Section 3. This handler does not decide anything. The table, the
 * rule, the cutoff, the mode, the exact set and the rollups that had to
 * reconcile were all settled by planRetention and written to
 * eng_retention_runs before this row existed, and runRetention reads them back
 * from there rather than from this payload. The payload carries one id.
 *
 * WHY THE PAYLOAD IS DELIBERATELY THIN
 * -------------------------------------
 * A payload carrying the plan would be a plan that survives in the queue and
 * nowhere else. Then a manifest edited, a policy changed, or an operator
 * cancelling a run would all be invisible to a job already enqueued, and the
 * deletion would happen on terms nobody could look up afterwards. One id means
 * the database is the single account of what this run is.
 *
 * WHAT A RETRY DOES
 * -----------------
 * Resumes. runRetention writes progress after every batch and yields after a
 * bounded number of them, so a retry continues from the manifest's own
 * affected_count rather than starting the sweep again. That is why a retry here
 * is safe in a way a retry of a naive delete loop would not be.
 */
registerJob("retention.sweep", {
  /*
   * It deletes rows this platform owns, which is as consequential as anything
   * here and is not an EXTERNAL effect: nobody outside the firm hears about it.
   * The mode it already carries, plan versus execute, decides whether rows go,
   * and the two modes are independent on purpose.
   */
  reachesOutside: false,
  /*
   * The manifest id, which IS the identity of the run. A second enqueue of the
   * same manifest finds the live job rather than starting a parallel sweep of
   * the same rows, which is the one duplication that would produce a genuinely
   * confusing outcome: two workers reconciling the same intent against each
   * other's deletions.
   */
  idempotency: (p) => keyOf("retention-sweep", p.manifestId),
  run: async (p): Promise<JobOutcome> => {
    const manifestId = typeof p.manifestId === "string" ? p.manifestId : "";
    if (!manifestId) return { kind: "fatal", error: "A retention sweep needs a manifest id." };

    const result = await runRetention(manifestId);
    if (!result.ok) {
      return result.retryable
        ? { kind: "retry", error: result.because }
        : { kind: "fatal", error: result.because };
    }

    const r = result.report;
    console.warn(
      `[retention] ${r.mode} on ${r.table}: ${r.affected} of ${r.intended}, ` +
        `${r.reconciled ? "reconciled" : "NOT RECONCILED"}`,
    );

    /*
     * A run that finished but did not reconcile is DONE and NOT FINE. It is not
     * retried, because retrying would delete nothing new and hide the
     * discrepancy behind an eventual success; the manifest carries the
     * difference and says what it means, and the audit trail row below is what
     * somebody reads.
     */
    /*
     * THE TRAIL NAMES WHO AUTHORISED IT, AND IT DID NOT AT FIRST.
     *
     * actor_id was null here while the manifest beside it named somebody, which
     * is backwards for the one action in this platform that destroys a record:
     * the regulatory memory is the place that most needs the name. Found by
     * reading eng_audit_events next to eng_retention_runs rather than by any
     * check. The actor comes off the MANIFEST rather than out of this payload,
     * for the same reason everything else here does.
     */
    const { error } = await (db()?.from("eng_audit_events").insert({
      actor_id: r.actorId,
      actor_email: r.actorEmail,
      actor_role: r.actorRole,
      action: r.mode === "execute" ? "retention.executed" : "retention.dry_run",
      entity_type: "retention_run",
      entity_id: r.manifestId,
      summary:
        `Retention ${r.mode === "execute" ? "deleted" : "would have deleted"} ${r.affected} row(s) ` +
        `from ${r.table}, having intended ${r.intended}. ${r.reconciled ? "Reconciled." : "DID NOT RECONCILE."} ` +
        `Authorised by ${r.actorRole ?? "nobody the manifest names"}.`,
      diff: {
        table: r.table, mode: r.mode, intended: r.intended, affected: r.affected,
        reconciled: r.reconciled, actorRole: r.actorRole,
      },
    }) ?? { error: null });

    if (error) return { kind: "retry", error: `The sweep finished and its audit row did not write: ${error.message}` };
    return { kind: "done" };
  },
});
