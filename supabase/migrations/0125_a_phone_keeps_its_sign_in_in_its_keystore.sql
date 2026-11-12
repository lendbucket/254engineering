/*
 * ===========================================================================
 * 0125: A PHONE KEEPS ITS SIGN IN IN ITS KEYSTORE, AND SIGN OUT TAKES IT BACK.
 * Robert's answer of 2026-11-10, 06:11 Central, relayed on issue #1
 * (6766967932): "Yes, build it with its migration ... required before the
 * first store submission. Each phone's token is stored server side so sign out
 * revokes it." The design is in the morning post, 6767214731.
 * ===========================================================================
 *
 * ONE TABLE.
 *   eng_device_sessions  one row per phone a field technician has signed in
 *                        on in the store app. The server made a random token,
 *                        handed it to the app once, and keeps only its sha256
 *                        here; the app keeps the token in the phone's keystore.
 *                        When the twelve hour session ends, the app presents
 *                        the token and the server issues a fresh session.
 *
 * WHAT ENDS ONE. Sign out in the app stamps revoked_at. So does any exchange
 * that finds the profile's session epoch has moved since the token was issued
 * (a password change, a forced reset, a suspension, a replaced factor: auth
 * M2, 0120), a suspended account, or a role that is no longer field
 * technician. Rows are stamped, never deleted, except with the person they
 * belong to.
 *
 * ITS LIFE IS THE DATABASE'S ARITHMETIC. expires_at defaults to the database's
 * now() plus thirty days and a check refuses anything longer, so no caller's
 * clock and no caller's figure can make a token outlive the ruling. The
 * exchange compares it with the database's now() too: one clock. Thirty days
 * is the recommendation in question 1 of 6767214731, fixed from issue and not
 * extended by use; a different ruling moves the default and the check here and
 * the pin in the proof.
 *
 * ADDITIVE ONLY: no drop, no change to an existing constraint. A sign in
 * credential for a device rather than a regulatory or financial fact, declared
 * in retention-policy.ts. RLS on, no policies, every grant revoked: the service
 * role reads and writes.
 *
 * Development in a sitting first. It does not go to production until a sitting
 * with Robert: it touches sign in.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if to_regclass('public.eng_push_subscriptions') is null then
    raise exception 'eng: 0125 follows 0124, which adds eng_push_subscriptions. It is not here.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'eng_profiles' and column_name = 'session_epoch'
  ) then
    raise exception 'eng: 0125 reads the session epoch 0120 put on eng_profiles. It is not here.';
  end if;
  if to_regclass('public.eng_device_sessions') is not null then
    raise exception 'eng: 0125 expects no eng_device_sessions before it runs.';
  end if;
end;
$$;

/* ------------------------------------------------------------------------ table */

create table eng_device_sessions (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  profile_id       uuid not null references eng_profiles (id) on delete cascade,
  /* Which phone: the store app reports android or ios. */
  platform         text not null
                     constraint eng_device_sessions_platform_known
                     check (platform in ('android', 'ios')),
  /* The sha256 of the token, as 64 lowercase hex characters. The token itself is never stored. */
  token_hash       text not null
                     constraint eng_device_sessions_hash_shape
                     check (token_hash ~ '^[0-9a-f]{64}$'),
  /* The profile's session epoch when the token was issued (0120). An exchange under any other epoch is refused. */
  epoch_at_issue   integer not null
                     constraint eng_device_sessions_epoch_whole
                     check (epoch_at_issue >= 0),
  expires_at       timestamptz not null default (now() + interval '30 days'),
  constraint eng_device_sessions_life_is_thirty_days
    check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  last_used_at     timestamptz,
  revoked_at       timestamptz,
  revoked_reason   text,
  constraint eng_device_sessions_revocation_says_why
    check ((revoked_at is null) = (revoked_reason is null))
);

create unique index eng_device_sessions_hash_once on eng_device_sessions (token_hash);
create index eng_device_sessions_live_idx on eng_device_sessions (profile_id) where revoked_at is null;

alter table eng_device_sessions enable row level security;
revoke all on eng_device_sessions from public, anon, authenticated;

comment on table eng_device_sessions is
  'One row per phone a field technician signed in on in the store app (Robert''s answer of 2026-11-10, 6766967932): the sha256 of a token the app keeps in the phone''s keystore and exchanges for a fresh session. Thirty days at most; sign out, a moved session epoch, a suspension or a changed role stamps it revoked. 0125.';

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if to_regclass('public.eng_device_sessions') is null then
    raise exception 'eng: 0125 expects eng_device_sessions after it runs.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.eng_device_sessions'::regclass) then
    raise exception 'eng: 0125 expects row level security on eng_device_sessions.';
  end if;
  if to_regclass('public.eng_device_sessions_hash_once') is null then
    raise exception 'eng: 0125 expects one row per token hash.';
  end if;
end;
$$;
