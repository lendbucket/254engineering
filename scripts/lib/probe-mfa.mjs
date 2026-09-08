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
   * Confirming returns a FULL session, deliberately: somebody who has just
   * proved they hold the secret should not be asked to prove it again. So the
   * cookie to carry forward is the one on this response, not the one we came
   * in with.
   */
  const minted = (confirmed.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);
  if (!minted) return { ok: false, error: "confirm returned no session cookie" };

  return { ok: true, cookie: minted[1], recoveryCodes: done.recoveryCodes ?? [] };
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
  const res = await fetch(`${base}/api/portal/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const m = (res.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);
  if (!res.ok || !m) return { ok: false, cookie: null, enrolled: false, error: `sign in ${res.status}` };

  const body = await res.json().catch(() => null);

  /*
   * The redirect says what the account still needs, and it is read rather than
   * the cookie being parsed: the audit should learn this the way a browser
   * does. /portal/mfa/enrol means this account has no factor, whether its role
   * requires one or is merely offering, and either way a probe finishes the
   * enrolment. Deliberately not distinguishing the two: a probe that only
   * enrolled when compelled would stop exercising this path the moment the
   * last required role became optional, which is what 0025 did.
   */
  const needsEnrolment = typeof body?.redirect === "string" && body.redirect.startsWith("/portal/mfa/enrol");

  if (!needsEnrolment) return { ok: true, cookie: m[1], enrolled: false };

  const enrolled = await completeEnrolment(base, m[1]);
  if (!enrolled.ok) return { ok: false, cookie: null, enrolled: false, error: enrolled.error };

  return { ok: true, cookie: enrolled.cookie, enrolled: true };
}
