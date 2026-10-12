/*
 * THE SUPABASE OBJECTS A REPLAY STANDS IN FOR, IN ONE PLACE.
 *
 * Every in-process replay of supabase/migrations starts from these. Until
 * 2026-10-11 there were seven copies, in migration-audit, schema-ledger-audit,
 * fingerprint-at and four proofs, and they had already drifted: two carried
 * auth.users.email and storage.objects and five did not. A starting database
 * with seven accounts is seven starting databases.
 *
 * The tables are minimal and sit outside both fingerprints, which read eng_
 * objects only.
 *
 * THE ROLES AND THEIR DEFAULT GRANT ARE THE POINT OF THE SECOND HALF. Supabase
 * creates anon, authenticated and service_role, and its default privileges give
 * all three EXECUTE on every function created in public; PostgreSQL itself
 * gives EXECUTE to PUBLIC. On production that let anybody holding the
 * publishable key call eng_set_trade_price through PostgREST rpc, found by the
 * operator's counterpart on 2026-10-10. A replay without the roles could not
 * show that, and could not run the migration that closes it. So the replay
 * reproduces the default exactly as production has it, and migration-audit
 * asserts that after the whole chain no function is executable by anon or
 * authenticated. A future migration that creates a function and forgets its
 * revoke therefore fails the board, which is the guard, rather than a default
 * changed on a database other applications share.
 */
export const SUPABASE_REPLAY_STUBS = `
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key, email text, created_at timestamptz not null default now()
  );
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text, name text, metadata jsonb
  );
  do $stub$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  end;
  $stub$;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;
