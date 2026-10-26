// @runtime react-server
//
// Declared because it imports src/lib/line-gate.ts, which carries server-only.

/**
 * WPI-8 ONGOING OPENS ONLY ON ITS OWN SIGNED ADDENDUM, AND COMPLETED
 * CONSTRUCTION STAYS ORDERABLE AT EVERY STEP.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/wpi8-ongoing-opens-only-on-its-own-signed-addendum.mjs
 *
 * Robert's rulings of 2026-10-26, 07:10 and 08:19 Central (0095, 0096). The
 * chain is replayed to 0094 in an in-process Postgres and set up as production
 * stands today: 254-WS-001 v1.1 in force for windstorm-wpi-8, 254-WP-001 v1.2
 * signed and held out of force, a technician trained on both. The money door
 * itself (lineIsSellable and orderBlockedNow, src/lib/line-gate.ts) is then
 * asked through the replay REST server, so every answer is the real door over
 * real rows. Completed construction is asked at every step:
 *
 *   1. at 0094, before anything here:        completed open, ongoing refused
 *   2. 0095 and 0096 applied:                 completed open, ongoing refused
 *   3. another deliverable's addendum signed: completed open, ongoing refused
 *   4. his ongoing addendum drafted, unsigned: refused
 *   5. signed, WP-001 put in force:           completed open, ongoing open
 *   6. a replacement drafted, unsigned:       ongoing refused again
 *
 * Then the shape check, the text, the retirement by tier, and that a
 * single-protocol line still retires its earlier version.
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
async function refused(sql, params = []) {
  try {
    await db.query(sql, params);
    return { refused: false, message: "" };
  } catch (e) {
    return { refused: true, message: e.message };
  }
}

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at95 = files.findIndex((f) => f.startsWith("0095_"));
const at96 = files.findIndex((f) => f.startsWith("0096_"));
check("0095 and 0096 are in the chain, in that order", at95 >= 0 && at96 === at95 + 1, `${files[at95]} ${files[at96]}`);
for (const f of files.slice(0, at95)) await db.exec(readSource(join(DIR, f)));

const { transcriptionSha256 } = await import("../../src/lib/protocol-sign.ts");
const WS_SHA = transcriptionSha256("254-WS-001", "1.1");
const WP_SHA = transcriptionSha256("254-WP-001", "1.2");
check("both windstorm protocols have a transcription to sign", /^[0-9a-f]{64}$/.test(WS_SHA ?? "") && /^[0-9a-f]{64}$/.test(WP_SHA ?? ""));

const ENG = "00000000-0000-4000-8000-0000000009e1";
const TECH = "00000000-0000-4000-8000-0000000009e2";
const OWNER = "00000000-0000-4000-8000-0000000009e3";
const SEAL = "00000000-0000-4000-8000-0000000009f1";
const SIGN = "00000000-0000-4000-8000-0000000009f2";
/* The records the chain itself seeds for the line, as production holds them. */
const recordId = async (doc, version) =>
  (await db.query(`select id from eng_protocol_templates where document_number = $1 and version_label = $2`, [doc, version])).rows[0]?.id;
const WS = await recordId("254-WS-001", "1.1");
const WP = await recordId("254-WP-001", "1.2");
check("the chain seeds WS-001 v1.1 and WP-001 v1.2 for windstorm-wpi-8", Boolean(WS && WP));
const WS_ACT = "00000000-0000-4000-8000-0000000009b1";
const WP_ACT = "00000000-0000-4000-8000-0000000009b2";
const LIC = "PROOF-000";
const ITEMS = JSON.stringify([{ sort_order: 1, item_key: "proof", kind: "note", label: "Proof item, not a real checklist" }]);
const hex = (c) => c.repeat(64);

await db.exec(`
  insert into auth.users (id) values ('${ENG}'), ('${TECH}'), ('${OWNER}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${ENG}', 'wpi8-eng@audit-probe.invalid', 'WPI-8 proof engineer, not a real person', 'engineer', 'active'),
    ('${TECH}', 'wpi8-tech@audit-probe.invalid', 'WPI-8 proof technician, not a real person', 'field_tech', 'active'),
    ('${OWNER}', 'wpi8-owner@audit-probe.invalid', 'WPI-8 proof owner, not a real person', 'admin', 'active');
  insert into eng_seal_images (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at) values
    ('${SEAL}', '${ENG}', 'seal', 'proof/wpi8/seal.png', '${hex("a")}', 10, 10, 10, now()),
    ('${SIGN}', '${ENG}', 'signature', 'proof/wpi8/signature.png', '${hex("b")}', 10, 10, 10, now());
`);
const sign = (act, doc, version, sha, items) =>
  db.query(
    `select eng_record_protocol_signature($1, $2, $3, $4, $5, $6, $7, now(), $8, $9::jsonb) as r`,
    [act, doc, version, sha, ENG, SEAL, SIGN, LIC, items],
  );
const wsSigned = await sign(WS_ACT, "254-WS-001", "1.1", WS_SHA, ITEMS);
check("as on production: WS-001's signature puts it in force", wsSigned.rows[0].r === "in_force", wsSigned.rows[0].r);
const wpSigned = await sign(WP_ACT, "254-WP-001", "1.2", WP_SHA, null);
check("and WP-001 v1.2 is signed and held out of force", wpSigned.rows[0].r === "signed", wpSigned.rows[0].r);

/* Robert's training, supervised 2026-10-15 and approved, on both records. */
for (const [template, doc, version] of [[WS, "254-WS-001", "1.1"], [WP, "254-WP-001", "1.2"]]) {
  const r = await db.query(
    `insert into eng_training_records (profile_id, service_slug, template_id, protocol_document, protocol_version_label, trained_on, supervised_by)
     values ($1, 'windstorm-wpi-8', $2, $3, $4, '2026-10-15', 'Proof supervisor') returning id`,
    [TECH, template, doc, version],
  );
  await db.query(`insert into eng_training_decisions (record_id, decision, decided_by) values ($1, 'approved', $2)`, [r.rows[0].id, ENG]);
}
const statusOf = async (id) => (await db.query(`select status from eng_protocol_templates where id = $1`, [id])).rows[0].status;

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
delete process.env.VERCEL_ENV;

try {
  const gate = await import("../../src/lib/line-gate.ts");
  const { deliverablesFor } = await import("../../data/catalog.ts");
  const completed = deliverablesFor("windstorm-wpi-8").find((d) => d.tier === "completed");
  const ongoing = deliverablesFor("windstorm-wpi-8").find((d) => d.tier === "ongoing");
  check("the line sells both deliverables", Boolean(completed && ongoing));
  const door = (entry) => gate.orderBlockedNow(entry, "open");
  const NOT_YET = /not available to order yet/;

  /* 1. Production today. */
  check("step 1, at 0094: completed construction is orderable", (await door(completed)) === null, String(await door(completed)));
  const s1 = await door(ongoing);
  check("and ongoing is refused", typeof s1 === "string", String(s1));

  /* 2. The two migrations. */
  await db.exec(readSource(join(DIR, files[at95])));
  await db.exec(readSource(join(DIR, files[at96])));
  check("0095 and 0096 apply over production's state", true);
  const tiers = (await db.query(
    `select document_number, version_label, service_tier, status from eng_protocol_templates
      where service_tier is not null or service_slug = 'windstorm-wpi-8' order by document_number, version_label`,
  )).rows;
  check(
    "only the windstorm records carry a tier: WS-001 completed and still in force, WP-001 ongoing and not",
    JSON.stringify(tiers) === JSON.stringify([
      { document_number: "254-WP-001", version_label: "1.1", service_tier: "ongoing", status: "draft" },
      { document_number: "254-WP-001", version_label: "1.2", service_tier: "ongoing", status: "draft" },
      { document_number: "254-WS-001", version_label: "1.1", service_tier: "completed", status: "published" },
    ]),
    JSON.stringify(tiers),
  );
  check("step 2: completed construction is orderable", (await door(completed)) === null, String(await door(completed)));
  const s2 = await door(ongoing);
  check("and ongoing is refused, the customer told only that it is not available yet", NOT_YET.test(String(s2)), String(s2));
  const held = await refused(`select eng_put_signed_protocol_in_force($1, $2, $3::jsonb)`, [WP_ACT, LIC, ITEMS]);
  check("and WP-001 still cannot be put in force", held.refused && /held out of force/.test(held.message), held.message.slice(0, 120));

  /* 3. Another deliverable's addendum, signed, opens nothing here. */
  const insertPerJob = async (deliverable, cents) =>
    (await db.query(
      `insert into eng_scope_addenda (deliverable, engineer_id, scope, pay_cents, basis, created_by)
       values ($1, $2, 'Proof scope, not a real addendum', $3, 'per_job', $4) returning id, addendum_text, content_sha256`,
      [deliverable, ENG, cents, OWNER],
    )).rows[0];
  const signAddendum = (a) =>
    db.query(`select eng_record_addendum_signature(gen_random_uuid(), $1, $2, $3, $4, $5, now())`, [a.id, a.content_sha256, ENG, SEAL, SIGN]);
  const other = await insertPerJob("roof-inspections/standard", 5000);
  await signAddendum(other);
  const otherPay = (await db.query(`select * from eng_line_pay('windstorm-wpi-8/ongoing')`)).rows;
  check("step 3: another deliverable's signed addendum pays nothing on ongoing", otherPay.length === 0, JSON.stringify(otherPay));
  const s3 = await door(ongoing);
  check("and the door still refuses ongoing", typeof s3 === "string", String(s3));
  check("while completed construction is orderable", (await door(completed)) === null);
  const stillHeld = await refused(`select eng_put_signed_protocol_in_force($1, $2, $3::jsonb)`, [WP_ACT, LIC, ITEMS]);
  check("and WP-001 is still held", stillHeld.refused);

  /* 4. His ongoing addendum, drafted and unsigned. */
  const mine = await insertPerJob("windstorm-wpi-8/ongoing", 17500);
  check(
    "the database writes the text he signs: the deliverable, the scope and $175.00 per job",
    /Deliverable: windstorm-wpi-8\/ongoing/.test(mine.addendum_text) && /Pay: \$175\.00 per job, one flat amount\./.test(mine.addendum_text),
    mine.addendum_text.split("\n").join(" | "),
  );
  check("step 4: unsigned, it pays nothing", (await db.query(`select * from eng_line_pay('windstorm-wpi-8/ongoing')`)).rows.length === 0);
  const s4 = await door(ongoing);
  check("and the door refuses ongoing", typeof s4 === "string", String(s4));
  const notYet = await refused(`select eng_put_signed_protocol_in_force($1, $2, $3::jsonb)`, [WP_ACT, LIC, ITEMS]);
  check("and WP-001 is still held", notYet.refused);

  /* 5. Signed: WP-001 goes in force for ongoing only. */
  await signAddendum(mine);
  const pay = (await db.query(`select * from eng_line_pay('windstorm-wpi-8/ongoing')`)).rows;
  check("step 5: signed, it pays $175.00 per job", pay.length === 1 && Number(pay[0].pay_cents) === 17500, JSON.stringify(pay));
  const inForce = await db.query(`select eng_put_signed_protocol_in_force($1, $2, $3::jsonb) as r`, [WP_ACT, LIC, ITEMS]);
  check("and WP-001's existing signature now puts it in force", inForce.rows[0].r === "in_force", inForce.rows[0].r);
  check("WS-001 is still in force: approving WP-001 retired nothing on completed", (await statusOf(WS)) === "published" && (await statusOf(WP)) === "published");
  check("completed construction is orderable", (await door(completed)) === null, String(await door(completed)));
  check("and ongoing construction now opens at its door", (await door(ongoing)) === null, String(await door(ongoing)));

  /* 6. A replacement, drafted and not signed, closes it again: the newest decides. */
  await insertPerJob("windstorm-wpi-8/ongoing", 20000);
  const s6 = await door(ongoing);
  check("step 6: a newer addendum not yet signed shuts ongoing again", NOT_YET.test(String(s6)), String(s6));
  check("and completed construction is still orderable", (await door(completed)) === null);
} finally {
  await rest.close();
}

/* The shape check, both ways. */
const perJobWithFee = await refused(
  `insert into eng_scope_addenda (deliverable, engineer_id, scope, fee_cents, share_bp, pay_cents, basis)
   values ('windstorm-wpi-8/ongoing', $1, 'x', 17500, 10000, 17500, 'per_job')`,
  [ENG],
);
check("a per_job addendum carrying a fee and a share is refused", perJobWithFee.refused, perJobWithFee.message.slice(0, 80));
const designWithoutQuote = await refused(
  `insert into eng_scope_addenda (deliverable, engineer_id, scope, fee_cents, share_bp, pay_cents)
   values ('residential-light-commercial-design/custom', $1, 'x', 200000, 3500, 70000)`,
  [ENG],
);
check("a design addendum with no quote is still refused", designWithoutQuote.refused, designWithoutQuote.message.slice(0, 80));
const badKey = await refused(
  `insert into eng_scope_addenda (deliverable, engineer_id, scope, pay_cents, basis) values ('not a key', $1, 'x', 100, 'per_job')`,
  [ENG],
);
check("and a per_job addendum names a deliverable key", badKey.refused);
const editAddendum = await refused(`update eng_scope_addenda set pay_cents = 1 where basis = 'per_job'`);
check("an addendum still cannot be edited", editAddendum.refused);

/* A single-protocol line still retires its earlier version (tier null matches null). */
const A1 = "00000000-0000-4000-8000-0000000009c1";
const A2 = "00000000-0000-4000-8000-0000000009c2";
await db.exec(`
  insert into eng_protocol_templates (id, service_slug, name, version, status) values
    ('${A1}', 'proof-single-line', 'Proof v1', 1, 'draft'),
    ('${A2}', 'proof-single-line', 'Proof v2', 2, 'draft');
  update eng_protocol_templates set status = 'awaiting_engineer' where id in ('${A1}', '${A2}');
`);
await db.query(`select eng_approve_protocol($1, $2, $3, $4::jsonb)`, [A1, ENG, LIC, ITEMS]);
await db.query(`select eng_approve_protocol($1, $2, $3, $4::jsonb)`, [A2, ENG, LIC, ITEMS]);
check("a line with one protocol still retires the earlier version on approval", (await statusOf(A1)) === "retired" && (await statusOf(A2)) === "published");

const exec = (await db.query(
  `select has_function_privilege('anon', 'public.eng_line_pay(text)', 'EXECUTE') as anon,
          has_function_privilege('authenticated', 'public.eng_line_pay(text)', 'EXECUTE') as authed`,
)).rows[0];
check("nobody signed out or signed in as a customer can call eng_line_pay", !exec.anon && !exec.authed);
await db.close();

console.log("");
if (wrong === 0) {
  console.log("PASS: WPI-8 ongoing opens only on its own signed addendum, and completed construction stays orderable at every step.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
