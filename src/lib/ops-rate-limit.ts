import "server-only";

/**
 * Sign in rate limiting.
 *
 * WHY THIS WAS REWRITTEN
 * ----------------------
 * The first version counted by IP address alone: eight attempts in fifteen
 * minutes and then a refusal. It did its job and it locked the operator out of
 * his own portal with a handful of typos, which is a real failure mode and not
 * an acceptable cost. A control that stops the owner working is a control that
 * gets switched off.
 *
 * TWO BUCKETS, AND THE TIGHT ONE IS PER ACCOUNT
 * ---------------------------------------------
 * An attacker guessing one account's password and an operator mistyping his own
 * look identical from one IP. They stop looking identical the moment the address
 * being attempted is part of the key.
 *
 *   Per identity: IP plus the email being tried. Eight in fifteen minutes. This
 *   is the one that actually stops password guessing, and it is the one a typo
 *   consumes.
 *
 *   Per address: the IP alone. Forty in fifteen minutes. This is what stops
 *   somebody spraying one password across two hundred addresses from a single
 *   host, which the per identity bucket alone would happily allow.
 *
 * The operator mistyping his own password now costs him eight attempts against
 * his own address, not eight against everything he might try next, and the
 * ceiling that would lock him out entirely is five times further away.
 *
 * A SUCCESSFUL SIGN IN CLEARS BOTH
 * --------------------------------
 * Getting in is proof you are not the attacker this exists to slow down.
 *
 * IT IS STILL PER INSTANCE, AND THAT IS STILL WRITTEN DOWN
 * --------------------------------------------------------
 * The map lives in memory. On a serverless platform a determined attacker who
 * can cause new instances can reset their own budget, and the operator can be
 * refused by one instance and admitted by the next. The reasoning for accepting
 * that has not changed: a shared store on the sign in path either fails open,
 * defeating the control, or fails closed, locking the operator out during an
 * unrelated outage.
 *
 * The practical consequence for a locked out operator is worth knowing rather
 * than discovering: because the state is per instance and instances recycle, a
 * lockout is often already gone. Retrying a minute later frequently lands on a
 * different instance with an empty bucket.
 *
 * And when it does not, there is a documented way out that does not involve
 * waiting: see releaseLock and src/app/api/portal/unlock/route.ts.
 */

const WINDOW_MS = 15 * 60 * 1000;

/** Attempts against one account from one address before it is refused. */
const MAX_PER_IDENTITY = 8;

/**
 * Attempts from one address across ALL accounts before it is refused.
 *
 * Deliberately well above the per identity ceiling. It exists to stop spraying,
 * not to catch a person who cannot remember which of two passwords they used.
 */
const MAX_PER_ADDRESS = 40;

const MAX_TRACKED = 5000;

type Bucket = { count: number; first: number };
const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < MAX_TRACKED) return;
  for (const [key, b] of buckets) {
    if (now - b.first > WINDOW_MS) buckets.delete(key);
  }
  // Still full of live entries: this is an attack, and dropping the oldest is
  // better than growing without bound. An unbounded map keyed by a value the
  // caller controls is itself the denial of service.
  if (buckets.size >= MAX_TRACKED) {
    const oldest = [...buckets.entries()].sort((a, b) => a[1].first - b[1].first);
    for (const [key] of oldest.slice(0, Math.floor(MAX_TRACKED / 4))) buckets.delete(key);
  }
}

export type RateResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** Which ceiling refused, so the log says something useful. */
  scope?: "identity" | "address";
};

function take(key: string, max: number, now: number): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const existing = buckets.get(key);

  if (!existing || now - existing.first > WINDOW_MS) {
    buckets.set(key, { count: 1, first: now });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.first + WINDOW_MS - now) / 1000)),
    };
  }
  return { allowed: true, remaining: max - existing.count, retryAfterSeconds: 0 };
}

/**
 * Record an attempt.
 *
 * `identity` is the email being tried, lowercased by the caller. Passing it is
 * what separates a typo from an attack, so a caller that omits it gets the old
 * blunt behaviour and deserves it.
 */
export function takeLoginAttempt(address: string, identity?: string, now: number = Date.now()): RateResult {
  prune(now);

  const perAddress = take(`ip:${address}`, MAX_PER_ADDRESS, now);
  if (!perAddress.allowed) return { ...perAddress, scope: "address" };

  if (!identity) return perAddress;

  const perIdentity = take(`id:${address}:${identity}`, MAX_PER_IDENTITY, now);
  if (!perIdentity.allowed) return { ...perIdentity, scope: "identity" };

  return perIdentity;
}

/** A successful sign in. Clears both buckets for that caller and account. */
export function clearLoginAttempts(address: string, identity?: string) {
  buckets.delete(`ip:${address}`);
  if (identity) buckets.delete(`id:${address}:${identity}`);
}

/**
 * The break glass: drop every bucket belonging to one address.
 *
 * Used by /api/portal/unlock, which requires a secret. Returns how many entries
 * were dropped so the caller can be told something true rather than "done".
 */
export function releaseLock(address: string): number {
  let dropped = 0;
  for (const key of [...buckets.keys()]) {
    if (key === `ip:${address}` || key.startsWith(`id:${address}:`)) {
      buckets.delete(key);
      dropped++;
    }
  }
  return dropped;
}

/** What the caller's current position is, without recording an attempt. */
export function inspectLock(address: string, identity?: string, now: number = Date.now()) {
  const read = (key: string, max: number) => {
    const b = buckets.get(key);
    if (!b || now - b.first > WINDOW_MS) return { used: 0, max, secondsLeft: 0 };
    return {
      used: b.count,
      max,
      secondsLeft: Math.max(0, Math.ceil((b.first + WINDOW_MS - now) / 1000)),
    };
  };
  return {
    address: read(`ip:${address}`, MAX_PER_ADDRESS),
    identity: identity ? read(`id:${address}:${identity}`, MAX_PER_IDENTITY) : null,
  };
}

/** The caller's address, from the proxy headers. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export const RATE_LIMITS = { WINDOW_MS, MAX_PER_IDENTITY, MAX_PER_ADDRESS };
