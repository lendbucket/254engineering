import { scrubEvent, type ScrubbableEvent } from "./observability-scrub";

/**
 * The one Sentry configuration, shared by every runtime.
 *
 * WHY THIS IS A MODULE AND NOT THREE COPIES
 * -----------------------------------------
 * Sentry's own scaffolding puts an init call in three files: server, edge, and
 * client. Three copies of a scrubbing configuration is three chances for one of
 * them to drift, and the one that drifts is the one nobody looks at. Here it is
 * written once and the three entry points pass it through.
 *
 * WHY IT IS SILENT WITHOUT A DSN, AND WHY THAT IS SAID OUT LOUD
 * -------------------------------------------------------------
 * With no DSN, Sentry.init is a no-op and nothing is reported. That is the
 * correct behaviour for a deployment that has not been given one, and it is
 * also indistinguishable from a working reporter with nothing to report, which
 * is the defect class this repository hunts.
 *
 * Two things answer it. The status page reads sentryConfigured() and says
 * plainly when it is off, and every fault is recorded in this firm's own
 * database whether Sentry is configured or not, so alerting never depends on a
 * third party's DSN being right.
 */

export function sentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * The release, and why it is the commit rather than a version number.
 *
 * A stack trace is only useful against the code that produced it, and this
 * platform deploys from a branch many times a day. package.json's version has
 * not changed since the repository was created; the commit sha changes with
 * every deploy and is the thing somebody can actually check out.
 *
 * NEXT_PUBLIC_ is required for the browser half, which means it is inlined at
 * build time. That is correct here and would be wrong for a credential: a
 * commit sha is public the moment the repository is, and fixing it at build is
 * the point, because a release tag read at runtime could name a different build
 * from the one that is running.
 */
export function release(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
    "local"
  );
}

export function environment(): string {
  return process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development";
}

/**
 * Everything that leaves goes through the same scrubber the database store
 * uses.
 *
 * Typed loosely on purpose. Sentry's Event type changes between majors and this
 * function's contract is "an object shaped like an event, in, scrubbed object
 * out"; pinning it to the SDK's type would make a version bump a change to the
 * pure module, which is the part that must not move.
 */
export function beforeSend<T>(event: T): T {
  return scrubEvent(event as ScrubbableEvent) as T;
}

/**
 * Breadcrumbs go through it too, and that is not an afterthought.
 *
 * A breadcrumb is a record of a fetch, a click, or a console line from the
 * seconds before the fault. Fetch breadcrumbs carry full URLs, which is exactly
 * where a signed link to somebody's evidence photograph lives, and console
 * breadcrumbs carry whatever was logged. They are the most likely carrier of a
 * secret in the whole payload and the easiest one to forget.
 */
export function beforeBreadcrumb<T>(breadcrumb: T): T {
  return scrubEvent(breadcrumb as ScrubbableEvent) as T;
}

/** What every runtime passes to Sentry.init. */
export function sentryOptions() {
  return {
    dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: release(),
    environment: environment(),
    enabled: sentryConfigured(),

    /*
     * Nothing about a person leaves by default.
     *
     * sendDefaultPii true would attach IP addresses, cookies and request
     * bodies automatically, which is the opposite of everything the scrubber
     * does. Off, the scrubber only has to catch what the code deliberately
     * attaches rather than everything the SDK helpfully collects.
     */
    sendDefaultPii: false,

    /*
     * No performance tracing. A trace records the URL of every request the app
     * makes, which for this platform means signed storage links and provider
     * calls, and none of it answers a question anybody is asking yet. It can
     * be turned on when there is a performance question worth the exposure.
     */
    tracesSampleRate: 0,

    beforeSend,
    beforeBreadcrumb,
  };
}
