/*
 * ===========================================================================
 * 0085  A LETTER STATES ONLY FACTS SOMEBODY RECORDED: THE FACTS, THE TRIAGE,
 *       AND THE ENGINEER'S OWN CAPTURE ITEMS.
 * ===========================================================================
 *
 * Operator rulings of 2026-10-23 (ruling 7) on the foundation (254-FC-001) and
 * permit (254-PL-001) letters. Each letter prints facts the platform did not
 * hold; the ruling says who records each and that the recorded value is what
 * prints:
 *
 *   FC-3  the foundation type: asked at intake as a structured field, and the
 *         engineer confirms or corrects it at review. The confirmed value
 *         prints.
 *   PL-2  the authority's address and salutation: the ops manager records
 *         them on the file before review; they print as recorded and the
 *         engineer sees them at review.
 *   PL-3  the element described: asked at intake beside the category, and the
 *         engineer may correct it at review. The reviewed text prints.
 *   PL-4  site job or desk job: the engineer records it per order in the
 *         portal. The letter's basis sentence comes only from that record,
 *         never inferred from evidence.
 *   PL-5  the per job capture list starts as PL-001's items, and he may add
 *         items in his own words at triage.
 *
 * WHAT THIS DOES
 *   1. eng_letter_facts: one row each time a fact is recorded, by whom and in
 *      which capacity; the newest row for a file and a fact is the value.
 *      Which capacity may record which fact is held by a check.
 *   2. eng_job_triage: the engineer's site or desk decision for a file; the
 *      newest row is the decision.
 *   3. eng_job_capture_additions: items he adds to a file's capture list, in
 *      his words.
 *
 * Every table is append only (eng_forbid_mutation_allow_cascade, 0001): a row
 * is never edited and never deleted except with the file it is about, the
 * same rule the file's own timeline keeps. Who recorded is a pointer, not a
 * reference, as eng_audit_events.actor_id is, so no person is pinned. RLS on,
 * no policies. No function, no drop statement.
 */

/* 1. The letter's recorded facts. */
create table if not exists eng_letter_facts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  file_id      uuid not null references eng_files (id) on delete cascade,
  fact         text not null check (fact in ('foundation_type', 'authority_address', 'authority_salutation', 'element_described')),
  value        text not null check (length(btrim(value)) > 0),
  recorded_by  uuid not null,
  capacity     text not null check (capacity in ('office', 'engineer')),
  /*
   * Who records what, from the ruling: the office records the authority's
   * address and salutation; the engineer confirms the foundation type and the
   * element described at review. And the foundation type is one of the three
   * the intake offers.
   */
  constraint eng_letter_facts_capacity_ck check (
    (fact in ('authority_address', 'authority_salutation') and capacity = 'office')
    or (fact in ('foundation_type', 'element_described') and capacity = 'engineer')
  ),
  constraint eng_letter_facts_foundation_type_ck check (
    fact <> 'foundation_type' or value in ('slab-on-grade', 'pier-and-beam', 'crawlspace')
  )
);
alter table eng_letter_facts enable row level security;
create index if not exists eng_letter_facts_file_idx on eng_letter_facts (file_id, fact, created_at desc);
comment on table eng_letter_facts is
  'Facts a sealed letter prints that the platform did not otherwise hold, each recorded by the office or the engineer as the 2026-10-23 rulings say. The newest row for a file and fact is the value. Append only. 0085.';

create trigger eng_letter_facts_append_only
  before update or delete on eng_letter_facts
  for each row execute function eng_forbid_mutation_allow_cascade();

/* 2. Site job or desk job, the engineer's decision. */
create table if not exists eng_job_triage (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  file_id             uuid not null references eng_files (id) on delete cascade,
  basis               text not null check (basis in ('site', 'desk')),
  decided_by          uuid not null,
  decided_by_license  text
);
alter table eng_job_triage enable row level security;
create index if not exists eng_job_triage_file_idx on eng_job_triage (file_id, created_at desc);
comment on table eng_job_triage is
  'The engineer''s site job or desk job decision for a file (ruling PL-4, 2026-10-23). The letter''s basis sentence comes only from the newest row, never from whether evidence exists. Append only. 0085.';

create trigger eng_job_triage_append_only
  before update or delete on eng_job_triage
  for each row execute function eng_forbid_mutation_allow_cascade();

/* 3. The engineer's own capture items for a file. */
create table if not exists eng_job_capture_additions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  file_id     uuid not null references eng_files (id) on delete cascade,
  label       text not null check (length(btrim(label)) >= 3),
  added_by    uuid not null
);
alter table eng_job_capture_additions enable row level security;
create index if not exists eng_job_capture_additions_file_idx on eng_job_capture_additions (file_id, created_at);
comment on table eng_job_capture_additions is
  'Capture items the engineer adds to one file''s list at triage, in his own words, beside the protocol''s items (ruling PL-5, 2026-10-23). Append only. 0085.';

create trigger eng_job_capture_additions_append_only
  before update or delete on eng_job_capture_additions
  for each row execute function eng_forbid_mutation_allow_cascade();
