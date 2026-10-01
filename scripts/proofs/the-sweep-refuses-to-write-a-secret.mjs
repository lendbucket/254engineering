/**
 * THE SWEEP REFUSES TO WRITE A SECRET, AND REFUSING IS NOT REDACTING.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-sweep-refuses-to-write-a-secret.mjs
 *
 * Operator ruling, 2026-09-30: the break-it sweep "must never print, log, or
 * write to the report any secret, token, hash or signed value, even truncated.
 * Assert that in the script before it writes anything."
 *
 * WHAT THIS PROVES, AND WHY EACH HALF IS NEEDED.
 *
 * A guard that refuses everything satisfies the ruling and is useless, because
 * the report never gets written and somebody switches it off. A guard that
 * refuses nothing passes every test anybody writes against prose. So both
 * directions are proved: the shapes that must be refused, and the ordinary
 * sentences a findings table is actually made of, which must survive.
 *
 * THE ALLOWED CASES ARE THE REAL ONES. Every line in the allow set is a sentence
 * this sweep genuinely produces: a route with a status, a height in pixels, a
 * probe address on the reserved domain, a uuid, a contrast ratio, a git sha. A
 * guard tested only against invented prose is a guard tested against nothing it
 * will meet.
 *
 * AND THE REFUSAL MUST NOT QUOTE WHAT IT CAUGHT, which is the subtle half: a
 * guard that reported "refused because it contains eyJhbGci..." would be the
 * leak it exists to prevent, in the error message. That is asserted too.
 */

import {
  assertNothingSecret,
  innocentCount,
  innocentNames,
  refusalFor,
  registerEnvironment,
  treatAsSecret,
} from "../sweep/lib/secrecy.mjs";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------- 1. shapes it must refuse */

/**
 * EVERY FIXTURE IS ASSEMBLED AT RUNTIME, SO NO FILE CONTAINS A KEY SHAPE.
 *
 * Operator order, 2026-10-01, after GitHub's push protection blocked a push on
 * this very file: a Stripe key pattern on line 43. Compared in process against
 * all 48 candidate values in the environment and .env.local: NO MATCH. It was
 * an invented fixture, not a credential.
 *
 * THAT IT WAS FAKE IS NOT THE POINT, and this is the part worth keeping. A
 * secret scanner cannot tell an invented key from a real one, and neither can
 * the next person to read the diff. A file that trips a scanner trains everyone
 * to click through the warning, which is how the real one gets pushed. So the
 * repository contains no string a scanner reads as a key, and the shapes the
 * guard must refuse are built from fragments a moment before they are used.
 *
 * IT IS ALSO A SHARPER TEST THAN THE LITERALS WERE. Building each shape from
 * its parts means the test states the SHAPE it is checking rather than one
 * example of it, so a reader can see what the guard is meant to catch without
 * decoding a blob.
 */
const join = (...parts) => parts.join("");
const run = (char, n) => char.repeat(n);

const MUST_REFUSE = [
  [
    "a JSON web token",
    join("GET /api/thing with ", "ey", "Jh", run("Z", 14), ".", "ey", run("J", 12), " attached"),
  ],
  ["a Supabase key", join("the client used ", "sb", "_", "secret", "_", run("k", 20))],
  ["a bearer header", join("sent Authorization: ", "Bearer", " ", run("t", 28))],
  ["a Stripe secret", join("configured with ", "sk", "_", "live", "_", run("5", 24))],
  ["a hex digest", join("token_hash ", run("a1b2c3d4", 6))],
  ["a signed cookie", join("cookie eng_customer=", run("c", 26), ".", run("d", 12))],
  ["a long opaque token", join("reset link carried ", run("x", 44))],
];

for (const [what, line] of MUST_REFUSE) {
  rec(`it refuses ${what}`, refusalFor(line) !== null, refusalFor(line) ?? "ALLOWED, which is the leak");
}

/* ------------------------------------- 2. the sentences a report is made of */

const MUST_ALLOW = [
  "/account/login | signed out | 390 | HTTP 200, rendered height 1874px",
  "/portal/queue | admin | 1280 | HTTP 200, 3 console errors",
  "probe-1790739946926@example.invalid signed in and the dashboard answered 200",
  "account 3012b04e-eca9-4d27-8310-3ac58447998d was superseded, not deleted",
  "contrast 4.49 against a floor of 4.5 on --color-slate-fg-label",
  "the board at 2a1ab06 returned 59 of 59",
  "the wordmark rendered 165.41 x 84 px against clamp(58px, 9vw, 84px)",
  "COULD NOT TELL: the live half did not run, no server answered on 3225",
  "step 3 is 10,748px tall at 390, which is roughly thirteen phone heights",
];

for (const line of MUST_ALLOW) {
  const refusal = refusalFor(line);
  rec(
    `it allows: ${line.slice(0, 52)}${line.length > 52 ? "..." : ""}`,
    refusal === null,
    refusal ?? "",
  );
}

/* --------------------------------- 3. a registered value, however it appears */

/* Assembled too, for the same reason: 49 characters of token shape in a source
 * file is a string a scanner reads as a credential whatever it actually is. */
const REGISTERED = join("s3cr3t", "-", run("v", 20), "-", "registered-at-runtime");
treatAsSecret(REGISTERED);
rec(
  "it refuses a value registered at runtime, mid sentence",
  refusalFor(`the cookie was signed with ${REGISTERED} today`) !== null,
  "an environment value is registered wholesale rather than named",
);

/*
 * SHORT VALUES ARE NOT REGISTERED, and that is deliberate rather than an
 * oversight. Registering a three character value would make the guard match
 * ordinary prose and refuse every report for ever, which is how a check nobody
 * can satisfy gets switched off.
 */
treatAsSecret("abc");
rec(
  "and it ignores a value too short to be a credential",
  refusalFor("the abc column was empty") === null,
  "a guard that cannot be satisfied is a guard somebody removes",
);

/* --------------------------- 2b. a long route slug is not a token */

/*
 * THE SECOND REGRESSION THE SWEEP FOUND IN ITS OWN GUARD.
 *
 * `a long opaque token` is forty or more characters of `[A-Za-z0-9_-]`, and a
 * hyphen is in that class, so the two longest article slugs on this site are
 * token shaped. Two rows of the first report were replaced by withheld notices,
 * and both carried an ordinary page height finding.
 *
 * Both halves are asserted. The slugs must survive, and the exemption must not
 * have opened a door: a hyphenated run with a long segment, one carrying
 * uppercase, and one with no hyphens at all are all still refused. Without
 * those three the fix could have closed the hole by closing the check, which is
 * the failure this file exists to catch.
 *
 * TWO OF THE THREE SURVIVING CASES EXERCISE THE EXEMPTION, NOT THREE, and
 * saying so is the point of the note. Disabling the exemption turns the first
 * two red and leaves the third green, because thirty four characters never
 * reached the forty character pattern in the first place. It is kept as a check
 * that an ordinary route line is writable, and it is not evidence about the
 * slug rule. Counting it as such would be a green over a case that never ran.
 */
const SLUGS_MUST_SURVIVE = [
  "| 29 | `/insights/texas-professional-services-procurement-act` | signed out | 390 | 9000px tall |",
  "| 37 | `/insights/engineer-letter-vs-windstorm-certificate` | signed out | 390 | 9000px tall |",
  "/careers/field-inspection-technician answered 200",
];
for (const line of SLUGS_MUST_SURVIVE) {
  const refusal = refusalFor(line);
  rec(`a long route slug survives: ${line.slice(12, 56)}`, refusal === null, refusal ?? "");
}

const SLUG_SHAPED_BUT_SECRET = [
  ["a hyphenated run with a long segment", join("the cookie was ", run("q", 20), "-", run("z", 20))],
  ["a hyphenated run carrying uppercase", join("the cookie was ", "Ab", run("c", 18), "-", run("d", 20))],
  ["a long run with no hyphens", join("the cookie was ", run("k", 44))],
];
for (const [what, line] of SLUG_SHAPED_BUT_SECRET) {
  rec(
    `and the slug exemption does not excuse ${what}`,
    refusalFor(line) !== null,
    refusalFor(line) ?? "ALLOWED, so the exemption closed the check",
  );
}

/*
 * THE EXEMPTIONS ARE COUNTED, because an exemption nobody counts becomes the
 * rule. Four is the number this guard is allowed, and a fifth is a deliberate
 * edit here as well as there.
 */
rec(
  "exactly four shapes are excused, and they are named",
  innocentCount() === 4,
  innocentNames().join("; "),
);

/* -------------------- 3b. an environment MODE is not a credential */

/*
 * THE REGRESSION THIS EXISTS FOR, FOUND BY THE SWEEP ITSELF.
 *
 * registerEnvironment used to register every value of eight characters or more.
 * VERCEL_ENV holds "production", which is ten, and "reproduction" contains it.
 * So a genuine finding reading "a valid reproduction was accepted first" was
 * withheld from the report as though it carried a secret.
 *
 * A credential is long and arbitrary; a mode, a flag or a region is a short
 * dictionary word. The distinction is derived rather than listed, because an
 * allowlist of names is a list somebody grows until the scan checks nothing.
 */
registerEnvironment({
  VERCEL_ENV: "production",
  VERCEL_TARGET_ENV: "production",
  NODE_ENV: "development",
  SOME_REGION: "us-central1",
});
for (const line of [
  "a valid reproduction was accepted first, so the case was genuinely exercised",
  "the development database answered, and production was never touched",
  "the preview deployment reads the development project",
]) {
  rec(`an environment mode does not refuse: ${line.slice(0, 44)}...`, refusalFor(line) === null, refusalFor(line) ?? "");
}

/*
 * AND THE STRICTER DOOR MUST STILL REGISTER A REAL ONE, or the fix would have
 * closed the hole by closing the check. A long arbitrary value from the
 * environment is still caught.
 */
const LONG_ARBITRARY = join(run("Q", 9), "7", run("z", 9), "4", run("M", 9));
registerEnvironment({ SOME_SECRET: LONG_ARBITRARY });
rec(
  "but a long arbitrary environment value is still registered",
  refusalFor(`the client was configured with ${LONG_ARBITRARY} today`) !== null,
  "the floor rose from eight to sixteen and excluded single lowercase words, nothing more",
);

/* ------------------------------------------- 4. it refuses, it does not redact */

let threw = null;
try {
  assertNothingSecret("a fine line\nBearer abcdefghijklmnopqrstuvwxyz012345\nanother fine line", "the test report");
} catch (e) {
  threw = e;
}
rec("assertNothingSecret throws rather than returning a cleaned string", threw !== null, threw ? "" : "it returned");
rec(
  "and the throw names the line number",
  threw !== null && /line 2\b/.test(threw.message),
  threw ? threw.message.slice(0, 60) : "",
);

/*
 * THE SUBTLE HALF. A guard that said "refused because it contains Bearer abc..."
 * would be the leak it exists to prevent, written into an error message that
 * goes to a terminal and often into a log.
 */
rec(
  "and the throw does NOT reproduce what it caught",
  threw !== null && !threw.message.includes("abcdefghijklmnopqrstuvwxyz012345"),
  "a guard that quotes the secret it refused has leaked it",
);

/* ------------------------------------------------ 5. a clean report is written */

const clean = MUST_ALLOW.join("\n");
let ok = null;
try {
  ok = assertNothingSecret(clean, "the test report");
} catch (e) {
  ok = null;
}
rec(
  "a report made only of real findings lines passes",
  ok !== null && ok.lines === MUST_ALLOW.length,
  ok ? `${ok.lines} lines checked` : "it refused a clean report, which would make the sweep undeliverable",
);

/* ------------------------------------------------------------------ verdict */

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. The sweep cannot write a secret, and can still write a report.`);
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
