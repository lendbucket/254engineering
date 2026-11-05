
/*
 * ===========================================================================
 * 0118: A SESSION ENDS WHEN ITS EPOCH MOVES.
 * Auth M2, Robert's ruling on issue #1 (answer to 6586517364): "option A,
 * rollout 1, built after Q14".
 * ===========================================================================
 *
 * Every session cookie on this platform is a signed, stateless token, so until
 * now nothing could end one early: a password changed because it leaked left
 * every session opened with the leaked password alive until its own expiry,
 * twelve hours for staff, fourteen days for a partner, thirty for a customer.
 *
 * ONE COLUMN ON EACH OF THE THREE PRINCIPAL TABLES, session_epoch, an integer
 * starting at 0. Each signed cookie carries the epoch it was issued under, and
 * the read every request already makes (currentActor, currentCustomer,
 * currentPartner) refuses a cookie whose epoch is not the row's. Moving the
 * number by one ends every session that person holds, on every device.
 *
 * It moves on every password set, a staff forced reset, a staff suspension, a
 * replaced second factor, and "sign out everywhere". The person who changed
 * their own password is handed a fresh cookie under the new epoch in the same
 * response, so the tab in use stays signed in.
 *
 * ROLLOUT 1: a cookie of the old shape carries no epoch and is refused, never
 * read as epoch 0, so everybody signs in once more after the deploy. Reading a
 * missing epoch as 0 would let a cookie stolen before the deploy outlive the
 * first password change after it.
 *
 * ADDITIVE ONLY: three columns with a default, nothing dropped, no constraint
 * changed, no row rewritten beyond the default. The columns need no retention
 * declaration because they add no table.
 *
 * Development first, on stage/0118-session-epoch; production at the chat
 * counterpart's sitting after M2's board.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if to_regclass('public.eng_crm_attributions') is null then
    raise exception 'eng: 0118 follows 0117, which adds eng_crm_attributions. It does not exist here.';
  end if;
  if to_regclass('public.eng_profiles') is null
     or to_regclass('public.eng_customer_users') is null
     or to_regclass('public.eng_partner_users') is null then
    raise exception 'eng: 0118 adds a column to eng_profiles, eng_customer_users and eng_partner_users, and one of them does not exist here.';
  end if;
end;
$$;

/* ---------------------------------------------------------------------- columns */

alter table eng_profiles
  add column if not exists session_epoch integer not null default 0;
alter table eng_customer_users
  add column if not exists session_epoch integer not null default 0;
alter table eng_partner_users
  add column if not exists session_epoch integer not null default 0;

comment on column eng_profiles.session_epoch is
  'Auth M2 (0118): the epoch every staff session cookie carries. Moving it ends every session this person holds. Moved by a password set, a forced reset, a suspension, a replaced second factor and "sign out everywhere".';
comment on column eng_customer_users.session_epoch is
  'Auth M2 (0118): the epoch every customer session cookie carries. Moving it ends every session this user holds. Moved by a password set and "sign out everywhere".';
comment on column eng_partner_users.session_epoch is
  'Auth M2 (0118): the epoch every partner session cookie carries. Moving it ends every session this user holds. Moved by a password set.';

/* ------------------------------------------------------------- closing assert */

do $$
declare
  t text;
begin
  foreach t in array array['eng_profiles', 'eng_customer_users', 'eng_partner_users'] loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'session_epoch'
         and data_type = 'integer' and is_nullable = 'NO' and column_default = '0'
    ) then
      raise exception 'eng: 0118 expects %.session_epoch, integer not null default 0, after it runs.', t;
    end if;
  end loop;
end;
$$;
