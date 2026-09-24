/*
 * ===========================================================================
 * 0060  THE UPLOADS BUCKET IS IN THE CHAIN.
 * ===========================================================================
 *
 * DRAFTED 2026-09-24 AND NOT APPLIED. The overnight run it was written in has
 * no production access of any kind, and nobody has read which buckets actually
 * exist on either project. Its ledger entry is pending.
 *
 * WHAT WAS WRONG. `src/lib/uploads.ts` line 49 hardcodes
 * `const BUCKET = "eng-uploads"`, and that bucket carries every application
 * resume, every onboarding document and every order upload. **No migration
 * created it.** The only bucket in this chain is `eng-evidence`, from 0002.
 *
 * So a database rebuilt from these migrations has nowhere to put an upload, and
 * every one of those paths fails on a freshly provisioned project. That is
 * exactly the defect `migration-audit` exists to prevent, wearing storage
 * instead of tables: 0001 spent a month unable to apply to an empty database
 * while both live projects held the objects it failed to create.
 *
 * WHY NOTHING CAUGHT IT, AND THE FIRST ANSWER WRITTEN HERE WAS WRONG.
 *
 * It said PGlite has no storage schema, so buckets were invisible to the
 * replay. **That is false and the replay disproved it within the minute**:
 * `scripts/migration-audit.mjs` creates a `storage.buckets` stub before it
 * replays anything, so every bucket statement in the chain runs and 0002's
 * bucket is created exactly as it is on a real project.
 *
 * The true reason is narrower and more useful. **Nothing ever compared the
 * buckets the CODE names against the buckets the CHAIN creates.** The replay
 * proves the chain applies; it never asked whether the application's
 * expectations are in it. So a bucket referenced only from TypeScript was
 * invisible to a check that could have seen it all along.
 *
 * The check that closes it went in with this migration.
 *
 * The cutover project needed "five private buckets" created by hand, which is
 * the same fact from the other side: buckets have been created outside the
 * chain rather than one of them being missed.
 *
 * AND THE SOURCE ALREADY CLAIMED THIS WAS TRUE. `uploads.ts` says, in its own
 * words, that "the bucket itself carries a 10MB file_size_limit and an
 * allowed_mime_types list, because a check that lives only in application code
 * is a check somebody can skip". That is a statement about infrastructure that
 * nothing established. This file makes it true rather than editing the comment
 * to match reality, because the comment describes the right design.
 *
 * THE FIGURES ARE DERIVED FROM THE APPLICATION, NOT INVENTED. 10485760 is
 * `MAX_UPLOAD_BYTES`, which is 10 * 1024 * 1024 in `uploads.ts`. The six mime
 * types are `ALLOWED_UPLOAD_TYPES` in the same file, in its order.
 *
 * IDEMPOTENT, AND THE `do update` IS DELIBERATE. It mirrors 0002 exactly: a
 * second run re-asserts private, the size limit and the mime list rather than
 * leaving a bucket somebody widened by hand in the dashboard. `public` is
 * forced to false rather than taken from `excluded`, which is the one thing
 * about this bucket that must never drift: these are resumes and licence cards.
 *
 * WHAT THIS FILE CANNOT KNOW, and it must be checked before it is applied: the
 * live buckets on `fsaryeciduszuahgjbly` and on development have never been
 * read by anything in this repository. If `eng-uploads` exists there with a
 * DIFFERENT size limit or mime list, this migration changes it. The morning
 * checklist in docs/overnight-2026-09-24.md names that read.
 */

/*
 * ===========================================================================
 * IT IS FOUR BUCKETS, NOT ONE, AND THE CHECK FOUND THE OTHER THREE.
 * ===========================================================================
 *
 * The first draft of this file created `eng-uploads` alone, because that was
 * the one a hand survey had noticed. The check written alongside it, once it
 * could resolve a bucket named by a CONSTANT rather than a literal, found five
 * buckets in the source and three more missing from the chain:
 * `eng-onboarding`, `eng-partner-assets` and `eng-messages`.
 *
 * Five is the number `docs/production-cutover-plan.md` records being created by
 * hand on the cutover project. One of the five is in this chain.
 *
 * TWO OF THEM CARRY LIMITS DERIVED FROM THE CODE, AND TWO DO NOT, AND THE
 * DIFFERENCE IS DELIBERATE RATHER THAN UNFINISHED.
 *
 *   eng-uploads      10485760 = MAX_UPLOAD_BYTES in src/lib/uploads.ts,
 *                    and ALLOWED_UPLOAD_TYPES in its order.
 *   eng-onboarding   15728640 = MAX_ONBOARDING_UPLOAD_BYTES in
 *                    src/lib/onboarding-uploads.ts, and ALLOWED_ONBOARDING_TYPES.
 *
 *   eng-partner-assets  the code states NO size limit and NO mime list.
 *   eng-messages        the same.
 *
 * SO THOSE TWO ARE CREATED WITH `do nothing` AND NULL LIMITS, and that is the
 * safe direction rather than the tidy one. **These buckets already exist on the
 * live projects with settings nobody in this repository has ever read.** A
 * `do update` carrying limits invented here would overwrite live configuration
 * with a guess, and the guess would be enforced on real uploads. `do nothing`
 * leaves an existing bucket exactly as it is.
 *
 * WHAT THAT COSTS, SAID OUT LOUD: a database rebuilt from this chain gets those
 * two buckets PRIVATE but with no size limit and no mime restriction, which is
 * a weaker posture than the live ones probably have. That is recorded as a
 * question in docs/overnight-2026-09-24.md rather than papered over, and the
 * morning read of the live buckets is what closes it.
 *
 * The first two use `do update` for the reason 0002 does: a second run
 * re-asserts private, the limit and the list rather than leaving a bucket
 * somebody widened in a dashboard. `public` is forced to false rather than
 * taken from `excluded`, which is the one thing about any of these that must
 * never drift: they hold resumes, licence cards, partner material and message
 * attachments.
 */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-uploads', 'eng-uploads', false, 10485760,
        array['application/pdf','image/png','image/jpeg','image/webp','image/heic','image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-onboarding', 'eng-onboarding', false, 15728640,
        array['application/pdf','image/png','image/jpeg','image/webp','image/heic','image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Limits unknown to this repository. See the note above: do NOT change these to
-- `do update` without first reading what the live buckets carry.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-partner-assets', 'eng-partner-assets', false, null, null)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-messages', 'eng-messages', false, null, null)
on conflict (id) do nothing;
