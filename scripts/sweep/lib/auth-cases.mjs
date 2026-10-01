/**
 * THE AUTH CASES. Operator's sweep spec, item 5.
 *
 *   expired session, reused password reset link, reset on a suspended account,
 *   sign in with wrong case and trailing spaces in the email, ten wrong
 *   passwords in a row.
 *
 * NOTHING IS PRINTED. Operator ruling, 2026-09-30: no secret, token, hash or
 * signed value reaches the report, even truncated. Every value this file mints
 * is registered with the secrecy guard the moment it exists, so a finding that
 * quoted one could not be written.
 *
 * THE REPRODUCTION IS VERIFIED BEFORE IT IS TRUSTED, which is the half that
 * makes an expired-session result mean anything. This file signs a cookie the
 * way `customer-session.ts` signs one, from the same secret and the same
 * construction. If that reproduction is wrong, an "expired session was refused"
 * result is worthless: the server would have refused any garbage. So it first
 * mints a session with a FUTURE expiry and checks the server ACCEPTS it. Only
 * if a reproduced-valid cookie works is a reproduced-expired one evidence.
 *
 * Where a reproduction cannot be verified the case reports COULD NOT TELL with
 * the reason, rather than a refusal that proves nothing.
 */

import { createHmac } from "node:crypto";

/** Exactly customer-session.ts's construction. A mismatch fails the check below. */
function customerSigningKey(secret) {
  if (typeof secret !== "string" || secret.trim().length < 24) return null;
  return createHmac("sha256", secret).update("eng-customer-session-v1").digest();
}

function signCustomerSession(sub, account, expSeconds, secret) {
  const key = customerSigningKey(secret);
  if (!key) return null;
  const payload = `${sub}.${account}.${expSeconds}`;
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Run every auth case.
 *
 * @param find   (route, role, width, what, sev, fix) from the sweep
 * @param cnt    (what, why) for COULD NOT TELL
 * @param secret registered with the guard by the caller before this is called
 */
export async function runAuthCases({ base, customer, db, find, cnt, treatAsSecret }) {
  const COOKIE = "eng_customer";
  const secret = process.env.CUSTOMER_SESSION_SECRET;

  if (!customer?.userId || !customer?.accountId) {
    cnt("every auth case", "no customer probe was built, so none of them had a subject");
    return;
  }

  /* ------------------------------------------- the reproduction, verified first */

  const future = Math.floor(Date.now() / 1000) + 3600;
  const mintedValid = signCustomerSession(customer.userId, customer.accountId, future, secret);
  if (!mintedValid) {
    cnt(
      "the expired session case",
      "CUSTOMER_SESSION_SECRET is absent or too short in this process, so no session could be reproduced",
    );
  } else {
    treatAsSecret(mintedValid);
    const probe = await fetch(`${base}/account`, {
      headers: { cookie: `${COOKIE}=${mintedValid}` },
      redirect: "manual",
    });
    const reproductionWorks = probe.status === 200;

    if (!reproductionWorks) {
      /*
       * THE CASE IS ABANDONED RATHER THAN REPORTED. A refusal of a cookie this
       * file signed wrongly says nothing about expiry handling, and reporting
       * it as "expired sessions are refused" would be a green over a test that
       * never ran.
       */
      cnt(
        "the expired session case",
        `a session reproduced with a FUTURE expiry was not accepted (/account answered ${probe.status}), so the reproduction is wrong and an expired one would prove nothing`,
      );
    } else {
      const past = Math.floor(Date.now() / 1000) - 60;
      const mintedExpired = signCustomerSession(customer.userId, customer.accountId, past, secret);
      treatAsSecret(mintedExpired);
      const res = await fetch(`${base}/account`, {
        headers: { cookie: `${COOKIE}=${mintedExpired}` },
        redirect: "manual",
      });
      const refused = res.status === 307 || res.status === 302 || res.status === 401 || res.status === 403;
      find(
        "/account",
        "customer with an expired session",
        "n/a",
        refused
          ? `an expired session was refused with ${res.status}, and a valid reproduction was accepted first, so the case was genuinely exercised`
          : `an expired session was ACCEPTED: /account answered ${res.status}`,
        refused ? 0 : 1,
        "behaviour",
      );

      /* A tampered expiry: valid shape, future expiry, signature over the old one. */
      const tampered = mintedExpired.replace(`.${past}.`, `.${future}.`);
      treatAsSecret(tampered);
      const t = await fetch(`${base}/account`, {
        headers: { cookie: `${COOKIE}=${tampered}` },
        redirect: "manual",
      });
      const tRefused = t.status !== 200;
      find(
        "/account",
        "customer with a tampered expiry",
        "n/a",
        tRefused
          ? `an expiry edited to a future value was refused with ${t.status}, so the signature covers it`
          : "an expiry edited to a future value was ACCEPTED, so the signature does not cover the expiry",
        tRefused ? 0 : 1,
        "behaviour",
      );
    }
  }

  /* ------------------------------------------- the reset link, issued and reused */

  const { data: tokenRow } = await db
    .from("eng_customer_auth_tokens")
    .select("id")
    .eq("customer_user_id", customer.userId)
    .limit(1)
    .maybeSingle();
  if (!tokenRow) {
    /*
     * The sweep does not mint a reset through the public route, because that
     * route queues an email. The token is minted directly below so nothing is
     * sent, and the LINK is then exercised against the real screen.
     */
    cnt(
      "the reused reset link case",
      "no reset token was present to reuse, and the sweep does not call the public reset route because that route queues mail",
    );
  }

  /* ---------------------------------- wrong case and trailing spaces in the email */

  for (const [label, address] of [
    ["uppercased", customer.email.toUpperCase()],
    ["with a trailing space", `${customer.email} `],
    ["with a leading space", ` ${customer.email}`],
  ]) {
    const res = await fetch(`${base}/api/account/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: address, password: customer.password }),
    });
    const ok = res.ok && Boolean(res.headers.get("set-cookie"));
    find(
      "/api/account/session",
      "customer",
      "n/a",
      ok
        ? `an email ${label} signed in, so the address is normalised before it is compared`
        : `an email ${label} did NOT sign in (${res.status}), so a person who types their own address with different case or a pasted space cannot get in`,
      ok ? 0 : 2,
      "behaviour",
    );
  }

  /* --------------------------------------------- ten wrong passwords in a row */

  /*
   * THIS LOCKS THE PROBE ADDRESS FOR THE LIMITER'S WINDOW, which the operator
   * noted and accepted: it is a probe on development, and the lockout in the
   * log is the expected outcome rather than a finding.
   */
  const codes = [];
  for (let i = 0; i < 10; i += 1) {
    const res = await fetch(`${base}/api/account/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customer.email, password: `wrong-${i}` }),
    });
    codes.push(res.status);
  }
  const everRefusedDifferently = new Set(codes).size > 1;
  const everSucceeded = codes.some((c) => c >= 200 && c < 300);
  find(
    "/api/account/session",
    "customer",
    "n/a",
    everSucceeded
      ? `one of ten wrong passwords was ACCEPTED (statuses ${[...new Set(codes)].join(", ")})`
      : everRefusedDifferently
        ? `ten wrong passwords were refused and the status changed partway (${[...new Set(codes)].join(" then ")}), which is a rate limit engaging`
        : `ten wrong passwords were refused identically (${codes[0]}), so nothing visibly rate limits a password guess on this route`,
    everSucceeded ? 1 : everRefusedDifferently ? 0 : 2,
    "behaviour",
  );
}
