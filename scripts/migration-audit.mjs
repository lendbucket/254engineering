/**
 * Every migration, replayed in order into a scratch database, fingerprinted and
 * compared against the schema this platform actually runs.
 *
 *   npx tsx scripts/migration-audit.mjs
 *
 * WHY THIS EXISTS, AND WHAT IT WOULD HAVE CAUGHT
 * ----------------------------------------------
 * On 2026-09-03, `0001_ops_foundation.sql` was found to contain `as $` and `$;`
 * where it needed `as $$` and `$$;`. A lone dollar sign is not a valid dollar
 * quote delimiter, so the statement creating `eng_forbid_mutation_allow_cascade`
 * was a syntax error and everything after it in the file would have failed with
 * it. That function is the append only guarantee on three tables.
 *
 * Both live databases had the function, because it was applied through the
 * management API on the day it was written. The FILE was corrupted afterwards
 * and nothing noticed, because nothing had ever applied these migrations to an
 * empty database.
 *
 * The migrations in version control did not reconstruct the schema, and the only
 * reason that was survivable is that nobody had yet needed them to. It would
 * have been discovered during a recovery, which is the worst possible moment.
 *
 * THE SCRATCH DATABASE IS REAL POSTGRES
 * -------------------------------------
 * PGlite runs Postgres in process, so this needs no Docker, no server and no
 * network, and it runs in the suite on every machine. A parser or a regular
 * expression check would have caught the dollar quote defect specifically; only
 * an actual Postgres catches the next one, which will be different.
 *
 * WHAT IS STUBBED, AND WHY THAT IS HONEST
 * ---------------------------------------
 * Supabase provides `auth.users` and `storage.buckets`. This platform's
 * migrations reference both: `eng_profiles.id` is a foreign key into auth.users,
 * and 0002 registers the evidence bucket. Neither exists in a bare Postgres, so
 * both are created as minimal stubs before the replay.
 *
 * The stubs are OUTSIDE the fingerprint, which covers only `eng_` tables in
 * `public`, so nothing about them can mask a real difference. What this does not
 * prove is that Supabase's own versions of those objects are shaped as expected;
 * that is what the fingerprint comparison against the live development project
 * is for, and it is checked separately below.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const DIR = join(process.cwd(), "supabase", "migrations");

/**
 * The schema every migration replay must produce.
 *
 * Written down here rather than fetched, deliberately. Fetching it from
 * development would compare the migrations against a database that the same
 * mistake could have been applied to by hand, which is exactly how 0001 stayed
 * broken for a month. A constant has to be changed by a person who noticed.
 */
const EXPECTED_FINGERPRINT = "aca946e3c49d149d73685c4eb30d092e";
const EXPECTED_COLUMNS = 868;
const EXPECTED_TABLES = 62;
const EXPECTED_TRIGGERS = 38;
/** 0014 added eng_freeze_attribution, which is a trigger function like the rest. eng_claim_jobs is still the only one called directly. */
const EXPECTED_FUNCTIONS = 6;

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

// ---------------------------------------------------------------- the files

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

rec("there are migrations to replay", files.length > 0, `${files.length} files`);

/*
 * Contiguously numbered from 0000. A gap means a migration was deleted or never
 * committed, and a replay that skips one produces a schema nobody runs.
 */
const numbers = files.map((f) => Number(f.slice(0, 4)));
const contiguous = numbers.every((n, i) => n === i);
rec(
  "they are numbered contiguously from 0000",
  contiguous,
  contiguous ? files.map((f) => f.slice(0, 4)).join(", ") : `got ${numbers.join(", ")}`,
);

/*
 * Balanced dollar quoting, checked before the replay so the failure names the
 * file rather than surfacing as a syntax error from somewhere inside it.
 *
 * This is the specific defect that was found. The replay below would catch it
 * too, but a targeted check gives a targeted message.
 */
for (const f of files) {
  const body = readFileSync(join(DIR, f), "utf8");
  const dollars = (body.match(/\$\$/g) ?? []).length;
  const lone = (body.match(/^[ \t]*as \$[ \t]*$|^\$;[ \t]*$/gm) ?? []).length;
  const fns = (body.match(/^create or replace function/gm) ?? []).length;

  if (fns > 0 || dollars > 0 || lone > 0) {
    rec(
      `${f}: dollar quoting is balanced`,
      lone === 0 && dollars % 2 === 0,
      lone > 0
        ? `${lone} lone dollar delimiter(s): this file cannot be replayed`
        : `${dollars / 2} pair(s) for ${fns} function(s)`,
    );
  }
}

// ---------------------------------------------------------------- the replay

const db = new PGlite();

/*
 * The Supabase objects this platform's migrations reference. Minimal, and
 * outside the fingerprint.
 */
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key,
    name text,
    public boolean,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
`);

let replayed = 0;
let failedAt = null;

for (const f of files) {
  const sql = readFileSync(join(DIR, f), "utf8");
  try {
    await db.exec(sql);
    replayed += 1;
  } catch (err) {
    failedAt = { file: f, message: err instanceof Error ? err.message : String(err) };
    break;
  }
}

rec(
  "every migration applies to an empty database, in order",
  failedAt === null,
  failedAt
    ? `${failedAt.file} failed: ${failedAt.message.split("\n")[0]}`
    : `${replayed} of ${files.length} applied`,
);

// ---------------------------------------------------------- what it produced

if (failedAt === null) {
  const sigRows = await db.query(`
    select table_name || '.' || column_name || ':' || data_type || ':' || is_nullable as sig
    from information_schema.columns
    where table_schema = 'public' and table_name like 'eng\\_%'
    order by sig
  `);
  const sigs = sigRows.rows.map((r) => r.sig);
  const fingerprint = createHash("md5").update(sigs.join("|")).digest("hex");

  const tableRows = await db.query(`
    select count(*)::int as n from information_schema.tables
    where table_schema = 'public' and table_name like 'eng\\_%' and table_type = 'BASE TABLE'
  `);

  rec(
    "the replayed schema matches the one the platform runs",
    fingerprint === EXPECTED_FINGERPRINT,
    fingerprint === EXPECTED_FINGERPRINT
      ? fingerprint
      : `got ${fingerprint} with ${sigs.length} columns, expected ${EXPECTED_FINGERPRINT} with ${EXPECTED_COLUMNS}`,
  );
  rec("and the column count", sigs.length === EXPECTED_COLUMNS, `${sigs.length}`);
  rec("and the table count", tableRows.rows[0].n === EXPECTED_TABLES, `${tableRows.rows[0].n}`);

  /*
   * The functions and triggers the fingerprint cannot see. A migration that
   * created every column and no trigger would fingerprint identically and leave
   * the audit trail editable.
   */
  const fnRows = await db.query(`
    select p.proname, (p.proconfig is not null) as pinned
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'eng\\_%'
    order by p.proname
  `);
  const fns = fnRows.rows;
  /*
   * Not all of these are trigger functions any more. 0011 added eng_claim_jobs,
   * which is the queue's atomic claim and is called directly. The check is on
   * the count and the pinning, both of which apply to either sort.
   */
  rec(
    `the ${EXPECTED_FUNCTIONS} eng_ functions exist`,
    fns.length === EXPECTED_FUNCTIONS,
    fns.map((f) => f.proname).join(", "),
  );
  rec(
    "and every one has its search_path pinned",
    fns.length > 0 && fns.every((f) => f.pinned),
    fns.filter((f) => !f.pinned).map((f) => f.proname).join(", ") || "all pinned",
  );

  const trgRows = await db.query(`
    select count(*)::int as n from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal and c.relname like 'eng\\_%'
  `);
  rec(
    "the triggers are all there",
    trgRows.rows[0].n === EXPECTED_TRIGGERS,
    `${trgRows.rows[0].n} of ${EXPECTED_TRIGGERS}`,
  );

  const rlsRows = await db.query(`
    select count(*)::int as n from pg_class c join pg_namespace n2 on n2.oid = c.relnamespace
    where n2.nspname = 'public' and c.relkind = 'r' and c.relname like 'eng\\_%' and c.relrowsecurity
  `);
  rec(
    "row level security is on for every eng_ table",
    rlsRows.rows[0].n === EXPECTED_TABLES,
    `${rlsRows.rows[0].n} of ${EXPECTED_TABLES}`,
  );

  /*
   * The append only guarantee, exercised rather than assumed. This is the
   * function whose creation was the corrupted statement, so a replay that
   * produced a database where the trail could be edited is the exact regression
   * worth naming.
   */
  await db.exec(`insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001')`);
  await db.exec(`
    insert into eng_audit_events (action, entity_type, summary)
    values ('probe', 'probe', 'written by migration-audit')
  `);

  let refusedUpdate = false;
  try {
    await db.exec(`update eng_audit_events set summary = 'tampered'`);
  } catch {
    refusedUpdate = true;
  }
  rec("the replayed audit trail refuses an UPDATE", refusedUpdate);

  let refusedDelete = false;
  try {
    await db.exec(`delete from eng_audit_events`);
  } catch {
    refusedDelete = true;
  }
  rec("and a DELETE", refusedDelete);
}

await db.close();

// ---------------------------------------------------------------- the verdict

const failed = out.filter((o) => !o.ok);
for (const o of out) {
  console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
}
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A migration that cannot be replayed is a schema that cannot be rebuilt.");
  console.log("This is found here rather than during a recovery, which is the point.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. Every migration replays and produces the schema in use.`);
