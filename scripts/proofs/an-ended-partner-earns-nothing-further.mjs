// @runtime react-server
//
// Declared because it imports src/lib/ops-partner-comp.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * AN ENDED OR SUSPENDED PARTNER EARNS NOTHING FURTHER, AND KEEPS WHAT IT EARNED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-ended-partner-earns-nothing-further.mjs
 *
 * Operator ruling 4 of 2026-10-15. accrueForDelivery and accrueForQualifiedLead
 * read the attribution and the terms and never the partner's standing, so a
 * partner who was ended went on earning on every order already attributed to
 * them. Now each reads the partner's status first:
 *
 *   1. an active partner accrues as before;
 *   2. a suspended or ended partner gets a zero entry carrying the reason, on a
 *      delivery and on a qualified lead;
 *   3. what an ended partner earned before stays on the ledger, untouched;
 *   4. a status read that fails credits nothing and writes nothing, and says so.
 *
 * Billing status joins the check once billing is on; it is off, so this proves
 * the partner status half, which is the half that acts today.
 *
 * HOW IT RUNS: every migration replayed into PGlite and served as PostgREST by
 * scripts/lib/replay-rest.mjs, because the partner ledger refuses deletes. No
 * server, no Stripe.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const { PORTS } = await import("../lib/ports.mjs");
const { startReplayRest } = await import("../lib/replay-rest.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------ the database */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays", files.length > 0, `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = id(701);
const PARTNERS = { active: 711, suspended: 712, ended: 713, unread: 714, activeLead: 715, endedLead: 716 };
const STATUS = { active: "active", suspended: "suspended", ended: "ended", unread: "active", activeLead: "active", endedLead: "ended" };
const partnerId = (k) => id(PARTNERS[k]);
const fileId = (k) => id(PARTNERS[k] + 100);
const leadId = (k) => id(PARTNERS[k] + 200);
const EARLIER = id(799);

await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Ended partner proof client, not a real person');
`);
for (const [k, n] of Object.entries(PARTNERS)) {
  const perLead = k.endsWith("Lead");
  await db.exec(`
    insert into eng_partners (id, organisation, contact_name, contact_email, status, code)
    values ('${partnerId(k)}', 'Ended partner proof ${k}, not a real business', 'Proof contact', 'ended-partner-proof-${n}@audit-probe.invalid', '${STATUS[k]}', 'PROOF${n}');
    insert into eng_partner_terms (partner_id, model, flat_cents, holdback_days, effective_from)
    values ('${partnerId(k)}', '${perLead ? "flat_per_qualified_lead" : "flat_per_order"}', ${perLead ? 2500 : 5000}, 0, '2026-01-01');
  `);
  if (perLead) {
    await db.exec(`insert into eng_leads (id, site, form, partner_id) values ('${leadId(k)}', '254engineering', 'contact', '${partnerId(k)}');`);
  } else {
    await db.exec(`
      insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status, partner_id, delivered_at)
      values ('${fileId(k)}', '254-PROOF-EP-${n}', '${CLIENT}', 'roof-inspections', '${n} Partner Way', 'Nueces', 'intake', '${partnerId(k)}', now());
    `);
  }
}
/* What the ended partner earned before it was ended, already on the ledger. */
await db.exec(`
  insert into eng_partner_entries (id, partner_id, kind, amount_cents, status, explanation, occurred_at, payable_at)
  values ('${EARLIER}', '${partnerId("ended")}', 'accrual', 5000, 'accrued', 'Earned before the partner was ended.', now() - interval '60 days', now() - interval '30 days');
`);

/* ------------------------------------------------------------- the failure */

/*
 * The admin client binds the global fetch when it is first made, so the
 * failure is armed before anything makes it, and answers only the read of one
 * partner's status.
 */
let failStatusReadFor = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
  if (failStatusReadFor && url.includes("/eng_partners?") && url.includes("select=status") && url.includes(`id=eq.${failStatusReadFor}`)) {
    return new Response(JSON.stringify({ code: "PROOF", message: "the proof failed this read", details: null, hint: null }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input, init);
};

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
const comp = await import("../../src/lib/ops-partner-comp.ts");

const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const entriesOf = (k) =>
  many(`select id, amount_cents, status, explanation from eng_partner_entries where partner_id = $1 order by occurred_at`, [partnerId(k)]);

try {
  /* ============================ 1. an active partner ============================ */
  {
    const res = await comp.accrueForDelivery(fileId("active"));
    const rows = await entriesOf("active");
    check("an active partner accrues on a delivery as before", res.ok === true && rows.length === 1 && Number(rows[0].amount_cents) === 5000, `${JSON.stringify(res)} ${JSON.stringify(rows)}`);
  }

  /* ===================== 2. suspended and ended: a zero with the reason ===================== */
  for (const k of ["suspended", "ended"]) {
    const res = await comp.accrueForDelivery(fileId(k));
    const rows = (await entriesOf(k)).filter((r) => r.id !== EARLIER);
    check(
      `a ${k} partner's delivery is a zero entry carrying the reason`,
      res.ok === true && rows.length === 1 && Number(rows[0].amount_cents) === 0 && rows[0].status === "accrued" && new RegExp(`is ${k}, so this earns nothing`).test(rows[0].explanation),
      `${JSON.stringify(res)} ${JSON.stringify(rows)}`,
    );
  }

  /* ===================== 3. what an ended partner earned before stays owed ===================== */
  {
    const earlier = (await entriesOf("ended")).find((r) => r.id === EARLIER);
    check("and what the ended partner earned before stays on the ledger, untouched", Number(earlier?.amount_cents) === 5000 && earlier?.status === "accrued", JSON.stringify(earlier));
  }

  /* ===================== a qualified lead, both ways ===================== */
  {
    const active = await comp.accrueForQualifiedLead(leadId("activeLead"));
    const activeRows = await entriesOf("activeLead");
    check("an active partner accrues on a qualified lead as before", active.ok === true && activeRows.length === 1 && Number(activeRows[0].amount_cents) === 2500, JSON.stringify(activeRows));
    const ended = await comp.accrueForQualifiedLead(leadId("endedLead"));
    const endedRows = await entriesOf("endedLead");
    check(
      "an ended partner's qualified lead is a zero entry carrying the reason",
      ended.ok === true && endedRows.length === 1 && Number(endedRows[0].amount_cents) === 0 && /is ended, so this earns nothing/.test(endedRows[0].explanation),
      JSON.stringify(endedRows),
    );
  }

  /* ===================== 4. a status read that fails ===================== */
  {
    failStatusReadFor = partnerId("unread");
    let res;
    try {
      res = await comp.accrueForDelivery(fileId("unread"));
    } finally {
      failStatusReadFor = null;
    }
    const rows = await entriesOf("unread");
    check(
      "a status read that fails credits nothing, writes nothing, and says so",
      res?.ok === false && /could not be read/.test(res.error) && rows.length === 0,
      `${JSON.stringify(res)} ${rows.length} entr(ies)`,
    );
  }
} finally {
  await rest.close();
}
await db.close();

console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: an ended or suspended partner earns nothing further, keeps what it earned, and a failed read credits nothing.");
