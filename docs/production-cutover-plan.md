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

> **DECISION A: does the old production get 0038 through 0041 at all?**
>
> Gate 2's ruling 6 was merge, push, then 0038 through 0040 to production in
> order. That ruling predates this one. Applying four migrations to a database
> that is about to be abandoned is work and risk spent on a target with a
> fortnight to live, and the alternative is to replay 0024 through 0041 into the
> new project and merge afterwards.
>
> **What I would do:** skip them on the old project. Replay the full chain into
> the new one, cut over, then merge and let `production-schema-check` verify the
> new target. The only thing the old project has to do between now and step 14 is
> keep serving what it already serves, which needs no new migration.
>
> **Why it is not mine to decide:** it reorders a standing ruling, and the merge
> is what makes the deployed code and the schema agree. Getting that order wrong
> is the 0023 incident again, in the other direction.

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

## 1. What the rehearsal already proved

Run against `254engineering-rehearsal` in `us-east-1`, since deleted.

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

## 2. Before step 1

- The operator confirms PITR state and price on the new project.
- The operator has the production service role key to hand. It stays in Vercel
  and in `.env.local`, never in the repository.
- A quiet window. The only live write paths are the waitlist and contact forms.
- `npm run audit` green on the branch, including `migration-audit`.

---

## 3. The sequence

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
