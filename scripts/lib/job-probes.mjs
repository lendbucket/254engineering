/**
 * ONE PROBE PER REGISTERED JOB KIND, DECLARED IN ONE PLACE.
 *
 * Phase 12 Section 4, Section 0, debt one. Operator ruling: "Probe payloads
 * declared per kind in one place, and a registered kind with no probe fails the
 * board."
 *
 * WHY THIS EXISTS AT ALL
 * -----------------------
 * Until now the ONLY thing on the board that went through eng_claim_jobs was
 * one retention.sweep check, and its own comment said so. Nine of the ten
 * registered kinds had never been claimed, leased, run or transitioned by
 * anything that watched what happened. The queue was the least measured thing
 * in this repository and the most load bearing: every email, every alert, every
 * reconcile and every deletion goes through it.
 *
 * WHAT A PROBE IS FOR, AND WHAT IT IS NOT FOR
 * --------------------------------------------
 * It proves the QUEUE, not the handler's business logic. What is being asserted
 * is that a job of this kind can be enqueued, is claimed by the real
 * eng_claim_jobs, takes a lease, runs, releases the lease, and lands in the
 * state nextState says it should. Whether document.binder assembles the right
 * binder is files-audit's question and it is asked there.
 *
 * That decides what the payloads look like. A probe prefers a payload that
 * reaches a DECLARED outcome without leaving a permanent row behind, because
 * five of these tables refuse deletion since 0032 and a board that writes an
 * undeletable row every run is a board that fills a regulatory record with its
 * own exhaust. Where a handler's only interesting outcome needs a real subject,
 * the probe says so in `why` rather than inventing one.
 *
 * THE THREE OUTCOMES ARE ALL EXERCISED ON PURPOSE
 * ------------------------------------------------
 * The ten probes below do not all expect "done". Some expect "dead", because a
 * fatal outcome is a transition nextState decides and a queue that cannot dead
 * letter is worse than one that cannot complete. A mix is what makes the
 * assertion meaningful: if every probe expected done, a nextState that returned
 * done for everything would pass.
 *
 * SUPPRESSION IS NOT OPTIONAL HERE
 * ---------------------------------
 * Every probe is enqueued with effect_mode = no_external_effect. Three of these
 * kinds reach outside, and on 2026-09-09 a dry run on development claimed the
 * oldest jobs of any kind and sent twenty real emails. The mode is carried on
 * the row rather than set in a terminal for exactly that reason.
 */

/**
 * @typedef {object} Probe
 * @property {string} kind      The registered kind, exactly.
 * @property {object} payload   What is enqueued.
 * @property {"done"|"dead"|"pending"} expect  Where the job must end up.
 * @property {string} why       Why this payload and why that outcome.
 * @property {boolean} realSubject  Whether the payload names something that
 *   exists. False means the probe deliberately points at nothing, which is a
 *   legitimate way to reach a fatal outcome and is stated rather than hidden.
 */

/** A uuid that is syntactically valid and belongs to nothing. */
export const NOWHERE = "00000000-0000-4000-8000-000000000000";

/** @type {Probe[]} */
export const PROBES = [
  {
    kind: "email.send",
    payload: {
      id: "queue-audit-probe",
      purpose: "operator",
      to: "queue-audit-probe@example.com",
      subject: "queue-audit probe",
      from: "queue-audit@example.com",
      replyTo: null,
      text: "A probe enqueued by scripts/queue-audit.mjs. Nothing sends this.",
      html: "",
      orderId: null,
    },
    expect: "done",
    realSubject: true,
    why:
      "A complete, valid message to an example.com address. It reaches done through the suppression branch " +
      "rather than through Resend, which is the point: the queue path is identical either way and the " +
      "provider is never called. example.com is reserved by RFC 2606 and cannot belong to a person.",
  },
  {
    kind: "notification.deliver",
    payload: { notificationId: -1 },
    expect: "done",
    realSubject: false,
    why:
      "Suppression is checked before the notification row is read, so this reaches done without touching " +
      "eng_notifications at all. Deliberate: stamping emailed_at on a real row for a message nobody sent is " +
      "the false claim of contact this handler was written to avoid, so the probe must not create a row that " +
      "could receive one.",
  },
  {
    kind: "evidence.thumbnail",
    payload: { evidenceItemId: NOWHERE },
    expect: "dead",
    realSubject: false,
    why:
      "This handler is registered and unimplemented on purpose: it returns fatal with a sentence saying an " +
      "image pipeline is missing. So the probe asserts the dead letter path end to end, and the payload is " +
      "irrelevant because the handler never reads it.",
  },
  {
    kind: "document.binder",
    payload: { fileId: NOWHERE },
    expect: "dead",
    realSubject: false,
    why:
      "A binder for a file that does not exist is fatal by design, and reaching that proves the read, the " +
      "decision and the dead letter. A real file would make this write a binder.assembled event to that " +
      "file's history every board run, which is somebody's file getting a line of audit exhaust.",
  },
  {
    kind: "statement.issue",
    payload: { statementId: NOWHERE },
    expect: "dead",
    realSubject: false,
    why:
      "Issuing a statement that does not exist is fatal. A real statement is money: issuing one changes what " +
      "an account owes, and a board that issues a statement every run is a board that bills somebody.",
  },
  {
    kind: "orders.reconcile",
    payload: { apply: false, references: [] },
    expect: "done",
    realSubject: true,
    why:
      "apply:false and an empty reference list is a real, complete instruction: reconcile nothing and change " +
      "nothing. Suppression stops the Stripe call before it happens, so the probe never asks a live payment " +
      "provider about anything.",
  },
  {
    kind: "metrics.rollup",
    payload: { day: "not-a-day" },
    expect: "dead",
    realSubject: false,
    why:
      "A malformed day cannot be rolled up and never will be, which is fatal. A real day would write a row " +
      "into eng_metrics_daily, and that table has refused DELETE since 0032, so every board run would leave " +
      "a permanent rollup nobody can remove. THIS PROBE'S EXPECTATION IS THE ONE MOST LIKELY TO BE WRONG: if " +
      "rollupDay treats a bad day as retryable, the audit will say so rather than the probe being adjusted " +
      "to match, because a probe rewritten to agree with the code is a check on nothing.",
  },
  {
    kind: "errors.alert",
    payload: {},
    expect: "done",
    realSubject: true,
    why:
      "The empty payload IS this handler's real payload: it takes none and reads the fault table itself. On a " +
      "database with no faults in the window it returns done having queued nothing, which is the honest " +
      "no-op. If there ARE faults it queues suppressed emails, because it passes its own effect mode down.",
  },
  {
    kind: "report.export",
    payload: { report: "", period: "" },
    expect: "dead",
    realSubject: false,
    why:
      "A report export with no report and no period is fatal. A complete payload would write a row into " +
      "eng_audit_events, which is append only and cannot be removed, so a board run would add a permanent " +
      "claim that a report was handed to somebody. That is the firm's regulatory memory and probes do not " +
      "belong in it.",
  },
  {
    kind: "retention.sweep",
    payload: { manifestId: NOWHERE },
    expect: "dead",
    realSubject: false,
    why:
      "A sweep for a manifest that does not exist is fatal. A real manifest DELETES ROWS, and this is the one " +
      "kind where a probe with a real subject would be indistinguishable from the thing it is probing. " +
      "retention-audit exercises the real path against a manifest it plans and then abandons; this asserts " +
      "the queue underneath it.",
  },
];

/** The kinds this file declares, for comparing against what is registered. */
export function probedKinds() {
  return PROBES.map((p) => p.kind);
}

/** One probe by kind, or undefined. */
export function probeFor(kind) {
  return PROBES.find((p) => p.kind === kind);
}
