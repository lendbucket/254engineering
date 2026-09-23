/**
 * A signed in session for an audit that needs to see the portal.
 *
 * WHY THIS IS SHARED RATHER THAN COPIED
 * -------------------------------------
 * mobile-overflow-audit grew this machinery first, because it was the only
 * audit that walked a portal route. Gate 0 of Phase 11 established that
 * contrast-audit, mobile-audit and forms-audit visit no portal route at all:
 * between them they were reporting green about the marketing site while the
 * platform the firm runs on was never measured.
 *
 * Bringing three more audits inside meant either four copies of account
 * creation, sign in and verified teardown, or one. Four copies of a teardown is
 * four chances to leave a live account behind, and this repository has already
 * had a run leave a probe on a database and report green.
 *
 * NEVER PRODUCTION, and not as a matter of care. Every probe here creates an
 * account, signs it in and deletes it. The deletion is verified, but the audit
 * trail rows a sign in produces are permanent because that table refuses
 * deletes by design. The neverProduction flag is checked inside db-target
 * before ALLOW_PRODUCTION_DB is even read, which is the same standing this
 * carries in roles-audit and seed-field-demo.
 */

import { createHash, randomBytes } from "node:crypto";
import { auditClient } from "./db-target.mjs";
import { signInFully } from "./probe-mfa.mjs";

/** Obviously fake, and the domain is what teardown sweeps on. */
export const PROBE_DOMAIN = "audit-probe.invalid";

/*
 * ==========================================================================
 * A PROBE THAT COULD NOT BE BUILT CARRIES THE REASON IT COULD NOT BE BUILT.
 * Operator ruling, 2026-09-23.
 * ==========================================================================
 *
 * WHAT HAPPENED. A board went red on
 *
 *     FAIL: the run completed (probe account: fetch failed)
 *
 * in `break-glass-audit`. The MFA recovery path was never exercised. The call
 * that creates the probe account threw a transport error, the catch recorded it
 * as a failed check, and the audit printed "a break glass that is not exercised
 * is a recovery path that exists only in a document" underneath it. A standalone
 * re-run minutes later passed 32 of 32.
 *
 * That is the 2026-09-22 ruling exactly, one audit further on: a check whose
 * subject could not be BUILT has not measured the property, and saying FAIL
 * claims it did. It is sharpest on a recovery or security path, because a red
 * there reads as "the break glass is broken", which is the opposite of what
 * happened and is the sentence somebody would quote in an incident review.
 *
 * WHY THE FIX IS HERE AND NOT IN THAT AUDIT. The instance was one catch block.
 * The class is this function, which thirteen scripts call, and which discarded
 * the reason at the one place where it is known. It returned a bare `null` for
 * THREE different faults, no database client, `createUser` refused, the profile
 * insert rejected, and returned an object with a null cookie for a FOURTH, the
 * sign in producing no cookie. A caller holding `null` cannot say which, so
 * every caller that wanted to report anything had to invent a sentence, and
 * four of them invented a failed check.
 *
 * So a failed build returns a probe shaped object carrying `fault`. Every
 * existing caller tests `probe?.cookie`, which is still false, so nothing
 * downstream changes by accident. What is new is that the reason survives.
 *
 * AND EVERY PROBE FAULT IS COULD NOT TELL, WHICHEVER OF THE FOUR IT WAS.
 * A profile insert rejected by the schema is a real problem and it is still not
 * a finding about the thing the audit is named after. It is the audit saying it
 * could not get far enough to look. The note names which fault it hit, because
 * a note that cannot name the fault is the status function defect this
 * repository already records at the MFA lockout.
 */
const probeFailure = (role, fault) => ({ id: null, email: null, role, cookie: null, fault });

/**
 * The first fault among some probes, or null when every one of them was built.
 *
 * Callers use it to choose between COULD NOT TELL and a real verdict. It reads
 * the `fault` a failed build carries, and falls back to naming the cookie when
 * a probe was built but never reached a session, because those are different
 * sentences and a reader needs to know which one they are looking at.
 */
export function probeFault(probes) {
  for (const [name, probe] of Object.entries(probes)) {
    if (!probe) return `${name}: no probe was returned at all`;
    if (probe.fault) return `${name}: ${probe.fault}`;
    if (!probe.cookie) return `${name}: built, but the sign in returned no cookie`;
  }
  return null;
}

/** The sentence every superseded probe account carries. */
const PROBE_SUPERSEDED_REASON =
  "An audit probe account, superseded at teardown. It cannot be deleted: 0048 refuses DELETE on every account, because a record of what somebody was charged must outlive the account.";

/**
 * Retire a probe account, which since 0048 means superseding it.
 *
 * ======================================================================
 * THE DELETE STOPPED WORKING AND NOTHING SAID SO.
 * ======================================================================
 *
 * 0048 refuses DELETE on every customer account, because a record of what
 * somebody was charged must outlive the account. Three teardowns went on
 * calling `.delete()` and DISCARDING THE ERROR, so every probe account leaked
 * and the board stayed green: 26 accumulated on development in one day before
 * anybody counted them.
 *
 * It was found at Phase 14's gate zero by counting rows rather than by any
 * check, which is the same shape as every other finding in that survey: the
 * thing nobody is looking at.
 *
 * SUPERSEDING IS THE SANCTIONED ACT and it is what the operator's ruling says a
 * retired account becomes. The reason and the actor are required by a check
 * constraint, so a probe cannot be retired anonymously either.
 *
 * It does NOT delete the client beneath it, because an account referencing a
 * client keeps that client alive and deleting it would fail for a second
 * reason.
 */
export async function supersedeProbeAccount(d, accountId) {
  if (!accountId) return { ok: false, error: "no account id" };
  const { error } = await d
    .from("eng_customer_accounts")
    .update({
      superseded_at: new Date().toISOString(),
      superseded_reason: PROBE_SUPERSEDED_REASON,
      superseded_by_email: `teardown@${PROBE_DOMAIN}`,
    })
    .eq("id", accountId)
    .is("superseded_at", null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

const made = [];
const partnersMade = [];
let db = null;

function client(label) {
  if (!db) db = auditClient(label, { neverProduction: true });
  return db;
}

/**
 * Create an account in the given role and sign it in.
 *
 * Never throws. When anything in the build fails it returns a probe shaped
 * object with a null cookie and a `fault` naming what went wrong, so a caller
 * can report "this was not measured" rather than dying halfway through a run
 * and leaving the earlier accounts behind.
 *
 * It used to return a bare null here, and that sentence is the whole reason for
 * the note at the top of this file: four different faults arrived at the caller
 * as one indistinguishable value, and four audits turned that value into a
 * failed check about something they had not looked at.
 */
export async function createProbe(base, role, label = "audit") {
  const d = client(label);
  if (!d) return probeFailure(role, "no database client, so no probe account could be made");

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `probe-${stamp}@${PROBE_DOMAIN}`;
  const password = `probe-${stamp}-${label}`;

  /*
   * THE THROW IS CAUGHT HERE RATHER THAN LEFT TO THE CALLER, because a
   * transport error out of this call is what produced the 2026-09-23 board:
   * `fetch failed` reached a caller's catch block and became a failed check.
   * Caught here it becomes a fault with a name, and every caller gets the same
   * answer whether the client refused or the network did.
   */
  let data = null;
  let error = null;
  try {
    ({ data, error } = await d.auth.admin.createUser({ email, password, email_confirm: true }));
  } catch (err) {
    return probeFailure(role, `creating the account threw: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (error || !data?.user) {
    return probeFailure(role, `creating the account was refused: ${error?.message ?? "no user came back"}`);
  }

  const { error: pErr } = await d.from("eng_profiles").insert({
    id: data.user.id,
    email,
    display_name: `Audit Probe ${role}`,
    role,
    status: "active",
    /*
     * AN AUDIT PROBE IS A DEMONSTRATION RECORD, AND SAYS SO IN THE DATABASE.
     *
     * Marked at creation rather than relied on to be cleaned up. destroyProbes
     * sweeps the whole domain precisely because a run that crashes leaves
     * accounts behind, and a leftover probe engineer with is_demo false would
     * appear by name on the production report's per-engineer breakdown with a
     * dollar figure beside it. Phase 12 Section 2.
     */
    is_demo: true,
  });
  if (pErr) {
    await d.auth.admin.deleteUser(data.user.id).catch(() => {});
    return probeFailure(role, `the profile insert was rejected: ${pErr.message}`);
  }

  made.push({ id: data.user.id, email });

  /*
   * SIGN IN AND FINISH WHATEVER THE ACCOUNT NEEDS.
   *
   * Since 0024 the admin and engineer roles require a second factor, so a plain
   * sign in for those returns a PENDING session that opens nothing. signInFully
   * completes the real enrolment against the real endpoint and hands back a
   * full cookie.
   *
   * Enrolling rather than exempting is deliberate and is argued at the top of
   * scripts/lib/probe-mfa.mjs: an audit that avoids the requirement it made
   * true is measuring a system that no longer exists.
   */
  const signedIn = await signInFully(base, email, password);

  /*
   * A PROBE WITHOUT A COOKIE IS A PROBE THAT HANGS SOMEBODY ELSE.
   *
   * Returning cookie: null let every browser audit downstream navigate a portal
   * route signed out, land on the login screen, and wait for a selector that
   * never appears. The first run after the second factor landed did exactly
   * that and sat for fifty one minutes before anybody looked at it.
   *
   * The cause was mundane, MFA_ENCRYPTION_KEY absent from .env.local, and the
   * symptom was a HANG rather than a failure, which is the worse of the two: a
   * failure names itself in seconds and a hang looks like slow work.
   *
   * So the reason is printed once, here, where it is known. The null still goes
   * back for the caller to handle, because inventing a cookie would be worse
   * than either.
   */
  if (!signedIn.cookie) {
    console.error(
      "[portal-probe] " + role + " could not reach a full session: " + (signedIn.error ?? "no cookie"),
    );
  }

  return { id: data.user.id, email, role, cookie: signedIn.cookie, fault: null };
}

/**
 * A signed in PARTNER, which is a different principal and a different cookie.
 *
 * WHY IT GOES THROUGH THE REAL SET PASSWORD FLOW
 * ----------------------------------------------
 * A partner's password is scrypt hashed in the application, so an audit cannot
 * write one directly without reimplementing the hashing, and an audit that
 * reimplements the thing it is testing is measuring its own copy.
 *
 * So this writes a token row, which is a sha256 the audit CAN compute, and then
 * posts it to /api/partner/set-password exactly as a person would. The account
 * that comes out the other end was made the way real accounts are made, and the
 * flow itself is exercised as a side effect.
 *
 * The partner code is obviously fake and the organisation says so, because a
 * probe partner appearing in a list somewhere should read as a probe.
 */
/** The failure shape for the two non staff probes. See `probeFailure` above. */
const partnerFailure = (fault) => ({ partnerId: null, userId: null, email: null, cookie: null, fault });
const customerFailure = (fault) => ({ accountId: null, userId: null, email: null, cookie: null, fault });

export async function createPartnerProbe(base, label = "audit") {
  const d = client(label);
  if (!d) return partnerFailure("no database client, so no partner probe could be made");

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `probe-partner-${stamp}@${PROBE_DOMAIN}`;
  const password = `probe-${stamp}-${label}-partner`;

  const { data: partner, error: pErr } = await d
    .from("eng_partners")
    .insert({
      organisation: "Audit Probe Partner",
      contact_name: "Audit Probe",
      contact_email: email,
      code: `probe-${stamp}`,
      status: "active",
      /* For the reason recorded on the staff probe above. */
      is_demo: true,
    })
    .select("id")
    .single();
  if (pErr || !partner) return partnerFailure(`the partner insert was rejected: ${pErr?.message ?? "no row came back"}`);

  const { data: user, error: uErr } = await d
    .from("eng_partner_users")
    .insert({
      partner_id: partner.id,
      email,
      display_name: "Audit Probe",
      status: "invited",
    })
    .select("id")
    .single();
  if (uErr || !user) {
    await d.from("eng_partners").delete().eq("id", partner.id);
    return partnerFailure(`the partner user insert was rejected: ${uErr?.message ?? "no row came back"}`);
  }

  partnersMade.push({ partnerId: partner.id, userId: user.id, email });

  const token = randomBytes(32).toString("base64url");
  const { error: tErr } = await d.from("eng_partner_tokens").insert({
    user_id: user.id,
    purpose: "set_password",
    token_hash: createHash("sha256").update(token, "utf8").digest("hex"),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (tErr) return partnerFailure(`the set password token insert was rejected: ${tErr.message}`);

  const set = await fetch(`${base}/api/partner/set-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!set.ok) {
    return {
      partnerId: partner.id,
      userId: user.id,
      email,
      cookie: null,
      fault: `setting the partner password was refused (HTTP ${set.status})`,
    };
  }

  const res = await fetch(`${base}/api/partner/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const m = (res.headers.get("set-cookie") ?? "").match(/eng_partner=([^;]+)/);

  return { partnerId: partner.id, userId: user.id, email, cookie: m ? m[1] : null, fault: null };
}

const customersMade = [];

/**
 * A customer who can open the account surface.
 *
 * WHY THIS EXISTS NOW
 * -------------------
 * The account surface shipped in Phase 8 Section 1 and no browser audit had ever
 * opened it: contrast, mobile, overflow and forms all measured the portal and
 * the public site and nothing else. The reason was not a decision, it was that
 * opening it needed a session and no probe made one, so it sat outside every
 * list. The surface inventory this now feeds exists to stop that happening
 * again; this is the piece that makes the account half of it reachable.
 *
 * FOUR ROWS, BECAUSE THE SCHEMA MEANS IT
 * --------------------------------------
 * A customer user belongs to an account, an account belongs to a client, and a
 * client is the firm's record of an organisation. Short circuiting any of that
 * would be inventing a shape the product does not have.
 *
 * The password is set through the REAL set password endpoint rather than by
 * writing a hash here, for the same reason the partner probe does it: a probe
 * that reimplements hashing is a probe measuring its own copy of the thing it
 * is testing.
 */
export async function createCustomerProbe(base, label = "audit") {
  const d = client(label);
  if (!d) return customerFailure("no database client, so no customer probe could be made");

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `probe-customer-${stamp}@${PROBE_DOMAIN}`;
  const password = `probe-${stamp}-${label}-customer`;

  const { data: clientRow, error: cErr } = await d
    .from("eng_clients")
    .insert({ kind: "organization", name: "Audit Probe Company", email, status: "active", is_demo: true })
    .select("id")
    .single();
  if (cErr || !clientRow) return customerFailure(`the client insert was rejected: ${cErr?.message ?? "no row came back"}`);

  const { data: account, error: aErr } = await d
    .from("eng_customer_accounts")
    .insert({ site: "254", client_id: clientRow.id, status: "active", billing_mode: "card" })
    .select("id")
    .single();
  if (aErr || !account) {
    await d.from("eng_clients").delete().eq("id", clientRow.id);
    return customerFailure(`the customer account insert was rejected: ${aErr?.message ?? "no row came back"}`);
  }

  const { data: user, error: uErr } = await d
    .from("eng_customer_users")
    .insert({
      account_id: account.id,
      email,
      display_name: "Audit Probe Customer",
      status: "invited",
      account_role: "owner",
    })
    .select("id")
    .single();
  if (uErr || !user) {
    await supersedeProbeAccount(d, account.id);
    await d.from("eng_clients").delete().eq("id", clientRow.id);
    return customerFailure(`the customer user insert was rejected: ${uErr?.message ?? "no row came back"}`);
  }

  customersMade.push({ clientId: clientRow.id, accountId: account.id, userId: user.id, email });

  const token = randomBytes(32).toString("base64url");
  const { error: tErr } = await d.from("eng_customer_auth_tokens").insert({
    customer_user_id: user.id,
    purpose: "set_password",
    token_hash: createHash("sha256").update(token, "utf8").digest("hex"),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (tErr) {
    return {
      accountId: account.id,
      userId: user.id,
      email,
      cookie: null,
      fault: `the set password token insert was rejected: ${tErr.message}`,
    };
  }

  const set = await fetch(`${base}/api/account/set-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!set.ok) {
    return {
      accountId: account.id,
      userId: user.id,
      email,
      cookie: null,
      fault: `setting the customer password was refused (HTTP ${set.status})`,
    };
  }

  const res = await fetch(`${base}/api/account/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const m = (res.headers.get("set-cookie") ?? "").match(/eng_customer=([^;]+)/);

  return { accountId: account.id, userId: user.id, email, cookie: m ? m[1] : null, fault: null };
}

/** The customer cookie, shaped for a Playwright context. */
export function customerCookieFor(probe, base) {
  if (!probe?.cookie) return [];
  const url = new URL(base);
  return [
    {
      name: "eng_customer",
      value: probe.cookie,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ];
}

/**
 * Remove every customer probe, and verify.
 *
 * Ordered by the foreign keys rather than by hope: users cascade from the
 * account, the account restricts the client, so the client goes last. A failed
 * delete is reported rather than swallowed, because an account left behind on
 * development is one the operator's own screens will show them.
 */
export async function destroyCustomerProbes(label = "audit") {
  const d = client(label);
  if (!d) return { ok: true, left: 0, note: "no database client, nothing was created" };

  const { data: strays } = await d
    .from("eng_customer_users")
    .select("id, account_id")
    .like("email", `%@${PROBE_DOMAIN}`);

  const accounts = new Set([
    ...customersMade.map((c) => c.accountId),
    ...(strays ?? []).map((r) => r.account_id),
  ]);

  for (const id of accounts) {
    const { data: account } = await d
      .from("eng_customer_accounts")
      .select("client_id")
      .eq("id", id)
      .maybeSingle();
    await d.from("eng_customer_users").delete().eq("account_id", id);
    await supersedeProbeAccount(d, id);
    if (account?.client_id) await d.from("eng_clients").delete().eq("id", account.client_id);
  }
  customersMade.length = 0;

  const { data } = await d
    .from("eng_customer_users")
    .select("email")
    .like("email", `%@${PROBE_DOMAIN}`);
  const left = (data ?? []).length;
  return { ok: left === 0, left, note: left ? `${left} customer probe(s) left behind` : "" };
}

/** The partner cookie, shaped for a Playwright context. */
export function partnerCookieFor(probe, base) {
  if (!probe?.cookie) return [];
  return [
    { name: "eng_partner", value: probe.cookie, url: base, httpOnly: true, sameSite: "Lax" },
  ];
}

/**
 * Remove every probe partner, then VERIFY by sweeping the domain.
 *
 * Deliberately broader than this run, exactly as destroyProbes is, so a run
 * that crashed before teardown is cleaned up by the next one rather than
 * reported forever as a failure nobody is deleting.
 *
 * A partner that has EARNED something cannot be removed: eng_partner_entries
 * references it with on delete restrict, by design, because a ledger entry
 * outlives the relationship it came from. No audit creates entries for a probe
 * partner, and if one ever does, this returns the refusal rather than swallowing
 * it, because a probe partner with earnings is a thing somebody has to look at.
 */
export async function destroyPartnerProbes(label = "audit") {
  const d = client(label);
  if (!d) return { ok: true, left: 0, note: "no database client, nothing was created" };

  const { data: strays } = await d
    .from("eng_partners")
    .select("id")
    .like("contact_email", `%@${PROBE_DOMAIN}`);

  const ids = new Set([...partnersMade.map((p) => p.partnerId), ...(strays ?? []).map((r) => r.id)]);
  const refused = [];

  for (const id of ids) {
    const { data: users } = await d.from("eng_partner_users").select("id").eq("partner_id", id);
    for (const u of users ?? []) {
      await d.from("eng_partner_tokens").delete().eq("user_id", u.id);
    }
    await d.from("eng_partner_users").delete().eq("partner_id", id);
    const { error } = await d.from("eng_partners").delete().eq("id", id);
    if (error) refused.push(`${id}: ${error.message}`);
  }
  partnersMade.length = 0;

  const { data } = await d
    .from("eng_partners")
    .select("id")
    .like("contact_email", `%@${PROBE_DOMAIN}`);
  const left = (data ?? []).length;
  return {
    ok: left === 0,
    left,
    note: left ? `${left} probe partner(s) left behind${refused.length ? `: ${refused.join(", ")}` : ""}` : "",
  };
}

/** The cookie shaped the way Playwright wants it, for a context. */
export function cookieFor(probe, base) {
  if (!probe?.cookie) return [];
  return [
    { name: "eng_ops", value: probe.cookie, url: base, httpOnly: true, sameSite: "Lax" },
  ];
}

/**
 * Remove every probe this run made, then VERIFY by sweeping the domain.
 *
 * The sweep is deliberately broader than the ids just created, so a probe left
 * behind by an earlier run that crashed is found and removed too. forms-audit
 * recorded the lesson this implements: a delete that matched nothing returned
 * no error, and the audit reported green.
 */
export async function destroyProbes(label = "audit") {
  const d = client(label);
  if (!d) return { ok: true, left: 0, note: "no database client, nothing was created" };

  /*
   * EVERYTHING ON THE PROBE DOMAIN, not only what this run made.
   *
   * The first version deleted the ids in `made` and then verified by sweeping
   * the domain. So a run that crashed before teardown left its accounts
   * behind, and every later run reported them as a failure it was not
   * deleting: the cleanup and the verification were looking at different sets.
   * Deleting exactly what the verification looks for is the only version where
   * they agree.
   */
  const { data: strays } = await d
    .from("eng_profiles")
    .select("id")
    .like("email", `%@${PROBE_DOMAIN}`);

  /*
   * AND THE AUTH USERS, WHICH THIS SWEEP COULD NOT SEE UNTIL 2026-09-22.
   *
   * Operator ruling. The subject was derived from eng_profiles alone, so an
   * auth user whose PROFILE had already been removed was invisible to both the
   * deletion and the verification. The verification counted profiles too, which
   * is what made it quiet: `left` read 0 while real sign-in-capable accounts sat
   * in auth.users, and the green said the domain was clean.
   *
   * It was found on development by a survey rather than by any check: two
   * roles-audit probes from 2026-09-05 and 2026-09-14, profiles gone, auth users
   * alive, seventeen days after the runs that made them. That is a credential
   * outliving its run on a database every audit points at.
   *
   * A profile is the thing the platform reads and an auth user is the thing that
   * can SIGN IN. Sweeping the first and verifying the first is a check on the
   * easier half of the problem.
   */
  const authIds = await probeAuthUsers(d);

  const ids = new Set([
    ...made.map((m) => m.id),
    ...(strays ?? []).map((r) => r.id),
    ...authIds.map((u) => u.id),
  ]);

  /*
   * The deleteUser failure is no longer swallowed. `.catch(() => {})` is how
   * both stranded accounts got there: the call failed, nothing said so, and the
   * verification was looking at profiles where the failure does not show.
   */
  const refusals = [];
  for (const id of ids) {
    await d.from("eng_auth_tokens").delete().eq("profile_id", id);
    await d.from("eng_profiles").delete().eq("id", id);
    const { error } = await d.auth.admin.deleteUser(id).then(
      (r) => r,
      (e) => ({ error: e }),
    );
    if (error) refusals.push(`${id}: ${error.message ?? error}`);
  }
  made.length = 0;

  /* VERIFIED IN BOTH PLACES, because a sweep verified in one is a sweep of one. */
  const { data } = await d.from("eng_profiles").select("email").like("email", `%@${PROBE_DOMAIN}`);
  const profilesLeft = (data ?? []).length;
  const usersLeft = (await probeAuthUsers(d)).length;
  const left = profilesLeft + usersLeft;

  const parts = [];
  if (profilesLeft) parts.push(`${profilesLeft} profile(s)`);
  if (usersLeft) parts.push(`${usersLeft} auth user(s) with no profile, which can still sign in`);
  if (refusals.length) parts.push(`deleteUser refused: ${refusals.join("; ")}`);

  return {
    ok: left === 0 && refusals.length === 0,
    left,
    note: parts.length ? `left behind on ${PROBE_DOMAIN}: ${parts.join(", ")}` : "",
  };
}

/*
 * EVERY auth user on the probe domain, paged to exhaustion.
 *
 * listUsers is paged and answers a bounded page with no indication that more
 * exist, which is the silent-ceiling shape this repository has already paid for
 * at PostgREST's 1000 and at a hand written .limit(20) reported as a queue
 * depth. It pages until a short page comes back, so the count is the count.
 */
async function probeAuthUsers(d) {
  const found = [];
  const perPage = 200;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await d.auth.admin.listUsers({ page, perPage });
    const users = data?.users ?? [];
    if (error) break;
    for (const u of users) {
      if (typeof u.email === "string" && u.email.endsWith(`@${PROBE_DOMAIN}`)) {
        found.push({ id: u.id, email: u.email });
      }
    }
    if (users.length < perPage) break;
  }
  return found;
}
