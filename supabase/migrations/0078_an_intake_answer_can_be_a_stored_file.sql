/*
 * ===========================================================================
 * 0078: AN INTAKE ANSWER CAN BE A STORED FILE. 2026-10-16.
 * ===========================================================================
 *
 * A job taken by the firm could not be opened for a line whose signed protocol
 * requires a document at order. 254-RC-001 requires "Photo of the front of the
 * property (confirms address/structure)" at the Required tier, so the field is
 * required at the order stage, and both the intake screen and takeJob refuse
 * an order-stage gap. The screen said the photo "stays outstanding on the file
 * and can be requested", and neither half was true: the job could not be
 * opened at all, so there was no file to request it on.
 *
 * The requirement is the engineer's and is kept. What was missing is a way for
 * the firm to attach the document when it takes the job. A web order already
 * stores its documents on eng_order_inputs with bucket, storage_key,
 * content_type and byte_size (0006). This gives eng_file_inputs the same four
 * columns, named the same, so an answer the firm records can be a file rather
 * than a sentence about one.
 *
 * Additive only: four nullable columns and one check. The check keeps a stored
 * file honest: a row naming a storage key names the bucket it is in, and the
 * reverse, so a half-recorded upload cannot read as attached.
 */

alter table eng_file_inputs
  add column if not exists bucket       text,
  add column if not exists storage_key  text,
  add column if not exists content_type text,
  add column if not exists byte_size    bigint;

alter table eng_file_inputs
  drop constraint if exists eng_file_inputs_stored_file_whole_ck;
alter table eng_file_inputs
  add constraint eng_file_inputs_stored_file_whole_ck
  check ((bucket is null) = (storage_key is null));

comment on column eng_file_inputs.storage_key is
  'For a file answer: where it landed, in the private bucket named beside it. Same four columns as eng_order_inputs (0006), so a document is recorded the same way whichever door the job came through.';
