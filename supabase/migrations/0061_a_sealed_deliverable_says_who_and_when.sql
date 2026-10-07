/*
 * ===========================================================================
 * 0061  A SEALED DELIVERABLE HAS SOMEWHERE TO LIVE, AND IT SAYS WHO AND WHEN.
 * ===========================================================================
 *
 * WRITTEN 2026-10-03 AND APPLIED NOWHERE. Operator ruling: the constraint is
 * approved in principle and goes to production in a sitting, not through a
 * session. Its ledger entry is pending and the branch does not merge until it
 * is not, because a migration on main is never pending.
 *
 * NUMBERED 0062 FIRST, AND THE REPLAY OVERRULED THAT. Worth keeping, because
 * the reasoning was sound and the check was righter.
 *
 * `0061_credentials_hold_no_documents.sql` already exists on
 * `migration/credentials-hold-no-documents`: the `drop column` parked because
 * the Supabase MCP cancels a destructive statement before it runs. So this file
 * was written as 0062 to avoid two files numbered 0061 on two branches, which
 * is a collision nobody meets until both merge.
 *
 * `migration-audit` refused it immediately:
 *
 *     FAIL: they are numbered contiguously from 0000 (got 0 ... 60, 62)
 *
 * AND THAT CHECK IS RIGHT, because the two problems are not the same size. A
 * duplicate number is found by `git` the moment the branches meet, loudly, with
 * both files in front of somebody. A GAP is a chain that cannot be replayed
 * into an empty database, and it reads exactly like a migration that was lost:
 * the recovery case this audit exists for. Avoiding a collision by making the
 * chain non-contiguous trades a visible problem for an invisible one.
 *
 * So this is 0061 and the parked branch renumbers to 0062 before it merges.
 * That is recorded in `BACKLOG.md` beside the sitting item rather than done
 * here, because it also renames the worked example in
 * `docs/production-sitting-destructive.md` and that branch is the operator's.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL, WHICH IS A DEFECT RATHER THAN A FEATURE REQUEST.
 * ---------------------------------------------------------------------------
 *
 * Traced read only on 2026-10-03, from the Stripe webhook to a customer
 * holding a letter. Nine of eleven steps worked. The last two did not exist:
 *
 *   - `recordDocument` in `src/lib/ops-docs.ts` is the only function that
 *     inserts into `eng_documents`, and it had ZERO CALLERS.
 *   - `sealed_at` was never assigned anywhere in `src/`. It existed as a row
 *     type and as one comment.
 *   - The documents route exported GET and no POST, so there was no upload.
 *   - No customer facing route could read a document at all.
 *
 * So the firm could take money, dispatch a technician, review the package,
 * seal the file, and email the customer "It is ready to download" under a
 * button pointing at a page with no document on it. That email was corrected
 * first, on its own branch, before any of this was built.
 *
 * ---------------------------------------------------------------------------
 * PART ONE: THE BUCKET, BECAUSE 0060 MADE THAT A RULE.
 * ---------------------------------------------------------------------------
 *
 * 0060 established that every bucket the CODE names must be created by this
 * chain, and added the check that compares the two. Before it, `eng-uploads`
 * carried every resume and every order upload and no migration created it, so
 * a database rebuilt from these files had nowhere to put one.
 *
 * `eng-documents` is therefore created here rather than by hand or by a
 * storage call, and `migration-audit` will say so the moment the code names it
 * without this file: that is the bucket half of this migration's injection
 * test, and it costs nothing to run because the check already exists.
 *
 * WHY ITS OWN BUCKET RATHER THAN `eng-evidence`. Evidence is what a technician
 * photographed; a sealed deliverable is what a Professional Engineer put his
 * seal on. They have different readers, different retention and different
 * consequences if the wrong person opens one, and `eng_documents.visibility`
 * already distinguishes 'internal' from 'client' precisely because a customer
 * may see the second and never the first. One bucket holding both would make
 * that distinction a property of a column with nothing underneath it.
 *
 * PDF ONLY, AND THAT IS NARROWER THAN EVIDENCE ON PURPOSE. The evidence route
 * accepts five image types because somebody photographs a roof from a ladder.
 * A sealed engineering document is a document. 25MB because a sealed drawing
 * set with an aerial survey in it clears ten, and because the limit on the
 * bucket is the one a person cannot skip: a check that lives only in
 * application code is a check somebody routes around, which is the sentence
 * `uploads.ts` already had and 0060 made true.
 */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-documents', 'eng-documents', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/*
 * ---------------------------------------------------------------------------
 * PART TWO: THE TWO CONSTRAINTS, AND THEY ARE THE 0049 PATTERN.
 * ---------------------------------------------------------------------------
 *
 * 0049 added `awaiting_engineer` to the protocol status vocabulary and three
 * check constraints with it, because a word with no constraint behind it is a
 * convention somebody forgets. These two are the same argument applied to the
 * two columns that decide whether a row is a seal.
 *
 * ONE. BOTH OR NEITHER. A row carrying `sealed_at` with no `sealed_by` is half
 * a fact that reads as a whole one: the firm's own record would say a
 * deliverable was sealed and be unable to say by whom. The reverse is worse in
 * a quieter way, a named sealer with no date, because the responsible charge
 * log is built on when a decision happened. Neither state has a legitimate
 * reading, so neither is representable.
 *
 * TWO WAS WRITTEN, REFUSED BY THE REPLAY, AND WITHDRAWN. IT IS RECORDED HERE
 * RATHER THAN DELETED, BECAUSE WHY IT WAS WRONG IS WORTH MORE THAN THE CLAUSE.
 *
 * It read `check (sealed_at is null or kind = 'deliverable')`, on the argument
 * that five of the six kinds are the firm's own paperwork and a seal on one of
 * them would be a sealed engineering document the engineer never issued.
 *
 * `migration-audit` refused it, naming a fixture that inserts a sealed
 * `firm_document` with NO FILE AT ALL. That fixture is not a malformed row and
 * it is not careless: it exists to prove 0032's trigger reads `sealed_at`
 * through `to_jsonb(old)` so that a seal defends ITSELF whatever file it hangs
 * off, including none. Somebody had already decided a sealed document need not
 * be a per-file deliverable, and wrote a check that depends on it.
 *
 * SO THE CONSTRAINT WAS NOT A SCHEMA TIGHTENING, IT WAS A RULING ABOUT WHAT
 * THE FIRM MAY PUT A SEAL ON, invented by a session in a migration comment. An
 * engineer may well seal something that is not one job's letter. That question
 * belongs to the operator and the engineer of record, and it is in `BACKLOG.md`
 * awaiting them.
 *
 * The first constraint survives untouched, because "a seal names its sealer and
 * its date, or it is not a seal" needs nobody's ruling: neither half has a
 * legitimate reading alone.
 *
 * AND THE FIXTURE THAT DID CHANGE, CHANGED FOR THE OPPOSITE REASON. The 0032
 * sealed-work fixture wrote `sealed_at` with no `sealed_by`, which constraint
 * one makes unrepresentable. That row WAS malformed, so the fixture gained the
 * column rather than the constraint losing the clause. Two fixtures, two
 * opposite verdicts, and the difference is whether the state the fixture
 * depends on is one the firm has ruled out or one nobody has ruled on.
 *
 * WHAT THESE DO NOT DO, STATED SO NOBODY READS MORE INTO THEM. They do not
 * decide WHO may seal. That is `documents.seal`, which already exists in
 * `src/lib/ops-authz.ts` as a LICENSED action, which means it comes from
 * holding the licence rather than from a row in `eng_role_grants`. So unlike
 * 0059 this migration seeds no grant and needs none, and there is no checkbox
 * anywhere that would hand sealing to somebody who is not a Professional
 * Engineer in responsible charge. The database refuses a malformed seal; the
 * licence decides whose seal it is.
 *
 * AND THEY ARE VALIDATED RATHER THAN `not valid`, because `eng_documents` holds
 * zero rows on production, read on 2026-10-03, and 0039's dangling rows are
 * the reason the only NOT VALID key in this schema is NOT VALID. There is
 * nothing here to grandfather.
 */

alter table eng_documents
  add constraint eng_documents_seal_is_whole_ck
  check ((sealed_at is null) = (sealed_by is null));

/*
 * ===========================================================================
 * PART THREE: THE ENGINEER'S SEAL AND SIGNATURE IMAGES, ADDED 2026-10-07.
 * ===========================================================================
 *
 * Operator rulings 2 and 5 of 2026-10-06: the platform drafts each letter and
 * the engineer applies his seal and signature, stored on his profile, from his
 * own session with a fresh second factor. The sealing schema goes into this
 * migration, which has run nowhere. This part is the first piece of it: where
 * the images live and what is recorded about each.
 *
 * THE RULE THIS REPLACES SAID THERE IS NO SEAL IMAGE IN THIS REPOSITORY, and
 * there still is not. These are images the engineer uploads himself, into a
 * private bucket, from his own session. The repository holds the place they go
 * and the record of each, never an image.
 *
 * ---------------------------------------------------------------------------
 * THE BUCKET. Private, PNG only, 2MB.
 * ---------------------------------------------------------------------------
 *
 * Its own bucket rather than `eng-documents`, because the two have different
 * readers. A sealed document is read by the customer it was issued to. A seal
 * image is read by exactly one thing, the sealing step, and by nothing that
 * serves a file to anybody. Sharing a bucket would make that a property of the
 * code that happens to read it rather than of where it lives.
 *
 * PNG only because a seal is line art that must stay crisp when it is placed on
 * a page, and because one format is one thing to validate. 2MB because a seal
 * scanned at 600dpi clears a few hundred kilobytes; a limit far above that is a
 * limit nobody would notice being abused.
 *
 * NO STORAGE POLICY IS CREATED, ON PURPOSE. With row level security on
 * storage.objects and no policy naming this bucket, no anon or authenticated
 * client can read or write it. Only the service role, which is the server, can.
 * The recorded limit, ruled acceptable on 2026-10-06: the owner of the Supabase
 * project can still read it from the Supabase dashboard.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-seals', 'eng-seals', false, 2097152, array['image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/*
 * ---------------------------------------------------------------------------
 * THE RECORD OF EACH IMAGE.
 * ---------------------------------------------------------------------------
 *
 * One row per upload. A replaced image is SUPERSEDED, never deleted or edited,
 * because a document sealed last month carries last month's seal and somebody
 * asking later which image was on it needs the row that says so. The partial
 * unique index makes "the current seal" a single row per engineer and kind.
 *
 * `sha256` is the hash of the exact bytes stored, so the sealing step can
 * refuse an object that no longer matches its record. `mfa_verified_at` is the
 * moment his second factor was checked for this upload, recorded rather than
 * inferred from a session.
 */
create table if not exists eng_seal_images (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  profile_id       uuid not null references eng_profiles(id) on delete restrict,
  kind             text not null check (kind in ('seal', 'signature')),
  storage_key      text not null unique,
  sha256           text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size        integer not null check (byte_size > 0),
  width            integer not null check (width > 0),
  height           integer not null check (height > 0),
  mfa_verified_at  timestamptz not null,
  superseded_at    timestamptz,
  /*
   * DEFERRED, because a replacement is one act in two statements: the old row
   * is superseded by naming the new one, and the new one is inserted. The
   * partial unique index refuses a second current image, so the old row must
   * be superseded first, and it must name a row that does not exist until the
   * next statement. Checked at commit, the pair is valid; checked per
   * statement, no replacement could ever be made.
   */
  superseded_by    uuid references eng_seal_images(id) on delete restrict deferrable initially deferred,
  constraint eng_seal_images_superseded_whole_ck
    check ((superseded_at is null) = (superseded_by is null))
);

create unique index if not exists eng_seal_images_one_current
  on eng_seal_images (profile_id, kind)
  where superseded_at is null;

alter table eng_seal_images enable row level security;

/*
 * THE ROW RECORDS WHAT WAS UPLOADED, AND ONLY ITS SUPERSESSION MAY BE WRITTEN.
 * Deleting refuses outright. An update may set superseded_at and superseded_by
 * once, from empty, and may change nothing else, so the hash a sealed document
 * was checked against can never be rewritten to match a different image.
 */
create or replace function eng_seal_image_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception
      'eng_seal_images rows cannot be deleted. A replaced seal or signature is superseded, never removed.';
  end if;
  if old.superseded_at is not null then
    raise exception 'A superseded seal image cannot change again.';
  end if;
  if new.id <> old.id
     or new.created_at <> old.created_at
     or new.profile_id <> old.profile_id
     or new.kind <> old.kind
     or new.storage_key <> old.storage_key
     or new.sha256 <> old.sha256
     or new.byte_size <> old.byte_size
     or new.width <> old.width
     or new.height <> old.height
     or new.mfa_verified_at <> old.mfa_verified_at then
    raise exception
      'A seal image row records what was uploaded. Only superseded_at and superseded_by may be set, once.';
  end if;
  return new;
end;
$fn$;

drop trigger if exists eng_seal_images_guard on eng_seal_images;
create trigger eng_seal_images_guard before update or delete on eng_seal_images
  for each row execute function eng_seal_image_guard();

/*
 * EVERY UPLOAD AND EVERY SUPERSESSION IS IN THE AUDIT LOG, IN THE SAME
 * TRANSACTION AS THE ROW. Written by the database rather than by the
 * application because `writeAudit` logs a failure and carries on, which is the
 * right trade for a page view and the wrong one here: a seal image that exists
 * with no audit record is exactly the state 22 TAC 137.33(d) asks the firm to
 * prevent. If the audit row cannot be written, neither can the image row.
 */
create or replace function eng_seal_image_audit()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  insert into public.eng_audit_events (actor_id, actor_role, action, entity_type, entity_id, summary, diff)
  values (
    new.profile_id,
    (select p.role from public.eng_profiles p where p.id = new.profile_id),
    case when tg_op = 'INSERT' then 'seal_image.uploaded' else 'seal_image.superseded' end,
    'seal_image',
    new.id::text,
    case
      when tg_op = 'INSERT' then new.kind || ' image uploaded, sha256 ' || new.sha256
      else new.kind || ' image superseded by ' || new.superseded_by::text
    end,
    jsonb_build_object(
      'kind', new.kind,
      'sha256', new.sha256,
      'byte_size', new.byte_size,
      'mfa_verified_at', new.mfa_verified_at
    )
  );
  return new;
end;
$fn$;

drop trigger if exists eng_seal_images_audit on eng_seal_images;
create trigger eng_seal_images_audit after insert or update on eng_seal_images
  for each row execute function eng_seal_image_audit();

/*
 * THE ONE DOOR A NEW IMAGE COMES IN THROUGH, BECAUSE A REPLACEMENT IS ONE ACT.
 *
 * Superseding the current image and inserting its successor must happen in one
 * transaction: the reference from the old row to the new one is checked at
 * commit, and the partial unique index refuses two current images. Two calls
 * from the application are two transactions, and the first would be refused.
 *
 * SECURITY INVOKER, as eng_approve_protocol is, for the reason 0052 gives: this
 * decides nothing about who may call it. The application has already checked
 * that the caller is the engineer, holds the licence, and has just answered a
 * fresh second factor, and it passes the caller's own profile id. Under the
 * invoker's rights, a client that is not the service role meets row level
 * security on eng_seal_images with no policy, and can write nothing through
 * this function at all.
 */
create or replace function eng_record_seal_image(
  p_id               uuid,
  p_profile_id       uuid,
  p_kind             text,
  p_storage_key      text,
  p_sha256           text,
  p_byte_size        integer,
  p_width            integer,
  p_height           integer,
  p_mfa_verified_at  timestamptz
)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  update public.eng_seal_images
     set superseded_at = now(), superseded_by = p_id
   where profile_id = p_profile_id
     and kind = p_kind
     and superseded_at is null;

  insert into public.eng_seal_images
    (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at)
  values
    (p_id, p_profile_id, p_kind, p_storage_key, p_sha256, p_byte_size, p_width, p_height, p_mfa_verified_at);
end;
$fn$;
