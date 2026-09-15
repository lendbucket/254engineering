// @runtime react-server
//
// Declared because this exercise reaches modules carrying `server-only`.

/**
 * PHASE 14 RANK 9: A SUSPENDED CUSTOMER ACCOUNT ASKED FOR A SET PASSWORD LINK.
 *
 *   npx tsx --conditions=react-server scripts/exercises/suspended-account-link.mjs
 *
 * `issueLinkForExistingAccount` returns null for a suspended account, so the
 * sign up door answers its usual sentence and sends nothing. The survey said
 * nothing exercises it: a person locked out of a suspended account gets
 * silence, which is correct and proven by no check.
 *
 * WHERE THIS RUNS, AND WHY NOT THROUGH THE DOOR
 * ---------------------------------------------
 * The only caller is POST /api/account/sign-up, and that route answers 404 with
 * the closed sentence while self service sign up is not cleared, which is
 * tonight. Clearing it is a launch condition and is not to be touched. So this
 * calls the function the route calls, against development, with fixture
 * customers on the probe domain that `destroyCustomerProbes` already sweeps.
 * The route's half, that both branches answer the same SENT sentence, is read
 * in the source and is NOT exercised here.
 *
 * WHAT IT LEAVES: every probe customer is removed through the shared teardown.
 * The audit row the active case writes, `customer_account.link_reissued`, is
 * permanent, because that table refuses DELETE; the board's own probes leave
 * the same kind of row every run.
 */

process.loadEnvFile?.(".env.local");

import { auditClient, refOf, DEVELOPMENT_REF } from "../lib/db-target.mjs";
import { PROBE_DOMAIN, destroyCustomerProbes } from "../lib/portal-probe.mjs";
import { issueLinkForExistingAccount } from "../../src/lib/account-creation.ts";

let failures = 0;
const rec = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
};

if (refOf(process.env.SUPABASE_URL ?? "") !== DEVELOPMENT_REF) {
  console.error("REFUSED: this exercise runs against development by name.");
  process.exit(1);
}
const db = auditClient("suspended account link exercise", { neverProduction: true });
console.log("suspended account link exercise, against development\n");

async function customer(status, tag) {
  const email = `probe-customer-exercise-${tag}-${Date.now()}@${PROBE_DOMAIN}`;
  const { data: c, error: ce } = await db.from("eng_clients")
    .insert({ kind: "organization", name: "Audit Probe Company", email, status: "active", is_demo: true })
    .select("id").single();
  if (ce) throw new Error(`client: ${ce.message}`);
  const { data: a, error: ae } = await db.from("eng_customer_accounts")
    .insert({ site: "254", client_id: c.id, status: "active", billing_mode: "card" })
    .select("id").single();
  if (ae) throw new Error(`account: ${ae.message}`);
  const { data: u, error: ue } = await db.from("eng_customer_users")
    .insert({ account_id: a.id, email, display_name: "Audit Probe Customer", status, account_role: "owner" })
    .select("id").single();
  if (ue) throw new Error(`user: ${ue.message}`);
  return { id: u.id, email };
}

const tokens = async (userId) =>
  (await db.from("eng_customer_auth_tokens").select("id", { count: "exact", head: true }).eq("customer_user_id", userId)).count;
const trail = async (userId) =>
  (await db.from("eng_audit_events").select("id", { count: "exact", head: true })
    .eq("action", "customer_account.link_reissued").eq("entity_id", userId)).count;

try {
  const suspended = await customer("suspended", "suspended");
  const active = await customer("active", "active");

  const s = await issueLinkForExistingAccount(suspended.email);
  rec("a suspended account is issued nothing", s === null);
  rec("and no set password token exists for it", (await tokens(suspended.id)) === 0, `${await tokens(suspended.id)} token(s)`);
  rec("and nothing in the audit trail says a link was reissued to it", (await trail(suspended.id)) === 0);

  const n = await issueLinkForExistingAccount(`probe-customer-exercise-nobody-${Date.now()}@${PROBE_DOMAIN}`);
  rec("an address with no account gets the same null, which is what the route's identical sentence rests on", n === null);

  const a = await issueLinkForExistingAccount(active.email);
  rec("an active account at the same kind of address is issued a link", Boolean(a?.token), a ? "token issued" : "null");
  rec("with exactly one token row and one reissue row in the trail",
    (await tokens(active.id)) === 1 && (await trail(active.id)) === 1,
    `${await tokens(active.id)} token(s), ${await trail(active.id)} trail row(s)`);

  /*
   * FIXED 2026-09-15 on the operator's ruling, and now a check rather than a
   * note. This exercise makes no sign up attempt and sends nothing, so a row that
   * says either is false. Against the old writer it failed; ids 17809 to 17812
   * are the rows that proved it.
   */
  const { data: row } = await db.from("eng_audit_events").select("id, summary")
    .eq("action", "customer_account.link_reissued").eq("entity_id", active.id).maybeSingle();
  rec(
    "the reissue trail row says the link was issued, and claims no sign up attempt and no send",
    /\bissued\b/i.test(row?.summary ?? "") && !/\bsent\b/i.test(row?.summary ?? "") && !/sign up attempt/i.test(row?.summary ?? ""),
    `row ${row?.id}: "${row?.summary}"`,
  );

  /*
   * INJECTION: the suspension is the only thing between that account and a
   * working link. Lift it on the fixture row and the same call must issue one,
   * or the null above was produced by something other than the suspended branch.
   */
  await db.from("eng_customer_users").update({ status: "active" }).eq("id", suspended.id);
  const lifted = await issueLinkForExistingAccount(suspended.email);
  rec("INJECTION: the same account with its suspension lifted is issued a link, so the null was the suspension",
    Boolean(lifted?.token) && (await tokens(suspended.id)) === 1, lifted ? "token issued" : "still null");
} catch (err) {
  failures += 1;
  console.log(`  STOP: ${err.message}`);
} finally {
  const gone = await destroyCustomerProbes("suspended-link-exercise");
  console.log("");
  rec("teardown: no probe customer is left", gone.ok, gone.note || "0 left");
}

console.log("\n  NOT EXERCISED: the route. POST /api/account/sign-up is closed while self service sign up is not cleared.");
console.log(`\n${failures ? "FAIL" : "PASS"}: ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
