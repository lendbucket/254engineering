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

import { readdirSync, readFileSync } from "node:fs";
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
const EXPECTED_FINGERPRINT = "d4f266b0d595c9c2922b68971b9cec2a";
const EXPECTED_COLUMNS = 994;
const EXPECTED_TABLES = 73;
const EXPECTED_TRIGGERS = 48;
/**
 * 0014 added eng_freeze_attribution and 0019 added two more, the partner
 * entry freeze and its delete refusal, which are trigger functions like the
 * rest. 0031 adds eng_forbid_retention_run_delete, which refuses DELETE on the
 * retention manifest: a run that can erase its own record is a run with no
 * record. eng_claim_jobs is still the only one called directly.
 */
const EXPECTED_FUNCTIONS = 10;

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
  const KEPT_BY_THIS_FILE_ALONE = [
    "eng_documents",
    "eng_evidence_items",
    "eng_marketing_suppressions",
    "eng_metrics_daily",
    "eng_production_ledger",
    "eng_tech_pay_ledger",
    "eng_time_log",
  ];

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
    const policySrc = readFileSync("src/lib/retention-policy.ts", "utf8");
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
      const named = body.match(/\bREFUSES_DELETE\("(eng_[a-z_]+)"\)/);
      if (named) {
        const attached = String(g.delete_trigger_functions || "").split(",").filter(Boolean);
        if (!attached.includes(named[1])) {
          falseClaims.push(
            `${table} calls REFUSES_DELETE("${named[1]}") and the delete triggers actually attached are ` +
              `[${attached.join(", ") || "none"}]`,
          );
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
