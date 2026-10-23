/*
 * ===========================================================================
 * 0080  THE ENGINEER'S SIGNED SOURCE DOCUMENTS LEAVE THE PUBLIC REPOSITORY.
 * ===========================================================================
 * Operator rulings, 2026-10-22.
 *
 * WHAT WAS WRONG. The repository is public, and three files in its tree carry
 * what the TBPELS register does not publish: both signed copies of 254-RC-001
 * (v1.0 and v1.1) carry Aman Dhakal's handwritten signature as an embedded
 * image, and docs/protocols/incoming/v1.1/254_Letter_Templates.docx carries
 * "Texas P.E. No. 143295" beside his name six times. They were committed as
 * the authority the transcriptions are proved against, which is a good reason
 * to keep them and no reason to publish them.
 *
 * WHAT THIS DOES. One private bucket, eng-protocol-sources, for the engineer's
 * source documents: PDF and Word, 25 MB. The originals go there on DEVELOPMENT
 * only, by Robert's ruling; the repository keeps each one's SHA-256, byte count
 * and storage key, so protocol-registry-audit still proves every transcription
 * against the exact document, and refuses if the stored bytes ever differ.
 * On production the bucket is created and stays empty: the chain must describe
 * every bucket the code names (0060), and a bucket that exists on one project
 * only is the drift 0060 was written to end.
 *
 * WHY A NEW BUCKET. None in the chain fits. eng-uploads, eng-onboarding,
 * eng-evidence, eng-messages and eng-partner-assets refuse Word files, and
 * eng-documents is the sealed deliverable store, which this must not touch.
 *
 * IDEMPOTENT, AND THE `do update` IS DELIBERATE, exactly as 0002, 0060 and 0072:
 * a second run re-asserts private, the size limit and the type list rather
 * than leaving a bucket somebody widened by hand. `public` is forced to false
 * rather than taken from `excluded`: these documents carry a signature.
 *
 * ADDITIVE ONLY. One row in storage.buckets. No table, no column, no grant.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-protocol-sources', 'eng-protocol-sources', false, 26214400,
        array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
