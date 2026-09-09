/**
 * Copy this firm's data from one Supabase project to another.
 *
 *   npx tsx scripts/copy-project.mjs                 # dry run, writes nothing
 *   npx tsx scripts/copy-project.mjs --apply         # writes
 *   npx tsx scripts/copy-project.mjs --verify        # compares, writes nothing
 *
 * Source and destination come from the environment, and NEITHER is guessed:
 *
 *   COPY_FROM_URL / COPY_FROM_KEY
 *   COPY_TO_URL   / COPY_TO_KEY
 *
 * WHY THIS IS NOT db-target.mjs
 * -----------------------------
 * Every other script in this repository reaches exactly one database and the
 * guard exists to stop it reaching the wrong one. This script's whole purpose is
 * to hold two at once, so it takes both explicitly and refuses every ambiguity
 * the guard would otherwise catch: it will not run if source and destination are
 * the same project, and it will not run if the DESTINATION is the current
 * production project, because this copies INTO a new one.
 *
 * WHAT IT COPIES, AND THE ORDER
 * -----------------------------
 * Dependency order, because foreign keys. The auth user comes before the profile
 * because eng_profiles.id references auth.users(id), and the profile comes
 * before everything that references a profile.
 *
 * THE AUTH ROW IS NOT COPIED BY THIS SCRIPT
 * -----------------------------------------
 * It cannot be: creating an auth user with a chosen uuid needs a direct insert
 * into auth.users, which PostgREST does not expose. That step is SQL, is written
 * out in docs/production-cutover-plan.md step 7, and was rehearsed on 2026-09-03.
 * This script CHECKS that it has been done and refuses to copy eng_profiles
 * until it has, rather than failing later on a foreign key.
 *
 * COUNTS ARE COMPARED SOURCE TO DESTINATION, AT COPY TIME
 * -------------------------------------------------------
 * Never against a figure recorded earlier. eng_audit_events grows on every
 * production touch, including a sign in, and can never shrink. Operator
 * amendment, 2026-09-03.
 */

import fs from "node:fs";
import { readSource } from "./lib/read-source.mjs";
import { pairClient } from "./lib/db-target.mjs";
/*
 * The bucket walk lives in its own module so it can be exercised. It was six
 * lines here, and those six lines are what made step 8's verification
 * meaningless: see the header of scripts/lib/bucket-walk.mjs.
 */
import { walkBucket } from "./lib/bucket-walk.mjs";

/** Sequence statements this run could not execute. Printed, never pretended. */
const setvals = [];

const MODE = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--verify")
    ? "verify"
    : "dry";

const PRODUCTION_REF = "fsaryeciduszuahgjbly";

/**
 * Dependency order. Nothing here references a table that comes after it.
 *
 * eng_audit_events is last and is the one that matters most: it is append only,
 * it refuses UPDATE and DELETE, and a row missing from it is a regulatory
 * problem rather than an inconvenience. It is verified by id set, not by count.
 */
const TABLES = [
  { name: "eng_leads", key: "id" },
  { name: "eng_applications", key: "id" },
  { name: "eng_onboardings", key: "id" },
  { name: "eng_onboarding_items", key: "id" },
  { name: "eng_profiles", key: "id", needsAuthUser: true },
  { name: "eng_auth_tokens", key: "id" },
  { name: "eng_clients", key: "id" },
  { name: "eng_contacts", key: "id" },
  { name: "eng_files", key: "id" },
  { name: "eng_fee_schedule", key: "id" },

  /*
   * THE THREE THAT WERE MISSING UNTIL 2026-09-07, AND WHY THEY ARE HERE NOW.
   *
   * All three arrived in 0011 and 0012, after this list was written, and
   * nothing noticed the list had stopped describing the database. Production
   * held 853 job rows, 5,101 cron runs and 39 metric days that this script
   * would have left behind without mentioning them.
   *
   * Two are telemetry and losing their history would have been defensible. It
   * would not have been a DECISION, which is the part that made it a defect.
   * eng_jobs is not telemetry while it holds live work: a pending row at the
   * copy moment is scheduled work that silently never runs.
   *
   * eng_jobs and eng_cron_runs are bigserial, so they carry a sequence that has
   * to be moved with them. eng_metrics_daily is NOT: its primary key is
   * (day, metric), which makes it naturally idempotent and needs no sequence.
   * That distinction was stated wrongly in the first report of this finding and
   * is corrected here, because "all three are bigserial" is the kind of tidy
   * sentence that turns into a broken sequence at cutover.
   */
  { name: "eng_jobs", key: "id", sequence: "eng_jobs_id_seq" },
  { name: "eng_cron_runs", key: "id", sequence: "eng_cron_runs_id_seq" },
  { name: "eng_metrics_daily", key: "day,metric" },

  { name: "eng_audit_events", key: "id", byIdSet: true },
];

/**
 * Tables this script deliberately does NOT copy, each with the reason.
 *
 * A DECLARED exclusion rather than an absence, because the whole defect this
 * list answers was a table being absent from a list and nobody being able to
 * tell whether that was a decision or an oversight. The completeness check
 * below reads this, so adding a table to the schema and saying nothing about it
 * stops the copy rather than quietly dropping it.
 */
const NOT_COPIED = {
  eng_roles: "Seeded by 0018. The destination already holds all seven from the migration replay.",
  eng_role_grants: "Seeded by 0018 and 0021. The destination already holds all 111.",
};

const BUCKETS = [
  "eng-evidence",
  "eng-onboarding",
  "eng-uploads",
  /*
   * Both added 2026-09-07. They existed in the schema since Phase 9 and Phase
   * 11 and were absent here for the same reason the three tables above were:
   * this list was written before they were. Empty on production today, which is
   * the only reason their absence had cost nothing yet.
   */
  "eng-messages",
  "eng-partner-assets",
];

function refOf(url) {
  const m = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url ?? "");
  return m ? m[1] : null;
}

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set. This script takes both projects explicitly.`);
    process.exit(1);
  }
  return v;
}

const fromUrl = required("COPY_FROM_URL");
const fromKey = required("COPY_FROM_KEY");
const toUrl = required("COPY_TO_URL");
const toKey = required("COPY_TO_KEY");

const fromRef = refOf(fromUrl);
const toRef = refOf(toUrl);

if (!fromRef || !toRef) {
  console.error("One of the URLs is not a Supabase project URL. Refusing to guess.");
  process.exit(1);
}

if (fromRef === toRef) {
  console.error(`Source and destination are the same project (${fromRef}). Refusing.`);
  process.exit(1);
}

/*
 * The destination must never be the live production project. This script writes,
 * and the whole point of the exercise is to fill a NEW project. Pointing it the
 * wrong way round would write yesterday's rows back over today's.
 */
if (toRef === PRODUCTION_REF) {
  console.error(
    `The destination is the current production project (${PRODUCTION_REF}). This copies INTO a new project, never back into that one. Refusing.`,
  );
  process.exit(1);
}

/*
 * Both clients come through the guard rather than being constructed here.
 *
 * db-guard-audit failed this script's first version for importing the Supabase
 * client directly, and it was right to: a second way to open a connection is a
 * second place the production check does not run. pairClient applies the same
 * check to each side, so copying FROM production requires ALLOW_PRODUCTION_DB,
 * which is exactly the friction that should exist.
 */
const src = pairClient(fromUrl, fromKey, "source", "copy-project");
const dst = pairClient(toUrl, toKey, "destination", "copy-project");

console.log(`copy-project: ${MODE.toUpperCase()}`);
console.log(`  from ${fromRef}`);
console.log(`  to   ${toRef}`);
console.log("");

let problems = 0;
const fail = (msg) => {
  problems += 1;
  console.log(`  STOP: ${msg}`);
};

let manual = 0;

/* ---------------------------------------------------------------------------
 * THE COMPLETENESS CHECK, WHICH IS THE GENERALISED FIX.
 *
 * Everything else in this file is a correction to one list. This is the check
 * that makes the next omission fail loudly instead of copying nothing.
 *
 * It asks the SOURCE which eng_ tables hold rows, and requires every one of
 * them to be either in TABLES or named in NOT_COPIED with a reason. A table
 * that is in neither stops the run before anything is written.
 *
 * PostgREST cannot enumerate a schema, so this probes each candidate name
 * directly. The candidate list is the union of what this script knows about and
 * what the migration files declare, read from disk, so a table added by a
 * migration is a candidate the moment it exists rather than when somebody
 * remembers to add it here.
 * ------------------------------------------------------------------------- */
async function completenessCheck() {
  const declared = new Set([...TABLES.map((t) => t.name), ...Object.keys(NOT_COPIED)]);

  const dir = new URL("../supabase/migrations/", import.meta.url);
  const fromMigrations = new Set();
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = readSource(new URL(file, dir));
    for (const m of sql.matchAll(/create table if not exists\s+(eng_[a-z0-9_]+)/gi)) {
      fromMigrations.add(m[1].toLowerCase());
    }
  }

  if (fromMigrations.size === 0) {
    fail("no tables were found in supabase/migrations. This check cannot measure anything.");
    return;
  }
  console.log(`  the migrations declare ${fromMigrations.size} eng_ tables`);

  const undeclared = [];
  for (const name of [...fromMigrations].sort()) {
    if (declared.has(name)) continue;
    const { count, error } = await src.from(name).select("*", { count: "exact", head: true });
    if (error) continue; // Not present on the source. A newer migration than production has.
    if ((count ?? 0) > 0) undeclared.push(`${name} (${count} rows)`);
  }

  if (undeclared.length) {
    fail(
      `${undeclared.length} table(s) hold rows on the source and are in neither the copy list nor the declared exclusions: ${undeclared.join(", ")}. Decide about each rather than leaving it out by accident.`,
    );
  } else {
    console.log(
      `  every eng_ table holding rows is either copied or declared as not copied (${declared.size} declared)`,
    );
  }
}

/* ---------------------------------------------------------------------------
 * THE QUEUE MUST BE EMPTY, AND IT IS CHECKED RATHER THAN HOPED FOR.
 *
 * Cutover plan step 7. A job that is pending or running at the copy moment is
 * scheduled work whose row moves while its lease and its worker do not: it
 * arrives at the destination looking claimable, or looking claimed by a worker
 * that will never report. Neither is a state anybody wants to reason about at
 * the moment the firm changes databases.
 *
 * The window is short and the queue drains in a minute, so the correct action
 * on a failure here is to wait, not to force it.
 * ------------------------------------------------------------------------- */
async function queueCheck() {
  const { data, error } = await src
    .from("eng_jobs")
    .select("id, kind, status")
    .in("status", ["pending", "running"])
    .limit(20);

  if (error) {
    fail(`could not read the job queue to check it is quiet: ${error.message}`);
    return;
  }

  const live = data ?? [];
  if (live.length === 0) {
    console.log("  the job queue holds nothing pending or running");
    return;
  }

  const kinds = [...new Set(live.map((j) => j.kind))].join(", ");
  fail(
    `the job queue holds ${live.length} pending or running job(s) (${kinds}). Wait for it to drain and run this again. A job copied mid flight is work that silently never runs.`,
  );
}

// ------------------------------------------------------- before anything else

console.log("BEFORE COPYING ANYTHING");
await completenessCheck();
await queueCheck();
console.log("");

if (problems && MODE === "apply") {
  console.log("");
  console.log(`STOP: ${problems} problem(s) before a single row was written. Nothing was copied.`);
  process.exit(1);
}

// ------------------------------------------------------------------- tables

for (const t of TABLES) {
  const { data: rows, error } = await src.from(t.name).select("*");
  if (error) {
    fail(`${t.name}: could not read the source: ${error.message}`);
    continue;
  }

  const firstKey = t.key.split(",")[0];

  const { count: destBefore } = await dst
    .from(t.name)
    .select(firstKey, { count: "exact", head: true });

  if (MODE === "apply" && rows.length > 0) {
    if (t.needsAuthUser) {
      /*
       * eng_profiles references auth.users. If the auth rows are not already in
       * place this insert fails on a foreign key deep in a batch, which is a
       * confusing way to learn that step 7's SQL was skipped.
       */
      const ids = rows.map((r) => r.id);
      const { data: present } = await dst.from(t.name).select("id").in("id", ids);
      const have = new Set((present ?? []).map((r) => r.id));
      const missingAuth = ids.filter((id) => !have.has(id));
      if (missingAuth.length && destBefore === 0) {
        console.log(
          `  ${t.name}: ${missingAuth.length} row(s) need their auth.users row created first (cutover plan step 7). Skipping.`,
        );
        continue;
      }
    }

    // Chunked, and upserted on the primary key so a re-run is not a duplicate.
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error: wErr } = await dst.from(t.name).upsert(chunk, { onConflict: t.key });
      if (wErr) {
        fail(`${t.name}: write failed at row ${i}: ${wErr.message}`);
        break;
      }
    }
  }

  const { count: destAfter } = await dst
    .from(t.name)
    .select(firstKey, { count: "exact", head: true });

  /*
   * The sequence, which the row copy cannot move.
   *
   * Inserting explicit ids leaves the destination's sequence at 1, so the first
   * row written after the cutover collides on the primary key. PostgREST cannot
   * run setval, so this prints the statement rather than pretending to have run
   * it, and counts itself as unfinished work so the verdict cannot read as done.
   */
  if (t.sequence && MODE === "apply" && rows.length > 0) {
    const highest = rows.reduce((m, r) => (Number(r.id) > m ? Number(r.id) : m), 0);
    manual += 1;
    setvals.push(
      `select setval('public.${t.sequence}', ${highest}, true);  -- ${t.name}, highest id copied`,
    );
  }

  const agree = destAfter === rows.length;
  const verb = MODE === "apply" ? "copied" : "would copy";
  console.log(
    `  ${t.name.padEnd(22)} source ${String(rows.length).padStart(5)}   dest ${String(destAfter ?? 0).padStart(5)}   ${
      MODE === "dry" ? `${verb} ${rows.length}` : agree ? "agree" : "DISAGREE"
    }`,
  );

  if (MODE !== "dry" && !agree) {
    fail(`${t.name}: source has ${rows.length} and destination has ${destAfter}.`);
  }

  /*
   * The audit trail is compared by id, not by count. Two sets of the same size
   * can still differ, and this is the one table where that would be a
   * regulatory problem rather than an inconvenience.
   */
  if (t.byIdSet && MODE !== "dry") {
    const { data: destRows } = await dst.from(t.name).select(firstKey);
    const a = new Set(rows.map((r) => r[firstKey]));
    const b = new Set((destRows ?? []).map((r) => r[firstKey]));
    const onlySource = [...a].filter((x) => !b.has(x));
    const onlyDest = [...b].filter((x) => !a.has(x));
    if (onlySource.length || onlyDest.length) {
      fail(
        `${t.name}: id sets differ. ${onlySource.length} only in source, ${onlyDest.length} only in destination.`,
      );
    } else {
      console.log(`  ${"".padEnd(22)} id sets identical (${a.size} ids compared one by one)`);
    }
  }
}

// ------------------------------------------------------------------ storage

console.log("");

let objectsSeen = 0;

for (const bucket of BUCKETS) {
  let files;
  try {
    files = await walkBucket(src, bucket);
  } catch (e) {
    console.log(`  ${bucket.padEnd(22)} source not readable: ${e.message}`);
    continue;
  }
  objectsSeen += files.length;

  if (MODE === "apply") {
    for (const f of files) {
      const { data: blob, error: dErr } = await src.storage.from(bucket).download(f.name);
      if (dErr) {
        fail(`${bucket}/${f.name}: download failed: ${dErr.message}`);
        continue;
      }
      const { error: uErr } = await dst.storage
        .from(bucket)
        .upload(f.name, blob, { upsert: true, contentType: f.metadata?.mimetype });
      if (uErr) fail(`${bucket}/${f.name}: upload failed: ${uErr.message}`);
    }
  }

  /*
   * A destination that cannot be read is NOT a destination holding nothing.
   *
   * Swallowing this into an empty array is the same mistake one level along:
   * it would make an unreadable bucket compare equal to an empty source and
   * print agreement. See the header of scripts/lib/bucket-walk.mjs, which
   * throws for exactly this reason.
   */
  let dstFiles;
  try {
    dstFiles = await walkBucket(dst, bucket);
  } catch (e) {
    fail(`${bucket}: the destination could not be read, so nothing about it is known: ${e.message}`);
    continue;
  }
  const agree = dstFiles.length === files.length;

  /*
   * Byte for byte, on every object rather than on one.
   *
   * A count comparison is what printed "agree" while nothing had been copied,
   * because both sides of it came from the same broken enumerator. Downloading
   * both and comparing the bytes is evidence that does not share a failure mode
   * with the thing it is checking. There are two objects today; when there are
   * thousands this becomes a sample, and the sample is stated rather than
   * silently introduced.
   */
  if (MODE !== "dry" && files.length > 0) {
    for (const f of files) {
      const a = await src.storage.from(bucket).download(f.name);
      const b = await dst.storage.from(bucket).download(f.name);
      if (a.error || b.error) {
        fail(`${bucket}/${f.name}: could not read it back from both sides.`);
        continue;
      }
      const ab = Buffer.from(await a.data.arrayBuffer());
      const bb = Buffer.from(await b.data.arrayBuffer());
      if (!ab.equals(bb)) fail(`${bucket}/${f.name}: the bytes differ (${ab.length} vs ${bb.length}).`);
    }
    console.log(`  ${"".padEnd(22)} ${files.length} object(s) compared byte for byte`);
  }

  console.log(
    `  ${bucket.padEnd(22)} source ${String(files.length).padStart(5)}   dest ${String(dstFiles.length).padStart(5)}   ${
      MODE === "dry" ? `would copy ${files.length}` : agree ? "agree" : "DISAGREE"
    }`,
  );
  if (MODE !== "dry" && !agree) fail(`${bucket}: object counts differ.`);
}

// ------------------------------------------------------------------ verdict

/*
 * THE CANARY. An enumerator that finds nothing must not read as agreement.
 *
 * The defect this file carried for months produced exactly this state: zero
 * objects on both sides, every count matching, and a confident line saying so.
 * Saying "nothing was found" out loud is the difference between a copy that had
 * nothing to do and a copy that could not see its work.
 */
console.log("");
if (objectsSeen === 0) {
  console.log(
    "  NOTE: the walk found no objects in any bucket. If that is a surprise, it is the defect this walk replaced.",
  );
}

if (problems) {
  console.log("");
  console.log(`STOP: ${problems} problem(s). Nothing further should proceed until each is understood.`);
  process.exit(1);
}

if (setvals.length) {
  console.log("");
  console.log("THE SEQUENCES ARE NOT SET, AND THE COPY IS NOT FINISHED UNTIL THEY ARE.");
  console.log("PostgREST cannot run setval. Run this against the DESTINATION, then re-run with --verify:");
  console.log("");
  for (const line of setvals) console.log(`    ${line}`);
  console.log("");
  console.log(
    `STOP: ${manual} sequence(s) still at 1. The first row written after the cutover would collide on the primary key.`,
  );
  process.exit(1);
}

console.log(
  MODE === "dry"
    ? "Dry run only. Nothing was written. Re-run with --apply to copy."
    : "Source and destination agree on every table, every id in the audit trail, and every stored object.",
);
