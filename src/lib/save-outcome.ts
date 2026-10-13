import { watchWrites, type AbandonedWrite } from "./bounded-fetch";
import { LIST_NOT_LOADED, MAY_NOT_HAVE_SAVED, PORTAL_UNREACHABLE, UNREACHABLE_DIGEST } from "./outcome-copy";

/**
 * WHAT A PERSON IS TOLD WHEN THE DATABASE DID NOT ANSWER. Operator ruling,
 * 2026-10-12, and the wording of both sentences is his.
 *
 * Two different facts, and the difference is the point.
 *
 * A READ that failed or stalled tells the person nothing about their data, so
 * it never renders as an empty state and never as a sign out. The session read
 * every portal screen shares throws `DatabaseUnreachable` rather than returning
 * the null that means "nobody is signed in", and the screen says the portal
 * could not reach the database and that they are still signed in.
 *
 * A WRITE that was abandoned has an UNKNOWN outcome: it may have committed
 * before the answer stalled. So it is never retried automatically, and a save
 * that abandoned one says exactly that, so the person checks before saving
 * again. A manual retry is the same request with the same idempotency key, and
 * nothing here mints a new one.
 */

export { PORTAL_UNREACHABLE, MAY_NOT_HAVE_SAVED, LIST_NOT_LOADED, UNREACHABLE_DIGEST };

/** The session read failed or stalled. Not the same thing as nobody being signed in. */
export class DatabaseUnreachable extends Error {
  readonly digest = UNREACHABLE_DIGEST;
  constructor(detail: string) {
    super(`The session could not be read: ${detail}`);
    this.name = "DatabaseUnreachable";
  }
}

export function isDatabaseUnreachable(error: unknown): error is DatabaseUnreachable {
  return error instanceof Error && error.name === "DatabaseUnreachable";
}

function refusal(error: string, outcome: "unreachable" | "unknown"): Response {
  return Response.json({ ok: false, error, outcome }, { status: 503 });
}

/**
 * Every write route a screen sends a save to is exported through this.
 *
 * It opens a write watch around the handler. If any write the handler made was
 * abandoned, the answer is "This may not have saved", whatever the handler
 * itself went on to say: a handler that reads the abandonment as an ordinary
 * failure would tell the person it did not save, and one that ignored it would
 * tell them it did, and both are claims nobody can make. If the session read
 * failed, the answer is the unreachable sentence and never "Not signed in",
 * which a screen would take as a sign out.
 *
 * Nothing here retries. The person decides, after checking.
 */
export function withSaveOutcome<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const abandoned: AbandonedWrite[] = [];
    let res: Response;
    try {
      res = await watchWrites(abandoned, () => handler(...args));
    } catch (error) {
      if (abandoned.length > 0) return refusal(MAY_NOT_HAVE_SAVED, "unknown");
      if (isDatabaseUnreachable(error)) return refusal(PORTAL_UNREACHABLE, "unreachable");
      throw error;
    }
    if (abandoned.length > 0) return refusal(MAY_NOT_HAVE_SAVED, "unknown");
    return res;
  };
}
