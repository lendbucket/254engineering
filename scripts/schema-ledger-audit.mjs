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

import { readdirSync } from "node:fs";
import { readSource } from "./lib/read-source.mjs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import {
  APPLIED,
  assertNotEmpty,
  appliedToProduction,
  pending,
  BEHAVIOUR_BASELINE,
  BEHAVIOUR_DIVERGENCE,
} from "../supabase/applied.mjs";
import { behaviourSqlFull, digestOf } from "./lib/fingerprints.mjs";

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

// ------------------------------- how it got there, and whether the provider knows

/*
 * THE PROVIDER'S MIGRATION HISTORY AND THIS LEDGER CAN DISAGREE, AND ONE OF
 * THEM DID.
 *
 * `apply_migration` writes a row into supabase_migrations.schema_migrations.
 * `execute_sql` changes the database and writes nothing. So a migration applied
 * the second way is plainly present in the schema and completely absent from
 * the provider's own list of what has been applied.
 *
 * 0025 is exactly that. Production's history names 0024, 0026 and 0027 and not
 * 0025, while production unmistakably HAS 0025, because eng_roles reads
 * optional for admin and engineer and that is the only thing it does. Somebody
 * reading that list to answer "does production have 0025" gets the wrong
 * answer, and the wrong answer is the alarming one: they would re-apply a
 * migration production already has.
 *
 * Operator ruling, 2026-09-09: every production migration from here goes
 * through apply_migration so the two records agree, the LEDGER stays the
 * authority, and a ledger entry the provider's history will not show is NAMED
 * rather than left to be rediscovered.
 *
 * WHY THIS CHECK DOES NOT READ THE LIVE LIST
 * ------------------------------------------
 * It cannot, and the reason is worth writing down rather than working around.
 * This audit runs in the suite with NO credentials, which is the whole point of
 * it: the September failure was a question nobody was made to answer, and a
 * check that needs production's service role key would not run on the board at
 * all. And the list is out of reach even for the audit that does have the key:
 * supabase_migrations.schema_migrations is not in the `public` schema, so
 * PostgREST does not expose it, which was verified rather than assumed.
 *
 * Checking a snapshot of the list into the repository would make this readable
 * and would be the exact failure the ledger exists to prevent: a record that
 * stops being true without telling anybody. So the live comparison stays a by
 * hand step through the Supabase MCP, recorded in CLAUDE.md section 6b, and
 * what runs on every board is this: the ledger states HOW each migration got
 * there, and anything applied by hand has to say so in a sentence.
 */
{
  const WAYS = ["apply_migration", "execute_sql", "pre_ledger"];
  const applied = appliedToProduction();

  const undeclared = applied.filter((e) => !WAYS.includes(e.appliedBy));
  rec(
    `every applied migration declares how production got it (${applied.length})`,
    undeclared.length === 0,
    undeclared.length
      ? `${undeclared.map((e) => e.file).join(", ")} does not say whether it went through apply_migration or execute_sql, so nobody can tell whether the provider's history will show it`
      : "",
  );

  const byHand = applied.filter((e) => e.appliedBy === "execute_sql");
  const silent = byHand.filter((e) => !e.handApplied || !e.handApplied.trim());
  rec(
    `every migration applied by hand says what the provider's history will not show (${byHand.length})`,
    silent.length === 0,
    silent.length
      ? `${silent.map((e) => e.file).join(", ")} is declared execute_sql with no handApplied sentence`
      : byHand.map((e) => e.file).join(", "),
  );

  /*
   * And the ruling itself, as a check rather than as a paragraph.
   *
   * The first version of this read "nothing numbered above 0028 went in by
   * hand", which is what the ruling says in words and is a check that cannot
   * fail today: no migration above 0028 exists, so it passed over an empty list
   * and passed just as happily when a by hand 0028 was injected to test it.
   * That is the vacuous check this repository keeps finding, written by
   * somebody who had just written a paragraph about vacuous checks.
   *
   * So the rule is stated as the SET instead. Exactly one migration in this
   * chain reached production by hand, it is 0025, and it is named here as a
   * literal rather than derived from the ledger, because an audit that asks the
   * ledger which entries are grandfathered is asking the thing under test to
   * approve itself. Any other by hand entry is the thing the ruling forbids.
   */
  const GRANDFATHERED = ["0025_mfa_optional_default.sql"];
  const forbidden = byHand.filter((e) => !GRANDFATHERED.includes(e.file));
  rec(
    "and no migration except the one already grandfathered reached production by hand",
    forbidden.length === 0,
    forbidden.length
      ? `${forbidden.map((e) => e.file).join(", ")}. Operator ruling 2026-09-09: apply_migration, so the provider's history and this ledger agree.`
      : `${GRANDFATHERED.join(", ")} is the only one, and it predates the ruling`,
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
   * which covers eng_ tables in public only. Named, because the behaviour
   * fingerprint replays the chain a second time and two spellings of the stubs
   * would be two starting databases. */
  const STUBS = `
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
  `;
  await db.exec(STUBS);

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
      await db.exec(readSource(join(DIR, f)));
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

  /*
   * ===================================================================
   * THE SECOND FINGERPRINT, REPLAYED AND COMPARED AS THE FIRST IS.
   *
   * Phase 12 Section 4, Section 0, debt two. Every entry that declares a
   * behaviour fingerprint has it recomputed here from the same replay, by the
   * same query the live checks use, so the ledger cannot claim a behaviour the
   * migrations do not produce.
   *
   * Entries before 0038 declare none, deliberately: backfilling a number
   * nobody read at the time would be a record invented after the fact. That
   * makes "zero declared" a state this check has to notice rather than pass
   * over, which is the vacuous-check trap this repository keeps meeting.
   * ===================================================================
   */
  /*
   * THE BASELINE, RECOMPUTED. This is the number the whole of debt two rests
   * on, and until 0038 declares one it is the only behaviour fingerprint in the
   * repository. Left as prose it would be a record, and a record is not a
   * check: the last time this schema's history lived only in prose, a migration
   * spent a day missing from production and was found by accident.
   */
  {
    /*
     * REPLAYED TO THE MIGRATION THE BASELINE WAS READ AT, not to the head of
     * the chain.
     *
     * The first version of this check computed the number after every
     * migration and compared it to a baseline pinned at 0037, so it went red
     * the moment 0038 landed. The baseline is a statement about a MOMENT in
     * the chain and it stays true; a check that reads it as a statement about
     * the present would have to be edited after every migration, which makes
     * it a check on nothing within two of them.
     */
    const db3 = new PGlite();
    await db3.exec(STUBS);
    for (const f of files) {
      await db3.exec(readSource(join(DIR, f)));
      if (f === BEHAVIOUR_BASELINE.at) break;
    }
    const r = await db3.query(behaviourSqlFull());
    const actual = createHash("md5").update(digestOf(r.rows)).digest("hex");
    await db3.close();
    rec(
      "the declared behaviour baseline is what the migrations actually replay to",
      BEHAVIOUR_BASELINE.replay.behaviour === actual && BEHAVIOUR_BASELINE.replay.facts === r.rows.length,
      `${actual} across ${r.rows.length} facts; declared ${BEHAVIOUR_BASELINE.replay.behaviour} across ${BEHAVIOUR_BASELINE.replay.facts}`,
    );
    rec(
      "and the baseline names the migration it was read at, and the two live databases it was compared against",
      Boolean(
        BEHAVIOUR_BASELINE.at &&
          files.includes(BEHAVIOUR_BASELINE.at) &&
          BEHAVIOUR_BASELINE.development.behaviour &&
          BEHAVIOUR_BASELINE.production.behaviour,
      ),
      `read at ${BEHAVIOUR_BASELINE.at}`,
    );
    /*
     * AND THE THREE NUMBERS DISAGREE, WHICH IS THE FINDING.
     *
     * Asserted rather than merely recorded, because the day they agree is the
     * day the divergence below has been repaired, and this check is what makes
     * somebody come back and delete it rather than leaving a fixed problem
     * described as open. If this ever fails, the fix is to re-read both live
     * databases and rewrite the divergence, not to change the number.
     */
    rec(
      "the three databases do not agree on behaviour, which is what the divergence declares",
      BEHAVIOUR_BASELINE.replay.behaviour !== BEHAVIOUR_BASELINE.development.behaviour &&
        BEHAVIOUR_BASELINE.replay.behaviour !== BEHAVIOUR_BASELINE.production.behaviour &&
        BEHAVIOUR_BASELINE.development.behaviour !== BEHAVIOUR_BASELINE.production.behaviour,
      `replay ${BEHAVIOUR_BASELINE.replay.facts}, development ${BEHAVIOUR_BASELINE.development.facts}, production ${BEHAVIOUR_BASELINE.production.facts} facts`,
    );
    /* The shape at that same moment, from that same entry, for the same
     * reason: pinned to the migration, not to the head. */
    const atEntry = ledger.find((e) => e.file === BEHAVIOUR_BASELINE.at);
    rec(
      "while the first fingerprint says all three are the same database",
      Boolean(atEntry) && BEHAVIOUR_BASELINE.shape === atEntry.fingerprint,
      atEntry
        ? "identical shape and three behaviours is the argument for the second fingerprint, made by it"
        : `${BEHAVIOUR_BASELINE.at} has no ledger entry`,
    );
  }

  /*
   * "FROM NOW ON" IS ENFORCED, NOT REMEMBERED.
   *
   * The ruling is that every ledger entry from the start of Section 4 carries
   * both fingerprints. Left as an instruction it is a thing somebody has to
   * remember while writing the entry after next, which is the same shape as the
   * question nobody was made to answer in September. So the boundary is a
   * number: 0038 and above must declare one, and 0037 and below must not,
   * because a backfilled number is a record invented after the fact.
   */
  const FIRST_REQUIRED = "0038";
  const numberOf = (f) => f.slice(0, 4);
  {
    const owe = ledger.filter((e) => numberOf(e.file) >= FIRST_REQUIRED && !e.behaviour);
    rec(
      `every migration from ${FIRST_REQUIRED} declares a behaviour fingerprint (${
        ledger.filter((e) => numberOf(e.file) >= FIRST_REQUIRED).length
      } at or above it)`,
      owe.length === 0,
      owe.length ? `${owe.map((e) => e.file).join(", ")} declares only a shape` : "",
    );
    const backfilled = ledger.filter((e) => numberOf(e.file) < FIRST_REQUIRED && e.behaviour);
    rec(
      "and nothing before it backfills one",
      backfilled.length === 0,
      backfilled.length
        ? `${backfilled.map((e) => e.file).join(", ")} declares a number nobody read when it was applied`
        : "the first fingerprint is kept for the history it already describes",
    );
  }

  const declaring = ledger.filter((e) => e.behaviour);
  if (declaring.length === 0) {
    rec(
      "no ledger entry declares a behaviour fingerprint yet, and this check says so rather than passing",
      true,
      "0038 is the first that must; until then the baseline above is what is asserted",
    );
  } else {
    /* Replayed in order, exactly as the shape fingerprints are, so an entry is
     * compared against the schema as it stood after ITS migration. */
    const db2 = new PGlite();
    await db2.exec(STUBS);
    const wrongBehaviour = [];
    const byFile2 = new Map(declaring.map((e) => [e.file, e]));
    for (const f of files) {
      await db2.exec(readSource(join(DIR, f)));
      const entry = byFile2.get(f);
      if (!entry) continue;
      const r = await db2.query(behaviourSqlFull());
      const actual = createHash("md5").update(digestOf(r.rows)).digest("hex");
      if (entry.behaviour !== actual) {
        wrongBehaviour.push(`${f}: ledger ${entry.behaviour}, replay ${actual}`);
      }
    }
    await db2.close();
    rec(
      `every declared behaviour fingerprint matches the replay (${declaring.length} declared)`,
      wrongBehaviour.length === 0,
      wrongBehaviour.join(" | "),
    );
  }

  /*
   * THE DECLARED DIVERGENCE IS CHECKED AGAINST THE MIGRATIONS, BOTH WAYS.
   *
   * BEHAVIOUR_DIVERGENCE describes live databases this audit cannot reach, and
   * it would be prose if nothing read it. What CAN be checked without a
   * credential is the half the migrations decide: the four foreign keys said to
   * be missing from both live databases must be four the migrations really
   * create, and the eight indexes said to exist only on production must be
   * eight no migration creates.
   *
   * Both directions matter. A divergence entry naming a constraint the
   * migrations do not declare is a claim about a repair that would do nothing;
   * one naming an index a migration DOES create is a claim about a mystery that
   * has an obvious answer.
   */
  {
    const fkRows = await db.query(`
      with tbl as (select c.oid, c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'eng\\_%')
      select t.relname || '.' || (
        select string_agg(a.attname, ',' order by k.ord)
        from unnest(con.conkey) with ordinality k(attnum, ord)
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
      ) as ref
      from pg_constraint con join tbl t on t.oid = con.conrelid where con.contype = 'f'
    `);
    const replayFks = new Set(fkRows.rows.map((r) => r.ref));

    const ixRows = await db.query(`
      select ic.relname as name from pg_index i
      join pg_class ic on ic.oid = i.indexrelid
      join pg_class c on c.oid = i.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname like 'eng\\_%'
    `);
    const replayIxs = new Set(ixRows.rows.map((r) => r.name));

    const missing = BEHAVIOUR_DIVERGENCE.find((d) => d.kind === "missing_on_both_live_databases");
    const extra = BEHAVIOUR_DIVERGENCE.find((d) => d.kind === "extra_on_production_only");

    rec(
      "the divergence declaration names both kinds",
      Boolean(missing && extra),
      "one for what the live databases lack and one for what production has spare",
    );

    if (missing) {
      /* "eng_file_events.actor_id -> ..." reduced to the table.column the
       * replay reports, so the sentence and the fact are compared rather than
       * the sentence being taken on trust. */
      const named = missing.facts.map((f) => f.split(" ")[0]);
      const notInReplay = named.filter((n) => !replayFks.has(n));
      rec(
        `every foreign key declared missing from the live databases is one the migrations create (${named.length})`,
        notInReplay.length === 0,
        notInReplay.length
          ? `${notInReplay.join(", ")} is not created by any migration, so repairing it would change nothing`
          : "",
      );
      rec(
        "and each one says what it costs",
        Boolean(missing.costs && missing.costs.trim() && missing.orphans && missing.orphans.trim()),
        "a divergence with no consequence written down is a number nobody can act on",
      );
    }

    if (extra) {
      const alsoInReplay = extra.facts.filter((n) => replayIxs.has(n));
      rec(
        `every index declared production-only is one no migration creates (${extra.facts.length})`,
        alsoInReplay.length === 0,
        alsoInReplay.length
          ? `${alsoInReplay.join(", ")} IS created by a migration, so it is not a mystery`
          : "",
      );
    }
  }

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
