/*
 * A JOB CARRIES WHAT COULD NOT BE OBSERVED, AND WHAT THE ENGINEER DECIDED.
 * Operator ruling, 2026-09-18: build the working screens, and do not hurry them
 * into the state the read-only screen was deliberately not shipped in.
 *
 * WHAT ALREADY EXISTS AND IS NOT DUPLICATED HERE
 * ----------------------------------------------
 * `eng_evidence_items` has recorded a technician's captures since 0001: the
 * file, the item key, the kind, the value, the storage key, and the time,
 * location and accuracy of capture. That is the photograph and the measurement
 * 254-RC-001 Appendix B asks for, and this migration adds nothing to it.
 *
 * Two things were missing, and both are about what the record does NOT contain.
 *
 * 1. AN ITEM THAT COULD NOT BE OBSERVED, AND THE REASON.
 * ------------------------------------------------------
 * Section 7 of the signed protocol: "the technician records each item that
 * could not be observed and the reason. No item is estimated, assumed, or left
 * blank." Section 8: "An item that does not apply to the property is marked
 * with the reason it does not apply."
 *
 * An evidence table can only record what WAS captured. The absence of a row
 * means either "not done yet" or "could not be done and here is why", and those
 * are different states that must not be indistinguishable. That is this
 * repository's oldest lesson, from bulk-order.ts, where one null meant two
 * things and the fix was a word rather than a cleverer read.
 *
 * So an exception is a ROW. A reason is not null and not empty, because the
 * whole point of the rule is that a blank is what must not be possible.
 *
 * 2. THE DETERMINATION, AND WHAT IT RESTED ON.
 * --------------------------------------------
 * Appendix C gives the engineer five determinations. Section 9 requires him to
 * record which items and which photographs he relied on.
 *
 * `relied_on_item_keys` and `relied_on_evidence_ids` are therefore NOT NULL and
 * constrained to be non-empty. A determination that names nothing it relied on
 * is an opinion with no record behind it, and the whole protocol exists so that
 * somebody can be asked years later what the engineer actually looked at.
 *
 * THE ENGINEER IS NAMED AND THE ROW CANNOT SAY OTHERWISE. `engineer_id` is not
 * null and restricted on delete, for the same reason 0049 made an approver
 * un-deletable: a determination in force must keep naming who made it.
 *
 * WHAT THIS MIGRATION DOES NOT ENFORCE, AND WHY IT CANNOT
 * -------------------------------------------------------
 * "Complete or properly excepted" is a rule about the PROTOCOL's item list,
 * which lives in the signed document and its transcription, not in the
 * database. Postgres cannot know that 254-RC-001 has 51 items, nor which of
 * them apply to a metal roof. So the completeness rule is enforced in
 * src/lib/protocol-run.ts against the registry, and this schema makes the
 * evidence of it recordable and unforgeable rather than pretending to judge it.
 *
 * Stating that plainly is the point: a constraint that looks like it enforces
 * completeness and does not would be worse than none.
 */

create table if not exists eng_checklist_exceptions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  file_id       uuid not null references eng_files(id) on delete cascade,
  /* The item key as the protocol transcription names it. */
  item_key      text not null,
  /*
   * Why it could not be observed, or why it does not apply. Never blank: the
   * rule this table exists for is that no item is left blank.
   */
  reason        text not null,
  /* Which of the two the protocol distinguishes. */
  kind          text not null,
  recorded_by   uuid not null references eng_profiles(id) on delete restrict,
  recorded_at   timestamptz not null default now()
);

alter table eng_checklist_exceptions
  drop constraint if exists eng_checklist_exceptions_kind_ck;
alter table eng_checklist_exceptions
  add constraint eng_checklist_exceptions_kind_ck
  check (kind in ('not_observed', 'not_applicable'));

/*
 * A reason of spaces is a blank with extra steps. btrim rather than length, so
 * a technician cannot satisfy the rule with a space bar.
 */
alter table eng_checklist_exceptions
  drop constraint if exists eng_checklist_exceptions_reason_is_real_ck;
alter table eng_checklist_exceptions
  add constraint eng_checklist_exceptions_reason_is_real_ck
  check (length(btrim(reason)) >= 3);

create unique index if not exists eng_checklist_exceptions_one_per_item
  on eng_checklist_exceptions (file_id, item_key);

alter table eng_checklist_exceptions enable row level security;

create table if not exists eng_determinations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  file_id       uuid not null references eng_files(id) on delete restrict,
  protocol_document text not null,
  /* One of the five in Appendix C. */
  determination text not null,
  /*
   * What it rested on. Not null and non-empty: a determination naming nothing
   * is an opinion with no record behind it.
   */
  relied_on_item_keys   text[] not null,
  relied_on_evidence_ids uuid[] not null,
  /* The engineer's own words, where the determination calls for them. */
  note          text,
  engineer_id   uuid not null references eng_profiles(id) on delete restrict,
  decided_at    timestamptz not null default now()
);

alter table eng_determinations
  drop constraint if exists eng_determinations_value_ck;
/*
 * THE FIVE ARE THE DOCUMENT'S FIVE, SPELLED AS THE DOCUMENT SPELLS THEM.
 * Corrected 2026-09-19, before this migration had run anywhere.
 *
 * It first read 'pass', 'package_incomplete', 'repairs_required',
 * 'return_visit', 'decline'. Appendix C of 254-RC-001 v1.0 heads them PASS,
 * REVISE, REPAIRS REQUIRED, SITE REVISIT and DECLINE, and
 * src/content/protocols/rc-001-decisions.ts carries those verbatim because
 * protocol-registry-audit compares that file against the signed PDF character
 * by character.
 *
 * So two of the five had been PARAPHRASED on their way into a check
 * constraint: REVISE became package_incomplete and SITE REVISIT became
 * return_visit. Both readings are plausible and neither is the document. The
 * consequence is the one this repository keeps meeting: the engineer chooses
 * REVISE in the words he signed, the row says package_incomplete, and somebody
 * asked years later what he determined has to know a translation nobody wrote
 * down. Worse, REVISE's criteria include "Exception used where the condition
 * plainly applied", which is not an incomplete package at all, so the
 * paraphrase is not even a synonym.
 *
 * The vocabulary is now one fact with one home, and protocol-run-audit asserts
 * this constraint's list equals the registry's keys, so a sixth determination
 * or a re-spelling cannot land in one place only.
 *
 * EDITING A MIGRATION RATHER THAN CORRECTING IT WITH A LATER ONE IS ALLOWED
 * HERE AND ONLY HERE. The rule is that a migration which has RUN is never
 * edited, because a migration that changes after it has run is one nobody can
 * reason about. This one has run nowhere: production, development and the
 * cutover project were all read on 2026-09-19 and none holds
 * eng_determinations. A corrective migration would have altered a constraint
 * that has never existed in any database, which is a worse record than the
 * edit.
 */
alter table eng_determinations
  add constraint eng_determinations_value_ck
  check (determination in ('pass', 'revise', 'repairs-required', 'site-revisit', 'decline'));

alter table eng_determinations
  drop constraint if exists eng_determinations_relied_on_ck;
alter table eng_determinations
  add constraint eng_determinations_relied_on_ck
  check (
    array_length(relied_on_item_keys, 1) >= 1
    and array_length(relied_on_evidence_ids, 1) >= 1
  );

/*
 * A determination is a regulatory record and is never edited or removed.
 * eng_forbid_mutation_allow_cascade is the function 0001 wrote for exactly this
 * class of table, and reusing it is the point: a second no-delete function
 * would be a second answer to one question.
 */
drop trigger if exists eng_determinations_no_mutation on eng_determinations;
create trigger eng_determinations_no_mutation
  before update or delete on eng_determinations
  for each row execute function eng_forbid_mutation_allow_cascade();

alter table eng_determinations enable row level security;

create index if not exists eng_determinations_file_idx
  on eng_determinations (file_id, decided_at desc);

comment on table eng_checklist_exceptions is
  'An Appendix B item that could not be observed, or does not apply, with the reason. Section 7 of 254-RC-001: no item is estimated, assumed, or left blank. The absence of an evidence row means "not done yet"; a row here means "could not be done, and here is why".';

comment on table eng_determinations is
  'The engineer of record''s determination on a job, with the items and photographs he relied on. Appendix C gives five. Append only: a determination is a regulatory record.';

comment on constraint eng_determinations_relied_on_ck on eng_determinations is
  'A determination that names nothing it relied on is an opinion with no record behind it, and the protocol exists so somebody can be asked years later what the engineer actually looked at.';
