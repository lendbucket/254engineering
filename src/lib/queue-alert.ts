/**
 * When a queue that is behind is worth telling somebody about.
 *
 * Pure, for the same reason `alert-rules.ts` is pure: this decides whether the
 * operator's telephone buzzes, and a decision that needs a database and a mail
 * provider to exercise is one that gets exercised once, in production, by
 * accident.
 *
 * WHAT WAS MISSING
 * ----------------
 * `docs/platform-state.md` recorded it plainly: alerting on queue depth is not
 * built, and nothing watches it. The status page shows the depth to somebody
 * who opens it, which means the platform's answer to "the worker stopped an
 * hour ago" was that a person had to already suspect it.
 *
 * Faults alert. An outage alerts. The queue, which is how every email, every
 * receipt and every notification actually leaves this platform, did not.
 *
 * THE THREE THINGS WORTH AN EMAIL, AND WHY THEY ARE THREE
 * -------------------------------------------------------
 * They fail differently and they are looked into differently:
 *
 *   STALLED   the oldest job that should have run is old. Nothing is draining.
 *             This is a worker that is not running, and it is the loudest of
 *             the three because everything else on this platform is downstream
 *             of it: the customer who paid an hour ago has had no receipt.
 *
 *   DEAD      a job exhausted its retries and was given up on. The queue is
 *             draining fine and one piece of work is never happening. Somebody
 *             has to look at what it was.
 *
 *   DEEP      a lot of work is overdue but it is not old. Usually a legitimate
 *             burst that the worker is chewing through. Worth knowing, worth
 *             saying last.
 *
 * A queue with pending jobs waiting their turn is not any of these, and the
 * commonest state of a healthy queue is exactly that. Alerting on depth alone
 * would email the operator every time a batch was queued.
 *
 * EVERY RULE HERE IS A RULE ABOUT NOT SENDING
 * -------------------------------------------
 * Carried over from alert-rules and it is the whole design. The failure that
 * actually happens is not a missed alert, it is four hundred alerts, a filter
 * rule, and a real outage landing in a folder nobody reads.
 */

/**
 * How old the oldest overdue job may be before the worker is presumed stopped.
 *
 * The worker runs every minute, so a job that has been eligible for fifteen
 * minutes has had fifteen chances. Under about ten this would fire on an
 * ordinary slow batch; over about thirty and a customer waits half an hour for
 * a receipt before anybody hears about it.
 */
export const QUEUE_STALLED_MINUTES = 15;

/**
 * How many overdue jobs is a backlog rather than a busy minute.
 *
 * Fifty is a judgment against this firm's actual traffic: the largest thing
 * that queues at once today is a technician dispatch fanning out to a handful
 * of people. Fifty overdue at one moment is not that.
 */
export const QUEUE_DEEP = 50;

/** One email an hour at most, whatever the queue does in between. */
export const QUEUE_COOLDOWN_MINUTES = 60;

export type QueueSnapshot = {
  pending: number;
  overdue: number;
  dead: number;
  /** Age of the oldest job that is eligible to run and has not, in seconds. */
  oldestOverdueSeconds: number | null;
  /** When this alert last went out, from eng_alert_state. */
  lastAlertedAtMs: number | null;
};

export type QueueAlertReason = "stalled" | "dead" | "deep";

export type QueueDecision =
  | { send: false; because: string }
  | { send: true; reason: QueueAlertReason; because: string; headline: string };

export function decideQueueAlert(
  queue: QueueSnapshot,
  now: number = Date.now(),
): QueueDecision {
  const oldestMinutes =
    queue.oldestOverdueSeconds === null ? 0 : Math.floor(queue.oldestOverdueSeconds / 60);

  /*
   * WHAT IS WRONG IS DECIDED BEFORE WHETHER TO SAY IT.
   *
   * The cooldown is applied last, on purpose, so the reason a quiet run stayed
   * quiet is the truth about the queue rather than "nothing to say". A run that
   * found a stalled worker and held the email because it sent one forty minutes
   * ago says exactly that, and the status screen and the log can be read for
   * what they mean.
   */
  let found: { reason: QueueAlertReason; because: string; headline: string } | null = null;

  if (oldestMinutes >= QUEUE_STALLED_MINUTES) {
    found = {
      reason: "stalled",
      because: `the oldest overdue job has been waiting ${oldestMinutes} minutes`,
      headline: "The job queue is not draining",
    };
  } else if (queue.dead > 0) {
    found = {
      reason: "dead",
      because: `${queue.dead} job${queue.dead === 1 ? " has" : "s have"} exhausted every retry`,
      headline: `${queue.dead} job${queue.dead === 1 ? "" : "s"} in the queue gave up`,
    };
  } else if (queue.overdue >= QUEUE_DEEP) {
    found = {
      reason: "deep",
      because: `${queue.overdue} jobs are overdue`,
      headline: "The job queue is deeper than usual",
    };
  }

  if (!found) {
    return {
      send: false,
      because:
        queue.pending > 0
          ? "the queue has work in it and is keeping up, which is what a working queue looks like"
          : "the queue is empty",
    };
  }

  if (queue.lastAlertedAtMs !== null) {
    const since = (now - queue.lastAlertedAtMs) / 60_000;
    if (since < QUEUE_COOLDOWN_MINUTES) {
      return {
        send: false,
        because: `${found.because}, and an alert about the queue went out ${Math.floor(since)} minutes ago`,
      };
    }
  }

  return { send: true, ...found };
}
