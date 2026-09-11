-- ===========================================================================
-- 0040: two things production has always been right about, written down.
--
-- Phase 12 Section 4, gate 1 rulings, 2026-09-09. Both halves of this migration
-- came out of the same place: the second fingerprint, on its first run, saying
-- that three databases the first fingerprint called identical were not.
--
-- ===========================================================================
-- ONE: THE EIGHT INDEXES 0000 FORGOT TO COPY
-- ===========================================================================
--
-- 0000_eng_legacy_intake.sql is a RECONSTRUCTION. Its own header says so: five
-- tables created directly against the shared project before this repository
-- kept migrations, rebuilt from the production catalogue so that 0001 could
-- apply to an empty database.
--
-- It copied the columns. It copied the constraints. It copied ZERO indexes.
-- `grep -c "create index" 0000_eng_legacy_intake.sql` returns 0.
--
-- So production has carried eight indexes since before this repository existed
-- and the migrations have never produced one of them. The divergence first read
-- as production carrying something mysterious; it is the repository missing
-- something production has always had, which points the other way entirely.
--
-- Operator ruling: the repository catches up to production. That is the right
-- direction. Dropping an index on production to make a number match would be
-- editing the thing being described to suit the description.
--
-- Six of the eight lead on `site`, which is the multi brand discriminator from
-- the era these tables come from. They are reproduced here EXACTLY as
-- production holds them, read back from pg_indexes rather than guessed at, so
-- the cutover project and the replay produce what production already has.
--
-- Every one is `if not exists`, so this is a no-op against production and a
-- repair everywhere else.

create index if not exists eng_applications_site_created_idx
  on eng_applications (site, created_at desc);
create index if not exists eng_applications_site_role_created_idx
  on eng_applications (site, role, created_at desc);

create index if not exists eng_leads_site_created_idx
  on eng_leads (site, created_at desc);
create index if not exists eng_leads_utm_campaign_idx
  on eng_leads (site, utm_campaign);

create index if not exists eng_onboardings_created_idx
  on eng_onboardings (created_at desc);
create index if not exists eng_onboardings_site_status_idx
  on eng_onboardings (site, status);

create index if not exists eng_onboarding_items_onboarding_idx
  on eng_onboarding_items (onboarding_id, sort_order);

create index if not exists eng_orders_site_created_idx
  on eng_orders (site, created_at desc);

-- ===========================================================================
-- TWO: files.assign IS REMOVED, AND THE REMOVAL IS THE POINT
-- ===========================================================================
--
-- Operator ruling, gate 1: refused outright. Nothing in this platform assigns a
-- file to an engineer. An engineer ACCEPTS one, and that acceptance is the
-- responsible charge entry.
--
-- The capability was declared in ops-authz.ts and seeded to admin and to
-- dispatcher by 0018, and NOTHING HAS EVER READ IT. Not one call site. It was
-- found while reconciling the approved prototype's bulk Assign button against
-- the code, which is the check section 2c exists to force.
--
-- WHY A GRANT NOBODY USES IS WORTH A MIGRATION
-- ---------------------------------------------
-- Because of where it leads. A declared capability nothing uses is a door
-- waiting for somebody to build on, and the room behind this one is one where an
-- administrator's click puts a Professional Engineer in responsible charge of
-- work they have never seen. 0039 has just made eng_responsible_charge_log's
-- engineer_id a RESTRICT foreign key so that record always names an engineer the
-- database can find; a bulk assign would have made it name an engineer who never
-- agreed.
--
-- The next person to reach for this will find nothing to reach for, and the
-- reasoning waiting for them in ops-authz.ts where the type used to be.
--
-- 0018 IS NOT EDITED, and that is standing law: a migration that changes after
-- it has run is one nobody can reason about. The seed stays as the record of
-- what was granted then, and this removes it now.

delete from eng_role_grants where action = 'files.assign';

comment on table eng_role_grants is
  'One row per capability a role holds. Generated from DEFAULT_ROLES by scripts/emit-role-seed.mjs and compared against it by roles-audit, so the matrix and the database cannot disagree. files.assign was removed in 0040: it was seeded by 0018, never read by anything, and named an operation this firm cannot perform, because responsible charge is accepted rather than assigned.';
