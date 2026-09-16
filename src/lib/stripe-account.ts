/**
 * THIS MODULE DELIBERATELY DOES NOT CARRY `server-only`, AND THE REASON IS A
 * CONSTRAINT THAT BELONGS TO THE BUNDLER RATHER THAN TO THE TYPE SYSTEM.
 *
 * `launch.ts` reads `stripeAccountBlockedReason` from here, and `launch.ts` is
 * imported by CLIENT components (HomeHero among them). A `server-only` import
 * anywhere in that graph fails the build while `tsc` stays clean, which is the
 * exact pairing CLAUDE.md section 6 records.
 *
 * It is safe without it. Nothing here returns a secret: `keyIsLiveMode` reads
 * `STRIPE_SECRET_KEY`, which Next replaces only for `NEXT_PUBLIC_` names, so in
 * a client bundle it is undefined and the function answers null. The values
 * that must never reach a browser live in `payments-stripe.ts`, which does
 * carry `server-only`.
 */

/**
 * ARE THE SECRET KEY AND THE SIGNING SECRET THE SAME STRIPE ACCOUNT?
 *
 * Operator ruling, 2026-09-16. This is layers two and three of the account
 * consistency check; layer one is `scripts/stripe-webhook-audit.mjs` and runs
 * before any merge that touches payments.
 *
 * THE FAILURE THIS EXISTS FOR. The key creates sessions in account A. The
 * signing secret belongs to account B. Nothing in this platform compared them,
 * and the symptom is a customer paying, Stripe showing the charge, and the
 * order never leaving awaiting_payment.
 *
 * THE WORST VERSION SENDS NO WEBHOOK AT ALL, which is why the layer that
 * matters is not in this file. If our URL is registered only in B, then A never
 * calls us: no 400, no log line, no event. Everything here runs ON a webhook,
 * so in the silent case it is green for the reason that mattered. Layer one is
 * the answer to that, because it asks the question without waiting to be called.
 *
 * WHAT STRIPE DOES NOT GIVE YOU. `whsec_...` encodes no account and no API maps
 * a signing secret to one, so the two accounts cannot be compared directly.
 * `event.account` is populated only for Connect events forwarded from a
 * connected account; a direct integration's events do not carry it. So the
 * definitive test is indirect: fetch the event's OWN object with the secret key
 * and see whether that account has ever heard of it.
 */

export type AccountVerdict =
  /** Proven the same account: the key could fetch the event's own object. */
  | "same"
  /** Proven different: the key's account has no such object. */
  | "different"
  /** Not established. A failed call, a timeout, an outage, or not asked yet. */
  | "unknown";

/*
 * THE THIRD VERDICT IS THE POINT, AND IT IS THE OPERATOR'S RULING.
 *
 * A Stripe outage must read as "could not tell" and never as a mismatch. Only
 * a definitive `resource_missing` means different: every other error, every
 * timeout, every network failure leaves this "unknown" and blocks nothing.
 * Taking money the platform cannot record is worse than not trading for an
 * hour, and the customer pays for the first one; but a check that shuts the
 * firm on a transient error would cost the second thing for no reason.
 */
let verdict: AccountVerdict = "unknown";
let verdictNote = "not yet established";

/**
 * WHY THIS IS PER PROCESS AND WHAT THAT COSTS, STATED RATHER THAN GLOSSED.
 *
 * The verdict lives in module state, so it is established once per process on
 * the first webhook that process verifies, and a second process starts at
 * "unknown". On serverless that means one extra Stripe call per cold start, on
 * a webhook only, never on a customer's request.
 *
 * The consequence worth knowing: a mismatch proven in the WEBHOOK process is
 * not visible to a CHECKOUT process, so the block below is per instance. The
 * durable signals are the system task and the alert, which are raised once and
 * stay raised. Closing that gap properly needs a row, which needs a migration,
 * which would be pending and hold a merge, so it is in BACKLOG.md rather than
 * half done here.
 */
export function accountVerdict(): { verdict: AccountVerdict; note: string } {
  return { verdict, note: verdictNote };
}

/** Test seam. Never called by the product. */
export function resetAccountVerdictForTests(): void {
  verdict = "unknown";
  verdictNote = "not yet established";
}

/**
 * THE BLOCK, READ BY `chargesBlockedReason`.
 *
 * Null unless the mismatch is PROVEN. "unknown" never blocks, which is the
 * ruling: an outage is not a mismatch.
 */
export function stripeAccountBlockedReason(): string | null {
  if (verdict !== "different") return null;
  return (
    "Payments are stopped because this deployment's Stripe secret key and webhook signing secret " +
    "belong to different Stripe accounts. A payment taken now would be charged and could not be " +
    "recorded against its order."
  );
}

/** The mode the secret key is for, read off its prefix. No API call. */
export function keyIsLiveMode(): boolean | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return true;
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return false;
  return null;
}

/**
 * LAYER TWO. Free, on every verified webhook, no API call.
 *
 * `event.livemode` against the mode in the key's prefix. A disagreement is a
 * real misconfiguration: live sessions are created under the key while the
 * events arriving describe the other mode, so nothing will ever match.
 *
 * IT IS LOUD AND IT DOES NOT BLOCK. Blocking is reserved for the definitive
 * test in layer three, by ruling. This says so rather than deciding.
 */
export function modeDisagreement(eventLivemode: boolean): string | null {
  const live = keyIsLiveMode();
  if (live === null) return null;
  if (live === eventLivemode) return null;
  return (
    `The Stripe secret key is a ${live ? "live" : "test"} mode key and this webhook is a ` +
    `${eventLivemode ? "live" : "test"} mode event. The signing secret belongs to an endpoint in the ` +
    "other mode, so no event will ever match a session this key created."
  );
}

/**
 * LAYER THREE. One call, once per process, on the first verified webhook.
 *
 * `fetchOwnObject` fetches the event's own object with the SECRET KEY. Found
 * means the key's account owns it, so the two credentials are the same account.
 * A definitive `resource_missing` means that account has never heard of an
 * object it was just told about, which is only true across accounts.
 *
 * Every other outcome leaves the verdict unknown ON PURPOSE.
 */
export async function establishAccountVerdict(
  fetchOwnObject: () => Promise<unknown>,
): Promise<{ verdict: AccountVerdict; note: string; changed: boolean }> {
  if (verdict !== "unknown") return { verdict, note: verdictNote, changed: false };

  try {
    await fetchOwnObject();
    verdict = "same";
    verdictNote = "the secret key fetched the object this webhook described";
    return { verdict, note: verdictNote, changed: true };
  } catch (err) {
    const code = (err as { code?: string; type?: string } | null)?.code;
    if (code === "resource_missing") {
      verdict = "different";
      verdictNote =
        "the secret key's account has never heard of the object this webhook described, which is only " +
        "true when the signing secret belongs to a different Stripe account";
      return { verdict, note: verdictNote, changed: true };
    }
    /*
     * Deliberately not a mismatch. A rate limit, an outage, a timeout, an
     * expired key and a permissions error all land here, and every one of them
     * is "could not tell". The next webhook asks again.
     */
    verdictNote = `could not tell: ${err instanceof Error ? err.message : "unknown error"}`;
    return { verdict: "unknown", note: verdictNote, changed: false };
  }
}
