/**
 * DID PRODUCTION ACTUALLY GET WHAT THE LEDGER SAYS IT GOT.
 *
 *   ALLOW_PRODUCTION_DB=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/production-schema-check.mjs
 *
 * Run this after any merge carrying a migration. It is the other half of
 * `schema-ledger-audit`, and the two answer different questions:
 *
 *   schema-ledger-audit  Was somebody ASKED whether production has this?
 *   this                 Does production HAVE it?
 *
 * The first runs in the suite with no credentials and catches the failure that
 * actually happened, which was a question nobody was made to answer. It cannot
 * see production, because that needs the service role key and standing law
 * keeps it out of the working tree. This one can, and therefore cannot live in
 * the suite. Both are needed and neither is the other.
 *
 * HOW IT ASKS, GIVEN POSTGREST CANNOT SEE information_schema
 * -----------------------------------------------------------
 * The fingerprint in CLAUDE.md section 6b is computed from information_schema,
 * which the API does not expose, so this cannot recompute it and does not
 * pretend to. Instead every ledger entry declares what its migration uniquely
 * PUTS IN THE SCHEMA: a table, a column on a table, or a row that must exist.
 * Each of those is reachable through the ordinary API, so this asks the
 * database about all twenty four rather than about one.
 *
 * That is a different claim from the fingerprint and in one way a better one:
 * the fingerprint says the shape matches, and this says migration by migration
 * which one is missing. In September the answer would have been one line.
 *
 * IT WRITES NOTHING
 * -----------------
 * Head counts and zero row selects. That is what makes it one of the few things
 * this repository will point at production at all, alongside security-audit and
 * db-guard-audit.
 *
 * WHAT A FAILURE HERE MEANS
 * -------------------------
 * Not a record keeping problem. The deployed code expects a schema the database
 * does not have, and the way that surfaces is whatever the missing thing was
 * for. In September it was eng_alert_state: the queue depth alerting could not
 * read its cooldown, and the failure waiting to happen was an email every five
 * minutes about a stuck queue, which is the exact thing the migration was
 * written to prevent.
 */

import { auditClient, describeTarget, isProduction } from "./lib/db-target.mjs";
import { appliedToProduction, pending, assertNotEmpty } from "../supabase/applied.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("========== WHAT THE DATABASE ACTUALLY HAS ==========");
console.log(`${describeTarget(process.env.SUPABASE_URL)}`);

const db = auditClient("production-schema-check");
if (!db) {
  console.log("");
  console.log("No client. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set,");
  console.log("and reaching production needs ALLOW_PRODUCTION_DB=1.");
  process.exit(1);
}

/*
 * Meant for production and not restricted to it: pointing it at development is
 * a legitimate way to ask the same question of the other project. What it must
 * never do is stay quiet about which one it read, because a report that does
 * not name its subject is a report about nothing.
 */
const onProduction = isProduction(process.env.SUPABASE_URL);
console.log(`Reading ${onProduction ? "PRODUCTION" : "this project"}. Nothing is written.`);
console.log("");

// --------------------------------------------------------------- the canary

let ledger;
try {
  ledger = assertNotEmpty();
} catch (e) {
  console.log(`FAIL: ${e.message}`);
  process.exit(1);
}

const declared = appliedToProduction();
rec(
  `the ledger declares migrations as applied (${declared.length})`,
  declared.length > 0,
  declared.length ? "" : "nothing is declared applied, so every check below would pass over nothing",
);

const probeable = declared.filter((e) => e.proves);
rec(
  `and ${probeable.length} of them declare something this can ask about`,
  probeable.length > 0 && probeable.length >= declared.length - 1,
  `${declared.length - probeable.length} cannot be probed through the API`,
);

// ------------------------------------------------- ask about each of them

const missing = [];

for (const entry of declared) {
  if (!entry.proves) continue;
  const { table, column, match } = entry.proves;

  let ok = false;
  let detail = "";

  if (match) {
    /* A row that must exist. 0021 seeds one grant and creates nothing. */
    let q = db.from(table).select("*", { count: "exact", head: true });
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { count, error } = await q;
    ok = !error && (count ?? 0) > 0;
    detail = error ? error.message : `${count} row(s)`;
  } else {
    /*
     * A zero row select. It costs nothing and still fails when the table or
     * the column is absent, because PostgREST resolves the name before it
     * decides there is nothing to return.
     */
    const { error } = await db.from(table).select(column ?? "*").limit(0);
    ok = !error;
    detail = error ? error.message : column ? `${table}.${column} resolves` : `${table} resolves`;
  }

  if (!ok) missing.push({ entry, detail });
}

rec(
  `every applied migration's mark is present (${probeable.length - missing.length} of ${probeable.length})`,
  missing.length === 0,
  missing.length
    ? missing
        .map(
          (m) =>
            `${m.entry.file} is declared applied on ${m.entry.production} and its ${
              m.entry.proves.column ? "column" : m.entry.proves.match ? "row" : "table"
            } is not there (${m.detail})`,
        )
        .join(" | ")
    : "",
);

for (const e of declared.filter((x) => !x.proves)) {
  console.log(`  NOTE: ${e.file} was not probed. ${e.provesNote ?? "It declares nothing probeable."}`);
}

// ------------------------------------------- the grant count, which shape hides

/*
 * 0018 already proved this matters: its first version seeded the administrator
 * role without the permission that opens the permission screen, and the SHAPE
 * was identical either way. A fingerprint could never have caught it.
 */
{
  const { count, error } = await db.from("eng_role_grants").select("action", { count: "exact", head: true });
  rec("the role grants are readable", !error, error ? error.message : `${count} grants`);
  if (!error) {
    rec(
      "and there are 111 of them",
      count === 111,
      count === 111 ? "" : `${count}. The fingerprint cannot see a row, and 0018 already proved that matters.`,
    );
  }
}

// ---------------------------------------------- what is deliberately not here

const stillPending = pending();
if (stillPending.length) {
  console.log("");
  console.log(`  ${stillPending.length} migration(s) are declared NOT applied, and are not checked:`);
  for (const e of stillPending) console.log(`    ${e.file}: ${e.because}`);
}

/*
 * The fingerprint, which this cannot compute and will not fake.
 *
 * Printed as the manual query rather than skipped in silence, because the
 * per migration probes above answer "is anything missing" and the fingerprint
 * answers "is anything DIFFERENT", and a column quietly widened by hand would
 * pass every probe above.
 */
console.log("");
console.log("  The fingerprint is NOT checked here and cannot be: PostgREST does not expose");
console.log("  information_schema. The probes above catch a MISSING migration; they would not");
console.log("  catch a column altered by hand. For that, run this in the SQL editor and compare");
console.log("  against the last applied entry in supabase/applied.mjs:");
console.log("");
console.log("    select md5(string_agg(sig, '|' order by sig)) as fingerprint, count(*) as columns");
console.log("    from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig");
console.log("          from information_schema.columns");
console.log("          where table_schema='public' and table_name like 'eng\\_%') t;");
console.log("");
console.log(`    expected: ${declared[declared.length - 1]?.fingerprint ?? "nothing declared"}`);

// ------------------------------------------------------------------- verdict

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A migration the ledger says was applied and the database does not have is a");
  console.log("schema the deployed code expects and the database does not provide.");
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. Every migration declared applied is present.`);
