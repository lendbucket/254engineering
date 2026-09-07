/**
 * MERGED IS NOT APPLIED, AND THIS IS THE CHECK THAT SAYS SO.
 *
 *   npx tsx scripts/schema-ledger-audit.mjs
 *
 * WHY IT EXISTS
 * -------------
 * On 2026-09-06 migration 0023 merged to main. It was never applied to
 * production. It was found on 2026-09-07 by hand, while somebody was comparing
 * fingerprints for an unrelated reason, and in the meantime the queue depth
 * alerting that shipped in the same closeout could not work on production
 * because the table it reads did not exist there.
 *
 * That was the SECOND time the two facts diverged. CLAUDE.md section 6b carries
 * the fingerprint chain and calls a divergence after a merge the defect case,
 * which is exactly right and is also just prose: nothing reads it, so nothing
 * can notice when it stops being true.
 *
 * WHAT THIS ACTUALLY CATCHES, AND IT IS NARROWER THAN IT SOUNDS
 * -------------------------------------------------------------
 * It cannot see production. Nothing in the repository can, because that needs
 * production's service role key and standing law keeps it out of the tree. What
 * it can see is whether somebody was ASKED, and the September failure was not a
 * wrong answer, it was a question nobody was made to answer.
 *
 * So the check is: every migration has a ledger entry, every entry agrees with
 * a real replay, and a migration that is ON MAIN with no production date fails.
 * The last one is the whole point. A migration on a feature branch may be
 * pending; a migration on main may not be, because merging is the moment the
 * decision stops being deferrable.
 *
 * `scripts/production-schema-check.mjs` closes the remaining gap by reading
 * production itself, and is the one command to run after a merge carrying a
 * migration.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { APPLIED, assertNotEmpty, appliedToProduction, pending } from "../supabase/applied.mjs";

const DIR = "supabase/migrations";
const MAIN = "main";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ MERGED IS NOT APPLIED ================");
console.log("");

// --------------------------------------------------------------- the canary

let ledger;
try {
  ledger = assertNotEmpty();
  rec(`the ledger is not empty (${ledger.length} entries)`, true);
} catch (e) {
  rec("the ledger is not empty", false, e.message);
  ledger = [];
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

rec(`there are migrations to check (${files.length})`, files.length > 0);

// ------------------------------------------------- every file has an entry

{
  const declared = new Set(ledger.map((e) => e.file));
  const missing = files.filter((f) => !declared.has(f));
  rec(
    "every migration has a ledger entry",
    missing.length === 0,
    missing.length
      ? `${missing.join(", ")} is in ${DIR} and not in supabase/applied.mjs. Say whether production has it.`
      : `${files.length} accounted for`,
  );

  const onDisk = new Set(files);
  const ghosts = ledger.filter((e) => !onDisk.has(e.file)).map((e) => e.file);
  rec(
    "and every ledger entry names a real migration",
    ghosts.length === 0,
    ghosts.length ? `${ghosts.join(", ")} is declared and does not exist` : "",
  );

  const ledgerOrder = ledger.map((e) => e.file);
  const sorted = [...ledgerOrder].sort();
  rec(
    "the ledger is in migration order",
    JSON.stringify(ledgerOrder) === JSON.stringify(sorted),
    "an out of order ledger makes the last applied entry the wrong one",
  );

  const seen = new Set();
  const dupes = ledger.filter((e) => (seen.has(e.file) ? true : (seen.add(e.file), false)));
  rec("and lists nothing twice", dupes.length === 0, dupes.map((d) => d.file).join(", "));
}

// ------------------------------------------ a pending entry must say why

{
  const silent = pending().filter((e) => !e.because || !e.because.trim());
  rec(
    "every pending migration says why it is pending",
    silent.length === 0,
    silent.length
      ? `${silent.map((e) => e.file).join(", ")} has no production date and no reason`
      : `${pending().length} pending`,
  );
}

// -------------------------------------------- THE ONE THAT WOULD HAVE CAUGHT IT

/*
 * A migration reachable from main with no production date is the defect.
 *
 * Merging is the moment the decision stops being deferrable, so this is the
 * check that turns the September failure into a red board rather than a thing
 * somebody notices a day later.
 *
 * If main cannot be resolved, this SAYS SO and fails rather than passing. A
 * check that quietly skips when it cannot run is the shape of defect this
 * repository spends its time removing.
 */
{
  let mainKnown = true;
  try {
    execFileSync("git", ["rev-parse", "--verify", MAIN], { stdio: "pipe" });
  } catch {
    mainKnown = false;
  }

  rec(
    `the ${MAIN} branch can be resolved`,
    mainKnown,
    mainKnown ? "" : `no ${MAIN} ref here, so this check cannot measure anything and does not pretend to`,
  );

  if (mainKnown) {
    const onMain = (file) => {
      try {
        const r = execFileSync("git", ["rev-list", "-1", MAIN, "--", join(DIR, file)], {
          stdio: "pipe",
          encoding: "utf8",
        });
        return r.trim().length > 0;
      } catch {
        return false;
      }
    };

    const merged = files.filter(onMain);
    rec(
      `the check can see migrations on ${MAIN} (${merged.length} of ${files.length})`,
      merged.length > 0,
      "if this said zero, every check below it would pass over nothing",
    );

    const byFile = new Map(ledger.map((e) => [e.file, e]));
    const mergedButUnapplied = merged.filter((f) => {
      const e = byFile.get(f);
      return e && e.production === null;
    });

    rec(
      "no migration is on main without production having it",
      mergedButUnapplied.length === 0,
      mergedButUnapplied.length
        ? `${mergedButUnapplied.join(", ")} is merged and the ledger says production does not have it. Merged and applied are different facts and this is the second time they diverged.`
        : `${merged.length} merged, all declared applied`,
    );

    const unmergedApplied = files.filter((f) => {
      const e = byFile.get(f);
      return e && e.production !== null && !onMain(f);
    });
    rec(
      "and nothing is applied to production that is not on main",
      unmergedApplied.length === 0,
      unmergedApplied.length
        ? `${unmergedApplied.join(", ")} is declared applied and is not on main. Production is running a schema the default branch does not describe.`
        : "",
    );
  }
}

// ---------------------------------- the fingerprints agree with a real replay

/*
 * The tie to reality. Without it the ledger is a list of assertions, and this
 * makes every one of them checkable against what the migrations actually
 * produce: a fabricated entry would have to invent a fingerprint that a replay
 * agrees with.
 */
{
  const db = new PGlite();

  /* The same stubs migration-audit uses. They sit outside the fingerprint,
   * which covers eng_ tables in public only. */
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key, email text, created_at timestamptz not null default now()
    );
    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key, name text, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text, name text, metadata jsonb
    );
  `);

  const fingerprintNow = async () => {
    const r = await db.query(`
      select table_name || '.' || column_name || ':' || data_type || ':' || is_nullable as sig
      from information_schema.columns
      where table_schema = 'public' and table_name like 'eng\\_%'
      order by sig
    `);
    return createHash("md5").update(r.rows.map((x) => x.sig).join("|")).digest("hex");
  };

  const byFile = new Map(ledger.map((e) => [e.file, e]));
  let compared = 0;
  const wrong = [];
  let broke = null;

  for (const f of files) {
    try {
      await db.exec(readFileSync(join(DIR, f), "utf8"));
    } catch (err) {
      broke = { f, message: err instanceof Error ? err.message : String(err) };
      break;
    }
    const actual = await fingerprintNow();
    const entry = byFile.get(f);
    if (!entry) continue;
    compared += 1;
    if (entry.fingerprint !== actual) wrong.push(`${f}: ledger ${entry.fingerprint}, replay ${actual}`);
  }

  rec(
    "the whole chain replays so the fingerprints mean something",
    broke === null,
    broke ? `${broke.f} failed: ${broke.message.split("\n")[0]}` : `${files.length} applied`,
  );

  rec(
    `every ledger fingerprint matches the replay (${compared} compared)`,
    wrong.length === 0 && compared === files.length,
    wrong.length ? wrong.join(" | ") : compared === files.length ? "" : `only ${compared} of ${files.length} were compared`,
  );

  /*
   * Two fingerprints repeat on purpose, and the ledger has to keep saying so.
   * 0008 pins search_path and 0021 seeds a grant row: both change behaviour
   * without changing shape. A reader who does not know that reads a copied
   * line, so the entries carry a note and this asserts the note is there.
   */
  const repeats = [];
  for (let i = 1; i < ledger.length; i += 1) {
    if (ledger[i].fingerprint === ledger[i - 1].fingerprint) repeats.push(ledger[i]);
  }
  rec(
    `every repeated fingerprint explains itself (${repeats.length} repeats)`,
    repeats.length > 0 && repeats.every((e) => e.note && e.note.trim()),
    repeats.length === 0
      ? "no repeats found at all, which means this check is measuring nothing"
      : repeats.filter((e) => !e.note).map((e) => e.file).join(", "),
  );

  await db.close();
}

// ------------------------------------------------------------------- verdict

console.log("");
for (const r of out) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}

const failed = out.filter((r) => !r.ok);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A migration on main that production has not received is not a record keeping");
  console.log("problem. It is a schema the deployed code expects and the database does not have.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. Every migration on main is declared applied to production.`);
console.log("");
console.log(`Declared applied: ${appliedToProduction().length}. Pending: ${pending().length}.`);
console.log("This says somebody was asked, not that production answered. For that:");
console.log("  ALLOW_PRODUCTION_DB=1 npx tsx scripts/production-schema-check.mjs");
