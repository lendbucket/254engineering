# Disaster recovery: a report, because it cannot yet be a test

**Phase 12 Section 5. Written 2026-09-07.**

Operator ruling, the same day: this section becomes a report rather than a test
until the database cutover happens, and the report says plainly what the firm's
restore position actually is.

**The headline, stated first because everything below is the reasoning for it:
the firm has no usable restore path today.** Not a weak one, not an untested
one. There is a mechanism, it belongs to somebody else's blast radius, and using
it would damage four other applications.

---

## 1. Why this cannot be tested

Point in time recovery rewinds a **project**. It is not per table, not per
schema, and not per row: it restores the whole database to a moment and
discards everything after it.

This firm's production data lives in `fsaryeciduszuahgjbly`, the project named
`wattsmith`, and that project is shared. Reading `pg_tables` on it on
2026-09-07:

| Prefix | Tables | Whose |
| --- | --- | --- |
| `eng_` | 68 | This firm |
| `os_` | 16 | Another application |
| `pricebook_` | 11 | Another application |
| `job_` | 3 | Another application |
| `craftline_` | 2 | Another application |
| a long tail of singletons | 14 | `offers`, `vendors`, `waitlist`, `estimates`, `subscribers`, and others |

Forty two tables that are not this firm's, in four recognisable application
families plus loose tables older than any of them. Storage tells the same story:
alongside the five `eng-` buckets sit `applications`, `coyoteville-media` with
125 objects, `coyoteville-permits` with 32, `personnel`, `resumes`,
`pricebook-photos` and more. And `auth.users` holds 8 accounts, of which
**2 belong to this firm**; the other 6 sign into applications this repository
has never heard of.

So a restore drill is not a drill. **Testing the restore means restoring, and
restoring means rewinding four other applications to a moment this firm chose,
silently discarding whatever they wrote in between.** There is no rehearsal
form of that action which leaves the other tenants untouched, because the unit
of recovery is the thing they share.

That is the whole reason this section is a report. It is not that the test is
hard, or slow, or waiting on tooling. It is that performing it would be a
destructive act against systems that did not consent to it.

---

## 2. What the firm actually has today

**A mechanism it must not use.** Supabase's backups and point in time recovery
exist on the project, and their exact retention and price were not read from
here: the dashboard is the operator's. Whatever the answer, section 1 applies.
A restore path that cannot be exercised without harming four neighbours is not
a restore path this firm can rely on, and the honest way to say that is that it
does not have one.

**No export of its own.** There is no backup script in `scripts/`, no export
job among the three registered crons (`health-watch`, `jobs`, `daily`), and
nothing writes this firm's rows anywhere outside that project. This was checked
rather than assumed.

**So the concrete position.** If somebody drops `eng_audit_events` tomorrow, or
a bad migration truncates `eng_leads`, the firm's options are:

1. Ask the operator of the shared project to rewind it, damaging the others.
2. Reconstruct from whatever happens to exist elsewhere, which for most tables
   is nothing.

Neither is a recovery procedure. **Option 1 is the only mechanism, and it is
one the firm should not take.**

> **AMENDED 2026-09-10.** Point in time recovery is now enabled on the shared
> project. Option 1 is still the only mechanism and is still one the firm cannot
> take alone, but there is now a moment to go back to. Read section 2a for what
> that does and does not buy: it restores all five apps or none.

---

## 2a. THE STOPGAP: POINT IN TIME RECOVERY, ENABLED 2026-09-10

**Operator ruling and operator action, the day TBPELS issued F-29811.** Point in
time recovery is enabled on the shared project. It is recorded here as a
STOPGAP, with its limit stated, because a restore path recorded without its
limit is worse than none: somebody reads it in an incident and believes they
have something they do not.

### What it changes

Section 2 above said the firm has no mechanism at all and that the only one
available was asking the operator of the shared project to rewind it. That is
now wrong in one direction and still right in the other. **The firm now has a
mechanism.** What it does not have is one it can use alone.

### THE LIMIT, AND IT IS THE WHOLE OF WHY THIS IS A STOPGAP

**It restores all five apps or none.**

The recovery is a property of the PROJECT, not of a schema and not of a table.
`fsaryeciduszuahgjbly` is shared with unrelated applications, which is the
reason every table this firm owns is `eng_` prefixed in the first place. A
rewind to recover `eng_audit_events` takes the other four applications back to
the same moment, discarding whatever they did in between, and none of their
operators asked for that.

So the decision to use it is never this firm's alone. In an incident the
sequence is: establish what was lost, establish the window, and then ASK, with
the cost to four neighbours on the table. **Section 1's argument stands
unchanged.** What has changed is that the answer to "is there anything to ask
for" is now yes.

### What it does NOT close, stated so nobody reads this as done

- **It is not a backup that leaves the provider.** If the provider is the
  problem, this is not a path. Nothing this firm owns is written outside that
  project, which section 2 already says and which is still true.
- **It has never been exercised.** An untested restore is a belief. The cutover
  plan's step 9 is where a restore gets rehearsed and read back, and that plan
  is deferred, so this remains a belief until then.
- **It does not make a per-table recovery possible.** There is no path that
  restores `eng_leads` and leaves the neighbours alone.
- **The window was not read from here.** The dashboard is the operator's. The
  retention window and its cost are theirs to state, and this file deliberately
  does not guess at a number that an incident would be planned around.

### Why this is recorded rather than celebrated

The reason the cutover exists is that this firm's data sits in a project it does
not control, and enabling recovery on that project does not move it. It buys the
one thing that mattered most on the day the firm became able to take money:
**there is now a moment to go back to, and before today there was not.** That is
a genuine improvement and it is not the fix.

The fix is the cutover, and after it, step 15 of
`docs/production-cutover-plan.md`: recovery on a project this firm owns, a
backup that leaves the provider, and a restore rehearsed and read back rather
than assumed.

---

## 3. What makes this smaller than it sounds, and what does not

**Smaller.** The volume at risk today is genuinely tiny: 2 leads, 1
application, 2 profiles, 2 auth users, 2 stored resumes, and 468 audit events.
A total loss would be recoverable by hand from email in an afternoon, for
everything except one table.

**Not smaller, and it is the one that matters.** `eng_audit_events` is the
firm's regulatory memory. It refuses UPDATE and DELETE by design, which
protects it from every ordinary mistake and from none of the ones this section
is about: a project level rewind does not go through the trigger. Those 468
rows cannot be reconstructed from anywhere, because their whole value is that
they were written at the moment the thing happened and never touched again. A
log the firm can partially reconstruct is a log that answers "we think this is
what happened", which is a different sentence from the one an append only table
exists to be able to say.

The same is true, with less at stake today because both are empty on
production, of `eng_partner_acceptances` and `eng_partner_touches`.

**And the asymmetry that should decide the priority.** The cost of the gap
today is one afternoon. The cost of the gap after the platform starts taking
orders is unbounded, and the gap does not close by itself: it closes on the
day the cutover gives this firm a project of its own, and not before.

---

## 4. What closes it, and what the cutover changes

**The cutover is the fix, and this is the clearest argument for it that has
been written down.** A project holding only `eng_` tables can be rewound
without asking anybody, which turns point in time recovery from a mechanism the
firm owns on paper into one it can actually use, and turns this section from a
report into the test it was meant to be.

**Cutover deferred by operator decision on 2026-09-07**, recorded in
`docs/production-cutover-plan.md`. That decision is not disputed here. What is
recorded here is its one consequence: **the firm holds no usable restore path
for as long as the deferral lasts**, and the deferral is the operator's to
weigh against that.

**What the test becomes on the day it can run**, written now so it is not
redesigned later:

1. Read a known figure from production, such as the `eng_audit_events` id set.
2. Write a marker row that must not survive.
3. Restore to a point before the marker.
4. Assert the marker is gone and the id set is intact.
5. Time it, and record the recovery time objective the firm can actually claim
   rather than the one the vendor advertises.

Step 5 is the point of the exercise. An untimed restore proves the button
works; it does not tell the firm how long it is down, which is the only number
anybody asks for afterwards.

**One thing that does not wait for the cutover, and is the honest interim
measure.** A scheduled export of this firm's tables to storage outside the
shared project would give the firm something it controls, today, without
touching a neighbour. It is not built, it is not in scope of this section as
the operator defined it, and it is recorded in `BACKLOG.md` as the one action
that would close the gap before the cutover does.

---

## 5. The runbook

Brief items 4 and 5. **Neither is blocked by the cutover**, which is worth
saying plainly: the deferral stops the restore TEST, and it does not stop the
firm writing down what to do when something breaks. This half of the section is
deliverable today and is the half somebody reads at two in the morning.

Every command below is one that can actually be run. Where the honest answer is
that there is no command, it says so rather than describing a procedure that
does not exist.

### 5.1 The database is lost or corrupted

**Today: there is no safe action, and this is the entry that the cutover
changes.** Section 1 is why. Do not restore `fsaryeciduszuahgjbly`; it would
rewind four other applications.

What to do instead, in order:

1. **Stop the writes before deciding anything.** The three cron paths are the
   only unattended writers. Removing `CRON_SECRET` from the Vercel Production
   scope makes all three refuse, because each compares against it and treats an
   unset value as no match:

       vercel env rm CRON_SECRET production

   Then redeploy, because **a deployment's environment is snapshotted at
   creation** and removing a variable changes nothing until something is built
   against the new set.

2. **Establish what is actually gone** before restoring anything. The
   fingerprint query in CLAUDE.md section 6b answers "is the schema intact",
   and per table counts answer "is the data". A schema that is intact with
   empty tables is a different incident from a schema that is gone.

3. **Assess by table, not by database.** `eng_audit_events` is the one that
   cannot be reconstructed. Everything else in section 3 above can be rebuilt
   by hand at today's volume.

4. **Then ask the operator of the shared project**, knowing the cost to the
   other four applications, and make that a decision somebody takes rather than
   one this document pretends is routine.

**After the cutover** this entry becomes: restore `qmvcqvkywmkogxbyzsaz` to a
timestamp from the Supabase dashboard, then run the verification in section 4
above. Nobody else is affected, which is the whole point of the cutover.

### 5.2 A deployment is bad

The fastest correct action is to promote the previous deployment, not to fix
forward. Vercel keeps every build.

    vercel rollback              # the previous production deployment
    vercel ls                    # to pick a specific one instead

**The CLI is not installed on the operator's machine** as of 2026-09-07, which
makes the dashboard the real path: the project's Deployments tab, the previous
production build, Promote to Production. Installing it is one command and worth
doing before it is needed:

    npm i -g vercel

**A rollback does not roll back the database.** A migration applied by the bad
deployment is still applied. If the deployment ran one, read 5.3 first, because
promoting older code against a newer schema is its own incident.

### 5.3 A migration goes wrong

**The migrations in this repository are additive by construction**, which is
what makes this recoverable at all: every one uses `create table if not
exists`, `add column if not exists`, or `create or replace function`. None
drops a column or a table. So the ordinary failure is a migration that did not
finish, not one that destroyed something.

1. **Read what actually landed** rather than what the file says:

       select md5(string_agg(sig, '|' order by sig)), count(*)
       from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
             from information_schema.columns
             where table_schema='public' and table_name like 'eng\_%') t;

   Compare with the chain in CLAUDE.md section 6b. The fingerprint says exactly
   which migration the database is between.

2. **Re run it.** Because every statement is idempotent, applying the same
   migration twice is safe and is the first thing to try.

3. **Never edit a migration that has run.** Standing law, and CLAUDE.md gives
   the reason: a migration that changes after it has run is one nobody can
   reason about. The fix is a new migration with a higher number.

4. **A migration that must be undone gets its own forward migration**, which
   the fingerprint then records. There is no down path in this repository and
   that is deliberate.

**`migration-audit` replays the whole chain into an in process Postgres on
every suite run**, so a chain that cannot rebuild from nothing is caught before
it reaches a database rather than by this runbook.

### 5.4 A credential leaks

**Rotate first, investigate second.** Every one of these lives in the Vercel
Production scope and nowhere else in the tree.

| Leaked | Rotate | What breaks while it is rotating | What the leak exposed |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard, API settings | Everything. It is the only database credential. | **Total read and write on every table, past RLS.** Treat as full compromise. |
| `STRIPE_SECRET_KEY` | Stripe dashboard, roll the key | Checkout and refunds | Charges, refunds, customer payment records |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard, per endpoint | Payment confirmation | Forged payment confirmations, so an unpaid order could be marked paid |
| `RESEND_API_KEY` | Resend dashboard | Every outbound email | Sending as the firm's domain |
| `OPS_SESSION_SECRET` | Generate a new one | **Signs every staff session out.** | Forged staff sessions, at any role |
| `CUSTOMER_SESSION_SECRET` | Generate a new one | Signs every customer out | Forged customer sessions |
| `PARTNER_SESSION_SECRET` | Generate a new one | Signs every partner out | Forged partner sessions |
| `CRON_SECRET` | Generate a new one | The three cron paths refuse until redeployed | Anybody could trigger the job runner and the daily rollup |
| `OPS_UNLOCK_TOKEN` | Generate a new one | The unlock path | Whatever that path opens |
| `INTAKE_KEY_SEALED`, `INTAKE_KEY_STAMP` | Generate a new one, give it to that sister | That sister's leads until it is updated | A third party could post leads as that brand, and only as that brand |

**The three session secrets are separate on purpose**, and the comment in
`src/lib/customer-session.ts` says why: rotating one must not sign out the
other two. Rotating the staff secret during an incident should not also throw
every customer out mid order.

**Rotation is not complete until a redeploy**, for the snapshot reason in 5.1.
And a leaked service role key means the database was reachable for as long as
the leak lasted, so rotating it ends the exposure and tells you nothing about
what was done with it. `eng_audit_events` records what the APPLICATION did; a
direct service role connection does not go through it and leaves no trace in it.
**That is the honest limit of what the audit trail can answer after this
particular incident**, and it is better learned here than during one.

### 5.5 A third party is down

| Down | What stops | What still works | What it needs |
| --- | --- | --- | --- |
| Supabase | Everything signed in, every form that writes | The static marketing pages, which are prerendered | Nothing. Wait, and watch the status page. |
| Stripe | Checkout, refunds | The whole platform except taking money | The order flow already writes its row before the checkout call, so an order is not lost |
| Resend | Every outbound email | Everything else | The intake API returns `emailed: false` on a 503, which is the flag that says a person does NOT have the enquiry |
| Vercel | The site | Nothing | Nothing |
| Sentry | Error capture to Sentry | **The database error log, which is the point of having both** | Nothing |

**The Resend row is the one with a real decision behind it.** The sister intake
API answers 503 with an explicit `emailed` flag precisely so a caller can tell
"the row failed but a human has it" from "nothing left the building".
`docs/sister-intake-api.md` carries what each state obliges a caller to do.

---

## 6. What is not recoverable, and this is the list to read before an incident

Brief item 5. Stated as a list rather than a paragraph because each line is a
different kind of loss.

1. **Storage objects are not covered by a database restore.** Point in time
   recovery restores Postgres. The buckets are a separate system, and rewinding
   the database to yesterday leaves today's uploaded evidence photographs
   exactly where they are, now referenced by rows that may no longer exist.
   **A restore therefore desynchronises storage from the database**, and
   nothing in this platform reconciles them. Two objects are at stake today;
   after the firm opens, evidence photographs are.

2. **Auth users are in a different schema and a different concern.** The two
   accounts that matter here live in `auth.users`, which the cutover plan
   copies by direct SQL insert precisely because no ordinary tool preserves the
   uuid. A restore that missed them would leave every `eng_profiles` row
   pointing at nothing, since that key is referenced by more than thirty
   foreign keys.

3. **Password hashes are not copied and are not meant to be.** The cutover
   issues a fresh set password link instead. So a project level move is always
   also a credential reset, by design, and anybody planning one should expect to
   re issue links rather than discover it afterwards.

4. **Anything living only in an environment variable is gone with the project.**
   The eleven secrets in the table above exist in the Vercel Production scope
   and in the operator's own records, and nowhere else in this repository by
   standing law. **There is no export of them and there must not be.** If the
   Vercel project is lost, every one is re issued from its vendor, and the three
   session secrets are simply regenerated, which signs everybody out.

5. **The audit trail cannot be partially reconstructed, which is the whole
   point of it.** Its value is that each row was written at the moment the thing
   happened and never touched again. A rebuilt approximation answers "we believe
   this is what happened", which is exactly the sentence an append only table
   exists so the firm never has to say.

6. **What Sentry holds is not a backup of the error log, and the reverse.** The
   two capture the same faults through different paths, and neither is
   authoritative for the other. Losing the database loses `eng_error_events`
   regardless of Sentry's retention.

---

## 5. What this report deliberately does not claim

- It does not claim the backups are absent. They exist; they are unusable by
  this firm without collateral damage, which is a different fault and is stated
  as one.
- It does not state a retention window or a recovery time objective. Neither
  was read, and both are the operator's to read in the dashboard. Writing a
  plausible number here would be exactly the fabricated assurance this platform
  refuses everywhere else.
- It does not claim the restore has ever been attempted. It has not, on any
  project, by anybody, and there is no evidence in this repository that it has.
