-- ===========================================================================
-- 0008: pin the search_path on every trigger function this platform owns.
--
-- Found on 2026-09-03 by Supabase's own advisors while gathering evidence for
-- the production database decision. Four functions carried a role mutable
-- search_path:
--
--   eng_touch_updated_at
--   eng_forbid_mutation
--   eng_forbid_mutation_allow_cascade
--   eng_forbid_payment_delete
--
-- WHY IT MATTERS HERE MORE THAN IT USUALLY WOULD
-- ----------------------------------------------
-- A function whose search_path is not pinned resolves unqualified names using
-- whatever search_path the CALLER has. Somebody able to create objects in a
-- schema that sorts earlier can therefore decide which `now()` or which
-- `pg_trigger_depth()` the function actually calls.
--
-- Three of these four functions exist to REFUSE something: they are the append
-- only guarantee on the audit trail and the order history, and the rule that a
-- payment row can never be deleted. A guard whose behaviour depends on the
-- caller's environment is not a guard. That the exposure requires an attacker
-- who can already create schema objects does not make it acceptable in the code
-- that carries the firm's regulatory memory.
--
-- The fourth, eng_forbid_payment_delete, was written in migration 0006 earlier
-- the same day. The advisor caught it within hours; nothing else did.
--
-- WHY search_path = '' RATHER THAN A NAMED SCHEMA
-- -----------------------------------------------
-- An empty search_path resolves nothing implicitly, so every reference has to
-- be qualified and the function cannot be redirected by anything. Pinning to
-- `public, pg_catalog` would still leave `public` writable by whoever can write
-- to it. The cost is that now() and pg_trigger_depth() must be written as
-- pg_catalog.now() and pg_catalog.pg_trigger_depth(), which is done below.
--
-- The bodies are otherwise byte for byte what they were. This migration changes
-- how names resolve and nothing about what the functions do.
--
-- SAFE TO RE-RUN, AND SAFE TO RUN UNDER LOAD
-- ------------------------------------------
-- CREATE OR REPLACE on a function does not drop the triggers that reference it.
-- No trigger is dropped or recreated here, so no window exists in which a table
-- is unguarded.
-- ===========================================================================

create or replace function eng_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function eng_forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'eng: % is append only. % is not permitted on it.', tg_table_name, tg_op;
end;
$$;

create or replace function eng_forbid_mutation_allow_cascade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'eng: % is append only. UPDATE is not permitted on it.', tg_table_name;
  end if;

  -- Depth 1 means somebody deleted this row directly. Deeper means it is the
  -- cascade from deleting the parent record, which is allowed: an append only
  -- history should protect the story of a record that exists, not make every
  -- record immortal. See the note in 0006 on eng_order_events.
  if pg_catalog.pg_trigger_depth() <= 1 then
    raise exception
      'eng: % is append only. Delete the parent record instead of the history it produced.',
      tg_table_name;
  end if;

  return old;
end;
$$;

create or replace function eng_forbid_payment_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'eng_order_payments rows cannot be deleted. Record a refund instead.';
end;
$$;

comment on function eng_touch_updated_at is
  'search_path pinned empty in 0008. Every name is qualified so no caller environment can redirect it.';
comment on function eng_forbid_mutation is
  'The append only guarantee. search_path pinned empty in 0008: a guard whose behaviour depends on the caller is not a guard.';
comment on function eng_forbid_mutation_allow_cascade is
  'Append only, cascade permitted. search_path pinned empty in 0008.';
comment on function eng_forbid_payment_delete is
  'A payment row is a financial record and cannot be deleted. search_path pinned empty in 0008.';
