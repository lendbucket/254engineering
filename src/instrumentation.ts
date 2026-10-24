import type { Instrumentation } from "next";

/**
 * Where every server side fault on this platform is caught.
 *
 * WHY onRequestError AND NOT A TRY/CATCH IN EVERY ROUTE
 * -----------------------------------------------------
 * A catch block records the faults somebody remembered to wrap. Next calls this
 * hook for every error it catches serving a request: route handlers, server
 * components, server actions and the proxy. That is the difference between
 * recording the faults that were anticipated and recording the ones that were
 * not, and the second set is the whole point of having an error store.
 *
 * WHY IT WRITES TO THIS FIRM'S DATABASE FIRST AND SENTRY SECOND
 * -------------------------------------------------------------
 * Sentry needs a DSN in the environment. If that is unset, wrong, or the
 * account lapses, Sentry reports nothing and says nothing, and an error
 * dashboard with nothing on it looks exactly like a platform with no errors.
 * The local store has no such failure mode, and it is what alerting reads, so
 * an alert cannot be silenced by a third party or by a variable nobody set.
 *
 * WHY IT CANNOT THROW
 * -------------------
 * This runs while a request is already failing. An exception here would replace
 * a legible fault with an illegible one, in the one piece of code whose job is
 * to make faults legible.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    /*
     * ONLY IN THE NODE RUNTIME. ops-observability reaches node:crypto through
     * ops-mfa and totp.ts, and an import here with no runtime test is bundled
     * for the Edge runtime too, where it does not compile: on 2026-10-23 that
     * stopped a live-mode dev server from starting (main board 40035266531,
     * ruled intermittent). The literal comparison lets the bundler drop the
     * import from the Edge build. An Edge failure is still sent to Sentry below.
     */
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const { captureError } = await import("@/lib/ops-observability");

      await captureError(err, {
      /*
       * routePath, not the request path. "/portal/files/[id]" is one fault
       * whatever id it happened on; the concrete path would fingerprint every
       * file separately and turn one recurring fault into four hundred
       * one-offs, which reads the same as no faults at all.
       */
      route: context.routePath || request.path,
      kind: context.routeType ?? "request",
      level: "error",
      extra: {
        method: request.method,
        routerKind: context.routerKind,
        renderSource: context.renderSource,
        /*
         * React replaces the error with a digest for server component
         * failures, so the digest is the only handle that ties this row to the
         * line in the deployment log that has the real stack.
         */
        digest:
          typeof err === "object" && err !== null && "digest" in err
            ? String((err as { digest: unknown }).digest)
            : undefined,
      },
      });
    }

    const { sentryConfigured } = await import("@/lib/sentry-config");
    if (sentryConfigured()) {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureRequestError(err, request, context);
    }
  } catch {
    // Deliberately swallowed. See above: the request is already failing and
    // this is the reporter.
  }
};

/**
 * Start Sentry, once, in whichever runtime this is.
 *
 * The DSN decides whether anything actually happens. With none set, init is a
 * no-op, nothing is sent, and the status page says so rather than leaving the
 * operator to assume a quiet dashboard means a quiet platform.
 */
export async function register() {
  const { sentryConfigured, sentryOptions } = await import("@/lib/sentry-config");
  if (!sentryConfigured()) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init(sentryOptions());
}
