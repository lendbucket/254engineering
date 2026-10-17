// @runtime react-server
/**
 * THE AUDIT SEED: ONE PARTNER STATEMENT AND ONE CUSTOMER BULK ORDER, ONCE.
 *
 *   npx tsx --conditions=react-server scripts/seed-audit-world.mjs
 *
 * Operator ruling of 2026-10-09: "the audit seed creates one partner statement
 * and one customer bulk order, once, demo-marked." It exists so the two screens
 * that need a record the signed in person OWNS can be measured:
 * /partner/statements/[reference] and /account/orders/[reference].
 *
 * DEVELOPMENT ONLY, and refused anywhere else before a client exists
 * (neverProduction). Idempotent: every step looks for what it would make and
 * makes it only when absent, so a second run changes nothing and says so.
 *
 * THE BULK ORDER IS ADOPTED, NOT PLACED. Development already holds one
 * demonstration bulk order, 254-B2026-DEMO01, on an active demonstration
 * account (Demo Solar Installers LLC). Placing a second would go through
 * placeBatch, which the launch gate refuses while the firm is prelaunch; the
 * existing one is exactly the record the screen needs. The seed asserts it is
 * still a demonstration, on a live account, and records it.
 *
 * THE PARTNER STATEMENT IS MADE THROUGH THE PRODUCT, never written by hand: a
 * demonstration partner ("seed-partner@audit-probe.invalid"), one adjustment
 * through recordAdjustment, the period closed through closePartnerPeriod, and
 * the statement issued through issuePartnerStatement. The ledger rows it
 * writes cannot be deleted, which is why this runs once and is idempotent.
 *
 * NO MAIL. The partner's address is on @audit-probe.invalid, the operator's
 * rule for every seeded account; RESEND_API_KEY is unset on development, so
 * the platform sends nothing; and nothing here touches Supabase Auth.
 *
 * Every "seed-" address is excluded from the probe sweeps in
 * scripts/lib/portal-probe.mjs, so no audit's teardown can take a seeded owner.
 */
import { auditClient } from "./lib/db-target.mjs";

const db = auditClient("seed-audit-world", { neverProduction: true });
if (!db) {
  console.log("REFUSED: no development database client.");
  process.exit(1);
}

const { DEFAULT_ROLES } = await import("../src/lib/ops-authz.ts");
const { recordAdjustment, closePartnerPeriod, issuePartnerStatement } = await import("../src/lib/ops-partner-comp.ts");

const made = [];
const found = [];

// ---------------------------------------------------- the customer bulk order
const BATCH = "254-B2026-DEMO01";
const { data: batch } = await db.from("eng_order_batches").select("id, reference, status, account_id").eq("reference", BATCH).maybeSingle();
if (!batch) {
  console.log(`STOPPED: ${BATCH} is not on this database, and a new bulk order cannot be placed while the gate is prelaunch.`);
  process.exit(1);
}
const { data: account } = await db.from("eng_customer_accounts").select("id, status, superseded_at, client_id").eq("id", batch.account_id).maybeSingle();
const { data: owner } = await db.from("eng_clients").select("name, is_demo").eq("id", account?.client_id ?? "").maybeSingle();
const adoptable = account && account.status === "active" && !account.superseded_at && owner?.is_demo === true;
if (!adoptable) {
  console.log(`STOPPED: ${BATCH}'s account is not a live demonstration account (status ${account?.status}, superseded ${account?.superseded_at ?? "no"}, demo ${owner?.is_demo}).`);
  process.exit(1);
}
found.push(`bulk order ${BATCH} (${batch.status}) on account ${account.id}, ${owner.name}, a demonstration`);

// ------------------------------------------------------- the partner statement
const PARTNER_EMAIL = "seed-partner@audit-probe.invalid";
let { data: partner } = await db.from("eng_partners").select("id, status, is_demo").eq("contact_email", PARTNER_EMAIL).maybeSingle();
if (!partner) {
  const { data, error } = await db
    .from("eng_partners")
    .insert({
      organisation: "Audit Seed Partner",
      contact_name: "Audit Seed",
      contact_email: PARTNER_EMAIL,
      code: "seed-audit-2026-10",
      status: "active",
      is_demo: true,
    })
    .select("id, status, is_demo")
    .single();
  if (error || !data) {
    console.log(`STOPPED: the seed partner insert was refused: ${error?.message ?? "no row came back"}`);
    process.exit(1);
  }
  partner = data;
  made.push(`eng_partners: 1 (Audit Seed Partner, ${partner.id}, is_demo)`);
} else {
  found.push(`partner Audit Seed Partner ${partner.id} (${partner.status}, demo ${partner.is_demo})`);
}

const { data: statements } = await db
  .from("eng_partner_statements")
  .select("id, reference, status")
  .eq("partner_id", partner.id);
const issued = (statements ?? []).find((s) => s.status === "issued" || s.status === "paid");

if (issued) {
  found.push(`partner statement ${issued.reference} (${issued.status})`);
} else {
  const actor = {
    id: undefined,
    email: "seed-audit@audit-probe.invalid",
    role: "admin",
    status: "active",
    grants: new Set(DEFAULT_ROLES.find((r) => r.key === "admin").grants),
  };
  const open = (statements ?? []).find((s) => s.status === "open");
  let statementId = open?.id ?? null;
  if (!statementId) {
    const adj = await recordAdjustment(actor, {
      partnerId: partner.id,
      amountCents: 2500,
      reason: "Audit seed: one demonstration adjustment, so the partner statement screen has a statement to measure.",
    });
    if (!adj.ok) {
      console.log(`STOPPED: the adjustment was refused: ${adj.error}`);
      process.exit(1);
    }
    made.push("eng_partner_ledger: 1 adjustment of $25.00 (append only)");
    const period = new Date().toISOString().slice(0, 7);
    const closed = await closePartnerPeriod(partner.id, period, { actorEmail: actor.email });
    if (!closed.ok) {
      console.log(`STOPPED: closing ${period} was refused: ${closed.error}`);
      process.exit(1);
    }
    statementId = closed.statementId ?? closed.id ?? null;
    made.push(`eng_partner_statements: 1 (period ${period})`);
  }
  if (!statementId) {
    const { data: again } = await db.from("eng_partner_statements").select("id").eq("partner_id", partner.id).eq("status", "open").maybeSingle();
    statementId = again?.id ?? null;
  }
  const out = statementId ? await issuePartnerStatement(statementId, actor.email) : { ok: false, error: "no open statement was found to issue" };
  if (!out.ok) {
    console.log(`STOPPED: issuing the statement was refused: ${out.error}`);
    process.exit(1);
  }
  made.push(`statement ${out.reference} issued, $${(out.totalCents / 100).toFixed(2)}`);
}

console.log("");
console.log("========== THE AUDIT SEED ==========");
console.log(made.length ? "MADE:" : "MADE: nothing; everything was already there.");
for (const m of made) console.log(`  ${m}`);
console.log("FOUND:");
for (const f of found) console.log(`  ${f}`);
