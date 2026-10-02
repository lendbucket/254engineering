/**
 * CHECKOUT STAMPS AN ACCOUNT ONLY WHEN SOMEBODY IS SIGNED IN, AND THE ANONYMOUS
 * PATH STORES WHAT IT ALWAYS STORED.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/checkout-stamps-only-a-signed-in-account.mjs
 *
 * Operator ruling, 2026-09-30: "the order flow reads the session and stamps
 * account_id at placement when a customer is signed in. The anonymous path must
 * behave exactly as it does today; prove that with a proof script before and
 * after."
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT, said first because the limit matters.
 *
 * It proves the VALUE the insert will carry, for every shape of input the two
 * paths produce. It does not place an order, so it does not prove the database
 * accepted it, and it is not evidence that the live anonymous checkout still
 * works end to end. That is the order flow walk's job and the sweep's, and both
 * run against a real server.
 *
 * The reason the value is worth proving on its own is that "unchanged" is a
 * claim about a column somebody would otherwise verify by reading the diff and
 * agreeing with themselves. Before this change the insert did not mention
 * `account_id` at all, so Postgres applied its default of null. After it, the
 * insert sets it explicitly. Those store the same value, and that equivalence is
 * the whole of the operator's "exactly as it does today".
 *
 * BOTH DIRECTIONS, because a function returning null for everything would
 * satisfy the anonymous half perfectly and would mean no order is ever attached
 * to the account that bought it, which is the feature.
 */

import { accountIdForPlacement } from "../../src/lib/ops-intake.ts";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const ACCOUNT = "3012b04e-eca9-4d27-8310-3ac58447998d";

/* ------------------------------------- 1. the anonymous path, every shape of it */

/*
 * EVERY SHAPE A CALLER ACTUALLY PRODUCES, not one. The web route passes
 * `signedIn?.accountId ?? null`, which is null for a visitor. The v1 API and the
 * operator intake pass nothing at all, so the property is absent. A hand built
 * body could carry an empty string. All three are the anonymous path and all
 * three must store null, because a blank string in a uuid column is an error
 * rather than an absence.
 */
const ANONYMOUS = [
  ["the web route with no session", { accountId: null }],
  ["a caller that passes nothing", {}],
  ["an explicitly undefined account", { accountId: undefined }],
  ["an empty string", { accountId: "" }],
  ["a string of spaces", { accountId: "   " }],
];

for (const [what, input] of ANONYMOUS) {
  const got = accountIdForPlacement(input);
  rec(
    `anonymous stays anonymous: ${what}`,
    got === null,
    got === null ? "null, which is what the column already held" : `it would store ${JSON.stringify(got)}`,
  );
}

/* --------------------------------------------- 2. and a signed in order is stamped */

for (const [what, input, expected] of [
  ["a signed in customer", { accountId: ACCOUNT }, ACCOUNT],
  ["an account id with stray whitespace", { accountId: `  ${ACCOUNT}  ` }, ACCOUNT],
]) {
  const got = accountIdForPlacement(input);
  rec(
    `signed in is stamped: ${what}`,
    got === expected,
    got === expected ? "the account that placed it" : `expected the account, got ${JSON.stringify(got)}`,
  );
}

/*
 * THE CHECK THAT STOPS THIS PROOF PASSING OVER A FUNCTION THAT RETURNS null FOR
 * EVERYTHING. Without it, the five anonymous cases above are satisfied by a
 * stub, and a stub means no order is ever attached to the account that bought
 * it. Stated as its own line so the vacuity is visible rather than implied.
 */
rec(
  "and the two answers are genuinely different",
  accountIdForPlacement({ accountId: ACCOUNT }) !== accountIdForPlacement({ accountId: null }),
  "a function answering the same thing either way would satisfy the anonymous half and break the feature",
);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(
    `PASS: ${out.length} checks. An anonymous order stores null as it always did, and a signed in order carries the account that bought it.`,
  );
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
