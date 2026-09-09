/**
 * TWO FINGERPRINTS, AND WHY ONE WAS NEVER ENOUGH.
 *
 * Phase 12 Section 4, Section 0, debt two. Operator ruling, 2026-09-09: the
 * first fingerprint's four blind spots close at the START of Section 4, not
 * mid merge, and the second is recorded beside the first in every ledger entry
 * from then on.
 *
 * THE FIRST FINGERPRINT, AND WHAT IT CANNOT SEE
 * ----------------------------------------------
 * SHAPE is md5 over `table.column:type:nullable` for every `eng_%` table. It
 * has been the schema's identity since the two projects were split, it caught
 * real divergence, and it is kept exactly as it is for the history it already
 * describes.
 *
 * It answers one question: do these two databases have the same COLUMNS. Four
 * kinds of migration change what a database DOES without touching a column, and
 * every one of them landed in Phase 12 Section 3:
 *
 *   0030  turned three foreign keys from ON DELETE SET NULL to RESTRICT.
 *         Identical shape. The difference is whether deleting a file silently
 *         blanks a money ledger's link to it or refuses.
 *   0032  put delete-refusing triggers on five tables and two conditional ones
 *         on the work tables. Identical shape. The difference is whether the
 *         records the firm can be asked to produce can be removed at all.
 *   0037  added a unique index on lower(email). Identical shape. The difference
 *         is whether two partner accounts can hold one address.
 *   0018, 0021, 0025, 0030  seed ROWS. Identical shape. The difference is
 *         whether the administrator can open the permission screen.
 *
 * A fingerprint that matches across all four is a fingerprint saying "these two
 * databases agree" while they disagree about deletion, uniqueness and
 * permissions. Every ledger entry for those migrations had to carry a sentence
 * saying what was read back INSTEAD, because the number could not say it.
 *
 * BEHAVIOUR IS THE SECOND ONE
 * ----------------------------
 * md5 over the catalogue facts the first cannot reach: what a foreign key does
 * on delete, what fires and which function it calls, what those functions are
 * and whether their search_path is pinned, what is indexed and uniquely, and
 * whether row level security is on.
 *
 * WHY IT IS BUILT FROM FACTS AND NOT FROM RENDERED SQL
 * -----------------------------------------------------
 * The obvious version fingerprints `pg_get_indexdef` and `pg_get_constraintdef`,
 * which are one line each and read well. They are also SERVER RENDERED TEXT,
 * and the replay runs PGlite at PostgreSQL 18 while both Supabase projects run
 * an older major. A fingerprint over rendered text would then disagree between
 * the replay and the live databases over whitespace and keyword spelling, and a
 * number that disagrees for reasons nobody can act on is a number everybody
 * learns to override.
 *
 * So every component is a catalogue FACT: a char code, a bitmask, an attribute
 * number resolved to a name, an md5 of a function body this repository wrote.
 * Expression indexes are the one place a rendering is unavoidable, and there is
 * exactly one in this schema.
 *
 * WHY THE SEEDED ROWS ARE DECLARED AND NOT DISCOVERED
 * ----------------------------------------------------
 * There is no catalogue question that means "rows a migration put here". A
 * reference row and a customer record look identical from pg_class. So the
 * tables whose CONTENT is part of the schema's meaning are named in
 * SEEDED_TABLES below, which is the declared inventory idiom again: the same
 * shape as scripts/lib/surfaces.mjs and supabase/applied.mjs, and it exists for
 * the same reason, which is that a list nothing reads stops being true without
 * telling anybody.
 *
 * HOW THESE ARE USED
 * -------------------
 * The text of each query is exported so that the replay, the live check and the
 * query a person pastes into the Supabase MCP are literally the same string.
 * Two spellings of one question are two questions.
 */

/**
 * THE FIRST FINGERPRINT. Unchanged since the split, and not to be edited: every
 * number in supabase/applied.mjs was produced by this exact text.
 */
export const SHAPE_SQL = `
select table_name || '.' || column_name || ':' || data_type || ':' || is_nullable as sig
from information_schema.columns
where table_schema = 'public' and table_name like 'eng\\_%'
order by sig
`;

/**
 * THE SECOND FINGERPRINT. Everything the first cannot see, as catalogue facts.
 *
 * Each row is one `sig` string, and the fingerprint is md5 over them joined by
 * '|' in sorted order, exactly as the first is computed. The prefixes are there
 * so a person diffing two lists can see which KIND of thing moved without
 * reading the rest of the line.
 */
export const BEHAVIOUR_SQL = `
with tbl as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'eng\\_%'
)

/* ---------------------------------------------------------------- foreign keys
 * confdeltype and confupdtype are single chars: a = no action, r = restrict,
 * c = cascade, n = set null, d = set default. This is the 0030 blind spot, and
 * the one where the first fingerprint's silence cost the most: SET NULL and
 * RESTRICT are the same shape and the opposite promise. */
select 'fk:' || t.relname || '.' || con.conname
       || '->' || rt.relname
       || ':cols=' || (
         select string_agg(a.attname, ',' order by k.ord)
         from unnest(con.conkey) with ordinality k(attnum, ord)
         join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
       )
       || ':del=' || con.confdeltype::text
       || ':upd=' || con.confupdtype::text as sig
from pg_constraint con
join tbl t on t.oid = con.conrelid
join pg_class rt on rt.oid = con.confrelid
where con.contype = 'f'

union all

/* --------------------------------------------------------- check constraints
 * The unrepresentable-state mechanism. 0034's clicked-stays and 0035's
 * void-carries-intent are checks, and a database missing one accepts a row the
 * other refuses. conbin is the parsed tree; md5 of its text is stable in a way
 * pg_get_constraintdef's pretty printing is not. */
select 'ck:' || t.relname || '.' || con.conname
       || ':' || md5(con.conbin::text) as sig
from pg_constraint con
join tbl t on t.oid = con.conrelid
where con.contype = 'c'

union all

/* ------------------------------------------------------------- not null, and
 * the primary key, which are constraints the first fingerprint half sees: it
 * carries is_nullable but not which columns are the key. */
select 'pk:' || t.relname || ':' || (
         select string_agg(a.attname, ',' order by k.ord)
         from unnest(con.conkey) with ordinality k(attnum, ord)
         join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
       ) as sig
from pg_constraint con
join tbl t on t.oid = con.conrelid
where con.contype = 'p'

union all

/* -------------------------------------------------------------------- triggers
 * tgtype is a bitmask: 1 row-level, 2 before, 4 insert, 8 delete, 16 update,
 * 32 truncate, 64 instead-of. Decoded rather than rendered, and the function it
 * calls is named, because "a trigger exists" and "a trigger calls the function
 * that refuses" are different facts and 0032 is about the second. tgenabled
 * matters too: a disabled trigger is present and does nothing. */
select 'tg:' || t.relname || '.' || tg.tgname
       || ':fn=' || p.proname
       || ':type=' || tg.tgtype::text
       || ':enabled=' || tg.tgenabled::text as sig
from pg_trigger tg
join tbl t on t.oid = tg.tgrelid
join pg_proc p on p.oid = tg.tgfoid
where not tg.tgisinternal

union all

/* ------------------------------------------------------------------ functions
 * The bodies, because a trigger calling eng_forbid_record_delete proves nothing
 * if that function was quietly changed to return null. Also the pinned
 * search_path, which 0008 exists for and which no shape can show. */
select 'fn:' || p.proname
       || ':body=' || md5(p.prosrc)
       || ':volatile=' || p.provolatile::text
       || ':secdef=' || p.prosecdef::text
       || ':config=' || coalesce(array_to_string(p.proconfig, ','), 'none') as sig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'eng\\_%'

union all

/* -------------------------------------------------------------------- indexes
 * 0037's whole content is a unique index on lower(email), and it is invisible
 * to the first fingerprint. Column indexes are named by attribute; the one
 * expression index in this schema is rendered, which is the single place this
 * fingerprint depends on how a server spells something. */
select 'ix:' || t.relname || '.' || ic.relname
       || ':unique=' || i.indisunique::text
       || ':primary=' || i.indisprimary::text
       || ':cols=' || coalesce((
            select string_agg(coalesce(a.attname, '(expr)'), ',' order by k.ord)
            from unnest(i.indkey::int[]) with ordinality k(attnum, ord)
            left join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
          ), '')
       || ':expr=' || coalesce(md5(pg_get_expr(i.indexprs, i.indrelid)), 'none')
       || ':where=' || coalesce(md5(pg_get_expr(i.indpred, i.indrelid)), 'none') as sig
from pg_index i
join tbl t on t.oid = i.indrelid
join pg_class ic on ic.oid = i.indexrelid

union all

/* ------------------------------------------------------- row level security
 * Every table in this schema has RLS on and zero policies, which is the closed
 * door the whole platform is built on. A table that arrived without it would be
 * readable by anon on a project where PostgREST is public. */
select 'rls:' || t.relname || ':' || t.relrowsecurity::text as sig
from tbl t

union all

select 'policy:' || t.relname || '.' || pol.polname as sig
from pg_policy pol
join tbl t on t.oid = pol.polrelid

order by sig
`;

/**
 * THE TABLES WHOSE ROWS ARE PART OF THE SCHEMA.
 *
 * Not a discovery: see the reasoning at the top. Each entry names the table and
 * the columns that make one seeded row what it is, so the signature is over the
 * MEANING of the row rather than over a generated id or an insertion timestamp,
 * neither of which is the same on two databases and neither of which is a
 * disagreement anybody should be told about.
 *
 * `because` is the sentence a reader needs to know why this table is here and
 * an operational table is not.
 */
export const SEEDED_TABLES = [
  {
    table: "eng_roles",
    columns: ["key", "name", "landing_path", "is_system", "mfa_requirement"],
    because:
      "0018 makes the roles data, and 0025 changes what MFA a role demands. A database with a " +
      "different set of roles is a different firm, and the first version of 0018 shipped without " +
      "roles.manage on the administrator, which would have produced a firm unable to open the " +
      "permission screen and unable to grant itself the permission that opens it.",
  },
  {
    table: "eng_role_grants",
    columns: ["role_key", "action"],
    because:
      "The authorization matrix itself. 0021 and 0030 each seed one grant, and both are " +
      "invisible to the first fingerprint: partners.manage and retention.execute are rows.",
  },
];

/**
 * The query for one seeded table. Built rather than written out, because two
 * hand written queries over two tables become five over five and then one of
 * them quietly stops listing a column.
 *
 * Rows are ordered and joined the same way the fingerprints are, so the answer
 * does not depend on what order a database happens to return them in.
 */
export function seededSql(entry) {
  const cols = entry.columns.map((c) => `coalesce(${c}::text, '~null~')`).join(" || ':' || ");
  return `
select '${entry.table}:' || ${cols} as sig
from ${entry.table}
order by sig
`;
}

/**
 * All of it, as one query, for pasting into the Supabase MCP against a live
 * database. The seeded tables are unioned in so a person runs ONE thing and
 * gets ONE number, because a procedure with four steps is a procedure somebody
 * does three of.
 */
export function behaviourSqlFull() {
  const seeds = SEEDED_TABLES.map(
    (e) => `select '${e.table}:' || ${e.columns.map((c) => `coalesce(${c}::text, '~null~')`).join(" || ':' || ")} as sig from ${e.table}`,
  );
  /* BEHAVIOUR_SQL ends in an ORDER BY that belongs to the whole union, so it is
   * stripped before more branches are added and put back at the end. */
  const body = BEHAVIOUR_SQL.replace(/\norder by sig\n?$/, "");
  return `${body}\n\nunion all\n\n${seeds.join("\n\nunion all\n\n")}\n\norder by sig\n`;
}

/**
 * One number from a list of signature rows. The same md5-over-joined-sigs that
 * produced every figure in supabase/applied.mjs, in one place so the two
 * fingerprints cannot be computed two different ways.
 */
export function digestOf(rows) {
  return rows.map((r) => r.sig).join("|");
}
