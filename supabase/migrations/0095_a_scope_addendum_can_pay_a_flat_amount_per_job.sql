/*
 * ===========================================================================
 * 0095  A SCOPE ADDENDUM CAN PAY THE ENGINEER A FLAT AMOUNT PER JOB.
 * ===========================================================================
 * Robert's ruling of 2026-10-26, 07:10 Central:
 *
 *   - WPI-8 ongoing construction (windstorm-wpi-8/ongoing) opens through a
 *     scope addendum. The engineer is paid $175 per job, one flat amount
 *     covering every stage review and the issued certificate for that job,
 *     extra stage visits included, on the same schedule as his other
 *     per-document pay. Nothing else in his agreement changes.
 *   - The owner or an administrator drafts the addendum in the portal (line,
 *     amount, text); it waits on the engineer's portal home; he signs it with
 *     a fresh code over the hash of its text, through 0082's door.
 *   - The moment his signature is recorded, the line opens at its door.
 *
 * WHY 0082 COULD NOT HOLD IT AS IT WAS. eng_scope_addenda prices a DESIGN
 * QUOTE: quote_id is required, its text trigger refuses a row with no quote,
 * and its pay must equal the engineering fee times his share. A flat amount per
 * job has no quote, no fee and no share. Filling those columns with a fee equal
 * to the pay and a share of 100% would make the row say something untrue about
 * itself, and the text would print it. So the row says which kind it is.
 *
 * WHAT THIS ADDS, all additive except where said:
 *
 *   1. eng_scope_addenda.basis: 'design_share' (0082's kind, the default, so
 *      every existing row keeps its meaning) or 'per_job'.
 *   2. quote_id, fee_cents and share_bp lose NOT NULL, and a shape check takes
 *      its place: a design_share row must carry all three, exactly as before;
 *      a per_job row carries none of them, names a deliverable keyed
 *      serviceSlug/tier, and carries its pay per job in pay_cents. 0082's pay
 *      check still holds every design_share row (it is null, and so passes, on
 *      a per_job row, whose pay is its own figure).
 *      THESE THREE STATEMENTS CARRY `drop not null`. They loosen no rule: the
 *      shape check in the same file requires all three wherever 0082 did.
 *   3. eng_scope_addendum_text is replaced. A design_share row's text is
 *      byte for byte 0082's. A per_job row's text names the engineer, the
 *      deliverable, the scope in the drafter's words, and the pay per job.
 *   4. eng_line_pay(deliverable): the live signed per_job addendum for that
 *      deliverable, or no row. The NEWEST per_job addendum for the deliverable
 *      decides, signed or not, as eng_design_pay does for a quote: a
 *      replacement not yet signed pays nothing and opens nothing.
 *   5. The grant addenda.draft, for admin (declared in DEFAULT_ROLES, pinned in
 *      roles-audit).
 *
 * WHAT IT DOES NOT CHANGE. The signature is 0082's: a seal act of kind
 * addendum through eng_record_addendum_signature, checked by eng_seal_act_check
 * (whose addendum clause, as 0088 and 0091 restate it, asks only that the
 * addendum names the signer and that the hash is its own). No seal act, no
 * check and no guard is replaced here. eng_design_pay is untouched, and never
 * matches a per_job row, which has no quote.
 *
 * SECURITY INVOKER, search_path pinned, EXECUTE revoked from PUBLIC, anon and
 * authenticated in this file (0073).
 */

/* 1. Which kind of addendum a row is. */
alter table eng_scope_addenda
  add column if not exists basis text not null default 'design_share';

alter table eng_scope_addenda
  add constraint eng_scope_addenda_basis_ck check (basis in ('design_share', 'per_job'));

/* 2. The three design columns are required by the shape check, not by NOT NULL. */
alter table eng_scope_addenda alter column quote_id drop not null;
alter table eng_scope_addenda alter column fee_cents drop not null;
alter table eng_scope_addenda alter column share_bp drop not null;

alter table eng_scope_addenda
  add constraint eng_scope_addenda_shape_ck check (
    (basis = 'design_share' and quote_id is not null and fee_cents is not null and share_bp is not null)
    or (basis = 'per_job' and quote_id is null and fee_cents is null and share_bp is null
        and pay_cents > 0 and deliverable ~ '^[a-z0-9-]+/[a-z0-9-]+$')
  );

comment on column eng_scope_addenda.basis is
  'design_share: 0082''s addendum, his share of one design quote''s fee. per_job: a flat pay_cents for every job of one deliverable, with no quote, fee or share. 0095.';

/* 3. The text he signs, for either kind. A design_share row reads exactly as under 0082. */
create or replace function eng_scope_addendum_text()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_quote record;
  v_engineer text;
begin
  select display_name into v_engineer from public.eng_profiles where id = new.engineer_id and role = 'engineer';

  if new.basis = 'per_job' then
    if v_engineer is null then
      raise exception 'eng: a scope addendum names the engineer who signs it, and % is not an engineer.', new.engineer_id;
    end if;
    new.addendum_text :=
      'Scope addendum to the engineer of record''s agreement.' || chr(10) ||
      'Engineer: ' || v_engineer || chr(10) ||
      'Deliverable: ' || new.deliverable || chr(10) ||
      'Scope: ' || btrim(new.scope) || chr(10) ||
      'Pay: $' || to_char(new.pay_cents / 100.0, 'FM999,999,990.00') || ' per job, one flat amount.' || chr(10) ||
      'This pay is owed only under this addendum, signed by the engineer in the portal.';
    new.content_sha256 := encode(sha256(convert_to(new.addendum_text, 'UTF8')), 'hex');
    return new;
  end if;

  select reference, service_slug, tier, property_address, city, county
    into v_quote
    from public.eng_quote_requests where id = new.quote_id;
  if not found then
    raise exception 'eng: a scope addendum prices a design quote, and % is not one.', new.quote_id;
  end if;
  if v_quote.service_slug || '/' || coalesce(v_quote.tier, '') <> new.deliverable then
    raise exception 'eng: the addendum prices %, and quote % is for %/%.',
      new.deliverable, v_quote.reference, v_quote.service_slug, coalesce(v_quote.tier, '');
  end if;
  if v_engineer is null then
    raise exception 'eng: a scope addendum names the engineer who signs it, and % is not an engineer.', new.engineer_id;
  end if;
  new.addendum_text :=
    'Scope addendum to the engineer of record''s agreement.' || chr(10) ||
    'Engineer: ' || v_engineer || chr(10) ||
    'Job: design quote ' || v_quote.reference || ', ' ||
      concat_ws(', ', nullif(btrim(v_quote.property_address), ''), nullif(btrim(v_quote.city), ''),
                case when nullif(btrim(v_quote.county), '') is null then null else btrim(v_quote.county) || ' County' end) || chr(10) ||
    'Deliverable: ' || new.deliverable || chr(10) ||
    'Scope: ' || btrim(new.scope) || chr(10) ||
    'Engineering fee: $' || to_char(new.fee_cents / 100.0, 'FM999,999,990.00') || chr(10) ||
    'Engineer''s share: ' || to_char(new.share_bp / 100.0, 'FM990.##') || '% of the engineering fee, $' ||
      to_char(new.pay_cents / 100.0, 'FM999,999,990.00') || chr(10) ||
    'This share is paid only under this addendum, signed by the engineer in the portal.';
  new.content_sha256 := encode(sha256(convert_to(new.addendum_text, 'UTF8')), 'hex');
  return new;
end;
$fn$;

/*
 * 4. HIS PAY PER JOB ON A DELIVERABLE, FROM A LIVE SIGNED ADDENDUM, OR NOTHING.
 * The newest per_job addendum for the deliverable decides, signed or not, and
 * only a live seal act over its own hash counts. No row is a refusal: the line
 * stays shut at its door and no pay is owed, never a zero.
 */
create or replace function eng_line_pay(p_deliverable text)
returns table (addendum_id uuid, pay_cents bigint, engineer_id uuid, signed_at timestamptz)
language sql
stable
set search_path = ''
as $fn$
  with newest as (
    select a.* from public.eng_scope_addenda a
     where a.basis = 'per_job' and a.deliverable = p_deliverable
     order by a.created_at desc, a.id desc
     limit 1
  )
  select n.id, n.pay_cents, n.engineer_id, s.created_at
    from newest n
    join public.eng_seal_acts s
      on s.addendum_id = n.id and s.kind = 'addendum' and s.voided_at is null
     and s.content_sha256 = n.content_sha256;
$fn$;

/* 5. Who drafts an addendum (declared in DEFAULT_ROLES, pinned in roles-audit). */
insert into eng_role_grants (role_key, action) values
  ('admin', 'addenda.draft')
on conflict (role_key, action) do nothing;

/* 0073's rule for every function added or replaced here, and asserted for the whole schema. */
do $$
declare
  f record;
  open_fns text;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('eng_scope_addendum_text', 'eng_line_pay')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;

  select string_agg(p.oid::regprocedure::text, ', ') into open_fns
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'eng\_%'
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if open_fns is not null then
    raise exception 'eng: after 0095 these are still executable by anon or authenticated: %', open_fns;
  end if;

  if exists (select 1 from public.eng_scope_addenda where basis <> 'design_share') then
    raise exception 'eng: 0095 found an addendum that is not design_share before any per_job row could exist.';
  end if;
end;
$$;
