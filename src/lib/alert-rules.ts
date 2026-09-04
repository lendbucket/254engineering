/**
 * When a fault is worth an email, and when it is not.
 *
 * Pure, and separate from the sending for the same reason job-rules is separate
 * from the queue: this is the part that decides whether somebody's phone buzzes
 * at eleven at night, and a decision that needs a database and a mail provider
 * to exercise is a decision that gets exercised once, in production, by
 * accident.
 *
 * THE FAILURE THIS IS SHAPED AGAINST
 * ----------------------------------
 * Not "we missed an alert". The one that actually happens is the opposite: a
 * fault starts firing every thirty seconds, the operator gets four hundred
 * emails, filters the sender to a folder, and three weeks later a real outage
 * lands in that folder. An alerting system that cries wolf has not degraded, it
 * has inverted: it is now actively hiding faults.
 *
 * So every rule below is a rule about NOT sending, and the two that do send are
 * both bounded by a cooldown.
 */

export type AlertKind = "new" | "rate";

export type ErrorTypeSnapshot = {
  fingerprint: string;
  title: string;
  /** Total ever, across all time. */
  occurrences: number;
  /** How many landed inside the rate window. */
  inWindow: number;
  firstSeenAtMs: number;
  lastSeenAtMs: number;
  alertedNewAtMs: number | null;
  alertedRateAtMs: number | null;
  muted: boolean;
};

/** The rate window, and how many inside it is too many. */
export const RATE_WINDOW_MINUTES = 15;
export const RATE_THRESHOLD = 10;

/**
 * How long before the same fault may email again.
 *
 * An hour, for both kinds. Long enough that a fault firing continuously
 * produces one email an hour rather than one a minute, short enough that
 * somebody who fixed it at nine and broke it again at ten finds out.
 */
export const COOLDOWN_MINUTES = 60;

/**
 * A fault is "new" only while it is genuinely new.
 *
 * Without this bound, a fingerprint that first appeared in March and has never
 * been alerted on, because alerting did not exist in March, would send a "new
 * error type" email the first time this rule ran, for something six months old.
 * That is the shape of a backfill announcing itself as news.
 */
export const NEW_WITHIN_MINUTES = 60;

export type AlertDecision =
  | { send: false; because: string }
  | { send: true; kind: AlertKind; because: string };

export function decideAlert(
  type: ErrorTypeSnapshot,
  now: number = Date.now(),
): AlertDecision {
  if (type.muted) {
    return { send: false, because: "muted by hand" };
  }

  const minutes = (ms: number) => (now - ms) / 60_000;

  /*
   * The rate rule is checked FIRST, and that ordering is the whole point of
   * having two alert timestamps.
   *
   * A fault that is new and already firing eleven times in fifteen minutes is
   * more urgent than a fault that is merely new, and it is the one worth the
   * email. Checking "new" first would send the quieter of the two messages and
   * then be inside its own cooldown when the rate rule fired a minute later.
   */
  if (type.inWindow >= RATE_THRESHOLD) {
    if (type.alertedRateAtMs !== null && minutes(type.alertedRateAtMs) < COOLDOWN_MINUTES) {
      return { send: false, because: "already alerted on the rate within the cooldown" };
    }
    return {
      send: true,
      kind: "rate",
      because: `${type.inWindow} occurrences in ${RATE_WINDOW_MINUTES} minutes`,
    };
  }

  if (type.alertedNewAtMs !== null) {
    return { send: false, because: "already announced as a new fault" };
  }

  if (minutes(type.firstSeenAtMs) > NEW_WITHIN_MINUTES) {
    /*
     * Old and never announced. Recorded as not sent rather than sent late,
     * because "this started an hour ago" is news and "this started in March"
     * is a report, and a report should not arrive as an alert.
     */
    return { send: false, because: "older than the window for new faults" };
  }

  return { send: true, kind: "new", because: "first time this fault has been seen" };
}

/**
 * How many alerts one sweep may send, whatever it finds.
 *
 * A deploy that breaks twenty routes at once produces twenty new fingerprints
 * in one minute. Twenty emails say nothing that three plus "and 17 more" does
 * not, and the twenty is what teaches somebody to filter the sender.
 */
export const MAX_ALERTS_PER_SWEEP = 3;

export function selectAlerts(
  types: ErrorTypeSnapshot[],
  now: number = Date.now(),
): { chosen: { type: ErrorTypeSnapshot; kind: AlertKind; because: string }[]; suppressed: number } {
  const eligible = types
    .map((type) => ({ type, decision: decideAlert(type, now) }))
    .filter((d): d is { type: ErrorTypeSnapshot; decision: Extract<AlertDecision, { send: true }> } =>
      d.decision.send,
    );

  /*
   * Loudest first, so the cap keeps the worst rather than the alphabetically
   * earliest. A rate alert always outranks a new one; between two of a kind,
   * more occurrences in the window wins.
   */
  const ranked = [...eligible].sort((a, b) => {
    if (a.decision.kind !== b.decision.kind) return a.decision.kind === "rate" ? -1 : 1;
    return b.type.inWindow - a.type.inWindow;
  });

  return {
    chosen: ranked.slice(0, MAX_ALERTS_PER_SWEEP).map((d) => ({
      type: d.type,
      kind: d.decision.kind,
      because: d.decision.because,
    })),
    suppressed: Math.max(0, ranked.length - MAX_ALERTS_PER_SWEEP),
  };
}
