/**
 * The one place that knows how the outage watcher is wired, and how to read
 * what it got back.
 *
 * WHY THE CONSTANTS ARE HERE AND NOT LITERALS IN THREE FILES
 * ----------------------------------------------------------
 * The schedule appears in three places that must agree: vercel.json, which
 * decides when the job runs; the route, which does the probing; and the alert
 * email, which tells the operator how often it will arrive again. If the email
 * says five minutes and the cron says fifteen, the alert contains a small lie
 * and the operator's sense of how long the site has been down is wrong.
 *
 * vercel.json cannot import anything, so it holds a copy. security-audit
 * asserts the copy matches this file, which turns "two things that must agree"
 * into a check rather than a hope.
 */

/** The route the cron calls. */
export const HEALTH_WATCH_PATH = "/api/cron/health-watch";

/** The probe it makes, which is the same one security-audit makes. */
export const HEALTH_PROBE_PATH = "/api/portal/health";

/**
 * How often, in minutes.
 *
 * Five is a judgment. The fault this exists for lasted two hours, so anything
 * under fifteen would have caught it, and the cost of five is 288 invocations a
 * day against a route that does one fetch. Vercel's Pro plan allows minute
 * granularity; on Hobby the shortest is daily and this schedule would be
 * rejected at deploy time.
 */
export const HEALTH_WATCH_EVERY_MINUTES = 5;

/** The same interval as a cron expression, for vercel.json to match. */
export const HEALTH_WATCH_CRON = `*/${HEALTH_WATCH_EVERY_MINUTES} * * * *`;

// ---------------------------------------------------------------------------

/**
 * What the probe found.
 *
 * FOUR OUTCOMES, NOT TWO, AND THE FIRST VERSION HAD TWO
 * -----------------------------------------------------
 * The watcher originally treated anything that was not a healthy 200 as a
 * database outage. The first time it ran for real it emailed an outage alert
 * because the production host answered 403 with a Vercel Security Checkpoint
 * page, which is a firewall challenging the monitor and not a database fault at
 * all.
 *
 * An alerting system that reports the wrong cause is worse than one that stays
 * quiet, because the operator goes and looks at the wrong thing. And one that
 * cries wolf every five minutes gets muted, which turns the real alert into
 * noise the moment it matters.
 *
 * So the classification is explicit, and each outcome carries its own sentence
 * about what to go and look at:
 *
 *   healthy      200 and exactly {"ok":true}. Nothing to say.
 *   unhealthy    503 and exactly {"ok":false}. The app is up and told us it
 *                cannot reach its database. This is the two hour outage.
 *   challenged   A firewall or bot filter answered instead of the app. The site
 *                may be perfectly fine for a browser and broken for everything
 *                else, which is its own problem worth an email.
 *   unreachable  Anything else, including a network failure or a body that is
 *                not one of the two shapes the probe is allowed to return.
 *
 * Pure, so order-audit's sibling checks in security-audit can put every shape
 * through it without a network.
 */
export type ProbeOutcome = "healthy" | "unhealthy" | "challenged" | "unreachable";

/**
 * Signatures of an interstitial answering in place of the application.
 *
 * Matched on the body rather than the status, because a challenge can arrive as
 * 403, 429 or even 200 with a page that waits for JavaScript, and the thing
 * that identifies it is what it says.
 */
const CHALLENGE_MARKERS = [
  "vercel security checkpoint",
  "attack challenge mode",
  "checking your browser",
  "enable javascript and cookies to continue",
  "cf-browser-verification",
];

export function classifyProbe(status: number | null, body: string): ProbeOutcome {
  const text = body.trim();

  if (status === 200 && text === '{"ok":true}') return "healthy";
  if (status === 503 && text === '{"ok":false}') return "unhealthy";

  const lowered = text.toLowerCase();
  if (CHALLENGE_MARKERS.some((marker) => lowered.includes(marker))) return "challenged";

  /*
   * An HTML body where JSON was expected is something other than the route
   * answering: a platform error page, a redirect landing, an interstitial
   * nobody has a marker for yet. Not called a database fault, because it is
   * not evidence of one.
   */
  if (lowered.startsWith("<!doctype html") || lowered.startsWith("<html")) return "challenged";

  return "unreachable";
}

/**
 * Does this outcome mean the operator needs an email?
 *
 * A type predicate rather than a plain boolean, so the compiler knows that
 * anything past this point is a real fault. The email copy is keyed by the
 * three fault outcomes and has no entry for "healthy"; without the narrowing,
 * a refactor could route a healthy probe into it and only fail at runtime, in
 * the one code path nobody exercises on a good day.
 */
export function shouldAlert(outcome: ProbeOutcome): outcome is Exclude<ProbeOutcome, "healthy"> {
  return outcome !== "healthy";
}

/**
 * The headline for each outcome, in the operator's terms.
 *
 * Deliberately different sentences. Three of these send somebody to three
 * different places, and a single generic "the site is down" would send them to
 * the wrong one two times out of three.
 */
export const OUTCOME_HEADLINE: Record<Exclude<ProbeOutcome, "healthy">, string> = {
  unhealthy: "The portal cannot reach its database",
  challenged: "A firewall is answering instead of the portal",
  unreachable: "The portal did not answer",
};

export const OUTCOME_MEANING: Record<Exclude<ProbeOutcome, "healthy">, string> = {
  unhealthy:
    "The application is running and reported that it cannot read its own database. Nobody can sign in, and anything that reads or writes a record will fail. Both causes seen so far were environment variables: a service role key that does not belong to the project the url names, and a url pointed at the wrong project. Either needs a redeploy after it changes.",
  challenged:
    "Something in front of the application answered the check with an interstitial rather than passing it through, which is what Vercel's Attack Challenge Mode and bot filtering do. The site may be working normally in a browser and refusing every crawler, API client and monitor at the same time. That is worth attention on its own for a site that depends on being crawled.",
  unreachable:
    "The check did not get a usable answer at all. That is a platform level failure rather than something inside the application, so the deployment's runtime log and the Vercel status page are the places to look before the code.",
};
