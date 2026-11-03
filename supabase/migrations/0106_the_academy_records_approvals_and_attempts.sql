/*
 * 0106: THE TECHNICIAN TRAINING ACADEMY RECORDS WHO APPROVED EACH COURSE AND
 * EVERY QUIZ ATTEMPT. Robert's ruling P3 of 2026-11-01 (finish the portal):
 * "Build the engine: courses, lessons, a quiz per lesson, pass mark, attempts
 * recorded, each course versioned to the protocol version it teaches, and
 * graduation from both required courses before a field_tech enrollment can be
 * created ... nothing can be graduated against a draft."
 *
 * WHAT LIVES WHERE. A course's text, its lessons, its quizzes, its pass mark
 * and the protocol version each lesson teaches are code, in
 * src/content/academy/courses.ts, drawn from the signed protocol transcriptions
 * in src/content/protocols. The SHA-256 of that content is computed in code. The
 * database holds the two facts code cannot: that somebody with the authority to
 * approve a course approved exactly that content, and what each person answered.
 *
 * 1. eng_academy_course_approvals: one row per approval of one course version
 *    with one content hash. The protocol course is approved by the engineer of
 *    record, the safety course by the owner. A course whose code no longer
 *    hashes to an approved row is a draft again, which is the version binding:
 *    a lesson teaching a protocol version that changed changes the hash.
 *    Append only. Who approved is a pointer, not a reference, as
 *    eng_audit_events.actor_id is (0001), so an approval outlives anything.
 *
 * 2. eng_academy_attempts: every quiz attempt, with the answers given, the
 *    count correct, the pass mark in force and whether it passed. AN ATTEMPT
 *    REFERENCES THE APPROVAL IT WAS TAKEN AGAINST, NOT NULL, so no attempt can
 *    exist against a draft, and approving a draft later cannot turn earlier
 *    answers into a graduation. Whether it passed is checked arithmetic, not a
 *    flag the application sets. It belongs to the onboarding it was taken under
 *    (on delete cascade) and is append only otherwise, the 0084 shape, so a
 *    probe onboarding can be swept and a real attempt can never be edited.
 *
 * Graduation is DERIVED from these two tables and the code, never stored, so
 * it has one home.
 *
 * RLS on both tables with no policies, as every eng_ table. Revoked from
 * public, anon and authenticated in this file. ADDITIVE ONLY: two tables, two
 * indexes, two triggers on existing functions. No drop.
 */

create table if not exists eng_academy_course_approvals (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  course_slug     text not null check (course_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  course_version  integer not null check (course_version >= 1),
  content_sha256  text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  approver_kind   text not null check (approver_kind in ('engineer_of_record', 'owner')),
  approved_by     uuid not null,
  constraint eng_academy_course_approvals_once unique (course_slug, course_version, content_sha256)
);
alter table eng_academy_course_approvals enable row level security;

comment on table eng_academy_course_approvals is
  'Who approved exactly which content of a training course: the engineer of record for the protocol course, the owner for the safety course. A course whose content no longer hashes to a row here is a draft. Append only. 0106, Robert''s ruling P3 of 2026-11-01.';

create trigger eng_academy_course_approvals_append_only
  before update or delete on eng_academy_course_approvals
  for each row execute function eng_forbid_mutation();

create table if not exists eng_academy_attempts (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  onboarding_id      uuid not null references eng_onboardings (id) on delete cascade,
  approval_id        uuid not null references eng_academy_course_approvals (id) on delete restrict,
  lesson_key         text not null check (btrim(lesson_key) <> ''),
  answers            jsonb not null check (jsonb_typeof(answers) = 'array'),
  correct            integer not null,
  questions          integer not null check (questions >= 1),
  pass_mark_percent  integer not null check (pass_mark_percent between 1 and 100),
  passed             boolean not null,
  constraint eng_academy_attempts_correct_range check (correct between 0 and questions),
  constraint eng_academy_attempts_answers_count check (jsonb_array_length(answers) = questions),
  constraint eng_academy_attempts_passed_is_arithmetic check (passed = (correct * 100 >= pass_mark_percent * questions))
);
alter table eng_academy_attempts enable row level security;
create index if not exists eng_academy_attempts_onboarding_idx on eng_academy_attempts (onboarding_id, approval_id, lesson_key);

comment on table eng_academy_attempts is
  'Every quiz attempt in the technician training academy, against the approval of the exact course content it was taken on. Append only; removed only with its onboarding. 0106, Robert''s ruling P3 of 2026-11-01.';

create trigger eng_academy_attempts_append_only
  before update or delete on eng_academy_attempts
  for each row execute function eng_forbid_mutation_allow_cascade();

revoke all on eng_academy_course_approvals from public, anon, authenticated;
revoke all on eng_academy_attempts from public, anon, authenticated;
