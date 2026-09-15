/**
 * THE THREE READS IN copy-project.mjs THAT A SURVEY FOUND ANSWERING THE WRONG
 * QUESTION, MOVED WHERE THEY CAN BE EXERCISED.
 *
 * Operator ruling, 2026-09-15: two bounded reads in one file (the 1000 cap on
 * the row copy, the `.limit(20)` on the queue stop) means surveying the rest of
 * the file rather than assuming the other reads are sound. The survey found
 * three more, none of them a cap, all of them the same family: a figure or a
 * verdict produced by a read that could not see the thing it named.
 *
 * They live here, not in the script, for the reason bucket-walk.mjs gives: a
 * function inside a script that exits on load is a function nothing can test.
 */

import fs from "node:fs";

/* ---------------------------------------------------------------------------
 * 1. THE AUTH PRECONDITION NEVER LOOKED AT auth.users.
 *
 * The script's sentence was
 *
 *     eng_profiles: 2 row(s) need their auth.users row created first
 *     (cutover plan step 7). Skipping.
 *
 * and the read behind it was `dst.from("eng_profiles").select("id").in("id",
 * ids)`: the PROFILES table on the destination, under a guard that only fired
 * when that same table's count was zero. On an empty destination the read
 * therefore returned nothing by construction, every profile was reported as
 * lacking an auth row, and eng_profiles was skipped, whether or not step 7's
 * SQL had created the auth rows. On a destination that already held profiles
 * the guard never fired at all. It could not answer yes, and it could not be
 * asked in the one state where the question mattered.
 *
 * The consequence was that `--apply` against a fresh project could never copy
 * eng_profiles, about thirty tables reference it, and the skip was a log line
 * rather than a STOP, so the run's problem count did not include it. `--apply`
 * has never run, which is why nobody met it.
 *
 * The question is answered by the auth admin API, which is the only thing
 * PostgREST exposes that can see auth.users: one lookup per id, so there is no
 * page to be capped. A lookup that errors for any reason other than "no such
 * user" throws, because an unreadable auth schema is not an empty one.
 * ------------------------------------------------------------------------- */
export async function authUsersMissing(client, ids) {
  const missing = [];
  for (const id of ids) {
    const { data, error } = await client.auth.admin.getUserById(id);
    if (error) {
      const notFound = error.status === 404 || /not.?found/i.test(error.code ?? error.message ?? "");
      if (!notFound) {
        throw new Error(`auth.users could not be read for ${id}: ${error.message}`);
      }
      missing.push(id);
      continue;
    }
    if (!data?.user) missing.push(id);
  }
  return missing;
}

/* ---------------------------------------------------------------------------
 * 2. "NOT ON THE SOURCE", "COULD NOT BE READ" AND "EMPTY" WERE ONE ANSWER.
 *
 * The completeness check probed each table the migrations declare with
 *
 *     const { count, error } = await src.from(name).select("*", { count: "exact", head: true });
 *     if (error) continue; // Not present on the source.
 *     if ((count ?? 0) > 0) undeclared.push(...)
 *
 * Measured against development on 2026-09-15, rather than assumed:
 *
 *     a table that does not exist   status 204, error null, count null
 *     a table that exists           status 206, error null, count 1327
 *     the same table, bad key       status 401, error {message:""}, count null
 *
 * So the comment was wrong about which branch meant absent. A missing table
 * never reaches `if (error)` at all: a HEAD request has no body to carry
 * PostgREST's PGRST205, and it arrives as a null count that `?? 0` folds into
 * an empty table. And the branch that IS taken on an error is a table that
 * could not be read, which was then silently dropped from a check that went on
 * to print that every table holding rows was declared.
 *
 * It is absent versus zero, in a completeness check. So a null count is never a
 * zero here: it is asked again with a GET, whose body carries the code, and only
 * PGRST205 counts as absent. Anything else throws.
 * ------------------------------------------------------------------------- */
export async function probeTable(client, name) {
  const { count, error, status } = await client
    .from(name)
    .select("*", { count: "exact", head: true });
  if (error) {
    throw new Error(`${name}: could not be counted (status ${status}${error.message ? `, ${error.message}` : ""})`);
  }
  if (typeof count === "number") return { absent: false, count };

  const again = await client.from(name).select("*").limit(1);
  if (again.error?.code === "PGRST205" || again.error?.code === "42P01") return { absent: true, count: null };
  throw new Error(
    `${name}: the count came back null with no error, and a direct read did not say the table is absent ` +
      `(status ${again.status}${again.error ? `, ${again.error.message}` : ""}). A null count is not a zero.`,
  );
}

/* ---------------------------------------------------------------------------
 * 3. THE CANDIDATE LIST WAS A REGEX, AND THE REGEX HAD ONE SPELLING.
 *
 * The check's subject is every eng_ table the migrations create, found by
 * matching `create table if not exists eng_x`. All 76 are written that way
 * today, so the figure it printed was right. A migration written
 * `create table eng_x` or `create table public.eng_x`, both ordinary Postgres,
 * would have created a table the completeness check never probed, and the check
 * would have gone on printing a count that looked complete.
 *
 * So it matches every spelling, and it ASSERTS the match: every `create table`
 * statement naming an eng_ table must be one the pattern captured, which is the
 * question "what would this count be if the pattern missed one, and could the
 * check tell".
 * ------------------------------------------------------------------------- */
const CREATE_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?(eng_[a-z0-9_]+)"?/gi;
const ANY_ENG_CREATE = /create\s+table\b[^;(]*\beng_[a-z0-9_]+/gi;

export function tablesDeclaredByMigrations(dirUrl, read = (u) => fs.readFileSync(u, "utf8")) {
  const found = new Set();
  let statements = 0;
  let captured = 0;
  for (const file of fs.readdirSync(dirUrl).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = read(new URL(file, dirUrl));
    statements += [...sql.matchAll(ANY_ENG_CREATE)].length;
    for (const m of sql.matchAll(CREATE_TABLE)) {
      captured += 1;
      found.add(m[1].toLowerCase());
    }
  }
  if (captured !== statements) {
    throw new Error(
      `the migrations carry ${statements} create table statement(s) naming an eng_ table and the pattern captured ${captured}. ` +
        "A table the pattern cannot see is a table the completeness check never probes.",
    );
  }
  return found;
}
