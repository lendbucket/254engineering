/**
 * THE STATEMENTS IN THE MIGRATIONS THAT WRITE AN ASSIGNMENT ON A FILE, COUNTED
 * ONCE PER LIVE DEFINITION. Operator ruling of 2026-10-23.
 *
 * bulk-audit counts every writer of eng_files.assigned_engineer_id and
 * assigned_tech_id, in src and in the database. It used to count every
 * migration STATEMENT, so a migration that restates a function (0083 restates
 * eng_record_review_decision from 0068 with two fields added) counted one live
 * function twice. The ruling: count a replaced function once, by its latest
 * definition. A writer that is not inside a function is counted per statement,
 * as before, and two DIFFERENT functions that each write one are two writers;
 * scripts/proofs/an-assignment-writer-is-counted-once-per-function.mjs proves
 * both.
 *
 * Input is the migrations in apply order, each { name, text } with comments
 * already stripped (readSource does that). Output is one line per writer,
 * "file: update ...", naming the file of the definition that is live.
 */
const WRITES_ASSIGNMENT = /\bupdate (public\.)?eng_files set\b.*\bassigned_(engineer|tech)_id =/i;
const FUNCTION_HEAD = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi;

/** Each function body in a migration: its name and the span of its dollar quoted body. */
function functionBodies(text) {
  const out = [];
  for (const head of text.matchAll(FUNCTION_HEAD)) {
    const after = head.index + head[0].length;
    const open = /\$([a-z_]*)\$/i.exec(text.slice(after));
    if (!open) continue;
    const start = after + open.index + open[0].length;
    const close = text.indexOf(open[0], start);
    if (close < 0) continue;
    out.push({ name: head[1].toLowerCase(), start, end: close });
  }
  return out;
}

function writersIn(fragment) {
  const found = [];
  for (const statement of fragment.split(";")) {
    const flat = statement.replace(/\s+/g, " ").trim();
    if (WRITES_ASSIGNMENT.test(flat)) {
      const at = flat.search(/\bupdate (public\.)?eng_files/i);
      found.push(flat.slice(at, at + 70));
    }
  }
  return found;
}

export function migrationAssignmentWriters(migrations) {
  const byFunction = new Map();
  const loose = [];
  for (const { name, text } of migrations) {
    const bodies = functionBodies(text);
    /* A later definition of the same function replaces the earlier one, writers and all. */
    for (const body of bodies) {
      byFunction.set(body.name, writersIn(text.slice(body.start, body.end)).map((w) => `${name}: ${w}`));
    }
    let outside = text;
    for (const body of [...bodies].reverse()) {
      outside = outside.slice(0, body.start) + " ".repeat(body.end - body.start) + outside.slice(body.end);
    }
    for (const w of writersIn(outside)) loose.push(`${name}: ${w}`);
  }
  return [...loose, ...[...byFunction.values()].flat()];
}
