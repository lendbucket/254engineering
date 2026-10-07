-- ===========================================================================
-- A CREDENTIAL IS A RECORD, NOT A DOCUMENT.
-- ===========================================================================
--
-- Operator ruling, 2026-10-02: drop eng_credentials.storage_key, apply it to
-- development, board it, and let production go in one sitting bundled with the
-- suspension trigger migration.
--
-- RENUMBERED FROM 0061 TO 0062 ON 2026-10-07, operator ruling of 2026-10-06:
-- 0061 holds the sealing schema. Written as 0061 on 2026-10-02 in e415ffc and
-- never applied anywhere, so nothing has run under the old number. The only
-- change from that file is the number, here and in the eng_credentials comment.
--
-- WHY IT IS HERE AT ALL, which is the part worth recording. The HR lifecycle
-- report of 2026-10-02 found seven onboarding checklist items uploading
-- documents that Gusto holds and the platform must not: photo ID both sides, a
-- driver licence, a W-4, an I-9 Section 1, a direct deposit authorisation and a
-- W-9. Those were removed in code the same day.
--
-- AND THAT REPORT UNDERSTATED THE EXTENT, which is why this migration exists.
-- The figure "seven checklist items" came from reading ONE file and was offered
-- as the size of the problem. eng_credentials is a SECOND place a document of
-- exactly those classes can live: it carries storage_key, and its kind check
-- constraint admits drivers_license, w9 and direct_deposit. Nothing in the
-- report had opened it.
--
-- MEASURED BEFORE BEING ACTED ON, both databases, read only:
--
--   development   17 credential rows across five kinds, 0 with a storage_key
--   production    0 credential rows at all
--
-- And no code writes the column. The onboarding path promotes an accepted
-- checklist item into a credential with kind, label, issued_on, expires_on,
-- status, verified_at and verified_by, and no document. So this drops a column
-- that has never held a value.
--
-- WHY DROP IT RATHER THAN GUARD IT. Because an empty register is a guard nobody
-- has exercised, which is a rule this schema's own history keeps proving: a
-- column that exists is a column somebody fills, and the first code to fill this
-- one would store a driver licence with nothing objecting. A check constraint
-- would be a rule somebody can delete in a later migration while believing they
-- are tidying up. Dropping the column makes the ruling structural: there is
-- nowhere to put the file.
--
-- WHAT IS DELIBERATELY NOT DROPPED. The credential KINDS. drivers_license, w9
-- and direct_deposit stay in the check constraint, because a credential is the
-- firm's record THAT a thing exists and when it expires, and two of the three
-- are in REQUIRED_FOR_DISPATCH. A technician with no w9 credential cannot be
-- dispatched, and that is correct: the record says Gusto holds the form. Only
-- the file is forbidden, never the fact.
--
-- NOTHING CASCADES AND NOTHING ELSE MOVES. Dropping a nullable text column that
-- no row populates touches no index, no constraint, no trigger and no policy.
-- eng_credentials_profile_idx is on (profile_id, kind) and
-- eng_credentials_expiry_idx is on (expires_on); neither names this column.

alter table eng_credentials drop column if exists storage_key;


-- ===========================================================================
-- AND THE COMMENT ON eng_onboardings IS SHARPENED, NOT CORRECTED.
-- ===========================================================================
--
-- Migration 0000 comments that table: "Invite-only onboarding records. Service
-- role only: RLS on, zero policies. Never stores a social security number."
--
-- THE LAST SENTENCE WAS FALSE IN EFFECT AND IS NOW TRUE. No column ever held an
-- SSN. A W-4 image held one, an I-9 Section 1 held one, and a W-9 held one or an
-- EIN, all of them in the private eng-onboarding bucket that this table's
-- storage_key pointed into. A correct statement about the schema standing in for
-- one nobody had made about the system.
--
-- With those uploads gone the sentence is accurate, so this does not correct it.
-- It says WHERE those records live instead, because the next person to read a
-- reassuring sentence deserves to know what makes it true rather than having to
-- take it on trust. 0000 itself is not edited: a migration that has run is a
-- migration nobody can reason about if it changes afterwards.

comment on table eng_onboardings is
  'Invite-only onboarding records. Service role only: RLS on, zero policies. '
  'Holds no social security number, no date of birth, no bank details and no '
  'identity document, in any column or any bucket. Gusto holds the W-4, the '
  'I-9, the W-9 and the bank details; this table records only that each was '
  'completed there, and on what date. Operator ruling, 2026-10-02.';

comment on table eng_credentials is
  'What a person holds, as a RECORD and never as a document: kind, issue and '
  'expiry dates, and who verified it. storage_key was dropped in 0062 because a '
  'credential is the fact that something exists and when it lapses, not a copy '
  'of it. drivers_license, w9 and direct_deposit remain valid kinds; the forms '
  'themselves live in Gusto.';
