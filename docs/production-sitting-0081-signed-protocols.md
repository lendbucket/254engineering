# Sitting: 0081, a signed protocol is the protocol in force

Branch `feat/lines-order-ready`. Written 2026-10-22. **Applied nowhere yet,
including development, and not committed until Robert has read the diff and
this document.** Robert's chat counterpart applies it to development from
this document; the branch is then boarded on development and held for the
production sitting.

## Why

Operator rulings of 2026-10-22:

- Signing a protocol in the portal makes it the protocol in force: approver,
  licence, the signature's date and its items written to the record, draft to
  published. Voiding the signature closes it the same way.
- Signatures already on record go in force **once, inside 0081, in this
  sitting**, and the read-back lists exactly which protocols went in force and
  why. After that, signing puts the protocol in force inside the signing
  transaction and voiding closes it inside the voiding transaction. Nothing
  runs on a timer.
- 254-WP-001 stays deferred: it shares windstorm-wpi-8 with 254-WS-001, and an
  approval retires the other protocol in force on the same line.
- `voided` is a status.
- Every sealed letter carries the 254 mark, embedded, and its seal act records
  the mark's SHA-256.

**What it cannot do.** It opens no line for ordering. Ordering reads the
offered list in configuration first (`src/lib/line-gate.ts`), which holds roof
certification alone, and the site gate reads configuration and never the
database. A protocol in force is what dispatch needs; selling it is a separate
change, held until the training ruling is built.

## What changes

| | |
| --- | --- |
| `eng_protocol_templates.signed_by_seal_act_id` | new column: the signature that put the record in force |
| status `voided` | the status check gains one word, and a voided record must name its signature |
| `eng_put_signed_protocol_in_force` | new: draft to awaiting_engineer with the signature's date, then `eng_approve_protocol` (0052), the only door into published |
| `eng_record_protocol_signature` | new ten-argument version records the signature and puts it in force in one transaction; 0062's eight-argument version now refuses |
| voiding | a trigger moves the record a voided signature put in force to `voided` |
| `eng_seal_acts.letterhead_sha256` | new column; required on every letter sealed from 0081, enforced in the BEFORE INSERT check (`eng_seal_act_check`), so a null is refused and letters sealed before stay as sealed and voidable |
| 254-WP-001 held out at the database | `eng_put_signed_protocol_in_force` refuses it whatever it is handed; the ten-argument signing door accepts null items for 254-WP-001 alone and refuses them for every other protocol |
| `eng_record_letter_seal` | new fifteen-argument version records the letterhead checksum; 0062's fourteen-argument version now refuses |
| section 7 | once: every live signature on record, judged and either put in force or left, each with an audit event naming the outcome and reason |

## The one statement carrying `drop`

Adding `voided` replaces the status check constraint, and PostgreSQL replaces a
check constraint only by dropping it. The drop and the widened re-add are one
statement, so the column is never unchecked:

```sql
alter table eng_protocol_templates
  drop constraint if exists eng_protocol_templates_status_check,
  add constraint eng_protocol_templates_status_check
  check (status in ('draft', 'awaiting_engineer', 'published', 'retired', 'voided'));
```

Nothing else in the file drops anything: the two functions whose signatures
change keep their old versions, rewritten to refuse.

**Operator ruling, 2026-10-22.** The chat applies 0081 with `apply_migration`.
If the connector asks for confirmation on the drop, Robert approves it in chat.
Nobody runs SQL by hand, so no ledger exception arises. Only if the connector
refuses outright are alternatives discussed.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0080 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0080 | `45ce47821d9c5567eb3b4b197549d881` | 1263 | `8f0fe1b5eb8a6b5588e0ae9e3ae5017c` | 1152 |
| at 0081 | `d73cdd49ae5da6268743584229cb3b88` | 1265 | `dfbdf7fcca64c3b093e736b30daa7786` | 1159 |

A live read-back is judged on the shape digest and the counts, never on the
behaviour digest (CLAUDE.md section 6b).

**What a signature must carry to go in force.** The digest of the transcription
in code, the same one `src/lib/protocol-sign.ts` signs:

| Protocol | Version | Transcription SHA-256 | At 0081 |
| --- | --- | --- | --- |
| 254-WS-001 | 1.1 | `441cf92273bc4ca7c54aea8e858a5a2e44b18515b3c40812af39dd255e6a0537` | goes in force if signed |
| 254-MH-001 | 1.1 | `d5fb2893f4d618dbdbf7a9d3d1c0998b1462e2adf72caa8d4ba59fb7b34a55d6` | goes in force if signed |
| 254-SL-001 | 1.1 | `c19522c86abbba90622aa3c1a41f5194a8f6c97134abb8bf8608fc22576c536d` | goes in force if signed |
| 254-PL-001 | 1.1 | `c8814496b1dd0b0f228b92447f547f7be4b8bf1553278bef5891817bdb6fb27e` | goes in force if signed |
| 254-RS-001 | 1.1 | `47e8e9ecb2d5fe07f9b37899cf5ee5494202b6a6f59648bf3ab0d85b9f616508` | goes in force if signed |
| 254-DS-001 | 1.1 | `c47536b8ab31009027e6f443a03bed1b28b6dbf443b85350b7e7bb817756958b` | goes in force if signed |
| 254-FC-001 | 1.0 | `dece1a13c320d6fa4bb27ed10f00d8d06d2c176c9ac934d712dbea344010e1e8` | goes in force if signed |
| 254-WP-001 | 1.2 | `05eac0971d92f06292648353e79f942d638c501aa747df4219cfc7a05cfc261a` | held out of force, not judged |

A signature also needs its signer on the register with a current licence who
seals the protocol's discipline (structural, 0077). The licences are compared
as SHA-256 hashes, so no licence number is written into the file.

**The signer table is as of the day 0081 is generated.** It holds the
register's engineers whose licence is current that day. Before the production
apply, the session reruns `scripts/emit-signed-protocols-backfill.mjs` and the
signing proof against the register as it then stands. If any licence date in
`verifiedEngineers` has passed, or the register has changed, the output
differs: the session regenerates section 7, re-runs the proof, and sends Robert
the new 0081 checksum before production gets it. Aman's licence is recorded as
current to 2028-01-31, so no change is expected.

## Section 0: read first, on the database about to be changed

```sql
select md5(string_agg(sig, '|' order by sig)), count(*)
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
-- Expect: 45ce47821d9c5567eb3b4b197549d881, 1263.

select pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.eng_protocol_templates'::regclass
   and conname = 'eng_protocol_templates_status_check';
-- Expect exactly one row, the constraint 0081 replaces, 0049's four words:
--   CHECK ((status = ANY (ARRAY['draft'::text, 'awaiting_engineer'::text, 'published'::text, 'retired'::text])))
-- Any other definition, or none, and stop: 0081 would replace something it was not written for.

select document_number, version_label, status
  from eng_protocol_templates
 where document_number in ('254-WS-001','254-MH-001','254-SL-001','254-PL-001','254-RS-001','254-DS-001','254-FC-001','254-WP-001')
 order by document_number, version_label;
-- Expect: every row draft. (254-WP-001 has a v1.1 row and a v1.2 row.)

select protocol_document, protocol_version, content_sha256, created_at, voided_at
  from eng_seal_acts
 where kind = 'protocol'
 order by protocol_document, created_at;
-- Write the rows down. This is today's signing. For each row with voided_at null,
-- compare content_sha256 with the table above: equal means it goes in force at
-- 0081 (except 254-WP-001); different means it stays a draft and the read-back
-- says the signature does not cover the transcription.

select status, document_number, version_label
  from eng_protocol_templates where document_number = '254-RC-001';
-- Expect: 254-RC-001 1.1 published, and 1.0 as recorded. 0081 does not touch it.

select document_number, version_label, service_slug, status
  from eng_protocol_templates where status = 'published';
-- Expect exactly one row: 254-RC-001 | 1.1 | roof-inspections | published.
-- No published row may share a service_slug with the seven 0081 can put in force
-- (windstorm-wpi-8, manufactured-home-foundation-certifications, solar-structural-letters,
-- structural-letters, repair-specifications, residential-light-commercial-design,
-- foundation-inspections): an approval retires the other protocol in force on its line.
```

If an answer differs from what is written, stop and send it back.

## Section 1: development

`apply_migration` against `ythzaiqeoijlrdibnieo` with the file
`supabase/migrations/0081_a_signature_puts_its_protocol_in_force.sql`, name
`0081_a_signature_puts_its_protocol_in_force`. If the connector asks for
confirmation on the drop, Robert approves it in chat. If it refuses outright,
stop and do not retry: alternatives are discussed then.

## Section 2: read back, each its own statement

```sql
-- the shape query. Expect: d73cdd49ae5da6268743584229cb3b88, 1265.

select summary, diff->>'outcome' as outcome, diff->>'why' as why
  from eng_audit_events
 where action = 'protocol.in_force_at_0081'
 order by diff->>'document';
-- Expect seven rows, one per protocol above except 254-WP-001. Each live
-- signature from Section 0 whose digest matched reads in_force; every other row
-- reads not in force with its reason.

select document_number, version_label, status, signed_by_seal_act_id is not null as by_signature,
       document_signed_at, approved_by_license is not null as licence_recorded, published_at is not null as published
  from eng_protocol_templates
 where document_number like '254-%'
 order by document_number, version_label;
-- Expect: exactly the in_force protocols above read published, by_signature true,
-- licence_recorded true; 254-RC-001 1.1 published by_signature false; the rest draft.

select t.document_number, count(i.*) as items
  from eng_protocol_templates t join eng_protocol_items i on i.template_id = t.id
 where t.signed_by_seal_act_id is not null
 group by t.document_number order by 1;
-- Expect: each protocol put in force carries its checklist; the counts are in
-- the generated section's comment line for that protocol.

select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.eng_protocol_templates'::regclass
   and conname = 'eng_protocol_templates_status_check';
-- Expect exactly one row, Section 0's definition with 'voided'::text added after 'retired'::text.

select p.oid::regprocedure from pg_proc p
 where p.proname in ('eng_record_protocol_signature','eng_record_letter_seal','eng_put_signed_protocol_in_force')
 order by 1;
-- Expect five: both versions of each of the first two, and the third.
```

Send the answers back. The session records them in `supabase/applied.mjs`.

## Section 3: the session, after Section 2

The branch is boarded on development, alone, with its prediction stated first.

## Section 4: production, only in the sitting

Section 0 against `fsaryeciduszuahgjbly`, then Section 1 against
`fsaryeciduszuahgjbly`, then Section 2. The session records `production` in
`supabase/applied.mjs` with the date, the provider version and the list of
protocols that went in force, then merges with the exact main command.

### What production holds, and so what 0081 does there

Read on production by the chat on 2026-10-22: **Aman has already signed all
eight protocols in the portal.** DS, MH, PL, RS and SL were signed on
2026-10-10; FC, WP and WS on 2026-10-15. All eight signatures are live, and
every `content_sha256` equals the transcription digest in the table above.
Nobody asks him to sign anything again: 0081 puts those signatures in force.

**Section 0 on production expects, in addition to Section 0 above:**

```sql
select protocol_document, protocol_version, voided_at is null as live,
       content_sha256
  from eng_seal_acts where kind = 'protocol'
 order by protocol_document;
-- Expect eight rows, every one live, each content_sha256 the digest in the table above:
--   254-DS-001 1.1, 254-FC-001 1.0, 254-MH-001 1.1, 254-PL-001 1.1, 254-RS-001 1.1,
--   254-SL-001 1.1, 254-WP-001 1.2, 254-WS-001 1.1.

select distinct encode(sha256(convert_to(btrim(p.license_number), 'UTF8')), 'hex') as licence_sha256, p.role
  from eng_seal_acts a join eng_profiles p on p.id = a.sealed_by
 where a.kind = 'protocol';
-- Expect exactly one row:
--   afde1f7e59be3fe2efbcf559fcee846163e49545a7ed240b2ff41fb9ce94b60e | engineer
-- That is the hash section 7 compares the signer's licence against. Any other
-- value and 0081 would leave all seven out of force ("not an engineer on the
-- register"): stop and send it back before the apply.

select document_number, version_label, requires_discipline
  from eng_protocol_templates
 where document_number in ('254-DS-001','254-FC-001','254-MH-001','254-PL-001','254-RS-001','254-SL-001','254-WS-001')
 order by document_number;
-- Expect seven rows, each requires_discipline = structural (0077).
```

**Section 2 on production expects, in place of the development answers:**

- `protocol.in_force_at_0081`: **seven rows, every one `in_force`**, reason "a live
  signature whose digest is the transcription in code, by an engineer on the
  register": DS, FC, MH, PL, RS, SL, WS. **No row for 254-WP-001.**
- The seven templates: status `published`, `by_signature` true,
  `licence_recorded` true, `published` true, `document_signed_at` the date of
  each signature in the firm's calendar (2026-10-09 for DS, MH, PL, RS, SL;
  2026-10-15 for FC, WS). **Corrected 2026-10-23 after the sitting:** this
  line first predicted 2026-10-10, the UTC date. Those five were signed 02:35
  to 02:37 UTC on 10-10, the evening of 10-09 in America/Chicago, and the
  migration takes the firm's calendar as written, so production read 10-09
  and the data is right. FC and WS read 10-15 as predicted.
- Items on each, as the generated section 7 states them:

  | Protocol | Items |
  | --- | --- |
  | 254-DS-001 v1.1 | 13 |
  | 254-FC-001 v1.0 | 37 |
  | 254-MH-001 v1.1 | 35 |
  | 254-PL-001 v1.1 | 15 |
  | 254-RS-001 v1.1 | 24 |
  | 254-SL-001 v1.1 | 22 |
  | 254-WS-001 v1.1 | 35 |

- 254-WP-001: v1.2 and v1.1 still `draft`; its signature live and untouched.
- 254-RC-001: 1.1 published, `by_signature` false, licence recorded; 1.0 as
  Section 0 read it. Untouched.
- Published rows: eight, 254-RC-001 on roof-inspections and the seven above,
  one per service line, no two on one line.

**What going in force does not do: open a line for ordering.** Every money
door asks first whether the line is offered (`src/lib/line-gate.ts`,
`lineIsSellable`), and `offeredServiceLines` in
`src/config/launch-conditions.ts` holds `roof-inspections` alone. None of the
seven is offered, and they stay unoffered until the training change ruled on
2026-10-22 is built and merged; offering them is its own change, after it. The
site gate reads configuration only, so it does not move. What changes is that
dispatch now has a protocol in force for each of the seven, which nothing can
reach while the lines are not sold.

### The cutover: apply, then merge and deploy at once

Once 0081 is on production, the code deployed there still calls 0062's
eight-argument `eng_record_protocol_signature` and fourteen-argument
`eng_record_letter_seal`, and 0081 makes both refuse. So from the apply until
the deploy of this branch is READY:

- **No roof letter may be sealed.** A seal attempted in the gap is refused with
  "since 0081 a letter is sealed with the checksum of the mark at its head" and
  nothing is sealed or stored; it is retried after the deploy.
- **No protocol may be signed.** A signature attempted in the gap is refused the
  same way and records nothing.
- Ordering, payment and everything else are unaffected.

**The order, without a pause between steps:** Section 2 read back, then the
session commits the production record (`supabase/applied.mjs`) and runs its
readers, then merges and pushes main with the exact command, then Vercel builds
and deploys, and Robert's counterpart confirms READY on Vercel.

**Expected gap: about ten minutes**, from the apply to READY. The basis: the
production record, its readers and the merge and push take about three to four
minutes, as they did for 0080 today; the build itself takes about two minutes on
the cloud board's runner (1 min 19 s and 1 min 43 s on today's two runs), and
Vercel's production build and promotion is not something this repository can
read, so allow five more. If READY has not been seen at fifteen minutes, the
counterpart reads the deployment state before anybody seals or signs.

**Development has the same window.** Once 0081 is on development, a board of a
branch without this code is unaffected (no audit seals or signs on development:
`roles-audit` and `security-audit` are refused at the route before the
database), but `scripts/exercises/order-path-walk-child.mjs`, which seals a
letter through the app, fails against development until this branch merges.

## What this does not do

It opens no line for ordering and changes no public page. It does not put
254-WP-001 in force, whatever its signature. It does not touch 254-RC-001.
It generalises no letter beyond roof certification: that is the next diff,
once Aman's wording for each line is confirmed.
