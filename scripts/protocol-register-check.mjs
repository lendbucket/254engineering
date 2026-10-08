/**
 * LAYER TWO: THE REGISTER AGAINST THE ROW.
 *
 *   ALLOW_PRODUCTION_DB=1 npx tsx scripts/protocol-register-check.mjs
 *
 * ===========================================================================
 * WHY THIS IS A SCRIPT THE OPERATOR RUNS AND NOT A QUERY A SESSION TYPES.
 * Operator ruling, 2026-09-23.
 * ===========================================================================
 *
 * `approvedProtocols` in src/config/launch-readiness.ts is what the compliance
 * gate reads to decide a service line may be offered, and it is CONFIGURATION.
 * Anybody can type anything into it. The row in `eng_protocol_templates` is
 * what the engineer actually approved, in his own account, and is the only
 * thing that makes the register true.
 *
 * LAYER ONE, in scripts/protocol-registry-audit.mjs, runs on every board with
 * no credential and asks whether the register agrees with everything this
 * repository owns: the service list, the transcribed document, the engineer
 * register. It cannot see production and does not pretend to.
 *
 * THIS IS THE OTHER HALF, and it needs a key, so it is run by hand:
 *
 *   at the moment the register entry is written, and
 *   again before LAUNCH_MODE is set live.
 *
 * TWICE, because a register that was true in September is not thereby true in
 * November. A protocol can be superseded, retired, or approved again at a new
 * version, and every one of those changes the row while leaving the file alone.
 *
 * WHY NOT A SESSION'S READ-ONLY QUERY. Three reasons, and the third decides it.
 * A check that exists only as something typed into a tool call is not a check,
 * it is a thing that happened once, and the second run may be weeks away in a
 * different session. A script exits non zero and names the field that differs,
 * where a query returns rows somebody then interprets, and the interpretation
 * is the weakest link. And this is the register the whole sealing gate rests
 * on, so comparing it must not depend on anything being connected.
 *
 * IT READS AND WRITES NOTHING. Two selects.
 */

import "./lib/load-env.mjs";
import { auditClient, describeTarget } from "./lib/db-target.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("========== THE REGISTER AGAINST THE ROW ==========");
console.log(`database: ${describeTarget(process.env.SUPABASE_URL)}`);
console.log("");

/*
 * RULING 11 STAGE B, 2026-10-07. This compared `approvedProtocols`, the typed
 * approval list in src/config/launch-readiness.ts, with the row. Ruling 11
 * removed the list: which protocols are approved has one home, the signed
 * record. So this now compares what CODE holds for each offered line, the
 * protocol in force in PROTOCOL_ENTRIES and the hash of the document its
 * transcription is proved against, with the published row, which is the same
 * question lineIsSellable asks on every order.
 */
const { offeredServiceLines } = await import("../src/config/launch-conditions.ts");
const { verifiedEngineers } = await import("../src/config/credentials.ts");
const { protocolForLine } = await import("../src/content/protocols/index.ts");

/*
 * UNREACHABLE IS NOT FAILED. No client means this could not measure, which is a
 * different answer from "the register disagrees with the row", and saying the
 * second when the first happened is the defect CLAUDE.md records at length.
 */
const db = auditClient("protocol-register-check");
if (!db) {
  console.log("COULD NOT TELL: no database client, so no row could be read.");
  console.log("The register was NOT compared against anything.");
  console.log("");
  console.log("Supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and for production");
  console.log("ALLOW_PRODUCTION_DB=1 as well. See the header of scripts/lib/db-target.mjs.");
  /* Safe to exit hard here: auditClient returned null, so nothing holds a handle. */
  process.exit(3);
}

/*
 * THE SUBJECT IS ASSERTED TO EXIST. An empty register compares nothing and
 * would otherwise exit zero, which is a green over a gate condition nobody has
 * satisfied.
 */
const inForce = offeredServiceLines
  .map((slug) => ({ slug, entry: protocolForLine(slug) }))
  .filter((x) => x.entry);
const registerIsEmpty = inForce.length === 0;
if (registerIsEmpty) {
  console.log("FAIL: no offered line has a protocol in force, so there is nothing to compare.");
  console.log("An empty set is not a passing comparison.");
}

for (const { slug, entry } of inForce) {
  const RC001 = entry.declaration;
  const where = `${RC001.documentNumber} v${RC001.version}`;
  console.log(`  ${where}`);
  const current = entry.versions.find((v) => v.supersededOn === null);

  const { data: rows, error } = await db
    .from("eng_protocol_templates")
    .select("id, document_number, version, version_label, status, service_slug, name, approved_by_license, approved_at, document_sha256")
    .eq("service_slug", slug)
    .eq("status", "published");

  if (error) {
    rec(`${where}: the row could be read`, false, error.message);
    continue;
  }
  rec(
    `${where}: exactly one published protocol for this service line`,
    (rows ?? []).length === 1,
    `${(rows ?? []).length} published row(s) for ${slug}. Two would mean the gate cannot say which one governs.`,
  );
  if ((rows ?? []).length !== 1) continue;
  const row = rows[0];

  rec(`${where}: document number`, row.document_number === RC001.documentNumber, `row "${row.document_number}", code "${RC001.documentNumber}"`);
  rec(`${where}: version label`, row.version_label === RC001.version, `row "${row.version_label}", code "${RC001.version}"`);
  rec(
    `${where}: the row's document hash is the PDF the transcription is proved against`,
    Boolean(current) && row.document_sha256 === current.sha256,
    `row ${String(row.document_sha256).slice(0, 12)}, code ${String(current?.sha256).slice(0, 12)}`,
  );
  const engineer = verifiedEngineers.find((e) => e.licenseNumber === row.approved_by_license);
  rec(
    `${where}: the approver's licence is on the engineer register`,
    Boolean(engineer),
    engineer ? `${engineer.name}, licence ${row.approved_by_license}` : `licence ${row.approved_by_license} is on no engineer`,
  );
  /* No code-side date to compare since the typed list went; printed for a person to read. */
  console.log(`    approved ${String(row.approved_at ?? "").slice(0, 10)} (${row.approved_at}), as the row records it`);

  const { count, error: itemErr } = await db
    .from("eng_protocol_items")
    .select("id", { count: "exact", head: true })
    .eq("template_id", row.id);
  if (itemErr) {
    rec(`${where}: item count could be read`, false, itemErr.message);
  } else {
    rec(
      `${where}: item count matches the transcribed checklist`,
      count === RC001.checklist.length,
      `row ${count}, transcribed document ${RC001.checklist.length}`,
    );
  }
  rec(`${where}: the row's name matches the transcribed title`, row.name === RC001.title, `row "${row.name}", document "${RC001.title}"`);
}

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");

/*
 * process.exitCode, NEVER process.exit(), AND IT COST A RUN TO LEARN.
 *
 * The first version called process.exit(1) here. The verdict printed perfectly
 * and the process then died in libuv teardown with
 *
 *     Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)
 *
 * exiting 127. The Supabase client still held open handles, and process.exit
 * tears the loop down underneath them. So the audit reported a real finding and
 * handed back an exit code that means "command not found".
 *
 * That is the exit code hazard this repository records four times over, arriving
 * from a new direction: not a pipe swallowing the code, but the script
 * destroying its own. Setting exitCode lets the loop drain and the number
 * survives.
 */
const failed = out.filter((r) => !r.ok);
if (registerIsEmpty) {
  /* Said above. Repeated as the verdict so the last line is never a green. */
  console.log("FAIL: nothing was compared, because the register is empty.");
  process.exitCode = 1;
} else if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("The register is what the compliance gate reads to decide the firm may seal.");
  console.log("A register that disagrees with the row is the gate acting on something nobody approved.");
  process.exitCode = 1;
} else {
  console.log(`PASS: ${out.length} checks. The register says what the row says.`);
  process.exitCode = 0;
}
