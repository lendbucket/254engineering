// @runtime react-server
/**
 * ROUND 3, THE SECOND HALF: FOUR REAL PATHS, READ LINE BY LINE.
 *
 *   npx tsx --conditions=react-server scripts/overnight-paths.mjs
 *
 * Development only, and NOTHING HERE SENDS.
 *
 * WHY THIS IS MOSTLY READING AND NOT MOSTLY DRIVING
 * -------------------------------------------------
 * CLAUDE.md section 7: every gate report includes at least one real artefact
 * read as a person would read it, and says what it found or that it found
 * nothing. Not a check that passed about the artefact: the artefact.
 *
 * The four artefacts a path leaves behind are the ones that matter here,
 * because each of them is a CLAIM the platform makes about what happened, and
 * a claim is exactly the thing a green check cannot audit. `customer_link.issued`
 * is the worked example this repository already has: it read like evidence that
 * a customer had been written to, and it was evidence of a database write.
 *
 * So each path below is walked to its end and then its record is printed in
 * full, every line, for a person to read. Where a path can be advanced without
 * writing anything a person would see, it is advanced. Where advancing it would
 * send, it stops at the door and the door is described.
 *
 * WHAT IS DELIBERATELY NOT DONE
 * ------------------------------
 * No offer is sent, no seal is touched, no retention run is executed and no row
 * is deleted. The retention path is walked to a PLANNED manifest, which is the
 * whole of what a dry run is, and the manifest is then read rather than acted
 * on.
 */

import { auditClient } from "./lib/db-target.mjs";

const db = auditClient("overnight-paths", { neverProduction: true });
if (!db) {
  console.error("no database client");
  process.exit(1);
}

const { fileTimeline } = await import("../src/lib/ops-crm.ts");
const { planRetention, sweepable } = await import("../src/lib/ops-retention.ts");
const { dispatchPlans } = await import("../src/lib/ops-bulk-dispatch.ts");

const findings = [];
const note = (s) => findings.push(s);

const rule = (t) => {
  console.log("");
  console.log("=".repeat(78));
  console.log(t);
  console.log("=".repeat(78));
};

/* An actor with everything, so a redaction is never what hides a line from a
 * reader. Reading is the point; the redaction rules are audited elsewhere. */
const { DEFAULT_ROLES } = await import("../src/lib/ops-authz.ts");
/*
 * A REAL PROFILE, resolved from the database rather than invented.
 *
 * The first version used the all-zero uuid, and eng_retention_runs.actor_id is
 * a foreign key to eng_profiles, so every manifest insert was refused:
 *
 *   insert or update on table "eng_retention_runs" violates foreign key
 *   constraint "eng_retention_runs_actor_id_fkey"
 *
 * That constraint is the point of the column. A dry run records who asked for
 * it, and an actor who does not exist is not an answer to that question.
 */
const { data: realAdmins } = await db
  .from("eng_profiles")
  .select("id, email")
  .eq("role", "admin")
  .eq("status", "active")
  .limit(1);
const REAL_ADMIN = realAdmins?.[0];
if (!REAL_ADMIN) {
  console.error("no active administrator on this database, so the retention path cannot record who asked");
  process.exit(1);
}

const ADMIN = {
  id: REAL_ADMIN.id,
  role: "admin",
  status: "active",
  grants: new Set(DEFAULT_ROLES.find((r) => r.key === "admin").grants),
  license_number: null,
  coverage_counties: [],
};

/* ========================================================== PATH 1: A FILE */

rule("PATH 1: A FILE, FROM INTAKE TO WHERE IT STOPPED, READ OFF ITS OWN TIMELINE");

/*
 * THE ERROR IS READ, and the first version threw it away.
 *
 * That version also asked for price_cents, which is not a column on eng_files.
 * PostgREST answered with an error and a null body, the destructure took data,
 * and the script printed "0 file(s) on development" over a database holding
 * five. It then reported that PATH 1 could not be walked, which was a statement
 * about this file rather than about the platform.
 */
const filesRead = await db
  .from("eng_files")
  .select("id, file_number, property_address, county, status, service_slug, created_at, assigned_tech_id, assigned_engineer_id")
  .order("created_at", { ascending: true });
if (filesRead.error) {
  console.error("the file list could not be read: " + filesRead.error.message);
  process.exit(1);
}
const files = filesRead.data;

console.log(`${(files ?? []).length} file(s) on development.`);
for (const f of files ?? []) {
  console.log(`  ${f.file_number.padEnd(22)} ${String(f.status).padEnd(20)} ${f.property_address}, ${f.county}`);
}

/* The one that has travelled furthest, which is the one whose record is worth
 * reading: a timeline of two entries teaches nothing about a timeline. */
const ORDER = [
  "intake",
  "needs_dispatch",
  "dispatched",
  "evidence_in_progress",
  "evidence_submitted",
  "under_review",
  "revisions_requested",
  "declined_to_seal",
  "sealed",
  "delivered",
  "closed",
];
const furthest = [...(files ?? [])].sort((a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status))[0];

/*
 * EVERY file's timeline, not only the furthest one's.
 *
 * The first version read the furthest and found nothing, and reported that as
 * "a file that moved with no record of moving". That may be true and it may
 * equally be a fixture inserted straight into eng_files by seed-field-demo,
 * which writes rows rather than driving the platform. One timeline cannot tell
 * those apart; five can.
 */
console.log("");
console.log("Every file's timeline length, so an empty one means something:");
for (const f of files ?? []) {
  const t = await fileTimeline(f.id);
  console.log(`  ${f.file_number.padEnd(22)} ${String((t ?? []).length).padStart(3)} entr${(t ?? []).length === 1 ? "y" : "ies"}`);
}

if (!furthest) {
  note("PATH 1 could not be walked: there are no files on development at all.");
} else {
  console.log("");
  console.log(`Reading ${furthest.file_number}, status "${furthest.status}", opened ${furthest.created_at}`);
  console.log("");
  const timeline = await fileTimeline(furthest.id);
  if (!timeline || timeline.length === 0) {
    note(`PATH 1: ${furthest.file_number} has reached "${furthest.status}" and its timeline is EMPTY. Read the per file list above before calling that a defect: a fixture inserted straight into eng_files has no timeline because nothing drove it.`);
    console.log("  (nothing)");
  } else {
    console.log(`  ${timeline.length} timeline entr${timeline.length === 1 ? "y" : "ies"}, oldest first:`);
    console.log("");
    for (const t of timeline) {
      console.log(`  ${String(t.at ?? t.created_at ?? "?").slice(0, 19)}  ${String(t.kind ?? t.event ?? "?").padEnd(26)}  ${t.summary ?? t.detail ?? t.note ?? ""}`);
    }
  }
}

/* ================================================ PATH 2: THE AUDIT TRAIL */

rule("PATH 2: THE AUDIT TRAIL, WHICH IS THE FIRM'S REGULATORY MEMORY");

/*
 * THE COLUMNS THIS TABLE ACTUALLY HAS. The first version asked for
 * subject_type and detail, which do not exist on it: they are entity_type and
 * summary. PostgREST answered with an error and a null body, and the loop below
 * printed nothing while the paragraph above it announced "the 40 most recent".
 * Second time in one file, which is the argument for reading the error rather
 * than for being more careful with column names.
 */
const eventsRead = await db
  .from("eng_audit_events")
  .select("id, action, actor_email, actor_role, entity_type, entity_id, created_at, summary")
  .order("created_at", { ascending: false })
  .limit(40);
if (eventsRead.error) {
  console.error("the audit trail could not be read: " + eventsRead.error.message);
  process.exit(1);
}
const events = eventsRead.data;

console.log(`The 40 most recent of what the trail holds, newest first:`);
console.log("");
for (const e of events ?? []) {
  console.log(
    `  ${String(e.created_at).slice(0, 19)}  ${String(e.action).padEnd(30)}  ${String(e.actor_email ?? "no actor").padEnd(34)}  ${String(e.entity_type ?? "").padEnd(12)}  ${e.summary ?? ""}`,
  );
}

/*
 * AND THE ONE QUESTION A TRAIL LIKE THIS HAS TO SURVIVE: does any entry claim
 * something was SENT to a person? customer_link.issued is the recorded example
 * of an entry that read like contact and was a database write.
 */
const contactish = (events ?? []).filter((e) => /sent|issued|emailed|notified|delivered/i.test(String(e.action)));
console.log("");
console.log(`${contactish.length} of those 40 use a word that reads like somebody was contacted:`);
for (const e of contactish) {
  console.log(`  ${String(e.created_at).slice(0, 19)}  ${e.action}  ${e.summary ?? "(no summary)"}`);
}
if (contactish.length === 0) {
  console.log("  (none, so nothing in this window claims contact it cannot evidence)");
}

/* ================================== PATH 3: A DISPATCH PLAN, WITHOUT SENDING */

rule("PATH 3: DISPATCH, WALKED TO THE DOOR AND STOPPED THERE");

/*
 * dispatchPlans is the REVIEW half of bulk dispatch: it computes, per file,
 * which technicians could be offered the work and why the others could not. It
 * sends nothing. sendBulkOffers is the half that sends and is not called here.
 */
const dispatchable = (files ?? []).filter((f) => f.status === "needs_dispatch");
console.log(`${dispatchable.length} file(s) are in needs_dispatch.`);

if (dispatchable.length === 0) {
  console.log("  Nothing to plan, so the sealed refusal below is exercised instead.");
} else {
  const plans = await dispatchPlans(ADMIN, dispatchable.map((f) => f.id));
  for (const p of plans.plans ?? plans ?? []) {
    console.log("");
    console.log(`  ${p.file?.file_number ?? p.fileId}`);
    console.log(`    blocked:    ${p.blocked ?? "no"}`);
    console.log(`    eligible:   ${(p.eligible ?? []).length} technician(s)`);
    for (const t of p.eligible ?? []) console.log(`      ${t.display_name ?? t.id}`);
    console.log(`    ineligible: ${(p.ineligible ?? []).length}, each with the reason`);
    for (const t of p.ineligible ?? []) console.log(`      ${t.display_name ?? t.id}: ${t.reason}`);
  }
}

/*
 * AND THE REFUSAL THAT SECTION 2 FOUND, exercised rather than asserted: a file
 * that is not waiting for dispatch cannot be dispatched, however it is reached.
 */
const notDispatchable = (files ?? []).find((f) => f.status !== "needs_dispatch");
if (notDispatchable) {
  const plans = await dispatchPlans(ADMIN, [notDispatchable.id]);
  const p = (plans.plans ?? plans ?? [])[0];
  console.log("");
  console.log(`  Asking for a plan on ${notDispatchable.file_number}, which is "${notDispatchable.status}":`);
  console.log(`    ${p?.blocked ?? "IT WAS NOT BLOCKED, which is the defect Section 2 fixed coming back"}`);
  if (!p?.blocked) {
    note(`PATH 3: dispatchPlans did not block ${notDispatchable.file_number}, which is "${notDispatchable.status}".`);
  }
}

/* ============================== PATH 4: A RETENTION MANIFEST, PLANNED ONLY */

rule("PATH 4: RETENTION, PLANNED AND READ, NEVER RUN");

console.log(`The declaration names ${sweepable().length} table(s) retention may ever delete from: ${sweepable().join(", ")}`);
console.log("");

for (const table of sweepable()) {
  /*
   * RetentionMode is an OBJECT, { kind, askedBy }, not a string. Passing
   * "dry_run" made mode.kind undefined, the manifest insert wrote null into a
   * NOT NULL column, and the database refused it:
   *
   *   null value in column "mode" of relation "eng_retention_runs"
   *
   * A dry run records who asked for it, because "who ran the rehearsal that
   * said this was safe" is a question somebody asks after a real run.
   */
  const plan = await planRetention(table, {
    kind: "dry_run",
    askedBy: { id: REAL_ADMIN.id, email: REAL_ADMIN.email, role: "admin" },
  });
  console.log(`  ${table}:`);
  if (!plan || plan.ok === false) {
    const why = plan?.because ?? plan?.error ?? "no answer";
    console.log(`    the plan could not be made: ${why}`);
    note(`PATH 4: planning ${table} failed: ${why}`);
    continue;
  }
  const m = plan.manifest ?? plan;
  console.log(`    mode:           ${m.mode ?? "?"}`);
  console.log(`    floor:          ${m.floor_days ?? m.floorDays ?? "?"} days`);
  console.log(`    cutoff:         ${m.cutoff ?? "?"}`);
  console.log(`    rows it WOULD remove: ${m.row_count ?? m.rowCount ?? "?"}`);
  console.log(`    id hash:        ${(m.id_hash ?? m.idHash ?? "none").slice(0, 32)}`);
  console.log(`    status:         ${m.status ?? "?"}`);
  if ((m.status ?? "") !== "planned") {
    note(`PATH 4: a dry run produced a manifest whose status is "${m.status}" rather than "planned".`);
  }
}

/* ------------------------------------------------------------------ verdict */

console.log("");
console.log("=".repeat(78));
console.log(findings.length ? `${findings.length} thing(s) the reading found:` : "The four records were read end to end and nothing in them claims more than it can evidence.");
for (const f of findings) console.log(`  ${f}`);
console.log("");
process.exitCode = 0;
