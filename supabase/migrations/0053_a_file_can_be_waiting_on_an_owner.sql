/*
 * A FILE WAITING ON AN OWNER TO HAVE REPAIRS DONE IS A REAL STATE OF THE WORLD.
 * Operator ruling, 2026-09-19.
 *
 * THIRD INSTANCE OF ONE LESSON, AND THE OPERATOR NAMED IT AS SUCH.
 *
 *   | 2026-09-14 | a null meaning both "no price" and "nothing accepted"   |
 *   | 2026-09-16 | a signed protocol awaiting approval, called a `draft`   |
 *   | 2026-09-19 | a file waiting on an owner, called any of four lies     |
 *
 * A STATUS VOCABULARY THAT LACKS A WORD FOR THE SITUATION MAKES SOMEBODY CHOOSE
 * THE NEAREST LIE. The answer is the same all three times: add the word.
 *
 * WHAT THE DOCUMENT SAYS, AND WHY NONE OF THE TWELVE EXISTING WORDS IS TRUE.
 *
 * Appendix C of 254-RC-001, REPAIRS REQUIRED: "Certification withheld and a
 * repair list issued. Certification proceeds only after repairs are verified on
 * revisit."
 *
 *   under_review          false. The engineer has decided. He decided this.
 *   revisions_requested   false. Nothing is wrong with the evidence, and this
 *                         would send it back to a technician who has nothing to
 *                         do. The revision_count would climb for a package that
 *                         was never deficient.
 *   needs_dispatch        false, and it is the most tempting. The revisit is
 *                         real and it is not due yet: it happens after the OWNER
 *                         has had work done, which may be four months. A file
 *                         sitting in the dispatch queue for four months is a
 *                         queue that stops being a queue.
 *   refused               false, and it is the most damaging. Certification is
 *                         WITHHELD, not declined. A refusal goes to the client
 *                         as an engineer who would not certify, and this is an
 *                         engineer who will, once the roof is fixed.
 *   sealed / delivered    absurd.
 *   closed / cancelled    false, and the operator's sentence is the ruling:
 *                         "a homeowner who takes four months to afford a roof
 *                         repair has not abandoned anything, and a firm that
 *                         closes his file is the one who failed."
 *
 * So: `repairs_required`. The file is not in review, not sealed, not declined,
 * and not abandoned. It is waiting on somebody outside the firm.
 *
 * ========================================================================
 * THERE IS NO CONDITIONAL CERTIFICATION, AND THAT IS MADE UNREPRESENTABLE
 * RATHER THAN CHECKED. Operator ruling, same day.
 * ========================================================================
 *
 * The protocol does not permit a seal that is good "once the flashing is done".
 * A check somewhere in the application that asks whether the repairs are closed
 * is a check somebody can route around, forget on a second path, or disable in
 * a hurry, and the whole point of this platform is that the seal is the one act
 * that cannot be reached by accident.
 *
 * So the constraint is on the DATABASE and it is stated as an impossibility: a
 * file cannot BE sealed while any item on its repair list is open. Not "should
 * not", not "is refused by the review path". Cannot.
 *
 * The repair list is its own table rather than a text column, for the reason
 * the operator gave: "every item on that list individually closed". A free text
 * list cannot be partially closed, so a free text list forces the judgement
 * back into somebody's head, which is the thing being removed.
 */

/* ---------------------------------------------------------- 1. the word */

alter table eng_files drop constraint if exists eng_files_status_check;
alter table eng_files add constraint eng_files_status_check check (status in (
  'intake', 'needs_dispatch', 'dispatched', 'evidence_in_progress',
  'evidence_submitted', 'under_review', 'revisions_requested',
  'repairs_required',
  'refused', 'sealed', 'delivered', 'closed', 'cancelled'));

/*
 * WHEN THE FIRM STOPPED WAITING ON ITS OWN WORK AND STARTED WAITING ON SOMEBODY
 * ELSE'S. Recorded as its own column rather than inferred from the timeline,
 * because it is the figure that answers "how long has this person been sitting
 * with a repair list", and deriving that from an event log every time is both
 * slow and a second place for the answer to live.
 */
alter table eng_files add column if not exists repairs_required_at timestamptz;

comment on column eng_files.repairs_required_at is
  'When certification was withheld pending repairs. The file is waiting on the property owner from this moment, not on the firm. It does not age out: a homeowner who takes four months to afford a repair has not abandoned anything.';

/* -------------------------------------------- 2. the repair list, as rows */

/*
 * ONE ROW PER ITEM THE ENGINEER REQUIRES, AND EACH CLOSES ON ITS OWN.
 *
 * `closed_at` and `closed_by` are null until somebody verifies THAT ITEM on the
 * revisit. Appendix C's SITE REVISIT criterion says it outright: "Repairs
 * required, return after repairs to verify each item on the repair list."
 * Each item. Not the list.
 *
 * `verified_by_evidence_id` is nullable and it is the honest kind of nullable:
 * an item closed against a photograph from the revisit points at it, and an
 * item closed on a receipt or an invoice the owner supplied does not have one
 * yet, because this platform has nowhere to put that document today. Rather
 * than pretend, the column says what it knows and `closed_note` carries the
 * rest. The gap is named in BACKLOG.md rather than papered over with a
 * placeholder id.
 */
create table if not exists eng_repair_items (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  file_id       uuid not null references eng_files(id) on delete restrict,
  /* Which determination issued this list. A repair item with no determination
   * behind it is a requirement nobody is accountable for. */
  determination_id uuid not null references eng_determinations(id) on delete restrict,
  sort_order    integer not null default 0,
  /* What must be repaired, in the engineer's own words. */
  requirement   text not null,
  /* The Appendix B item it arises from, where it arises from one. */
  item_key      text,
  raised_by     uuid not null references eng_profiles(id) on delete restrict,
  closed_at     timestamptz,
  closed_by     uuid references eng_profiles(id) on delete restrict,
  closed_note   text,
  verified_by_evidence_id uuid references eng_evidence_items(id) on delete set null
);

/*
 * A requirement of whitespace is a requirement of nothing, the same rule 0051
 * put on an exception's reason and for the same reason: a rule that can be
 * satisfied with the space bar is a rule that will be.
 */
alter table eng_repair_items drop constraint if exists eng_repair_items_requirement_is_real_ck;
alter table eng_repair_items add constraint eng_repair_items_requirement_is_real_ck
  check (length(btrim(requirement)) >= 3);

/*
 * CLOSING IS THREE FACTS OR NONE. An item with a closing time and no closer is
 * an item nobody is accountable for having verified, which is precisely the
 * signature this table exists to prevent.
 */
alter table eng_repair_items drop constraint if exists eng_repair_items_closed_together_ck;
alter table eng_repair_items add constraint eng_repair_items_closed_together_ck
  check (
    (closed_at is null and closed_by is null)
    or (closed_at is not null and closed_by is not null)
  );

create index if not exists eng_repair_items_file_idx on eng_repair_items (file_id, sort_order);
create index if not exists eng_repair_items_open_idx on eng_repair_items (file_id) where closed_at is null;

alter table eng_repair_items enable row level security;

/*
 * A repair item is part of the regulatory record of why certification was
 * withheld, so it is never deleted. It may be CLOSED, which is an update to the
 * three closing columns and nothing else, so the general append only function
 * is the wrong tool here and a narrow freeze is the right one, exactly as 0019
 * reasoned about a partner ledger entry that a statement close has to be able
 * to write.
 */
create or replace function eng_freeze_repair_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old;
    end if;
    raise exception
      'eng: a repair item is the record of why certification was withheld. It is closed, never removed.';
  end if;

  if new.file_id is distinct from old.file_id
     or new.determination_id is distinct from old.determination_id
     or new.requirement is distinct from old.requirement
     or new.item_key is distinct from old.item_key
     or new.raised_by is distinct from old.raised_by
     or new.created_at is distinct from old.created_at then
    raise exception
      'eng: what an engineer required cannot be rewritten. Only the closing of an item may be recorded.';
  end if;

  /*
   * AND A CLOSED ITEM DOES NOT REOPEN. Reopening one would mean a file could
   * pass the seal guard below, then have an item reopened underneath a sealed
   * letter. If a repair was wrongly verified, that is a new determination on a
   * new review rather than an edit to this row.
   */
  if old.closed_at is not null and new.closed_at is null then
    raise exception
      'eng: a closed repair item does not reopen. A repair wrongly verified is a new determination, not an edit.';
  end if;

  return new;
end;
$$;

drop trigger if exists eng_repair_items_frozen on eng_repair_items;
create trigger eng_repair_items_frozen
  before update or delete on eng_repair_items
  for each row execute function eng_freeze_repair_item();

/* ------------------- 3. there is no conditional certification */

/*
 * THE IMPOSSIBILITY.
 *
 * A file cannot hold the status `sealed`, or carry a `sealed_at`, while any
 * repair item against it is open. Checked on the FILE rather than on the review
 * path, so it holds for every route that exists today and every route somebody
 * writes next year.
 *
 * DEFERRED, and re-reading the row, for the same reasons 0052's item guard is:
 * a transaction may close the last repair item and seal in either order, and a
 * file sealed and then moved on within one transaction must be judged where it
 * lands rather than at the moment of an intermediate UPDATE.
 *
 * IT FIRES FROM BOTH SIDES. Sealing a file with an open item is the obvious
 * direction. The other is the one a check written only on the review path would
 * miss entirely: INSERTING a repair item against a file that is already sealed.
 * Nothing in the workflow does that today, which is exactly why it is worth
 * making impossible now rather than after somebody writes the path that would.
 */
/*
 * THE RULE ITSELF TAKES A FILE ID AND NOTHING ELSE, and the two triggers are
 * three lines each that hand it theirs.
 *
 * WRITTEN THIS WAY AFTER THE OBVIOUS SHAPE FAILED. One trigger function reading
 * `case tg_table_name when 'eng_files' then new.id else new.file_id end` was
 * refused by plpgsql before a single row was touched: the expression forces the
 * type of BOTH record fields to be resolved when the statement is planned, and
 * `eng_files` has no `file_id`. The replay caught it on a plain INSERT into
 * eng_files, which is the argument for replaying the chain rather than reading
 * the SQL and believing it.
 *
 * The split is better than the fix would have been. Neither trigger function
 * touches a column its own table does not have, so there is nothing to resolve
 * and nothing to get subtly wrong later.
 */
create or replace function eng_assert_no_open_repairs(p_file uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_sealed timestamptz;
  v_open   integer;
begin
  select status, sealed_at into v_status, v_sealed from eng_files where id = p_file;
  if not found then
    return;
  end if;
  if v_status <> 'sealed' and v_sealed is null then
    return;
  end if;

  select count(*) into v_open from eng_repair_items
   where file_id = p_file and closed_at is null;

  if v_open > 0 then
    raise exception
      'eng: file % carries % open repair item(s) and cannot be sealed. 254-RC-001 has no conditional certification: certification proceeds only after repairs are verified, each item on its own.',
      p_file, v_open;
  end if;
end;
$$;

create or replace function eng_file_no_conditional_certification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform eng_assert_no_open_repairs(new.id);
  return null;
end;
$$;

create or replace function eng_repair_no_conditional_certification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform eng_assert_no_open_repairs(new.file_id);
  return null;
end;
$$;

drop trigger if exists eng_files_no_conditional_certification on eng_files;
create constraint trigger eng_files_no_conditional_certification
  after insert or update on eng_files
  deferrable initially deferred
  for each row execute function eng_file_no_conditional_certification();

drop trigger if exists eng_repair_items_no_conditional_certification on eng_repair_items;
create constraint trigger eng_repair_items_no_conditional_certification
  after insert or update on eng_repair_items
  deferrable initially deferred
  for each row execute function eng_repair_no_conditional_certification();

comment on table eng_repair_items is
  'The repair list issued when certification is withheld. One row per requirement, each closed individually on the revisit, because 254-RC-001 Appendix C says certification proceeds only after repairs are verified item by item. A file cannot be sealed while any row here is open, and that is a constraint rather than a rule anybody applies.';

comment on function eng_assert_no_open_repairs(uuid) is
  'There is no conditional certification. Enforced on the file rather than on the review path, so it holds for routes that do not exist yet, and fired from the repair item side too so a list cannot be added to an already sealed file.';
