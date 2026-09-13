/**
 * COMPLETE A REAL SECOND FACTOR ENROLMENT, THE WAY A PERSON WOULD.
 *
 * WHY PROBES ENROL RATHER THAN BEING EXEMPTED
 * -------------------------------------------
 * Migration 0024 seeded `admin` and `engineer` as `required`, on the operator's
 * ruling. From that moment a probe signing in as either got a PENDING session
 * and every portal route refused it, which is exactly what mfa-audit asserts
 * must happen. Thirty eight roles-audit checks went red on the first suite run
 * after it, and the line that named the cause was the one added that same
 * morning: "the cookie was minted and then refused".
 *
 * 0025 then made both roles optional and this helper did not have to change,
 * which is worth knowing rather than discovering. A probe on an optional role
 * is now handed a FULL session and sent to the enrolment OFFER, so the same
 * redirect still arrives and the same enrolment still runs. The probes keep
 * exercising the flow end to end, and the argument below stands whether the
 * requirement is on or off.
 *
 * There were two ways out. Exempt the probes, by giving them roles where MFA is
 * optional or by turning the requirement off during audits. Or make them enrol.
 *
 * EXEMPTING WOULD HAVE BEEN THE WRONG ONE, and not marginally. Every audit that
 * signs in as an administrator would then be exercising a path no administrator
 * will ever take again, and the requirement itself would be measured by
 * nothing. A harness that avoids the thing it made true is a harness reporting
 * on a system that no longer exists.
 *
 * So this does the whole flow against the real endpoint: begin, read the
 * secret, compute a code from it, confirm. Every audit that signs in now
 * exercises enrolment end to end as a side effect, which is a stronger test
 * than any of them carried before.
 *
 * THE CODE IS COMPUTED WITH THE PLATFORM'S OWN TOTP MODULE
 * --------------------------------------------------------
 * Which is the one thing here that deserves suspicion: an audit that
 * reimplements the thing it is testing measures its own copy, and one that uses
 * the implementation cannot catch that implementation being wrong.
 *
 * It is the right trade because the RFC vectors already answer the question
 * this cannot. scripts/proofs/totp-matches-the-rfc.mjs checks the module
 * against RFC 6238's published test vectors, which is the claim that matters:
 * the codes are the codes a real authenticator app produces. Given that, using
 * the module here tests the WIRING, which is what these probes are for.
 */

import { base32Decode, codeForStep, stepAt } from "../../src/lib/totp.ts";

/**
 * Enrol, and return a FULL session cookie.
 *
 * @param {string} base       The server, e.g. http://localhost:3225
 * @param {string} cookie     The pending cookie value, with no `eng_ops=` prefix
 * @returns {Promise<{ ok: true, cookie: string, recoveryCodes: string[] } | { ok: false, error: string }>}
 */
export async function completeEnrolment(base, cookie) {
  const header = `eng_ops=${cookie}`;

  const begun = await fetch(`${base}/api/portal/mfa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: header },
    body: JSON.stringify({ action: "begin" }),
  });
  const started = await begun.json().catch(() => null);
  if (!begun.ok || !started?.ok || !started.secret) {
    return { ok: false, error: `begin failed: ${started?.error ?? begun.status}` };
  }

  const bytes = base32Decode(started.secret);
  if (!bytes) return { ok: false, error: "the secret did not decode" };

  const confirmed = await fetch(`${base}/api/portal/mfa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: header },
    body: JSON.stringify({ action: "confirm", code: codeForStep(bytes, stepAt(Date.now())) }),
  });
  const done = await confirmed.json().catch(() => null);
  if (!confirmed.ok || !done?.ok) {
    return { ok: false, error: `confirm failed: ${done?.error ?? confirmed.status}` };
  }

  /*
   * AND THEN THE ACKNOWLEDGEMENT, WHICH IS WHAT COMPLETES AN ENROLMENT.
   *
   * Until 2026-09-13 `confirm` returned the full session and the probes took
   * their cookie off that response. It does not any more: the operator ruled
   * that the flow does not complete until somebody says they have saved the
   * recovery codes, so the session is issued by `codes_saved` and that is the
   * response carrying the cookie.
   *
   * The probes walk it rather than being exempted from it, for the reason
   * argued at the top of this file. Every audit that signs in now exercises the
   * acknowledgement too, so an enrolment that stops handing over a session at
   * the right step is a red board rather than a discovery.
   */
  const acknowledged = await fetch(`${base}/api/portal/mfa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: header },
    body: JSON.stringify({ action: "codes_saved" }),
  });
  const finished = await acknowledged.json().catch(() => null);
  if (!acknowledged.ok || !finished?.ok) {
    return { ok: false, error: `codes_saved failed: ${finished?.error ?? acknowledged.status}` };
  }

  const minted = (acknowledged.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);
  if (!minted) return { ok: false, error: "codes_saved returned no session cookie" };

  return { ok: true, cookie: minted[1], recoveryCodes: done.recoveryCodes ?? [] };
}

/**
 * SIGN IN AND STOP THERE, WHICH IS THE OTHER THING A PROBE SOMETIMES NEEDS.
 *
 * signInFully completes an enrolment, which is exactly wrong for a harness
 * whose subject is the half authenticated state: the challenge screen, the
 * break glass, the enrolment offer. Those need the cookie the sign in endpoint
 * hands back and nothing done to it.
 *
 * It lives here rather than being written out in each harness because
 * mfa-audit scans every script for a direct post to the session endpoint and
 * says so. That check is right: a second sign in path is how one of them
 * misses the next change to what a session is. break-glass-audit was the
 * script that made this necessary, and the alternative was a third entry on
 * that check's allowlist, which is the answer that makes a check mean less
 * every time it is used.
 *
 * @param {string} base
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: boolean, cookie: string | null, redirect: string | null, status: number }>}
 */
export async function signInOnly(base, email, password) {
  const res = await fetch(`${base}/api/portal/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (res.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/)?.[1] ?? null;
  const body = await res.json().catch(() => null);
  return {
    ok: res.ok && Boolean(cookie),
    cookie,
    redirect: typeof body?.redirect === "string" ? body.redirect : null,
    status: res.status,
  };
}

/**
 * Sign in and finish whatever the account needs to hold a full session.
 *
 * The single entry point every probe should use, so the two sign in paths in
 * this repository cannot drift on this.
 *
 * @returns {Promise<{ ok: boolean, cookie: string | null, enrolled: boolean, error?: string }>}
 */
export async function signInFully(base, email, password) {
  const signedIn = await signInOnly(base, email, password);
  if (!signedIn.ok) return { ok: false, cookie: null, enrolled: false, error: `sign in ${signedIn.status}` };


  /*
   * The redirect says what the account still needs, and it is read rather than
   * the cookie being parsed: the audit should learn this the way a browser
   * does. /portal/mfa/enrol means this account has no factor, whether its role
   * requires one or is merely offering, and either way a probe finishes the
   * enrolment. Deliberately not distinguishing the two: a probe that only
   * enrolled when compelled would stop exercising this path the moment the
   * last required role became optional, which is what 0025 did.
   */
  const needsEnrolment =
    typeof signedIn.redirect === "string" && signedIn.redirect.startsWith("/portal/mfa/enrol");

  if (!needsEnrolment) return { ok: true, cookie: signedIn.cookie, enrolled: false };

  const enrolled = await completeEnrolment(base, signedIn.cookie);
  if (!enrolled.ok) return { ok: false, cookie: null, enrolled: false, error: enrolled.error };

  return { ok: true, cookie: enrolled.cookie, enrolled: true };
}
