# The production database cutover, step by step

Written 2026-09-03.

---

## REOPENED BY DECISION, 2026-09-10. NOTHING HAS BEEN TOUCHED.

**Operator ruling.** The cutover moves ahead of Section 6. The reason, in the
operator's words:

> The firm can now take money and has no restore path.

TBPELS issued firm registration **F-29811** the same day. That is what changed:
until then the worst case was losing a handful of leads, and from now on it is
losing a record of work somebody paid for.

**This section is a PLAN. Nothing in it has been executed.** Steps 1, 2 and 3
were done on 2026-09-07 and are still done. Every step that writes anything
remains unrun. The next action is the operator's word, not a command.

---

### What is actually at stake, read from production today

The 2026-09-03 plan sized this cutover before there was anything in it. Read
back from `fsaryeciduszuahgjbly` on 2026-09-10:

| Table | Rows | What it is |
| --- | --- | --- |
| `eng_cron_runs` | 10,460 | telemetry, prunable, and retention may delete from it |
| `eng_jobs` | 1,749 | telemetry, prunable |
| **`eng_audit_events`** | **477** | **the firm's regulatory memory. Append only. Refuses DELETE.** |
| `eng_role_grants` | 119 | seeded by migrations; the new project already has its own |
| `eng_metrics_daily` | 81 | daily rollups |
| `eng_mfa_recovery_codes` | 10 | one account's recovery codes |
| **`eng_profiles`** | **2** | one admin, one engineer. Real accounts. |
| `eng_auth_tokens` | 2 | short lived |
| **`eng_leads`** | **2** | real enquiries, both `site = '254'` |
| **`eng_applications`** | **1** | a real application, `site = '254'` |
| `eng_mfa_enrolments` | 1 | one enrolled second factor |

**And what production does NOT hold, which is the number that decides the risk:**

```
files 0   orders 0   documents 0   evidence 0
production_ledger 0  tech_pay_ledger 0  partner_entries 0  statements 0
```

**Nobody has been billed and no work exists.** The irreplaceable set is five
rows of business record plus 477 audit events plus one person's second factor.
Everything else is telemetry that retention is allowed to delete anyway.

That is the argument for going NOW rather than after Section 6. This is the
smallest this migration will ever be, and the registration issuing is the moment
it starts growing.

**Audit events span 2026-09-02 to 2026-09-10** and cannot be recreated. They are
the one table where a botched copy is unrecoverable, because the table refuses
DELETE by design and a second import would double every row rather than replace
it.

---

### What changed since the deferral, and what it does to the plan

**1. The schema moved from 0023 to 0041.** The new project holds 0000 through
0023. The repository now has through 0041. **Step 2 is no longer done: it is
eighteen migrations short.** 0024 through 0041 replay into the new project
before anything else happens.

**2. 0038 through 0041 have never been applied to production either.** They are
pending in `supabase/applied.mjs` and the branch has not merged. That creates a
question the operator has to answer and this plan must not answer for itself:

> **DECISION A, ANSWERED 2026-09-10. The old production never receives them.**
>
> The cutover runs on main as it stands, 0000 through 0037, BEFORE Section 4
> merges. The new project replays main's chain, the data moves, the app flips,
> and only then does `feat/phase-12-section-4` merge and 0038 through 0041 apply
> to the NEW production in order, each read back before the next.
>
> **This supersedes gate 2's ruling 6 for those four migrations**, and
> `supabase/applied.mjs` says so above the 0038 entry rather than leaving the two
> rulings to be reconciled by whoever reads them next.
>
> The property it preserves, in the operator's words: production is never ahead
> of main, and main never describes a schema production lacks.

**3. Step 8b's answer exists and is partly built.** The sisters post to
`/api/intake/lead` rather than writing Supabase. It is built, documented in
`docs/sister-intake-api.md`, and asserted by `sister-intake-audit` on the board.
What remains is not construction, it is confirmation, and it is in section 8b
below.

**4. The compliance gate did not open.** F-29811 is issued to *254 Services LLC*
and the sites hold out as *254 Engineering Services*, so `LAUNCH_MODE` stays
prelaunch until the board holds the operating name. **This does not block the
cutover and must not be allowed to look like it does.** The two are independent:
one is about what the sites may say, the other is about where the rows live.

**5. A restore path is what this is FOR, and there still is not one.** Point-in-
time recovery, backup schedule and restore rehearsal are step 15 below, added by
this reopening, because the operator's stated reason for moving was the absence
of one and the original plan ended at step 14 without it.

---

## THE SEQUENCE AS RULED, 2026-09-10. NOTHING BELOW HAS BEEN EXECUTED.

This supersedes the ordering in section 3. The detail under each old step still
stands and is referenced by number; what changed is the order, the ownership and
the read-backs.

**Stop for the operator's word before step 1.**

---

### FIRST, A FINDING THAT CHANGES ONE OF THE RULED READ-BACKS

The ruling says the new project replays main's chain and **both fingerprints are
read back against the old production**. Read today, before writing any of this:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| Replay of main, 0000 to 0037 | `3acd988c07905602e0e091c5b8d329ad` | 1015 | `764ff4339fed2db9e74317ee19278950` | 806 |
| **Old production, today** | `3acd988c07905602e0e091c5b8d329ad` | 1015 | `05f058a1c8f4c9f4e19546179482adfb` | **810** |

**The shapes match exactly. The behaviours cannot, and never will.** The
difference is twelve facts and every one of them is already documented:

**Four foreign keys the replay HAS and production LACKS.** 0001 declares them
and neither live database has ever had them, because 0001 spent a month unable
to apply while the objects were made by hand, and the hands that made them did
not make these:

    eng_file_events_actor_id_fkey
    eng_responsible_charge_log_engineer_id_fkey
    eng_responsible_charge_log_file_id_fkey
    eng_responsible_charge_log_document_id_fkey

The third is the one that matters: `engineer_id -> eng_profiles ON DELETE
RESTRICT` is what stops a Professional Engineer being removed while responsible
charge entries name them. 0039 exists to add all four and is on the branch.

**Eight indexes production HAS and the replay lacks.** Production has carried
them since before this repository kept migrations. 0040 exists to add them and
is also on the branch.

**So a byte-equal behaviour match is impossible by construction, and demanding
one would stall this cutover at step 2 permanently.** The read-back is therefore
stated as the stronger thing:

> The new project's behaviour must equal the REPLAY figure exactly, and the
> difference from old production must be EXACTLY those twelve named facts. Any
> thirteenth difference stops the sequence.

That is stronger than equality because equality was never achievable and this
names what may differ. **This is a change to the letter of the ruling and it is
flagged rather than absorbed.**

**One consequence worth knowing now:** after the cutover the new production
briefly has four foreign keys that old production never had, and lacks eight
indexes it had. 0039 and 0040 close both at step 14. 0039 does `drop constraint
if exists` before each `add`, so it is idempotent and applies cleanly to a
project that already has the four from 0001, which was checked rather than
assumed.

---

### SECOND, A FINDING FROM 2026-09-11 THAT CHANGES HOW BOTH READ-BACKS ARE MEASURED

The twelve facts named below are CLOSED. 0038 through 0041 went to the shared
production on 2026-09-11 and its foreign keys, indexes and grants now agree with
the replay byte for byte. A cutover replaying a chain that includes them
compares against a production that already agrees, which is what the deferral
ruling anticipated.

What the same run also found is that **a behaviour digest from a PGlite replay
can never equal one read from a live Supabase project**, for two reasons that
have nothing to do with this schema: `conbin::text` is rendered differently by
PostgreSQL 18.3 (PGlite) and 17.6 (Supabase), and the three function bodies
carrying SQL comments are stored on production with those comments stripped.

**The reasoning, the proof and the per-kind figures are in
`supabase/applied.mjs`**, immediately above the twelve fact note. It is not
repeated here, because two accounts of one finding are two accounts that will
disagree.

What it changes on this page: **step 2 and step 14 compare the SHAPE digest
whole, and compare behaviour by the seven portable kinds plus counts and names
for `ck` and `fn`.** The rule that any difference stops the sequence is
unchanged.

---

### THE 2026-09-14 RECONCILIATION. FIVE THINGS BELOW WERE STALE.

Read before the sequence, because walking the tables underneath without these
would replay the wrong chain and demand read-backs of rows that no longer exist.
Every figure here was read from the live projects on 2026-09-14, not inferred.

**1. The chain is 0000 to 0042, not 0000 to 0037.** DECISION A was written on
2026-09-10 when 0038 to 0041 were unapplied. They went to production on
2026-09-11 and 0042 on 2026-09-13. Main holds 43 files, 0000 through 0042;
production has all 43; this branch's 0043 to 0048 are pending and correctly so.

**2. The twelve fact carve-out is GONE, and step 2's read-back is now stronger.**
It was "differs from old production by exactly twelve named facts". Those twelve
closed when 0039 and 0040 applied. It is now **plain equality**: the new project
must read `11a709155214441ec2b7c3b382f6e17f` across **1,030 columns and 75
tables**, which is what production reads today and what the ledger declares for
0042.

**3. Step 14 is already done.** It said merge `feat/phase-12-section-4` and apply
0038 to 0041. That happened on 2026-09-11. There is no such step any more.

**4. THE MFA ENROLMENT IS NO LONGER ON PRODUCTION.**

| Row | This plan demanded | Production, 2026-09-14 |
| --- | --- | --- |
| `eng_mfa_enrolments` | 1 | **0** |
| `eng_mfa_recovery_codes` | 10 | **0** |

The 2026-09-13 lockout ended with the enrolment cleared by hand and nothing
re-enrolled. There is nothing to copy and nothing to prove in transit, so step 10
is rewritten below rather than left demanding rows that do not exist.

**5. The irreplaceable set moved, and the telemetry moved a great deal.**

| Table | Plan, 2026-09-10 | Today | Moving? |
| --- | --- | --- | --- |
| `eng_audit_events` | 477 | **485** | **No.** Newest 2026-09-13 16:27, zero in 24h |
| `eng_profiles` | 2 | 2 | No |
| `eng_leads` | 2 | 2 | No |
| `eng_applications` | 1 | 1 | No |
| `eng_role_grants` | 119 | **117** | No. 0040 deleted `files.assign` from two roles |
| `eng_cron_runs` | 10,460 | **17,469** | **YES, about 12 every ten minutes** |
| `eng_jobs` | 1,749 | 2,920 | **YES** |
| `eng_metrics_daily` | 81 | 145 | Daily |

**The tables that cannot be recreated are all static.** The tables that are
moving are the two the freeze does not currently stop, which is item 6.

**6. THE FREEZE DOES NOT STOP THE SCHEDULED WORKER, AND IT HAS TO.**

`vercel.json` declares three crons: `/api/cron/jobs` **every minute**,
`/api/cron/health-watch` every five, and `/api/cron/daily`. Between two queries
seconds apart, `eng_cron_runs` went 17,468 to 17,469.

Step 6 as written freezes "every public form and the intake API" and says nothing
about these. Left running, `eng_cron_runs` and `eng_jobs` grow throughout the
window and step 7's "every telemetry table's count" can never match.

**Operator ruling, 2026-09-14: the scheduled worker is STOPPED for the window,
rather than telemetry being excluded from the equality check.** The reason is in
the operator's words: an exclusion is a carve-out that will grow, and the freeze
is measured in minutes. **Disabling the crons is a Vercel dashboard change and is
therefore the operator's step**, not a deploy: removing them from `vercel.json`
would need a deploy to take effect and a second deploy to undo, inside the one
window where a deploy is least welcome.

---

### PHASE 0. THE DRY RUN. NOT OPTIONAL.

Operator ruling: the whole sequence runs against the dev project first, into a
second throwaway. Nothing in phase 1 begins until phase 0 is in a report.

| # | Step | Whose | Read-back before the next step |
| --- | --- | --- | --- |
| 0.1 | **T1 is `254engineering-rehearsal`, reused.** Operator approval 2026-09-14: nothing new is created and nothing new is billed | mine | The project is healthy and its `eng_` schema is empty before 0.2 |
| 0.2 | Replay **0000 to 0042** into T1 through `apply_migration` | mine | Shape `11a709155214441ec2b7c3b382f6e17f`/**1030**/75 tables, equal to production. Behaviour by the portable kinds and counts, per the 2026-09-11 finding |
| 0.3 | Create the five buckets, all private | mine | Five present, five private, limits and mime types per old step 3 |
| 0.4 | Dry run `copy-project.mjs` dev to T1, writing nothing | **BLOCKED ON THE OPERATOR.** See below | Per table counts it INTENDS to copy, compared to dev's own counts. Read the two defects under old steps 5 and 8 first: both let this script report success having done nothing |
| 0.5 | Copy dev to T1 for real | mine | Every table's row count equals dev's; `eng_profiles` uuids preserved; both fingerprints unchanged from 0.2 |
| 0.6 | Copy storage | mine | Object count and total bytes per bucket equal dev's, enumerated RECURSIVELY |
| 0.7 | Back up T1, **restore-to-new-project** into throwaway **T2** | mine, on your cost approval. **The operation EXISTS**, confirmed from the dashboard 2026-09-14 | Both fingerprints on T2 equal T1's, every row count equals T1's, **and the extension list is read back**, because extensions are on the dialog's not-transferred list and `gen_random_uuid()` is the default on nearly every key. **This is the step 15 mechanism, rehearsed** |
| 0.8 | Point a local build at T1 and complete an MFA challenge with a dev enrolment | **yours** to complete the challenge, mine to stand the build up | A code from your authenticator is accepted against T1 |
| 0.9 | Destroy T1 and T2 | mine | Both gone; the bill returns to its previous figure |
| 0.10 | **The dry run report** | mine | Every figure above, and what went wrong, in `docs/`. **GO/NO-GO is your word** |

**0.2 IS RECORDED AS DERIVED, NOT EXECUTED. Operator ruling, 2026-09-14.**

The chain was NOT re-replayed into T1. What was done instead, and it is stronger
than the execution would have been:

> The files at 0042 and production at 0042 agree on shape, columns and all 824
> facts from both ends, and the real engine replayed 49 of 49 faithfully tonight
> with transcription byte-verified.

`scripts/fingerprint-at.mjs 0042` gives `11a709155214441ec2b7c3b382f6e17f` across
1,030 columns and 824 facts from the FILES alone, and production read back the
same shape, the same 1,030 columns and the same 824 facts, with per-kind figures
fk 137, ck 100, pk 75, tg 58, fn 12, ix 243, rls 75, policy 0, 7 roles and 117
grants, and **zero unvalidated foreign keys**, which is the twelve fact carve-out
being gone confirmed from the data rather than from the ruling.

**WHAT IT DOES NOT PROVE.** That a real Supabase engine, replaying THIS chain at
THIS stopping point, produces that result. Tonight's real-engine proof ran 0000
to 0048, a superset, into `254engineering-rehearsal`; the shape fingerprint is
portable and was matched at six intermediate checkpoints, but 0042 specifically
was never applied to a live project and read back. The derivation rests on the
shape fingerprint being portable, which is stated in section 6b of CLAUDE.md and
confirmed repeatedly, rather than on an execution.

It is recorded this way rather than marked done because **saying so rather than
marking it done is the whole standard.** A step reported as executed when it was
derived is the completion claim this repository treats as the one unforgivable
failure.

If step 2 is ever in doubt on the day, this is the cheap way to settle it before
writing anything: run `fingerprint-at.mjs` at the chain's head and compare
against a live read of production. Both halves take a minute and neither writes.

---

**TWO BLOCKERS IN PHASE 0, BOTH FOUND BEFORE ANY STEP WAS SPENT REACHING THEM.**

**0.4 to 0.6 need T1's service role key, which I cannot obtain.**
`copy-project.mjs` takes `COPY_FROM_URL`, `COPY_FROM_KEY`, `COPY_TO_URL` and
`COPY_TO_KEY`, and both keys are service role. `.env.local` carries development's,
which covers the FROM side. There is no service role key for T1 anywhere I can
reach: the Supabase MCP exposes publishable and legacy anon keys only, and an
anon key cannot write past RLS with zero policies, which is every table in this
schema.

**Copying by hand through the MCP instead would defeat the point of phase 0.**
The dry run exists to exercise THAT SCRIPT, including the two defects recorded
under old steps 5 and 8 that let it report success having done nothing. A copy
performed a different way rehearses a mechanism the cutover will not use.

So 0.4 needs the operator to paste T1's service role key as an environment
variable for the command. It is a throwaway project rather than production, and
it is a secret either way: it goes in the environment of one invocation and is
never written to a file in this tree.

**0.7 IS PERFORMABLE AND WAS THE OPEN QUESTION. IT IS ANSWERED.** The Supabase
dashboard offers restore-to-new-project; the operator read the dialog on
2026-09-14. `restore_project` in the MCP takes a project id and nothing else,
which is why this was in doubt, and that was a fact about the tooling rather than
about the product. Cost is about $10.18 a month for the clone. **It still needs a
cost approval before anything is created, and it still stops for that.**

**What it does NOT bring, and the plan now depends on knowing this:** storage
objects, edge functions, auth settings and API keys, database extensions and
settings, read replicas. The extension exclusion is the one that bites, because
`gen_random_uuid()` is the default on nearly every `eng_` primary key.

---

### PHASE 1. THE CUTOVER.

| # | Step | Whose | Read-back before the next step |
| --- | --- | --- | --- |
| 1 | **Confirm both sisters** (old step 8b) | **yours** | Each in state A or state B, confirmed from that deployment's own configuration. What to look for is below |
| 2 | Replay **0000 to 0042** into `qmvcqvkywmkogxbyzsaz` | mine | **Plain equality with old production:** shape `11a709155214441ec2b7c3b382f6e17f`, 1,030 columns, 75 tables. The twelve fact carve-out is GONE, closed by 0039 and 0040. Behaviour by the portable kinds and counts |
| 3 | Verify the five buckets already there | mine | Five, private, limits per old step 3 |
| 4 | **Point in time recovery and leaked password protection** | **yours** (plan setting, possible cost) | PITR on, window recorded; the protection enabled |
| 5 | Dry run `copy-project.mjs` production to new, writing nothing | mine | Intended per table counts equal production's, including the 477 audit events |
| 6 | **FREEZE the write paths AND STOP THE THREE VERCEL CRONS** (old step 6) | **yours** | Every public form and the intake API refuse; a probe submission is refused; **and `eng_cron_runs` does not move across two reads a minute apart**, which is what proves the worker actually stopped |
| 7 | Copy | mine | **Every irreplaceable row, individually:** 2 profiles by uuid, 2 leads, 1 application, **485 audit events**, 7 roles, 117 grants. **No MFA enrolment and no recovery codes: production has none.** Plus every telemetry table's count, which is only meaningful because step 6 stopped the crons |
| 8 | Copy storage | mine | Recursive object count and bytes per bucket equal production's |
| 9 | **Back up the new project, restore into a throwaway, read it back** | mine, on your cost approval | Both fingerprints and **every irreplaceable row count** on the restored copy. **In the report before step 11.** The throwaway is then destroyed |
| 10 | **ENROL A SECOND FACTOR FRESH, AND TEST THE CODES** | **yours** | Operator ruling 2026-09-14: nothing to copy, nothing to prove in transit. You enrol against the NEW production, save the recovery codes, **and spend one code to confirm it works before the window closes.** The codes get tested this time |
| 11 | **FLIP.** Point the application at the new project (old step 9) | **yours** (Vercel env) | The deployed app reads the new project; `db-guard-audit` and `security-audit` against the deployment |
| 12 | Verify from outside (old step 10) | mine and yours | Sign in, open the portal, read the audit trail, see the 477 events |
| 13 | **UNFREEZE** (old step 11) | **yours** | A probe submission lands in the NEW project and nowhere else |
| 14 | ~~Merge Section 4; apply 0038 to 0041~~ **ALREADY DONE, 2026-09-11, and 0042 on 2026-09-13.** This step no longer exists | none | Nothing. The chain replayed at step 2 already includes all of them |
| 15 | Board on main | mine | 48 of 48, or the report says which is red and why |
| 16 | Thirty days, old tables untouched (old step 13) | both | Nothing |
| 17 | Drop the old tables (old step 14) | **yours**, separate act, own report | Nothing. There is no read-back because there is nothing left to read |

---

### THE TWO LINES THE OPERATOR ASKED TO HAVE NAMED

**After step 6, the old production is no longer written to.** The freeze is what
makes the copy at step 7 a copy of a still thing rather than a moving one. If
anything writes to old production after step 6, step 7's read-back is measuring
a database that changed underneath it and the sequence restarts from step 5.

**Rollback is clean up to and including step 12. It stops being clean at step
13, and stops existing at step 17.**

- **Through step 12**, rollback is one Vercel change: point back at old
  production, unfreeze, and nothing has been lost, because old production still
  holds everything and has received no writes since step 6.
- **After step 13**, the new project starts receiving writes that exist nowhere
  else. Rolling back after this means deciding what happens to them, which is a
  data merge and not a rollback. **This is the point of no easy return.**
- **After step 17**, there is no return at all. It is thirty days after the step
  that needed one, which is the whole reason for the gap.

---

### STEP 10, THE SECOND FACTOR, IN FULL

The operator's enrolment is encrypted at rest and the concern is exactly right.
What the code actually does, read rather than assumed:

`MFA_ENCRYPTION_KEY` is an **environment variable**, not database state.
`encryptionKey()` derives a 32 byte key as `sha256("eng-mfa-v1:" + secret)`, and
the ciphertext lives in `eng_mfa_enrolments`. So:

- **The key does not move with the database and does not need to.** The cutover
  changes `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and nothing else. If
  `MFA_ENCRYPTION_KEY` is left alone, the copied row decrypts.
- **The risk is not the key, it is the copy.** If the ciphertext is altered in
  transit, by an encoding change or a truncation, decryption fails and the
  failure looks exactly like a wrong code.
- **So the proof is a real challenge**, which is what the ruling asks for: after
  step 9 and before step 11 is called done, the operator completes an MFA
  challenge against the new production.
- **The recovery codes.** They are stored per `eng_mfa_recovery_codes`, 10 rows,
  and they are only as good as the rows that get copied. The operator's point
  stands exactly: the moment the old row is not the one being read, the codes
  the operator holds are worth whatever the new project's rows say. Step 7's
  read-back counts them individually for that reason.
- **If the challenge fails**, the plan says so rather than improvising: the
  operator re-enrols against the new production, the old enrolment row is left
  untouched on old production, and the report records that the codes held on
  paper are dead and new ones were issued.

---

### STEP 1, WHAT TO LOOK FOR IN EACH SISTER'S DEPLOYMENT

The operator confirms these. They are read from **that project's own deployment
configuration**, not from this repository and not from a `.env.local`.

**State A, moved to the intake API.** In that project's Vercel environment
variables, for the Production environment:

- `SUPABASE_URL` is **absent**
- `SUPABASE_SERVICE_ROLE_KEY` is **absent**
- some variable names the 254 intake endpoint, and the site's lead form posts
  there

**Deleted, not merely unused.** A credential that is present is a credential
something can still use, and the failure being prevented is a sister writing a
lead into a database nobody reads any more.

**State B, still writing Supabase directly.** Either variable is present. Then
that project's two variables move with 254's inside the same window at step 11,
and it is redeployed inside that window.

**What is already known from here and does not need confirming:** production's
two leads and one application all carry `site = '254'`, so neither sister has
ever written a row. State B carries no data risk today, only future writes,
which also means a mistake here stays invisible for exactly as long as the
sisters stay quiet.

---

## 1. What the rehearsal already proved

Run against `254engineering-rehearsal` in `us-east-1`.

> **THE SENTENCE THAT USED TO BE HERE SAID "since deleted", AND IT WAS FALSE.**
> Corrected 2026-09-14. The project `kmiwxtbtqrlorxfogtht` was still alive, still
> billable, and still holding rows eleven days after this document recorded it as
> deleted: 239 audit events, 2 order payments, 1 profile and 1 service order, at
> the schema of migration 0007.
>
> Nobody deleted it and nobody checked. The sentence was written in the same pass
> as the deletion was intended, which is the whole mechanism: a document records
> what somebody MEANT to do and then reads, forever, as a record of what happened.
>
> **THE RULE, and it belongs beside every destructive step in this plan: a
> document that records a destructive action as done is a claim nothing supports
> unless something checked.** Deleting, revoking, rotating and decommissioning are
> the four that matter here, because each one leaves something live and costing
> money when it silently does not happen, and each one reads identically on the
> page whether it happened or not.
>
> It was found by counting projects in the organisation against the documents that
> account for them, which is now a standing board check: see
> `scripts/project-accountability-audit.mjs`. That check exists because this
> sentence existed.

**AND THE REPLAY WAS RUN AGAIN, AGAINST A REAL ENGINE, ON 2026-09-14.** The table
below is the September 3 run at migration 0007. The whole chain was replayed into
the same project from an empty schema on 2026-09-14, all 49 migrations, and the
result is in section 1a.

| Question | Answer |
| --- | --- |
| Do the migration files rebuild the schema from nothing? | **Not before the repair.** `0001` line 387 was `as $` and line 399 was `$;`, a syntax error. Repaired in `766b069`. |
| Do they now? | Yes. Fingerprint `eac11d782d44bd11cb893637f67d2ee1`, 607 columns, 39 tables, 4 functions, 24 triggers, 117 indexes, RLS on all 39. Identical to development and production. |
| Can `auth.users` take a chosen uuid? | Yes, by direct insert. The admin API assigns its own, which is why this is SQL. |
| Does `eng_profiles` accept it as its primary key? | Yes. That key is referenced by more than thirty foreign keys. |
| Can an append only table take a bulk load? | Yes, 239 rows, immutable immediately afterwards. |
| Does the payment delete refusal survive? | Yes, and `ON DELETE RESTRICT` still prevents deleting an order that took money. |

**Not rehearsed, and stated rather than implied:** the transport of real rows
between two live projects. The rehearsal loaded synthetic rows of the same shape
and volume. What was being tested is the mechanism that could silently corrupt
identity, which is the uuid preservation, and that was tested exactly.

---

## 1a. The 2026-09-14 replay, and what it does NOT prove

Phase 14 rank 1. The `eng_` schema in `254engineering-rehearsal` was dropped
entirely and all 49 migrations, `0000` through `0048`, were replayed into it from
nothing through `apply_migration`, against **PostgreSQL 17.6 on a real Supabase
engine** rather than into PGlite, which is the only thing `migration-audit` has
ever been able to do.

**WHAT IT PROVES.** The files rebuild the whole schema from an empty database on
the engine production actually runs, and the result is the schema the ledger
declares:

| | Replay | Development | |
| --- | --- | --- | --- |
| Shape fingerprint | `f6e3d58df88f192dc1e7eaa1458858a7` | same | **match** |
| Columns / tables | 1,049 / 76 | same | **match** |
| Behaviour facts | 850 | 850 | **match** |
| `fk` `ck` `pk` `tg` `fn` `ix` `rls` `policy` | 141 106 76 61 16 249 76 0 | identical | **match** |
| Seeded roles / grants | 7 / 118 | identical, same digests | **match** |

Six intermediate checkpoints were read back against the figures recorded in
CLAUDE.md as the chain was replayed, and every one matched exactly: 0005, 0007,
0009-0010, 0018, 0020-0022 and 0027.

**The SQL that ran was the SQL in the files.** `schema_migrations.statements` was
read back for all 49 and compared against the files on disk, normalised for
whitespace and statement separators: 49 of 49 identical. That check is the reason
the result above can be trusted at all, because a replay performed by retyping is
a replay of whatever was retyped.

**THREE PER-KIND DIGESTS DIFFER FROM DEVELOPMENT AND NONE IS A SCHEMA
DIFFERENCE.** Each was chased to its cause rather than attributed to the known
non-portable list:

- **`fk`** One fact. Development carries
  `eng_responsible_charge_log_file_id_fkey` as NOT VALID because of the 28
  dangling rows 0039 documents; the replay validated it, because the table is
  empty. Hashing the 141 keys WITHOUT the validated flag gives
  `ddf30da3a7ab879b7e8656f8615e2632` on both sides, so every key agrees on table,
  name, columns and delete and update action.
- **`ck`** Compared by `pg_get_constraintdef` instead of `conbin`, both sides give
  `480c51351224be55d5e17f309aadb075` across all 106. The constraints are
  identical; `conbin` is not stable between two databases.
- **`fn`** Four of sixteen bodies. They are exactly the four whose bodies contain
  SQL comments: `eng_claim_jobs`, `eng_forbid_mutation_allow_cascade`,
  `eng_forbid_sealed_work_delete` and `eng_set_trade_price`. The replay stores
  them WITH their comments and development stores them stripped. Normalised for
  comments and whitespace all four hash identically on both sides.

**WHAT IT DOES NOT PROVE, AND THIS IS THE POINT OF PUTTING IT HERE.** It says
nothing whatever about recovering production's DATA. A migration chain rebuilds a
schema; it does not restore a row. The replayed project holds 7 roles and 118
grants, which the migrations seed, and **zero** profiles, audit events, orders,
payments, accounts and files.

**Supabase has no cross-project restore.** `restore_project` un-pauses a paused
project; a backup belongs to the project that made it. So "restore production
into a scratch project and read the rows back" is not an exercise this platform
can perform at all, and rank 1 could only ever be the schema half of it. The data
half is rank 2 and is blocked; see `docs/phase-14-surveys.md`.

---

## 2. Before step 1

- The operator confirms PITR state and price on the new project.
- The operator has the production service role key to hand. It stays in Vercel
  and in `.env.local`, never in the repository.
- A quiet window. The only live write paths are the waitlist and contact forms.
- `npm run audit` green on the branch, including `migration-audit`.

---

## 3. The sequence. SUPERSEDED AS AN ORDER, KEPT AS THE DETAIL.

**Do not follow the order below.** The ruled sequence is at the top of this
file, under "THE SEQUENCE AS RULED, 2026-09-10", and it changed three things
this section cannot know: which steps are the operator's, where the restore
proof sits, and that the dry run into a throwaway is not optional.

What is kept here is the DETAIL of each step, which is still correct and is
referenced by number from the ruled sequence: what a step does, what it verifies
and what its rollback is. Two of them, old step 5 and old step 8, carry defects
found in the 2026-09-07 dry run that let `copy-project.mjs` report success
having copied nothing, and those must be read before it is run.

Every step names what to do if it goes wrong. Steps 1 to 6 are reversible by
doing nothing, because production is untouched throughout.

### Step 1. Create the project. DONE.

Create `254engineering-prod` in `us-east-1`. $10 per month, on the Pro
organisation.

**Done 2026-09-04. The ref is `qmvcqvkywmkogxbyzsaz`**, us-east-1, healthy.

**Verified empty before step 2 rather than assumed**, on 2026-09-07: zero tables
in `public`, zero storage buckets, zero rows in `auth.users`. That check is
worth running rather than trusting the creation date, because a half replayed
schema from an abandoned attempt is the one starting state that would make every
verification below ambiguous.

**Rollback:** delete the project. Production is untouched.

### Step 2. Replay the migrations. NOW EIGHTEEN SHORT.

**0000 through 0023 are applied and verified.** That was true on 2026-09-07 and
is still true.

**It is no longer step 2 being done.** The repository is at **0041**, so
**0024 through 0041 replay next, in order, eighteen files.** A session reading
the old "Step 2 is DONE" line and moving to step 3 would build a schema
eighteen migrations behind the code and find out at step 10, which is exactly
the failure the same line already caused once when it said 0000 through 0008.

What the eighteen carry, so the number means something: the second factor,
marketing suppressions, reporting foundations, the demo flag and its check
constraint, bulk order columns, deletion requests, partner addresses, the job
effect mode, four foreign keys, the eight indexes production always had, and
0041's firm registration column.

**Apply them through `apply_migration`, never `execute_sql`.** CLAUDE.md section
6b, operator ruling 2026-09-09: `apply_migration` writes a row into
`supabase_migrations.schema_migrations` and `execute_sql` changes the database
and writes nothing. A chain applied the second way is present in the schema and
absent from the provider's history, which is what makes 0025 the one
grandfathered case and not a precedent.

**Verify, after 0041:**

| | Expected |
| --- | --- |
| Shape fingerprint | `1a11138f01f9be2f66251640cfb55b70` |
| Columns | **1017** |
| Behaviour fingerprint | `7acbb5b22f11220b4a36f535fab9e09c` |
| Behaviour facts | **814** |

Both figures come from `supabase/applied.mjs`'s 0041 entry and are asserted
against a scratch replay by `migration-audit` on every suite run, so a mismatch
here means the PROJECT rather than the files.

**Two fingerprints and not one, and the second is the one that matters here.**
The shape figure sees columns. It cannot see a constraint, a trigger, a
function, an index, a policy or a seeded row, and this chain adds all six. 0039
alone adds four foreign keys of which one is `NOT VALID` on development because
28 rows predate it; a project where all four validated would have an identical
SHAPE and a different BEHAVIOUR, and only the second figure would say so.

**And the row counts, which no fingerprint can see:** 7 roles and the grants
0018 and 0021 seed. Production carries 119 grant rows against the 111 the
migrations seed, and 0040 deletes the two `files.assign` rows; reconcile the
number on the new project against the migrations rather than against production,
because production's extra rows are what 0040 exists to explain.

**The query, which is the same one CLAUDE.md section 6b carries:**

    select md5(string_agg(sig, '|' order by sig)), count(*)
    from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
          from information_schema.columns
          where table_schema='public' and table_name like 'eng\_%') t;

**Rollback:** delete the project and start again. Production is untouched.
### Step 3. Create the buckets

`eng-evidence`, `eng-onboarding`, `eng-uploads`, `eng-messages`,
`eng-partner-assets`. All private. `eng-evidence` carries the size limit and
mime types 0002 sets. `eng-messages` carries 20MB and the image and pdf types
the composer accepts.

**`eng-messages` is the fourth and was added 2026-09-05**, in Phase 11 Section 3.
It holds attachments sent in a conversation, and it is deliberately NOT
`eng-evidence`: the reasoning is in `docs/messaging-section-3.md` section 8, and
it comes down to an engineer sealing a package never certifying a review of
something that was never presented as an evidence item.

**`eng-partner-assets` is the fifth and was added 2026-09-05**, in Phase 9
Section 5. It holds the one pagers and artwork the firm publishes for partners
to use.

It is PRIVATE, and that is worth a sentence because it is the one bucket whose
contents are meant to be handed out. A partner reaches a file through a ten
minute signed url issued to their session, so the firm can withdraw an asset and
have that mean something. A public bucket would mean every one pager the firm
ever published stays retrievable by url forever, including the version it
withdrew, which is the opposite of what withdrawing is for.

**All five are needed before step 9**, and the count is part of the
verification rather than a note: a bucket that does not exist fails at the
moment somebody uploads to it, which is long after this window closes.

**Verify:** five buckets, `public = false` on every one. A public evidence or
messages bucket would expose property photographs, so this is checked rather
than assumed. Check it two ways, because the column and the behaviour are
different claims:

    select name, public from storage.buckets where name like eng-%;

    curl -o /dev/null -w "%{http_code}"       https://<ref>.supabase.co/storage/v1/object/public/eng-messages/probe.jpg

The first must show five rows and no `true`. The second must not be 200, and it
needs no credentials, which is what makes it worth running: it is the request an
outsider would make.

**And the round trip, which the column cannot tell you.**
`scripts/bucket-roundtrip.mjs` uploads an object, confirms the public form
refuses it, retrieves it through a signed url, checks the bytes match, watches a
one second url work and then lapse, and deletes what it made. It carries
`neverProduction`, so on the new project it runs before the cutover points
anything at it, while that project is still the development target.

**Rollback:** delete the project. Production is untouched.

### Step 4. Enable leaked password protection

Operator, in the dashboard, on the new project. Not available to this session.

**Rollback:** none needed; it is a toggle.

### Step 5. Dry run the copy, writing nothing

Run the copy script in read only mode against both projects. It reports the row
count per table it would move and the storage objects it would move.

**A read only dry run was done on 2026-09-07 over MCP rather than with the
script**, because the script needs both service role keys in the environment and
neither belongs in a session transcript. It read production directly. What it
found is below, and both findings are the same shape: a list that was correct
when it was written, and that a later change moved the target of.

**FINDING 1. Three tables with rows on production are in no copy list at all.**

| Table | Rows on production | In `TABLES`? |
| --- | --- | --- |
| `eng_jobs` | 853 | No |
| `eng_cron_runs` | 5,101 | No |
| `eng_metrics_daily` | 39 | No |

`copy-project.mjs`'s `TABLES` list was written for the eleven tables that
existed when this plan was. All three of these arrived in 0011 and 0012, after
it, and nothing noticed the list had stopped describing the database.

Two of them are the telemetry class CLAUDE.md section 6b already names as
deliberately not append only and meant to be pruned, so losing their history at
a cutover is defensible. **What is not defensible is that it would happen
without anybody deciding it**, and `eng_jobs` is not in that class while it
holds live work: a pending or running row at the copy moment is scheduled work
that silently never runs, with no error and no gap in a sequence.

The queue held zero pending and zero running rows when this was first measured,
and that was recorded as **a fact about that minute rather than a property of
the plan**. Forty minutes later it held one: job 863, kind `errors.alert`,
pending.

**That job was reported here as an alert about a fault that had not been sent,
and that was wrong.** It was inferred from the job's NAME rather than read from
the database, which is the exact defect this repository hunts, committed inside
a note about that defect. The correction, from production on 2026-09-07:

- **Nothing had faulted.** `eng_error_types` and `eng_error_events` both hold
  **zero rows**, and always have.
- **`errors.alert` is a periodic no-op sweep**, enqueued unconditionally every
  five minutes by the health-watch cron. It reads the error types and decides
  whether to email; with none, it does nothing. The handler's own comment says
  it plainly: putting it on the minutely worker "would write 1440 rows a day to
  say nothing 1439 times".
- **The job was not stuck.** Enqueued 16:35:24, started 16:36:08, finished
  16:36:09, one attempt, no error. It is `done`.
- **The worker is healthy.** In the two hours around that reading the `jobs`
  cron ran 120 times, one a minute, 120 ok and none failed or unreported, and
  all 864 jobs on production are `done` with none dead.

What I had caught was the ordinary forty five second gap between a job being
enqueued and the next minutely tick collecting it, which is what a working queue
looks like at any given instant rather than a symptom of anything.

**The stop condition stays, and its real justification is forward looking.**
Production's queue today holds exactly two kinds, `errors.alert` and
`metrics.rollup`, both periodic sweeps that reschedule themselves and both
harmless to lose: the next tick does the work again. So dropping one today costs
nothing, and that is a fact about how little this platform currently does rather
than a property of the queue.

The jobs that will be in it once the firm is taking orders are the ones that
matter: an email to a customer, a statement close, a payment reconciliation.
Those do not come round again five minutes later. **A stop condition that is
only added once the expensive jobs exist is a stop condition added after the
window it was needed for**, so it is built now, while the cost of it firing is
a one minute wait.

`copy-project.mjs` reads the queue before it writes anything, names the kinds
it found, and refuses. The correct response to it firing is to wait, never to
force it.

**FIXED 2026-09-07, on the operator's instruction**, rather than deferred with
the cutover: a copy script that reports agreement while copying nothing will be
trusted the day it runs for real.

All three are now copied. **One correction to the first report of this
finding**, because the tidy sentence in it was wrong: it said all three are
`bigserial` keyed. `eng_metrics_daily` is not. Its primary key is
`(day, metric)`, which makes it naturally idempotent and needs no sequence at
all. Only `eng_jobs` and `eng_cron_runs` carry one, verified against
`pg_get_serial_sequence` rather than read off the migration.

**The sequences are the part the script cannot finish.** PostgREST cannot run
`setval`, so `--apply` prints the exact statements and **exits non-zero** with
the copy declared unfinished. That is deliberate: a destination whose sequence
sits at 1 while its table holds 863 rows fails on the first job written after
the cutover, and a script that returned success here would have made that
somebody else's surprise at step 10.

**And the generalised fix, which is worth more than the three tables.** The
script now runs a completeness check before it writes anything. It reads the
table names out of `supabase/migrations/` **on disk**, asks the source which of
them hold rows, and requires every one to be either in the copy list or named in
a `NOT_COPIED` map with a stated reason. A table added by a future migration is
a candidate the moment it exists rather than when somebody remembers this file.

Today that check declares 16 tables and probes the other 53. All 53 are empty on
production, so it passes, and it stops the run the moment any of them is not.

**Verify:** the counts are read from the source AT COPY TIME and compared to what
the copy would write. They are not compared to a figure recorded earlier.

Operator amendment, 2026-09-03: the 244 row figure in section 1 of the decision
document is already stale, because `eng_audit_events` grows on every production
touch including the operator's own sign ins, and it can never shrink. A check
asserting a number written down yesterday would fail for the most ordinary
reason there is, and worse, it would pass if the source had somehow shrunk to
match. The count has one meaning: source and destination agree, now.

**Rollback:** none needed; nothing was written.

### Step 6. Freeze the write paths

Put the waitlist and contact forms into maintenance, or accept a window in which
a submission fails visibly. `forms-audit` guarantees it fails visibly rather than
silently, which is why accepting the window is defensible.

**Rollback:** unfreeze. Production is untouched and still serving.

---

**Everything above this line leaves production exactly as it was. Everything
below writes to the new project, and step 9 is the first step that changes what
customers reach.**

---

### Step 7. Copy

In dependency order: `eng_leads`, `eng_applications`, then the auth user by
direct insert with its original uuid, then `auth.identities`, then
`eng_profiles`, then `eng_auth_tokens`, then `eng_audit_events`.

The password hash is **not** copied. A set-password link is issued in step 12.

**Verify:** row count per table equals production, and the set of
`eng_audit_events` ids in the new project equals the set in production. The audit
trail is the one table where a missing row is a regulatory problem, so it is
compared by id rather than by count.

**Rollback:** delete every row from the new project and repeat. The new project
is not serving anything yet, and production has not been read destructively:
every read is a `select`.

### Step 8. Copy storage

The 2 objects in `eng-uploads`. Download from the old, upload to the new, at the
same keys.

**FINDING 2, and it is the worse of the two: the script cannot see either
object, and reports agreement anyway.**

`copy-project.mjs` enumerates a bucket with `list("", { limit: 1000 })`.
Supabase's list is **not recursive**: it returns the entries at that prefix, and
a nested object appears only as its top folder, which arrives with `id: null`.
The script's very next line is `.filter((f) => f.id !== null)`, which removes it.

Production's two objects sit at `254/<uuid>/resume-*.pdf`, three levels down. So
the enumeration finds zero files, `--apply` copies nothing, and the verification
then compares zero against zero and prints **agree**. Step 8's green would mean
the resumes stayed behind.

**Proven rather than reasoned**, on development on 2026-09-07, by uploading one
object at production's exact nesting, making the same call the script makes, and
reading what came back:

    list("") returned 1 entries:
        "254" id = null (a folder)
    after the script's .filter(f => f.id !== null): 0 file(s) to copy

The probe object was removed and its removal verified.

**Two smaller things in the same list.** `BUCKETS` names three of the five, so
`eng-messages` and `eng-partner-assets` are absent; both are empty on production
today, which makes this the same defect with nothing behind it yet. And
`limit: 1000` has no pagination behind it, which truncates in silence.

**FIXED 2026-09-07, on the operator's instruction.**

The walk now lives in `scripts/lib/bucket-walk.mjs` rather than inside this
script, for a reason the defect itself demonstrates: a function a whole step
depends on, buried in a script that cannot be imported because it exits on load,
is a function nothing can test. It descends into folders and it paginates, and
the old six lines are kept beside it as `walkBucketTheOldWay` so a test can
show the difference rather than describe it.

**Proven on development**, with four objects at production's exact nesting:

    THE OLD ENUMERATION
      found none of the nested objects (it returned 1 entry, and none of the 3 nested keys)
      but did find the one at the root
    THE NEW WALK
      finds all three, three levels down
      and still finds the one at the root
      sees strictly more than the old one (4 against 1)

Running both over the same bucket in the same run is the point. Asserting only
the new behaviour would prove the new behaviour and say nothing about whether
the old one was actually broken.

**The count comparison is gone as the primary evidence.** Every object is
downloaded from both sides and compared byte for byte, because a count
comparison was what printed "agree" while nothing had been copied: both sides of
it came from the same blind instrument. There are two objects today; when there
are thousands this becomes a sample, and the plan says so rather than letting it
change quietly.

**And a canary.** A walk that finds nothing in any bucket says so out loud
instead of reading as agreement, which is exactly the state the old code
produced.

`eng-messages` and `eng-partner-assets` are in the bucket list now.

**Verify:** object count and byte size match per bucket, and one object is
downloaded from the new project and compared byte for byte. **Read the count
from `storage.objects`, not from what `list` returned**, or the check is the
same instrument twice.

**Rollback:** delete the objects and repeat.

### Step 8c. The copy script has never been executed, against anything

**Recorded 2026-09-07 and not resolved, because it cannot be resolved from a
session.** `copy-project.mjs` takes two projects explicitly and refuses to run
when they are the same one. The only service role key in the working tree is
development's, and both of the others, production's and the new project's, live
in Vercel and in the operator's records by standing law.

So no session can exercise this script end to end, and none has. Its parts are
verified: the bucket walk against development with production's nesting, the
completeness check's migration parsing against the files on disk, and the row
counts read directly from production over a read only connection. **The whole
has never run.**

That is not an argument for putting a key in the tree. It is an argument for the
operator running the dry run themselves, in an environment that already holds
both keys, before the window opens, and for treating the first `--apply` as the
second time the script has run rather than the first.

### Step 8b. Resolve the sister brands. THIS BLOCKS STEP 9.

Operator amendment, 2026-09-03, and it was the right call: this was originally
placed before step 14, on the reasoning that dropping the old tables is what
would break the sisters. That reasoning was wrong. The damage happens at step 9.

**What was found, by reading the two repositories and the live tables:**

| | Writes | Portal | Points at |
| --- | --- | --- | --- |
| stampmyplans | `eng_leads`, `eng_orders` | none | `fsaryeciduszuahgjbly`, confirmed in its `.env.local` |
| sealedengineering | `eng_leads`, `eng_orders` | none | unknown from here; its deployed value is in its own Vercel project |

**And the part that makes it a blocker.** 254's portal reads leads and
applications with NO SITE FILTER. Verified by reading the queries, not by
grepping around them:

- `listLeads()` in `src/lib/admin-data.ts` selects `site` and never filters on it
- `listApplications()` in the same file does the same
- the lead conversion inbox in `src/app/portal/(app)/clients/page.tsx` filters
  only on `status`, and its own comment says the leads "have been here since the
  sites launched"

254's portal is deliberately the shared inbox for all three brands. Cut over 254
alone and the sisters keep writing to the old project while the only screen
anybody opens reads the new one. No error, no gap in a sequence, nothing to
notice, and it surfaces as a customer who was never called back.

**One fact that makes the fix cheap:** every row in every shared table carries
`site = '254'`. The sisters have written zero rows to date. There is no data to
move, only future writes to redirect.

**ANSWERED 2026-09-07, and the answer is option three.** Operator ruling: the
sisters post to an intake API rather than writing Supabase. It is built,
`/api/intake/lead`, documented in `docs/sister-intake-api.md`, asserted by
`sister-intake-audit` in the suite, and both sibling briefs carry what each
repository has to do.


**WHAT REMAINS, 2026-09-10, and it is confirmation rather than construction.**

The intake API is built and on the board. What is NOT known from this repository
is the state of the two sibling DEPLOYMENTS, and the plan's own instruction
stands: **ask, do not assume.** Each sister's deployed values live in its own
Vercel project and are not readable from here.

**For each sister, confirm ONE of these two states before step 9:**

| State | What it means for the window |
| --- | --- |
| **A. Moved to the intake API.** It POSTs to `/api/intake/lead` and its `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are DELETED from its Vercel project. | It is not part of this window at all. Nothing to move, nothing to redeploy. |
| **B. Still writing Supabase directly.** | Its two environment variables move with 254's in the same window, and it is redeployed inside it. |

**Deleted, not merely unused.** A credential that is still present is a
credential something can still use, and the failure this step exists to prevent
is a sister writing a lead into the abandoned project where nobody reads it. If
the answer is "it does not use them any more", the check is whether they are
GONE.

**What can be confirmed from here, and it is not much:** production holds two
leads and one application, and every one carries `site = '254'`. **Neither
sister has ever written a row.** That is worth knowing because it means state B
carries no data risk at all today, only future writes, and it means a mistake
here would be invisible for exactly as long as the sisters stay quiet.

**What the sibling repositories have to do, and where it is written:**
`docs/brief-sealedengineering.md` and `docs/brief-stampmyplans.md` each carry
their side. Those two files are also the only route: the sibling repositories
are not touched from here, ever, by the operator's ruling of 2026-09-10. Both
briefs now open with the firm registration, which is a separate matter from this
step and is stated there so a session opening either file meets both.

**Rollback:** not applicable. This step is a decision and a verification, not a
change. Step 9 does not begin until both sisters are in a known state.

The original options are kept below, because the reasoning for rejecting the
other two is what makes the third one right rather than merely chosen.

**The options, as they were put to the operator:**

1. **Move all three in the same window.** Recommended. The sisters have no
   portal, no auth, no storage and no rows; each is two environment variables
   and a redeploy. The single inbox survives.
2. **Leave the sisters on the old project.** Rejected: 254 would need a second
   client pointed at the wattsmith project to read its own inbox, which defeats
   the entire purpose of the migration.
3. **Have the sisters POST to a 254 intake API** rather than writing Supabase
   directly. The better architecture, and it removes the shared table coupling
   permanently. It is new work, not a cutover step, and should not be folded
   into this window.

**Rollback:** not applicable. This step is a decision and a verification, not a
change. Step 9 does not begin until it is answered.

### Step 9. Point the application at the new project

On the branch: update `PRODUCTION_REF` and `PRODUCTION_EXPECTED_REF` in
`src/lib/db-guard.ts`, `PRODUCTION_REF` in `scripts/lib/db-target.mjs`, the
assertions in `scripts/db-guard-audit.mjs`, and the table in CLAUDE.md section
6b. Run the suite. Merge to main.

Then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the Vercel Production
scope to the new project, and redeploy.

**This is the first irreversible-feeling step, and it is not actually
irreversible:** the old project still holds every row, untouched.

**A deployment's environment is snapshotted at creation.** Setting the variables
without redeploying changes nothing, and redeploying before merging serves the
old code against the new database, which `productionPointingElsewhere` will
refuse. Merge first, then set, then redeploy.

**Rollback:** restore the two Vercel variables to the old project and redeploy,
then revert the merge. Recovery time is one deploy. Any row written to the new
project between step 9 and the rollback would be lost, which is why step 10
follows immediately.

### Step 10. Verify from outside

- `/api/portal/health` returns `{"ok":true}`
- `/portal/login` renders the form, not the mispointed explanation, which proves
  `productionPointingElsewhere` is satisfied by the new ref
- `/order/start/roof-inspections` still renders the prelaunch refusal
- `BASE_URL=https://254engineering.com npx tsx scripts/security-audit.mjs` passes
- the operator signs in, and **that sign in appears in the NEW project's audit
  trail with the old project's count unchanged at 239**

That last one is the evidence test. It is the same one that caught production
pointing at development on 2026-09-03, and it is the only check here that cannot
be satisfied by a deployment talking to the wrong database.

**Rollback:** as step 9.

### Step 11. Unfreeze

Restore the forms.

**Rollback:** as step 9.

### Step 12. Issue a set-password link

The operator's password was not copied. Mint a `reset_password` token in the new
project and confirm the link opens and names the right person and role.

**Rollback:** as step 9.

### Step 13. Leave the old tables alone for thirty days

Do not drop the `eng_` tables in the `wattsmith` project. They are the rollback,
and they cost nothing.

**Rollback:** the whole cutover, by restoring two Vercel variables and reverting
one merge.

### Step 14. Drop the old tables

Only after thirty days, only on the operator's word, and as a separate
deliberate act with its own report. This is the step that has no rollback, which
is why it is thirty days away from the one that needed it.

---

### Step 15. THE RESTORE PATH. Added 2026-09-10, and it is the reason for the whole reopening.

The operator's words when reopening this plan were "the firm can now take money
and has no restore path". The original sequence ended at step 14 and never
built one, so a cutover run exactly as written would have moved the firm onto a
new database with the same gap it started with.

**A migration is not a backup.** Everything above moves the rows. None of it
answers what happens when somebody deletes the wrong thing on a Tuesday.

Three separate things, and they are not interchangeable:

1. **Point in time recovery.** Confirm it is enabled on the new project and know
   the window. Supabase's free tier does not carry PITR, so this is a plan
   setting and possibly a cost, and the answer "we have daily backups" is not the
   same answer.

2. **A backup that leaves the provider.** A restore path that depends on the
   provider being reachable is not a restore path for the case where the
   provider is the problem. The smallest honest version is a scheduled dump of
   the `eng_` schema to storage the firm controls.

3. **A REHEARSED restore.** Untested backups are the oldest failure in this
   business. Restore into a scratch project and compare the shape fingerprint,
   the behaviour fingerprint and the row counts, the same three figures step 2
   and step 10 use. This repository already believes that: `migration-audit`
   exists because comparing two live projects to each other could never catch
   both of them being wrong.

**What makes it urgent rather than tidy:** `eng_audit_events` refuses DELETE by
design and holds 477 rows spanning 2026-09-02 to 2026-09-10. It is the one table
where a bad restore cannot be corrected by re-importing, because a second import
would double every row rather than replace it. The firm's regulatory memory has
exactly one copy today.

**This step does not block steps 1 to 14** and must not be used to delay them.
It is written here because the plan is what the next session reads, and a plan
that ends at step 14 is a plan that says the job is finished when the thing that
prompted it is still missing.

---

#### POINT 3 IS REAL. THE OPERATION EXISTS, AND THE OPERATOR READ THE DIALOG.

**Confirmed 2026-09-14, from the Supabase dashboard's own restore-to-new-project
dialog, read before cancelling.** An earlier version of this section said the
operation might not exist, because `restore_project` in the tooling this platform
is driven by takes a project id and nothing else. That was true of the MCP and
false of the product. The alternative wording is deleted rather than left
hedging, because a plan that offers two futures is a plan nobody can act on.

**What restore-to-new-project transfers:** the database schema, all data and
indexes, database roles, permissions and users. Organisation and region are
unchanged, `us-west-2`. The new project starts at the same compute with 1.5x
disk, at about **$10.18 a month**.

**What it explicitly does NOT transfer, listed by the dialog as needing manual
reconfiguration:** storage objects and settings, edge functions, auth settings
and API keys, database extensions and settings, read replicas.

**So step 15 point 3 is performable**: clone production into a throwaway, read
both fingerprints and every irreplaceable row against it, destroy it. That is the
rehearsed restore this plan has always asked for and never had, and it costs one
operation and about ten dollars.

**TWO THINGS THE DIALOG'S EXCLUSION LIST MAKES LOAD BEARING, and neither is
hypothetical.**

**Extensions are not transferred.** Production runs `pgcrypto`, `uuid-ossp`,
`pg_stat_statements` and `supabase_vault`. `gen_random_uuid()` is the default on
nearly every `eng_` primary key in this schema. A restored project whose
extensions did not come with it is a project where inserts fail, and the failure
would appear at the first write rather than at the restore. **Verify the
extension list on any clone before believing a single row count from it.**

**Storage objects are not transferred, and separately the backups page states
storage objects are not in database backups at all.** That is a larger finding
than this plan and it is written up in `docs/disaster-recovery.md`, ranked in
Phase 14. In short: the evidence behind a sealed engineering document is a
storage object, and today nothing backs one up and nothing could restore one.

**What is NOT in doubt** is the schema half. Phase 14 rank 1 replayed all 49
migrations from nothing into a real PostgreSQL 17.6 Supabase engine on
2026-09-14 and matched the ledger exactly, so rebuilding the SHAPE from files is
proven. Rebuilding the ROWS is now performable and still unproven, which is
exactly what step 15 point 3 exists to close.

---

## 4. What would make me stop mid sequence

- The fingerprint at step 2 not matching.
- Any bucket at step 3 reading `public = true`.
- Row counts at step 5 or step 7 differing from production by any amount.
- Any `eng_audit_events` id present in one project and not the other.
- `/portal/login` at step 10 rendering the guard explanation rather than the
  form, which would mean the ref constants and the environment disagree.

In every one of those cases the correct action is the step's own rollback, and a
report, rather than pressing on.

## 5. What this plan does not cover

**The three sister brands.** `sealedengineering` and `stampmyplans` do not read
this database today. If they ever wrote to `eng_orders`, the legacy table, that
question is open in `BACKLOG.md` and must be answered before step 14, not before
step 1: dropping the old tables is what would break them, not moving this
firm's.
