-- ---------------------------------------------------------------------------
-- 0028: the records 0027's backfill could not name.
--
-- Phase 12 Section 2. This marks every record whose contact address cannot
-- receive mail as a demonstration, on the three tables that hold a person or an
-- organisation.
--
-- WHY 0027 MISSED THEM, WHICH IS THE WHOLE POINT
-- ----------------------------------------------
-- 0027's backfill read:
--
--   update eng_profiles set is_demo = true where email like 'demo.%@example.com';
--   update eng_clients   set is_demo = true where name  like '%(seeded)%';
--   update eng_partners  set is_demo = true where contact_email like 'demo.%@example.com';
--
-- Every one of those is a NAME pattern. They match the records somebody could
-- remember while writing the migration: the ones the current seeder makes,
-- named the way the current seeder names them. The rule they were reaching for
-- is a property of the ADDRESS, and the two are not the same set.
--
-- demo-audit's detector was extended to sweep profiles, partners and clients
-- the way it already swept orders, and it found twelve records on development
-- that 0027 had left unmarked:
--
--   8 x eng_partners  "ZZ probe, safe to ignore"   e2e-*@example.com
--   3 x eng_clients   "Stripe Probe"               stripe.probe.*@example.com
--   1 x eng_clients   "Demo Solar Installers LLC"  orders@example.com
--
-- None of the three names appears anywhere in this repository. They were
-- written by scripts that are not in the tree any more, which is the same cause
-- as the five probe orders and the same cause as the nine the partner roster
-- turned up in Phase 9: a script that held no ledger. A pattern written from
-- memory cannot match a record nobody remembers.
--
-- So the anchor here is RFC 2606, the same rule src/lib/ops-files.ts applies in
-- TypeScript. example.com, example.org, example.net, .invalid and .test are
-- reserved so that they can be used in documentation and testing and never
-- reach a person. An address in one of them is not a customer, a partner or an
-- employee, on any database, in any environment.
--
-- MARK, DO NOT DELETE
-- -------------------
-- Seven of the eight probe partners CANNOT be deleted and should not be.
-- eng_partner_touches refuses DELETE by trigger and references the partner with
-- ON DELETE RESTRICT, so a partner who was ever touched is held by their own
-- evidence. That is 0014 working as written, and BACKLOG.md carries an entry
-- saying so and telling the next session not to loosen it.
--
-- This retires that entry without touching the trigger. A record that cannot be
-- removed can still be told apart, which is what is_demo is for and what
-- deletion was only ever a proxy for.
--
-- WHAT THIS IS NOT
-- ----------------
-- It is not a way to exclude a real record from a figure. It fires on addresses
-- that cannot receive mail and on nothing else, so there is no real record for
-- it to reach. The operator's ruling of 2026-09-08 stands untouched: is_demo is
-- written by the seeder and by a backfill, and an operator flag that could take
-- a real order out of revenue is a different column with a different name and
-- its own ruling, which has not been given.
--
-- No CHECK constraint is added. The detector in demo-audit is the mechanism the
-- operator ruled for this, it reports the records by name, and it fails the
-- board. A constraint would additionally refuse the insert, which turns a
-- reporting defect into a write failure on a live surface, and nobody ruled
-- that.
-- ---------------------------------------------------------------------------

update eng_profiles set is_demo = true
where is_demo = false
  and (email ~* '@example\.(com|org|net)$' or email ~* '\.invalid$' or email ~* '@test$');

update eng_partners set is_demo = true
where is_demo = false
  and (contact_email ~* '@example\.(com|org|net)$'
       or contact_email ~* '\.invalid$'
       or contact_email ~* '@test$');

update eng_clients set is_demo = true
where is_demo = false
  and (email ~* '@example\.(com|org|net)$' or email ~* '\.invalid$' or email ~* '@test$');

update eng_applications set is_demo = true
where is_demo = false
  and (email ~* '@example\.(com|org|net)$' or email ~* '\.invalid$' or email ~* '@test$');
