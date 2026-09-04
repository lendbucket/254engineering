/**
 * What leaves this process when something goes wrong, and whether a stalled
 * cron reads as stalled.
 *
 *   npx tsx --conditions=react-server scripts/observability-audit.mjs
 *
 * THE HEADLINE CHECK, AND WHY IT IS DONE THE WAY IT IS
 * ----------------------------------------------------
 * The operator's instruction was to verify the scrubbing "by injecting a
 * payload containing a secret, a token, a signed URL, and an identity document
 * reference and confirming what actually left the process".
 *
 * The weak version of that check reads beforeSend and asserts it calls the
 * scrubber. That proves a wire is connected and nothing about what travels
 * along it. So section 2 below stands up a real Sentry client with a transport
 * that captures the envelope instead of posting it, throws a real error
 * carrying all four kinds of secret, and asserts on the serialised bytes that
 * the transport was handed. If a secret is anywhere in that payload, in any
 * field, at any depth, the check fails.
 *
 * That is the difference between "the scrubber is wired in" and "nothing got
 * out", and only the second one is worth anything.
 *
 * It needs --conditions=react-server because it imports the observability
 * modules, which are server-only.
 */

import { readFileSync, existsSync } from "node:fs";
import {
  scrubEvent,
  scrubString,
  scrubValue,
  isSecretKey,
  fingerprintOf,
} from "../src/lib/observability-scrub.ts";
import {
  decideAlert,
  selectAlerts,
  RATE_WINDOW_MINUTES,
  RATE_THRESHOLD,
  COOLDOWN_MINUTES,
  NEW_WITHIN_MINUTES,
  MAX_ALERTS_PER_SWEEP,
} from "../src/lib/alert-rules.ts";
import { cronVerdict, WATCHED_CRONS } from "../src/lib/ops-observability.ts";
import { beforeSend, beforeBreadcrumb, sentryOptions, release } from "../src/lib/sentry-config.ts";

function codeOnly(path) {
  const withoutBlocks = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

/**
 * One function's body, so a check cannot be satisfied by a different function.
 *
 * The terminator includes a bare "async function", which it did not at first.
 * Without it, countIn's body ran on through sumIn, and an injection deleting
 * countIn's null-on-error guard was answered by the identical line inside
 * sumIn. Right string, wrong function, which is the defect this helper exists
 * to prevent and which it was quietly committing.
 */
function functionBody(source, declaration) {
  const start = source.indexOf(declaration);
  if (start === -1) return "";
  const rest = source.slice(start + declaration.length);
  const nextTop = rest.search(
    /\n(export (async )?function|export const|async function |function |registerJob\()/,
  );
  return nextTop === -1 ? rest : rest.slice(0, nextTop);
}

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

// =========================================================================
// 1. THE FOUR THINGS THAT MUST NEVER LEAVE
// =========================================================================

/**
 * The payload, and every item in it is the real SHAPE this platform holds.
 *
 * Not invented placeholders. A Supabase service role key IS a JWT, a Stripe
 * secret key IS its prefix followed by base62, and an evidence photograph IS
 * served as a URL with a token query parameter. A test built on made up shapes
 * proves the scrubber handles made up shapes.
 *
 * WHY EVERY ONE IS ASSEMBLED RATHER THAN WRITTEN OUT
 * --------------------------------------------------
 * Because they work. These are fabricated and they match the patterns real
 * credential scanners look for, which is the entire point of using them, and it
 * means a file containing them literally is a file that trips GitHub's push
 * protection. It did, on the first push of this branch.
 *
 * The wrong fix is the button GitHub offers, which allowlists the string and
 * teaches the next person that a blocked push is a formality. The right fix is
 * that the repository should not contain anything shaped like a live key at
 * rest, even a fake one: a scanner cannot tell, a grep cannot tell, and neither
 * can somebody skimming the file in six months.
 *
 * Assembled at runtime, the fixtures are identical by the time the scrubber
 * sees them and absent from the bytes on disk. The joiner is deliberately dull
 * so nobody reads cleverness into it.
 */
const join = (...parts) => parts.join("");

const SECRETS = {
  // A JWT: header.payload.signature, base64url, which is what a Supabase
  // service role key is and why that pattern is not optional in the scrubber.
  serviceRole: join(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    ".",
    "eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ",
    ".",
    "Zm9yZ2VkX3NpZ25hdHVyZV9ub3RfcmVhbA",
  ),
  stripeKey: join("sk", "_", "live", "_", "51QexampleKEYmaterialNOTreal000000"),
  webhookSecret: join("whsec", "_", "abcdefghijklmnopqrstuvwxyz012345"),
  resendKey: join("re", "_", "abcdefghij_klmnopqrstuvwxyz0123456789"),
  bearer: join("Bearer ", "abcdefghijklmnopqrstuvwxyz0123456789"),
  signedUrl: join(
    "https://ythzaiqeoijlrdibnieo.supabase.co/storage/v1/object/sign/evidence/2026/roof-north.jpg",
    "?token=",
    "eyJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJldmlkZW5jZSJ9.c2lnbmF0dXJl",
  ),
  driverLicence: "38472910",
  email: "technician.person@example.com",
};

/*
 * The assembly is worthless if it drifts from the shape it is meant to mimic,
 * so the shapes are asserted before anything is tested with them. A fixture
 * that quietly stopped looking like a Stripe key would make every check below
 * pass while proving nothing.
 */
const SHAPES = [
  ["serviceRole", /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/],
  ["stripeKey", /^sk_live_[A-Za-z0-9]{16,}$/],
  ["webhookSecret", /^whsec_[A-Za-z0-9]{16,}$/],
  ["resendKey", /^re_[A-Za-z0-9_-]{16,}$/],
  ["bearer", /^Bearer [A-Za-z0-9._~+/=-]{16,}$/],
  ["signedUrl", /^https:\/\/\S+\?token=\S+$/],
];

const ALL_SECRETS = Object.values(SECRETS);

/** Every raw secret value, plus the bare token inside the Bearer string. */
const FORBIDDEN = [...ALL_SECRETS, SECRETS.bearer.replace("Bearer ", "")];

/** Does this text contain any of them, anywhere? */
function leaks(text) {
  return FORBIDDEN.filter((secret) => text.includes(secret));
}

{
  /*
   * The fixtures still look like the things they stand for. This runs first
   * because every check after it is worthless if a fixture has drifted into a
   * shape no scrubbing pattern was written for.
   */
  for (const [name, shape] of SHAPES) {
    rec(`the ${name} fixture still has the shape it stands for`, shape.test(SECRETS[name]));
  }

  for (const [name, value] of Object.entries(SECRETS)) {
    const scrubbed = scrubString(`the value was ${value} and then some more text`);
    rec(`${name} is removed from a free text string`, !scrubbed.includes(value), scrubbed.slice(0, 70));
    rec(`${name} leaves a marker saying what was removed`, /\[redacted: /.test(scrubbed));
  }

  /*
   * The one that matters most and is easiest to get wrong: a signed URL loses
   * the WHOLE url, not just the signature. The path names the document, and a
   * path plus a bucket is enough to ask for it a second way.
   */
  const url = scrubString(`fetching ${SECRETS.signedUrl} failed`);
  rec(
    "a signed url is removed whole, path included",
    !url.includes("roof-north.jpg") && !url.includes("supabase.co/storage"),
    url.slice(0, 80),
  );

  // A publishable key is public by design. Redacting it would suggest an
  // exposure that is not one.
  const publishable = scrubString("pk_live_51QexampleNOTsecret000000");
  rec(
    "a publishable key is left alone",
    publishable.includes("pk_live_51QexampleNOTsecret000000"),
    "redacting it would claim an exposure that is not one",
  );
}

// =========================================================================
// 2. WHAT ACTUALLY LEAVES THE PROCESS
// =========================================================================
//
// A real Sentry client, a real captureException, and a transport that keeps
// the envelope instead of posting it. The assertion is on the bytes.

{
  let captured = null;
  let transportRan = false;

  try {
    const Sentry = await import("@sentry/node");

    const client = new Sentry.NodeClient({
      ...sentryOptions(),
      dsn: "https://0123456789abcdef0123456789abcdef@o0.ingest.sentry.io/0",
      enabled: true,
      /*
       * The interception point. Sentry hands the transport the fully
       * serialised envelope, which is the last thing that exists before the
       * network. Everything the SDK was going to send is in here.
       */
      transport: () => ({
        send: async (envelope) => {
          transportRan = true;
          captured = JSON.stringify(envelope);
          return {};
        },
        flush: async () => true,
      }),
      stackParser: Sentry.defaultStackParser,
      integrations: [],
    });

    const scope = new Sentry.Scope();
    scope.setClient(client);
    client.init();

    /*
     * A fault carrying all four categories, arranged the way they actually
     * arrive: in the message, in a header, in extra context, in a breadcrumb
     * and in the user object.
     */
    const err = new Error(
      `Upload failed for ${SECRETS.signedUrl} using ${SECRETS.stripeKey}`,
    );

    scope.setExtras({
      supabaseServiceRoleKey: SECRETS.serviceRole,
      stripeWebhookSecret: SECRETS.webhookSecret,
      resend: SECRETS.resendKey,
      onboarding: {
        driverLicenseNumber: SECRETS.driverLicence,
        nested: { deeper: { evidenceUrl: SECRETS.signedUrl } },
      },
      note: `the technician ${SECRETS.email} uploaded it`,
    });
    scope.setUser({ id: "profile-1", email: SECRETS.email, username: SECRETS.email });
    scope.setTag("authorization", SECRETS.bearer);
    scope.addBreadcrumb({
      category: "fetch",
      message: `GET ${SECRETS.signedUrl}`,
      data: { url: SECRETS.signedUrl, token: SECRETS.serviceRole },
    });

    client.captureException(err, undefined, scope);
    await client.flush(2000);

    rec("a real Sentry client was stood up and the transport ran", transportRan);

    if (captured) {
      const found = leaks(captured);
      rec(
        "NOTHING that left the process contains a secret",
        found.length === 0,
        found.length ? `LEAKED: ${found.map((f) => f.slice(0, 24)).join(", ")}` : `${captured.length} bytes inspected`,
      );

      // The envelope has to have actually carried the event, or the check above
      // is asserting over an empty string.
      /*
       * Asserted on the exception itself rather than on the message text.
       * The message is partly redacted by design, so matching it loosely would
       * pass on an envelope that carried nothing at all.
       */
      rec(
        "and the envelope really carried the fault",
        /"type":"Error"/.test(captured) && /Upload failed/.test(captured),
        captured.slice(0, 120),
      );

      /*
       * Matched as the release FIELD, not as a substring anywhere.
       * release() is "local" off a developer machine, and "local" appears
       * inside "localhost" in half a dozen places in an envelope, so the loose
       * version of this check would pass with no release tag at all.
       */
      rec(
        "and it carries the release, so a stack trace can be matched to code",
        new RegExp(`"release":"${release()}"`).test(captured),
        release(),
      );

      rec(
        "and the redaction markers are present, so the scrubber ran rather than the fields being empty",
        /\[redacted: /.test(captured),
      );

      // A person's email is not a secret and is still a person.
      rec(
        "and no email address left with it",
        !captured.includes(SECRETS.email),
      );
    } else {
      rec("NOTHING that left the process contains a secret", false, "no envelope was captured");
    }
  } catch (err) {
    rec(
      "a real Sentry client was stood up and the transport ran",
      false,
      err instanceof Error ? err.message : "unknown",
    );
  }
}

// =========================================================================
// 3. THE SCRUBBER'S OWN EDGES
// =========================================================================

{
  const event = scrubEvent({
    message: `failed with ${SECRETS.stripeKey}`,
    request: {
      url: SECRETS.signedUrl,
      headers: { authorization: SECRETS.bearer, "x-request-id": "abc" },
      cookies: { eng_ops: "a-real-session-cookie" },
      data: { password: "hunter2", body: SECRETS.serviceRole },
    },
    user: { id: "u1", email: SECRETS.email, ip_address: "203.0.113.9" },
    extra: { apiKey: SECRETS.resendKey },
    exception: { values: [{ type: "Error", value: `key ${SECRETS.stripeKey}` }] },
  });

  const serialised = JSON.stringify(event);
  rec("scrubEvent lets nothing through either", leaks(serialised).length === 0, serialised.slice(0, 90));

  rec("cookies are dropped outright rather than scrubbed", event.request.cookies === undefined);
  rec("the request body is dropped outright", event.request.data === undefined);
  rec(
    "the user is reduced to an id",
    event.user.id === "u1" && event.user.email === undefined && event.user.ip_address === undefined,
    JSON.stringify(event.user),
  );
  rec("a header named authorization goes whatever it holds", /\[redacted/.test(String(event.request.headers.authorization)));
  rec("and an innocent header survives", event.request.headers["x-request-id"] === "abc");

  // Field names, in the three spellings a payload assembled from three sources
  // uses for the same idea.
  for (const key of ["password", "apiKey", "api_key", "API-KEY", "serviceRoleKey", "authorization", "sessionToken"]) {
    rec(`a field named ${key} is treated as secret`, isSecretKey(key));
  }
  for (const key of ["fileId", "county", "status", "createdAt"]) {
    rec(`a field named ${key} is not`, !isSecretKey(key), "over redaction is its own failure");
  }

  /*
   * The guards that keep the scrubber from becoming the fault.
   *
   * This runs inside an error handler, so a stack overflow or an infinite loop
   * here turns a reportable error into an unreportable crash.
   */
  const cycle = { name: "root" };
  cycle.self = cycle;
  let survived = true;
  let cycleOut = "";
  try {
    cycleOut = JSON.stringify(scrubValue(cycle));
  } catch {
    survived = false;
  }
  /*
   * Asserted on the marker, not merely on surviving.
   *
   * The first version only checked that nothing threw, and it passed with the
   * cycle guard deleted: the DEPTH limit caught the recursion instead. That is
   * defence in depth working, and it is also a check claiming to test one guard
   * while a different one does the work. Demanding the circular marker is what
   * ties this check to the guard it names.
   */
  rec(
    "a circular object does not hang or throw the scrubber",
    survived && /dropped: circular/.test(cycleOut),
    cycleOut.slice(0, 70),
  );

  let deep = { end: SECRETS.stripeKey };
  for (let i = 0; i < 40; i += 1) deep = { down: deep };
  const deepOut = JSON.stringify(scrubValue(deep));
  rec(
    "and a very deep object is dropped rather than half scrubbed",
    /too deep to scrub/.test(deepOut) && leaks(deepOut).length === 0,
  );

  rec(
    "breadcrumbs go through the scrubber too",
    !JSON.stringify(beforeBreadcrumb({ message: `GET ${SECRETS.signedUrl}` })).includes(
      SECRETS.signedUrl,
    ),
    "a fetch breadcrumb is the likeliest carrier of a signed url",
  );

  rec(
    "beforeSend is the same function, not a second copy",
    !JSON.stringify(beforeSend({ message: SECRETS.stripeKey })).includes(SECRETS.stripeKey),
  );
}

// =========================================================================
// 4. THE FINGERPRINT: ONE FAULT IS ONE ROW
// =========================================================================

{
  const a = fingerprintOf("route", "File 3f2a91bc-1111-4111-8111-111111111111 no longer exists", "/api/x");
  const b = fingerprintOf("route", "File 91bc3f2a-2222-4222-8222-222222222222 no longer exists", "/api/x");
  rec("two occurrences of one fault fingerprint the same", a === b, a);

  const c = fingerprintOf("route", "Job 41 timed out", "/api/x");
  const d = fingerprintOf("route", "Job 9917 timed out", "/api/x");
  rec("and numbers do not split one fault into many", c === d, c);

  /*
   * THE CASE THE FIRST VERSION OF THIS AUDIT MISSED.
   *
   * Every fingerprint check here used a number with a space either side, so
   * they all passed against a rule that only stripped word bounded digits. The
   * walk of the status page found the real shape: a provider identifier, where
   * the digit sits against an underscore and there is no word boundary at all.
   * Twelve occurrences of one fault rendered as twelve faults on screen, each
   * with a count of one, which can never cross the rate threshold.
   */
  const providerIds = [
    ["cs_test_4", "cs_test_11"],
    ["pi_3ABC123", "pi_9XYZ987"],
    ["evt_1J2k3", "evt_9Z8y7"],
    ["order-254-000123", "order-254-004891"],
    ["file_9", "file_88"],
  ];
  for (const [left, right] of providerIds) {
    const a1 = fingerprintOf("route", `the provider refused session ${left}`, "/api/x");
    const b1 = fingerprintOf("route", `the provider refused session ${right}`, "/api/x");
    rec(`${left} and ${right} are one fault, not two`, a1 === b1, a1);
  }

  /*
   * And a long opaque reference with no digits in it at all, which the digit
   * rule alone would not touch.
   */
  const r1 = fingerprintOf("route", "could not read object abcdefghijklmnopqrst", "/api/x");
  const r2 = fingerprintOf("route", "could not read object zyxwvutsrqponmlkjihg", "/api/x");
  rec("and two long opaque references are one fault", r1 === r2, r1);

  /*
   * The bound on all that grouping: it must not swallow the message.
   */
  const s1 = fingerprintOf("route", "the provider refused session cs_test_4", "/api/x");
  rec(
    "and the fingerprint still says what happened",
    /provider refused session/.test(s1),
    s1,
  );

  const e = fingerprintOf("route", "Job 41 timed out", "/api/y");
  rec("but the same message on a different route is a different fault", c !== e);

  const f = fingerprintOf("route", "Something else entirely", "/api/x");
  rec("and two different faults do not collide", c !== f);

  rec("the fingerprint is readable rather than a hash", /timed out/.test(c), c);
}

// =========================================================================
// 5. ALERTING: THE RULES ARE ABOUT NOT SENDING
// =========================================================================

const NOW = 1_000_000_000_000;
const minutesAgo = (n) => NOW - n * 60_000;

const base = {
  fingerprint: "f",
  title: "t",
  occurrences: 1,
  inWindow: 1,
  firstSeenAtMs: minutesAgo(5),
  lastSeenAtMs: NOW,
  alertedNewAtMs: null,
  alertedRateAtMs: null,
  muted: false,
};

{
  rec(
    "a brand new fault is announced",
    decideAlert({ ...base }, NOW).send === true,
  );
  rec(
    "and only once",
    decideAlert({ ...base, alertedNewAtMs: minutesAgo(1) }, NOW).send === false,
  );

  /*
   * The backfill trap. A fingerprint first seen in March, never alerted on
   * because alerting did not exist in March, must not announce itself as news
   * the first time this rule runs.
   */
  rec(
    "a fault older than the new-fault window is not announced as new",
    decideAlert({ ...base, firstSeenAtMs: minutesAgo(NEW_WITHIN_MINUTES + 10) }, NOW).send === false,
    "a report should not arrive as an alert",
  );

  const hot = { ...base, inWindow: RATE_THRESHOLD, alertedNewAtMs: minutesAgo(120) };
  const decision = decideAlert(hot, NOW);
  rec("crossing the rate threshold sends", decision.send === true);
  rec("and says it is a rate alert", decision.send && decision.kind === "rate");

  rec(
    "just under the threshold does not",
    decideAlert({ ...hot, inWindow: RATE_THRESHOLD - 1 }, NOW).send === false,
  );

  rec(
    "and a rate alert inside its cooldown does not repeat",
    decideAlert({ ...hot, alertedRateAtMs: minutesAgo(COOLDOWN_MINUTES - 5) }, NOW).send === false,
  );
  rec(
    "but does once the cooldown has passed",
    decideAlert({ ...hot, alertedRateAtMs: minutesAgo(COOLDOWN_MINUTES + 5) }, NOW).send === true,
    "a fault that keeps firing must not go silent forever",
  );

  rec("a muted fault never sends", decideAlert({ ...base, muted: true }, NOW).send === false);
  rec(
    "and muting is checked before everything else",
    decideAlert({ ...base, muted: true, inWindow: 500 }, NOW).send === false,
    "including a fault that is screaming",
  );

  /*
   * A fault that is new AND already hot gets the rate alert, not the new one.
   * Checking "new" first would send the quieter message and then be inside its
   * own cooldown when the louder one came due a minute later.
   */
  const both = { ...base, inWindow: RATE_THRESHOLD + 5 };
  const chosen = decideAlert(both, NOW);
  rec(
    "a fault that is new and already frequent sends the rate alert",
    chosen.send && chosen.kind === "rate",
    "the louder of the two messages is the one worth the email",
  );

  // The cap. A deploy that breaks twenty routes must not send twenty emails.
  const many = Array.from({ length: 20 }, (_, i) => ({
    ...base,
    fingerprint: `f${i}`,
    inWindow: RATE_THRESHOLD + i,
  }));
  const { chosen: picked, suppressed } = selectAlerts(many, NOW);
  rec("a sweep sends at most three alerts", picked.length === MAX_ALERTS_PER_SWEEP, `${picked.length}`);
  rec("and reports how many it held back", suppressed === 20 - MAX_ALERTS_PER_SWEEP, `${suppressed}`);
  rec(
    "and keeps the loudest rather than the first",
    picked[0].type.inWindow === RATE_THRESHOLD + 19,
    `${picked[0].type.inWindow}`,
  );

  rec("the rate window is bounded", RATE_WINDOW_MINUTES > 0 && RATE_WINDOW_MINUTES <= 60);
  rec("and the cooldown is at least half an hour", COOLDOWN_MINUTES >= 30, `${COOLDOWN_MINUTES}`);
}

// =========================================================================
// 6. A STALLED CRON READS AS STALLED
// =========================================================================

{
  rec("a cron that just ran is healthy", cronVerdict(5, 3, true) === "healthy");
  rec("one interval late is still healthy", cronVerdict(5, 9, true) === "healthy");
  rec("two and a half intervals is late", cronVerdict(5, 13, true) === "late");

  /*
   * THE CHECK THIS SECTION EXISTS FOR.
   *
   * A cron that stopped firing an hour ago must not render as a timestamp an
   * operator glances past. It has to say the word.
   */
  rec(
    "a cron that stopped an hour ago reads as stalled",
    cronVerdict(1, 60, true) === "stalled",
    "a timestamp is not a verdict",
  );
  rec(
    "and the minutely worker is judged against a minute, not against five",
    cronVerdict(1, 6, true) === "stalled" && cronVerdict(5, 6, true) === "healthy",
    "one interval means different things for different jobs",
  );

  /*
   * Never run is its own verdict. A cron with no rows has either never been
   * scheduled or has never once succeeded, and that sends an operator somewhere
   * completely different from one that was working this morning.
   */
  rec("a cron with no history reads as never run", cronVerdict(5, null, false) === "never run");
  rec(
    "and never run is not the same as stalled",
    cronVerdict(5, null, false) !== cronVerdict(5, 999, true),
  );
  rec(
    "a cron with runs but no successful one reads as stalled",
    cronVerdict(5, null, true) === "stalled",
    "it has been trying and failing, which is not the same as never having tried",
  );

  const scheduled = JSON.parse(readFileSync("vercel.json", "utf8")).crons ?? [];
  for (const c of WATCHED_CRONS) {
    rec(
      `${c.name} is watched and actually scheduled`,
      scheduled.some((s) => s.path === `/api/cron/${c.name}`),
      JSON.stringify(scheduled.map((s) => s.path)),
    );
  }
  rec(
    "and every scheduled cron is watched",
    scheduled.every((s) => WATCHED_CRONS.some((c) => `/api/cron/${c.name}` === s.path)),
    "an unwatched cron is one whose death is invisible",
  );
}

// =========================================================================
// 7. THE CODE THAT RECORDS, AND WHAT IT REFUSES TO GUESS
// =========================================================================

{
  const obs = codeOnly("src/lib/ops-observability.ts");

  const capture = functionBody(obs, "export async function captureError(");
  rec("captureError never throws", /try {/.test(capture) && /catch/.test(capture));
  rec(
    "and logs to the console before it touches the database",
    capture.indexOf("console.error") < capture.indexOf("supabaseAdmin()"),
    "the console is the one channel that survives the database being the fault",
  );
  rec("and scrubs the message before storing it", /scrubString\(raw\)/.test(capture));
  rec("and scrubs anything extra too", /scrubValue\(context\.extra\)/.test(capture));

  const crons = functionBody(obs, "export async function cronStates(");
  rec("cronStates returns null on a failed read", /if \(error\) return null;/.test(crons));
  rec(
    "and distinguishes the last run from the last SUCCESSFUL run",
    /ok === true/.test(crons),
    "a cron failing every minute has a recent run and no recent success",
  );

  const recent = functionBody(obs, "export async function recentErrors(");
  rec("recentErrors returns null on a failed read", /if \(error\) return null;/.test(recent));

  const deps = functionBody(obs, "export async function dependencyStates(");
  /*
   * Asserted as an ABSENCE, not a presence.
   *
   * The first version looked for one "reachable: null" and passed while a
   * different dependency had been changed to claim it was reachable. There are
   * five dependencies and only the database is actually probed, so the honest
   * check is that no entry hard codes a healthy answer at all.
   */
  rec(
    "an unchecked dependency is null rather than true",
    /reachable: null/.test(deps) && !/reachable: true/.test(deps),
    "a green tick for something nobody looked at is read as evidence",
  );
  rec(
    "and the only dependency claiming to answer is the one that was asked",
    /reachable = !error/.test(deps),
    "the database is probed; nothing else is, and nothing else says it was",
  );
  rec(
    "and the database guard throwing counts as not answering",
    /refused by the database guard/.test(deps),
  );

  const cronStarted = functionBody(obs, "export async function cronStarted(");
  rec(
    "a run is recorded when it starts, not only when it finishes",
    /\.insert\(\{ name, started_at/.test(cronStarted),
    "a run killed by a timeout would otherwise leave no trace at all",
  );
}

// =========================================================================
// 8. THE ROLLUP: AN ABSENT FIGURE IS NEVER A ZERO
// =========================================================================

{
  const metrics = codeOnly("src/lib/ops-metrics.ts");

  const countIn = functionBody(metrics, "async function countIn(");
  rec(
    "a failed count is null rather than zero",
    /if \(error\) return null;/.test(countIn),
    "an outage would otherwise become a day of flawless zeroes",
  );
  const sumIn = functionBody(metrics, "async function sumIn(");
  rec("and a failed sum is null rather than zero", /if \(error\) return null;/.test(sumIn));

  const rollup = functionBody(metrics, "export async function rollupDay(");
  rec(
    "a metric that could not be computed is left OUT of the table",
    /if \(value === null\) unavailable\.push\(metric\)/.test(rollup),
    "a gap means not computed; a zero means genuinely none",
  );
  rec(
    "the rollup upserts rather than adding",
    /\.upsert\(rows, \{ onConflict: "day,metric" \}\)/.test(rollup),
    "at-least-once delivery would double every accumulated figure",
  );
  rec(
    "and it rolls up a day that is over",
    /Date\.now\(\) - 86_400_000/.test(metrics),
    "a partial day looks exactly like a final one once it is in the table",
  );
  rec(
    "revenue and refunds are separate metrics",
    /ORDERS_REVENUE_CENTS/.test(metrics) && /ORDERS_REFUNDED_CENTS/.test(metrics),
    "a net figure of zero cannot be told from a day with no trading",
  );

  const handlers = codeOnly("src/lib/job-handlers.ts");
  rec(
    "the rollup job retries when a figure could not be computed",
    /report\.unavailable\.length > 0/.test(handlers) && /kind: "retry"/.test(handlers),
    "a job that shrugged at the gap would leave one there permanently",
  );
  /*
   * Both halves must be PRESENT and in order.
   *
   * The first version compared two indexOf results, and deleting the stamp
   * entirely made it return -1, which is less than everything, so removing the
   * cooldown stamp passed a check named "stamps before it queues".
   */
  const stampAt = handlers.indexOf("alerted_rate_at: now");
  const queueAt = handlers.indexOf("const queued = await queueEmail(");
  rec(
    "the alert sweep stamps before it queues",
    stampAt !== -1 && queueAt !== -1 && stampAt < queueAt,
    stampAt === -1
      ? "the cooldown stamp is not written at all"
      : "otherwise a failure between the two loses the cooldown and sends every sweep",
  );
}

// =========================================================================
// 9. THE PAGE, AND WHO CAN SEE IT
// =========================================================================

{
  const page = codeOnly("src/app/portal/(app)/status/page.tsx");
  rec("there is a status page", existsSync("src/app/portal/(app)/status/page.tsx"));
  rec("it is behind jobs.manage", /can\(actor, "jobs\.manage"\)/.test(page));
  rec("and 404s rather than explaining itself", /notFound\(\)/.test(page));

  rec("it shows every dependency", /dependencyStates\(\)/.test(page));
  rec("and every cron", /cronStates\(\)/.test(page));
  rec("and the queue", /queueHealth\(\)/.test(page));
  rec("and what has been failing", /recentErrors\(/.test(page));
  rec("and yesterday's figures", /metricsSince\(/.test(page));

  rec(
    "an unreadable cron history renders as a failure, not as no runs",
    /crons === null \?/.test(page) && /ErrorState/.test(page),
  );
  rec(
    "an unreadable fault log renders as a failure, not as a quiet hour",
    /errors === null \?/.test(page) && /ErrorState/.test(page),
  );
  rec(
    "an unreadable queue renders as a failure",
    /queue === null \?/.test(page),
  );
  rec(
    "an uncomputed metric reads as not computed rather than zero",
    /"not computed"/.test(page),
  );
  rec(
    "every verdict carries the timestamp it came from",
    /AGO\(c\.lastSuccessAt\)/.test(page) && /STAMP\(c\.lastSuccessAt\)/.test(page),
  );
  rec(
    "and a run that started and never reported is called out",
    /lastRunUnfinished/.test(page),
  );

  const client = codeOnly("src/app/portal/(app)/status/StatusClient.tsx");
  rec("a fault can be muted", /action: "mute"/.test(client));
  rec(
    "and there is no way to clear one by hand",
    !/"resolve"|"delete"|"dismiss"/.test(client),
    "a list somebody can tidy describes what they dealt with, not what is happening",
  );

  const api = codeOnly("src/app/api/portal/status/route.ts");
  rec("the mute endpoint checks the permission", /can\(actor, "jobs\.manage"\)/.test(api));
  rec("and is audited", /writeAudit\(/.test(api) && /errors\.muted/.test(api));
  rec("and has no GET", !/export async function GET/.test(api));
  rec(
    "and takes the value rather than toggling",
    /body\.muted === true/.test(api),
    "a toggle lets two operators flip each other's decision",
  );
}

// =========================================================================
// 10. SENTRY IS WIRED, AND HONEST ABOUT BEING OFF
// =========================================================================

{
  const config = codeOnly("src/lib/sentry-config.ts");
  rec("the release is the commit sha", /VERCEL_GIT_COMMIT_SHA/.test(config));
  rec("and the environment is tagged", /VERCEL_ENV/.test(config));
  rec("personally identifying data is off by default", /sendDefaultPii: false/.test(config));
  rec(
    "tracing is off",
    /tracesSampleRate: 0/.test(config),
    "a trace records the url of every request, which here means signed links",
  );
  rec("beforeSend is set", /beforeSend,/.test(config));
  rec("and beforeBreadcrumb is set", /beforeBreadcrumb,/.test(config));

  const options = sentryOptions();
  rec("the options carry a release", typeof options.release === "string" && options.release.length > 0);
  rec("and they disable themselves without a DSN", options.enabled === Boolean(options.dsn));

  const instrumentation = codeOnly("src/instrumentation.ts");
  rec("onRequestError is exported", /export const onRequestError/.test(instrumentation));
  rec(
    "it records to this firm's database first",
    instrumentation.indexOf("captureError") < instrumentation.indexOf("sentryConfigured"),
    "Sentry needs a DSN; the local store has no such failure mode",
  );
  rec(
    "it fingerprints on the route pattern, not the concrete path",
    /context\.routePath/.test(instrumentation),
    "the concrete path would make one recurring fault into four hundred one-offs",
  );
  rec("and it cannot throw", /try {/.test(instrumentation) && /} catch {/.test(instrumentation));

  const deps = codeOnly("src/lib/ops-observability.ts");
  rec(
    "the status page says plainly when Sentry is not configured",
    /no DSN, so nothing reaches Sentry/.test(deps),
    "a quiet dashboard and an unconfigured one look identical",
  );
  rec(
    "and says that alerting works anyway",
    /Faults are still recorded in this database/.test(deps),
  );
  rec(
    "an unset CRON_SECRET is reported as nothing scheduled running",
    /NOTHING scheduled runs/.test(deps),
  );
}

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("An error reporter is a pipe out of the building, and a status page that");
  console.log("cannot tell silence from health is worse than no status page.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. Nothing secret leaves, and a stalled cron says so.`);
