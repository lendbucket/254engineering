-- ===========================================================================
-- 0027: what a report may count, and who may read one.
--
-- Phase 12 Section 2. Three things that all have to exist before a single
-- figure is rendered, because each of them is a rule about what a figure MEANS.
--
-- ONE: is_demo, AND WHY IT IS A COLUMN RATHER THAN FIFTY QUERY EDITS
-- ------------------------------------------------------------------
-- Operator ruling, 2026-09-08. Every report excludes seeded records, and the
-- obvious implementation is a `reference not like '254-DEMO%'` in each query.
-- That is fifty places to remember, it is invisible when somebody forgets, and
-- the forgetting shows up as a figure that is quietly too high.
--
-- So it is one boolean, set by the seeder, and every read helper excludes it by
-- default. A query that WANTS demo rows asks for them by name.
--
-- The column is on the tables that hold a seeded record type and nowhere else.
-- A table nothing seeds does not get one: an is_demo on eng_audit_events would
-- be a column that is always false and a question nobody can answer about what
-- it would mean for an audit row to be a demonstration.
--
-- TWO: THE CHECK, SO THE COLUMN CANNOT DISAGREE WITH THE NAME
-- ------------------------------------------------------------
-- A boolean somebody has to set is a boolean somebody will forget to set, and
-- then a record called 254-DEMO-0004 counts in every total while claiming not
-- to be a demonstration. The constraint makes that unrepresentable: a file
-- number or reference carrying the DEMO segment with is_demo false is refused
-- by the database.
--
-- IT IS TWO DIRECTIONAL, AND THE FIRST DRAFT OF THIS MIGRATION WAS NOT.
--
-- That draft allowed is_demo TRUE on a record with an ordinary reference, and
-- justified it as an operator marking a real record as excluded from reporting.
-- Operator refusal, 2026-09-08: that is a capability nobody ruled, and it is a
-- way to remove a real order from revenue with one flag. Audited or not, the
-- flag is the problem, and the justification was written by the session that
-- wanted the looser constraint.
--
-- So the two must agree in BOTH directions. A DEMO number with is_demo false is
-- refused, and is_demo true on a record without a DEMO number is refused. The
-- column is written by the seeder and by the backfill below, and by nothing
-- else; demo-audit asserts that no application code writes it.
--
-- If a real record ever needs excluding from a figure, that is a different
-- column with a different name and its own ruling. It does not exist.
--
-- isDemoFileNumber in src/lib/ops-files.ts has existed since the demo block was
-- designed and has had zero callers that entire time. The backfill below and
-- the check are its first two, which is the point: a rule written in TypeScript
-- and enforced nowhere is a comment.
--
-- THREE: REPORTS ARE PERMISSIONS
-- -------------------------------
-- A report is a claim the firm makes about itself, so who may read one is a
-- grant like any other. Four actions, one per report, granted to the roles the
-- brief names and nobody else.
--
-- WHAT IS NOT HERE, AND MUST NOT BE. There is no reports.production grant for
-- any role that cannot hold responsible charge, and there is no grant at all
-- for a licensed FIGURE. Those live in a separate TypeScript type that
-- Role.grants cannot hold, the same way LicensedAction already works, so the
-- guarantee is that there is nothing to seed rather than that nobody seeded it.
-- ===========================================================================

-- --------------------------------------------------------------- one: is_demo

alter table eng_files            add column if not exists is_demo boolean not null default false;
alter table eng_service_orders   add column if not exists is_demo boolean not null default false;
alter table eng_profiles         add column if not exists is_demo boolean not null default false;
alter table eng_clients          add column if not exists is_demo boolean not null default false;
alter table eng_partners         add column if not exists is_demo boolean not null default false;
alter table eng_applications     add column if not exists is_demo boolean not null default false;

comment on column eng_files.is_demo is
  'Seeded by scripts/seed-field-demo.mjs rather than by somebody paying. Excluded from every report at the query. Set by the seeder and enforced by eng_files_demo_number_agrees.';

/*
 * The backfill, from the patterns the codebase already defines.
 *
 * Files and orders carry the DEMO segment in their own number. The people and
 * organisations the seeder creates do not, so they are found the way the seeder
 * itself finds them for cleanup: an example.com address, or the seeded name.
 * Both are recorded here rather than inferred later.
 */
update eng_files          set is_demo = true where file_number like '%-DEMO-%';
update eng_service_orders set is_demo = true where reference like '%-DEMO-%';
update eng_profiles       set is_demo = true where email like 'demo.%@example.com';
update eng_applications   set is_demo = true where email like 'demo.%@example.com';
update eng_clients        set is_demo = true where name like '%(seeded)%';
/* eng_partners has no name column; it is organisation, and the seeded partner
 * is found by its contact address rather than by a name pattern that could
 * catch a real firm called Demo something. */
update eng_partners       set is_demo = true where contact_email like 'demo.%@example.com';

-- --------------------------------------------- two: the check, both ways

alter table eng_files drop constraint if exists eng_files_demo_number_agrees;
alter table eng_files add constraint eng_files_demo_number_agrees
  check ((file_number like '%-DEMO-%') = is_demo);

alter table eng_service_orders drop constraint if exists eng_orders_demo_reference_agrees;
alter table eng_service_orders add constraint eng_orders_demo_reference_agrees
  check ((reference like '%-DEMO-%') = is_demo);

/* Reports filter on it on every read, so it is worth an index where the table
 * is large enough for a scan to matter. Partial, because the rows that are NOT
 * demonstrations are the ones every report wants. */
create index if not exists eng_files_real_idx on eng_files (created_at desc) where not is_demo;
create index if not exists eng_service_orders_real_idx on eng_service_orders (created_at desc) where not is_demo;

-- ------------------------------------------- three: a report is a permission

insert into eng_role_grants (role_key, action) values
  ('admin', 'reports.revenue'),
  ('admin', 'reports.production'),
  ('admin', 'reports.pipeline'),
  ('admin', 'reports.partner')
on conflict (role_key, action) do nothing;

/*
 * The engineer reads the production report and nothing else.
 *
 * It is the report about their own work and it is derived from the responsible
 * charge log, which is theirs. They get no revenue, no pipeline and no partner
 * report: none of those is about engineering judgment, and a licence is not a
 * reason to see what the firm earns.
 */
insert into eng_role_grants (role_key, action) values
  ('engineer', 'reports.production')
on conflict (role_key, action) do nothing;
