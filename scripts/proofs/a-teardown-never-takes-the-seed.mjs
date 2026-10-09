/**
 * PROOF: NO PROBE TEARDOWN CAN TAKE A SEEDED OWNER OR MISS A PROBE.
 *
 * The audit seed (scripts/seed-audit-world.mjs) is on the probe domain, by the
 * operator's rule for every seeded account, and every teardown in
 * scripts/lib/portal-probe.mjs sweeps that domain. destroyCustomerProbes
 * deletes every user of a swept account and supersedes the account;
 * destroyPartnerProbes suspends a swept partner. Without the "seed-" exclusion,
 * the next teardown of any audit would supersede the demonstration account that
 * owns 254-B2026-DEMO01 and suspend the seeded partner, for good.
 *
 * The teardowns take their subjects from partnerSweepSubjects and
 * customerSweepUsers and nowhere else, so this asks those two without sweeping:
 *
 *   excluded   the seeded partner, and a reader attached to a seeded account
 *   included   a plain probe partner and a plain probe customer user, the
 *              controls, without which a sweep that matched nothing would pass
 *
 * Development only. The three rows it makes are its own and are removed, with
 * every error kept and a read back that does not reuse the delete's query.
 */
import { auditClient } from "../lib/db-target.mjs";
import { partnerSweepSubjects, customerSweepUsers } from "../lib/portal-probe.mjs";

const db = auditClient("proof seed teardown", { neverProduction: true });
let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};
if (!db) {
  console.log("COULD NOT TELL: no development database client.");
  process.exit(0);
}

const { data: seedPartner } = await db.from("eng_partners").select("id").eq("contact_email", "seed-partner@audit-probe.invalid").maybeSingle();
const { data: batch } = await db.from("eng_order_batches").select("account_id").eq("reference", "254-B2026-DEMO01").maybeSingle();
if (!seedPartner || !batch?.account_id) {
  console.log("COULD NOT TELL: the audit seed is not on this database; run scripts/seed-audit-world.mjs first.");
  process.exit(0);
}

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const made = { customerUsers: [], partners: [] };
try {
  const { data: reader } = await db
    .from("eng_customer_users")
    .insert({ account_id: batch.account_id, email: `seed-attach-proof-${stamp}@audit-probe.invalid`, display_name: "Proof reader", status: "invited", account_role: "member" })
    .select("id")
    .single();
  const { data: control } = await db
    .from("eng_customer_users")
    .insert({ account_id: batch.account_id, email: `probe-proof-${stamp}@audit-probe.invalid`, display_name: "Proof control", status: "invited", account_role: "member" })
    .select("id")
    .single();
  const { data: probePartner } = await db
    .from("eng_partners")
    .insert({ organisation: "Proof control partner", contact_name: "Proof", contact_email: `probe-proof-${stamp}@audit-probe.invalid`, code: `proof-${stamp}`, status: "active", is_demo: true })
    .select("id")
    .single();
  if (reader) made.customerUsers.push(reader.id);
  if (control) made.customerUsers.push(control.id);
  if (probePartner) made.partners.push(probePartner.id);
  check("the proof made its three rows", Boolean(reader && control && probePartner));

  const { data: ps, error: pe } = await partnerSweepSubjects(db);
  const { data: cs, error: ce } = await customerSweepUsers(db);
  check("both sweep questions could be asked", !pe && !ce, pe?.message ?? ce?.message ?? "");
  const pIds = new Set((ps ?? []).map((r) => r.id));
  const cIds = new Set((cs ?? []).map((r) => r.id));

  check("the seeded partner is not a partner teardown subject", !pIds.has(seedPartner.id));
  check("and a plain probe partner is (the control)", Boolean(probePartner) && pIds.has(probePartner.id));
  check("a reader attached to the seeded account is not a customer teardown subject", Boolean(reader) && !cIds.has(reader.id));
  check("and a plain probe user on the same account is (the control)", Boolean(control) && cIds.has(control.id));
} finally {
  const errors = [];
  for (const id of made.customerUsers) {
    const { error } = await db.from("eng_customer_users").delete().eq("id", id);
    if (error) errors.push(`customer user ${id}: ${error.message}`);
  }
  for (const id of made.partners) {
    const { error } = await db.from("eng_partners").delete().eq("id", id);
    if (error) errors.push(`partner ${id}: ${error.message}`);
  }
  const { data: leftUsers } = await db.from("eng_customer_users").select("id").like("email", `%proof-${stamp}@audit-probe.invalid`);
  const { data: leftPartners } = await db.from("eng_partners").select("id").like("contact_email", `%proof-${stamp}@audit-probe.invalid`);
  check(
    "and the proof's own rows are gone",
    errors.length === 0 && (leftUsers ?? []).length === 0 && (leftPartners ?? []).length === 0,
    errors.join("; "),
  );
  const { data: acct } = await db.from("eng_customer_accounts").select("superseded_at").eq("id", batch.account_id).maybeSingle();
  const { data: sp } = await db.from("eng_partners").select("status").eq("id", seedPartner.id).maybeSingle();
  check("and the seeded owners are untouched", acct && !acct.superseded_at && sp?.status === "active", `account superseded ${acct?.superseded_at ?? "no"}, seed partner ${sp?.status}`);
}

console.log(wrong === 0 ? "\nAll checks correct. A teardown cannot take the seed, and still takes every probe." : `\n${wrong} check(s) wrong.`);
process.exitCode = wrong === 0 ? 0 : 1;
