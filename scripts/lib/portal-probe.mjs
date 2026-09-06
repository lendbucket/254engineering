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

/** Obviously fake, and the domain is what teardown sweeps on. */
export const PROBE_DOMAIN = "audit-probe.invalid";

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
 * Returns null rather than throwing when the database is not configured, so a
 * caller can report "this was not measured" as a failure of its own rather than
 * dying halfway through a run and leaving the earlier accounts behind.
 */
export async function createProbe(base, role, label = "audit") {
  const d = client(label);
  if (!d) return null;

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `probe-${stamp}@${PROBE_DOMAIN}`;
  const password = `probe-${stamp}-${label}`;

  const { data, error } = await d.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) return null;

  const { error: pErr } = await d.from("eng_profiles").insert({
    id: data.user.id,
    email,
    display_name: `Audit Probe ${role}`,
    role,
    status: "active",
  });
  if (pErr) {
    await d.auth.admin.deleteUser(data.user.id).catch(() => {});
    return null;
  }

  made.push({ id: data.user.id, email });

  const res = await fetch(`${base}/api/portal/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const m = (res.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);

  return { id: data.user.id, email, role, cookie: m ? m[1] : null };
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
export async function createPartnerProbe(base, label = "audit") {
  const d = client(label);
  if (!d) return null;

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
    })
    .select("id")
    .single();
  if (pErr || !partner) return null;

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
    return null;
  }

  partnersMade.push({ partnerId: partner.id, userId: user.id, email });

  const token = randomBytes(32).toString("base64url");
  const { error: tErr } = await d.from("eng_partner_tokens").insert({
    user_id: user.id,
    purpose: "set_password",
    token_hash: createHash("sha256").update(token, "utf8").digest("hex"),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (tErr) return null;

  const set = await fetch(`${base}/api/partner/set-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!set.ok) return { partnerId: partner.id, userId: user.id, email, cookie: null };

  const res = await fetch(`${base}/api/partner/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const m = (res.headers.get("set-cookie") ?? "").match(/eng_partner=([^;]+)/);

  return { partnerId: partner.id, userId: user.id, email, cookie: m ? m[1] : null };
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

  const ids = new Set([...made.map((m) => m.id), ...(strays ?? []).map((r) => r.id)]);
  for (const id of ids) {
    await d.from("eng_auth_tokens").delete().eq("profile_id", id);
    await d.from("eng_profiles").delete().eq("id", id);
    await d.auth.admin.deleteUser(id).catch(() => {});
  }
  made.length = 0;

  const { data } = await d.from("eng_profiles").select("email").like("email", `%@${PROBE_DOMAIN}`);
  const left = (data ?? []).length;
  return { ok: left === 0, left, note: left ? `${left} probe account(s) left behind` : "" };
}
