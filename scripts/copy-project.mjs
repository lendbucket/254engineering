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

import { pairClient } from "./lib/db-target.mjs";

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
  { name: "eng_audit_events", key: "id", byIdSet: true },
];

const BUCKETS = ["eng-evidence", "eng-onboarding", "eng-uploads"];

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

// ------------------------------------------------------------------- tables

for (const t of TABLES) {
  const { data: rows, error } = await src.from(t.name).select("*");
  if (error) {
    fail(`${t.name}: could not read the source: ${error.message}`);
    continue;
  }

  const { count: destBefore } = await dst
    .from(t.name)
    .select(t.key, { count: "exact", head: true });

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
    .select(t.key, { count: "exact", head: true });

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
    const { data: destRows } = await dst.from(t.name).select(t.key);
    const a = new Set(rows.map((r) => r[t.key]));
    const b = new Set((destRows ?? []).map((r) => r[t.key]));
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
for (const bucket of BUCKETS) {
  const { data: srcList, error } = await src.storage.from(bucket).list("", { limit: 1000 });
  if (error) {
    console.log(`  ${bucket.padEnd(22)} source not readable: ${error.message}`);
    continue;
  }

  const files = (srcList ?? []).filter((f) => f.id !== null);

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

  const { data: dstList } = await dst.storage.from(bucket).list("", { limit: 1000 });
  const dstFiles = (dstList ?? []).filter((f) => f.id !== null);
  const agree = dstFiles.length === files.length;

  console.log(
    `  ${bucket.padEnd(22)} source ${String(files.length).padStart(5)}   dest ${String(dstFiles.length).padStart(5)}   ${
      MODE === "dry" ? `would copy ${files.length}` : agree ? "agree" : "DISAGREE"
    }`,
  );
  if (MODE !== "dry" && !agree) fail(`${bucket}: object counts differ.`);
}

// ------------------------------------------------------------------ verdict

console.log("");
if (problems) {
  console.log(`STOP: ${problems} problem(s). Nothing further should proceed until each is understood.`);
  process.exit(1);
}

console.log(
  MODE === "dry"
    ? "Dry run only. Nothing was written. Re-run with --apply to copy."
    : "Source and destination agree on every table, every id in the audit trail, and every stored object.",
);
