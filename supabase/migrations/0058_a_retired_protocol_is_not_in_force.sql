/*
 * ===========================================================================
 * 0058  A RETIRED PROTOCOL IS NOT IN FORCE, SO RECORDING ONE NEEDS NO ITEMS.
 * ===========================================================================
 *
 * DRAFTED 2026-09-23 AND NOT APPLIED. Operator ruling: it is applied in a
 * sitting with him, together with the register entry, because both touch
 * production. Until then its ledger entry is pending and this file holds a
 * merge, which is the rule: a migration on main is never pending.
 *
 * WHAT IS WRONG TODAY. 0052 added `eng_protocol_in_force_holds_items`, a
 * deferred constraint trigger, to make a protocol in force hold its checklist.
 * That is right and it stays. Its guard reads
 *
 *     if v_status not in ('published', 'retired') then return null; end if;
 *
 * so it treats RETIRED as in force. Inserting a retired protocol with no items
 * is refused, with an exception that says the row "is in force with no items"
 * about a status that means the opposite of in force.
 *
 * THE GUARD CONFLATES TWO RULES AND ENFORCES A THIRD NOBODY STATED.
 *
 *   1. A protocol IN FORCE must hold its items. Right, and it is what the
 *      message describes. Unchanged by this migration.
 *
 *   2. A protocol that WAS in force must KEEP them. Also right: stripping the
 *      items off a retired protocol destroys the record of what it required,
 *      and that record is the firm's answer to "what did this inspection
 *      demand when it was performed". Unchanged by this migration.
 *
 *   3. A retired protocol may never be RECORDED without items. Neither rule
 *      says this, and it is what firing on INSERT enforces. THIS is what the
 *      migration removes, and nothing else.
 *
 * SO THE UPDATE BEHAVIOUR FOR RETIRED IS DELIBERATELY UNTOUCHED. Operator
 * ruling, 2026-09-23, and it is the whole shape of the fix: hollowing out a
 * retired protocol is still refused, because that is rule 2 and rule 2 is
 * about REMOVING items from something that has been in force. Only the INSERT
 * case changes.
 *
 * TG_OP IS WHAT TELLS THEM APART, and it is available in a constraint trigger
 * exactly as in any other. The deferral is kept: the approval function writes
 * the items and then moves the status, so a non deferred trigger would have to
 * care about statement order, which is the reasoning 0052 already records.
 *
 * WHAT IT COSTS TO LEAVE UNFIXED, which is why this is small rather than
 * urgent. Nothing in the product inserts or moves a protocol to retired. The
 * lifecycle reaches retired by UPDATE from published, which already holds its
 * items, so no path a person can take today is refused. It would bite on
 * recording a HISTORICAL protocol, retired before this platform existed, whose
 * items were never transcribed.
 *
 * HOW IT WAS FOUND, because it is the argument for the thing that found it.
 * `scripts/proofs/a-signed-protocol-is-not-a-draft.mjs` has asserted this since
 * 0049 and was reached by NOTHING: proofs were neither enumerated nor listed,
 * so one ran only if an audit imported it. `scripts/proofs-audit.mjs` was built
 * on 2026-09-23 to end that, and this defect was the first thing its first run
 * produced. 0052 changed the behaviour of a retired insert and six migrations
 * passed before anybody saw it.
 *
 * NOTHING ELSE IN 0052 IS TOUCHED. `eng_guard_protocol_insert_in_force`, which
 * refuses a row born published, and `eng_freeze_items_of_a_protocol_in_force`
 * are both unchanged.
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

  /*
   * PUBLISHED IS IN FORCE, ON INSERT AND ON UPDATE, ALWAYS.
   *
   * RETIRED IS NOT IN FORCE. What must still hold is that a protocol which HAS
   * been in force does not have its items taken away, which is an UPDATE. A
   * retired row arriving by INSERT has never been in force in this database and
   * has nothing to preserve, so requiring items of it asserts a rule nobody
   * stated and refuses a legitimate historical record.
   */
  if v_status = 'published' then
    null;
  elsif v_status = 'retired' and TG_OP = 'UPDATE' then
    null;
  else
    return null;
  end if;

  select count(*), count(*) filter (where required)
    into v_items, v_required
    from eng_protocol_items where template_id = new.id;

  if v_items = 0 then
    raise exception
      'eng: protocol % is %, and a protocol that is or has been in force must hold its items. An approved protocol whose items do not exist is approved in name only.',
      new.id, v_status;
  end if;
  if v_required = 0 then
    raise exception
      'eng: protocol % is %, and has no required item, so its submission gate would pass an empty package.',
      new.id, v_status;
  end if;
  return null;
end;
$$;

comment on function eng_protocol_in_force_holds_items() is
  'A protocol in force holds its items, and one that has been in force does not lose them. Published is checked on insert and update; retired is checked on UPDATE only, because a retired row arriving by insert has never been in force here and has nothing to preserve. 0052 checked retired on insert too, which refused the recording of a historical retired protocol and said it was "in force" about a status meaning the opposite.';
