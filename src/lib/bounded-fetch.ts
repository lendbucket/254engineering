/**
 * EVERY DATABASE REQUEST IS BOUNDED AT 20 SECONDS. Operator ruling, 2026-10-12.
 *
 * The application's Supabase client set no timeout, so a socket that stalled
 * held a render for as long as the network did. Two board runs lost a signed in
 * screen to the 45 second probe that way (/portal/inquiries on 2026-10-11,
 * /portal/login on 2026-10-12), each in the same minute as connection aborts in
 * the log. The probe's timeout was not raised; the stall is bounded here
 * instead, so it becomes an error the page already handles.
 *
 * THE BOUND COVERS THE WHOLE REQUEST, BODY INCLUDED. The timer is not cleared
 * when headers arrive, because a socket can stall mid body as well as before
 * it, and a bound that ends at the headers would let that one through.
 *
 * WHY THE ABORT IS NAMED AbortError AND NOT TimeoutError. postgrest-js retries
 * a failed GET up to three times with 1, 2 and 4 seconds of backoff, unless the
 * failure is an abort. AbortSignal.timeout rejects with a TimeoutError, which
 * it would retry: a stall would then hold the page for about 87 seconds rather
 * than 20, which is no bound at all. An AbortError is not retried, and
 * postgrest-js hands it back as `{ error }` with the message below, which is
 * the shape every read in this application already checks. Retries of other
 * transient failures are unchanged.
 */

export const DB_FETCH_TIMEOUT_MS = 20_000;

/** The message a stalled request ends with, so a reader of the log can tell it from any other fault. */
export function stallMessage(ms: number): string {
  return `The database did not answer within ${Math.round(ms / 1000)} seconds, so this request was abandoned`;
}

/** A fetch that abandons any request still unanswered after `ms`, the caller's own signal still honoured. */
export function boundedFetch(ms: number = DB_FETCH_TIMEOUT_MS, base: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const reason = new Error(stallMessage(ms));
      reason.name = "AbortError";
      controller.abort(reason);
    }, ms);
    /* A finished request leaves its timer to fire harmlessly; unref keeps it from holding a script open. */
    (timer as { unref?: () => void }).unref?.();
    const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
    return base(input, { ...init, signal });
  };
}
