/*
 * ===========================================================================
 * 0082  A SCOPE ADDENDUM IS SIGNED BY THE ENGINEER BEFORE DESIGN IS PAID.
 * ===========================================================================
 * Operator rulings of 2026-10-22:
 *
 *   - Custom design pays the engineer 35% of the engineering fee under a
 *     signed scope addendum; no figure is paid without it.
 *   - "Aman signs the scope addendum in the portal, under his own account,
 *     with a fresh second factor, recorded as a seal-act style record exactly
 *     like a protocol signature. No PDF signing, no email signing."
 *   - The first one is the McAllen solar design job, quoted at $2,000 flat, the
 *     design minimum, so $700 to the engineer. Its real record is written on
 *     production by the operator's chat; development holds only invented data.
 *
 * WHAT THIS ADDS
 *
 *   1. eng_scope_addenda: one row per addendum, against the design quote it
 *      prices (eng_quote_requests). The engineer it names, the scope in words,
 *      the engineering fee, his share in basis points, and his pay, which must
 *      equal fee x share rounded to the cent. The DATABASE writes the addendum's
 *      text from those fields and the quote, and its SHA-256, so the row the
 *      chat inserts on production cannot carry a text or a hash that disagrees
 *      with its own figures. Append only: an addendum is replaced by a new one,
 *      never edited, and a signature on it is voided like any seal act.
 *   2. eng_seal_acts gains the kind `addendum` and the column addendum_id: the
 *      signature is the same record a protocol signature is, his current seal
 *      and signature images by id, a fresh second factor, the hash of the text
 *      he read, and voidable with a reason.
 *   3. eng_seal_act_check: an addendum is signed only by the engineer it names,
 *      and only over the hash of its own text.
 *   4. eng_record_addendum_signature: the one door a signature comes in by.
 *   5. eng_design_pay(quote): his pay on that quote, from a live signed
 *      addendum, or null. Null is a refusal to pay, never a zero.
 *
 * ONE STATEMENT CARRIES `drop`: widening eng_seal_acts' kind check, dropped and
 * re-added in the same alter table so the column is never unchecked, the
 * pattern ruled for 0081 on 2026-10-22. The chat applies it with
 * apply_migration and Robert approves a confirmation on the drop if asked.
 *
 * SECURITY INVOKER, search_path pinned, EXECUTE revoked from PUBLIC, anon and
 * authenticated in this file (0073).
 */

/* 1. The addendum. */
create table if not exists eng_scope_addenda (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  quote_id         uuid not null references eng_quote_requests (id) on delete restrict,
  /* The deliverable it prices, keyed serviceSlug/tier as the price book keys it. */
  deliverable      text not null,
  engineer_id      uuid not null references eng_profiles (id) on delete restrict,
  scope            text not null check (length(btrim(scope)) > 0),
  fee_cents        bigint not null check (fee_cents > 0),
  share_bp         integer not null check (share_bp > 0 and share_bp <= 10000),
  pay_cents        bigint not null,
  /* Written by the trigger below from the fields and the quote. Never supplied. */
  addendum_text    text not null default '',
  content_sha256   text not null default '',
  created_by       uuid references eng_profiles (id) on delete restrict,
  constraint eng_scope_addenda_pay_is_the_share_ck
    check (pay_cents = (fee_cents * share_bp + 5000) / 10000)
);

alter table eng_scope_addenda enable row level security;

comment on table eng_scope_addenda is
  'A scope addendum to the engineer of record''s agreement: the job (a design quote), the scope, the fee, his share and his pay. Its text and SHA-256 are written by the database from those figures. Append only; signed through eng_record_addendum_signature as a seal act of kind addendum, and voided like any seal act. eng_design_pay pays only on a live signature. 0082.';

/*
 * THE TEXT HE SIGNS, FROM THE FIGURES AND THE QUOTE. Written at insert, and the
 * row can never change afterwards, so the text and the hash stay the figures'.
 */
create or replace function eng_scope_addendum_text()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_quote record;
  v_engineer text;
begin
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
  select display_name into v_engineer from public.eng_profiles where id = new.engineer_id and role = 'engineer';
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

create trigger eng_scope_addenda_text
  before insert on eng_scope_addenda
  for each row execute function eng_scope_addendum_text();

create trigger eng_scope_addenda_append_only
  before update or delete on eng_scope_addenda
  for each row execute function eng_forbid_mutation();

/* 2. The signature, as a seal act. The kind check widened in one statement. */
alter table eng_seal_acts
  add column if not exists addendum_id uuid references eng_scope_addenda (id) on delete restrict;

alter table eng_seal_acts
  drop constraint if exists eng_seal_acts_kind_check,
  add constraint eng_seal_acts_kind_check check (kind in ('letter', 'protocol', 'addendum'));

alter table eng_seal_acts
  add constraint eng_seal_acts_addendum_shape_ck check (
    kind <> 'addendum'
    or (addendum_id is not null and document_id is null and determination_id is null
        and protocol_document is null and protocol_version is null)
  );

create unique index if not exists eng_seal_acts_one_live_addendum
  on eng_seal_acts (addendum_id)
  where kind = 'addendum' and voided_at is null;

/* 3. Signed only by the engineer it names, only over its own text. 0081's check, one clause wider. */
create or replace function eng_seal_act_check()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_ok boolean;
begin
  select count(*) = 2 into v_ok
    from public.eng_seal_images i
   where i.profile_id = new.sealed_by
     and i.superseded_at is null
     and ((i.id = new.seal_image_id and i.kind = 'seal')
       or (i.id = new.signature_image_id and i.kind = 'signature'));
  if not v_ok then
    raise exception
      'A seal act must use the sealer''s own current seal image and signature image.';
  end if;

  if not exists (
    select 1 from public.eng_profiles p
     where p.id = new.sealed_by and p.role = 'engineer'
  ) then
    raise exception 'Only a licensed engineer applies a seal.';
  end if;

  if new.kind = 'letter' and not exists (
    select 1 from public.eng_determinations d
     where d.id = new.determination_id and d.engineer_id = new.sealed_by
  ) then
    raise exception
      'A letter is sealed only by the engineer who recorded its determination.';
  end if;

  if new.kind = 'letter' and (new.letterhead_sha256 is null or new.letterhead_sha256 !~ '^[0-9a-f]{64}$') then
    raise exception
      'A letter is sealed with the SHA-256 of the mark at its head (0081).';
  end if;

  if new.kind = 'addendum' and not exists (
    select 1 from public.eng_scope_addenda a
     where a.id = new.addendum_id and a.engineer_id = new.sealed_by and a.content_sha256 = new.content_sha256
  ) then
    raise exception
      'A scope addendum is signed only by the engineer it names, over the hash of its own text (0082).';
  end if;

  return new;
end;
$fn$;

/* The guard of 0081, with addendum_id among what a seal act may never change. */
create or replace function eng_seal_act_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception
      'eng_seal_acts rows cannot be deleted. A seal that no longer stands is voided, with a reason, and stays.';
  end if;
  if old.voided_at is not null then
    raise exception 'A voided seal act cannot change again.';
  end if;
  if new.id <> old.id
     or new.created_at <> old.created_at
     or new.kind <> old.kind
     or new.document_id is distinct from old.document_id
     or new.determination_id is distinct from old.determination_id
     or new.protocol_document is distinct from old.protocol_document
     or new.protocol_version is distinct from old.protocol_version
     or new.content_sha256 <> old.content_sha256
     or new.seal_image_id <> old.seal_image_id
     or new.signature_image_id <> old.signature_image_id
     or new.sealed_by <> old.sealed_by
     or new.mfa_verified_at <> old.mfa_verified_at
     or new.letterhead_sha256 is distinct from old.letterhead_sha256
     or new.addendum_id is distinct from old.addendum_id then
    raise exception
      'A seal act records what was sealed. Only voided_at, voided_by and voided_because may be set, once.';
  end if;
  return new;
end;
$fn$;

/* The audit of 0062, naming an addendum signature as what it is. */
create or replace function eng_seal_act_audit()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_actor uuid := case when tg_op = 'INSERT' then new.sealed_by else new.voided_by end;
begin
  insert into public.eng_audit_events (actor_id, actor_role, action, entity_type, entity_id, summary, diff)
  values (
    v_actor,
    (select p.role from public.eng_profiles p where p.id = v_actor),
    case
      when tg_op = 'INSERT' and new.kind = 'letter' then 'seal.applied'
      when tg_op = 'INSERT' and new.kind = 'addendum' then 'addendum.signed'
      when tg_op = 'INSERT' then 'protocol.signed'
      else 'seal.voided'
    end,
    'seal_act',
    new.id::text,
    case
      when tg_op = 'INSERT' and new.kind = 'letter' then 'Letter sealed, sha256 ' || new.content_sha256
      when tg_op = 'INSERT' and new.kind = 'addendum' then 'Scope addendum ' || new.addendum_id || ' signed, sha256 ' || new.content_sha256
      when tg_op = 'INSERT' then 'Protocol ' || new.protocol_document || ' v' || new.protocol_version || ' signed, sha256 ' || new.content_sha256
      else 'Seal act voided: ' || new.voided_because
    end,
    jsonb_build_object(
      'kind', new.kind,
      'content_sha256', new.content_sha256,
      'document_id', new.document_id,
      'determination_id', new.determination_id,
      'protocol_document', new.protocol_document,
      'protocol_version', new.protocol_version,
      'addendum_id', new.addendum_id,
      'seal_image_id', new.seal_image_id,
      'signature_image_id', new.signature_image_id,
      'mfa_verified_at', new.mfa_verified_at,
      'voided_because', new.voided_because
    )
  );
  return new;
end;
$fn$;

/* 4. The one door an addendum signature comes in by. */
create or replace function eng_record_addendum_signature(
  p_seal_act_id         uuid,
  p_addendum_id         uuid,
  p_sha256              text,
  p_sealed_by           uuid,
  p_seal_image_id       uuid,
  p_signature_image_id  uuid,
  p_mfa_verified_at     timestamptz
)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  insert into public.eng_seal_acts
    (id, kind, addendum_id, content_sha256, seal_image_id, signature_image_id, sealed_by, mfa_verified_at)
  values
    (p_seal_act_id, 'addendum', p_addendum_id, p_sha256, p_seal_image_id, p_signature_image_id, p_sealed_by, p_mfa_verified_at);
end;
$fn$;

/*
 * 5. HIS PAY ON A DESIGN QUOTE, FROM A LIVE SIGNED ADDENDUM, OR NOTHING. The
 * NEWEST addendum on the quote decides, signed or not: a replacement addendum
 * not yet signed pays nothing, rather than letting the one it replaced go on
 * paying. An addendum with no signature, or whose signature was voided, pays
 * nothing. No row is a refusal the caller states in words, never a zero.
 */
create or replace function eng_design_pay(p_quote_id uuid)
returns table (addendum_id uuid, pay_cents bigint, fee_cents bigint, share_bp integer, signed_at timestamptz)
language sql
stable
set search_path = ''
as $fn$
  with newest as (
    select a.* from public.eng_scope_addenda a
     where a.quote_id = p_quote_id
     order by a.created_at desc, a.id desc
     limit 1
  )
  select n.id, n.pay_cents, n.fee_cents, n.share_bp, s.created_at
    from newest n
    join public.eng_seal_acts s
      on s.addendum_id = n.id and s.kind = 'addendum' and s.voided_at is null
     and s.content_sha256 = n.content_sha256;
$fn$;

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
      and p.proname in (
        'eng_scope_addendum_text', 'eng_seal_act_check', 'eng_seal_act_guard', 'eng_seal_act_audit',
        'eng_record_addendum_signature', 'eng_design_pay'
      )
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
    raise exception 'eng: after 0082 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;
