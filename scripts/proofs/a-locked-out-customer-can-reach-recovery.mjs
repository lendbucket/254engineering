/**
 * A PERSON WHO CANNOT SIGN IN CAN REACH THE SCREEN FOR PEOPLE WHO CANNOT SIGN IN.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-locked-out-customer-can-reach-recovery.mjs
 *
 * Operator ruling, 2026-10-01: add a proof that a signed out visitor reaches
 * `/account/forgot-password` and that the API answers without a 401.
 *
 * WHAT WENT WRONG, because the proof is shaped by it. Password recovery shipped
 * on 2026-09-29 and neither its page nor its endpoint was added to
 * `CUSTOMER_OPEN_PATHS` in `src/proxy.ts`. The perimeter therefore answered a
 * signed out visitor with a 307 to `/account/login?next=/account/forgot-password`
 * and the endpoint with 401 "Not signed in." A door for somebody who cannot sign
 * in sat behind a check for being signed in, and the feature was unreachable by
 * everybody it exists for.
 *
 * The same thing happened to SIGN UP on 2026-09-13 and the comment recording it
 * is directly above the set that was missing these two entries.
 *
 * WHY THIS CALLS THE PERIMETER RATHER THAN READING IT.
 *
 * The obvious cheap version greps `proxy.ts` for the two strings. That is a check
 * on wording: it passes on a path listed in a comment, on a path listed in the
 * PARTNER set, and on a set that is declared and never consulted. CLAUDE.md
 * records exactly this failure as the reason the original defect was invisible,
 * because `accounts-audit` asserted the list EXISTS and so passed over any
 * contents at all.
 *
 * So this imports `proxy` and calls it with a real `NextRequest`, signed out, and
 * asks what it answers. The only thing that can satisfy it is the perimeter
 * actually letting the request through.
 *
 * AND BOTH DIRECTIONS ARE PROVED. A perimeter that lets everything through would
 * satisfy the first half perfectly, so the same function is asked about the
 * screens that MUST stay shut. Without that half this file would pass on a
 * proxy with its account branch deleted, which is the hole it is guarding.
 */

import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy.ts";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/** What does the perimeter do with this path, signed out? */
function answerFor(path, method = "GET") {
  const res = proxy(new NextRequest(`https://254engineering.com${path}`, { method }));
  /*
   * `NextResponse.next()` is the pass-through. It carries the internal header
   * Next uses to mean "continue", and it is a 200 with no location. A refusal is
   * either a redirect carrying a location or a JSON 401.
   */
  const location = res.headers.get("location");
  return { status: res.status, location, passedThrough: !location && res.status === 200 };
}

/* --------------------------- 1. the recovery door, which must be open */

const MUST_BE_OPEN = [
  ["the recovery screen", "/account/forgot-password", "GET"],
  ["the recovery endpoint", "/api/account/forgot-password", "POST"],
];

for (const [what, path, method] of MUST_BE_OPEN) {
  const a = answerFor(path, method);
  rec(
    `a signed out visitor reaches ${what}`,
    a.passedThrough,
    a.passedThrough
      ? `${method} ${path} passed through the perimeter`
      : `${method} ${path} answered ${a.status}${a.location ? ` to ${a.location}` : ""}, so the people it exists for cannot reach it`,
  );
}

/*
 * THE ENDPOINT MUST NOT ANSWER 401 SPECIFICALLY, which is the operator's wording
 * and is worth its own assertion. A 401 from the perimeter and a 400 from the
 * route's own validation are completely different facts, and only the first means
 * the door is shut. Asserting "not 401" separately from "passed through" means a
 * future perimeter that answers 403 instead is still caught by the line above
 * while this line keeps naming the exact status the defect produced.
 */
{
  const a = answerFor("/api/account/forgot-password", "POST");
  rec(
    "and the recovery endpoint does not answer 401",
    a.status !== 401,
    a.status === 401 ? "the perimeter refused it as not signed in" : `it answered ${a.status}`,
  );
}

/* ------------- 2. and the perimeter still shuts what it is supposed to shut */

/*
 * WITHOUT THIS HALF THE PROOF PASSES ON A DELETED PERIMETER. Every one of these
 * is a screen or endpoint that holds somebody's own orders, settings or
 * statements, and a signed out caller must not reach any of them.
 */
const MUST_STAY_SHUT = [
  ["the account home", "/account", "GET"],
  ["the settings screen", "/account/settings", "GET"],
  ["the orders list", "/account/orders", "GET"],
  ["the statements screen", "/account/statements", "GET"],
  ["a portal screen", "/portal/files", "GET"],
  ["a partner screen", "/partner/statements", "GET"],
];

for (const [what, path, method] of MUST_STAY_SHUT) {
  const a = answerFor(path, method);
  rec(
    `and a signed out caller does NOT reach ${what}`,
    !a.passedThrough,
    a.passedThrough
      ? `${method} ${path} passed straight through, so the perimeter is open`
      : `refused with ${a.status}${a.location ? ` to ${new URL(a.location, "https://x").pathname}` : ""}`,
  );
}

/* ------------------------------------------------------------------ verdict */

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(
    `PASS: ${out.length} checks. Recovery is reachable by somebody who cannot sign in, and nothing else opened.`,
  );
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
