/**
 * THE RETENTION DECLARATION AGAINST THE SCHEMA: THE STATIC HALF OF
 * retention-audit, IN ONE HOME.
 *
 * retention-audit runs these first and then goes on to plan against
 * development, which needs .env.local. scripts/preflight.mjs runs them with no
 * environment file at all, so the alphabetical-order miss of 2026-10-27
 * (board 40579097390) is caught before a board rather than by one. Both call
 * this function, so the two cannot disagree about what the rule is.
 *
 * The schema's own list is read from the MIGRATIONS rather than from the
 * declaration or from a live database. Migrations are the only source that is
 * independent of both: the declaration is the thing under test, and a live
 * database can be ahead of or behind the files. roles-audit reads the whole
 * chain for the same reason.
 *
 * Imports retention-policy.ts, which carries "server-only", so a caller runs
 * under --conditions=react-server.
 */
import { readdirSync } from "node:fs";
import { readSource } from "./read-source.mjs";
import { DECLARED_TABLES } from "../../src/lib/retention-policy.ts";

/** The eng_ tables a replay of the migrations leaves, created and not dropped, sorted. */
export function tablesInSchema() {
  const found = new Set();
  for (const file of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readSource(`supabase/migrations/${file}`);
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(eng_[a-z0-9_]+)/gi)) {
      found.add(m[1].toLowerCase());
    }
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(eng_[a-z0-9_]+)/gi)) {
      found.delete(m[1].toLowerCase());
    }
  }
  return [...found].sort();
}

/** Section 1 of retention-audit, as { name, ok, note } records, in the audit's order and words. */
export function declarationChecks() {
  const declaredInSchema = tablesInSchema();
  const checks = [];
  const rec = (name, ok, note = "") => checks.push({ name, ok, note });

  rec(
    "the migrations name tables at all",
    declaredInSchema.length > 50,
    `${declaredInSchema.length} found; if this said zero every check below it would pass over nothing`,
  );

  const missing = declaredInSchema.filter((t) => !DECLARED_TABLES.includes(t));
  rec(
    "every table in the schema is declared in retention-policy.ts",
    missing.length === 0,
    missing.length ? `UNDECLARED: ${missing.join(", ")}` : `${declaredInSchema.length} tables, all declared`,
  );

  const phantom = DECLARED_TABLES.filter((t) => !declaredInSchema.includes(t));
  rec(
    "and the declaration names no table the schema does not have",
    phantom.length === 0,
    phantom.length
      ? `DECLARED BUT ABSENT: ${phantom.join(", ")}`
      : "a rule for a table nobody created is a rule nothing enforces",
  );

  const sorted = [...DECLARED_TABLES].sort();
  rec(
    "the declaration is in alphabetical order",
    DECLARED_TABLES.every((t, i) => t === sorted[i]),
    "so it can be diffed against the schema without anybody deciding where a new table belongs",
  );
  rec(
    "and lists nothing twice",
    new Set(DECLARED_TABLES).size === DECLARED_TABLES.length,
    "two rules for one table are two rules that will disagree",
  );

  return checks;
}
