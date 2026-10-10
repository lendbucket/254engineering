/*
 * ===========================================================================
 * 0072: A PARTNER'S LOGO, UPLOADED BY THE PARTNER AND APPROVED BEFORE IT SHOWS.
 * Run item 19 of 2026-10-10 (partner onboarding, the branding upload).
 * ===========================================================================
 *
 * A reseller sells under their own brand, so their logo belongs on their own
 * order page beside the firm's name. A logo is a representation made on a page
 * that also names a registered engineering firm, so it does not show on the
 * strength of an upload alone: the operator approves it, as the asset library's
 * copy is approved, and only an approved logo is ever served.
 *
 * FOUR STATES, AND EACH CAN HOLD ONLY WHAT IS TRUE OF IT. `none` holds no file;
 * `pending` holds a file and no decision; `approved` and `refused` hold the file
 * and who decided and when. The checks below make every other combination
 * impossible, so no screen has to guess what a half-filled row means.
 *
 * A NEW LOGO REPLACES THE OLD ONE AND GOES BACK TO PENDING. The previous
 * decision is in the audit trail, which is append only; this row describes the
 * logo in force.
 *
 * THE BUCKET IS PRIVATE AND TAKES RASTER IMAGES ONLY. No SVG: an SVG is a
 * document that can carry script, and this one would be served on a public page.
 * One megabyte is plenty for a logo.
 *
 * Additive: five columns and their constraints on eng_partners, and a bucket.
 */
alter table eng_partners add column if not exists brand_logo_key text;
alter table eng_partners add column if not exists brand_logo_status text not null default 'none';
alter table eng_partners add column if not exists brand_logo_uploaded_at timestamptz;
alter table eng_partners add column if not exists brand_logo_decided_by uuid references eng_profiles(id) on delete set null;
alter table eng_partners add column if not exists brand_logo_decided_at timestamptz;

alter table eng_partners drop constraint if exists eng_partners_brand_logo_status_known;
alter table eng_partners add constraint eng_partners_brand_logo_status_known
  check (brand_logo_status in ('none', 'pending', 'approved', 'refused'));

alter table eng_partners drop constraint if exists eng_partners_brand_logo_file_agrees;
alter table eng_partners add constraint eng_partners_brand_logo_file_agrees
  check ((brand_logo_status = 'none') = (brand_logo_key is null and brand_logo_uploaded_at is null));

alter table eng_partners drop constraint if exists eng_partners_brand_logo_decision_agrees;
alter table eng_partners add constraint eng_partners_brand_logo_decision_agrees
  check ((brand_logo_status in ('approved', 'refused')) = (brand_logo_decided_at is not null));

comment on column eng_partners.brand_logo_status is
  'none, pending (uploaded, not yet decided), approved (shown on the partner''s order page), refused. Only an approved logo is ever served. 0072.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-partner-branding', 'eng-partner-branding', false, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
