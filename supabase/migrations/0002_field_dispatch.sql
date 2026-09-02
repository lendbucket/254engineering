-- ===========================================================================
-- 0002: what Phase 2 needed that Phase 0 did not already build.
--
-- Almost nothing, which was the point of designing the whole model up front.
-- eng_protocol_templates, eng_protocol_items, eng_assignments,
-- eng_evidence_items and eng_tech_pay_ledger all shipped in 0001 and are used
-- here unchanged. What follows is the four things that turned out to be
-- missing once the surfaces were built against them.
-- ===========================================================================

-- 1. A technician's base, as coordinates.
--
-- planDispatch ranks by load and then by distance, and distance needs two
-- points. eng_files already carries latitude and longitude; eng_profiles
-- carried base_city and base_county, which are the right thing to show a person
-- and useless for arithmetic.
--
-- Both are nullable and nothing populates them automatically. There is no
-- geocoder in this stack, and the county geometry in this repo is projected
-- screen coordinates rather than latitude and longitude, so it cannot be used
-- to derive these. An administrator enters them once per technician on the
-- roster. Until they are entered, dispatch ranks by load and then by name, and
-- says on screen that it is doing so rather than implying a proximity it did
-- not measure.
alter table eng_profiles add column if not exists base_lat numeric(9,6);
alter table eng_profiles add column if not exists base_lng numeric(9,6);

-- 2. The protocol a file is being worked to.
--
-- The column existed in 0001 as a bare uuid, before eng_protocol_templates was
-- declared later in the same file. Now that both exist the reference can be
-- real, so a template cannot be deleted out from under a file in flight.
-- Restrict rather than cascade or set null: a file mid capture whose protocol
-- silently vanished would show an empty checklist and a submit button that
-- refuses to explain itself.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eng_files_protocol_template_fk'
  ) then
    alter table eng_files
      add constraint eng_files_protocol_template_fk
      foreign key (protocol_template_id) references eng_protocol_templates(id) on delete restrict;
  end if;
end $$;

-- 3. Only one accepted assignment per file.
--
-- First acceptance wins is enforced in ops-field.ts by a conditional update,
-- and this is the layer under it. Two requests arriving in the same millisecond
-- both read "not yet assigned"; the second insert is what has to lose, and a
-- partial unique index is what makes the database rather than the ordering of
-- two network calls decide it.
create unique index if not exists eng_assignments_one_accepted
  on eng_assignments (file_id) where state = 'accepted';

-- 4. One pay ledger row per technician per file.
--
-- The submission endpoint writes a pending ledger row. A retried submit, a
-- double tap on a phone, or a queued request replayed on reconnect must not pay
-- somebody twice for one visit.
create unique index if not exists eng_tech_pay_job_once
  on eng_tech_pay_ledger (file_id, tech_id) where kind = 'job' and file_id is not null;

comment on column eng_profiles.base_lat is 'Entered by an administrator on the roster. Nothing geocodes it. Null means dispatch ranks this technician by load and name only.';
comment on index eng_assignments_one_accepted is 'First acceptance wins, decided by the database rather than by request ordering.';

-- 5. The evidence bucket, private.
--
-- Photographs go from the phone straight to storage through a signed upload
-- URL, the same shape as the careers uploads and for the same reason: a ten
-- megabyte body through a serverless function on one bar of signal is the
-- upload that fails. The bucket carries its own size limit and mime list,
-- because a check that lives only in application code is a check somebody can
-- skip by reusing a signed URL for a different file.
--
-- 15MB rather than the careers bucket's 10, because a modern phone camera at
-- full resolution clears 10 on a bright roof and a technician cannot be asked
-- to change a camera setting on a ladder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-evidence', 'eng-evidence', false, 15728640,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
