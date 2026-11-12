/**
 * EVERY SHAPE OF A LEDGER ENTRY'S `proves`, TURNED INTO ONE PROBE. Pure.
 *
 * supabase/applied.mjs declares, per migration, what that migration uniquely
 * puts in the schema, and scripts/production-schema-check.mjs asks production
 * about each. The check understood three shapes (a table; a table and column;
 * a table and match) while the ledger had grown nine. On 2026-11-12 it was run
 * against development and crashed on 0041's `column: { table, name }`, which
 * had been in the ledger since 2026-09-10: no run since had probed anything
 * after it (issue #1, 6815852350).
 *
 * So the shapes are read in one place, and the proof
 * scripts/proofs/every-ledger-proves-is-a-probe.mjs asserts that every entry in
 * the ledger maps to a known probe. A future shape the check cannot read fails
 * a board instead of crashing the check the day somebody finally runs it.
 *
 * The kinds:
 *   table     a zero row select of the table
 *   column    a zero row select of one column
 *   row       a head count with equality filters, which must be above zero
 *   bucket    the storage API's read of one bucket
 *   function  NOT probeable through the API: calling it would execute it, so
 *             the check prints the query to run by hand instead
 *   none      the entry declares nothing (its provesNote says why)
 *   unknown   a shape this module does not read; the proof refuses it
 */

const WHERE_TERM = /^([a-z_][a-z0-9_]*)\s*=\s*(?:'([^']*)'|(true|false)|(-?\d+))$/i;

/** "role_key = 'engineer' and action = 'pricing.read_own_pay'" as equality filters, or null if it is anything else. */
export function whereAsMatch(where) {
  if (typeof where !== "string" || !where.trim()) return null;
  const match = {};
  for (const term of where.split(/\s+and\s+/i)) {
    const m = term.trim().match(WHERE_TERM);
    if (!m) return null;
    const [, key, str, bool, num] = m;
    match[key] = str !== undefined ? str : bool !== undefined ? bool.toLowerCase() === "true" : Number(num);
  }
  return match;
}

export function probeOf(proves) {
  if (proves === null || proves === undefined) return { kind: "none" };
  if (typeof proves !== "object") return { kind: "unknown", why: `not an object: ${JSON.stringify(proves)}` };
  const keys = Object.keys(proves).sort().join("+");

  if (proves.column && typeof proves.column === "object") {
    const { table, name } = proves.column;
    return table && name ? { kind: "column", table, column: name } : { kind: "unknown", why: "column without table and name" };
  }
  if (proves.row && typeof proves.row === "object") {
    const match = whereAsMatch(proves.row.where);
    return proves.row.table && match ? { kind: "row", table: proves.row.table, match } : { kind: "unknown", why: `row whose where cannot be read: ${proves.row.where}` };
  }
  if (proves.grant && typeof proves.grant === "object") {
    const { role, action } = proves.grant;
    return role && action ? { kind: "row", table: "eng_role_grants", match: { role_key: role, action } } : { kind: "unknown", why: "grant without role and action" };
  }
  if (typeof proves.function === "string" && keys === "function") return { kind: "function", name: proves.function };
  if (typeof proves.bucket === "string" && keys === "bucket") return { kind: "bucket", bucket: proves.bucket };
  if (typeof proves.table === "string") {
    if (proves.match && typeof proves.match === "object") return { kind: "row", table: proves.table, match: proves.match };
    if (typeof proves.column === "string") return { kind: "column", table: proves.table, column: proves.column };
    /* 0061 declares a table, a bucket and a constraint; the table is the part the API can see, and the bucket is probed beside it. */
    return proves.bucket ? { kind: "table", table: proves.table, bucket: proves.bucket } : { kind: "table", table: proves.table };
  }
  return { kind: "unknown", why: `shape ${keys}` };
}

/*
 * THE SAME PROBES AS READ-ONLY SQL, for a reader who reaches the database only
 * through SQL. The chat counterpart holds no production URL or service key and
 * reads production through the Supabase connector with execute_sql (issue #1,
 * 6816656381), so `production-schema-check.mjs --sql` prints one select of
 * these and runs nothing. Every expression is a select; nothing it emits can
 * write. Identifiers must look like identifiers and literals are quoted with
 * single quotes doubled, so a ledger entry cannot carry a statement into it.
 */
const IDENT = /^[a-z_][a-z0-9_]*$/;
const BUCKET = /^[a-z0-9][a-z0-9-]*$/;
const lit = (v) => (typeof v === "boolean" ? String(v) : typeof v === "number" && Number.isFinite(v) ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

/** One boolean SQL expression that is true when the probe's mark is present, or null if the probe cannot be written as one. */
export function probeSql(probe) {
  const ident = (s) => (typeof s === "string" && IDENT.test(s) ? s : null);
  switch (probe.kind) {
    case "table": {
      const t = ident(probe.table);
      if (!t) return null;
      const table = `to_regclass('public.${t}') is not null`;
      if (!probe.bucket) return table;
      return BUCKET.test(probe.bucket) ? `(${table} and exists (select 1 from storage.buckets where id = ${lit(probe.bucket)}))` : null;
    }
    case "column": {
      const t = ident(probe.table);
      const c = ident(probe.column);
      return t && c
        ? `exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = ${lit(t)} and column_name = ${lit(c)})`
        : null;
    }
    case "row": {
      const t = ident(probe.table);
      const keys = Object.keys(probe.match ?? {});
      if (!t || keys.length === 0 || keys.some((k) => !ident(k))) return null;
      return `exists (select 1 from public.${t} where ${keys.map((k) => `${k} = ${lit(probe.match[k])}`).join(" and ")})`;
    }
    case "bucket":
      return BUCKET.test(probe.bucket ?? "") ? `exists (select 1 from storage.buckets where id = ${lit(probe.bucket)})` : null;
    case "function": {
      const f = ident(probe.name);
      return f ? `exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = ${lit(f)})` : null;
    }
    default:
      return null;
  }
}
