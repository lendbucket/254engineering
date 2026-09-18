/**
 * SEED 254-RC-001 INTO THE PLATFORM, AWAITING ITS ENGINEER.
 *
 *   npx tsx --conditions=react-server scripts/seed-roof-protocol.mjs
 *   npx tsx --conditions=react-server scripts/seed-roof-protocol.mjs --apply
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
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { auditClient } from "./lib/db-target.mjs";

const APPLY = process.argv.includes("--apply");

const { RC001 } = await import("../src/content/protocols/rc-001.ts");

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

const row = {
  service_slug: RC001.serviceSlug,
  name: RC001.title,
  version: 1,
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

if (!APPLY) {
  console.log("DRY RUN. Nothing was written. Re-run with --apply to insert the row.");
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
