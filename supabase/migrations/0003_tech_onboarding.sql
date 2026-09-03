-- ===========================================================================
-- 0003: the applicant to dispatchable path.
--
-- The onboarding system already existed and predates the portal: invite tokens
-- that are never stored in plaintext, a per hire checklist copied into rows, a
-- private bucket, and an operator verification step. None of it was joined to
-- dispatch. This migration is that join, plus the one thing the certification
-- gate was missing, which was a door.
-- ===========================================================================

-- 1. Expiry, captured where somebody is looking at the card.
--
-- eng_credentials has carried expires_on since 0001 and nothing wrote it, so the
-- roster's "expiring within 45 days" panel could not fire. The date has to be
-- collected at upload, by the person holding the document or the operator
-- verifying it, because there is no OCR in this system and there will not be:
-- the standing rule is that the firm needs the document, not the data off it,
-- and an expiry date a machine read off a phone photograph is a date nobody
-- checked.
alter table eng_onboarding_items add column if not exists issued_on date;
alter table eng_onboarding_items add column if not exists expires_on date;

comment on column eng_onboarding_items.expires_on is
  'Typed by the person uploading or the operator verifying. Never extracted from the document. Copied into eng_credentials at activation.';

-- 2. Which onboarding produced which account.
--
-- Without this an activated technician is a profile with no history, and the
-- question "what did this person actually give us" has no answer that survives
-- the operator who remembers.
alter table eng_profiles add column if not exists onboarding_id uuid
  references eng_onboardings(id) on delete set null;
create index if not exists eng_profiles_onboarding_idx on eng_profiles (onboarding_id);

-- 3. Which application became which onboarding.
--
-- Same reasoning, one step earlier. The application row is never deleted and
-- never edited beyond its status: it is the origin record and it carries the
-- attribution the three public sites captured.
alter table eng_onboardings add column if not exists application_id uuid
  references eng_applications(id) on delete set null;
alter table eng_onboardings add column if not exists activated_at timestamptz;
alter table eng_onboardings add column if not exists profile_id uuid
  references eng_profiles(id) on delete set null;

-- Coverage and base, gathered during onboarding rather than typed again later.
-- A technician activated with no coverage counties is invisible to every
-- dispatch query and sits in the roster looking available, so the intent is
-- captured here and the readiness check refuses activation without it.
alter table eng_onboardings add column if not exists coverage_counties text[] not null default '{}';
alter table eng_onboardings add column if not exists base_city text;
alter table eng_onboardings add column if not exists base_county text;

-- 4. The certification check, written by the engineer who wrote the protocol.
--
-- Questions hang off the protocol VERSION, not the service line, so a protocol
-- that changes takes its check with it and a technician certified on version one
-- is certified on version one.
--
-- correct_index and rationale are in this table and are never sent to a
-- technician. The route that serves a check strips them, ops-certification
-- grades on the server, and onboarding-audit asserts the served payload by
-- serializing it and searching for the key. A check whose answers are in the
-- page source is a formality, and a formality that writes a certification record
-- is worse than no record at all.
create table if not exists eng_protocol_questions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  template_id   uuid not null references eng_protocol_templates(id) on delete cascade,
  sort_order    integer not null default 0,
  prompt        text not null,
  options       text[] not null,
  correct_index integer not null,
  rationale     text not null,
  constraint eng_protocol_questions_options_ck check (array_length(options, 1) between 2 and 6),
  constraint eng_protocol_questions_index_ck
    check (correct_index >= 0 and correct_index < array_length(options, 1))
);
create index if not exists eng_protocol_questions_template_idx
  on eng_protocol_questions (template_id, sort_order);

alter table eng_protocol_questions enable row level security;

comment on table eng_protocol_questions is
  'Protocol comprehension check. correct_index and rationale are service role only and are never serialized to a technician before an answer is graded.';

-- 5. Every attempt, kept.
--
-- eng_certifications carries the outcome and an attempt count. It does not carry
-- what was answered, and it should: an engineer asking why a technician keeps
-- missing the deck attachment question needs the attempts, and a certification
-- record with no working behind it is a claim rather than evidence.
--
-- Append only, by the same trigger the audit trail uses. An attempt that could
-- be edited after the fact is not a record of what happened.
create table if not exists eng_certification_attempts (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  profile_id     uuid not null references eng_profiles(id) on delete cascade,
  template_id    uuid not null references eng_protocol_templates(id) on delete cascade,
  service_slug   text not null,
  score          integer not null,
  passed         boolean not null,
  answers        jsonb not null,
  wrong_question_ids text[] not null default '{}'
);
create index if not exists eng_cert_attempts_profile_idx
  on eng_certification_attempts (profile_id, created_at desc);

alter table eng_certification_attempts enable row level security;

drop trigger if exists eng_cert_attempts_immutable on eng_certification_attempts;
create trigger eng_cert_attempts_immutable
  before update or delete on eng_certification_attempts
  for each row execute function eng_forbid_mutation_allow_cascade();

comment on table eng_certification_attempts is
  'Append only. Every attempt at a protocol check, so a certification is evidence rather than a claim.';

-- 6. Who certified, and against which version.
--
-- eng_certifications.template_id existed and nothing set it. It is what makes a
-- certification checkable against the protocol version in force, which is how
-- ops-certification decides staleness.
create index if not exists eng_certifications_service_idx
  on eng_certifications (service_slug, status);
