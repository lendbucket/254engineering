// @runtime react-server
//
// Declared because this audit imports retention-policy.ts, which carries
// `server-only`. scripts/lib/audit-runtime.mjs makes package.json agree.

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

import { readdirSync } from "node:fs";
import { readSource } from "./lib/read-source.mjs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { RETENTION_POLICY } from "../src/lib/retention-policy.ts";

const DIR = join(process.cwd(), "supabase", "migrations");

/**
 * The schema every migration replay must produce.
 *
 * Written down here rather than fetched, deliberately. Fetching it from
 * development would compare the migrations against a database that the same
 * mistake could have been applied to by hand, which is exactly how 0001 stayed
 * broken for a month. A constant has to be changed by a person who noticed.
 */
/*
 * Moved 2026-09-16 by 0049, which adds ten columns to eng_protocol_templates
 * and four check constraints. 1,049 to 1,059 is exactly those ten, and the
 * behaviour digest moves to c82264709f118e7155cf6cb32c9e5594 across 854 facts,
 * read off the replay rather than predicted.
 *
 * Changed by a person who noticed, which is what this constant is for.
 */
/*
 * Moved again 2026-09-18 by 0050, which adds eng_design_inquiries: one table,
 * 26 columns and four check constraints. 1,059 to 1,085 is exactly those 26,
 * and 76 tables to 77 is the one. The behaviour digest moves to
 * 61cea197e8bde99fdae5c2ca7c2ae1a1 across 863 facts, read off the replay rather
 * than predicted.
 *
 * Changed by a person who noticed, which is what this constant is for. The four
 * checks it failed on named the old figure and the new one side by side, which
 * is the whole reason it is a constant rather than a fetch.
 */
/*
 * Moved again 2026-09-18 by 0051, which adds eng_checklist_exceptions and
 * eng_determinations: two tables, 18 columns, four check constraints and one
 * trigger. 1,085 to 1,103 is exactly those 18, 77 tables to 79 is the two, and
 * 61 triggers to 62 is the append only guard on a determination. The behaviour
 * digest moves to e141b2f324c511c07b1239589e516b42 across 880 facts, read off
 * the replay rather than predicted.
 */
/*
 * 0052 adds NO columns and NO tables, and that is worth saying rather than
 * leaving as three unchanged numbers. It is entirely functions and triggers:
 * the approval door, the two guards that make it the only door, the deferred
 * assertion that a protocol in force holds its items, and the freeze on those
 * items. A migration that changes behaviour without changing shape leaves the
 * shape fingerprint untouched, which is the same thing 0008 did when it pinned
 * the search_paths.
 *
 * 62 triggers to 66 is exactly those four. 16 functions to 21 is the five they
 * are built from, eng_approve_protocol being the second in this schema after
 * eng_claim_jobs that is called directly rather than by a trigger.
 */
/*
 * Moved again 2026-09-19 by 0053, which gives the platform a word for a file
 * waiting on a property owner to have repairs done, and the table that holds
 * what he was asked to repair.
 *
 * 1,103 to 1,116 is exactly thirteen: `repairs_required_at` on eng_files, and
 * the twelve columns of eng_repair_items. 79 tables to 80 is the one. 66
 * triggers to 69 is the freeze on a repair item plus the two halves of the
 * no-conditional-certification guard, which fires from the file side and from
 * the repair item side because a list added to an already sealed file is the
 * direction a check written on the review path would never see. 21 functions to
 * 25 is those three plus the rule itself, which takes a file id so that neither
 * trigger function has to touch a column its own table does not have.
 */
/*
 * Moved again 2026-09-21 by 0054, which gives the windstorm brief on an
 * existing building its own table rather than more columns on the design one.
 *
 * 1,116 to 1,141 is exactly twenty five, all of them eng_windstorm_inquiries.
 * 80 tables to 81 is the one, and row level security is on it like the rest.
 * NO TRIGGERS AND NO FUNCTIONS, which is why those two figures do not move: it
 * is a table of answers to questions, with four check constraints and no
 * behaviour. A brief is not a record anything is derived from.
 *
 * The columns, so a future count can be checked against the reason for it
 * rather than against a number: id, created_at, name, email, phone, asking_as,
 * property_address, county, year_built, most_recent_work_year, work_done,
 * what_is_covered, openings_rated, will_open_up, deadline, and the three
 * flags, then respond_by, responded_at, responded_by, landing_path, referrer,
 * user_agent, status.
 */
const EXPECTED_FINGERPRINT = "56b351a693ec70cc86203fd0cbde481c";
const EXPECTED_COLUMNS = 1141;
const EXPECTED_TABLES = 81;
const EXPECTED_TRIGGERS = 69;
/**
 * 0014 added eng_freeze_attribution and 0019 added two more, the partner
 * entry freeze and its delete refusal, which are trigger functions like the
 * rest. 0031 adds eng_forbid_retention_run_delete, which refuses DELETE on the
 * retention manifest: a run that can erase its own record is a run with no
 * record. 0032 adds the last two, eng_forbid_record_delete for the money and
 * consent records and eng_forbid_sealed_work_delete for sealed engineering
 * work, which is what put a refusal underneath the seven tables the
 * declaration was keeping on its own word. eng_claim_jobs is still the only
 * one called directly.
 */
const EXPECTED_FUNCTIONS = 25;

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
  const body = readSource(join(DIR, f));
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
  const sql = readSource(join(DIR, f));
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

  /*
   * WHAT ACTUALLY STOPS A DELETE ON A KEPT-FOREVER TABLE, ASKED OF THE
   * CATALOGUE RATHER THAN OF THE PROSE THAT CLAIMS IT.
   *
   * retention-policy.ts declares 22 tables kept forever. Three of them said
   * they were kept BY THE FOREIGN KEYS and cited an OUTBOUND reference, which
   * is a true sentence about the wrong table: ON DELETE RESTRICT protects the
   * table a key POINTS AT, so eng_production_ledger referencing eng_profiles
   * keeps profiles and does nothing for the ledger. Read against pg_constraint
   * on 2026-09-09 those three had no delete trigger and nothing referencing
   * them with RESTRICT: the database would have allowed every row to go, while
   * the declaration read like a guarantee.
   *
   * Nothing could have caught it by reading, because the prose was internally
   * consistent. It was caught by asking the catalogue which direction the keys
   * point, and this is that question made permanent.
   *
   * The list below is a LITERAL, so a kept-forever table quietly losing its
   * trigger, or a new one arriving with no protection but this file, fails
   * here rather than being discovered the day somebody deletes from it.
   */
  // Empty since 0032. It was these seven, and the list stays as the mechanism:
  //   eng_documents, eng_evidence_items, eng_marketing_suppressions,
  //   eng_metrics_daily, and the three ledgers.
  // A kept-forever table arriving with no refusal, or losing the one it has,
  // now fails here rather than being discovered the day somebody deletes from it.
  const KEPT_BY_THIS_FILE_ALONE = [];

  {
    const kept = RETENTION_POLICY.filter((e) => e.rule.kind === "kept_forever").map((e) => e.table);
    rec(
      "the declaration names kept-forever tables at all",
      kept.length > 10,
      `${kept.length}; if this said zero the check below would pass over nothing`,
    );

    const guarded = await db.query(`
      select c.relname as t,
        exists (
          select 1 from pg_trigger tg
          where tg.tgrelid = c.oid and not tg.tgisinternal and (tg.tgtype & 8) = 8
        ) as has_delete_trigger,
        coalesce((
          select string_agg(p.proname, ',') from pg_trigger tg join pg_proc p on p.oid = tg.tgfoid
          where tg.tgrelid = c.oid and not tg.tgisinternal and (tg.tgtype & 8) = 8
        ), '') as delete_trigger_functions,
        exists (
          select 1 from pg_constraint fk
          where fk.contype = 'f' and fk.confrelid = c.oid and fk.confdeltype = 'r'
        ) as has_inbound_restrict
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'eng\_%'
    `);
    const byTable = new Map(guarded.rows.map((r) => [r.t, r]));

    const unguarded = kept
      .filter((t) => {
        const g = byTable.get(t);
        return g && !g.has_delete_trigger && !g.has_inbound_restrict;
      })
      .sort();

    const expected = [...KEPT_BY_THIS_FILE_ALONE].sort();
    rec(
      "every kept-forever table the database does not protect is one somebody listed",
      unguarded.length === expected.length && unguarded.every((t, i) => t === expected[i]),
      unguarded.length === expected.length && unguarded.every((t, i) => t === expected[i])
        ? `${unguarded.length} of ${kept.length} are kept by the declaration alone, and the other ${kept.length - unguarded.length} by a trigger or an inbound RESTRICT`
        : `the catalogue says [${unguarded.join(", ")}] and the list says [${expected.join(", ")}]`,
    );

    /*
     * AND THE CLAIM ITSELF, CHECKED IN THE DIRECTION IT IS MADE.
     *
     * The check above reads the catalogue, and it would have passed over the
     * original defect untouched: three entries asserted a database guarantee
     * that no key gave them, and the set of unprotected tables was the same
     * whether they said so or not. The defect was in the ASSERTION.
     *
     * THE CLAIM IS THE HELPER CALL, NOT THE SENTENCE IT RENDERS. A first
     * version of this matched the rendered text and went red on the three
     * entries that had just been CORRECTED, because their new wording
     * describes the mistake it warns about. A check that cannot tell a claim
     * from a description of one is a check on wording, which is the shape
     * CLAUDE.md already names as recurring here.
     *
     * RESTRICTED() and REFUSES_DELETE() are the only two ways this declaration
     * asserts a database guarantee, so the CALL is the claim. Parsing calls is
     * the idiom email-audit uses for compose(), and a narrative mention inside
     * another helper cannot look like one.
     */
    const policySrc = readSource("src/lib/retention-policy.ts");
    const entryStarts = [...policySrc.matchAll(/\{\s*table:\s*"(eng_[a-z0-9_]+)"/g)];
    rec(
      "the declaration's entries can be parsed one at a time",
      entryStarts.length === RETENTION_POLICY.length,
      `${entryStarts.length} parsed against ${RETENTION_POLICY.length} declared`,
    );

    const falseClaims = [];
    for (let i = 0; i < entryStarts.length; i += 1) {
      const table = entryStarts[i][1];
      const body = policySrc.slice(
        entryStarts[i].index,
        i + 1 < entryStarts.length ? entryStarts[i + 1].index : policySrc.length,
      );
      const g = byTable.get(table);
      if (!g) continue;

      if (/\bRESTRICTED\(/.test(body) && !g.has_inbound_restrict) {
        falseClaims.push(`${table} calls RESTRICTED() and nothing references it with ON DELETE RESTRICT`);
      }
      /*
     * Three ways this declaration asserts a trigger, and all three name the
     * function they are asserting. REFUSES_DELETE takes it as an argument;
     * REFUSES_RECORD_DELETE and REFUSES_SEALED_DELETE are constants added by
     * 0032 and each asserts exactly one, so the mapping is written here as a
     * literal rather than parsed out of their text.
     */
      const asserted = [];
      const named = body.match(/\bREFUSES_DELETE\("(eng_[a-z_]+)"\)/);
      if (named) asserted.push(named[1]);
      if (/\bREFUSES_RECORD_DELETE\b/.test(body)) asserted.push("eng_forbid_record_delete");
      if (/\bREFUSES_SEALED_DELETE\b/.test(body)) asserted.push("eng_forbid_sealed_work_delete");

      if (asserted.length) {
        const attached = String(g.delete_trigger_functions || "").split(",").filter(Boolean);
        for (const fn of asserted) {
          if (!attached.includes(fn)) {
            falseClaims.push(
              `${table} asserts ${fn} refuses its deletes and the triggers actually attached are ` +
                `[${attached.join(", ") || "none"}]`,
            );
          }
        }
      }
    }
    rec(
      "no kept-forever rule claims a guarantee the catalogue does not give it",
      falseClaims.length === 0,
      falseClaims.length ? falseClaims.join("; ") : "every asserted mechanism exists, in the direction it is asserted",
    );

    const missing = kept.filter((t) => !byTable.has(t));
    rec(
      "and every kept-forever table exists in the replayed schema",
      missing.length === 0,
      missing.length ? missing.join(", ") : `${kept.length} checked`,
    );
  }

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

  /*
   * ===================================================================
   * THE INCIDENT RECORD, 0042, AND WHY IT IS EXERCISED HERE AND NOWHERE
   * ELSE.
   * ===================================================================
   *
   * eng_incidents refuses DELETE. So a live audit that inserted a probe
   * incident could never remove it, and the firm's incident history would
   * permanently contain an event that did not happen. That is the exact
   * fabrication the migration's own header forbids.
   *
   * This is the same reasoning already applied to eng_partner_entries below:
   * a table whose guarantees cannot be cleaned up after gets exercised in the
   * replay, which is thrown away when this script exits.
   */
  await db.exec(`
    insert into eng_incidents (detected_at, detected_by, summary, severity)
    values (now(), 'migration-audit', 'written by migration-audit into a database that is about to be discarded', 'low')
  `);

  let incidentUpdate = true;
  try {
    await db.exec(`update eng_incidents set learned = 'an incident record is written to while it is open'`);
  } catch {
    incidentUpdate = false;
  }
  /*
   * THE UPDATE MUST SUCCEED, and asserting that is the point rather than an
   * oversight. The most valuable column on an incident is what was learned, and
   * it is filled in days after the row is written. A table that refused UPDATE
   * would push that into a second table nobody reads.
   */
  rec("an incident record accepts the update that fills in what was learned", incidentUpdate);

  let incidentDelete = false;
  try {
    await db.exec(`delete from eng_incidents`);
  } catch {
    incidentDelete = true;
  }
  rec("and an incident record refuses a DELETE", incidentDelete);

  /*
   * AND A RESOLVED INCIDENT CANNOT BE SILENT ABOUT WHAT WAS DONE. The check
   * constraint is the whole reason resolving is not just a timestamp: an
   * incident closed with an empty actions column is a record that says
   * something happened and nothing was done about it.
   */
  let refusedEmptyResolution = false;
  try {
    await db.exec(`update eng_incidents set resolved_at = now(), actions = '   '`);
  } catch {
    refusedEmptyResolution = true;
  }
  rec("and refuses to resolve an incident without saying what was done", refusedEmptyResolution);

  /*
   * ===================================================================
   * THE PARTNER LEDGER, EXERCISED HERE AND DELIBERATELY NOT ON A LIVE
   * DATABASE.
   *
   * 0019 refuses a DELETE on eng_partner_entries, on purpose: a test run able
   * to erase from the record of what a partner is owed is a worse property
   * than the rows it would remove. That is the same ruling the audit trail
   * carries, and it has the same consequence, which is that anything writing
   * to this table cannot clean up after itself.
   *
   * So the guarantees are exercised HERE, in the replayed database that is
   * thrown away when this audit ends, rather than in a live audit that would
   * leave a probe partner's earnings on development forever.
   * ===================================================================
   */
  await db.exec(`
    insert into eng_partners (id, organisation, contact_name, contact_email, code)
    values ('00000000-0000-4000-8000-0000000000aa', 'Probe Partner', 'Probe', 'probe@example.com', 'probe-ledger')
  `);

  const entry = async (over) => {
    const cols = {
      partner_id: "'00000000-0000-4000-8000-0000000000aa'",
      kind: "'accrual'",
      amount_cents: "1125",
      status: "'accrued'",
      explanation: "'written by migration-audit'",
      payable_at: "now()",
      ...over,
    };
    const keys = Object.keys(cols).join(", ");
    const values = Object.values(cols).join(", ");
    const { rows } = await db.query(
      `insert into eng_partner_entries (${keys}) values (${values}) returning id`,
    );
    return rows[0].id;
  };

  const accrualId = await entry({});

  let refusedAmountEdit = false;
  try {
    await db.exec(`update eng_partner_entries set amount_cents = 999999 where id = '${accrualId}'`);
  } catch {
    refusedAmountEdit = true;
  }
  rec(
    "an accrual refuses to have its amount changed",
    refusedAmountEdit,
    "a figure that can move after the fact is a figure a partner cannot reconcile",
  );

  let refusedExplanationEdit = false;
  try {
    await db.exec(`update eng_partner_entries set explanation = 'something else' where id = '${accrualId}'`);
  } catch {
    refusedExplanationEdit = true;
  }
  rec("and refuses to have its reason rewritten", refusedExplanationEdit);

  /*
   * The one change that IS allowed, and it has to be, or a statement could
   * never claim anything. A freeze that refused this would have been the
   * simpler trigger and the wrong one.
   */
  await db.exec(`
    insert into eng_partner_statements (id, partner_id, reference, period)
    values ('00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000aa', '254-P202609-PROBE', '2026-09')
  `);
  let claimed = false;
  try {
    await db.exec(
      `update eng_partner_entries set statement_id = '00000000-0000-4000-8000-0000000000bb' where id = '${accrualId}'`,
    );
    claimed = true;
  } catch {
    claimed = false;
  }
  rec("but a statement may claim it, which is the one change a close makes", claimed);

  /*
   * On its OWN entry, not the one the rest of this section builds on. The
   * first version deleted the accrual under test, so when the refusal was
   * injected away the delete SUCCEEDED and the next insert failed on a foreign
   * key to a row that was no longer there. The audit crashed instead of
   * failing, which reads as "caught it" and is not the same thing.
   */
  const deletableId = await entry({});
  let refusedEntryDelete = false;
  try {
    await db.exec(`delete from eng_partner_entries where id = '${deletableId}'`);
  } catch {
    refusedEntryDelete = true;
  }
  rec("an entry is never deleted", refusedEntryDelete, "a mistake is answered with an adjustment beside it");

  /*
   * A reversal is the counter entry, and it is a different row rather than a
   * smaller accrual. Both stand and the two net.
   */
  const reversalId = await entry({
    kind: "'reversal'",
    amount_cents: "-1125",
    reverses_id: `'${accrualId}'`,
  });
  rec("a reversal stands beside the accrual rather than replacing it", Boolean(reversalId));

  let refusedPositiveReversal = false;
  try {
    await entry({ kind: "'reversal'", amount_cents: "500" });
  } catch {
    refusedPositiveReversal = true;
  }
  rec("a reversal cannot be positive", refusedPositiveReversal);

  let refusedNegativeAccrual = false;
  try {
    await entry({ amount_cents: "-500" });
  } catch {
    refusedNegativeAccrual = true;
  }
  rec("and an accrual cannot be negative", refusedNegativeAccrual);

  /*
   * Blocked and having no figure are one fact. Either half without the other
   * is refused, so nothing can sit in the ledger as a zero that was meant to
   * be an absence.
   */
  let refusedBlockedWithAmount = false;
  try {
    await entry({ status: "'blocked'", amount_cents: "1000" });
  } catch {
    refusedBlockedWithAmount = true;
  }
  rec("an entry cannot be blocked and carry a figure", refusedBlockedWithAmount);

  let refusedAmountlessAccrual = false;
  try {
    await entry({ amount_cents: "null" });
  } catch {
    refusedAmountlessAccrual = true;
  }
  rec("and cannot be accrued with no figure", refusedAmountlessAccrual);

  const blockedId = await entry({ status: "'blocked'", amount_cents: "null" });
  rec("a blocked entry with no figure is allowed, which is the point of it", Boolean(blockedId));

  /*
   * Idempotence, which is the guarantee that stops a retried delivery paying
   * twice. Exercised on the file index, the one a retry actually hits.
   */
  await db.exec(`
    insert into eng_clients (id, kind, name) values ('00000000-0000-4000-8000-0000000000dd', 'individual', 'Probe Client');
  `);
  await db.exec(`
    insert into eng_files (id, client_id, file_number, property_address, county, service_slug)
    values ('00000000-0000-4000-8000-0000000000cc', '00000000-0000-4000-8000-0000000000dd', '254-PROBE-0001', '1 Probe Street', 'Nueces', 'windstorm')
  `);
  await entry({ file_id: "'00000000-0000-4000-8000-0000000000cc'" });

  let refusedSecondAccrual = false;
  try {
    await entry({ file_id: "'00000000-0000-4000-8000-0000000000cc'" });
  } catch {
    refusedSecondAccrual = true;
  }
  rec(
    "one file cannot accrue twice",
    refusedSecondAccrual,
    "a retried job that pays twice is the failure nobody notices until the partner does",
  );

  /*
   * And a reversal on the same file IS allowed, because the index is on
   * accruals alone. An index that stopped this would have made a refund
   * unrecordable, which is the mistake a narrower rule invites.
   */
  let reversalAllowedOnSameFile = false;
  try {
    await entry({
      kind: "'reversal'",
      amount_cents: "-1125",
      file_id: "'00000000-0000-4000-8000-0000000000cc'",
    });
    reversalAllowedOnSameFile = true;
  } catch {
    reversalAllowedOnSameFile = false;
  }
  rec("while a reversal on that same file is allowed", reversalAllowedOnSameFile);

  /*
   * ===================================================================
   * 0032, AND THE ONLY PLACE A SEAL CAN BE WRITTEN AT ALL.
   * ===================================================================
   *
   * eng_forbid_sealed_work_delete refuses a sealed deliverable, and every row
   * belonging to a file that has one, including a delete cascading from
   * eng_files. It refuses NOTHING on either live database, because the firm
   * has no licensed PE and nothing in this platform is sealed or can be, so a
   * live check would report a pass over an empty list forever and be exercised
   * for the first time in production.
   *
   * Proving it needs a row with sealed_at set, and writing one to a live
   * database would be a fabricated sealing record on the firm's regulatory
   * memory, which is forbidden outright. THIS DATABASE IS THROWN AWAY at the
   * end of this file, which is the same treatment eng_partner_entries has had
   * since 0019 and for exactly the same reason.
   *
   * Both directions are checked, because a trigger that refuses everything
   * would pass the first half and be a worse defect than the hole it closes:
   * an unsealed file's evidence has no ruling yet and must stay deletable.
   */
  const SEALED_FILE = "'00000000-0000-4000-8000-0000000000ab'";
  const OPEN_FILE = "'00000000-0000-4000-8000-0000000000ac'";

  await db.exec(`
    insert into eng_files (id, client_id, file_number, property_address, county, service_slug)
    values (${SEALED_FILE}, '00000000-0000-4000-8000-0000000000dd', '254-PROBE-SEAL', '2 Probe Street', 'Nueces', 'windstorm'),
           (${OPEN_FILE}, '00000000-0000-4000-8000-0000000000dd', '254-PROBE-OPEN', '3 Probe Street', 'Nueces', 'windstorm');

    insert into eng_documents (id, file_id, kind, title, bucket, storage_key, sealed_at)
    values ('00000000-0000-4000-8000-0000000000b1', ${SEALED_FILE}, 'deliverable', 'Probe sealed letter', 'docs', 'probe/sealed', now());

    insert into eng_documents (id, file_id, kind, title, bucket, storage_key)
    values ('00000000-0000-4000-8000-0000000000b2', ${OPEN_FILE}, 'deliverable', 'Probe draft', 'docs', 'probe/draft');

    insert into eng_evidence_items (id, file_id, item_key, kind)
    values ('00000000-0000-4000-8000-0000000000e1', ${SEALED_FILE}, 'probe', 'note'),
           ('00000000-0000-4000-8000-0000000000e2', ${OPEN_FILE}, 'probe', 'note');
  `);

  const attempt = async (sql) => {
    try {
      await db.exec(sql);
      return null;
    } catch (err) {
      return String(err.message ?? err).split("\n")[0].slice(0, 130);
    }
  };
  const refused = async (sql) => (await attempt(sql)) !== null;

  rec(
    "a sealed deliverable cannot be deleted",
    await refused("delete from eng_documents where id = '00000000-0000-4000-8000-0000000000b1'"),
    "a seal is a Professional Engineer's own act and the record of it outlives everything else",
  );

  /*
   * AND ONE WITH NO FILE AT ALL, WHICH IS THE ONLY CASE THE FIRST BRANCH OF
   * THAT TRIGGER ACTUALLY DECIDES.
   *
   * The check above passed with the sealed_at branch injected out, and it
   * was right to: a sealed document attached to a file is already protected
   * by the second branch, because the file it hangs off has a sealed
   * document, namely itself. So that injection proved nothing and the branch
   * was never load bearing.
   *
   * eng_documents.file_id is NULLABLE. A sealed firm document with no file
   * is protected by the first branch alone, and by nothing else.
   */
  await db.exec(`
    insert into eng_documents (id, kind, title, bucket, storage_key, sealed_at)
    values ('00000000-0000-4000-8000-0000000000b3', 'firm_document', 'Probe sealed, no file', 'docs', 'probe/loose', now());
  `);
  rec(
    "a sealed document with no file is refused by the branch that is only about sealing",
    await refused("delete from eng_documents where id = '00000000-0000-4000-8000-0000000000b3'"),
    "the only case the sealed_at test decides on its own; everything else is covered by its file",
  );
  rec(
    "nor can the evidence of a file that has one",
    await refused("delete from eng_evidence_items where id = '00000000-0000-4000-8000-0000000000e1'"),
    "the binder is kept with the file the operator ruled is kept forever",
  );
  rec(
    "nor the sealed file itself, which the cascade would have taken them with",
    await refused(`delete from eng_files where id = ${SEALED_FILE}`),
    "eng_documents and eng_evidence_items cascade from eng_files, and a BEFORE DELETE trigger fires on a cascade",
  );

  /*
   * The other direction, and it is the half that stops this being a blanket
   * refusal nobody meant. Evidence on an UNSEALED file has no ruling yet and
   * sits under pending counsel with everything else.
   */
  const openEvidence = await attempt(
    "delete from eng_evidence_items where id = '00000000-0000-4000-8000-0000000000e2'",
  );
  rec(
    "and evidence on an unsealed file is still deletable, which is the ruling",
    openEvidence === null,
    openEvidence === null
      ? "a trigger that refused everything would have answered a question that is still with counsel"
      : `REFUSED: ${openEvidence}`,
  );
  const openDoc = await attempt(
    "delete from eng_documents where id = '00000000-0000-4000-8000-0000000000b2'",
  );
  rec(
    "and so is an unsealed document",
    openDoc === null,
    openDoc === null ? "the rule is about sealed work, and a draft is not sealed work" : `REFUSED: ${openDoc}`,
  );

  /*
   * And the five with no condition on them at all.
   */
  await db.exec(`
    insert into eng_metrics_daily (day, metric, value) values ('2019-01-01', 'probe.metric', 1);
    insert into eng_marketing_suppressions (email, because) values ('probe@example.com', 'probe');
  `);
  rec(
    "a rollup row cannot be deleted",
    await refused("delete from eng_metrics_daily where metric = 'probe.metric'"),
    "it is the only remaining record of a day whose sources retention already took",
  );
  rec(
    "nor a suppression",
    await refused("delete from eng_marketing_suppressions where email = 'probe@example.com'"),
    "deleting the row does not undo the asking, it resumes the writing",
  );

  /*
   * =========================================================================
   * 0052: AN APPROVAL AND ITS ITEMS ARE ONE ACT.
   * =========================================================================
   *
   * WHY THIS IS EXERCISED HERE AND NOWHERE ELSE, WHICH IS A RULING RATHER THAN
   * A CONVENIENCE. The operator's standing limit is that no protocol is
   * approved on the engineer's behalf by any path, "including a development
   * fixture that could be mistaken for the real thing". A live audit that
   * approves a protocol on development would leave a row saying a named
   * engineer put a service line in force, and eng_protocol_templates.approved_by
   * is ON DELETE RESTRICT, so it would be there for good.
   *
   * This database is built in process from the migration files and thrown away
   * at the end of the run. Nothing here can be mistaken for the real thing,
   * because nothing here survives the process. It is the same reasoning 0019's
   * partner ledger guarantees are exercised under, written down again because
   * the reason is what makes it allowed.
   *
   * The approver is a probe profile, and it is a probe in the obvious way
   * rather than the plausible way.
   */
  {
    /*
     * A FAILED TRANSACTION BLOCK LEAVES THE SESSION ABORTED, and every read
     * after it then errors with "current transaction is aborted" rather than
     * answering. The first version of this section had no rollback and the
     * whole audit died on the NEXT query, several checks later, naming a select
     * that was fine. Rolling back explicitly keeps a refusal a refusal.
     */
    const attemptTxn = async (sql) => {
      const err = await attempt(sql);
      if (err) await attempt("rollback");
      return err;
    };

    const T = "'00000000-0000-4000-8000-0000000000c1'";
    const ENG = "'00000000-0000-4000-8000-0000000000c9'";
    const ITEMS = `'[
      {"sort_order":0,"item_key":"probe-a","kind":"photo","label":"A probe item","required":true},
      {"sort_order":1,"item_key":"probe-b","kind":"note","label":"A second probe item","required":true}
    ]'::jsonb`;

    await db.exec(`
      insert into auth.users (id) values (${ENG});
      insert into eng_profiles (id, email, display_name, role)
      values (${ENG}, 'probe-engineer@example.com', 'Probe Engineer, not a real person', 'engineer');

      insert into eng_protocol_templates (id, service_slug, name, version, status, document_signed_at)
      values (${T}, 'probe-service', 'A probe protocol', 1, 'awaiting_engineer', '2026-01-01');

      /*
       * A DRAFT IS INSERTED BY NAME rather than looked for, because the first
       * version of the unsigned check read "where status = draft limit 1" and
       * the replay holds no draft at all. It passed, and it passed on "no
       * protocol template null" rather than on the status refusal it is named
       * after. An injection that goes red for the wrong reason is the same
       * defect as one that stays green, and so is a pass.
       */
      insert into eng_protocol_templates (id, service_slug, name, version, status)
      values ('00000000-0000-4000-8000-0000000000c3', 'probe-draft', 'An unsigned draft', 1, 'draft');

      /*
       * AND THIS TEMPLATE IS GIVEN AN ITEM BEFORE ANYBODY TRIES TO PUBLISH IT
       * BY HAND, which is the whole point of the next check and was missing
       * from its first version.
       *
       * Without an item, the stray UPDATE below is refused by the DEFERRED
       * assertion, because a template reaching published with no items fails at
       * commit whatever door it came through. The check was named for the
       * one-door trigger and was answered by a different guard, and removing
       * the one-door trigger left it green. With an item present, the deferred
       * assertion is satisfied and the only thing standing between this UPDATE
       * and a protocol in force is the guard under test.
       */
      insert into eng_protocol_items (template_id, sort_order, item_key, kind, label, required)
      values (${T}, 0, 'seeded-before-approval', 'note', 'Present before anybody approves', true);
    `);

    const strayUpdate = await attempt(`update eng_protocol_templates set status = 'published', published_at = now(),
                     approved_by = ${ENG}, approved_at = now(), approved_by_license = 'PROBE'
                     where id = ${T}`);
    rec(
      "a protocol cannot be put in force by an UPDATE, which is how it was put in force yesterday",
      strayUpdate !== null && strayUpdate.includes("eng_approve_protocol"),
      strayUpdate ?? "the UPDATE went through, so the door is a convenience",
    );

    /*
     * BORN IN FORCE, WITH ITS ITEMS, for the same reason: an insert of a
     * published template with no items is refused by the deferred assertion, so
     * the items are written in the same transaction and the only guard left is
     * the one this check is named after.
     */
    const bornInForce = await attemptTxn(`
      begin;
      insert into eng_protocol_templates (id, service_slug, name, version, status, approved_by, approved_at, published_at, approved_by_license)
      values ('00000000-0000-4000-8000-0000000000c4', 'probe-born', 'Born in force', 1, 'published', ${ENG}, now(), now(), 'PROBE');
      insert into eng_protocol_items (template_id, sort_order, item_key, kind, label, required)
      values ('00000000-0000-4000-8000-0000000000c4', 0, 'born-a', 'note', 'An item', true);
      commit;
    `);
    rec(
      "nor created already in force, which is the shape a seeder reaches for",
      bornInForce !== null && bornInForce.includes("already in force"),
      bornInForce ?? "it was created in force, so a seeder can put a service line on sale",
    );

    /*
     * THE DOOR'S OWN REFUSAL, TOLD APART FROM THE DEFERRED ONE BY WHAT IT SAYS.
     *
     * Both guards make an empty approval impossible, and that redundancy is
     * deliberate. But they are not interchangeable to the person who called it:
     * the door names the seeding and says an approval seeds items, while the
     * deferred assertion names a row id at commit. Removing the door's guard
     * left this check green until it asked which mechanism answered, because
     * "the transaction aborted" was true either way.
     */
    const seedsNothing = await attempt(`select eng_approve_protocol(${T}, ${ENG}, 'PROBE', '[]'::jsonb)`);
    rec(
      "and the door refuses an approval that seeds nothing, in its own words",
      seedsNothing !== null && seedsNothing.includes("seeds the protocol items"),
      seedsNothing ?? "an approved protocol whose items do not exist is approved in name only",
    );

    const unsigned = await attempt(
      `select eng_approve_protocol('00000000-0000-4000-8000-0000000000c3', ${ENG}, 'PROBE', ${ITEMS})`,
    );
    rec(
      "and refuses to approve a protocol the engineer has not signed",
      unsigned !== null && unsigned.includes("awaiting_engineer"),
      unsigned ?? "it approved an unsigned draft",
    );

    const approved = await attempt(`select eng_approve_protocol(${T}, ${ENG}, 'PROBE', ${ITEMS})`);
    rec(
      "the door itself opens, and the items arrive with the approval",
      approved === null,
      approved ?? "approved in one call",
    );

    /*
     * AND THE SEEDING IS WHAT ARRIVED, not merely that something did. A door
     * that reports success having written nothing is the vacuous green this
     * repository keeps finding, so the rows are counted rather than assumed.
     */
    const seeded = await db.query(
      `select count(*)::int as n, count(*) filter (where required)::int as req
         from eng_protocol_items where template_id = ${T}`,
    );
    rec(
      "and it wrote the items rather than reporting that it had",
      seeded.rows[0].n === 2 && seeded.rows[0].req === 2,
      `${seeded.rows[0].n} items, ${seeded.rows[0].req} required`,
    );

    const inForce = await db.query(
      `select status, approved_by is not null as named, published_at is not null as dated
         from eng_protocol_templates where id = ${T}`,
    );
    rec(
      "and the template is in force, named and dated, which 0049 requires of it",
      inForce.rows[0].status === "published" && inForce.rows[0].named && inForce.rows[0].dated,
      `${inForce.rows[0].status}, named ${inForce.rows[0].named}, dated ${inForce.rows[0].dated}`,
    );

    rec(
      "a protocol in force cannot then have its items removed",
      await refused(`delete from eng_protocol_items where template_id = ${T}`),
      "an approval that can be hollowed out afterwards is an approval with a hole in it",
    );
    rec(
      "nor edited under a technician who is working them",
      await refused(`update eng_protocol_items set label = 'Something else' where template_id = ${T}`),
      "a submission gate that moves while somebody is clearing it, on a roof, on a phone",
    );

    /*
     * THE DEFERRED ASSERTION, WHICH NEEDS A TRANSACTION TO BE VISIBLE AT ALL.
     * Inside the approval transaction the items may be written in any order, so
     * the question is asked at COMMIT. A transaction that reaches 'published'
     * with no items must therefore fail at COMMIT rather than at the UPDATE,
     * and that is a different moment worth exercising rather than assuming.
     */
    const deferredVerdict = await attemptTxn(`
      begin;
      insert into eng_protocol_templates (id, service_slug, name, version, status, document_signed_at)
      values ('00000000-0000-4000-8000-0000000000c2', 'probe-empty', 'An empty approval', 1, 'awaiting_engineer', '2026-01-01');
      select set_config('eng.approving', '00000000-0000-4000-8000-0000000000c2', true);
      update eng_protocol_templates set status = 'published', published_at = now(),
             approved_by = ${ENG}, approved_at = now(), approved_by_license = 'PROBE'
       where id = '00000000-0000-4000-8000-0000000000c2';
      commit;
    `);
    rec(
      "and a transaction that reaches published with no items fails at COMMIT",
      deferredVerdict !== null,
      deferredVerdict ?? "it committed, so the deferred assertion is not asking anything",
    );

    /*
     * =====================================================================
     * IS requires_discipline FROZEN ONCE A PROTOCOL IS IN FORCE?
     * Operator question, 2026-09-21, asked before migration 0056 is prepared.
     * =====================================================================
     *
     * THE ANSWER IS NO, AND IT IS PROVED HERE RATHER THAN READ. Reading the
     * chain says nothing guards that column: 0049 adds it as a plain text
     * column with a comment, no constraint or trigger anywhere names it, and
     * `eng_approve_protocol` writes only status, published_at, approved_by,
     * approved_at and approved_by_license.
     *
     * But "I read every migration and found nothing" is an argument from
     * absence, and this repository has a rule about those: a recorded
     * explanation is a hypothesis until something re-checks it. A trigger on
     * another table, a rule function reached by cascade, or a constraint
     * written against a column list rather than a name would all be invisible
     * to that reading. So the question is put to a real database.
     *
     * WHY IT MATTERS FOR 0056. If the column were frozen at publication, the
     * discipline would have to be written BEFORE the engineer approves, and
     * the migration would be blocking on his approval. It is not, so 0056 can
     * land either side. The answer changes the sequencing rather than the SQL,
     * which is exactly the kind of thing worth knowing before a production
     * sitting rather than during one.
     */
    const publishedProbe = "00000000-0000-4000-8000-0000000000d1";
    const disciplineAfter = await attemptTxn(`
      begin;
      insert into eng_protocol_templates (id, service_slug, name, version, status, document_signed_at, requires_discipline)
      values ('${publishedProbe}', 'probe-discipline', 'A protocol that goes in force', 1, 'awaiting_engineer', '2026-01-01', null);
      insert into eng_protocol_items (template_id, sort_order, item_key, kind, label, required)
      values ('${publishedProbe}', 0, 'probe-item', 'note', 'Something to make the approval real', true);
      select set_config('eng.approving', '${publishedProbe}', true);
      update eng_protocol_templates set status = 'published', published_at = now(),
             approved_by = ${ENG}, approved_at = now(), approved_by_license = 'PROBE'
       where id = '${publishedProbe}';
      update eng_protocol_templates set requires_discipline = 'structural'
       where id = '${publishedProbe}';
      commit;
    `);

    rec(
      "requires_discipline is NOT frozen when a protocol goes in force, which decides 0056's sequencing",
      disciplineAfter === null,
      disciplineAfter === null
        ? "a published protocol accepted a discipline it did not have, so 0056 may land either side of the engineer's approval"
        : `it was refused: ${disciplineAfter}. 0056 must land BEFORE approval.`,
    );

    /*
     * AND THE PROBE ACTUALLY REACHED THE STATE IT CLAIMS TO HAVE TESTED,
     * because a transaction that failed at the INSERT would also report "not
     * refused" for the update it never ran. The green above means nothing
     * without this.
     */
    const probeState = await db.query(
      `select status, requires_discipline from eng_protocol_templates where id = '${publishedProbe}'`,
    );
    rec(
      "and that probe really did reach published carrying the discipline",
      probeState.rows.length === 1 &&
        probeState.rows[0].status === "published" &&
        probeState.rows[0].requires_discipline === "structural",
      probeState.rows.length === 1
        ? `status ${probeState.rows[0].status}, requires_discipline ${probeState.rows[0].requires_discipline}`
        : "the probe row is not there at all, so the check above passed over a transaction that never happened",
    );

    /*
     * =====================================================================
     * 0053: THERE IS NO CONDITIONAL CERTIFICATION.
     * =====================================================================
     *
     * Exercised here for the same reason the approval door is: these are
     * guarantees about SEALING, and a live fixture that seals a file on
     * development would put a sealed engineering deliverable on a real database
     * under a probe engineer's name, on a table that refuses deletes. This
     * database is built from the files and thrown away.
     */
    const F = "'00000000-0000-4000-8000-0000000000f1'";
    const CL = "'00000000-0000-4000-8000-0000000000f2'";
    const DET = "'00000000-0000-4000-8000-0000000000f3'";

    await db.exec(`
      insert into eng_clients (id, kind, name) values (${CL}, 'individual', 'Probe Client, not a real person');
      insert into eng_files (id, client_id, file_number, property_address, county, service_slug, status)
      values (${F}, ${CL}, '254-PROBE-0053', '1 Probe Street', 'Nueces', 'roof-certification', 'under_review');
      insert into eng_evidence_items (id, file_id, item_key, kind)
      values ('00000000-0000-4000-8000-0000000000f4', ${F}, 'probe', 'note');
      insert into eng_determinations (id, file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, engineer_id)
      values (${DET}, ${F}, '254-RC-001', 'repairs-required', array['probe'], array['00000000-0000-4000-8000-0000000000f4'::uuid], ${ENG});
    `);

    rec(
      "a file can be waiting on an owner, which is a word the vocabulary did not have",
      (await attempt(`update eng_files set status = 'repairs_required', repairs_required_at = now() where id = ${F}`)) === null,
      "not in review, not sealed, not declined, not abandoned",
    );

    rec(
      "a repair requirement of whitespace is a requirement of nothing",
      await refused(`insert into eng_repair_items (file_id, determination_id, requirement, raised_by)
                     values (${F}, ${DET}, '   ', ${ENG})`),
      "the same rule 0051 put on an exception's reason, and for the same reason",
    );

    await db.exec(`
      insert into eng_repair_items (id, file_id, determination_id, sort_order, requirement, raised_by)
      values ('00000000-0000-4000-8000-0000000000f5', ${F}, ${DET}, 0, 'Reseal the flashing at the rear penetration', ${ENG}),
             ('00000000-0000-4000-8000-0000000000f6', ${F}, ${DET}, 1, 'Replace the creased tabs on the west plane', ${ENG});
    `);

    const sealWithOpen = await attempt(
      `update eng_files set status = 'sealed', sealed_at = now() where id = ${F}`,
    );
    rec(
      "and it cannot be sealed while a repair item is open",
      /*
       * MATCHED ON A PHRASE THAT SURVIVES THE TRUNCATION. `attempt` clips an
       * error at 130 characters, and the first version of this asserted
       * "no conditional certification", which the refusal does say and which
       * falls just past the clip. The check went red on a guard that had worked
       * perfectly. A check on wording is a check on wording even when the
       * wording is right.
       */
      sealWithOpen !== null && sealWithOpen.includes("open repair item"),
      sealWithOpen ?? "it sealed with an open repair list, which the protocol does not permit",
    );

    /*
     * CLOSING ONE OF TWO IS NOT CLOSING THE LIST, which is the operator's
     * sentence made mechanical: every item on that list individually closed.
     */
    await db.exec(`update eng_repair_items set closed_at = now(), closed_by = ${ENG}
                   where id = '00000000-0000-4000-8000-0000000000f5'`);
    const sealWithOne = await attempt(
      `update eng_files set status = 'sealed', sealed_at = now() where id = ${F}`,
    );
    rec(
      "and closing one of two is not closing the list",
      sealWithOne !== null,
      sealWithOne ?? "one item closed was enough, so the list is being read as a single flag",
    );

    rec(
      "a closed repair item does not reopen",
      await refused(`update eng_repair_items set closed_at = null, closed_by = null
                     where id = '00000000-0000-4000-8000-0000000000f5'`),
      "a repair wrongly verified is a new determination, not an edit under a letter",
    );
    rec(
      "and what the engineer required cannot be rewritten",
      await refused(`update eng_repair_items set requirement = 'Something easier'
                     where id = '00000000-0000-4000-8000-0000000000f6'`),
      "only the closing of an item may be recorded",
    );
    rec(
      "nor removed, because it is the record of why certification was withheld",
      await refused(`delete from eng_repair_items where id = '00000000-0000-4000-8000-0000000000f6'`),
      "it is closed, never deleted",
    );

    await db.exec(`update eng_repair_items set closed_at = now(), closed_by = ${ENG}
                   where id = '00000000-0000-4000-8000-0000000000f6'`);
    const sealedAtLast = await attempt(
      `update eng_files set status = 'sealed', sealed_at = now() where id = ${F}`,
    );
    rec(
      "and with every item closed it seals, which is the half that proves the guard is not just refusing everything",
      sealedAtLast === null,
      sealedAtLast ?? "certification proceeds only after repairs are verified, and then it proceeds",
    );

    /*
     * THE DIRECTION A CHECK ON THE REVIEW PATH WOULD NEVER SEE. Nothing in the
     * workflow adds a repair item to a sealed file, which is exactly why it is
     * worth making impossible before somebody writes the path that would.
     */
    rec(
      "and a repair list cannot be added to a file that is already sealed",
      await refused(`insert into eng_repair_items (file_id, determination_id, requirement, raised_by)
                     values (${F}, ${DET}, 'Something noticed after the seal', ${ENG})`),
      "the guard fires from the repair item side too, not only from the file",
    );
  }
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
