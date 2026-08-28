import "server-only";

/**
 * Login rate limiting.
 *
 * WHAT THIS DEFENDS AND WHAT IT DOES NOT
 * --------------------------------------
 * It defends one thing: online guessing of the operator passphrase. A passphrase
 * of twelve characters or more is not going to fall to a few attempts, but an
 * unlimited endpoint invites somebody to try anyway, and the log noise alone is
 * worth preventing.
 *
 * It does not defend against a distributed attempt from many addresses, and it
 * is not pretending to. The honest control for that is the passphrase length
 * floor in admin-auth.ts.
 *
 * IN MEMORY, AND WHY THAT IS THE RIGHT SIZE HERE
 * ----------------------------------------------
 * The state lives in a module level Map, so it is per instance and it resets on
 * deploy. On a serverless platform that means a determined attacker who can
 * cause new instances could reset their own budget.
 *
 * The alternative is a Redis or a database table, and the trade is real: a store
 * on the login path is a dependency that, when it is down, either fails open,
 * which defeats the control, or fails closed, which locks the operator out of
 * their own portal during an unrelated outage. For one operator and one
 * passphrase, a per instance limiter that raises the cost and never blocks the
 * legitimate sign in is the better failure shape.
 *
 * That reasoning is written down because it is a decision, not an oversight. If
 * this portal ever has more than one user it should be revisited.
 *
 * COUNTED BY ADDRESS, WITH A CAP ON THE MAP
 * -----------------------------------------
 * The map is bounded and prunes on write. An unbounded map keyed by a value the
 * caller controls is itself the denial of service, which is a fine irony to
 * avoid shipping in a rate limiter.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const MAX_TRACKED = 5000;

type Bucket = { count: number; first: number };
const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < MAX_TRACKED) return;
  for (const [key, b] of buckets) {
    if (now - b.first > WINDOW_MS) buckets.delete(key);
  }
  // Still full of live entries: this is an attack, and dropping the oldest is
  // better than growing without bound.
  if (buckets.size >= MAX_TRACKED) {
    const oldest = [...buckets.entries()].sort((a, b) => a[1].first - b[1].first);
    for (const [key] of oldest.slice(0, Math.floor(MAX_TRACKED / 4))) buckets.delete(key);
  }
}

export type RateResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/** Record an attempt and say whether it is allowed. */
export function takeLoginAttempt(key: string, now: number = Date.now()): RateResult {
  prune(now);
  const existing = buckets.get(key);

  if (!existing || now - existing.first > WINDOW_MS) {
    buckets.set(key, { count: 1, first: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > MAX_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.first + WINDOW_MS - now) / 1000),
    };
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - existing.count, retryAfterSeconds: 0 };
}

/**
 * A successful sign in clears the budget.
 *
 * Otherwise an operator who mistyped six times and then got it right would still
 * be two attempts from a lockout they have already disproved the need for.
 */
export function clearLoginAttempts(key: string) {
  buckets.delete(key);
}

/**
 * The client address, from the platform header.
 *
 * `x-forwarded-for` is attacker controlled in general, and behind Vercel the
 * left most entry is the real client because the platform rewrites it. That is
 * a deployment assumption and it is written here rather than assumed silently:
 * running this behind a different proxy would need this line revisited.
 *
 * Falls back to a single shared bucket rather than to no limiting, so a missing
 * header tightens the control instead of removing it.
 */
export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  if (first && first.length <= 64) return first;
  return "unknown";
}
