/**
 * A PORTAL SIGNATURE PUTS ITS PROTOCOL IN FORCE, ONCE FOR WHAT IS ALREADY
 * SIGNED AND IN THE SIGNING TRANSACTION AFTER THAT, AND A VOIDING CLOSES IT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-signature-puts-its-protocol-in-force.mjs
 *
 * Operator rulings of 2026-10-22, migration 0081:
 *   - signing in the portal makes the protocol the one in force;
 *   - signatures already on record go in force once, inside 0081, and the
 *     read-back names each protocol's outcome and reason;
 *   - after that, signing puts it in force in the signing transaction and
 *     voiding closes it the same way; nothing runs on a timer;
 *   - 254-WP-001 stays deferred; `voided` is a status;
 *   - a sealed letter records the checksum of the mark at its head.
 *
 * WHERE IT RUNS. In an in-process Postgres (PGlite) with every migration
 * replayed, the way a-decision-and-its-credit-are-one-write.mjs runs, so the
 * real functions run on the real schema and nothing touches development. The
 * signatures made "before 0081" are made with 0062's function on the chain as
 * it stood at 0080, and then 0081 is applied, which is what the production
 * sitting does.
 *
 * WHAT IT IS NOT. The signer here carries the register's licence number so the
 * backfill's licence check can pass; this database is thrown away when the
 * proof exits, and no account, signature or seal image exists anywhere else.
 */
import { PGlite } from "@electric-sql/pglite";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { SIGNABLE_PROTOCOLS, HELD_OUT_OF_FORCE } = await import("../../src/content/protocols/signable.ts");
const { signedProtocolItemRows } = await import("../../src/lib/protocol-run.ts");
const { PROTOCOL_ENTRIES } = await import("../../src/content/protocols/index.ts");
const { verifiedEngineers } = await import("../../src/config/credentials.ts");

const DIR_FOR_GEN = "supabase/migrations";
const digestOf = (doc, version) => {
  const p = SIGNABLE_PROTOCOLS.find((r) => r.documentNumber === doc && r.version === version);
  return createHash("sha256").update(p.text.join("\n"), "utf8").digest("hex");
};

/*
 * PUTTING IN FORCE REGISTERS NOTHING. The registry is what public pages and
 * order forms read; a signature seeds items from the structured declaration
 * (src/content/protocols/structured.ts). Asserted so a later change that
 * registers a line on the way through has to remove this line on purpose.
 */
check(
  "the protocol registry holds 254-RC-001 alone, so nothing here changes a page or an order form",
  PROTOCOL_ENTRIES.length === 1 && PROTOCOL_ENTRIES[0].declaration.documentNumber === "254-RC-001",
  PROTOCOL_ENTRIES.map((p) => p.declaration.documentNumber).join(", "),
);

/*
 * SECTION 7 IS WHAT THE CODE SAYS TODAY. The backfill carries each protocol's
 * digest and items as they were when it was generated; a transcription or a
 * checklist changed afterwards would leave the sitting judging signatures
 * against an old text. So the generator is run here in print mode and its
 * output must equal the region in 0081, byte for byte.
 */
{
  const { spawnSync } = await import("node:child_process");
  const { readFileSync } = await import("node:fs");
  const gen = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "--conditions=react-server", "scripts/emit-signed-protocols-backfill.mjs"],
    { encoding: "utf8" },
  );
  const text = readFileSync(join(DIR_FOR_GEN, "0081_a_signature_puts_its_protocol_in_force.sql"), "utf8");
  const a = text.indexOf("-- BEGIN GENERATED");
  const z = text.indexOf("-- END GENERATED");
  const region = a >= 0 && z > a ? text.slice(a, z + "-- END GENERATED".length) : "";
  check(
    "0081's section 7 is exactly what the generator writes from the code today",
    gen.status === 0 && region !== "" && gen.stdout.trimEnd() === region,
    gen.status !== 0 ? gen.stderr.slice(0, 120) : region === "" ? "no generated region" : gen.stdout.trimEnd() === region ? "identical" : "STALE: regenerate with --write",
  );
}

/* ------------------------------------------- the chain as it stood at 0080 */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const before = files.filter((f) => f < "0081_");
const m0081 = files.find((f) => f.startsWith("0081_"));
for (const f of before) await db.exec(readSource(join(DIR, f)));
check("the chain replays to 0080, and 0081 is the next file", Boolean(m0081) && before.at(-1).startsWith("0080_"), `${before.length} files, then ${m0081}`);

const ENG = "00000000-0000-4000-8000-0000000000e1";
const SEAL = "00000000-0000-4000-8000-0000000000e2";
const SIG = "00000000-0000-4000-8000-0000000000e3";
const licence = verifiedEngineers[0].licenseNumber;
const h64 = "0".repeat(64);
await db.exec(`
  insert into auth.users (id) values ('${ENG}');
  insert into eng_profiles (id, email, display_name, role, license_number)
    values ('${ENG}', 'sign-proof@audit-probe.invalid', 'Signing proof engineer, not a real person', 'engineer', '${licence}');
  insert into eng_seal_images (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at)
    values ('${SEAL}', '${ENG}', 'seal', 'proof/seal.png', '${h64}', 1, 1, 1, now()),
           ('${SIG}', '${ENG}', 'signature', 'proof/sig.png', '${h64}', 1, 1, 1, now());
`);

async function signOld(doc, version, sha) {
  const id = randomUUID();
  await db.query(
    "select eng_record_protocol_signature($1, $2, $3, $4, $5, $6, $7, now())",
    [id, doc, version, sha, ENG, SEAL, SIG],
  );
  return id;
}
const template = async (doc, version) =>
  (
    await db.query(
      "select id, status, signed_by_seal_act_id, document_signed_at, approved_by, approved_by_license, published_at from eng_protocol_templates where document_number = $1 and version_label = $2",
      [doc, version],
    )
  ).rows[0];
const itemCount = async (id) => Number((await db.query("select count(*)::int as n from eng_protocol_items where template_id = $1", [id])).rows[0].n);

/* ---------------------------------------- 1. signatures made before 0081 */

const VALID = ["254-SL-001", "1.1"];
const STALE = ["254-MH-001", "1.1"];
const VOIDED = ["254-PL-001", "1.1"];
const HELD = ["254-WP-001", "1.2"];
const validAct = await signOld(...VALID, digestOf(...VALID));
await signOld(...STALE, "f".repeat(64));
const voidedAct = await signOld(...VOIDED, digestOf(...VOIDED));
await db.query("select eng_void_seal_act($1, $2, $3)", [voidedAct, ENG, "Proof: voided before 0081."]);
const heldAct = await signOld(...HELD, digestOf(...HELD));

/* A letter sealed before 0081, through 0062's door, with no letterhead checksum: 0081 must leave it voidable. */
const CLIENT = "00000000-0000-4000-8000-0000000000c1";
const FILE = "00000000-0000-4000-8000-0000000000f1";
const DET_OLD = "00000000-0000-4000-8000-0000000000d1";
const DET_NEW = "00000000-0000-4000-8000-0000000000d2";
const LETTER_OLD = "00000000-0000-4000-8000-0000000000a1";
await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Signing proof client, not a real person');
  insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status)
    values ('${FILE}', '254-PROOF-SIGN', '${CLIENT}', 'roof-inspections', 'standard', '1 Proof Way', 'Nueces', 'under_review');
  insert into eng_determinations (id, file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, engineer_id)
    values ('${DET_OLD}', '${FILE}', '254-RC-001', 'pass', array['probe'], array['00000000-0000-4000-8000-0000000000e9'::uuid], '${ENG}'),
           ('${DET_NEW}', '${FILE}', '254-RC-001', 'pass', array['probe'], array['00000000-0000-4000-8000-0000000000e9'::uuid], '${ENG}');
`);
await db.query(
  "select eng_record_letter_seal($1::uuid, $2::uuid, $3::uuid, null::uuid, 'Proof letter, before 0081', 'proof/old.pdf', 4096::bigint, $4, 'F-29811', $5::uuid, $6::uuid, $7::uuid, $8::uuid, now())",
  [LETTER_OLD, randomUUID(), FILE, h64, DET_OLD, ENG, SEAL, SIG],
);
{
  /* The column 0081 adds does not exist yet, so this reads the status alone. */
  const { rows } = await db.query(
    "select status from eng_protocol_templates where document_number = $1 and version_label = $2",
    VALID,
  );
  check("before 0081 a portal signature leaves its protocol a draft", rows[0]?.status === "draft", rows[0]?.status);
}

/* ------------------------------------------------------- 2. apply 0081 once */

await db.exec(readSource(join(DIR, m0081)));
check("0081 applies on top of signatures already on record", true, m0081);

{
  const t = await template(...VALID);
  const expected = signedProtocolItemRows(...VALID)?.length ?? -1;
  check(
    "a live signature whose digest is the transcription in code went in force at 0081",
    t.status === "published" && t.signed_by_seal_act_id === validAct && t.document_signed_at !== null &&
      t.approved_by === ENG && t.approved_by_license === licence && t.published_at !== null,
    `${VALID.join(" v")}: ${t.status}`,
  );
  check("and its checklist was seeded from the declaration he signed, item for item", (await itemCount(t.id)) === expected, `${await itemCount(t.id)} of ${expected}`);
}
check("a signature that no longer covers the text did not", (await template(...STALE)).status === "draft");
check("a voided signature did not", (await template(...VOIDED)).status === "draft");
check("254-WP-001, held out of force by ruling, did not, though its signature is valid", (await template(...HELD)).status === "draft" && Boolean(HELD_OUT_OF_FORCE["254-WP-001"]));

{
  const events = (
    await db.query("select diff from eng_audit_events where action = 'protocol.in_force_at_0081' order by diff->>'document'")
  ).rows.map((r) => r.diff);
  const covered = SIGNABLE_PROTOCOLS.filter((p) => !HELD_OUT_OF_FORCE[p.documentNumber]).length;
  const byDoc = Object.fromEntries(events.map((e) => [e.document, e]));
  check("the read-back names every protocol 0081 covers, once each", events.length === covered, `${events.length} of ${covered}`);
  check("and says why each went in force or did not",
    byDoc["254-SL-001"]?.outcome === "in_force" &&
      /digest does not cover|does not cover the transcription/.test(byDoc["254-MH-001"]?.why ?? "") &&
      /no live signature/.test(byDoc["254-PL-001"]?.why ?? ""),
    events.map((e) => `${e.document} ${e.outcome}`).join("; "));
  check("and 254-WP-001 is not among them", !byDoc["254-WP-001"]);
}

/* ------------------------------- 3. after 0081, signing is putting in force */

{
  const doc = ["254-RS-001", "1.1"];
  const items = signedProtocolItemRows(...doc);
  const act = randomUUID();
  const r = await db.query(
    "select eng_record_protocol_signature($1, $2, $3, $4, $5, $6, $7, now(), $8, $9::jsonb) as r",
    [act, doc[0], doc[1], digestOf(...doc), ENG, SEAL, SIG, licence, JSON.stringify(items)],
  );
  const t = await template(...doc);
  check("signing puts the protocol in force in the same call", r.rows[0].r === "in_force" && t.status === "published" && t.signed_by_seal_act_id === act, `${r.rows[0].r}, ${t.status}`);
  check("with its items", (await itemCount(t.id)) === items.length, `${items.length}`);

  /* One live signature per protocol version (0062), so the earlier one is voided first. */
  await db.query("select eng_void_seal_act($1, $2, $3)", [heldAct, ENG, "Proof: re-signed after 0081."]);
  const held = randomUUID();
  const w = await db.query(
    "select eng_record_protocol_signature($1, $2, $3, $4, $5, $6, $7, now(), $8, null) as r",
    [held, HELD[0], HELD[1], digestOf(...HELD), ENG, SEAL, SIG, licence],
  );
  check("a signature with no items is recorded and puts nothing in force (254-WP-001)", w.rows[0].r === "signed" && (await template(...HELD)).status === "draft");
}

{
  /* A put-in-force that fails takes the signature with it: one transaction. */
  const doc = ["254-DS-001", "1.1"];
  const act = randomUUID();
  let refused = "";
  try {
    await db.query(
      "select eng_record_protocol_signature($1, $2, $3, $4, $5, $6, $7, now(), $8, '[]'::jsonb)",
      [act, doc[0], doc[1], digestOf(...doc), ENG, SEAL, SIG, licence],
    );
  } catch (e) {
    refused = e.message;
  }
  const left = Number((await db.query("select count(*)::int as n from eng_seal_acts where id = $1", [act])).rows[0].n);
  check("a refused put-in-force leaves no signature behind", refused !== "" && left === 0, refused.slice(0, 90));
}

/*
 * ---------------- 3b. 254-WP-001 is held out AT THE DATABASE, operator review 2026-10-22
 * Null items is accepted for the held protocol alone and refused for every
 * other; the put-in-force door refuses the held protocol whatever it is handed;
 * and the list the database holds is the list the code holds.
 */
{
  const doc = ["254-DS-001", "1.1"];
  const act = randomUUID();
  let refused = "";
  try {
    await db.query(
      "select eng_record_protocol_signature($1, $2, $3, $4, $5, $6, $7, now(), $8, null)",
      [act, doc[0], doc[1], digestOf(...doc), ENG, SEAL, SIG, licence],
    );
  } catch (e) {
    refused = e.message;
  }
  const left = Number((await db.query("select count(*)::int as n from eng_seal_acts where id = $1", [act])).rows[0].n);
  check(
    "a signature with no items is refused for any protocol but the held one, and leaves no signature",
    /signed with its items/.test(refused) && left === 0,
    refused.slice(0, 80),
  );

  /* The held protocol's live signature from section 3, handed to the put-in-force door with real items. */
  const heldLive = (
    await db.query(
      "select id from eng_seal_acts where kind = 'protocol' and protocol_document = $1 and voided_at is null",
      [HELD[0]],
    )
  ).rows[0]?.id;
  let held = "";
  try {
    await db.query("select eng_put_signed_protocol_in_force($1, $2, $3::jsonb)", [
      heldLive,
      licence,
      JSON.stringify(signedProtocolItemRows("254-WS-001", "1.1")),
    ]);
  } catch (e) {
    held = e.message;
  }
  check(
    "and the put-in-force door refuses 254-WP-001 whatever it is handed",
    Boolean(heldLive) && /held out of force/.test(held) && (await template(...HELD)).status === "draft",
    held.slice(0, 80),
  );

  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(join(DIR, m0081), "utf8");
  const lists = [...sql.matchAll(/protocol_document in \(([^)]*)\)/g)].map((m) =>
    m[1].split(",").map((s) => s.trim().replace(/^'|'$/g, "")).sort().join(","),
  );
  const code = Object.keys(HELD_OUT_OF_FORCE).sort().join(",");
  check(
    "and the database holds out exactly the protocols the code does, in both places it asks",
    lists.length === 2 && lists.every((l) => l === code),
    `database ${lists.join(" | ")}, code ${code}`,
  );
}

/* ----------------------------------------------- 4. voiding closes it */

{
  await db.query("select eng_void_seal_act($1, $2, $3)", [validAct, ENG, "Proof: voided after it went in force."]);
  const t = await template(...VALID);
  check("voiding the signature moves its protocol to voided, in the voiding's transaction", t.status === "voided", t.status);
  let frozen = "";
  try {
    await db.query("update eng_protocol_items set label = label || ' edited' where template_id = $1", [t.id]);
  } catch (e) {
    frozen = e.message;
  }
  check("and its items stay what he signed", /fixed/.test(frozen), frozen.slice(0, 80));
  let again = "";
  try {
    await db.query("select eng_put_signed_protocol_in_force($1, $2, '[]'::jsonb)", [validAct, licence]);
  } catch (e) {
    again = e.message;
  }
  check("and a voided signature puts nothing back in force", /voided/.test(again), again.slice(0, 80));
}

/* --------------------------------------- 5. the letterhead's record */

{
  const fns = (
    await db.query("select p.oid::regprocedure::text as sig from pg_proc p where p.proname = 'eng_record_letter_seal'")
  ).rows.map((r) => r.sig);
  check("the letter-sealing function that takes the letterhead checksum exists", fns.some((s) => /timestamp with time zone,\s*text\)$/.test(s)), fns.join("; "));
  let oldLetter = "";
  try {
    await db.query(
      "select eng_record_letter_seal($1::uuid, $2::uuid, null::uuid, null::uuid, 't', 'k', 1::bigint, $3, 'F', null::uuid, $4::uuid, $5::uuid, $6::uuid, now())",
      [randomUUID(), randomUUID(), h64, ENG, SEAL, SIG],
    );
  } catch (e) {
    oldLetter = e.message;
  }
  check("and 0062's version without it refuses", /checksum of the mark/.test(oldLetter), oldLetter.slice(0, 80));
  /*
   * ENFORCED AT INSERT, operator review of 2026-10-22: a NOT VALID check would
   * pass a null. A null checksum is refused, a valid one seals, and a letter
   * sealed before 0081 with none can still be voided.
   */
  const sealNew = (act, sha) =>
    db.query(
      "select eng_record_letter_seal($1::uuid, $2::uuid, $3::uuid, null::uuid, 'Proof letter', $4, 4096::bigint, $5, 'F-29811', $6::uuid, $7::uuid, $8::uuid, $9::uuid, now(), $10)",
      [act, randomUUID(), FILE, `proof/${act}.pdf`, h64, DET_NEW, ENG, SEAL, SIG, sha],
    );
  let nullRefused = "";
  const nullAct = randomUUID();
  try {
    await sealNew(nullAct, null);
  } catch (e) {
    nullRefused = e.message;
  }
  const nullLeft = Number((await db.query("select count(*)::int as n from eng_seal_acts where id = $1", [nullAct])).rows[0].n);
  check(
    "a letter sealed with a null letterhead checksum is refused at insert, and leaves nothing",
    /mark at its head/.test(nullRefused) && nullLeft === 0,
    nullRefused.slice(0, 80),
  );
  let badRefused = "";
  try {
    await sealNew(randomUUID(), "not-a-digest");
  } catch (e) {
    badRefused = e.message;
  }
  check("and so is one that is not a SHA-256", /mark at its head/.test(badRefused), badRefused.slice(0, 80));
  let sealed = "";
  try {
    await sealNew(randomUUID(), "a".repeat(64));
  } catch (e) {
    sealed = e.message;
  }
  check("while one carrying the checksum seals", sealed === "", sealed.slice(0, 80) || "sealed");
  let voidOld = "";
  try {
    await db.query("select eng_void_seal_act($1, $2, $3)", [LETTER_OLD, ENG, "Proof: a letter sealed before 0081 is still voidable."]);
  } catch (e) {
    voidOld = e.message;
  }
  const oldRow = (await db.query("select voided_at is not null as voided, letterhead_sha256 from eng_seal_acts where id = $1", [LETTER_OLD])).rows[0];
  check(
    "and a letter sealed before 0081, with no checksum, can still be voided",
    voidOld === "" && oldRow?.voided === true && oldRow?.letterhead_sha256 === null,
    voidOld.slice(0, 80) || "voided",
  );
  const sigFns = (
    await db.query("select p.oid::regprocedure::text as sig from pg_proc p where p.proname = 'eng_record_protocol_signature'")
  ).rows.map((r) => r.sig);
  check("the protocol-signing function that puts in force exists", sigFns.some((s) => /text,\s*jsonb\)$/.test(s)), sigFns.join("; "));
  let oldSign = "";
  try {
    await db.query("select eng_record_protocol_signature($1::uuid, 'x', '1', $2, $3::uuid, $4::uuid, $5::uuid, now())", [randomUUID(), h64, ENG, SEAL, SIG]);
  } catch (e) {
    oldSign = e.message;
  }
  check("and 0062's version that put nothing in force refuses", /since 0081/.test(oldSign), oldSign.slice(0, 80));
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a signature puts its protocol in force, once for what was signed before 0081 and in the signing transaction after it, and a voiding closes it.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
