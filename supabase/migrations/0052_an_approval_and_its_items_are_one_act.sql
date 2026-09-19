/*
 * AN APPROVAL AND ITS ITEMS ARE ONE ACT.
 * Operator ruling, 2026-09-19.
 *
 * "Seed the 51 items on approval. That is not approving on his behalf; it is
 * his approval taking effect. A protocol that is approved and whose items do
 * not exist is approved in name only. Two conditions. The seeding is part of
 * the approval transaction, so a protocol cannot be approved with its items
 * missing or its items exist without an approval. And the rows derive from the
 * registry."
 *
 * 0049 gave the platform the words: draft means unsigned, awaiting_engineer
 * means signed and not yet approved here, published means in force with a named
 * approver. What it did not give was the ACT. Nothing made the approval and the
 * seeding inseparable, and nothing stopped a row reaching 'published' by an
 * UPDATE somebody typed.
 *
 * WHAT THIS MIGRATION FOUND ON ITS WAY IN, AND IT IS THE REASON THE FUNCTION IS
 * THE ONLY DOOR RATHER THAN A CONVENIENCE.
 *
 * `publishProtocol` in src/lib/ops-field.ts has been unable to succeed since
 * 0049 reached production on 2026-09-17. It updates status to 'published' and
 * sets published_at, and it sets no approver, so
 * eng_protocol_templates_published_is_approved_ck refuses every call. The
 * seeder was taught about the approval columns in the same week and the product
 * path was not. Two accounts of one fact, and the one nobody looked at is the
 * one that drifted, exactly as this repository keeps finding.
 *
 * Nothing on the board could see it. Publishing a protocol is an act by a named
 * engineer in his own session, so there is no live fixture that performs one and
 * there must not be. It was found by reading the code against the migration.
 *
 * So this does not repair that path. It REPLACES it: after this migration there
 * is exactly one way a protocol becomes in force, and a stray UPDATE is refused
 * by the database rather than by whoever remembers.
 *
 * ------------------------------------------------------------------------
 * WHAT IS ENFORCED, AND WHICH OF THE OPERATOR'S TWO CONDITIONS EACH CARRIES
 * ------------------------------------------------------------------------
 *
 *   1. A template reaches 'published' ONLY from inside eng_approve_protocol.
 *      The function sets a transaction local setting naming the row it is
 *      approving, and the trigger refuses the transition without it. This is
 *      what makes "the seeding is part of the approval transaction" a fact
 *      about the database rather than a fact about the caller: there is no
 *      approval that did not run the seeding, because there is no other door.
 *
 *   2. At COMMIT, a published or retired template must hold at least one item
 *      and at least one REQUIRED item. Deferred, so the function may write the
 *      rows in whichever order it likes, and checked by re-reading the row
 *      rather than by trusting the NEW record, because a row published and then
 *      unpublished inside one transaction must be judged as it finally stands.
 *
 *   3. The items of a published or retired template are frozen. That is the
 *      other half of "cannot be approved with its items missing": an approval
 *      that can be hollowed out afterwards is an approval with a hole in it.
 *      It also protects a technician who is standing on a roof working the
 *      checklist, which is the reason ops-field already refused this in
 *      application code. Application code is not a constraint.
 *
 * The SECOND operator condition, that the rows derive from the registry, is not
 * enforceable here and this migration does not pretend otherwise. Postgres
 * cannot know that 254-RC-001 has 51 items or what its ninth one says. The
 * items arrive as jsonb, they are produced by `protocolItemRows()` in
 * src/lib/protocol-run.ts, which maps the verbatim-verified registry, and
 * `protocol-run-audit` asserts that round trip in both directions. What this
 * migration contributes is that the rows cannot arrive by any other route and
 * cannot be edited afterwards.
 *
 * NOTHING IS APPROVED BY THIS MIGRATION, the same sentence 0049 carries and for
 * the same reason. It adds the door. Walking through it is an act by a named
 * engineer in his own session.
 */

/*
 * FIRST, REFUSE TO APPLY OVER A STATE THIS MIGRATION WOULD MAKE UNREACHABLE.
 *
 * The constraint trigger below fires on rows that CHANGE, which is how
 * constraint triggers work and is not enough on its own: a template already
 * sitting in 'published' with no items would sail past it forever. So the
 * offending shape is looked for before anything is created, and the migration
 * refuses rather than installing a guard over a state it silently tolerates.
 *
 * This is the idiom 0049 used and recorded: assert the target before writing.
 */
do $$
declare
  bad integer;
begin
  select count(*) into bad
  from eng_protocol_templates t
  where t.status in ('published', 'retired')
    and not exists (select 1 from eng_protocol_items i where i.template_id = t.id);
  if bad > 0 then
    raise exception
      'eng: % protocol template(s) are in force or retired with no items. This migration will not install a guard over a state it cannot see. Fix the rows first.',
      bad;
  end if;
end;
$$;


/*
 * THE DOOR.
 *
 * SECURITY INVOKER rather than definer, deliberately. This function decides
 * nothing about who may call it; the application has already checked that the
 * actor is the engineer of record and holds the grant. A definer here would
 * hand the service role's authority to anything that can reach the RPC, which
 * is a wider door than the one being built.
 *
 * search_path is pinned, as every function in this schema is.
 */
create or replace function eng_approve_protocol(
  p_template_id  uuid,
  p_approved_by  uuid,
  p_license      text,
  p_items        jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status  text;
  v_slug    text;
  v_count   integer;
begin
  select status, service_slug into v_status, v_slug
  from eng_protocol_templates
  where id = p_template_id
  for update;

  if not found then
    raise exception 'eng: no protocol template %', p_template_id;
  end if;

  /*
   * 0049's vocabulary decides this, not a convenience. draft means the engineer
   * has not signed the document, and approving an unsigned document in the
   * platform would be the platform claiming something the paper does not.
   */
  if v_status <> 'awaiting_engineer' then
    raise exception
      'eng: a protocol is approved from awaiting_engineer, and % is %. Draft means the engineer has not signed it.',
      p_template_id, v_status;
  end if;

  if p_approved_by is null or p_license is null or btrim(p_license) = '' then
    raise exception 'eng: an approval names the engineer and his licence.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'eng: an approval seeds the protocol items, and none were supplied.';
  end if;

  /*
   * The items are replaced rather than added to. An approval is the moment the
   * signed document's checklist comes into being, so whatever was sitting there
   * from authoring is not what the engineer signed. The template is still
   * awaiting_engineer at this point, so the freeze below does not apply yet.
   */
  delete from eng_protocol_items where template_id = p_template_id;

  insert into eng_protocol_items (
    template_id, sort_order, item_key, kind, label, instructions,
    required, unit, min_value, max_value, min_count
  )
  select
    p_template_id,
    (r->>'sort_order')::integer,
    r->>'item_key',
    r->>'kind',
    r->>'label',
    r->>'instructions',
    coalesce((r->>'required')::boolean, true),
    r->>'unit',
    (r->>'min_value')::numeric,
    (r->>'max_value')::numeric,
    (r->>'min_count')::integer
  from jsonb_array_elements(p_items) as r;

  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_items) then
    raise exception 'eng: % item(s) supplied and % written.', jsonb_array_length(p_items), v_count;
  end if;

  /*
   * Two protocols in force for one service line is an ambiguity dispatch would
   * have to guess its way out of, so the previous one retires in the same
   * transaction. Its items stay, because files worked under it point at them.
   */
  update eng_protocol_templates
     set status = 'retired'
   where service_slug = v_slug
     and status = 'published'
     and id <> p_template_id;

  /*
   * The transaction local setting the trigger looks for. `true` is the is_local
   * argument: it dies with this transaction, so it cannot leak into the next
   * statement on a pooled connection.
   */
  perform set_config('eng.approving', p_template_id::text, true);

  update eng_protocol_templates
     set status              = 'published',
         published_at        = now(),
         approved_by         = p_approved_by,
         approved_at         = now(),
         approved_by_license = p_license
   where id = p_template_id;
end;
$$;

comment on function eng_approve_protocol(uuid, uuid, text, jsonb) is
  'The one door to a protocol being in force. Seeds the items and records the approval in one transaction, because an approval whose items do not exist is an approval in name only.';


/*
 * THE TRIGGER THAT MAKES IT THE ONLY DOOR.
 *
 * Without this the function is a convenience and an UPDATE is a bypass. With
 * it, "approved" and "went through the seeding" are the same event, which is
 * the operator's first condition stated as a property of the database.
 *
 * It fires only on the TRANSITION into 'published'. A published row being
 * touched for any other reason, a retirement for instance, is untouched.
 */
create or replace function eng_guard_protocol_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published' and coalesce(old.status, '') <> 'published' then
    if coalesce(current_setting('eng.approving', true), '') <> new.id::text then
      raise exception
        'eng: a protocol becomes in force through eng_approve_protocol and no other way, because the approval and the seeding of its items are one act.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists eng_protocol_templates_approval_is_one_act on eng_protocol_templates;
create trigger eng_protocol_templates_approval_is_one_act
  before update on eng_protocol_templates
  for each row execute function eng_guard_protocol_approval();

/*
 * And the same refusal for an INSERT that arrives already published, which is
 * the shape a seeder reaches for. Separate trigger because there is no OLD row
 * to compare against.
 */
create or replace function eng_guard_protocol_insert_in_force()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published' then
    raise exception
      'eng: a protocol cannot be created already in force. It is drafted, signed, and then approved through eng_approve_protocol.';
  end if;
  return new;
end;
$$;

drop trigger if exists eng_protocol_templates_not_born_in_force on eng_protocol_templates;
create trigger eng_protocol_templates_not_born_in_force
  before insert on eng_protocol_templates
  for each row execute function eng_guard_protocol_insert_in_force();


/*
 * A PROTOCOL IN FORCE HOLDS ITS ITEMS. Checked at COMMIT.
 *
 * Deferred for a reason worth stating: the function writes the items and then
 * moves the status, and a non-deferred trigger would therefore have to care
 * about statement order. Ordering rules are the kind a later caller breaks
 * without noticing. This asks the question once, at the end, of the row as it
 * finally stands.
 *
 * It RE-READS the row rather than trusting NEW, because a template published
 * and then unpublished inside one transaction must be judged on where it
 * landed. Trusting NEW would fail a transaction that ended in a legal state.
 */
create or replace function eng_protocol_in_force_holds_items()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status   text;
  v_items    integer;
  v_required integer;
begin
  select status into v_status from eng_protocol_templates where id = new.id;
  -- Deleted later in the same transaction. Nothing to assert.
  if not found then
    return null;
  end if;
  if v_status not in ('published', 'retired') then
    return null;
  end if;

  select count(*), count(*) filter (where required)
    into v_items, v_required
    from eng_protocol_items where template_id = new.id;

  if v_items = 0 then
    raise exception
      'eng: protocol % is in force with no items. An approved protocol whose items do not exist is approved in name only.',
      new.id;
  end if;
  if v_required = 0 then
    raise exception
      'eng: protocol % is in force with no required item, so its submission gate would pass an empty package.',
      new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists eng_protocol_in_force_holds_items on eng_protocol_templates;
create constraint trigger eng_protocol_in_force_holds_items
  after insert or update on eng_protocol_templates
  deferrable initially deferred
  for each row execute function eng_protocol_in_force_holds_items();


/*
 * AND ITS ITEMS ARE FROZEN ONCE IT IS IN FORCE.
 *
 * The third guarantee. ops-field.ts already refuses to edit a published
 * protocol's items, and that refusal lives in the application, which means it
 * covers the one path somebody remembered. A technician working a checklist
 * that changes underneath them gets a submission gate that moves while they are
 * trying to clear it, on a roof, on a phone.
 *
 * Cascade is allowed, following eng_forbid_mutation_allow_cascade: deleting the
 * TEMPLATE takes its items with it, which is a different act from hollowing out
 * a protocol that remains in force. pg_trigger_depth() is how the two are told
 * apart, and it is the idiom this schema already uses.
 */
create or replace function eng_freeze_items_of_a_protocol_in_force()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
    from eng_protocol_templates
   where id = coalesce(old.template_id, new.template_id);

  if v_status is null or v_status not in ('published', 'retired') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  raise exception
    'eng: protocol % is in force or retired, so its items are fixed. Start the next version instead.',
    coalesce(old.template_id, new.template_id);
end;
$$;

drop trigger if exists eng_protocol_items_frozen_in_force on eng_protocol_items;
create trigger eng_protocol_items_frozen_in_force
  before update or delete on eng_protocol_items
  for each row execute function eng_freeze_items_of_a_protocol_in_force();

comment on function eng_freeze_items_of_a_protocol_in_force() is
  'An approval that can be hollowed out afterwards is an approval with a hole in it. Cascade from deleting the template is allowed; editing the items of a protocol in force is not.';
