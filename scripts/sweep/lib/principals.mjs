/**
 * ONE PROBE PER PRINCIPAL, AND NOTHING THEY DO CAN REACH A PERSON.
 *
 * Operator ruling, 2026-09-30: one probe per role with .invalid addresses and
 * no phone, inserted directly so nothing queues, swept at the end with a read
 * back.
 *
 * THE STAFF PROBES REUSE scripts/lib/portal-probe.mjs WHOLESALE. It already
 * mints on the reserved domain `audit-probe.invalid`, already completes the
 * second factor that admin and engineer require rather than exempting itself
 * from it, and its `destroyProbes` already sweeps auth users as well as
 * profiles, which is the fix made on 2026-09-22 after a sweep verified against
 * the same table it deleted from and reported a clean domain over accounts that
 * could still sign in. Writing a second teardown would be a second account of
 * what cleaning up means.
 *
 * THE CUSTOMER PROBE IS INSERTED DIRECTLY, because the sign up route is the one
 * that hands an email to the job queue. A job never written cannot be drained
 * by anything, which is a stronger guarantee than the address being
 * undeliverable, and both are in force.
 *
 * WHAT CANNOT BE SWEPT IS COUNTED RATHER THAN HIDDEN. Every audit row these
 * probes cause is permanent: eng_audit_events refuses deletes by design, and a
 * customer account is superseded rather than removed because the orders and
 * statements attached to one are the record of what somebody was charged.
 */

import { randomBytes, scryptSync } from "node:crypto";

import { auditClient } from "../../lib/db-target.mjs";
import { cookieFor, createProbe, destroyProbes, PROBE_DOMAIN } from "../../lib/portal-probe.mjs";

/** Exactly customer-auth.ts's parameters. A mismatch fails the sign in. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

/**
 * THE ROLE KEYS THE DATABASE ACTUALLY HAS, NOT THE WORDS WE SAY OUT LOUD.
 *
 * The first run asked for "csr" and "technician" and both probes were refused
 * by `eng_profiles_role_fkey`, so two of the five principals the operator asked
 * for were never measured at all. Roles have been data since 0018 and the seed
 * names them `customer_service` and `field_tech`.
 *
 * The failure was visible only because createProbe reports its fault instead of
 * returning a null cookie silently, and because this sweep turns a principal
 * with no session into a COULD NOT TELL rather than skipping it quietly. A
 * sweep that had skipped them would have reported a clean bill over two roles
 * it never signed in as.
 *
 * `label` is what the report calls them, because "field_tech" is a database key
 * and "technician" is what the operator asked about.
 */
export const STAFF_ROLES = [
  { key: "admin", label: "admin" },
  { key: "customer_service", label: "csr" },
  { key: "field_tech", label: "technician" },
  { key: "engineer", label: "engineer" },
];

function hash(password, salt) {
  return scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  }).toString("base64");
}

/**
 * The customer principal: three rows, no door, no queue.
 *
 * Returns its ids so the sweep can dispose of them, and the cookie it got by
 * signing in through the product's own route, so the session is a real one
 * rather than something this file minted.
 */
export async function makeCustomer(base, db) {
  const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const email = `sweep-${stamp}@${PROBE_DOMAIN}`;
  const password = `sweep-${stamp}-${randomBytes(6).toString("base64url")}`;

  const { data: client, error: ce } = await db
    .from("eng_clients")
    .insert({ kind: "individual", name: "Sweep Probe", status: "active" })
    .select("id")
    .single();
  if (ce) return { fault: `client insert: ${ce.message}` };

  const { data: account, error: ae } = await db
    .from("eng_customer_accounts")
    .insert({ site: "254", client_id: client.id, status: "active" })
    .select("id")
    .single();
  if (ae) return { fault: `account insert: ${ae.message}`, clientId: client.id };

  const salt = randomBytes(16).toString("base64");
  const { data: user, error: ue } = await db
    .from("eng_customer_users")
    .insert({
      account_id: account.id,
      email,
      display_name: "Sweep Probe",
      phone: null,
      status: "active",
      account_role: "owner",
      origin: "operator_created",
      email_verified_at: new Date().toISOString(),
      password_hash: hash(password, salt),
      password_salt: salt,
    })
    .select("id")
    .single();
  if (ue) return { fault: `user insert: ${ue.message}`, clientId: client.id, accountId: account.id };

  let cookie = null;
  let signInNote = null;
  try {
    const res = await fetch(`${base}/api/account/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const setCookie = res.headers.get("set-cookie");
    if (res.ok && setCookie) cookie = setCookie.split(";")[0];
    else signInNote = `sign in answered ${res.status}${setCookie ? "" : " with no cookie"}`;
  } catch (e) {
    signInNote = `sign in threw: ${String(e).slice(0, 90)}`;
  }

  return {
    role: "customer",
    email,
    password,
    cookie,
    clientId: client.id,
    accountId: account.id,
    userId: user.id,
    fault: cookie ? null : signInNote,
  };
}

/**
 * THE SURFACE EACH PRINCIPAL IS SUPPOSED TO OPEN, used to VERIFY the session.
 *
 * A redirect to another screen on the same surface is fine, because the engineer
 * lands somewhere other than the portal root. Landing on a LOGIN screen is the
 * failure, and it is the only thing tested for.
 */
const LANDS_ON = {
  customer: "/account",
  admin: "/portal",
  csr: "/portal",
  technician: "/portal",
  engineer: "/portal",
};

/**
 * A COOKIE STRING IS NOT A SESSION, AND THIS FILE CLAIMED IT WAS FOR EVERY RUN.
 *
 * `makeCustomer` keeps `set-cookie` split at the first semicolon, so its value is
 * the PAIR `eng_customer=<value>`. `createProbe` returns the VALUE alone, because
 * the shared `cookieFor` helper is what knows the name is `eng_ops`. Two shapes
 * in one list, and the sweep then did `cookie.split("=")` on both, so every staff
 * principal was handed to Playwright as a cookie NAMED after its own session
 * token with an empty value.
 *
 * The portal refused all four, correctly, and the sweep reported
 * `principal admin session ok` because a string had come back. **Four of six
 * principals had never been signed in to anything, in any run.** The cost was
 * invisible until the landing check went in: 39 portal screens and 5 partner
 * screens reported as redirecting, which reads as a product fact and was a
 * harness fault, and before the landing check existed those same 41 routes had
 * the LOGIN page's dashes, promises and heights filed under their names.
 *
 * It is this repository's commonest defect twice over. The cookie name had two
 * homes, `cookieFor` and a `split("=")` here, and the sweep trusted its own
 * declaration that a principal was built instead of asking the product.
 *
 * SO A PRINCIPAL IS SIGNED IN WHEN SOMETHING IT OWNS OPENS, NEVER WHEN A STRING
 * EXISTS. `auth-cases.mjs` already holds this discipline in writing, for the
 * cookies it mints itself: "the reproduction is verified before it is trusted,
 * which is the half that makes an expired-session result mean anything." The
 * principals themselves were exempt from it. They are not now.
 */
async function verify(base, principal) {
  const landing = LANDS_ON[principal.role];
  if (!landing) return { ok: true, note: "no surface is declared for this role, so nothing was verified" };
  if (!principal.cookies || principal.cookies.length === 0) {
    return { ok: false, note: "no cookie to verify" };
  }
  try {
    const res = await fetch(base + landing, {
      headers: { cookie: principal.cookies.map((c) => `${c.name}=${c.value}`).join("; ") },
      redirect: "manual",
    });
    const to = res.headers.get("location") ?? "";
    if (res.status === 200) return { ok: true, note: `${landing} answered 200` };
    if (/\/login/.test(to)) {
      return { ok: false, note: `${landing} redirected to ${to.split("?")[0]}, so this cookie opens nothing` };
    }
    if (res.status >= 300 && res.status < 400) {
      return { ok: true, note: `${landing} redirected to ${to.split("?")[0]}, which is not a login screen` };
    }
    return { ok: false, note: `${landing} answered ${res.status}` };
  } catch (e) {
    return { ok: false, note: `verifying ${landing} threw: ${String(e).slice(0, 80)}` };
  }
}

/** Every principal the sweep walks as, built once and then VERIFIED. */
export async function makePrincipals(base) {
  const db = auditClient("building the sweep's principals");
  const principals = [{ role: "signed out", cookies: [], email: null }];

  const customer = await makeCustomer(base, db);
  /*
   * The pair is split once, HERE, where its shape is known, rather than by every
   * consumer guessing. `cookieFor` does the same job for a staff probe.
   */
  const at = customer.cookie ? customer.cookie.indexOf("=") : -1;
  principals.push({
    ...customer,
    cookies:
      at > 0
        ? [{ name: customer.cookie.slice(0, at), value: customer.cookie.slice(at + 1) }]
        : [],
  });

  for (const { key, label } of STAFF_ROLES) {
    const probe = await createProbe(base, key, "sweep");
    principals.push({
      role: label,
      roleKey: key,
      email: probe.email ?? null,
      /* The shared helper names the cookie. Nothing here restates it. */
      cookies: cookieFor(probe, base).map((c) => ({ name: c.name, value: c.value })),
      id: probe.id ?? null,
      fault: probe.fault ?? (probe.cookie ? null : "no session cookie came back"),
    });
  }

  for (const p of principals) {
    if (p.role === "signed out") continue;
    const v = await verify(base, p);
    if (!v.ok) {
      /*
       * The fault is REPLACED rather than appended, because the old one said the
       * sign in succeeded and that is the sentence that misled everybody.
       */
      p.fault = `the session was built but does not open its own surface: ${v.note}`;
      p.cookies = [];
    } else {
      p.verified = v.note;
    }
  }

  return { principals, customer, db };
}

/**
 * Dispose of everything, and say what could not be disposed of.
 *
 * THE VERIFICATION READS SOMETHING OTHER THAN WHAT THE DELETE READ. The
 * 2026-09-22 lesson: a sweep that derives its subject, deletes and verifies all
 * from one table agrees with itself by construction and reports a clean domain
 * over live accounts.
 */
export async function disposeOf(customer, db) {
  const removed = [];
  const kept = [];

  const staff = await destroyProbes("sweep");
  removed.push(`staff probes: ${staff.ok ? "swept" : "sweep reported a problem"}, ${staff.left ?? "?"} left on ${PROBE_DOMAIN}`);
  if (!staff.ok) kept.push(`destroyProbes did not report ok: ${staff.note ?? "no note"}`);

  if (customer?.userId) {
    const { count: tokens } = await db
      .from("eng_customer_auth_tokens")
      .delete({ count: "exact" })
      .eq("customer_user_id", customer.userId);
    removed.push(`${tokens ?? 0} customer auth token(s)`);

    const { count: users, error: ue } = await db
      .from("eng_customer_users")
      .delete({ count: "exact" })
      .eq("id", customer.userId);
    if (ue) kept.push(`customer user: ${ue.message}`);
    else removed.push(`${users ?? 0} customer user`);
  }

  if (customer?.accountId) {
    const { error } = await db
      .from("eng_customer_accounts")
      .update({
        superseded_at: new Date().toISOString(),
        superseded_reason:
          "Break it sweep probe, 2026-10-01. Reserved .invalid address, no phone, no orders, no statements. Superseded because this schema does not delete accounts.",
        superseded_by_email: "automated sweep, scripts/sweep/run.mjs",
        status: "closed",
      })
      .eq("id", customer.accountId);
    if (error) kept.push(`customer account could not be superseded: ${error.message}`);
    else removed.push("1 customer account superseded and closed");
  }

  /* Read back against the ADDRESS, which the deletes did not key on. */
  const { count: left } = await db
    .from("eng_customer_users")
    .select("id", { count: "exact", head: true })
    .like("email", `%@${PROBE_DOMAIN}`);

  return { removed, kept, leftOnDomain: left ?? 0 };
}
