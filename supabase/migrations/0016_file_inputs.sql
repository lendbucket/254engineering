-- ===========================================================================
-- 0016: what a job was asked, kept on the file
--
-- Phase 10 Section 1.5 Section C. One definition of a complete job, in
-- data/intake-fields.ts, rendered by every intake surface. This is where the
-- answers land.
-- ===========================================================================

-- ------------------------------------------------------------- file inputs
--
-- WHY THIS IS NOT eng_order_inputs
-- --------------------------------
-- Recorded here because a later session will read two tables of the same shape
-- as duplication and try to merge them, exactly as the partner statements note
-- in 0013 anticipated for that pair.
--
-- eng_order_inputs is keyed on `order_id not null`. It is the record of what a
-- CUSTOMER was asked at checkout and what they answered, and it is transaction
-- evidence: the firm's proof that it put the qualifying question before taking
-- the money. It is written once, at checkout, and never again.
--
-- A job taken over the telephone has no order at all until somebody pays, and
-- may never have one if it is invoiced or released unpaid. Hanging its answers
-- off an order would mean either a nullable subject on a table whose entire
-- point is naming one, or no answers until money moved.
--
-- So this is keyed on the FILE, which both paths always produce, and it is the
-- job's working record rather than a transaction receipt: answers arrive over
-- time, get corrected, and are chased when they are missing. That is a
-- different lifecycle from evidence, and evidence that can be edited is not
-- evidence, which is why the two are not one table.
create table if not exists eng_file_inputs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  file_id       uuid not null references eng_files (id) on delete cascade,

  /*
   * The field id from data/intake-fields.ts. Not a foreign key, because the
   * definition is code rather than a table: a field removed from the catalog
   * should leave its answers readable on the files that already carry them,
   * not cascade them away.
   */
  field_id      text not null,

  value_text    text,

  /*
   * Who supplied it and when, because "the customer said the gate code is 4821"
   * and "somebody at the firm wrote 4821 down" are different claims and the
   * second one is the one that gets argued about.
   */
  source        text not null default 'customer'
                  check (source in ('customer', 'firm', 'partner')),
  recorded_by   uuid references eng_profiles (id) on delete set null,

  unique (file_id, field_id)
);

create index if not exists eng_file_inputs_file_idx on eng_file_inputs (file_id);

alter table eng_file_inputs enable row level security;

drop trigger if exists eng_file_inputs_touch on eng_file_inputs;
create trigger eng_file_inputs_touch before update on eng_file_inputs
  for each row execute function eng_touch_updated_at();

comment on table eng_file_inputs is
  'What a job was asked and what came back, keyed on the file because a telephoned job has no order until somebody pays. Separate from eng_order_inputs, which is checkout evidence: see the block comment in 0016.';
comment on column eng_file_inputs.field_id is
  'The field id from data/intake-fields.ts. Deliberately not a foreign key, so removing a field from the definition leaves existing answers readable rather than cascading them away.';
comment on column eng_file_inputs.source is
  'Who supplied it. "The customer said the gate code is 4821" and "somebody at the firm wrote 4821 down" are different claims, and the second is the one that gets argued about.';
