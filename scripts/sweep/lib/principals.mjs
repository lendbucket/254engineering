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
import { createProbe, destroyProbes, PROBE_DOMAIN } from "../../lib/portal-probe.mjs";

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

/** Every principal the sweep walks as, built once. */
export async function makePrincipals(base) {
  const db = auditClient("building the sweep's principals");
  const principals = [{ role: "signed out", cookie: null, email: null }];

  const customer = await makeCustomer(base, db);
  principals.push(customer);

  for (const { key, label } of STAFF_ROLES) {
    const probe = await createProbe(base, key, "sweep");
    principals.push({
      role: label,
      roleKey: key,
      email: probe.email ?? null,
      cookie: probe.cookie ?? null,
      id: probe.id ?? null,
      fault: probe.fault ?? (probe.cookie ? null : "no session cookie came back"),
    });
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
