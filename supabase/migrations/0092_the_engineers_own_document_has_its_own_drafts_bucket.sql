/*
 * ===========================================================================
 * 0092  THE ENGINEER'S OWN DOCUMENT IS UPLOADED TO A BUCKET OF ITS OWN,
 *       BEFORE HE SEALS IT.
 * ===========================================================================
 * Robert's ruling of 2026-10-25, 23:51 Central, item C: the repair
 * specification is the engineer's own document. He uploads his PDF, previews
 * it, and seals it from his own session with a fresh code; the platform adds
 * the seal block, the firm's name and F-29811, hashes the result, records the
 * seal act, and delivers it as it delivers a letter.
 *
 * WHAT THIS DOES. One private bucket, eng-engineer-drafts, for the PDF he
 * uploads before sealing: PDF only, 25 MB, the size eng-documents takes. The
 * draft is read by the preview and by the sealing step, both his alone, and
 * removed once the sealed copy is stored in eng-documents.
 *
 * WHY A NEW BUCKET. eng-documents is the sealed deliverable store (0061), and
 * an unsealed draft does not belong in it: that bucket's reasoning is that a
 * sealed document and anything else have different readers and different
 * consequences if the wrong person opens one. eng-uploads, eng-onboarding,
 * eng-evidence, eng-messages, eng-partner-assets, eng-partner-branding,
 * eng-protocol-sources, eng-insurance and eng-seals each hold something else.
 *
 * IDEMPOTENT, AND THE `do update` IS DELIBERATE, exactly as 0060, 0072 and
 * 0080: a second run re-asserts private, the size limit and the type list
 * rather than leaving a bucket somebody widened by hand. `public` is forced
 * to false rather than taken from `excluded`.
 *
 * ADDITIVE ONLY. One row in storage.buckets. No table, no column, no grant,
 * no function. Docs: docs/sealing-controls.md, controls 12 to 17.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-engineer-drafts', 'eng-engineer-drafts', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
