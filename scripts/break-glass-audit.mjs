// @runtime react-server
//
// Declared because this audit reaches modules carrying `server-only`.
// scripts/lib/audit-runtime.mjs works the requirement out from the imports and
// the board refuses to start when package.json disagrees.
/**
 * THE BREAK GLASS IS EXERCISED RATHER THAN DESCRIBED.
 *
 *   npx tsx --conditions=react-server scripts/break-glass-audit.mjs
 *
 * WHY THIS EXISTS, AND IT IS NOT A GOOD STORY
 * -------------------------------------------
 * The break glass was built in Phase 12 Section 1, reviewed, documented in
 * docs/mfa-design.md section 6, and never once run. On 2026-09-13 the operator
 * was locked out of production, set MFA_BREAK_GLASS in the Vercel Production
 * scope, redeployed, and the recovery link did not appear on the challenge
 * screen. The enrolment was cleared by hand against the database in the end.
 *
 * Every check that existed read the SOURCE. The module parses its variable
 * correctly, the endpoint refuses a wrong token correctly, the form draws the
 * link when told to. All true, all green, and none of them had ever put the
 * variable in front of a running server and looked at the page.
 *
 * Operator instruction, 2026-09-13: "Give it a board check that sets the
 * variable in a child process the way the gate fixture does and proves the link
 * renders and the token clears an enrolment."
 *
 * WHAT IT DOES
 * ------------
 * Three servers, one after another, each with a different MFA_BREAK_GLASS, and
 * a real probe administrator with a real enrolment walked through all three.
 *
 *   1. UNSET        no link, and the endpoint refuses the correct token.
 *   2. MALFORMED    no link, and the screen says the variable is malformed.
 *   3. SET          the link renders, a wrong token is refused and recorded,
 *                   and the right token clears the enrolment.
 *
 * THE NEGATIVES ARE THE POINT, not the positive. A check that only ever runs
 * with the variable set cannot tell a link that renders because the variable is
 * there from a link that renders always, and a bypass link that renders always
 * is a worse defect than the one this file was written after.
 *
 * WHY THREE SERVERS AND NOT ONE
 * ------------------------------
 * The value is read at request time, but a Next server's process environment is
 * fixed when it boots, which is the same reason using the break glass on Vercel
 * costs a redeploy. Three states means three boots. They are `next start`
 * against the build the board has already made, so they cost seconds.
 *
 * WHY THE VARIABLE IS SAFE HERE
 * ------------------------------
 * It names the probe account and nothing else, exactly as it would name one
 * person on production. It exists inside a child process for a few seconds and
 * is never written to a file. The probe is created on DEVELOPMENT, is swept
 * afterwards, and the account it could bypass is one this run made.
 *
 * WHAT IT CANNOT ANSWER
 * ---------------------
 * Why the production attempt failed on the night. No record of the value as it
 * was actually set was ever written, because nothing wrote one, so the question
 * is not answerable after the fact from this repository. What can be said is
 * what this file proves: the path works when the variable parses, it says so
 * when the variable does not parse, and before today neither of those was
 * measured by anything.
 */

import { existsSync } from "node:fs";
import { startNextServer } from "./lib/dev-server.mjs";
import { auditClient } from "./lib/db-target.mjs";
import { completeEnrolment } from "./lib/probe-mfa.mjs";
import { destroyProbes, PROBE_DOMAIN } from "./lib/portal-probe.mjs";
import { breakGlassConfigured, breakGlassMatches, breakGlassMalformed } from "../src/lib/ops-mfa-breakglass.ts";

const PORT_UNSET = Number(process.env.BREAK_GLASS_PORT_UNSET || 3229);
const PORT_MALFORMED = Number(process.env.BREAK_GLASS_PORT_MALFORMED || 3230);
const PORT_SET = Number(process.env.BREAK_GLASS_PORT_SET || 3231);

/* 43 characters of base64url. Well over the 24 the module insists on. */
const TOKEN = "break-glass-audit-token-0123456789abcdefghij";
const WRONG_TOKEN = "break-glass-audit-token-WRONG-9876543210zyxwv";

/** The sentence the form draws. Pinned as a literal, not imported. */
const LINK_TEXT = "I have lost my phone and my recovery codes";

/** And the one the page draws when the variable is set and does nothing. */
const MALFORMED_TEXT = "MFA_BREAK_GLASS is set on this deployment but is not in the form it has to be";

const results = [];
let failures = 0;

function rec(name, ok, note = "") {
  results.push({ name, ok, note });
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
}

function say(line) {
  console.log(line);
}

/* ------------------------------------------------------------ the pure half */

/*
 * THE PROPERTY THE LIVE HALF CANNOT REACH, because the email is fixed when the
 * server boots: the variable names ONE account and is not a skeleton key.
 * Asserted here against the real matcher.
 */
function pureHalf() {
  say("");
  say("the variable names one account, and is not a skeleton key");

  const HAD = process.env.MFA_BREAK_GLASS;
  try {
    process.env.MFA_BREAK_GLASS = `somebody@example.com:${TOKEN}`;
    rec("a well formed value parses", breakGlassConfigured()?.email === "somebody@example.com");
    rec("and is not reported as malformed", breakGlassMalformed() === false);
    rec("the named account with the right token matches", breakGlassMatches("somebody@example.com", TOKEN) === true);
    rec(
      "a DIFFERENT account with the right token does not",
      breakGlassMatches("someone.else@example.com", TOKEN) === false,
      "or the variable would be a bypass for everybody rather than for one person",
    );
    rec("the named account with a wrong token does not", breakGlassMatches("somebody@example.com", WRONG_TOKEN) === false);

    process.env.MFA_BREAK_GLASS = "no-colon-and-no-at-sign";
    rec("a malformed value parses as nothing", breakGlassConfigured() === null);
    rec("AND reports itself as malformed rather than as absent", breakGlassMalformed() === true, "the silence of 2026-09-13");

    process.env.MFA_BREAK_GLASS = `somebody@example.com:short`;
    rec("a token under the minimum is malformed rather than accepted", breakGlassConfigured() === null && breakGlassMalformed() === true);

    delete process.env.MFA_BREAK_GLASS;
    rec("unset is not malformed", breakGlassConfigured() === null && breakGlassMalformed() === false, "or every normal deployment would shout");
  } finally {
    if (HAD === undefined) delete process.env.MFA_BREAK_GLASS;
    else process.env.MFA_BREAK_GLASS = HAD;
  }
}

/* ------------------------------------------------------------ the live half */

async function signIn(base, email, password) {
  const res = await fetch(`${base}/api/portal/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const m = (res.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);
  const body = await res.json().catch(() => null);
  return { ok: res.ok && Boolean(m), cookie: m ? m[1] : null, redirect: body?.redirect ?? null };
}

async function challengeScreen(base, cookie) {
  const res = await fetch(`${base}/portal/mfa`, {
    headers: { cookie: `eng_ops=${cookie}` },
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}

async function postBreakGlass(base, cookie, token) {
  const res = await fetch(`${base}/api/portal/mfa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `eng_ops=${cookie}` },
    body: JSON.stringify({ action: "break_glass", token }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function run() {
  /*
   * UNREACHABLE IS NOT FAILED. Without a build there is nothing to start, and a
   * red here would be a red about the harness rather than about the break
   * glass, which is the kind of red people learn to ignore.
   */
  if (!existsSync(".next/BUILD_ID")) {
    console.log("");
    console.log("COULD NOT TELL: there is no build to start. Run `npm run build` first, or run this from the board.");
    console.log("The break glass was NOT exercised.");
    process.exit(0);
  }

  const db = auditClient("break-glass-audit", { neverProduction: true });
  if (!db) {
    console.log("");
    console.log("COULD NOT TELL: no database client, so no probe account could be made.");
    console.log("The break glass was NOT exercised.");
    process.exit(0);
  }

  pureHalf();

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `probe-breakglass-${stamp}@${PROBE_DOMAIN}`;
  const password = `probe-${stamp}-break-glass`;
  let userId = null;
  let server = null;

  try {
    /* --------------------------------------------- 1. the variable unset */
    say("");
    say(`1. MFA_BREAK_GLASS unset, on ${PORT_UNSET}`);
    server = await startNextServer({ port: PORT_UNSET, env: { MFA_BREAK_GLASS: "" } });

    const made = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (made.error || !made.data?.user) throw new Error(`probe account: ${made.error?.message}`);
    userId = made.data.user.id;

    const profile = await db.from("eng_profiles").insert({
      id: userId,
      email,
      display_name: "Audit Probe break glass",
      role: "admin",
      status: "active",
      is_demo: true,
    });
    if (profile.error) throw new Error(`probe profile: ${profile.error.message}`);

    /*
     * ENROLLED THROUGH THE REAL ENDPOINT, not by writing a row. The whole
     * subject here is a flow, and a fixture that wrote the enrolment directly
     * would be proving the break glass against a row no person could have made.
     */
    const first = await signIn(server.base, email, password);
    if (!first.ok) throw new Error("the probe could not sign in at all");
    const enrolled = await completeEnrolment(server.base, first.cookie);
    if (!enrolled.ok) throw new Error(`the probe could not enrol: ${enrolled.error}`);
    rec("a probe administrator enrols a real second factor", enrolled.ok === true);

    const pendingA = await signIn(server.base, email, password);
    rec(
      "and signing in again lands on a pending session at the challenge",
      pendingA.ok && pendingA.redirect === "/portal/mfa",
      pendingA.redirect ?? "no redirect",
    );

    const screenA = await challengeScreen(server.base, pendingA.cookie);
    rec("the challenge screen renders", screenA.status === 200, `HTTP ${screenA.status}`);
    rec(
      "with NO recovery link, because the variable is not set",
      screenA.status === 200 && !screenA.html.includes(LINK_TEXT),
      "a link that rendered here would be a permanent advertised bypass",
    );
    rec(
      "and no malformed notice either",
      !screenA.html.includes(MALFORMED_TEXT),
      "unset is the normal state and must say nothing",
    );

    const refusedA = await postBreakGlass(server.base, pendingA.cookie, TOKEN);
    rec(
      "and the endpoint refuses even the correct token",
      refusedA.status === 404 && refusedA.body?.ok !== true,
      `HTTP ${refusedA.status}`,
    );

    await server.stop();
    server = null;

    /* ----------------------------------------- 2. the variable malformed */
    say("");
    say(`2. MFA_BREAK_GLASS set but malformed, on ${PORT_MALFORMED}`);
    server = await startNextServer({
      port: PORT_MALFORMED,
      env: { MFA_BREAK_GLASS: "this-is-not-an-email-and-has-no-token" },
    });

    const pendingB = await signIn(server.base, email, password);
    const screenB = await challengeScreen(server.base, pendingB.cookie);
    rec("the challenge screen still renders", screenB.status === 200, `HTTP ${screenB.status}`);
    rec(
      "with no recovery link, because a malformed value is treated as unset",
      !screenB.html.includes(LINK_TEXT),
      "a half typed value must never become a bypass that matches something unexpected",
    );
    rec(
      "AND the screen says the variable is set and doing nothing",
      screenB.html.includes(MALFORMED_TEXT),
      "this is the sentence that was missing on 2026-09-13, when the only surface reporting it needed a full session",
    );

    await server.stop();
    server = null;

    /* ----------------------------------------- 3. the variable set properly */
    say("");
    say(`3. MFA_BREAK_GLASS set for the probe, on ${PORT_SET}`);
    server = await startNextServer({
      port: PORT_SET,
      env: { MFA_BREAK_GLASS: `${email}:${TOKEN}` },
    });

    const pendingC = await signIn(server.base, email, password);
    rec("the probe is still challenged", pendingC.ok && pendingC.redirect === "/portal/mfa", pendingC.redirect ?? "no redirect");

    const screenC = await challengeScreen(server.base, pendingC.cookie);
    rec(
      "THE RECOVERY LINK RENDERS",
      screenC.status === 200 && screenC.html.includes(LINK_TEXT),
      screenC.status === 200 ? "" : `HTTP ${screenC.status}`,
    );
    rec("and no malformed notice, because this value parses", !screenC.html.includes(MALFORMED_TEXT));

    /* A wrong token first, so the enrolment is still there to be cleared. */
    const wrong = await postBreakGlass(server.base, pendingC.cookie, WRONG_TOKEN);
    rec("a wrong token is refused", wrong.status === 404 && wrong.body?.ok !== true, `HTTP ${wrong.status}`);

    const stillThere = await db
      .from("eng_mfa_enrolments")
      .select("secret_cipher, verified_at")
      .eq("user_id", userId)
      .maybeSingle();
    rec(
      "and the enrolment survives a refused attempt",
      Boolean(stillThere.data?.secret_cipher) && Boolean(stillThere.data?.verified_at),
      "a refusal that cleared anything would be a denial of service on the account it protects",
    );

    const refusedRow = await db
      .from("eng_audit_events")
      .select("action")
      .eq("entity_id", userId)
      .eq("action", "mfa.break_glass_refused");
    rec(
      "and the refusal is in the audit trail",
      (refusedRow.data ?? []).length >= 1,
      `${(refusedRow.data ?? []).length} row(s)`,
    );

    /* And now the real one. */
    const used = await postBreakGlass(server.base, pendingC.cookie, TOKEN);
    rec(
      "THE RIGHT TOKEN IS ACCEPTED",
      used.status === 200 && used.body?.ok === true,
      used.body?.error ?? `HTTP ${used.status}`,
    );
    rec(
      "and sends the person to enrol rather than into the portal",
      used.body?.redirect === "/portal/mfa/enrol",
      /* Break glass recovers an account. It does not skip the requirement. */
      used.body?.redirect ?? "no redirect",
    );

    const after = await db
      .from("eng_mfa_enrolments")
      .select("secret_cipher, verified_at")
      .eq("user_id", userId)
      .maybeSingle();
    rec(
      "THE ENROLMENT IS CLEARED",
      !after.data || (after.data.secret_cipher === null && after.data.verified_at === null),
      after.data?.secret_cipher ? "the secret is still there" : "",
    );

    const codesLeft = await db.from("eng_mfa_recovery_codes").select("id").eq("user_id", userId);
    rec(
      "and the recovery codes with it",
      (codesLeft.data ?? []).length === 0,
      /* Codes that outlived the secret they belonged to would still open the account. */
      `${(codesLeft.data ?? []).length} left`,
    );

    const usedRow = await db
      .from("eng_audit_events")
      .select("action, summary")
      .eq("entity_id", userId)
      .eq("action", "mfa.break_glass_used");
    rec("and the use is in the audit trail", (usedRow.data ?? []).length === 1, `${(usedRow.data ?? []).length} row(s)`);
    rec(
      "and that row tells the operator to remove the variable",
      /Remove MFA_BREAK_GLASS now/.test((usedRow.data ?? [])[0]?.summary ?? ""),
      "a break glass left set is the hazard",
    );

    /* Signing in now offers enrolment rather than a challenge. */
    const afterSignIn = await signIn(server.base, email, password);
    rec(
      "and the account now signs in to an enrolment rather than a challenge",
      afterSignIn.ok && String(afterSignIn.redirect ?? "").startsWith("/portal/mfa/enrol"),
      afterSignIn.redirect ?? "no redirect",
    );
  } catch (err) {
    rec("the run completed", false, err.message);
  } finally {
    if (server) await server.stop().catch(() => {});
    const swept = await destroyProbes("break-glass-audit");
    rec("the probe account is removed", swept.ok, swept.note);
  }
}

console.log("========== THE BREAK GLASS, EXERCISED ==========");
await run();
console.log("");
if (failures) {
  console.log(`FAIL: ${failures} of ${results.length} checks.`);
  console.log("A break glass that is not exercised is a recovery path that exists only in a document.");
  process.exit(1);
}
console.log(`PASS: ${results.length} checks. The link renders only when the variable is set, the token clears an enrolment, and a malformed value says so.`);
