import { AsyncLocalStorage } from "node:async_hooks";

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
 * THE BOUND COVERS THE WHOLE REQUEST, BODY INCLUDED. The timer is cleared when
 * the body has been read to its end, not when headers arrive, because a socket
 * can stall mid body as well as before it, and a bound that ends at the headers
 * would let that one through.
 *
 * WHY THE ABORT IS NAMED AbortError AND NOT TimeoutError. postgrest-js retries
 * a failed GET up to three times with 1, 2 and 4 seconds of backoff, unless the
 * failure is an abort. AbortSignal.timeout rejects with a TimeoutError, which
 * it would retry: a stall would then hold the page for about 87 seconds rather
 * than 20, which is no bound at all. An AbortError is not retried, and
 * postgrest-js hands it back as `{ error }` with the message below, which is
 * the shape every read in this application already checks. Retries of other
 * transient failures are unchanged.
 *
 * AN ABANDONED WRITE HAS AN UNKNOWN OUTCOME. Operator ruling, 2026-10-12. The
 * request may have committed before the answer stalled, so nothing retries it
 * automatically. postgrest-js retries GET, HEAD and OPTIONS only, so a write is
 * never retried below this line; above it, an abandoned write is recorded in the
 * watch a caller opened with `watchWrites`, and the two callers that would
 * otherwise go on as though it failed cleanly read it: a portal save says "This
 * may not have saved" (save-outcome.ts) and a queued job is dead lettered for a
 * person rather than retried (ops-jobs.ts).
 */

export const DB_FETCH_TIMEOUT_MS = 20_000;

/** The message a stalled request ends with, so a reader of the log can tell it from any other fault. */
export function stallMessage(ms: number): string {
  return `The database did not answer within ${Math.round(ms / 1000)} seconds, so this request was abandoned`;
}

/** A write that was abandoned before its answer arrived: its method and path, never its body. */
export type AbandonedWrite = { method: string; path: string };

const READS = new Set(["GET", "HEAD", "OPTIONS"]);
const watch = new AsyncLocalStorage<AbandonedWrite[]>();

/**
 * Run `body` with a watch open, and say which writes it abandoned. The list is
 * filled as abandonments happen, so a caller reading it after `body` threw
 * still sees them.
 */
export async function watchWrites<T>(
  abandoned: AbandonedWrite[],
  body: () => Promise<T>,
): Promise<T> {
  return watch.run(abandoned, body);
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
  return method.toUpperCase();
}

function pathOf(input: RequestInfo | URL): string {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return new URL(raw).pathname;
  } catch {
    return "(unknown)";
  }
}

/** A fetch that abandons any request still unanswered after `ms`, the caller's own signal still honoured. */
export function boundedFetch(ms: number = DB_FETCH_TIMEOUT_MS, base: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const method = methodOf(input, init);
    /* Taken at the call, so the abandonment lands in the watch of whoever made the request. */
    const watching = watch.getStore();
    const controller = new AbortController();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      if (!READS.has(method)) {
        const write = { method, path: pathOf(input) };
        console.error(`[db] a ${write.method} to ${write.path} was abandoned after ${Math.round(ms / 1000)} seconds and may have committed; it is not retried`);
        watching?.push(write);
      }
      const reason = new Error(stallMessage(ms));
      reason.name = "AbortError";
      controller.abort(reason);
    }, ms);
    (timer as { unref?: () => void }).unref?.();
    const finish = () => {
      settled = true;
      clearTimeout(timer);
    };

    const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
    let res: Response;
    try {
      res = await base(input, { ...init, signal });
    } catch (error) {
      finish();
      throw error;
    }
    if (!res.body) {
      finish();
      return res;
    }
    /* The bound runs until the last byte of the body, then stops. */
    const body = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        flush() {
          finish();
        },
      }),
    );
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
}
