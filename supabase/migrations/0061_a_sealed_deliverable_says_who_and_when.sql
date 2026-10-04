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
