/*
 * ===========================================================================
 * 0071: SIGN IN ATTEMPTS ARE COUNTED IN THE DATABASE. Operator ruling,
 * 2026-10-10 (decision 14 of the product audit).
 * ===========================================================================
 *
 * The sign in limiter counted in a Map in process memory (ops-rate-limit.ts).
 * On Vercel every warm instance holds its own Map, so an attacker spread across
 * instances got N times the limit, and a cold start forgot every count. The
 * ordering API's limiter already counts in the database (0010) for exactly this
 * reason; the sign in limiter now does too.
 *
 * APPEND ONLY. A successful sign in, and an administrator releasing a lock
 * (/api/portal/unlock), write a RESET row rather than deleting anything, and
 * counting starts after the latest reset. So nothing here deletes, and the table
 * needs no place in retention's deletable set: it is declared kept pending
 * counsel, as the ordering API's request log is.
 *
 * THE RULE IS UNCHANGED: per address, and per address and identity, within a
 * window; the limits stay in TypeScript (ops-rate-limit.ts) and are passed in.
 * eng_take_sign_in_attempt records the attempt and answers in one statement, so
 * two instances racing count each other. "After the latest reset" is by row
 * id, not timestamp: two rows written in one transaction share now(), and an
 * attempt in the same instant as a reset must still count.
 */
create table if not exists eng_sign_in_attempts (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  address     text not null,
  identity    text,
  kind        text not null check (kind in ('attempt', 'reset'))
);

create index if not exists eng_sign_in_attempts_address_idx
  on eng_sign_in_attempts (address, created_at desc);

alter table eng_sign_in_attempts enable row level security;

comment on table eng_sign_in_attempts is
  'Sign in attempts per address and identity, and the resets that end a count (a successful sign in, an administrator release). Append only; read by eng_take_sign_in_attempt. 0071, operator ruling 2026-10-10.';

create or replace function eng_take_sign_in_attempt(
  p_address         text,
  p_identity        text,
  p_max_address     integer,
  p_max_identity    integer,
  p_window_seconds  integer
)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_window   interval := make_interval(secs => p_window_seconds);
  v_reset_a  bigint;
  v_reset_i  bigint;
  v_count    integer;
  v_first    timestamptz;
begin
  insert into public.eng_sign_in_attempts (address, identity, kind) values (p_address, p_identity, 'attempt');

  select max(id) into v_reset_a
    from public.eng_sign_in_attempts
   where address = p_address and kind = 'reset' and identity is null;

  select count(*), min(created_at) into v_count, v_first
    from public.eng_sign_in_attempts
   where address = p_address and kind = 'attempt'
     and created_at > now() - v_window
     and id > coalesce(v_reset_a, 0);

  if v_count > p_max_address then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'scope', 'address',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_first + v_window - now())))::integer));
  end if;
  if p_identity is null then
    return jsonb_build_object('allowed', true, 'remaining', p_max_address - v_count, 'retry_after_seconds', 0);
  end if;

  select max(id) into v_reset_i
    from public.eng_sign_in_attempts
   where address = p_address and kind = 'reset' and (identity is null or identity = p_identity);

  select count(*), min(created_at) into v_count, v_first
    from public.eng_sign_in_attempts
   where address = p_address and identity = p_identity and kind = 'attempt'
     and created_at > now() - v_window
     and id > coalesce(v_reset_i, 0);

  if v_count > p_max_identity then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'scope', 'identity',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_first + v_window - now())))::integer));
  end if;
  return jsonb_build_object('allowed', true, 'remaining', p_max_identity - v_count, 'retry_after_seconds', 0);
end;
$fn$;

comment on function eng_take_sign_in_attempt(text, text, integer, integer, integer) is
  'Records one sign in attempt and answers whether it is within the limits passed, per address and per address and identity, counting within the window since the latest reset. 0071.';
