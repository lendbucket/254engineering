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

import { auditClient } from "./db-target.mjs";

/** Obviously fake, and the domain is what teardown sweeps on. */
export const PROBE_DOMAIN = "audit-probe.invalid";

const made = [];
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

  for (const m of made) {
    await d.from("eng_auth_tokens").delete().eq("profile_id", m.id);
    await d.from("eng_profiles").delete().eq("id", m.id);
    await d.auth.admin.deleteUser(m.id).catch(() => {});
  }
  made.length = 0;

  const { data } = await d.from("eng_profiles").select("email").like("email", `%@${PROBE_DOMAIN}`);
  const left = (data ?? []).length;
  return { ok: left === 0, left, note: left ? `${left} probe account(s) left behind` : "" };
}
