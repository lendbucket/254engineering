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

import { createHash, createHmac, randomUUID } from "node:crypto";

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

  /*
   * ===========================================================================
   * A RESET LINK IS SPENT ONCE, AND THE SECOND ATTEMPT MUST CHANGE NOTHING.
   * ===========================================================================
   *
   * Operator ruling, 2026-10-01: "insert a reset token directly for a probe, the
   * way the probes are made, so no mail queues. Then test reuse."
   *
   * WHY NOT THE PUBLIC ROUTE. `/api/account/forgot-password` queues an
   * `email.send` job. The probe address is on the reserved `.invalid` domain and
   * nothing deployed drains the development queue, so a queued job reaches
   * nobody, but the sweep's standing limit is that it sends nothing, and the
   * cheapest way to honour that is not to ask the route at all.
   *
   * THE TOKEN IS BUILT THE WAY THE PRODUCT BUILDS ONE, which is the half that
   * makes the result mean anything. `customer-auth.ts` stores
   * `sha256(token)` as hex in `token_hash` and nothing else, so a token this
   * file mints and hashes identically IS a valid token as far as the product is
   * concerned. If that reproduction were wrong, "the second attempt was refused"
   * would prove nothing, because the FIRST would have been refused too.
   *
   * SO THE FIRST SPEND IS ASSERTED BEFORE THE SECOND IS EVIDENCE, exactly as the
   * expired session case above does it. A reuse check whose first attempt
   * silently failed is a green over a case that never ran.
   */
  const resetToken = `sweep-reset-${randomUUID()}`;
  const resetHash = createHash("sha256").update(resetToken, "utf8").digest("hex");
  treatAsSecret(resetToken);
  treatAsSecret(resetHash);

  const { error: insErr } = await db.from("eng_customer_auth_tokens").insert({
    customer_user_id: customer.userId,
    purpose: "reset_password",
    token_hash: resetHash,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  if (insErr) {
    cnt(
      "the reused reset link case",
      `a reset token could not be inserted for the probe: ${insErr.message}. Nothing about reuse was measured`,
    );
  } else {
    const spend = async (password) =>
      fetch(`${base}/api/account/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      });

    const firstPassword = `Sweep-first-${randomUUID().slice(0, 12)}`;
    const secondPassword = `Sweep-second-${randomUUID().slice(0, 12)}`;
    treatAsSecret(firstPassword);
    treatAsSecret(secondPassword);

    const first = await spend(firstPassword);

    if (!first.ok) {
      /*
       * THE CASE IS ABANDONED RATHER THAN REPORTED. A refusal of the second
       * attempt says nothing about reuse when the first was also refused.
       */
      cnt(
        "the reused reset link case",
        `the FIRST spend of a directly inserted reset token was refused (${first.status}), so the reproduction is wrong and a refused second attempt would prove nothing`,
      );
    } else {
      /*
       * THE STORED HASH IS COMPARED ACROSS THE SECOND ATTEMPT, and the status is
       * not trusted on its own. A 400 with the password changed anyway is
       * precisely the defect this case exists to find, and no status code can
       * see it.
       *
       * IT IS A COMPARISON RATHER THAN A SIGN IN, deliberately. The obvious
       * version signs in with the second password to see whether it took, and
       * that adds a FAILED sign in to this address before the email
       * normalisation cases below run, which could push them into the rate
       * limiter and report three working behaviours as defects. A read of the
       * row touches no limiter and answers the same question more directly.
       * The hash is registered as secret and never printed; only whether it
       * moved is reported.
       */
      const hashNow = async () => {
        const { data } = await db
          .from("eng_customer_users")
          .select("password_hash")
          .eq("id", customer.userId)
          .maybeSingle();
        return data?.password_hash ?? null;
      };

      const before = await hashNow();
      if (before) treatAsSecret(before);

      const second = await spend(secondPassword);
      const refused = !second.ok;

      const after = await hashNow();
      if (after) treatAsSecret(after);
      const unreadable = before === null || after === null;
      const moved = !unreadable && before !== after;

      find(
        "/api/account/set-password",
        "customer",
        "n/a",
        refused
          ? `a reset link was spent once and the second attempt was refused with ${second.status}, with the first spend proven to have succeeded first`
          : `a reset link was spent TWICE: the second attempt answered ${second.status}, so a link in an old email still changes a password`,
        refused ? 0 : 1,
        "behaviour",
      );

      if (unreadable) {
        cnt(
          "whether the stored password survived the reused reset link",
          "the probe's row could not be read back, so the reuse was judged on its status alone and the password itself was never checked",
        );
      } else {
        find(
          "/api/account/set-password",
          "customer",
          "n/a",
          moved
            ? "the stored password CHANGED on the second spend of an already used reset link"
            : "and the stored password did not change on the second spend, so the refusal actually prevented the change rather than only reporting one",
          moved ? 1 : 0,
          "behaviour",
        );
      }

      /* The probe's password is now the first one, which disposal removes anyway. */
      customer.password = firstPassword;
    }
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
