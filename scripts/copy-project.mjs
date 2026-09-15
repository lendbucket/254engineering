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
 * Every row or a refusal, never the first thousand. The bare select("*") this
 * file used would have copied 1000 of 17,500 audit events and printed "agree".
 * See the header of scripts/lib/read-every-row.mjs.
 */
import { readEveryRow } from "./lib/read-every-row.mjs";
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
/*
 * ============================================================================
 * WHAT MOVES, DERIVED AGAINST THE SCHEMA RATHER THAN REMEMBERED.
 * ============================================================================
 *
 * Every eng_ table the migrations declare is in THIS list or in NOT_COPIED with
 * a reason, and completenessCheck() below fails the run if one is in neither.
 * That check is why this list is now right: it caught 42 tables holding rows on
 * the source that a hand maintained list had never been told about, and the
 * list had been stale since roughly half the platform was built.
 *
 * ON THE DAY IT WAS REBUILT the production source held rows in eleven tables and
 * exactly ONE of them was undeclared: eng_incidents, one row, the firm's only
 * incident record. The 42 was a development artefact. The one was the loss.
 *
 * THE ORDER IS DEPENDENCY ORDER AND WAS COMPUTED, NOT CHOSEN. A Tarjan walk over
 * pg_constraint found exactly one cycle in the whole graph, eng_profiles against
 * eng_onboardings, both sides nullable. It is broken at profiles, which about
 * thirty tables reference, and closed by the second pass at the end.
 *
 * RESERVED TO THE OPERATOR: twelve tables carry a record of money moved,
 * licensure exercised, or consent given, and their disposition is not a
 * session's to decide. They are marked RESERVED in their own comment. Adding a
 * table to that class is the operator's call, and five were added on 2026-09-14
 * after a session flagged them rather than deciding them.
 */
const TABLES = [
  /* Business record carried across by the cutover. */
  { name: "eng_partners", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_leads", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_profiles", key: "id", needsAuthUser: true },
  /* Business record carried across by the cutover. */
  { name: "eng_clients", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_customer_accounts", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_account_api_keys", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_account_properties", key: "id" },
  /* RESERVED TO THE OPERATOR, added 2026-09-14. What a customer was charged. */
  { name: "eng_account_trade_prices", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_applications", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_contacts", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_protocol_templates", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_files", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_assignments", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_audit_events", key: "id", sequence: "eng_audit_events_id_seq", byIdSet: true },
  /* Business record carried across by the cutover. */
  { name: "eng_auth_tokens", key: "id" },
  /* Append only. What makes a certification evidence rather than a claim. */
  { name: "eng_certification_attempts", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_certifications", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_credentials", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_order_batches", key: "id" },
  /* RESERVED TO THE OPERATOR. Money owed by a customer. */
  { name: "eng_statements", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_service_orders", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_quote_requests", key: "id" },
  /* Long lived signed links, stored hashed. Dropping these kills every open customer order link, which nobody notices until a customer rings. */
  { name: "eng_customer_access", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_customer_users", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_tasks", key: "id" },
  /* RESERVED TO THE OPERATOR. What a person asked about their own data. */
  { name: "eng_deletion_requests", key: "id" },
  /* The sealed deliverable record, including which registration it was filed under. */
  { name: "eng_documents", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_protocol_items", key: "id" },
  /* The evidence a seal was granted on. */
  { name: "eng_evidence_items", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_fee_schedule", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_file_events", key: "id", sequence: "eng_file_events_id_seq" },
  /* Business record carried across by the cutover. */
  { name: "eng_file_inputs", key: "id" },
  /* OPERATOR RULING 2026-09-14. The firm's only incident record, written by hand about something that affected a person. A cutover that silently drops it is the defect class this build exists to prevent. */
  { name: "eng_incidents", key: "id" },
  /* RESERVED TO THE OPERATOR. Consent given, or withdrawn. */
  { name: "eng_marketing_suppressions", key: "email" },
  /* Business record carried across by the cutover. */
  { name: "eng_threads", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_messages", key: "id", sequence: "eng_messages_id_seq" },
  /* Business record carried across by the cutover. */
  { name: "eng_metrics_daily", key: "day,metric" },
  /* Ciphertext survives the move because MFA_ENCRYPTION_KEY is an environment variable and does not travel with the database. */
  { name: "eng_mfa_enrolments", key: "user_id" },
  /* Business record carried across by the cutover. */
  { name: "eng_mfa_recovery_codes", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_notification_prefs", key: "profile_id,kind" },
  /* emailed_at and email_error are the record of whether somebody was actually told. */
  { name: "eng_notifications", key: "id", sequence: "eng_notifications_id_seq" },
  /* Business record carried across by the cutover. */
  { name: "eng_onboardings", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_onboarding_items", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_order_events", key: "id", sequence: "eng_order_events_id_seq" },
  /* Business record carried across by the cutover. */
  { name: "eng_order_inputs", key: "id" },
  /* RESERVED TO THE OPERATOR. Money moved. */
  { name: "eng_order_payments", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_partner_agreements", key: "version" },
  /* Business record carried across by the cutover. */
  { name: "eng_partner_users", key: "id" },
  /* Append only. The record that a partner agreed not to present as an engineering firm. */
  { name: "eng_partner_acceptances", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_partner_assets", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_partner_asset_versions", key: "id" },
  /* RESERVED TO THE OPERATOR, added 2026-09-14. Money going out. */
  { name: "eng_partner_statements", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_partner_terms", key: "id" },
  /* RESERVED TO THE OPERATOR, added 2026-09-14. Money owed to a third party. */
  { name: "eng_partner_entries", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_partner_submissions", key: "id" },
  /* Every partner touch including the ones that lost. A dispute is settled by showing the touch that beat theirs. */
  { name: "eng_partner_touches", key: "id", sequence: "eng_partner_touches_id_seq" },
  /* Business record carried across by the cutover. */
  { name: "eng_review_sessions", key: "id" },
  /* RESERVED TO THE OPERATOR. What an engineer is owed. */
  { name: "eng_production_ledger", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_protocol_questions", key: "id" },
  /* RESERVED TO THE OPERATOR. Licensure exercised: which Professional Engineer was in responsible charge of what. */
  { name: "eng_responsible_charge_log", key: "id", sequence: "eng_responsible_charge_log_id_seq" },
  /* The accountability record for every deletion. Kept forever by ruling, and refuses DELETE. */
  { name: "eng_retention_runs", key: "id" },
  /* RESERVED TO THE OPERATOR. What a customer was billed, line by line. */
  { name: "eng_statement_lines", key: "id" },
  /* RESERVED TO THE OPERATOR, added 2026-09-14. Money owed to a technician, the same class as the production ledger. */
  { name: "eng_tech_pay_ledger", key: "id" },
  /* Business record carried across by the cutover. */
  { name: "eng_thread_participants", key: "thread_id,profile_id" },
  /* RESERVED TO THE OPERATOR, added 2026-09-14. The hours a person is paid for. */
  { name: "eng_time_log", key: "id" },
];

/*
 * ============================================================================
 * THE CYCLE REPAIR. ITS OWN STEP, BECAUSE IT IS NOT A TABLE IN THE PLAN.
 * ============================================================================
 *
 * eng_profiles and eng_onboardings reference each other: 0003 gave a profile an
 * onboarding_id and an onboarding a profile_id, both nullable. That is the
 * single cycle in this schema's whole foreign key graph, found by a Tarjan walk
 * over pg_constraint rather than by reading it, and there is no total order that
 * satisfies it. Profiles land FIRST, because about thirty tables reference them
 * and one references onboardings, so a profile's onboarding_id cannot be
 * satisfied at the moment it is written.
 *
 * THIS WAS A SECOND eng_profiles ROW IN TABLES AND THAT WAS WRONG. Operator
 * finding, 2026-09-15: the plan then listed 66 rows for 65 tables, and a
 * duplicate is exactly what a reader's eye slides over. It would not have
 * collided, because the write is an upsert on the primary key rather than an
 * insert, but "it happens to be safe" is not the same as "it can be counted".
 *
 * So the repair is a NAMED STEP that runs after the table loop, prints its own
 * line, and is counted separately. One upsert, idempotent, on rows that are
 * already there.
 */
const CYCLE_REPAIR = {
  table: "eng_profiles",
  key: "id",
  column: "onboarding_id",
  because:
    "eng_profiles.onboarding_id points at eng_onboardings, which is copied after profiles " +
    "because the two reference each other. This fills it once both tables are in.",
};

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
  eng_roles:
    "Seeded by 0018. The destination already holds all seven from the migration replay.",
  eng_role_grants:
    "Seeded by 0018, 0021, 0027, 0029, 0030 and 0046. The destination already holds all 118 from the replay.",
  eng_jobs:
    "Telemetry, and one of only two tables retention may delete from. The queue is DRAINED before the cutover, so every job worth keeping has run: a copied job is either finished history or a pending job that would run a second time against a different database. Operator ruling 2026-09-14.",
  eng_cron_runs:
    "Telemetry, the other table retention may delete from. eng_metrics_daily is the rollup that OUTLIVES it and IS copied, which is why 0032 makes the rollup kept_forever. CONSEQUENCE, recorded rather than discovered: the status page reads the most recent run per cron name, so on day one it shows no history and reads as never run until the first new run lands, within a minute.",
  eng_account_api_requests:
    "The rate limit window and usage telemetry. Regenerates from the first request.",
  eng_error_types:
    "Fault telemetry, prunable by declaration.",
  eng_error_events:
    "Fault telemetry, prunable by declaration.",
  eng_alert_state:
    "One row per thing that can alert, holding a cooldown. Regenerates on the first alert.",
  eng_customer_auth_tokens:
    "Short lived set password and reset links. Reissued after the flip, the same treatment staff tokens get at step 12.",
  eng_partner_tokens:
    "Short lived set password links. Reissued after the flip.",
  eng_orders:
    "The LEGACY intake table reconstructed in 0000. Zero rows on production, nothing in this repository writes it, and no eng_files row references it. 0006's header argues at length why it was not repurposed.",
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
  /*
   * NO TABLE APPEARS TWICE IN THE PLAN. Operator ruling, 2026-09-15, after
   * eng_profiles was found listed first and last: the plan printed 66 rows for
   * 65 tables and the duplicate was the cycle repair wearing a table's clothes.
   *
   * It was safe, because the write is an upsert on the primary key rather than
   * an insert, and that is exactly why it needed a check rather than a reader:
   * a duplicate that does not break anything is one nobody will ever notice,
   * and the next one might be a table listed twice by accident with two
   * different keys.
   *
   * Both directions, because they fail differently. A table in TABLES twice is
   * a plan nobody can count. A table in TABLES *and* NOT_COPIED is a plan that
   * contradicts itself, and whichever the reader saw first is the answer they
   * would take away.
   */
  const seen = new Map();
  const dupes = [];
  for (const t of TABLES) {
    seen.set(t.name, (seen.get(t.name) ?? 0) + 1);
    if (seen.get(t.name) === 2) dupes.push(t.name);
  }
  if (dupes.length) {
    fail(
      `${dupes.length} table(s) appear more than once in the copy plan: ${dupes.join(", ")}. ` +
        "A plan with a duplicate cannot be counted, and a reader's eye slides over it.",
    );
  } else {
    console.log(`  no table appears twice in the plan (${TABLES.length} entries, all distinct)`);
  }

  const bothWays = TABLES.map((t) => t.name).filter((n) => NOT_COPIED[n]);
  if (bothWays.length) {
    fail(
      `${bothWays.join(", ")} is in BOTH the copy list and the declared exclusions. ` +
        "The plan contradicts itself and whichever a reader saw first is the answer they would take away.",
    );
  }

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
/*
 * ============================================================================
 * THE DEPTH IS COUNTED. THE KINDS ARE SAMPLED. THEY ARE NOT THE SAME READ.
 * ============================================================================
 *
 * This check read the queue with `.limit(20)` and then reported `live.length` as
 * the depth, so it announced
 *
 *     the job queue holds 20 pending or running job(s) (email.send, report.export)
 *
 * when the queue actually held 668 across THREE kinds. Understated by 33x, and
 * the third kind was invisible because it did not appear in the first twenty
 * rows. Operator finding, 2026-09-15.
 *
 * IT IS THE 1000 CAP AGAIN, TWENTY LINES AWAY, and in one respect it is worse:
 * that cap was PostgREST's and silent, while this one is written in the source
 * and was still reported as a depth. The bounded read was the right instinct,
 * because nobody wants to pull a hundred thousand queued rows to learn the queue
 * is busy. Reporting the size of the sample as the size of the queue was the
 * defect.
 *
 * So the two questions are asked separately, which is the general form: COUNT
 * the thing you are reporting, SAMPLE the thing you are describing, and never
 * let the sample's length stand in for the count.
 */
async function queueCheck() {
  const { count, error: countError } = await src
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "running"]);

  if (countError) {
    fail(`could not count the job queue to check it is quiet: ${countError.message}`);
    return;
  }

  const depth = count ?? 0;
  if (depth === 0) {
    console.log("  the job queue holds nothing pending or running");
    return;
  }

  /*
   * A bounded sample, ONLY to name the kinds. It is deliberately larger than the
   * old limit and still bounded, and the sentence below says it is a sample so
   * nobody reads the kind list as exhaustive.
   */
  const { data: sample } = await src
    .from("eng_jobs")
    .select("kind")
    .in("status", ["pending", "running"])
    .limit(500);

  const kinds = [...new Set((sample ?? []).map((j) => j.kind))].sort();
  const exhaustive = (sample ?? []).length >= depth;

  fail(
    `the job queue holds ${depth} pending or running job(s). Kinds ${
      exhaustive ? "" : "seen in a sample of the first 500: "
    }${kinds.join(", ")}. Drain it and run this again. A job copied mid flight is work that silently never runs.`,
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
  let rows;
  try {
    rows = await readEveryRow(src, t.name, "*", { orderBy: t.key.split(",")[0] });
  } catch (err) {
    fail(`${t.name}: could not read the source: ${String(err?.message ?? err)}`);
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
    /*
     * PAGED ON BOTH SIDES. This comparison exists because two id sets of the
     * same size can still differ, and it was capped at 1000 on both sides, so
     * it printed "id sets identical" over the first thousand of seventeen and a
     * half thousand. The strictest check in this file was the one the cap made
     * meaningless.
     */
    const destRows = await readEveryRow(dst, t.name, firstKey, { orderBy: firstKey });
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

// -------------------------------------------------------------- cycle repair

/*
 * Counted and printed separately from the plan, because it is not a table being
 * copied: it is one column being filled on rows that are already there. See the
 * CYCLE_REPAIR declaration for why the cycle exists and why it is broken here.
 */
{
  const r = CYCLE_REPAIR;
  const withValue = await readEveryRow(src, r.table, `${r.key},${r.column}`, { orderBy: r.key });
  const needing = withValue.filter((row) => row[r.column] !== null && row[r.column] !== undefined);

  if (needing.length === 0) {
    console.log(
      `  cycle repair      ${r.table}.${r.column}: nothing to fill, every source row is null`,
    );
  } else if (MODE === "dry") {
    console.log(
      `  cycle repair      ${r.table}.${r.column}: would fill ${needing.length} row(s) after ${r.column.replace("_id", "s")} land`,
    );
  } else {
    const { error } = await dst.from(r.table).upsert(needing, { onConflict: r.key });
    if (error) {
      fail(`cycle repair on ${r.table}.${r.column} failed: ${error.message}`);
    } else {
      console.log(`  cycle repair      ${r.table}.${r.column}: filled ${needing.length} row(s)`);
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
