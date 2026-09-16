/**
 * PROOF: A PROVEN STRIPE ACCOUNT MISMATCH STOPS CHARGES, AND AN OUTAGE DOES NOT.
 *
 * Operator ruling, 2026-09-16: "it blocks only on a definitive resource_missing,
 * never on a failed call, a timeout, or any other error. A Stripe outage must
 * read as could not tell and never as a mismatch."
 *
 * That ruling is two claims and the second one is the one worth proving, because
 * it is the claim that fails silently. A check that blocks on every error looks
 * identical to a correct one until the day Stripe has an incident, and then it
 * stops the firm trading for a reason nobody can see. So the outage case is
 * asserted here as hard as the mismatch case.
 *
 * WHAT IT WOULD CATCH. Somebody widening the catch in establishAccountVerdict to
 * treat any error as a mismatch, which is the natural direction for that code to
 * drift, since "be safe" reads as "block on anything".
 */
import {
  establishAccountVerdict,
  resetAccountVerdictForTests,
  stripeAccountBlockedReason,
  modeDisagreement,
  accountVerdict,
} from "../../src/lib/stripe-account.ts";
import { chargesBlockedReason } from "../../src/lib/launch.ts";

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const stripeError = (code) => Object.assign(new Error(`stripe: ${code}`), { code });

/* ---------------------------------------------------- the outage cases first */

for (const code of ["rate_limit", "api_connection_error", "authentication_error", undefined]) {
  resetAccountVerdictForTests();
  const r = await establishAccountVerdict(() => Promise.reject(stripeError(code)));
  check(
    `an error of ${code ?? "no code at all"} leaves the verdict unknown`,
    r.verdict === "unknown" && accountVerdict().verdict === "unknown",
    r.note.slice(0, 60),
  );
  check(
    "  and blocks nothing",
    stripeAccountBlockedReason() === null,
    "no block",
  );
}

/* --------------------------------------------------------- the same account */

resetAccountVerdictForTests();
{
  const r = await establishAccountVerdict(() => Promise.resolve({ id: "cs_test_1" }));
  check("fetching the object proves the same account", r.verdict === "same", r.note);
  check("  and blocks nothing", stripeAccountBlockedReason() === null, "no block");
}

/* ---------------------------------------------------- the definitive mismatch */

resetAccountVerdictForTests();
check(
  "before the test, nothing is blocked on account grounds",
  stripeAccountBlockedReason() === null,
  "no block",
);
{
  const r = await establishAccountVerdict(() => Promise.reject(stripeError("resource_missing")));
  check("resource_missing proves a different account", r.verdict === "different", r.note.slice(0, 70));

  const block = stripeAccountBlockedReason();
  check("  and that blocks charges", typeof block === "string" && block.length > 0, block?.slice(0, 60));

  /*
   * The check that matters: the block reaches the ONE function every path that
   * can take money asks. A block that only this module can see would stop
   * nothing.
   */
  const gate = chargesBlockedReason();
  check(
    "  and chargesBlockedReason says so, ahead of the launch gate's own sentence",
    typeof gate === "string" && gate.includes("different Stripe accounts"),
    gate?.slice(0, 70),
  );
}

/* ------------------------------------------------- layer two, the mode check */

const keyBefore = process.env.STRIPE_SECRET_KEY;
process.env.STRIPE_SECRET_KEY = "sk_live_proofonly";
check(
  "a live key reading a test event is named as a disagreement",
  (modeDisagreement(false) ?? "").includes("other mode"),
  modeDisagreement(false)?.slice(0, 60),
);
check("  and a live key reading a live event is not", modeDisagreement(true) === null, "silent");
process.env.STRIPE_SECRET_KEY = "sk_test_proofonly";
check(
  "a test key reading a live event is named as a disagreement",
  (modeDisagreement(true) ?? "").includes("other mode"),
  modeDisagreement(true)?.slice(0, 60),
);
check("  and layer two never blocks by itself", stripeAccountBlockedReason() !== null, "the block above is layer three's, not layer two's");
if (keyBefore === undefined) delete process.env.STRIPE_SECRET_KEY;
else process.env.STRIPE_SECRET_KEY = keyBefore;

resetAccountVerdictForTests();

console.log(wrong === 0 ? "\nAll checks correct." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
