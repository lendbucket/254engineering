/**
 * SEED 254-RC-001 INTO THE PLATFORM, AWAITING ITS ENGINEER.
 *
 *   npx tsx --conditions=react-server scripts/seed-roof-protocol.mjs
 *   npx tsx --conditions=react-server scripts/seed-roof-protocol.mjs --apply
 *   npx tsx --conditions=react-server scripts/seed-roof-protocol.mjs --emit-sql
 *
 * ===========================================================================
 * --emit-sql IS THE FOURTH ROUTE, AND IT EXISTS BECAUSE OF THE GUARD BELOW.
 * Operator ruling, 2026-09-21.
 * ===========================================================================
 *
 * This script carries `neverProduction`, checked before `ALLOW_PRODUCTION_DB`
 * is even read, so it cannot write the production row and that guard is not
 * being weakened to let it. The other production route is `apply_migration`
 * through the Supabase MCP, which takes SQL rather than a client.
 *
 * So the digest check moves to where it can still run: `--emit-sql` hashes the
 * PDF exactly as `--apply` does, refuses on any difference, opens NO database
 * connection at all, and writes the migration. **The literal in the migration
 * is rendered from the same `row` object the insert uses**, so the two routes
 * cannot state different facts about the same document.
 *
 * WHAT A MIGRATION CANNOT DO, STATED RATHER THAN GLOSSED. Postgres cannot hash
 * a PDF. Once the SQL is on disk its digest is a literal like any other, and
 * nothing in the file re-derives it. That is the hole `protocol-registry-audit`
 * closes from the other side: it reads the digest OUT of 0055 and asserts it
 * equals both the file on disk and the registry, so a hand edited migration
 * goes red naming the three values.
 *
 * WHAT THIS SEEDS IS PROVENANCE, NOT AN APPROVAL. Operator ruling, 2026-09-16.
 * The row lands in `awaiting_engineer`: the engineer has signed the document,
 * and has not approved it in the platform. 0049's constraints mean such a row
 * can carry no approver, no approval time and no publication date, so this
 * script COULD NOT forge an approval even if somebody edited it to try.
 *
 * THE DIGEST IS CHECKED BEFORE ANYTHING IS WRITTEN, AND A MISMATCH REFUSES.
 * A protocol record pointing at a document that is not the one Aman signed is
 * the worst version of this: every question, checklist item and decision rule
 * in the portal would trace to a numbered place in a file nobody signed, and
 * the record would look complete. So the PDF on disk is hashed here and
 * compared against the digest the declaration carries, and the run stops on any
 * difference rather than writing a row that names the wrong document.
 *
 * DRY BY DEFAULT. It prints what it would write and changes nothing without
 * --apply, which is the same shape copy-project.mjs uses and for the same
 * reason: the first run of anything that writes should be readable.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { auditClient } from "./lib/db-target.mjs";

const APPLY = process.argv.includes("--apply");
const EMIT_SQL = process.argv.includes("--emit-sql");

/**
 * The migration this script writes.
 *
 * NOT EXPORTED FOR THE AUDIT TO READ, deliberately. Importing this module runs
 * it, and an audit that imported the writer to learn where it writes would be
 * an audit that can write. `protocol-registry-audit` DERIVES its subject
 * instead, by scanning every migration for one that inserts this document
 * number, which also catches a SECOND migration nobody meant to write.
 */
const EMITTED_MIGRATION = "supabase/migrations/0055_the_signed_roof_protocol_awaits_its_engineer.sql";

const { RC001, RC001_VERSIONS } = await import("../src/content/protocols/rc-001.ts");

console.log("");
console.log("========== SEED 254-RC-001, AWAITING ITS ENGINEER ==========");
console.log("");

/* ------------------------------------------- the document, before anything */

let bytes;
try {
  bytes = readFileSync(RC001.sourceFile);
} catch {
  console.error(`STOP: the declaration names ${RC001.sourceFile} and it is not on disk.`);
  process.exit(1);
}

const sha256 = createHash("sha256").update(bytes).digest("hex");
console.log(`document   ${RC001.sourceFile}`);
console.log(`declared   ${RC001.sourceSha256}`);
console.log(`on disk    ${sha256}`);

if (sha256 !== RC001.sourceSha256) {
  console.error("");
  console.error("STOP. The file on disk is not the document this declaration was transcribed from.");
  console.error("");
  console.error("Nothing is written. A protocol record pointing at a document the engineer did not");
  console.error("sign would make every question and checklist item in the portal trace to a numbered");
  console.error("place in the wrong file, and the record would look complete while being false.");
  console.error("");
  console.error("Either the PDF was replaced, in which case the declaration must be re-transcribed and");
  console.error("re-proved against it, or the digest in the declaration is wrong.");
  process.exit(1);
}
console.log("digest agrees, so the record may name this document\n");

/* ------------------------------------------------------ what would be written */

/*
 * ===========================================================================
 * THE INTEGER VERSION IS THE PLATFORM'S SEQUENCE AND IT WAS HARDCODED TO 1.
 * Found 2026-09-21, before this script had ever been run for a second version.
 * ===========================================================================
 *
 * `eng_protocol_templates` carries `unique (service_slug, version)`, and
 * `createProtocol` in src/lib/ops-field.ts computes the next one as
 * `max(version) + 1` for that service line. Every reader orders by it
 * descending to find the current protocol. So the INTEGER is the platform's
 * sequence per service line, and `version_label` is the document's own label.
 *
 * This line said `version: 1`, which was true while v1.0 was the only document
 * that existed. **Development already holds roof-inspections version 1 at
 * v1.0**, so emitting v1.1 as version 1 produces a unique violation there, and
 * on production, where no row exists, it would have SUCCEEDED and written v1.1
 * as the first version of a line whose first version is v1.0. The two projects
 * would then disagree about the same document, which is the divergence the
 * ledger exists to prevent.
 *
 * Derived from RC001_VERSIONS, which is the declared order of issue, so a v1.2
 * gets 3 without anybody counting rows.
 */
const versionIndex = RC001_VERSIONS.findIndex((v) => v.version === RC001.version);
if (versionIndex < 0) {
  console.error("");
  console.error(`STOP: RC001.version is ${RC001.version} and RC001_VERSIONS does not list it.`);
  console.error("The declaration disagrees with its own version history, so the sequence number");
  console.error("this row would take cannot be derived. Nothing is written.");
  process.exit(1);
}

const row = {
  service_slug: RC001.serviceSlug,
  name: RC001.title,
  version: versionIndex + 1,
  version_label: RC001.version,
  status: "awaiting_engineer",
  summary: `${RC001.documentNumber} v${RC001.version}, signed ${RC001.issueDate} by ${RC001.approvedBy}. Awaiting approval in the platform.`,
  document_number: RC001.documentNumber,
  issue_date: RC001.issueDate,
  document_sha256: RC001.sourceSha256,
  firm_name_on_document: RC001.firmNameOnDocument,
  requires_discipline: RC001.requiresDiscipline,
  document_signed_at: RC001.issueDate,
  /*
   * Deliberately absent, and the database refuses them in this state anyway:
   * approved_by, approved_at, approved_by_license, published_at.
   */
};

for (const [k, v] of Object.entries(row)) console.log(`  ${k.padEnd(22)} ${v === null ? "(null)" : v}`);
console.log("");
console.log("  NOT written, and refused by 0049 in this state: approved_by, approved_at,");
console.log("  approved_by_license, published_at. The approval is Aman's act in his own session.");
console.log("");

if (RC001.requiresDiscipline === null) {
  console.log("NOTE: requires_discipline is null, so this line stays blocked until the engineer");
  console.log("states which discipline 254-RC-001 requires. That is deliberate and is not an error.");
  console.log("");
}

/* ------------------------------------------------- the migration, no database */

/**
 * A SQL literal for one of this row's values.
 *
 * Single quotes are doubled rather than backslash escaped, because the
 * backslash form is a PostgreSQL extension that depends on a runtime setting
 * and the doubled form is the standard one. Nothing in this row carries a
 * quote today; the escape is here so that a future title with an apostrophe in
 * it is a correct migration rather than a syntax error somebody debugs at a
 * production keyboard.
 */
function sqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

if (EMIT_SQL) {
  if (APPLY) {
    console.error("STOP: --emit-sql writes a file and --apply writes a row. Run one or the other.");
    process.exit(1);
  }

  const columns = Object.keys(row);
  const values = columns.map((c) => sqlLiteral(row[c]));

  const sql = `/*
 * ===========================================================================
 * 0055  254-RC-001 v${RC001.version} ENTERS THE PLATFORM, AWAITING ITS ENGINEER.
 * ===========================================================================
 *
 * GENERATED BY scripts/seed-roof-protocol.mjs --emit-sql. Do not hand edit.
 * The generator hashes ${RC001.sourceFile}
 * and refuses to write anything if the digest disagrees with the registry.
 * \`protocol-registry-audit\` reads the digest back OUT of this file and
 * asserts it equals both the PDF on disk and the registry, so a hand edit
 * turns the board red naming all three values.
 *
 * WHAT THIS SEEDS IS PROVENANCE, NOT AN APPROVAL. Operator ruling, 2026-09-16,
 * restated because a migration is read by somebody who has not read the script.
 * The row lands in 'awaiting_engineer': the engineer has signed the DOCUMENT
 * and has not approved it in the PLATFORM. 0049's constraints mean a row in
 * that state can carry no approver, no approval time and no publication date,
 * so this migration could not forge an approval even if somebody edited it to
 * try. The approval is an act by a named engineer in his own session, through
 * \`eng_approve_protocol\`, and it is what seeds the 51 checklist items.
 *
 * THE INTEGER version IS ${row.version}, NOT 1. \`unique (service_slug, version)\`
 * makes it the platform's sequence for this service line, and v1.0 is version
 * 1 already. version_label carries the document's own label.
 *
 * requires_discipline IS NULL ON PURPOSE. Whether a roof certification is
 * structural work is the engineer's answer rather than a reading of the word
 * "roof", and roof-inspections stays a waitlist until he states it in writing.
 *
 * v1.0 IS NOT INSERTED. Operator ruling, 2026-09-21: RC001_VERSIONS in
 * src/content/protocols/rc-001.ts is the record Section 13 requires of every
 * issued version, and this table is not a second copy of it.
 */

/*
 * ASSERT THE TARGET BEFORE WRITING, the idiom 0049 and 0052 both use.
 *
 * A row already naming this document at this version label, with a DIFFERENT
 * digest, means somebody has to decide which document this protocol is. That
 * is not a decision a migration may make quietly, so it raises instead.
 */
do $$
declare
  wrong integer;
begin
  select count(*) into wrong
  from eng_protocol_templates
  where document_number = ${sqlLiteral(row.document_number)}
    and version_label   = ${sqlLiteral(row.version_label)}
    and document_sha256 is distinct from ${sqlLiteral(row.document_sha256)};
  if wrong > 0 then
    raise exception
      'eng: % row(s) already record % v% under a different document digest. Somebody must decide which document this protocol is.',
      wrong, ${sqlLiteral(row.document_number)}, ${sqlLiteral(row.version_label)};
  end if;
end;
$$;

insert into eng_protocol_templates (
  ${columns.join(", ")}
)
select
  ${values.join(", ")}
where not exists (
  select 1 from eng_protocol_templates
  where document_number = ${sqlLiteral(row.document_number)}
    and version_label   = ${sqlLiteral(row.version_label)}
);

/*
 * AND ASSERT WHAT WE JUST DID, because an insert guarded by NOT EXISTS is
 * silent about whether it inserted. Exactly one row names this document at
 * this version label when this migration finishes, or the transaction rolls
 * back and says so.
 */
do $$
declare
  n integer;
begin
  select count(*) into n
  from eng_protocol_templates
  where document_number = ${sqlLiteral(row.document_number)}
    and version_label   = ${sqlLiteral(row.version_label)};
  if n <> 1 then
    raise exception 'eng: % row(s) record % v% and exactly one is required.',
      n, ${sqlLiteral(row.document_number)}, ${sqlLiteral(row.version_label)};
  end if;
end;
$$;
`;

  const existed = existsSync(EMITTED_MIGRATION);
  writeFileSync(EMITTED_MIGRATION, sql, "utf8");
  console.log(`${existed ? "REWROTE" : "WROTE"} ${EMITTED_MIGRATION}`);
  console.log(`${sql.split("\n").length} lines, digest literal ${row.document_sha256}`);
  console.log("");
  console.log("No database connection was opened. Nothing was applied anywhere.");
  process.exit(0);
}

if (!APPLY) {
  console.log("DRY RUN. Nothing was written. Re-run with --apply to insert the row,");
  console.log("or --emit-sql to write the migration that carries it to production.");
  process.exit(0);
}

/* ---------------------------------------------------------------- the write */

const db = auditClient("seed-roof-protocol", { neverProduction: true });
if (!db) {
  console.error("STOP: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set.");
  process.exit(1);
}

const { data: existing, error: readErr } = await db
  .from("eng_protocol_templates")
  .select("id, status, document_sha256")
  .eq("document_number", RC001.documentNumber)
  .eq("version_label", RC001.version);
if (readErr) {
  console.error(`STOP: could not read eng_protocol_templates: ${readErr.message}`);
  process.exit(1);
}

if ((existing ?? []).length > 0) {
  const found = existing[0];
  console.log(`${RC001.documentNumber} v${RC001.version} is already recorded (${found.id}), status ${found.status}.`);
  if (found.document_sha256 !== RC001.sourceSha256) {
    console.error("");
    console.error("STOP: the recorded row names a DIFFERENT document digest than the file on disk.");
    console.error(`  row  ${found.document_sha256}`);
    console.error(`  disk ${RC001.sourceSha256}`);
    console.error("Nothing is changed. Somebody must decide which document this protocol is.");
    process.exit(1);
  }
  console.log("Its digest matches. Nothing to do.");
  process.exit(0);
}

const { data: inserted, error } = await db
  .from("eng_protocol_templates")
  .insert(row)
  .select("id, status")
  .single();
if (error) {
  console.error(`STOP: the insert was refused: ${error.message}`);
  process.exit(1);
}

console.log(`Written: ${inserted.id}, status ${inserted.status}.`);
console.log("Nothing is approved. The protocols launch condition is unchanged.");
