# Backlog

Work that has been identified and deliberately not built yet. Nothing here is a
commitment to a date. An item earns a place on this list by having a stated
reason and, where one exists, the concrete incident that produced it.

Items are removed when they ship, not when they are attempted.

**THIS FILE IS THE INDEX, AND ON 2026-09-06 IT WAS NOT.**

CLAUDE.md says this file carries every known and undone thing. Seven items the
operator could name from memory were not in it: three messaging capabilities, the
scroll position half of native standard point 8, the Sentry DSN, queue depth
alerting, and metric charts. Every one was recorded honestly somewhere else.

A sweep for open work markers across `docs/` then found the defect was
systemic rather than seven oversights: **five of the eight documents carrying
open work were never named here at all.**

That is this repository's own recurring defect one level up. A check that passes
while looking at the wrong thing, where the check is "read the backlog".

**The rule now, and `scripts/backlog-audit.mjs` enforces it.** An item may keep
its reasoning wherever that reasoning belongs. What it may not do is exist only
there. Every document that carries open work is named in this file, and every
item recorded elsewhere has a pointer entry here saying what it is, why it is not
built, and where the full reasoning lives. A pointer entry is not a second copy:
duplicating the reasoning is how two accounts of one decision start to disagree.

## ONE PORTAL GATE IS DECIDED BY A ROLE NAME, NOT BY A GRANT

Found 2026-09-10 by the overnight sweep's Round 3, which opens one screen each
role is NOT offered and reads what happens. Full reasoning in
`docs/overnight-report.md` section 7.2; this is the pointer.

`src/app/portal/(app)/certification/page.tsx:38`

```ts
if (!can(actor, "evidence.capture") && actor?.role !== "admin") notFound();
```

The shell offers an administrator 26 of the 28 destinations in NAV, and
Certification is not one of them, because NAV gates it on `evidence.capture`
and only `field_tech` holds that grant. The page opens for an administrator
anyway, at HTTP 200. It is the one place in the portal where whether a screen
opens is decided by comparing a role KEY to a string; every other role name
comparison in the sweep is display rather than a door.

**Why it is not fixed.** It needs a ruling. Deleting the escape hatch is the
obvious change and it takes the screen away from administrators, which may not
be intended. Granting them `evidence.capture` instead gives them capture as
well as read, so the honest fix may be a new read grant, and inventing a grant
is not a thing to do unattended overnight.

## THREE COMPLIANCE SENTENCES ON THE SIBLING SITES, FOUND OVERNIGHT

Found on 2026-09-10 by the overnight sweep's Round 2, which reads the three live
deployments signed out and matches them against `scripts/lib/regulatory.mjs`,
the declaration both gates are stated in.

**The reasoning lives in two briefs, one per sibling repository, and they are
the first item for those sessions:**

- `docs/brief-sealedengineering.md`
- `docs/brief-stampmyplans.md`

Each quotes its sentences exactly, with the paragraphs around them, says what is
wrong with each one and what this sweep did NOT check on that site. Full quotes
also appear in `docs/overnight-report.md` section 3a. This is the pointer and
not a third copy.

**Why it is not fixed here, and will not be.** Operator ruling, 2026-09-10: the
sibling sites are not touched from this repository, ever. The briefs are carried
across by hand, into those repositories, in those sessions.

| Where | The sentence | The pattern |
| --- | --- | --- |
| sealedengineering.com/ | "Engineering work is performed under the license and registration of 254 Engineering Services LLC." | states the engineering is being carried out now, passive |
| sealedengineering.com/contact | "All engineering work is performed under that entity's license and registration." | the same, but the pending disclosure is on the next line |
| stampmyplans.com/terms | "we decline work outside the competence of our engineers" | plural engineer fiction |

**The decision that would be made, recorded rather than taken.** The third is
the sharpest: "our engineers" states a fact about staffing, and no licensed PE
is on staff. The second is arguably already honest, because "Firm registration
pending with the Texas Board of Professional Engineers and Land Surveyors"
follows it immediately. The first is the same sentence as the second WITHOUT
that adjacent qualifier.

**What this repository can and did do about it.** Round 2 originally carried
seven hand written patterns of its own and found only the third. Replacing them
with the declared twenty two found the other two on the first honest run, which
is the argument for the declared inventory idiom made on a live deployment
rather than in a test.

## SECTION 4'S SECTION 0: FOUR DEBTS, AND THEY ARE ALL THE SAME DEBT

Ruled at the gates of Phase 12 Section 3. All four are taken at the START of
Section 4, before its own work, rather than folded into a merge.

**They are one pattern: the harness saying something ACCIDENTAL instead of
something true.** Each of the four is a check or a record that answered a
narrower question than the person reading it would assume, and in three of the
four the answer was right for reasons nobody had stated.

| # | The debt | What it says accidentally |
| --- | --- | --- |
| 1 | Nothing on the board goes through the queue's door | 148 checks about a queue, none of which claims a job |
| 2 | The schema fingerprint's four blind spots | "the schema matches", meaning only its column shapes match |
| 3 | `mobile-overflow-audit` has no third verdict | "this page overflows", meaning the page did not load |
| 4 | Line endings decide what a source check matches | "the code says this", meaning the file arrived this way |

### THE 35 EMAILS, 2026-09-09, AND THE ONE THING THAT IS STILL OPEN

**What happened.** The first version of `scripts/queue-audit.mjs` enqueued its
probes as the oldest eligible work, which was right, and then called `runBatch`
several times, which was not. `runBatch` claims BATCH_SIZE rows of ANY kind.
Once the probes were consumed every later call took backlog, and 35 `email.send`
jobs that had been sitting pending on development since 2026-09-04 ran for real:
18 `apply.notification` to `ceo@36west.org` and 17 `apply.confirmation` to
`forms.audit@254engineering.com`. **Nobody outside the firm received one, and
that was luck rather than design.**

It is the second time in one day. The retention dry run earlier did the same
thing and sent twenty.

**What is closed.** Three things, and each answers a different question.

- `eng_jobs.effect_mode` (migration 0038) puts on the ROW what a job is
  permitted to do, so it stops being a property of whichever process ran it.
- `ourBatch()` in queue-audit REFUSES to run a batch unless every row the claim
  would take belongs to that run. Section 3 already ruled that a board must
  refuse to drain over a backlog; this file did not carry the rule and now does.
- Development's waiting jobs of every outward-reaching kind were marked
  `no_external_effect`: 347 `email.send`, 54 `notification.deliver`. Nothing was
  deleted and nothing was marked done. queue-audit asserts that none is ever
  `live` again, so the hazard cannot quietly return.

**What is still open, and it is the reason this entry exists.** The backlog
itself, and the fact that **it regenerates on every board run**.

Development is carrying **525 pending jobs** from months of audit runs, 133 of
them `report.export` still marked `live`, and nothing on development ever drains
the queue. Marking the waiting ones suppressed fixed the rows that existed and
not the source: `forms-audit` walks the real application form, the application
enqueues a real `email.send` at `live` because that is exactly what it should do
for a real submission, and four more appeared while this was being written.
queue-audit caught them in the act, which is the check working, and it means the
check goes red on the board after next unless somebody keeps sweeping by hand.

The options, and each has a real cost:

- **Drain it under suppression on a schedule.** Cheapest, and it makes
  development's queue behave like a queue instead of a midden.
- **Let retention sweep `eng_jobs` on development.** The declaration already
  permits deleting from `eng_jobs`; nothing schedules it.
- **Suppress outward-reaching kinds by default when the deployment is
  development.** Tempting and the most dangerous: it makes production and
  development behave differently on the one path where a silent difference
  means a customer never hears from the firm.

**Nothing is done here without a ruling.** Draining is a decision about somebody
else's queued work, even when that somebody is an audit from last Tuesday, and
the third option changes what the platform does depending on where it runs.

### BULK TABLE ACTIONS: TWO OF THE THREE DRAWN ACTIONS NEED A RULING

Phase 12 Section 4, Section 1. The full reconciliation is in
`docs/bulk-actions-reconciliation.md` and this is the pointer, not a second copy
of it.

The approved prototype draws a selection toolbar on the Files screen with three
buttons: Export, Assign, Dispatch. Read against the code as CLAUDE.md section 2c
requires, they describe three different situations.

- **Export** is a capability the platform does not have and can have. Built in
  Section 1.
- **Assign** is an operation this platform deliberately does not have. Nothing
  gives a file to a person; both `assigned_engineer_id` and `assigned_tech_id`
  are written only when somebody ACCEPTS work. The engineer half is the record
  of responsible charge, which 0039 has just made a RESTRICT foreign key.
  **Refused unless the operator rules otherwise**, and the refusal belongs in
  Section 2 as a thing bulk must not do.
- **Dispatch** is half real. Sending offers exists; sending them for many files
  means choosing technicians without a person looking, which is a decision about
  who gets paid. **Needs a ruling** on the selection rule before it is built.

### B2B CSV IMPORT: THE FILE UPLOAD IS DEFERRED, THE DEFECT IS NOT

Phase 12 Section 4, Section 1. Full reasoning in
`docs/bulk-actions-reconciliation.md` section 5; this is the pointer.

Most of a CSV import has existed since Phase 8: `/account/order` takes pasted
properties, one per line, and `splitBatch` prices and qualifies each. What is
missing is a FILE, a header row and a column mapping.

**The live money defect that parser had is fixed** and is not what is deferred:
it split on commas, so an address with a suite number put a city in the county
column, and the county decides the coastal surcharge and the protocol.

**Deferred because a file brings its own questions**, none of which the defect
should have waited behind: which encodings, what happens to a header row
somebody did or did not include, whether a column mapping screen is needed, and
what a five thousand row file does to one request.

### BULK MESSAGING: REFUSED, AND WHAT IS ACTUALLY WANTED EXISTS

Phase 12 Section 4, Section 1, refused at gate 1's reconciliation. Reasoning in
`docs/bulk-actions-reconciliation.md` section 4.

A thread hangs off a FILE and its messages are the record of what the firm told
a client about that client's job. One sentence posted into fifty of them is a
statement about fifty pieces of work by somebody who read none of them, and it
reads to each recipient as being about their property. Same shape as the Assign
refusal: the bulk action is not the single action many times, it is a different
act that resembles it.

**What is wanted is almost certainly an announcement**, and `ops-announce.ts`
is already that. Nothing is being built here; the entry exists so the next
person asking for bulk messaging finds the reasoning rather than the gap.

### THE MACHINE CLOCK WAS 85 SECONDS AHEAD. RESYNCED 2026-09-11; THE DURATION ARITHMETIC IS STILL OPEN

Found by `queue-audit` on 2026-09-09, measured rather than guessed: a row is
inserted, the database's own `created_at` default is read back, and the gap is
reported with the round trip stated so the figure's precision is honest.

**Why it matters.** Everything about the queue is decided by the DATABASE's
`now()`: which rows are eligible, whether a lease has expired, when a retry may
run. Everything the application stamps is written with THIS machine's. An 85
second gap means a job enqueued to run now is ineligible for 85 seconds, and a
lease that has expired here is still live there.

It has already produced two defects. Phase 8 Section 2 found four jobs enqueued
and claimed a moment later that were claimed by nothing, and `ops-jobs.ts`
carries that lesson: `run_after` is only written when a delay was actually
asked for, so the column default applies and the DATABASE stamps it. Section 4
found the second: a probe lease written at "a minute ago" on this machine had
not expired on the database, and the audit reported that a crashed worker's job
is never reclaimed. It is. The check was measuring the gap between two clocks.

**RESOLVED ON THE MACHINE, 2026-09-11.** W32Time was running and had never once
synchronised: leap indicator 3, stratum 0, no last successful sync, and
`Source: Free-running System Clock`, which is why a bare `w32tm /resync` could
not fix it and why the first attempt did not take. A manual peer was configured
and the service restarted. Verified independently rather than from the service,
three HTTP `Date` headers reading inside one second, and `queue-audit` then
reported 0s ahead of the database against 85s before. The Section 4 merge was
held until that check was green, which is the whole argument for the check.

**The operator resynced the clock.** The code consequence was ruled
separately and is done: `src/lib/db-now.ts`, and 68 observed timestamps across
26 files now carry the string `now`, which Postgres resolves to
`transaction_timestamp()`. No recorded moment comes from a process clock any
more. Proven end to end rather than from documentation: a row written through
PostgREST came back stamped 85 seconds behind what this machine would have
written.

**What is still open is narrower and it is not about this laptop.** A DURATION
computed as (local now minus a database timestamp) still carries whatever gap
exists, and `ops-engineer` computes review `minutes` that way. With a synced
machine that is seconds; on a serverless instance that came up moments ago it
is whatever NTP has managed. Moving it needs the arithmetic to happen in the
database, which is an RPC, and it is a smaller prize than the timestamps were.

### fp-at.mjs MOVED TO scripts/fingerprint-at.mjs. DONE 2026-09-11

Recorded here rather than deleted because the entry above it in git history
explains why a tool at the repository root was a defect, and an item that
vanishes looks like one nobody ever raised. It now lives at
`scripts/fingerprint-at.mjs` with a header saying what it is for, and it was
run from its new home and reproduced the ledger figures for 0041 exactly.

## SIX OF THE SEVEN LAUNCH CONDITIONS ARE UNMET, AND EACH IS SOMEBODY'S TO CLEAR

The compliance gate became seven named conditions on 2026-09-11. Six are
outstanding. **The full reasoning for each is in `docs/launch-readiness.md`** and
is not repeated here; the operator's live view is `/portal/launch`, which renders
the gate's own answer.

What is open, and who clears it:

- **`operating-name`** is the one holding the gate. TBPELS issued F-29811 to 254
  Services LLC and all three sites hold out as 254 Engineering Services. Cleared
  by an assumed name filing plus TBPELS acknowledgement, or by renaming the
  entity. The operator's.
- **`stripe`** needs a live account belonging to 254 rather than Reyna Pay,
  proven by one real charge and its refund with both recorded. The operator's.
- **`protocols`** needs one protocol per offered service line, approved by the
  engineer of record. `approvedProtocols` is empty, so all nine lines are a
  waitlist. **Blocked on hiring a PE**, which is the second gate.
- **`phone`** needs a real `FIRM_PHONE`. The operator's, and it is a commitment
  to answer it.
- **`switch`** is the operator's deliberate last act and is correctly last.
- **`recovery`** is CLEARED, 2026-09-10, with its limit recorded: it restores all
  five applications on the shared project or none.

**Nothing here is a defect.** These are conditions on a firm, recorded so that
the answer to "why will the gate not open" is a sentence rather than an
investigation.

### THE LEGAL ENTITY NAME ON THE SITE IS NOT THE NAME THE BOARD REGISTERED

Found 2026-09-11. This is a SECOND name discrepancy and not a restatement of the
operating name one: that is about what the firm trades as, this is about what the
firm IS.

  business.legalName        254 Engineering Services LLC
  F-29811 issued to         254 Services LLC

`business.legalName` renders as **Legal entity** on /government, which is the
capability statement a government buyer reads, and in the footer copyright line
on every page of all three sites.

**Exactly one can be right,** and the answer is in formation documents nothing
here can read. Either business.legalName is wrong and the capability statement
has been naming the wrong company, or there are two entities and the
registration belongs to one while the website describes the other.

**Recorded rather than guessed**, in `legalEntityMatchesRegistrant` in
`src/config/credentials.ts`, with both names written out. compliance-audit
asserts the record names them and stays true of the values as they are today, so
it cannot be resolved by editing one string and assuming the other followed.

**Deliberately not an eighth launch condition.** The gate already will not open
on the operating name, and a second condition for the same underlying fact would
make clearing one look like progress while the other silently holds. The full
reasoning is in `docs/launch-readiness.md`.

**This is the operator's to answer.**

### The sibling repositories do not compile until they answer the protocol question

`orderBlockedReason` in `data/catalog.ts` gained a REQUIRED third parameter,
`hasApprovedProtocol`. That file is synchronized verbatim into sealedengineering
and stampmyplans, so both will fail to compile on the copy until each passes its
own answer.

**That is the intended failure mode and not an oversight.** Either default would
be wrong invisibly: true lets a sibling sell a line it cannot dispatch, false
silently refuses every order on a launched site. A required parameter makes the
question loud and early. The reasoning is written above the function.

### 4. Line endings, and the cause as well as the symptom

Operator ruling, 2026-09-09, after the board on main failed on a check that had
passed on the branch with no change to the code.

**The symptom** is fixed: `scripts/lib/read-source.mjs` normalises at the read
and `retention-audit` goes through it. **Every other audit that matches across
lines still uses `readFileSync` directly** and has simply not been unlucky yet.

**The cause is not fixed.** The repository has no `.gitattributes`, so a
checkout materialises CRLF while every patch script in this session writes LF,
and the same file has different bytes depending on how it last arrived.

What Section 4 does, in ONE commit:

- `.gitattributes` declaring `text=auto eol=lf` for the repository, so a
  checkout produces the bytes the session writes;
- the renormalisation, with **what it touched stated** rather than left as a
  diff nobody reads;
- every audit matching across lines moved to `readSource`.

Both halves, because the helper saves the audits that use it and the next reader
who does not is saved by luck. A check whose answer depends on how the file
arrived on disk says nothing about the code.

### The schema fingerprint has four blind spots, and a second one closes them

Operator ruling, 2026-09-09. **At the start of Section 4**, not mid-merge.

The fingerprint in `supabase/applied.mjs` is `md5` over
`table_name.column_name:data_type:is_nullable` for every `eng_` table. It is a
good measure of SHAPE and it cannot see four kinds of change, every one of which
this section shipped:

| Blind to | Shipped by | What was read back instead |
| --- | --- | --- |
| A constraint's delete action | 0030, SET NULL to RESTRICT on both ledgers | `pg_constraint.confdeltype`, and a live refusal |
| Triggers and functions | 0032, seven triggers and two functions | `pg_trigger` and `pg_proc`: 55 to 56, 10 to 12 |
| Indexes | 0037, a unique index on `lower(email)` | `pg_indexes` |
| Seeded reference rows | 0018, and 0030's `retention.execute` grant | a row count on `eng_role_grants` |

Four migrations in one section whose correctness the ledger's own number could
not confirm. The number was right every time and it was answering a narrower
question than anybody reading it would assume.

**What is to be built.** A SECOND fingerprint, derived from the catalogue,
covering constraint delete actions, triggers, indexes and seeded reference rows,
recorded beside the first in every ledger entry from then on. The first is
**kept**, because it already describes the whole history above and replacing it
would make every entry before Section 4 unverifiable.

**Until it exists**, every ledger entry for a migration the first fingerprint
cannot see states what was read back instead. 0030, 0032, 0033 and 0037 already
do; that is the standard the next one meets.

### Every audit matching across lines is sensitive to line endings

Found on the board on MAIN, 2026-09-09, after the merge and after eight
migrations had already gone to production.

`retention-audit` asserts that the one DELETE in `ops-retention.ts` sits inside
the mode check, with a pattern spanning two lines. It passed on the feature
branch and failed on main. Nothing about the code had changed: node had written
the file with LF while working on it, and `git checkout main` materialised the
same bytes with CRLF, so `{
s*const` no longer matched.

**A check whose answer depends on how the file arrived on disk is worse than a
check that is merely wrong.** It passes for one person and fails for the next
with nothing to argue about between them, and it says nothing about the code
either way.

`scripts/lib/read-source.mjs` is the fix and retention-audit uses it. **Every
other audit that matches across lines still uses `readFileSync` directly**, and
a crude count says most of them match multi-line patterns somewhere. None has
failed this way yet, because the files they read have not happened to change
endings; that is luck rather than a property.

What it needs is a sweep: every `readFileSync` in `scripts/` whose result is
matched against a pattern containing a newline moves to `readSource`. It sits
with the other two Section 4 harness items, and like them it is about the
harness saying something true rather than something accidental.

### mobile-overflow-audit reports a page that did not load as an overflow

Recorded 2026-09-09. On board 11 it failed with:

    FAIL: /portal/login @360 (did not load)
    - /portal/login @360: did not load (page.goto: Timeout 45000ms exceeded.)

`mobile-audit` loaded the same screens in the same run and passed 200 checks,
and board 12 was green with no change to that page. It was the server compiling
under load on the first route that audit touches.

**A page that could not be reached is not a page that overflows.** CLAUDE.md
section 6c already rules on this: UNREACHABLE IS NOT FAILED, and an audit whose
subject cannot be reached answers COULD NOT TELL. `sister-intake-audit` carries
that three way verdict; `mobile-overflow-audit` does not, so a load timeout
becomes an overflow finding and a red board that means something else.

Not fixed here, deliberately: the change is to an audit's verdict handling and
this branch was at its merge when it surfaced. What it needs is the same three
way answer, and a retry before it gives up, because one 45 second timeout on a
cold route is not evidence about a layout.

## The queue: nothing on the board goes through its door

Operator ruling, gate 2 of Phase 12 Section 3, and it is the first item of
Section 4 because bulk operations are what put real volume through that door.

**The fixture lesson at the queue level.** `jobs-audit` runs 148 checks over the
queue and never invokes a handler. It reads `runBatch`'s SOURCE TEXT for the
properties it asserts, that the lease is released, that an unregistered kind is
fatal, that a dead job is logged, and it calls `handlerFor(kind)` only to inspect
`idempotency`. Every check calls the function; none goes through the door a real
job goes through.

| Kind | `run` invoked by the board | Through `eng_claim_jobs` |
| --- | --- | --- |
| `email.send` | no | no |
| `notification.deliver` | no | no |
| `evidence.thumbnail` | no | no |
| `document.binder` | no | no |
| `statement.issue` | no | no |
| `orders.reconcile` | no | no |
| `metrics.rollup` | no | no |
| `errors.alert` | no | no |
| `report.export` | no | no |
| `retention.sweep` | yes | see below |

`runBatch` is called in exactly two places in the repository:
`src/app/api/cron/jobs/route.ts`, which is production, and
`scripts/retention-dry-run.mjs`, which is run by hand and is not in the suite.
The claim path, the lease, `nextState` and the dead-letter transition are
exercised on the board by nobody.

**What it already cost.** The handler is what writes the regulatory trail row for
a retention sweep, so the trail row was the one thing no check was reading, and
it was written with `actor_id: null` while the manifest beside it named who
asked. Found by reading the two tables side by side, not by any check.

**Not widened here.** One handler is exercised, and its comment says it is the
only one so nobody reads it as coverage. Nine remain, each declaring an
idempotency key nothing has ever exercised.

## Retention: what Section 2 built, and the four things it deliberately did not

Recorded 2026-09-09. The machinery is complete and nothing starts a run by
itself. The full reasoning for each rule is in `src/lib/retention-policy.ts` and
in the header of `src/lib/ops-retention.ts`; these are pointers.

### Retention has no screen and no schedule, on purpose

A retention pass is planned and enqueued by hand:

```
npm run retention-dry-run
```

There is no cron entry and no operator screen. A pass that ran itself on a timer
before anybody had read one is exactly what the operator's dry-run-first ruling
exists to prevent, and a screen that starts one is a screen somebody clicks.

What closing it needs, in this order: a run somebody has read on development, a
run somebody has read on production, and only then a schedule. The screen is the
smaller half, and it belongs with the customer-side deletion request screens
below rather than on its own.

### The customer side of retention is not built

Phase 12 Section 3's own Section 3. A customer asking to be forgotten produces a
TASK rather than a deletion, and the screens that take that request, under
customer service and using the suppression permission, are not built. Nothing
today records such a request except a suppression, which is a narrower thing: it
stops marketing and does not claim to delete anything.

### Forty one tables are kept with no period, and the question is not with us

`retention-policy.ts` declares 41 of 73 tables `kept_pending_counsel`. That is
not a placeholder for a number somebody forgot: the repository states no Texas
retention period anywhere, and the published privacy policy already promises
that engineering records are kept for as long as Texas requires, so a floor set
here could make a published policy false. Retention treats that state exactly as
kept forever. The question is with counsel and TBPELS, and the declaration says
so per table rather than in one place.

The one "ten years" in this repository is a design rationale about the
responsible charge log outliving an engineer's employment. **It cites no rule and
must not be used as a period.**

### Development's queue holds 399 pending jobs and nothing drains it

Found 2026-09-09 while running the first retention dry run, and it cost twenty
real emails before it was understood.

Nothing schedules the queue on development, so every audit run that queues an
email adds a row that stays pending forever: 307 `email.send`, 54
`report.export` and 38 `notification.deliver`, the oldest from 2026-09-04. The
first version of `retention-dry-run` called `runBatch` to watch its own job
finish, the worker claimed the twenty oldest rows of any kind, and **Resend
accepted every one of them.** Application notifications for probe applicants
went to the firm's own address.

The script now counts what else is waiting and refuses to drain over a backlog,
which fixes the tool and not the queue. The queue itself is still a pile of work
that will all run the first time anything drains it.

**Half of this is closed, 2026-09-09.** The operator refused "development does
not queue email" for the reason that makes it tempting: it would make
production and development behave differently on the one path where a silent
difference means a customer never hears from the firm. What was ruled instead
is suppression BY ACTOR, and it is built: `src/lib/fixture-identity.ts`, read
by `queueEmail` from the message's own `to` and `replyTo`, so work about a
person who does not exist is `no_external_effect` at creation and work about a
real one still sends. It needs nobody to remember, which is the property that
matters, because remembering has now failed twice at a cost of 55 emails.

**What is still open is the pile itself.** 526 rows that predate the rule, and
the question is unchanged: run them or mark them dead. Nothing here decides
that, because it is a decision about somebody else's queued work even when
that somebody is an audit from last Tuesday. `queue-audit` now REFUSES TO
START if any outward reaching job it did not create is claimable, so the pile
cannot hurt anybody while the decision waits, and it says so loudly rather
than working around it.

### What development now carries permanently, and why each row is there

Recorded 2026-09-09, updated after 0032. None of this is a leak. All of it is
the cost of records the database refuses to delete, and it is written down so
the next person counting rows on development knows what they are looking at.

**Retention manifests.** Development holds well over a hundred, every one a dry
run, none deletable. Three are written per `retention-audit` run and one per
table by `retention-dry-run`. Since the gate 2 ruling every plan nobody ran is
`abandoned` rather than left at `planned`, so none of them reads as a deletion
still intended, and every one names its origin in `actor_role`. **They still
accumulate.** What that needs is a decision between exercising the plan path
against a replayed database, the way `eng_partner_entries` has been since 0019,
and accepting the rows on the grounds that a manifest is small and a development
database is not a record of anything.

**Three rollup rows for 2019-03.** `retention-audit`'s fixture. 0032 stopped
`eng_metrics_daily` rows being deleted, so they persist; the upsert is on
`(day, metric)`, so the same three are rewritten rather than added to, and the
audit asserts the count is exactly three.

**One standing demonstration engineer, client, priced file and ledger entry.**
`scripts/lib/standing-demo.mjs`, shared by `dashboards-audit` and `demo-audit`.
Created once, reused, its period moved forward by UPDATE. Both audits assert the
production ledger's row count did not grow.

**Nine production ledger rows that cannot be removed**, and what each is.

Two are orphans from the one board run between 0032 being applied and the audits
being fixed: $888.00 and $777.00, left by the per-run fixtures whose teardown had
stopped working. The second has no file at all, which is the unscopable money row
0030 exists to prevent, arriving through a fixture rather than through a deletion.

Six more are the SAME standing fixture inserted over and over, $888.00 each, by
the runaway described below: `maybeSingle()` answers PGRST116 for a multiple
match, the lookup discarded the error, the failure read as "not found", and every
run after the first duplicate added another.

One is the standing fixture itself, which is meant to be there.

**None of them moves a figure, and that is checked rather than assumed.** Every
one belongs to a profile carrying `is_demo`, and the production report scopes on
`eng_profiles.is_demo` rather than on the file, so the two with no file are
excluded by the same filter as the rest. demo-audit proves it from the standing
row directly: the report names it with demonstrations included and does not name
it without. The margin and revenue figures read the file, and the file carries
`is_demo` too.

What they cost is clutter in a table nobody can tidy, on development only.
Production holds none of this: it has no ledger rows at all.

### A cleanup nobody checks reports success by not speaking

Recorded 2026-09-09 and it is a defect CLASS rather than an instance, which is
why it has its own entry.

`.delete()` on the Supabase client RETURNS an error rather than throwing one.
Three teardowns in this repository called it and never looked: `dashboards-audit`,
`demo-audit` and `seed-field-demo`. When 0032 attached delete refusals to the
money and consent records, all three stopped working and **two of them went on
reporting green**, while development quietly gained an orphaned ledger entry and
its profile and file on every board run.

Nothing in the suite looks for this shape. What closing it needs is a sweep of
every `.delete()` in `scripts/` for a discarded error, and a rule that a teardown
either asserts its own effect or says what it kept. The three above now do.

### An execute run has never happened anywhere

Every run so far, on development and in the audit, has been a dry run. The
prelaunch gate makes that structural rather than a habit: `executeAuthority`
refuses to mint the authority to delete while `isPrelaunch()` is true, whoever
is asking. The first execute run is therefore a thing that happens after launch,
after a dry run somebody has read, by an administrator, and it will be the first
time the delete line in `runRetention` has ever run against a real row.

## A customer link cannot be revoked, and lives 120 days

Recorded 2026-09-08. Accepted by the operator as the code behaves, and not being
fixed now.

Each customer email mints its own status token: `issueCustomerLink` only
INSERTs, and nothing anywhere in the codebase sets `revoked_at` on
`eng_customer_access`. The upside is the one that was asked about and it holds:
every token stays valid to its own expiry, so an older email in a customer inbox
is never silently killed by a newer one.

The cost is the other half of the same fact. **A link that is forwarded, leaked,
posted in a support ticket or left in an inherited mailbox works for 120 days
and there is no way to stop it.** The column exists and is read on every
resolve, so the reader honours a revocation; nothing can write one. The order
status page is deliberately narrow, it shows no file number, no technician and
no internal event, so the exposure is one property address, one price and one
timeline. That is the reason this is a recorded risk rather than an urgent one.

What closing it needs: something that writes `revoked_at`, a reason to write it
from, and a decision about whether issuing a new link should revoke the previous
one, which would reintroduce exactly the silent death that was rejected.

## A phone in job reaches payment with no refund disclosure

Found 2026-09-08 while porting the email design, and it is a CHECKOUT defect
rather than an email one. Operator ruling: it belongs at the top.

There are two ways an order is created. `ops-intake.ts` builds one from the
catalog and writes `refund_disclosure` in the same insert that sets
`awaiting_payment`, so a customer ordering online is always told what happens to
their money before they pay. `ops-job-billing.ts` raises one against a file for
a job taken over the telephone, and writes no disclosure at all. It also writes
no `inspection_fee_cents` and no `catalog_snapshot`.

**What that costs, concretely.** The customer is emailed a payment link and pays
without ever being told the refund terms, while the online customer is. And
because the inspection fee is absent, `refundFor` reaches its "refuses to
compute" branch the moment a technician has attended and the engineer declines,
so the refund cannot be worked out at all and has to be settled by hand.

**Why the email does not paper over it.** `order.confirmed` carries the stored
disclosure verbatim and says nothing when there is none, which is correct: an
email must not invent the terms somebody was never given. That correctness is
what makes the gap visible rather than what fixes it.

Not fixed here because the fix is a decision about what a phoned in job
discloses and when, which is the operator's and touches money.

## onboarding-welcome, waiting on self service accounts

Recorded 2026-09-08. One of the thirteen templates in the approved email design,
classified as describing a real event and then found to have no event to hang
off.

The design shows a customer account welcome: track files, download sealed
letters, manage billing. The surface exists at `/account`, `issueCustomerToken`
exists, and `/account/set-password` exists. **Nothing creates a customer user.**
`issueCustomerToken` has zero callers, so there is no moment at which this email
could be sent.

It belongs to Phase 13 self service accounts, which is the work that would make
the event. Building the email first would mean inventing an account creation
flow to justify a template, which is the wrong way round. The reference file
stays in `design-reference/emails/` so the design is not lost.

The customer half of the email port is therefore three templates, not four.

## Audits that still fail red when run standalone with no server

Recorded 2026-09-08. Operator ruling: unreachable is not failed, and an audit
whose live half cannot run reports COULD NOT TELL and exits zero.
sister-intake-audit carries that verdict now. These do not, and each records a
FAIL when nothing is answering on BASE_URL:

  asset-audit, bucket-roundtrip, coverage-audit, cta-audit, forms-audit,
  link-map, messaging-audit, placeholder-audit, preflight-audit,
  preflight-harness, registry-audit, seo-audit, shots, voice-audit

The reason this is recorded rather than urgent: inside `npm run audit` it does
not arise. The runner starts its own server, re-checks it between phases, and
prints THE SUITE DID NOT RUN TO COMPLETION rather than a list of content
failures, which is the same protection at the suite level. The gap is a
STANDALONE run, which is how any of these is usually run while working on it,
and the cost is a red mark that means nothing and teaches somebody to skim past
reds.

## Two self comparing checks left as recorded

From the audit survey of 2026-09-08, which went through all 47 audit and proof
scripts hunting checks whose expected value is imported from the module under
test. Seven were closed in the email design branch. These two stay, on the
operator ruling that both are mitigated, both are documented where they sit, and
neither is on a money or security path.

**scripts/jobs-audit.mjs:265.** The retry backoff floor is asserted as
`backoffMs(n) >= BASE_DELAY_MS / 2`, both from src/lib/job-rules.ts. It is a
ratio invariant, jitter never eats more than half the base, which is a real
property and holds equally if the base becomes one millisecond. The same file
already gets the ceiling right and explains why: line 243 compares against a
literal ONE_HOUR_MS rather than MAX_DELAY_MS.

**scripts/db-guard-audit.mjs:332.** `PRODUCTION_GUARD_FIX.includes(PRODUCTION_EXPECTED_REF)`,
both from src/lib/db-guard.ts. Mitigated eighteen lines later at 350, which
cross checks PRODUCTION_EXPECTED_REF against scripts/lib/db-target.mjs, an
independent source. Every other use of those constants in that file asserts a
hand written property.

Also from the same survey and NOT a finding, recorded because it looks like one:
`scripts/lib/role-total-functions.mjs` compares roleLabel, homeFor and
actionsFor to fields of DEFAULT_ROLES, and those functions are DEFAULT_ROLES
lookups. It was tested rather than read: breaking the lookup so it always misses
fails the check and names four of the seven roles. DEFAULT_ROLES is a
DECLARATION, agreeing with it is the assertion, and that is the distinction now
recorded in CLAUDE.md.

## The email design port does not merge until support@ is proven to receive

Merge gate, operator ruling 2026-09-08. Every template except four now replies
to support@254engineering.com. The operator has confirmed the mailbox exists and
is monitored; what is NOT yet proven is that a reply to a message this firm
actually sent lands there.

The gate: the operator replies to a preview send from their phone, and that
reply is confirmed to arrive. Until then the port does not merge.

Stated as a gate rather than assumed because a reply-to that does not receive is
silent in exactly one direction. Nothing bounces to the firm, nothing appears in
any log here, and the only symptom is a customer who says they replied and heard
nothing back. It is not a thing an audit can check from this side.

Related and still open: **info@254engineering.com is not a confirmed mailbox**
and it is the mailto in the footer of every email this firm sends, as
`business.email`. That address is used across the website too, so changing it is
wider than the email port and is not done here.

## Where a customer email links, and the ruling that was revised

Recorded 2026-09-08. **Every customer facing email links to
`/order/<reference>?token=`, and nothing else.**

The operator first ruled these at `/account/orders/<reference>`. That was
revised on the evidence rather than on preference: `/account` is the B2B account
surface, `/account/orders/[reference]` renders a bulk BATCH scoped to
`me.accountId` and behind a login, and `eng_service_orders` says in its own
comment that a customer "is not a portal account: they never get one". The
ruled link would have sent one off customers to a login they can never pass.

The right destination already existed and predates both readings. The order
status page has been there since Phase 7 and states its own contract at the top:
the link is signed, emailed to them, and that is the whole authentication story.
Nothing had ever emailed it. `releaseForFulfilment` minted the token, wrote
`customer_link.issued`, and dropped it.

**There is no letter route and there will not be one**, so the sealed email
points at the status page where the uploaded document hangs. That defers to the
standing law in CLAUDE.md rather than restating it.

## Phase 12 Section 1 is on production and enrolled against

### The second factor is offered rather than demanded, and the requirement is still there

Recorded 2026-09-07, hours after the requirement shipped and was enrolled against. **Operator ruling:**
the default is optional, a person with no factor is offered enrolment and can
decline into the portal, and the per role requirement stays in the code and
stays enforceable. Migration 0025 moves `admin` and `engineer` to optional.
The reasoning is in `docs/mfa-design.md` section 5 and in the migration.

**0024 was not edited**, because it had already run against production and a
migration that changes after it has run is a migration nobody can reason about.
0024 keeps saying what it did and carries a pointer to 0025; nothing but that
comment was added to it.

**What is still true after this.** Anybody already enrolled is still challenged
for a code at every sign in, whatever their role now says, because the sign in
path reads enrolment before it reads the requirement. Nobody was un-enrolled.
Setting a role back to `required` is one update and turns on the same
enforcement that shipped in 0024, which `mfa-audit` proves on every run by
creating a role that requires a factor and requiring the portal to refuse it.

**The open item this leaves.** Voluntary enrolment from the profile screen is
still not built, so somebody who declines is offered again at their next sign in
and has no other way in. The enrolment copy says exactly that rather than
pointing at an account screen that does not exist. It is the natural home for
this and is not urgent while the offer repeats.

**The judgment call, disclosed.** An optional role gets a FULL session and is
merely sent to the enrolment screen, rather than a pending session plus a button
that promotes it. The second shape needs an endpoint whose whole job is
upgrading a half authenticated cookie, which would be the most attackable thing
in this flow and would put every still-required role behind it. Nothing is
withheld from somebody whose role does not require a factor, so nothing has to
be handed back.


### The second factor is live, and the first enrolment was a real one

Recorded 2026-09-07. The design and both operator rulings are in
`docs/mfa-design.md`; this is what actually happened.

**Enrolled on production**, by the operator, with Google Authenticator. The
camera acquired the QR on the first try, the code was accepted, the recovery
codes were saved, and the portal opened. Migration 0024 is applied and verified
against the replay, and the ledger says so.

**What that closes.** Every claim about this flow up to that moment was made by
a proof or an audit. Three of them could not be settled that way and now are:

  that a real authenticator accepts codes from this TOTP implementation, rather
  than only that it agrees with RFC 6238's published vectors;

  that a real camera acquires a QR from this encoder, rather than only that an
  independent decoder reads a clean bitmap of it, which is a different problem
  decided by module size, contrast and quiet zone;

  and that the enrolment ordering behaves for a person rather than a probe.

**What is still only proven by machine**, and is worth knowing: the challenge on
a SECOND sign in, the recovery codes actually working, and the break glass. The
audits exercise all three and no person has. The recovery codes in particular
are the ones nobody finds out about until they need them.

### The three roles with no dashboard, still open

Unchanged by the above and recorded separately under the role sweep: a
dispatcher, a salesperson and a customer service account get an honest empty
state rather than a screen built for a different job. The business question,
what each should see, is the operator's and is written out with each role's
grants beside it.

## The Phase 0 role union: one defect, six instances, swept

### RESOLVED: six total functions over three roles, in a platform that ships seven

Swept 2026-09-07 on operator instruction, after the fourth instance turned up on
its own. The instruction was the useful part: five was enough to call it a
pattern and search for rather than keep discovering.

**All six are the same shape.** A total function over `Role`, the union of the
three roles that shipped in Phase 0, written when three was the whole set.
Migration 0018 made roles rows and seven ship, so each of these silently stopped
being total.

| Where | What it did for the four newer roles |
| --- | --- |
| `ROLE_LABEL` | Rendered blank in the profile menu, the roster and the eyebrow |
| `readOpsSession` | Signed them out on their own next request |
| the account creation route | Refused to create them at all |
| `homeFor` | Returned `undefined`, so they signed in and landed nowhere |
| `portalInvite` | Told a dispatcher, in writing, that they were a Field Technician |
| `dashboardFor` | Served four roles the field technician's dashboard |

**Two of them are worth singling out.**

`portalInvite` is the only one that reached somebody outside the firm. The
route validates the role against `eng_roles`, correctly, all seven, and then
wrote `role as Role` to pass it into a template whose ternary fell through to
"Field Technician". The cast sat three lines below a comment explaining that
this same route used to refuse those roles.

`dashboardFor` had the widest reach and the smallest harm, and the difference
matters: every query in `techDashboard` is scoped to `actor.id`, so what those
four saw was an EMPTY technician dashboard rather than somebody else's data. A
wrong screen, not a leak.

**Why none of it ever surfaced.** The four newer roles could not hold a session
at all, so nobody could reach any of these code paths. **Repairing the session
on the same day is what made all of them reachable at once**, which is the
honest shape of the morning: one stale list was hiding five more, and they only
became findable when the first was fixed.

**The enabling mechanism was the cast.** TypeScript had every one of these
right. Six times somebody wrote `as Role` and switched it off. Every cast in
the tree is now gone, and `role-cast-audit` fails on a new one outside an
allowlist that starts EMPTY, because grandfathering the six that caused the
sweep would have kept the mechanism that produced them.

**And one assertion replaces six.** `roles-audit` now checks a property rather
than a list of functions: every shipped role gets a real answer from every
function that takes one, 5 functions by 7 roles, 35 pairs. The registry is
`scripts/lib/role-total-functions.mjs` and adding a function that takes a role
means adding it there, the same rule the surface inventory carries. Injection
verified on two of the six, each naming the exact roles and expected values.

**Two traps removed alongside them.** `ALLOWED`, a `Map<Role, Set<Action>>`
that nothing read and that looked exactly like the authoritative permission
lookup it used to be; and `navFor`'s unused role parameter, which forced every
caller to hold a value of the narrow union and was one of the pressures
producing casts.

### There is no dashboard for four of the seven roles

Recorded 2026-09-07, and it is the honest remainder of the fix above.

`dashboardFor` used to fall through to the technician's dashboard for anything
that was not an administrator or an engineer. It now routes by CAPABILITY rather
than by role name, so a role an owner creates with review grants gets the
engineer's dashboard without anybody editing that function.

What it returns for a dispatcher, a salesperson or a customer service account is
null, and the screen says plainly that no dashboard has been built for their
role and that showing one built for a different job would be worse. That is
true and it is not finished: those three roles work in this platform and have no
overview of their own work.

Building them is product work rather than a defect fix, so it is recorded here
rather than folded into the sweep. What must not happen is a fourth generic
dashboard that renders empty tiles, which is the same defect with a different
shape.

**Operator ruling, 2026-09-07: the null stays.** A wrong screen is worse than an
honest absence, and the screen saying so is correct.

**RULED 2026-09-08, AND THE QUESTION IS CLOSED.** Phase 12 Section 2 answers
all three, and each answer is a choice between the two screens this entry said
the firm had never had to choose between. They are recorded here beside the
question rather than only in the section brief, because the question is here.

**Dispatcher: both, and the queue leads.** Unassigned jobs by county and age,
technicians available by certification and county, jobs past their capture
window, and offers outstanding with their expiry. The question was whether a
dispatcher is measured on how FAST work is placed or how WELL. The answer is
that the screen carries both and puts the ageing queue first: coverage and
technician load are on it, so placing work well is visible, but what a person
opens the screen to do is place the thing that has been waiting longest.

**Sales: their own pipeline, and no money the firm makes.** Leads by source
and stage, quotes unpaid with age, partner attribution for the period, and B2B
accounts by last order date. The ruling holds the line this entry drew: sales
does not hold `pricing.read` and nothing here needs it. Every figure is about
flow and age, not about margin or value, so the screen is complete without a
grant this role is deliberately denied.

**Customer service: work in progress, not the lead inbox.** Orders awaiting
something from the customer with what is awaited, open message threads by age
of last inbound, refunds in flight with their case, and unsubscribe requests
received by telephone. The grants suggested work in progress and the name
suggested the inbox; the grants win, because they are what the role can
actually act on.

That last item is new and is not a dashboard tile. The marketing suppression
list built in the email port has no operator screen, so somebody who asks to
be removed by telephone cannot be recorded without SQL. It is built here, as a
list with add and remove, audited.

**BUILT 2026-09-09 at `/portal/suppressions`, and "remove" is a CORRECTION
rather than a resubscribe.** 0026 is why, and it is not a technicality:
resubscribing is CONSENT, consent is a new fact with its own date rather than
the absence of an old one, and it gets its own table, its own migration and its
own ruling when somebody asks for it. So a row carrying a `token_hash` can never
be removed, whatever permission the caller holds, because that row exists
because a person clicked the unsubscribe link in their own email. The refusal is
checked against the ROW in `marketing-suppression.ts` rather than trusted to the
screen, and the screen does not render the control at all for such a row.

What can be removed is a row an operator typed wrong: a mistyped address quietly
stops a customer who never asked for anything from hearing from the firm, and
that row records no decision anybody made. Both verbs write an audit event, and
`eng_audit_events` refuses deletes, so the act stays answerable.

`suppressions.manage` is seeded by 0029 to admin and customer service. Sales
holds nothing here: somebody paid to grow a list should not be the one who can
quietly shorten it, and the request does not arrive there anyway.

**If a resubscribe is ever wanted, it is not this screen.** It is a new table
recording who gave consent and when, its own migration, and a ruling. Nothing
here should be widened to do it.

**The constraint this entry named still holds and was not relaxed to make any
of the three complete.** None of these roles holds `ledger.read_all` or
`billing.read`, and no dashboard for them carries a firm level money figure.
Where a dashboard would need a figure the grants do not cover, that is
reported rather than fixed by widening a grant.

**BUILT 2026-09-09, AND A DEFECT THIS ENTRY DENIED WAS FOUND WHILE BUILDING
IT.** All three dashboards exist, and the constraint is now carried by the TYPE:
`DispatcherDashboard`, `SalesDashboard` and `CustomerServiceDashboard` have no
`money` field, so a firm figure on one of them does not compile.

The defect: **a dispatcher was already being served the field technician's
dashboard.** `dashboardFor` routes on capability, a dispatcher holds
`offers.list_own`, and that was the technician's branch. Every tile was scoped
to `actor.id`, so every one read none and every money figure read zero. The
comment directly beneath that ladder asserted a dispatcher gets null and that no
dashboard exists for them, and this entry repeated it. Both had been wrong since
the day they were written. It is exactly the "fourth generic dashboard that
renders empty tiles" named three paragraphs above, except it was a real
dashboard belonging to somebody else. `dashboards-audit` builds an actor from
every entry in `DEFAULT_ROLES` and walks the ladder on every board run.

**Three ruled figures do not exist as facts, and are reported rather than
faked.** The ruling above says a figure the grants do not cover is reported
rather than fixed by widening a grant; the same holds when it is the SCHEMA that
does not carry it, and all three are on the screen in a "What could not be
counted" panel:

- **"Jobs past their capture window"** (dispatcher). There is no capture window
  column. `eng_files` has `evidence_due_at` and `due_at`, and
  `eng_assignments.expires_at` is an OFFER expiry. Evidence past due is counted
  and the tile says which column it counted.
- **"Orders awaiting something from the customer, with what is awaited"**
  (customer service). The only awaiting status in the whole schema is
  `awaiting_payment`, nothing names what is awaited, and outstanding intake
  answers are missing ROWS computed by `missingFor` rather than anything a query
  can count. Orders awaiting payment plus files with a payment link sent are
  shown instead.
- **"Open message threads by age of last inbound"** (customer service).
  `eng_messages` records an author and no direction, and there is no customer
  facing conversation table at all, so every thread is staff to staff and
  nothing in one is inbound. Threads by how long they have been quiet are shown
  instead, from `eng_threads.last_message_at`.

**`read_only` gets the administrator's dashboard, including firm money.** That
follows from its grants rather than from an accident: the role is given
`ledger.read_all` and `billing.read` on purpose, for a buyer's accountant or an
auditor. Recorded because it surprised the session that found it, and it will
surprise the next one.

**AND THE BUSINESS QUESTION, WHICH IS THE OPERATOR'S AND IS NEEDED BEFORE
HIRING ANY OF THE THREE.** What each of these roles should see is not a design
question with a defensible default. It is a question about what the job is, and
getting it wrong produces exactly the empty tiles this entry warns against.

What follows is not a proposal. It is the grants each role actually holds today,
which is the constraint any answer has to fit, plus the question each one raises.

**Dispatcher.** Holds `files.assign`, `files.transition`, `offers.dispatch`,
`offers.list_own`, `clients.list`, `profiles.list`, `tasks.use`,
`time.log_own`. This is the role with the most obvious dashboard of the three:
work that needs assigning, offers nobody has accepted, and technicians who are
free. The open question is the one the platform cannot answer:

  Is a dispatcher measured on how fast work is placed, or on how well it is
  placed? A screen built for the first is a queue with ages on it. A screen
  built for the second is coverage and technician load. They are different
  screens and the firm has never had to choose.

**Sales.** Holds `clients.create`, `clients.update`, `clients.list`,
`files.create`, `files.list`, `tasks.use`, `time.log_own`. Notably it does
NOT hold `pricing.read`, by a deliberate ruling recorded in roles-audit: a
salesperson seeing the fee schedule is negotiating against the firm. So:

  What does a salesperson see about money, given they may not see prices? Their
  own pipeline and their own conversions are answerable from rows the platform
  already has. Anything about margin or value is not, and should not be.

**Customer service.** Holds `clients.list`, `files.list`, `messages.use`,
`tasks.use`, `time.log_own`, and nothing that changes a file. It is the
narrowest of the three and the least obvious:

  Is this role answering questions about work in progress, in which case the
  dashboard is files by status with whatever a customer is likely to ring
  about, or is it handling inbound that has not become work yet, in which case
  it is the lead inbox? The grants suggest the first and the name suggests the
  second.

**One thing that is already decided and constrains all three.** None of them
holds `ledger.read_all` or `billing.read`, so no dashboard for these roles
carries a firm level money figure. That is not a gap to fill later; it is the
permission model working, and a dashboard that needed one would be a sign the
role is wrong rather than the screen.

## Found while starting Phase 12

### RESOLVED: four of the seven roles could sign in and were signed out by the next request

Found 2026-09-07, opening Phase 12 Section 1, because MFA is enforced at the
session boundary and the boundary had to be read before anything was added to
it. Fixed in the same commit that found it.

**What was true.** `readOpsSession` validated the cookie's role against a
literal list of the three roles that shipped in Phase 0. Phase 10 Section 2 made
roles rows and the platform ships seven. So a dispatcher, a salesperson, a
customer service account and a read only account could sign in completely
successfully: the password verified, the audit row written, `last_sign_in_at`
updated, the cookie minted and set. The very next request read that cookie,
failed the membership test, and returned null. They arrived back at the sign in
screen with no error, because nothing had gone wrong from the platform's side.

A success indistinguishable from nothing happening, which is the defect class
this repository exists to hunt, in the authentication path.

**Why nothing caught it.** `roles-audit`'s live half iterated `ROLES`, the
same three, while its pure half iterated `DEFAULT_ROLES`, all seven. Seven
roles were being reasoned about and three were being signed in. The audit was
looking at the right thing in the wrong list, which is now the fourth instance
of that shape found in this repository and the first that was a live product
defect rather than a blind audit.

**Not reachable on production today**, and that is luck rather than design:
production holds two profiles, one admin and one engineer, both in the three
that worked. Any of the four newer roles being granted to a real person would
have made it immediately visible and completely mysterious.

**What replaced it.** A shape test rather than a membership test, because the
shape is the question this layer actually has: the cookie is
`sub.role.exp.signature` split on the dot, so the role segment has to survive
that. Which roles exist is the database's question and `currentActor` asks it
on every request. `ROLE_KEY_PATTERN` and `wellFormedRoleKey` now live in
`role-rules.ts` and are used by both the roles screen and the session layer,
so the two ends cannot drift apart again.

`issueOpsSession` also refuses to mint for a key it could not sign, rather
than issuing a cookie the reader will reject. Failing at sign in is harsher and
is the correct direction: an operator sees a role that cannot be used, instead
of a person who signs in successfully and is not signed in.

**Verified both ways.** The audit fails on exactly those four roles when the
membership test is put back, and the widening was checked against escalation: a
role edited in the cookie is still refused, a tampered signature is still
refused, and a well formed role nobody signed is still refused.

**And the audit blindness is fixed, not just the defect.** The live half now
probes every role in `DEFAULT_ROLES` and makes a second, separate claim per
role: that the session survives the NEXT request. Signing in and being signed in
are different facts, and the sign in check answered 200 with a Set-Cookie for
all seven roles while four of them were already dead.

## The cutover, REOPENED 2026-09-10, and two defects the dry run found

### The database cutover is reopened and moves ahead of Section 6.

Operator ruling, 2026-09-10. The full record is in
`docs/production-cutover-plan.md`, under a notice at the top of the file. This
is the pointer, not a second copy.

**The reason, in the operator's words:** the firm can now take money and has no
restore path. TBPELS issued firm registration F-29811 the same day.

**Nothing has been executed.** Steps 1 and 3 remain done, every step that writes
anything remains unrun, and the next action is the operator's word.

**What the reopening changed, and each is stated in the plan:**

- **Step 2 is no longer done. It is eighteen migrations short.** The new project
  holds 0000 through 0023; the repository is at 0041. Both fingerprints to
  verify after the replay are in the step.
- **DECISION A is open and is the operator's:** whether the OLD production gets
  0038 through 0041 at all, given gate 2's ruling 6 said merge then apply, and
  that ruling predates this one. The plan states what it would do and why it is
  not its decision.
- **Step 8b is confirmation rather than construction.** The intake API is built;
  what is unknown is the state of the two sibling DEPLOYMENTS, and each must be
  in one of two named states before step 9.
- **Step 15 is new: the restore path.** The original sequence ended at step 14
  and never built one, so a cutover run exactly as written would have moved the
  firm onto a new database with the same gap that prompted the move.

**What is at stake, read from production on 2026-09-10:** zero files, zero
orders, zero documents, zero ledger rows. The irreplaceable set is 2 profiles, 2
leads, 1 application, one enrolled second factor and **477 audit events** that
the table refuses to let anyone delete. Everything else is telemetry. This is
the smallest the migration will ever be.

### RESOLVED: copy-project.mjs could not see the objects it was meant to copy, and reported agreement

Found 2026-09-07 in the step 5 dry run. Full reasoning under step 8 of
`docs/production-cutover-plan.md`.

The script enumerates a bucket with `list("")`, which is not recursive, so
production's two objects at `254/<uuid>/resume-*.pdf` appear only as the folder
`254`, arriving with `id: null`, which the script's own filter then drops. It
finds zero files, copies nothing, compares zero against zero and prints
**agree**.

**Fixed 2026-09-07 on the operator's instruction**, rather than deferred with
the cutover: a copy script that reports agreement while copying nothing will be
trusted the day it runs for real.

The walk moved to `scripts/lib/bucket-walk.mjs`, because a function a whole
step depends on, buried in a script that cannot be imported since it exits on
load, is a function nothing can test. The old six lines sit beside it as
`walkBucketTheOldWay` so a test can show the difference rather than describe
it, and both were run over the same development bucket with four objects at
production's exact nesting: the old one found 1 entry and none of the 3 nested
keys, the new one found all 4.

The count comparison is no longer the evidence. Every object is downloaded from
both sides and compared byte for byte, because a count comparison is what
printed agreement when both sides came from the same blind instrument. A walk
that finds nothing in any bucket now says so instead of reading as agreement.

`BUCKETS` names all five now, and the walk paginates.

### RESOLVED: three tables with rows on production were in no copy list

Found 2026-09-07 in the same dry run. Full reasoning under step 5 of
`docs/production-cutover-plan.md`.

`eng_jobs` (853 rows), `eng_cron_runs` (5,101) and `eng_metrics_daily` (39)
all arrived in 0011 and 0012, after `copy-project.mjs`'s table list was written,
and nothing noticed the list had stopped describing the database.

Two are the telemetry class CLAUDE.md already names as prunable, so losing their
history is defensible; what is not defensible is it happening without anybody
deciding it. `eng_jobs` is different while it holds live work, and the plan
gains a stop condition for that: the queue is checked for pending and running
rows immediately before the copy.

**Fixed 2026-09-07, and one thing in the first account of it was wrong.** It
said all three are `bigserial` keyed. `eng_metrics_daily` is not: its primary
key is `(day, metric)`, so it is naturally idempotent and carries no sequence.
Checked against `pg_get_serial_sequence` rather than read off the migration.
Only `eng_jobs` and `eng_cron_runs` have one.

The sequences are the part the script cannot finish, because PostgREST cannot
run `setval`. So `--apply` prints the exact statements and **exits non-zero
with the copy declared unfinished**, rather than returning success and leaving a
destination whose sequence sits at 1 while its table holds 863 rows.

**The queue stop condition is built.** At the first measurement the queue held
nothing pending or running; forty minutes later it held job 863, kind
`errors.alert`, pending.

**That job was reported as an alert about an unsent fault, and that was wrong**,
inferred from its name rather than read from the database. Production holds zero
error types and zero error events; `errors.alert` is a no-op sweep enqueued
every five minutes by health-watch; the job ran 44 seconds after being enqueued
and is `done`; and the worker is healthy, 120 of 120 minutely runs ok in the
surrounding two hours with all 864 jobs done and none dead. The full correction
is under step 5 of `docs/production-cutover-plan.md`.

The stop condition still stands, on a forward looking argument rather than that
false one: the two kinds in the queue today are periodic sweeps that come round
again and are harmless to lose, and the jobs that will be there once the firm is
taking orders, a customer email or a statement close, are not. A stop condition
added once those exist is one added after the window it was for.

**And the generalised fix, which is worth more than the three tables.** The
script reads the table names out of `supabase/migrations/` on disk, asks the
source which hold rows, and requires each to be in the copy list or in a
`NOT_COPIED` map with a stated reason. Today it declares 16 and probes the
other 53, all empty; it stops the run the moment one is not. A table added by a
future migration is a candidate the moment it exists rather than when somebody
remembers that file.

### The copy script has never been executed, against anything

Recorded 2026-09-07. Reasoning under step 8c of
`docs/production-cutover-plan.md`.

`copy-project.mjs` takes two projects explicitly and refuses when they are the
same one. The only service role key in the working tree is development's; both
others live in Vercel by standing law. **No session can run this script end to
end, and none has.**

Its parts are verified, the bucket walk and the completeness check and the row
counts, and the whole is not. The answer is not a key in the tree. It is the
operator running the dry run in an environment that already holds both keys
before the window opens, so the first `--apply` is the second time it has run.

## The performance gate, measured on a deployment

### The 2000ms remote ceiling has never been met and cannot currently be measured

Recorded 2026-09-07. The full numbers are in this file under the perf entry
above; this is the finding they produced.

`perf-budgets.mjs` says of the two ceilings: **"REMOTE is the operator's
specification and is the one that matters."** The suite has only ever measured
localhost against the empirical 3400ms local ceiling. The 2000ms remote ceiling
was set on 2026-08-31 on a day the same file records live LCP ranging from 1555
to 2901ms, so it was a target rather than a measurement, and nothing has ever
run it in anger.

**The three state gate's answer, on the deployment: eight of ten routes COULD
NOT TELL.** Only the homepage, which carries its own 3600ms ceiling, and
`/careers/professional-engineer` produced supportable verdicts. The ceiling
sits inside the run to run range of nearly every route on the site, which is a
fact about where the number was put rather than about the pages.

**The two state gate, on the same deployment an hour earlier, reported three
failures and thirty seven passes with complete confidence.** Five of those
confident passes are among the eight the new gate cannot support. The third
verdict caught false PASSES, not only false failures, and that was not the
outcome anybody predicted for it.

**A limitation of the new rule, stated rather than left to be discovered.** It
uses within run SPREAD as a proxy for whether the median can be trusted, and two
independent runs show the proxy is pessimistic:

| route | run 1 | run 2 | difference | spread |
| --- | --- | --- | --- | --- |
| `/coverage` | 2535ms | 2536ms | 1ms | 455 and 742ms |
| `/structural-engineer` | 1850ms | 1851ms | 1ms | 382 and 235ms |
| `/careers/professional-engineer` | 1851ms | 1850ms | 1ms | 161 and 153ms |
| `/insights/texas-pe-license-lookup` | 2003ms | 2001ms | 2ms | 513 and 588ms |
| `/windstorm` | 1704ms | 1707ms | 3ms | 439 and 437ms |

Five routes whose medians reproduce to within 3ms while individual samples range
over 400 to 750ms. That is a median doing exactly what a median is for, and the
gate calls several of them unmeasurable. The rule is honest and conservative,
and reading eight "could not tell" verdicts as eight problems would be reading
it wrongly.

The homepage ceiling re-derivation of 2026-09-04 did not use spread. It used
eight independent medians of three and looked at their AGREEMENT, which is the
better evidence and is the method the re-derivation below will use.

**Open, in this order, by operator ruling 2026-09-07:** investigate
`/coverage` and `/coverage/coastal-bend`, map first, reporting before
anything changes; then re-derive the global remote ceiling from the seven routes
not under investigation and not carrying their own; then decide whether the
coverage routes need a fix or their own ceiling. Nothing loosens to accommodate
a page nobody has looked at.

## The county map on the coverage routes, investigated and left alone

### RESOLVED: the map is as cheap as it can be while it is server rendered

Investigated 2026-09-07 on operator instruction, map first, reporting before
anything changed. The full reasoning now lives at the top of
`src/components/map/TexasCountyMap.tsx`, beside the code it explains, and this
is the pointer.

**The LCP element is not the map.** Asked of the browser directly through a
`PerformanceObserver` rather than inferred, the largest contentful paint on
both `/coverage` and `/coverage/coastal-bend` is the prelaunch compliance
paragraph. That is the homepage precedent repeating exactly: there it was the
hero paragraph, and the map was merely heavy. **Coordinate precision was not
touched**, for the same reason it was not touched in September, and no pixel
comparison was needed because no geometry change was ever on the table.

**The double carry is real and is not the defect the homepage fix removed.**
That distinction is the useful part. The homepage fix removed a SECOND MAP: two
maps on one page became one geometry and a `use` element. The coverage routes
draw one map, whose geometry sits in the markup once and in the React flight
payload once, and that duplication is inherent to server rendering it. Removing
it means not server rendering the map, and the map is server rendered on purpose:
the firm's claim is that it covers all 254 counties, so the counties have to be
in the HTML for anything that does not run JavaScript.

**Pre serialisation was built, verified byte identical, measured, and dropped.**
It removes only the per element descriptor overhead:

| | before | after | saved |
| --- | --- | --- | --- |
| `/coverage` | 31,167 | 30,324 | 843 brotli bytes |
| `/coverage/coastal-bend` | 26,352 | 25,378 | 974 brotli bytes |

Under 1KB on the wire, roughly 4.5ms of transfer on the gate's profile, against
a measurement whose spread on these routes is 400 to 750ms. **Seventy times
below what the instrument can resolve**, so deploying it would have returned
"could not tell" by construction. Dropped on the operator's rule, and recorded
so nobody tries it again expecting a different answer.

**The estimate that led to trying it was wrong by fifty times**, and that is
recorded rather than smoothed over: 50KB was read off the raw flight payload
size and assumed to be removable, when almost all of it is the geometry that has
to be there.

**The 254 county text list on `/coverage` was not touched.** It is the
authoritative coverage claim, `coverage-audit` checks it against an independent
canonical list, and the change was confined to the map component, which never
renders it.

### RESOLVED: map-markup-audit was cited for three days before it existed

Found 2026-09-07 while extending the treatment above.

`TexasCountyMap.tsx` said, from 2026-09-04, that "map-markup-audit asserts the
rendered bytes still match". **The name appeared nowhere in this repository
except inside that comment.** So the byte identity the homepage optimisation
promised was unguarded from the day it was claimed, and a second optimisation
was very nearly built on top of it.

A comment asserting a guarantee that nothing enforces is this repository's own
defect class, applied to itself. `scripts/map-markup-audit.mjs` exists now and
runs in the suite.

Its fixtures are **the bytes the live site actually served on 2026-09-07**,
captured before the change, which is a stronger baseline than whatever the
component happens to produce today. It compares the standalone and activeRegion
renders byte for byte, asserts the shared pair still emits the geometry once and
references it once, and counts the 254 counties so a wrong fixture cannot agree
with itself forever. Injection verified: one extra attribute per path fails both
fixtures and names the byte offset.

## Disaster recovery

### The firm has no usable restore path, and cannot get one until the cutover

Phase 12 Section 5, recorded 2026-09-07. The report is
`docs/disaster-recovery.md` and this is the pointer, not a second copy of it.

Operator ruling the same day: Section 5 is a report rather than a test until the
cutover happens, because point in time recovery rewinds a whole project and
production is still shared with four other applications. Testing the restore
would mean rewinding them too.

The mechanism exists and the firm must not use it, which is a different fault
from not having one and is stated as one. What makes it urgent rather than
academic is `eng_audit_events`: 468 rows of regulatory memory that cannot be
reconstructed from anywhere, and that a project level rewind does not route
through the append only trigger protecting them.

The volume at risk today is one afternoon of manual reconstruction. That is the
argument for the deferral being affordable, not for the gap being acceptable.

### A scheduled export outside the shared project would close it before the cutover does

Recorded 2026-09-07 alongside the report above, and deliberately not built.

Nothing exports this firm's rows anywhere. There is no backup script in
`scripts/` and no export among the three registered crons, which was checked
rather than assumed. An export to storage outside `fsaryeciduszuahgjbly` would
give the firm something it controls today without touching a neighbour.

It is out of scope of Section 5 as the operator defined it, and it is the one
action that would close the gap while the cutover stays deferred.

## Found while building the closeout

### The build guard reads a command line, so a command that MENTIONS the build directory looks like a server

Recorded 2026-09-06, hit while deleting the legacy admin surface.

`scripts/preflight-build.mjs` refuses to build when a process is holding the
build directory or an audit port, which is right and has saved a torn artifact
before. It identifies those processes by matching their command line.

**What happened.** The build was run as `rm -rf .next/dev && npm run build`.
The shell wrapper's own command line therefore contained the build directory's
name, the guard matched it, and it reported TWO next servers running out of this
repo, both of which were the invoking command itself. The same build had run a
minute earlier without the `rm`, and passed.

**Why it is worth writing down rather than shrugging at.** It is this
repository's own recurring defect inside the guard that exists to prevent a
different instance of it: a check deciding what is true by looking at something
other than the thing it claims to measure. A command line is evidence about a
process; it is not the process.

**The workaround, which is what was used.** Put the command in a script file so
the process's own command line carries none of the markers.

**The fix, when somebody touches that file.** Match on what the process is
actually doing rather than what its arguments say: a listening socket on the
audit ports, or a lock on the build directory, both of which the guard already
has access to. Failing that, exclude the guard's own process tree, which is
narrower and would have been enough here.

**Not fixed now** because it fires in the safe direction. A guard that refuses a
build that should have run costs a minute; the failure it prevents costs a
green suite scoring a stale artifact.

## Recorded elsewhere, and now indexed here

The seven the operator named, plus what the sweep found beside them. Each is
open. Each carries its reasoning in the document named, and the sentence here is
the index entry rather than a second version of it.

### RESOLVED 2026-09-06: messaging, everything addressed to you

Item 5 of `docs/messaging-section-3.md`. Mentions already notify. There was no
one place showing everything addressed to you across every thread, so a person
returning after two days read five threads to find the two that wanted them.

**Not built at the time because** Section 3 built items 1 to 4 and 6 on the
operator's word and stopped there. It was the next thing in that document
rather than a decision against it.

**Built in the closeout.** A switch above the thread list, carrying the count of
mentions written since you last read that conversation, and a list of what was
said with a link into the thread. Unread means "since you last read that
thread" rather than a second read state of its own: a mention you have already
seen in the conversation is not still waiting for you, and a per mention
acknowledgement would be a third thing to clear.

**The load bearing decision** is that it is scoped through `listThreads`, the
one function that asks `canReadThread`, rather than by querying for messages
whose mentions column contains you. That query is the obvious one and it is the
one that leaks: the mention is written into the row when the message is posted,
and what somebody may READ is decided later and elsewhere, so it would carry
message bodies out of a channel for a role they no longer hold, a file thread
for a file that was reassigned, or a direct thread they were removed from.
`searchMessages` is scoped the same way, deliberately: two ways of deciding
what a person may read is one too many, and the second one is the one that
would be wrong.

It inherits that function's cap of 100 conversations, which is recorded here
rather than papered over. Not reachable at this firm's scale; the day it is,
both surfaces need the same fix.

**Asserted** by `messaging-audit`, which reads the screen as three people: the
person named sees the message, a participant who was not named does not, and an
administrator who cannot read the thread does not.

### Messaging: edit and delete, blocked on the table

Item 7 of `docs/messaging-section-3.md`. Operator ruling 2026-09-05: do not
build until `eng_messages` can carry the record of a change.

**Why it is blocked rather than deferred.** An edit that silently rewrites what
somebody already read is worse than no edit at all, and this is the one surface
where the firm's own people coordinate about regulated work. The precondition is
a migration giving the table an edit history, not a feature flag.

### Messaging: export and retention

Item 8 of `docs/messaging-section-3.md`, half built. The binder carries a file
thread's attachments as a labelled section since Phase 11; nothing exports a
conversation and nothing expires one.

**Operator ruling, 2026-09-06: build no retention deletion yet. Keep
everything.** A firm with two staff and no customers deletes nothing at zero
cost, and a retention rule written before there is volume is a rule written from
nothing that can destroy evidence.

**The shape it takes when it is written**, recorded now so the reasoning survives
to the day the periods are chosen:

- **File thread messages and their attachments follow the FILE's retention**,
  because the binder now carries them and they are part of what the firm would
  produce about that file.
- **Direct messages and channels are operational** rather than part of any
  file's record, and take their own period.
- The actual periods are set when there is something to retain.

### RESOLVED 2026-09-06: the scroll position half of native standard point 8

`docs/PORTAL_DESIGN_STANDARDS.md`, point 8. A list that can grow renders a
bounded number of rows, and its scroll position survives navigating away and
back. The bounded half was asserted by `native-audit` through a visible row
count. The scroll position half was asserted by nothing, and it turned out it
was implemented by nothing either: the check and the behaviour were missing
together, which is why no board was ever red about it.

**Built as** `src/components/portal/ScrollMemory.tsx`, in the staff shell and
the partner shell, and asserted by `native-audit` on three properties: the
screen it tests with is actually scrollable, a forward navigation opens at the
top, and a return restores the position. Both halves of the behaviour were
injected and each failed its own check and only its own.

**Worth carrying forward.** The first implementation saved the outgoing
position in the effect that notices the pathname changed, and recorded 24px for
a screen sitting at 400px. Next's own scroll handler runs during commit and
calls scrollIntoView on the incoming segment, whose nearest scrollable ancestor
is that region, so a passive effect always reads a position the router has
already destroyed. It loses every time rather than sometimes. The position is
now read when a navigation is asked for, on a capture phase click and on
popstate. This repository's recurring defect class, one more time, in the
product rather than in a check.

### Sentry is wired and has no DSN

`docs/platform-state.md`. Release tagging, environment tagging and the scrubbing
are in place and exercised. Nothing reaches Sentry until `SENTRY_DSN` is set in
Vercel, and the status page says so plainly rather than letting it be forgotten.

**Waiting on the operator**, and on wanting the grouping and release comparison
Sentry does better than a table in Postgres. Alerting does not wait on it,
because the alert rules read this firm's own fault store.

### RESOLVED 2026-09-06: alerting on queue depth

`docs/platform-state.md`. A queue that was behind was visible on two screens and
emailed nobody. A dead letter was visible and emailed nobody.

**Not built at the time because** a depth threshold picked before there is any
traffic is a threshold picked from nothing. The condition recorded was the first
time somebody found out about a stuck queue from a customer.

**Built in the closeout on the operator's instruction, and the old concern
shaped it.** The rule carrying the weight is not a depth threshold: it is the
AGE of the oldest job that should already have run, fifteen minutes, calibrated
against the worker's cadence of one minute rather than against traffic nobody
has yet. It says the thing that matters, which is that nothing is draining. A
dead job is the second rule and needs no threshold at all. The depth threshold
is the guessy one, is ranked last, is worded as deeper than usual rather than as
an emergency, and is the one to revisit when there is traffic.

**Two things it must not do, and both are structural rather than remembered.**
It cannot run as a queued job, because a check on whether the worker is running
would be waiting in the queue it is checking, so it rides on the outage
watcher's schedule. And its email cannot be queued, for the same reason, which
makes it the second deliberate exception to the rule that all mail goes through
the queue. `jobs-audit` asserts both by name.

Migration 0023 adds `eng_alert_state`, one row per thing that can alert,
holding when it last did, so a backlog that takes an afternoon to clear does not
send an afternoon of email. The three cheaper alternatives are argued and
rejected at the top of that migration.

### Metric charts

`docs/platform-state.md`. `eng_metrics_daily` is populated daily and nothing
draws it. The dashboard shows counts.

**Not built because** a chart of a fortnight of a firm with no customers is
decoration, and a chart is the surface most likely to be mistaken for evidence.

### Uptime as a number

`docs/platform-state.md`. The watcher detects an outage and emails. Nothing
computes availability over a period, and there is no percentage anywhere.

**Not built, and it is the strongest of these decisions.** Computing it from the
watcher's own runs would produce a figure whose denominator is "times we happened
to check", and a number like that on a page invites a promise the firm has not
made.

*The condition:* a customer or an insurer asking for one.

### Retention for eng_error_events and eng_cron_runs

`docs/platform-state.md`. The `eng_jobs` half of this has its own entry below
with the three state rule. The other two telemetry tables grow forever on the
same reasoning and need the same treatment when the queue one is written.

### The prototype surfaces that were never built

`docs/portal-design-port.md` carries the table. Seven things the approved
prototype models and this platform does not have: the command palette search
index, saved views on the files toolbar, bulk table actions, an SLA engine, a
reports module, a settings screen, and per user notification channels.

**Two screens port without an affordance and say so**, which is why this is a
list rather than a set of hidden gaps: the dashboard action list is unranked
because there is no SLA engine, and the files toolbar has no saved views.

**Not built because** each is a system rather than a screen, and a presentation
workstream that built one would have been shipping a feature inside a port. The
403 in that same table is a decision rather than a gap and has its own entry.

**Found by the index sweep on 2026-09-06.** `docs/platform-state.md` said these
were "all recorded in BACKLOG" and not one of them was, which is the same defect
that produced this whole section: a document pointing confidently at an index
that did not carry the thing.

### Quote pipeline surfaces

`docs/platform-state.md`. A quote request can be taken and stored. Nothing in
the portal scopes it, sends it, or converts it to an order, so every quote only
service is a form that produces a row somebody has to find.

**Not built because** quoting is a conversation before it is a screen, and the
firm has not had the conversation yet.



## Cross repo

Items owned by a sibling repo, recorded here because they were found here.
Nothing in this section is actionable in this repository.

**The first item below is not general debt. Operator ruling, 2026-09-05: it is
the FIRST thing a session in either of those repositories should do, before
anything else it was opened for.** Those two sites carry 55 and 9 pages written
under the same regulatory gate as this one, and neither can currently detect the
class of claim that was found live on this site the day the pattern was added.

### RESOLVED 2026-09-07: the sisters have somewhere to post a lead

Closeout, ahead of Section 3 on the operator's ordering. `/api/intake/lead`,
with `docs/sister-intake-api.md` as the reference both briefs now point at.

**What it is for.** sealedengineering and stampmyplans each hold a Supabase
service role key for the shared production project and write `eng_leads`
directly. That is what made the cutover a coordination problem rather than a
deploy: move 254 alone and the sisters keep writing to the old project while the
only screen anybody opens reads the new one, and it surfaces as a customer who
was never called back. This is option three from step 8b of the cutover plan,
chosen by the operator, and it removes the coupling permanently.

**The security model in one sentence.** The brand is read off the key and there
is no field in which a caller could name one. The audit sends a body claiming
`site: "254"` with the sealed key and asserts the row comes back as sealed.

**Keys are environment variables, not rows**, one per sister, at least 24
characters, compared in constant time over a hash. Nothing configured is a 404
rather than a 401, so an unconfigured endpoint and a missing one look the same
to somebody probing. Production and Preview are the operator's to set;
development has its own so the audit can exercise the real write path.

**A retry is not a second lead.** Ten minutes, fingerprinted on brand, form,
address, telephone and message. A person who genuinely writes twice inside ten
minutes is recorded once, which is a smaller harm than the operator ringing them
twice, and it is stated rather than discovered.

**A failed write is answered honestly**, which is the opposite of what this
platform's own forms do for a person, and the reason is that the caller is a
server: a person told "we have it" is reassured, a server told that stops
retrying. The response carries whether the notification email left, so the
sister knows whether to retry or whether a person already has it. That send is
the third deliberate exception to "all mail goes through the queue", after the
outage alert and the queue alert, and for the same reason: the queue is a table
in the same Postgres.

**Injected.** A route that trusted the body over the key was refused by the type
system first, and when forced through with a cast it was caught by the check
that reads the row. The same injection showed the response check being fooled,
because the endpoint answered "sealed" while writing "254", so there is now a
check that what it answers and what it wrote agree.

**What is left for the sisters**, and it is in both briefs: post instead of
writing, then delete their Supabase credentials. Until they do, their two
variables still move in the cutover window.

### The two sibling briefs are written and are the entry point for those repos

Written 2026-09-07, closeout Section 2. `docs/brief-sealedengineering.md` and
`docs/brief-stampmyplans.md`.

Each is written for a session opening cold in that repository, with every file
to copy named by path, every check named by command, and the reasoning included
rather than referenced. Neither repository was read or touched from here, which
is the standing instruction, so where a step depends on what is actually in that
tree the brief says what to verify rather than asserting what is true.

**What each one carries.** The regulatory library sync first, ahead of whatever
the session was opened for, with the four additions explained and an injection
to run before the green is believed. Then, for sealedengineering, the `/order`
307 assertion and the order flow; for stampmyplans, the order flow first because
the brand cannot take an order at all, and then what it would take for nine
indexable pages to become a corpus rather than a brochure.

**Both state the environment variable position plainly**, because both
deployments write `eng_leads` and `eng_orders` in the shared production project
and 254's portal reads that inbox with no site filter. If 254 cuts over alone,
the sisters keep writing to the old project while the only screen anybody opens
reads the new one, and it surfaces as a customer who was never called back.

**Both are wrong the day the intake API ships**, and both say so and point here.
That is the entry that follows.

### FIRST TASK IN sealedengineering AND stampmyplans: copy the regulatory pattern library across

Recorded 2026-09-05, Phase 9 Section 4. Operator ruling the same day: this is
the first thing a session in either repo does, ahead of whatever it was opened
for.

**Why it outranks the work in front of it.** sealedengineering carries 55 pages
and stampmyplans 9, all written under the same gate, and the detector on both
sites is currently blind to a claim that this site was found making live. The
question is not whether they have one. It is that nobody there can see it.

**What to copy.** `scripts/lib/regulatory.mjs` from this repository, verbatim,
which is how that file is meant to travel. Then run that repo's voice audit and
launch audit and read what they say before changing any copy: a page that has
been serving a claim for a month is a page whose fix belongs in a commit that
says so.

**What the three additions are.** CONDITIONAL_GUARD, a pattern for a third
person service claim naming the firm, and a pattern for "performs and seals". `scripts/lib/regulatory.mjs` is a
synchronized file, copied verbatim into sealedengineering and stampmyplans,
because all three brands are Texas engineering firms under the same board with
the same regulated vocabulary and the same pending gates.

**This repository's copy now has three things the other two do not.** A
CONDITIONAL_GUARD, a pattern for a third person service claim naming the firm,
and a pattern for "performs and seals".

**Why they were added.** The library was written from the first person and the
passive voice, and caught neither of the two forms that matter to a partner
programme: a brand writing about itself by name. Phase 9 Section 4 put "254
Engineering Services performs and seals every engagement referred through this
programme" on three partner screens and nothing in the suite saw it.

**And it immediately found a live one.** /government carried "254 Engineering
Services delivers inspections, sealed engineering letters, certifications, and
design", under a heading reading "what this firm is BUILT to deliver". It has
been served that way to procurement officers while the registration is pending.
Fixed here.

**Why it was not done from here.** Standing operator instruction: those repos
are out of scope from this session and are not to be touched. The divergence is
real until a session in each one copies the file across, and that is the first
thing each should do.

### sealedengineering /order must return 307 and never 308, and nothing asserts it

Recorded 2026-09-04 during the three site sitemap audit. Operator ruling the
same day: add the assertion when a session next opens in that repo.

**Why this is here and not there.** `~/projects/sealedengineering` has
uncommitted work on `main` (`BACKLOG.md`, `scripts/registry-audit.mjs`,
`src/data/keyword-registry.ts`) from another session. Appending to a dirty tree
risks this entry being committed with unrelated work, or being lost when that
work is reset. The operator's instruction allowed for exactly this fallback.

**What to add there.** An assertion that `/order` responds **307** and never
**308**, with the reasoning in the check rather than only in a commit message.

**The reasoning, which is the part worth carrying across.** In prelaunch
`/order` calls `redirect("/waitlist")`, because a form that cannot be
submitted is worse than a page that sends you somewhere useful. That redirect is
TEMPORARY and must stay temporary: at launch `/order` stops redirecting and
becomes the order flow. A 308 is cached hard by browsers and by search engines,
so every client that saw one would keep sending itself to `/waitlist` after
launch, and the highest intent page on that site would be unreachable for
exactly the people who had visited before. The server would be serving the right
thing and the client would never ask for it, which is close to undiagnosable
from the outside.

**Why it is at real risk of being "tidied".** A permanent redirect looks more
correct to a reader who does not know the page is gated, and this analysis
nearly made that exact change: the operator's first ruling was to make it
permanent, and it was withdrawn only because the gate was read first. A comment
alone did not stop the near miss. An assertion would have.

**The related trap already recorded in that file.** `/order/page.tsx` carries
`export const dynamic = "force-dynamic"` and a comment explaining that it is
load bearing: when the page was prerendered, `/order` served a build time
redirect to `/waitlist` while `/waitlist` evaluated the launch flag at
runtime and redirected back, producing ERR_TOO_MANY_REDIRECTS and an unreachable
order flow. Found by `forms-audit` running a live server against a prelaunch
build, which is the state a deploy is in between an environment change and the
next build. The 307 assertion belongs beside that one.

**Not a defect today.** `/order` currently returns 307 correctly. This is a
guard against a plausible future edit, not a repair.

## Before a partner can sign in on production

### PARTNER_SESSION_SECRET is the operator's to set, and is set aside for them

Recorded 2026-09-05, Phase 9 Section 4. `partnerSessionConfigured()` returns
false without it, which closes the partner portal completely: the sign in screen
renders, says it is not configured, and refuses every attempt.

That is the correct failure direction and it is not a defect. It is recorded
because the day a first partner is created on production, this is what will make
their link not work, and the symptom will look like a broken account rather than
a missing variable.

**Operator ruling, 2026-09-05: set aside, they will add it in Vercel.** It is
not a blocker for anything being built, and no session should generate a
production session secret and hand it over in a transcript.

**What it needs to be.** At least 24 characters, set for Production and again
for Preview, exactly as OPS_SESSION_SECRET and CUSTOMER_SESSION_SECRET are set. It is its own variable on purpose: rotating one
session secret must not sign out the other two.

Development has one, written to .env.local and never echoed.

### DONE. The corrected /government copy is live and was confirmed on the domain

Recorded 2026-09-05. Operator instruction the same day.

The page said "254 Engineering Services delivers inspections, sealed engineering
letters, certifications, and design" while the firm's registration is pending.
It is corrected on this branch and production is still serving the claim until
this merges and deploys.

**Confirmed 2026-09-06 against https://254engineering.com/government**, not
against the build. The live page now reads "The firm is built to deliver
inspections, sealed engineering letters, certifications, and design", and the
string "delivers inspections" appears zero times in the served HTML.

It took three polls across roughly a minute for the deploy to replace it, and
the first two served the old claim. Recorded because it is the interval in which
a deploy is reported as done and the old page is still being served.

## Left by Phase 9

### Eight probe partners on development cannot be deleted, and should not be

Recorded 2026-09-06, found by building the operator roster in Section 6 and
looking at it. Eight rows reading "ZZ probe, safe to ignore", created on
2026-09-04 by an end to end script for Section 2 that is not in the tree.

**Seven of the eight are held by their own evidence.** eng_partner_touches
refuses DELETE by trigger, and it references the partner with ON DELETE
RESTRICT, so a partner who was ever touched cannot be removed. That is 0014
working exactly as written: a touch is what a dispute is settled from, and
evidence that can be deleted after the decision is not evidence.

**No action, and this entry exists so nobody takes one.** The obvious repair is
to loosen the trigger, and it would be the wrong repair. Same standing as
eng_audit_events. The sweep in probe-ledger.mjs removes what it can, leaves the
rest, and reports the count; the roster puts ended partners behind a disclosure.

Nothing in the committed suite creates them, so this is history rather than a
leak. Production has no partner rows at all.

**CLOSED 2026-09-08 by 0028, without touching the trigger.** Deletion was only
ever a proxy for the thing that actually mattered, which is telling a probe
apart from a partner. `is_demo` does that directly, so all eight are marked and
none of them can reach a figure on any report. They still cannot be deleted and
they still should not be.

They were found again on the way there, which is the part worth keeping. 0027's
backfill matched demonstrations by NAME, so it caught the records whoever wrote
it could remember and missed these plus three "Stripe Probe" clients and one
client written by a script that is not in the tree either. demo-audit's detector
was extended from orders to profiles, partners and clients, named all twelve on
its first run, and 0028 marks them by the address rule in
`src/lib/ops-files.ts` rather than by a name. **0028 is applied to development
and to production**, and on production it marked nothing, because production
holds two profiles, one application and no partners, clients, orders or files.

### Phase 12 Section 3, retention: the inventory is in docs/retention-inventory.md

Recorded 2026-09-09, gate 0. Measured against both live databases rather than
estimated. The floors are the operator's and are not set yet.

The three things a reader needs from it without opening it: **production is
already growing at 51,878 rows a month from `eng_cron_runs` alone, at a rate
that does not depend on the firm**; **ten tables refuse deletes at the database
and a retention job cannot touch them**, proved by attempting one with the
service role; and **this repository states no retention period for any record
anywhere**, while the privacy policy has already promised the public that
engineering records are kept for the periods Texas requires.

The full inventory, the deadline ranking of the twenty two reads, the rollup
coverage and the three decisions it raises are in the document.

### THE SILENT THOUSAND: every unbounded read, ranked by what it corrupts

Recorded 2026-09-09 on the operator's ruling, after `ROW_CEILING` was added to
the reports. **Report only. Nothing here is fixed.**

**A NAMING CORRECTION, KEPT RATHER THAN QUIETLY APPLIED.** This entry and the
export work beside it were reported as "Phase 12 Section 3". They are not.
Exports were **Section 3 of the reporting prompt**, which was Phase 12 Section 2.
**Phase 12 Section 3 is RETENTION**, and this list is its starting point rather
than a note filed near it: retention is the answer to the question this survey
asks, which is how big each table is allowed to get before a read of it silently
lies. Operator correction, 2026-09-09. The mislabel is recorded because a
section number that means two things is a section number nobody can search.

**The fact underneath it.** PostgREST returns at most 1000 rows and says nothing
when it truncates. Measured on development: `eng_audit_events` holds 7,063 rows
and `.select("id")` returns exactly 1000, no error, nothing on the response.
So any read that returns a LIST and is then counted, summed, grouped or written
back is silently wrong once its matching set passes a thousand. Not slow. Wrong,
in the flattering direction for a cost and the unflattering one for revenue.

`src/lib/ops-reports.ts` is the one module that has solved it: `{ count: "exact" }`
paired with `(count ?? 0) > data.length`, returning `tooLarge(...)` instead of a
figure. That pattern is what everything below is missing.

**Retention is where this closes, which is why it is recorded rather than
patched.** How big these tables are ALLOWED to get is a retention decision, and
the operator ruled on 2026-09-06 to build no retention deletion yet, because a
rule written before there is volume is written from imagination. Every entry
below is a consequence of that ruling rather than a defect somebody introduced,
and the order to fix them is the order retention decides. See "Messaging: export
and retention" above for the standing position.

**Nothing here is live today.** Production holds no orders, files or payments.
The ranking is what breaks FIRST on a live firm, not what is broken now.

**ALL TWENTY FOUR ARE CLOSED.** Phase 12 Section 3, Section 1, 2026-09-09. The
table below is kept struck through rather than deleted, because the reasoning
for each is why the fix took the shape it did, and a list that shrinks to
nothing teaches the next reader nothing.

**One helper, `src/lib/bounded-read.ts`, two shapes, and the choice between them
is a judgement about the FIGURE rather than about size.** `readAll` takes one
bounded page and reports the true total, for figures that can honestly say "not
known". `readEvery` pages until the set is exhausted, for answers that cannot be
partial: a statement total written back, a period close that claims entries, a
permission set, a checkout's line items.

**Proved against a real table at real scale, not a fixture.** On
`eng_audit_events`, 7,627 rows on development:

```
old shape  .select() with no bound : 1000 rows, and NO error
readAll    one page + the true size: 1000 rows, total 7627, complete=false
readEvery  pages until short       : 7627 rows, complete=true

old shape lost 6627 rows and said nothing.
```

**Two audits went red while this was done, and both were right to.** jobs-audit
asserted `if (error) return null` by pattern and the pattern moved; it names the
new one exactly now and gained a check that the queue read pages, because a
backed up queue is when its set first exceeds one request. order-audit asserted
the statement header is recomputed from its lines and could not see HOW MANY
lines it read, so a statement over a thousand lines would have had its header
computed from part of itself and written back. That is the disagreement the
recompute exists to prevent, arriving through the door the check was not
watching.

**RANKS 1 AND 2 WERE FIXED FIRST, AHEAD OF THE REST.** Operator ruling,
2026-09-09: the two reads in `ops-engineer.ts` are closed before the branch
merges, because both are regulatory and one was already truncating rather than
waiting to.

- **The monthly export refuses rather than truncating.** It reads with
  `{ count: "exact" }` and, when the true count exceeds what came back, produces
  NO FILE and a sentence saying so. A short responsible charge log is worse than
  none: a regulator reading it has no way to know a row is missing and every
  reason to assume none is. Injection verified by lowering the page to 5 against
  a log of 28, which is the same condition a month of 501 reviews makes against
  a page of 500; it refuses with the count in the sentence.
- **The period picker pages.** It asked for 2000 and received 1000 without an
  error, the only limit in the repository above the cap, so it was already
  losing months on any firm with that much history. Verified at real scale
  rather than with synthetic rows, because this table refuses deletes and a loop
  is not worth permanent fake entries in a regulatory record: the identical loop
  run over `eng_audit_events`, which holds 7,421 rows, sees **1,000 under the
  old `.limit(2000)` shape and all 7,421 paged**.

**Two carry an explicit limit and are therefore invisible to any ceiling guard,
which is why they were at the top.**

| Rank | Where | What breaks | Why it is where it is |
| --- | --- | --- | --- |
| ~~1~~ | ~~`ops-engineer.ts:576`~~ | FIXED 2026-09-09. Refuses rather than truncating. | Below the ceiling, so a ROW_CEILING guard would never have fired. The count is what catches it. |
| ~~2~~ | ~~`ops-engineer.ts:603`~~ | FIXED 2026-09-09. Pages. | Was already truncating, not waiting to. |
| ~~3~~ | ~~`ops-statements.ts:183`~~ | A customer statement's HEADER TOTAL, recomputed from its lines and written back to `eng_statements.total_cents`. | Verified. The comment three lines above says the recompute exists so a header "cannot disagree with what is printed beneath it". Truncation is exactly what makes it disagree, and the number is one a customer is charged. |
| ~~4~~ | ~~`ops-statements.ts:323`~~ | The pre-charge integrity check that compares the line total to the header before taking money. | Verified. Truncation makes a correct statement fail and refuse to charge, or, paired with rank 3, makes a wrong one pass. |
| ~~5~~ | ~~`ops-statements.ts:130`~~ | Orders past row 1000 are never turned into statement lines at all. | Not a wrong figure: unbilled revenue, invisible. |
| ~~6~~ | ~~`ops-partner-comp.ts:613`~~ and `:685` | The period close. Only 1000 entries are claimed into a statement, the rest stay unclaimed, and the issued statement is short. The backlog grows every close. | Verified at `:919` and by reading both. This is money a partner is paid. |
| ~~7~~ | ~~`ops-partner-comp.ts:919`~~ | A partner's own payable balance, `partner_id` only, no period, LIFETIME. | Verified. The highest volume partner breaks first, and the figure is the one they are paid on. |
| ~~8~~ | ~~`ops-partners-admin.ts:69`~~ | The admin partner roster: every entry for up to 200 partners, lifetime, in one query. | Verified. **Certain to break earliest of the money reads**, because it is the only one that multiplies the roster by all of history. Every partner below the cut shows nothing payable. |
| ~~9~~ | ~~`ops-field.ts:1322`~~ | Every technician's pending and paid totals on the roster, lifetime, whole roster. | `sumKnownPay` returns null for an unpriced row and has no way to see a row that never arrived. |
| ~~10~~ | ~~`ops-dashboard.ts:730`~~ | One technician's "Owed to you", `tech_id` only, no period. | The tile whose whole point this section just made is not showing somebody money they will not be paid. This shows them LESS than they are owed. |
| ~~11~~ | ~~`ops-bulk.ts:337`~~ and `:343` | The credit decision: unpaid balance and unbilled exposure both read low, so credit is granted past the limit. | |
| ~~12~~ | ~~`ops-dashboard.ts:533`~~ | An engineer's review count and review minutes for a period. | A licence figure, bounded by one month, so it takes a very high volume engineer. |
| ~~13~~ | ~~`ops-dashboard.ts:573`~~ | An engineer's own production pay for the month. | |
| ~~14~~ | ~~`ops-payments.ts:195`~~, `:296`, `:360` | A bulk submission over 1000 properties is charged for the first 1000 lines, and orders past 1000 stay stuck in `awaiting_payment` after the batch was paid. | |
| ~~15~~ | ~~`ops-docs.ts:197`~~ | A refusal reason missing from an assembled sealed deliverable. | Bounded to one file, so unlikely, but it is a regulatory artefact. |
| ~~16~~ | ~~`ops-jobs.ts:330`~~ | Queue depth, dead letters and the oldest waiting job. | Verified. The comment beside it insists a failed read is not an empty queue. A truncated one is not a small queue either, and it truncates exactly when the queue is deep, which is the moment the number matters. |
| ~~17~~ | ~~`ops-observability.ts:325`~~, `job-handlers.ts:440` | Error rates per fingerprint during an incident, and the alert thresholds that read them. | Truncates precisely during a storm, so the alert never trips. |
| ~~18~~ | ~~`ops-auth.ts:117`~~ | The actor's granted action set. | Small today and latent rather than live, but a truncated grant list silently DENIES actions. Worth knowing it is on this list at all. |
| ~~19~~ | ~~`ops-reconcile.ts:95`~~, `:138`, `:150`, `:151` | The reconciliation worklist, and the payment and event lookups beneath it, which truncate before the order list does so orders wrongly appear unpaid. | The comment asserts "the number waiting on payment is small by definition". That is the assumption at risk. |
| ~~20~~ | ~~`ops-accounts-admin.ts:52`~~–`:69` | The account roster and its per-account order counts, all accounts, all orders ever. | |
| ~~21~~ | ~~`ops-dashboard.ts:1202`~~, `:1217`, `:1476` | Sales and comms tiles reading `eng_leads`, `eng_quote_requests` and `eng_threads` with NO FILTER AT ALL. | Leads and threads unfiltered are near certain to pass a thousand first of anything on a dashboard. |
| ~~22~~ | ~~`ops-partners.ts:130`~~, `:194`, `.limit(50)` | Attribution touch history. | Limited, so not truncating at the ceiling, but a truncated touch list can change WHICH partner an order is attributed to, and attribution decides commission. Worth a second look on its own terms. |
| ~~23~~ | ~~`ops-threads.ts:96`~~–`:195`, `ops-field.ts:430`–`:1324`, `ops-tasks.ts:426`, `ops-crm.ts:249`, `ops-metrics.ts:228`, `ops-dashboard.ts:496`, `:1017`, `:1026`, `:1035`, `:1235`, `:1460`, `:1492`, `:1500` | Participant lists, dispatch scoring, credential tiles, metric series, stale task cleanup. | Operational lists and counts. Wrong rather than dangerous. |
| ~~24~~ | ~~`marketing-suppression.ts:157`~~, `ops-partner-assets.ts:61`, `ops-onboarding.ts`, `onboarding.ts:302`, `ops-roles.ts:52` | Rendered lists that understate themselves. | Cosmetic. The suppression SEND check is a per address lookup at `:116` and is unaffected, so nobody is emailed wrongly. |

**Bounded by a single parent row and effectively safe**, listed so nobody
re-surveys them: `ops-customer.ts:132`, `ops-payments.ts:759`/`:907`/`:935`/`:1077`,
`ops-partner-portal.ts:159`, `ops-partner-comp.ts:505`/`:943`,
`ops-file-inputs.ts:29`, `ops-notify.ts:62`, `ops-account.ts:126`,
`account-api-keys.ts:139`, `ops-field.ts:987`/`:1025`/`:140`/`:199`/`:401`/`:1523`.

**What fixing one looks like**, when retention says it is time: pair
`{ count: "exact" }` with the read, compare `count` to `rows.length`, and return
an absence with a reason rather than a figure. `ops-reports.ts:143` is the
helper and `ops-reports.ts:135` is the ceiling.

### A report export queues the record, not the file, and what the other way needs

Recorded 2026-09-09, on the operator's ruling asking what "through the job
queue" actually means here.

**What it means in one sentence.** The CSV is assembled inside the request and
handed straight back, because the person who clicked Export is standing in front
of the response; what goes on the queue is an audit row saying a report of that
period was assembled with that many figures over that many rows.

**It is naming, not a completion claim, and that was the ruling's condition.**
The enqueue happens after `reportCsv` has produced the body, from the same built
object, so nothing records a file that was never made. It asserts no hash and no
delivery, so there is nothing for a file to fail to match.
`reporting-audit` asserts that ordering rather than trusting it, because
reversing the two lines is all it would take to turn the row into a claim about
a document that may not exist.

**THE CEILING IS 1000 ROWS, AND IT IS NOT ABOUT SPEED.** Operator ruling,
2026-09-09: state a ceiling, refuse above it with a sentence rather than timing
out, and put the ceiling beside this entry so the day it fires the next step is
already written. `ROW_CEILING` in `src/lib/ops-reports.ts` carries the same
reasoning, and the two are meant to be read together.

The ruling expected the number to come from the perf gate's remote limit. It does
not, and the measurement is why. Serialising 50,000 rows takes 43ms and produces
4.19MB against a 2760ms LCP ceiling, so assembly is nowhere near the constraint.

**PostgREST returns at most 1000 rows and says nothing about it.** Measured on
development, 2026-09-09: `eng_audit_events` holds 7,063 rows and `.select("id")`
returns exactly 1000, no error, nothing on the response to say so. A figure whose
query matches more than that is not slow, it is WRONG, and wrong quietly. Worse,
the export's manifest would agree with it, because the row count in the file
comes from the same truncated array.

So above the ceiling a figure is an absence with a reason rather than a total,
every builder refuses to state one, and the export route answers 413 with the
sentence rather than handing over a file that looks complete. Production holds
no orders, files or payments today, so nothing is near it; it is written now
because the failure is invisible when it arrives.

**What making the FILE the queued artefact would need**, none of which exists,
and which is the step to take the day the ceiling fires:

- Somewhere to put it. A private bucket, with a retention rule, because these
  files name properties, people and amounts.
- A way to hand it over afterwards. An email carrying a signed link, or a
  downloads screen somebody comes back to. Without one this is the rule
  `docs/platform-state.md` already states: a queued CSV is a CSV nobody
  receives.
- The record written AFTER the object is stored and keyed on its HASH, so a
  retry cannot record a file that was never written, and so the row and the
  bytes can be checked against each other later.

**No action.** It is worth building the day an export is too large to assemble
in a request, or the day somebody wants a scheduled monthly export sent rather
than fetched. Neither is true, and building storage and delivery to solve
neither would be three new failure modes for no gain.

### One development client was written by a script nobody can name

Recorded 2026-09-08, found by the same sweep. `eng_clients` on development holds
"Demo Solar Installers LLC" at `orders@example.com`. What can be said about it:
the name appears nowhere in this repository, no committed script creates a
client with that name or that address, and it is the same shape as the eight "ZZ
probe" partners and the three "Stripe Probe" clients, all of which came from end
to end scripts written during earlier sections and never committed.

**No action, and none is possible.** There is no script to fix. 0028 marked it,
so it reaches no figure on any report, and demo-audit's detector now sweeps
`eng_profiles`, `eng_partners` and `eng_clients` on every board run, so the next
one is named on the day it is written rather than in the next inventory.
Production holds no client rows at all.

### Orders attributed before 0022 cannot have their link touches shown

Recorded 2026-09-06. Section 6 added the column that joins an order back to the
touch log; orders attributed before it never stored the key.

**No action is possible.** The key was a cookie value that was never written
down, and it cannot be recovered. The dispute screen says so rather than showing
an empty list, because an empty list is the claim that there were no touches.

On production this costs nothing: no partner exists there, so no order has ever
been attributed.

### Phase 9 is complete, and what it deliberately does not do

Recorded 2026-09-06. Sections 3 to 6 are built. What was ruled out along the
way, so nobody reads an absence as an oversight:

- **No white label.** Rejected at gate 0 with the reasoning in
  docs/partner-program-decision.md, and it is not a configuration flag.
- **No self signup.** A partner using the firm name is a decision the firm makes.
- **No partner editing their own payout details.** A referrer who can change
  where money is sent, from a session, is the shape of every payout fraud that
  has ever worked.
- **No dispute button in the partner portal.** A dispute is settled by an
  operator recording a decision and a compensating entry. A button that filed
  into a queue nobody watches would be worse than an email address.
- **No tier uplift at close.** Tiers apply forward, which is the only reading
  compatible with accruing at delivery and never editing an accrual.
- **No partner logo.** eng_partners holds a name and no logo. The asset bucket
  exists now, so this is a column and an upload rather than a design question.

**And the fee splitting question is still unanswered.** Whether a percentage of
an engineering fee may be paid to an unlicensed referrer is for TBPELS or a
licensing attorney. All four models are configuration, so the answer changes a
row rather than a code path, and it should arrive before a partner is paid.

## Suspended by decision

### RESUMED 2026-09-05. Phase 9 was suspended after Section 2, and Section 3 is now built

The entry below stands as written, because it explains a state that lasted a day
short of a week and because the reason it gives for merging early is still the
right reason. What has changed:

**Section 3 is built.** `eng_partner_entries` is the ledger, accrual happens in
`transitionFile` at delivery and in `convertLead` at qualification, reversal
happens in all three paths that record a refund, and `marginOf` carries the
fourth cost as a required property. The rulings are in
`docs/partner-compensation.md`; the ones most likely to be argued with are that
a qualified lead fee is never reversed by a refund, and that volume tiers apply
forward rather than retroactively.

**Sections 4, 5 and 6 remain**, in the order the phase defined them, and the
paragraph below still describes them. Section 4, the partner portal, is now the
one that makes the proxy branch load bearing, and it is to be built to the
native standard from Phase 11 Section 2 rather than the pre standard portal.

**Still true, and still the thing that makes this inert:** production has no
partner rows, so nothing accrues there and nothing is owed to anybody. What is
new is that the machinery to owe somebody something now exists, and the
condition that makes it urgent is unchanged: a real partner agreement being
signed.

### The original entry: Phase 9 suspended after Section 2, with Sections 3 to 6 unbuilt

Recorded 2026-09-04. Operator decision the same day: merge Phase 9 Section 2 and
start Phase 10. This is a deliberate stop, not an abandonment and not an
oversight, and it is written down because the state it leaves on main looks
exactly like an oversight to somebody reading the code cold.

**What is on main.** The partner tables (0013), attribution (0014), the pure
attribution rule in `src/lib/attribution-rules.ts`, the capture path at
`/api/referral` with `ReferralCapture` in the public chrome, a hand entered
referral code on the order flow, partner attribution on orders and on leads, the
partner session module, and the partner branch in the proxy with both prefixes in
the matcher. `partner-audit` gates all of it.

**What is NOT on main, and this is the part that reads as a mistake.** There is
no partner portal. There are no pages under `/partner` and no routes under
`/api/partner`, so the session module and the proxy branch guard a surface that
does not exist yet. A partner today can be attributed business and has no way to
see it, and nothing pays them, because compensation is Section 3.

**Why merging it anyway was right.** Migration numbering. Main was at 0012 and
this branch carried 0013 and 0014. Phase 10 Section 2, roles and permissions,
needs migrations of its own; branching Phase 10 from an unmerged main would have
produced a second 0013 and two orderings of the same number reaching production
depending on which merged first. Merging first makes Phase 10 start at 0015 and
the question never arises.

**Why it is inert in production.** `/api/referral` records a touch only when the
code matches an ACTIVE partner, and production has no partner rows at all. Every
`?ref=` on the live site is a 204 that writes nothing. The firm begins
accumulating attribution the moment a first partner exists and not before.

**What remains, in the order the phase defined them:**

3. Compensation and payout: the four models as configuration, accrual on
   delivery, reversal by counter entry and never by editing an accrual, the
   holdback window, partner statements in their own table, and `marginOf`
   gaining a fourth cost with its own injection test in `money-audit`.
4. The partner portal, mobile first and deliberately narrow. This is the section
   that makes the proxy branch above load bearing rather than latent.
5. Marketing assets, and the compliance of partner copy against the four non
   negotiables the operator set: the performing firm named near the offer, no
   partner surface making a claim the public site could not, no partner name on
   a deliverable or the responsible charge log, and partner branding primary
   only inside the partner portal.
6. The operator's side: the partner roster, approving and suspending, and the
   attribution disputes screen.

**The condition that makes this urgent:** a real partner agreement being signed.
Until then the program earns nothing and owes nothing, and the attribution being
captured now is the thing that makes Section 3 possible to build honestly later,
because it will have real touches to reason about rather than invented ones.


## Blocked on the owner

### DONE. The logo arrived and is integrated

Delivered with the approved v5 design as `logo.png` and `logo-dark.png`, now in
`brand-assets/` and served from `public/brand/`. `Wordmark.tsx` renders the real
lockup, `npm run brand-rasters` regenerates the icon set, the apple icon, the
favicon, and the OG card from the artwork, and the schema Organization logo
points at the mark rather than at the social card.

The icon is the reverse artwork cropped to the numerals on deep navy: the full
lockup at 16 pixels turns the descriptor into a smudge under the part that
matters.

Kept rather than deleted because two notes in it are still live. The artwork navy
is `#012758`, deeper than the UI navy `#14315D`, and the artwork is deliberately
not recoloured to match. And `scripts/brand-rasters.mjs` still restates palette
values that also live in `globals.css`, because the script runs in node and
cannot resolve the Tailwind theme; that duplication is now permanent rather than
time limited, so it is listed under Engineering below.

The original entry follows.

### The logo did not exist

Every mark on this site is a typographic placeholder: the header and footer
wordmark in `src/components/brand/Wordmark.tsx`, the favicon set, and the Open
Graph card. All of them are generated from `scripts/brand-rasters.mjs`.

**Why it is filed rather than worked around.** A commissioned logo is in
progress. Designing a second placeholder to replace the first one would cost the
same work twice.

**What to do when the artwork lands.** Replace the markup in `renderMark()` and
`ogHtml()` in `scripts/brand-rasters.mjs`, update `Wordmark.tsx`, and run
`npm run brand-rasters`. Everything downstream regenerates: `src/app/icon.png`,
`src/app/apple-icon.png`, `src/app/favicon.ico`, and `public/og/default.png`.

**Related.** `scripts/brand-rasters.mjs` restates three hex values and a font
stack that also live in `src/app/globals.css`, because the script runs in node
and cannot resolve the Tailwind theme. That duplication is deliberate and time
limited: the whole file is replaced when the real logo arrives.

### SAM.gov UEI and CAGE are withheld from the page

`/government` renders "withheld until confirmed against the active SAM.gov
record" in place of both identifiers. `samRegistration` in
`src/config/business.ts` holds `uei: null` and `cage: null`.

**Why they are not on the page.** A contracting officer checks a UEI against SAM
in about fifteen seconds. A wrong one reads as a firm that does not know its own
registration, which is worse than no identifier at all.

**Wanted.** Robert confirms both values against the live SAM record, they go into
`samRegistration`, and the page renders them with no other change.

**Also unverified.** `samRegistration.registered` is currently `true` on
instruction and has not been checked against SAM by this build. Setting it to
`false` removes the claim from the credentials strip, the capability statement,
and `/llms-full.txt` at once.

### No phone number is published anywhere

`business.phone` is `null` and the placeholder audit treats ANY ten digit number
in a phone shape as a finding, on every route, in page text, in `tel:` links, in
meta tags, and in JSON-LD.

**Why.** No number has been chosen. A published number is a commitment to answer
it, and a fabricated one on a government capability statement is the exact defect
`scripts/placeholder-audit.mjs` exists to catch.

**What ships when a number exists.** Set `business.phone`, add the digits as
`REAL_PHONE_DIGITS` in `scripts/placeholder-audit.mjs` so the audit enforces that
one number rather than forbidding all of them, and add `telephone` to the
Organization schema in `src/lib/schema.tsx`. `/contact` already carries a sentence
saying a number will appear sitewide when there is one.

### info@254engineering.com has to exist before launch

It is the only public address on the site and it is the point of contact printed
on the capability statement. A bounce there is a lost solicitation.

### The capability statement PDF is not written

`/government` says a one page statement in the format contracting officers file
will be published once registration is active and the SAM identifiers are
confirmed, and offers it by email in the meantime. Both of those are true today
and both stop being true the moment either dependency lands.

### Launch mode flip needs authorization

`LAUNCH_MODE=live` is built and audited in both directions by
`scripts/launch-audit.mjs`, which asserts 28 properties across the two modes.
Flipping it is Robert's decision and it requires the TBPELS firm number, which
goes in `TBPELS_FIRM_NUMBER`.

**One operational note.** Almost every page is statically prerendered, so the
gate is resolved at build time. Changing the variable requires a redeploy to take
effect. On Vercel that is already true of any environment variable change, so
nothing extra is needed, but it does mean the firm cannot be moved from pending
to open by restarting a process. See the note in `src/lib/launch.ts`.

## Engineering

### RESOLVED 2026-09-06. A failed database write is no longer answered with success

Operator ruling, 2026-09-06: intake moves onto the queue, because a failed write
answered with success is the exact defect class this repo hunts, sitting in the
two paths a customer touches first.

**Two corrections to the entry below, both found by reading the routes rather
than the entry.**

**It was one route, not two.** `/api/apply` already answered an honest 500 with
the answers still on the page. Only `/api/lead` returned 200 whatever happened.

**And the queue could not have fixed it.** The durable queue is a table in the
same Postgres, so when the database is unreachable the write fails and the
enqueue fails for the same reason. The notification already went onto the queue;
moving the ROW there would have added a step and closed nothing.

**What actually closed it.** `intakeAnswer` in `src/lib/intake.ts`, pure and
exercised by forms-audit across all three cases: written, carried by a direct
send that bypasses the database, and reached nothing. The last answers 503 and
names the address to write to, because a person who believes they made contact
and did not is worse for the firm than an enquiry it knows it lost.

The original entry follows.

### A failed database write is answered with success

`src/lib/intake.ts` returns a result rather than throwing, and both API routes
turn a failed write into a logged warning and a normal 200. On a database outage
the submission is lost and the person is told it was received.

**Why it is built that way.** The alternative loses the enquiry too, and loses
the person as well, because almost nobody types a message into a form twice. The
Resend notification is a second independent path to the same information, which
is exactly why the two are not chained.

**What would close it properly.** A durable queue, or a local write-ahead that
replays on recovery. Two best efforts is the honest description of what is there
now.

**How you would know it happened.** `[lead] write failed` and
`[apply] write failed` in the server logs, with the Supabase error message.

### The forms round trip is unverified on this machine

`scripts/forms-audit.mjs` runs 35 checks and skips 2: the ones that read the row
back out of `eng_leads` and `eng_applications`. They need
`SUPABASE_SERVICE_ROLE_KEY`, which was not available to this build.

**Why the skip is loud rather than silent.** A run that counted skips as passes
is how a broken write path ships. The summary reports them separately.

**Wanted.** Run `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run forms-audit`
once with real credentials. The audit seeds rows under the name `Zzq Formsaudit`
and deletes them at the end, so it is safe against the shared project.

### Resend has not sent anything

`src/lib/notify.ts` sends from `notifications@254engineering.com`, which requires
the domain to be verified in Resend. Until it is, every send returns
`{ sent: false }` with the reason and the row still lands. No email path on this
site has been exercised end to end.

### County pages are a later tier, and are asserted not to exist

`scripts/coverage-audit.mjs` probes `/coverage/harris`, `/coverage/travis-county`,
and `/counties/bexar` and fails if any of them answers 200.

**Why the assertion.** Adding a route is easy and remembering a content policy
three months later is not. 254 near-identical county pages is doorway content and
would cost more than it earns.

**What a real county tier would need.** Genuinely local material per county:
the authority having jurisdiction and its adopted code editions, the soil series
actually present, the design wind speed, and whether it is inside the windstorm
catastrophe area. That is research per county, not a template.

### The waitlist page is a route with a planned death

`/waitlist` carries `noIndex`, a `Disallow` in `robots.ts`, and is absent from the
sitemap, so the three signals agree. In live mode it still resolves and explains
what it became rather than 404ing links and bookmarks.

**Wanted eventually.** A decision on whether it becomes a permanent redirect to
`/contact` some months after launch, once the links have decayed.

## Content

### Region pages are the deepest content and the least reviewed

The wind, soil, and permitting sections on the eight region pages are the most
substantive claims on the site: catastrophe area county lists, soil formations by
name, specific regulatory bodies. They are written from general knowledge of
Texas construction and have not been reviewed by a licensed Texas engineer.

**Why it matters more here than elsewhere.** A wrong service description is
embarrassing. A wrong statement about which counties require a WPI-8 is the kind
of error a coastal builder would notice immediately.

**Wanted.** A review pass by the engineer of record before, or shortly after,
launch. The county lists in `src/content/regions.ts` are audited for completeness
but not for the regulatory claims made about them.

### There are no reviews, and no review schema

Deliberate. No `aggregateRating`, no `Review` nodes, and nothing on any page that
implies a rating exists. Revisit only when real reviews exist.

## Careers system

### The engineer application cannot be completed without storage

`scripts/lib/careers-audit.mjs` drives the technician flow through submit and
stops the engineer flow at the documents step. The engineer seat requires a
resume, uploading one needs Supabase storage, and a checkout without keys cannot
get past it.

**What is covered instead.** That the requirement blocks, which is the property
that matters, plus every upload API guard called directly.

**What to run once production keys exist.** `npm run forms-audit` with
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set. Three checks turn from SKIP
to real: the engineer submit, and both round trips.

### DONE. Section 1 is no longer blocked

The `/brand-assets/` delivery arrived with the approved v5 design. Colour was not
extracted from the artwork in the end: the approved design specifies the palette
directly and `DESIGN_SPEC.md` records it, which is a better source than sampling
pixels. The original entry follows.

### Section 1 was blocked on the logo files

No `/brand-assets/` directory exists. Colour extraction, the header and footer
mark, the favicon set, the OG card, and the Organization `logo` property all wait
on it. Vector source is worth more than a raster: the header needs the lockup
crisp at 390 and the favicon needs the 254 mark cropped clean.

### RESOLVED 2026-09-06: JobPosting validThrough needs refreshing

Both positions carry `validThrough: 2026-11-30` in `data/positions.ts`. Nothing
renews it automatically, deliberately: an auto extending posting is one that
outlives the job. Refresh it or set `open: false` before it lapses.

**The date is unchanged, and that is the point.** Extending it would have been
the platform deciding the firm is still hiring in December, which is the
operator's decision and exactly what the file says must not be automatic. What
was missing was not a new date, it was anything watching the old one: "OWNER
VERIFICATION: refresh or close before it lapses" is a reminder addressed to
whoever happens to open the file.

**Two mechanisms, neither of which extends anything.** `postingState` and
`schemaPositions` in `data/positions.ts` mean a lapsed posting stops being
emitted as JobPosting at the next build, while the page prose describing the
seat stays, because a page describing a seat is not the same claim as a machine
readable posting with an expiry on it. And `seo-audit` now reads the JSON-LD
actually served from /careers and fails while a posting is within thirty days
of lapsing, which is BEFORE it lapses: the board goes red while the answer is
still "yes, still hiring" or "no, close it".

The window is read out of `data/positions.ts` rather than restated in the
audit, because a second copy of the number is a second thing to change and the
one that gets missed is the audit's, which then passes for a month it should
have failed. As things stand it fails from 2026-10-31.

**And a duplicate was deleted while doing it.** `src/content/openings.ts` held
the same two roles with the same dates and was imported by nothing;
`src/lib/schema.tsx` cited it in a comment as though it were the source. Two
files holding one fact is a drift waiting to happen and the one nobody reads is
the one that gets edited, so it is gone and the comment names the real file.

### OPEN: /careers/professional-engineer is 54ms over its LCP ceiling

Found 2026-09-07 by the full suite, and reproduced twice on a quiet machine.

**The numbers, and the first reading of them was wrong.** Four measurements of
the same page on the same machine on the same day:

| | LCP | spread of three | verdict |
| --- | --- | --- | --- |
| full suite, morning | 3310ms | 76ms | pass |
| alone, after the suite | 3454ms | 1ms | fail |
| alone again | 3454ms | 1ms | fail |
| full suite, evening | 3378ms | 523ms | pass |
| full suite, 2026-09-07 midday | **2934ms** | **3ms** | pass, 466ms under |
| full suite, 2026-09-07 afternoon | 3454ms | 521ms | fail, 54ms over |

The two isolated runs agreed to the millisecond, and that was reported here as
"deterministic, not noise". It was true of those two runs and not of the page.
The ceiling is 3400ms and the page sits within about two percent of it, which is
smaller than the difference between one run and the next.

**The two runs on 2026-09-07 settle it, and they settle it harder than the
first four did.** They are the same page on the same machine about an hour
apart, with nothing touching that route in between: one branch changed a copy
script and some documents, the other a migration and a queue read. The route
measured **2934ms with a spread of 3ms**, which is a tight and confident
reading 466ms under the ceiling, and then **3454ms with a spread of 521ms**.

A 520ms swing on a 3400ms ceiling, where the failing margin is 54ms. **The
instrument's noise is ten times the thing it is being asked to measure.** This
gate is not evidence for this route on this machine, in either direction, which
is the same verdict the operator gave contrast-audit's networkidle timing on
2026-09-06: an audit whose red and green both depend on how busy the machine is
has stopped being evidence.

**Not absorbed, and the budget has not moved.** perf-audit's own doctrine is
written into its header: a route that fails at the median is a real finding and
is never answered by moving the line it crossed. Nothing here widens a ceiling.
What is recorded is that the local measurement cannot resolve this margin.

**What is NOT the cause, checked rather than assumed.** Nothing that renders
that page changed that day. The design token corrections were in portal and
partner components, the card fix was in the portal's shared table, and the
account change was a link on a customer screen. The careers detail page's own
last change was the JobPosting expiry guard, which was in the suite run that
measured 3310ms and passed.

**What it might be, in order of likelihood.** A machine baseline that moved
after a session of continuous building and browser work, which the collapsed
spread is consistent with. A dependency or font that now resolves differently.
Or a real regression from something shared that has not been identified.

**MEASURED ON THE DEPLOYMENT, 2026-09-07, AND THE PAGE IS FINE.**

`254engineering.com`, the gate's own statistic, median of 5, twice:

| | LCP | spread | ceiling | verdict |
| --- | --- | --- | --- | --- |
| run 1 | 1851ms | 161ms | 2000ms | pass |
| run 2 | 1850ms | 153ms | 2000ms | pass, every sample under |

**149ms under the STRICTER ceiling**, since the remote specification is 2000ms
against the local empirical 3400ms. The medians reproduce to 1ms across two
independent runs, and the spread is 153 to 161ms on the deployment against 521ms
locally: the deployment is both the meaningful instrument and the quieter one.

So the page was never the finding. The local profile was, which is what the
operator's ruling of 2026-09-07 predicted, and the local number stays recorded
above rather than deleted because the six measurements are the evidence for why
the instrument changed.

**The preview deployment was not usable and a production deployment was used
instead.** Both the preview and the direct `*.vercel.app` deployment urls sit
behind Vercel deployment protection and answer 302 unauthenticated. The apex is
the reachable deployment, running main at `fae15f2`, and
`/careers/professional-engineer` has not changed in any recent commit, so the
page measured is the page in question. The substitution is recorded rather than
passed off as what was asked for.

**What to do with it. THE TRIGGER FOR THE STANDING RULING IS GONE.** Operator
ruling, 2026-09-07: measure it on a deployment when the cutover lands, because
that is where the number means anything and a laptop that has been running
browser audits for an hour is not a clean room. **The cutover was deferred by
decision later the same day**, so "when the cutover lands" no longer names a
date, and the gate goes on flapping on main in the meantime.

Two things follow, and neither is widening the ceiling.

**A deployment measurement does not actually need the cutover.** A preview
deployment is available at any time and runs the same build on the same
platform; the cutover moves a database and has nothing to do with LCP. Measuring
there is available now and was only ever tied to the cutover by coincidence of
timing.

**And the instrument is the other half.** A median of three with a 520ms spread
is not a median anybody should gate on. More runs, or a percentile that reports
its own confidence, would make the number mean something without touching the
line it is compared against. That is improving the measurement rather than
moving the target, and the two must not be confused: perf-audit's doctrine
forbids the second and says nothing against the first.

Two things to do there rather than here. Take the measurement on the deployed
site, where the ceiling was calibrated to mean something. And decide whether a
ceiling this close to a template's real number is a useful gate at all: a
threshold two percent above the measurement will flip on machine state forever,
which makes it the same shape as the contrast timing defect ruled on the same
day. Do not widen the ceiling to make it green; either the deployment says the
page is over, or the gate needs a margin that reflects what the instrument can
actually resolve.

### RESOLVED 2026-09-07: the harness had no list of what surfaces exist

Operator ruling the same day, after the sweep found the overflow blindness twice
and a third instance in a different form. The generalized fix, and it was worth
more than the eight individual corrections it made possible.

**What was wrong.** Every browser audit carried its own hand written list of
what to measure and nothing carried a list of what EXISTS. So a surface entered
the harness only where somebody remembered. The partner portal shipped in Phase
9 Section 4 and reached two audits out of eight; the customer account surface,
a phase earlier, reached fewer. Nobody decided that.

**What was built.** `scripts/lib/surfaces.mjs` declares every surface with its
prefix, whether opening it needs a session, and which probe makes one. Routes
are DERIVED by walking the directories each surface names, because a route list
in the declaration would be the same memory problem one level down. Every
consumer calls a function that refuses to return an empty list, which is the
canary: an inventory that quietly matched nothing would turn every audit
deriving from it into an audit measuring nothing.

`scripts/surface-audit.mjs` makes it binding. It walks src/app for anything
that renders a page or answers a request and fails when one belongs to no
declared surface, checks that each exemption names an audit that actually
references the path it claims, checks that the probe each surface names exists,
and checks that all seven browser audits still import the inventory. Injected
both ways: an undeclared /vendor surface failed it twice, and an inventory
forced empty took the audit down with an error rather than passing.

**A customer probe had to exist first.** No audit could open the account surface
because nothing could make a customer session. `createCustomerProbe` writes the
four rows the schema actually requires, sets the password through the real
endpoint rather than reimplementing the hashing, and has a verified teardown.

**What entered the audits, and what that found.** Nine findings, every one on a
surface that had never been measured for that property:

- `--muted` (#8A93A0, 3.1:1 on white) was being used as a TEXT colour on the
  absent data chip, a binder key line and two footnotes. It fails AA at every
  size this system uses. contrast-audit had never seen it because none of those
  rendered on a measured screen until the partner portal entered. All four now
  use `--secondary` at 7.0:1; the token stays for inert status dots, which are
  not text, and the standards file says so beside it.
- The partner surface used `shadow-[var(--shadow-panel)]`, a token that DOES
  NOT EXIST. That dropdown had been rendering with no shadow at all.
- The partner surface set its page headings at `text-[20px]`, a size the type
  scale does not have, in six files.
- Thirty five off scale font sizes on the partner admin screens and the
  applications screen, none of which had ever been held to the design system.
- `/portal/applications` overflowed its scrolling region by 11px at 360,
  because a card cell will not shrink below an unbroken string and an email
  address has no spaces in it. Fixed on the shared card rather than that screen:
  every table in the portal renders through it.
- `/portal/partners` had a 20px high link, under WCAG 2.5.8, on the one list a
  partner is opened from on a phone.
- The customer's set password dead link offered NO way onward. The portal and
  the partner surface both offer one. A customer whose invite expired reached a
  sentence and nothing to press.
- security-audit's perimeter did not know the partner or account surfaces
  existed: nine pages and nine route handlers outside the set it reported on.
  Nothing was open, which was verified by removing the proxy's partner prefixes
  and probing signed out, but the check was missing.
- security-audit asserted every guarded page redirects to `/portal/login`,
  which was true while the portal was the only guarded surface. It now asserts
  each surface redirects to ITS OWN sign in screen, which is the stronger claim:
  sending a partner to the staff door invites them to try staff credentials.

**And two defects in the audits themselves, found by using them.**
mobile-overflow-audit had no bounce guard, so a portal page that landed on a
sign in screen read as a pass. It demonstrated itself: two probe using audits
ran at once, one tore down the other's accounts mid run, and the output was a
confident green over a real overflow. Its teardown also deleted its own ids and
then verified by sweeping the domain, so a probe left behind by any other run
was reported as a failure it was never going to fix.

**contrast-audit's networkidle dependency is gone.** Operator ruling: an audit
whose red and green both depend on how busy the machine is has stopped being
evidence in either direction. It waited for the network to go quiet on signed in
screens, which prefetch twenty five dynamic routes, and produced four page
errors on the dashboard and the billing screen on a build where both answer in
half a second. Signed in routes now wait for the DOM and the shell.

### RESOLVED 2026-09-06: both overflow audits were blind on every portal screen

Found by injecting a 2000px wide box into a portal page to verify an unrelated
change to mobile-audit, and watching both audits report pass at every width. The
region measured 2016px inside a 390px viewport.

Point 1 of the native standard, in Phase 11, put `overflow-hidden` on the portal
shell and gave the scrolling to one element between the fixed chrome. Both
audits measured `document.documentElement.scrollWidth` against its client width,
which on a portal screen is a comparison that cannot fail: the document is
pinned to the viewport whatever the content does.

So from Phase 11 until now, every portal row in both tables was green on a
measurement that could not see the thing it claims to measure. Nothing was
found to be actually overflowing once they were fixed, which is the good
outcome and is not the point: the green had stopped meaning anything.

Both now measure whatever is actually scrolling, name which box overflowed, and
were verified by injection in both directions. mobile-overflow-audit's summary
line no longer says "document scroll", because it no longer only means that.

**Worth carrying forward.** The audits were not wrong when they were written.
They were made wrong by a change to the product they were watching, and neither
of them had any way to notice. That is a second order version of the defect
class this repository hunts, and the only defence found so far is the one that
caught it: inject a violation of the property, not of the implementation.

### Two audits that use probe accounts must never run at the same time

Recorded 2026-09-06, after invalidating a mobile-audit run twice in one hour.

`destroyProbes` in `scripts/lib/portal-probe.mjs` deletes EVERY account on the
probe domain rather than the ones its own run created, and that is deliberate
and correct: a run that crashed before teardown used to leave accounts behind
that every later run reported as a failure it was not cleaning up, because the
cleanup and the verification were looking at different sets.

The consequence is that any second script using probes tears down the first
one's sessions mid-run. mobile-audit reported six portal screens as "bounced to
sign in, not measured", which it counts as failures, and the cause was a
screenshot script of mine finishing at the wrong moment. It reads exactly like a
portal auth defect and is not one.

**Not fixed, and the fix is not obvious.** Scoping teardown to a label
reintroduces the stray accounts problem. A lock file would work and is a
mechanism to maintain. The rule for now is the one CLAUDE.md already implies for
sessions and this makes explicit for processes: one probe using script at a
time, and a run that reports bounces should be re-run alone before it is
believed.

## Insights corpus

### DONE. The four registry entries were flipped on deploy

Flipped from `planned` to `live` inside the merge commit that took
`feat/brand-and-careers` to main, which is where this entry said it had to
happen. Kept here rather than deleted because the reasoning is the reusable
part: a registry entry claiming a live URL must not be marked live until that
URL is actually live, or registry-audit fails on four correct 404s.

The original note follows.

### The four registry entries said `planned` until deploy

`data/keyword-registry.ts` carries all four insights posts as `status: "planned"`
with their real paths. They are written and they are on this branch. They are not
on the production domain, and `scripts/registry-audit.mjs` probes
`https://254engineering.com` for every `live` entry.

**Why it is not just set to live now.** Marking them live made the audit fail on
four correct 404s. The audit was right: the registry claims a page exists on the
live brand, and it does not yet. A `planned` entry may carry a path without being
probed, which is exactly the state these are in.

**What to do at deploy. CONFIRMED BY THE OPERATOR 2026-08-24: this happens in the
same commit that merges, not after it.** In that commit,
change `status: "planned"` to `status: "live"` on all four and delete the three
line comment above each one. Then run `npm run registry-audit` against the
deployed site and watch it verify four new URLs rather than assume it will.

**Also.** The same four entries were copied verbatim into both sibling repos with
a note in each `BACKLOG.md`. Those copies are uncommitted in the sibling working
trees on purpose: sealedengineering is on `main`, and one session per repo
directory is the standing rule. Whoever works those repos next commits them.

### A contextual link inside a SectionHeading lede does not count

`scripts/link-map.mjs` treats only `<p>`, `<li>`, and `<dd>` as prose containers.
`SectionHeading` renders its `lede` into a `<div>`, so a link placed there is
counted as template no matter how much prose surrounds it.

This was found the honest way: the linking pass added three links, link-map moved
by two, and the missing one was in a lede on `/government`. The link was moved
into the `PostureBlock` paragraph below it, where the sentence was already
reaching for it, and the count moved to 21.

**Not fixed, deliberately.** Wrapping a string lede in a `<p>` would make ledes
across the whole site countable and would inflate the contextual number without
anybody having written a new link. If that change is ever made, take a fresh
baseline first and say so, because the before and after numbers in this
workstream's report would stop being comparable.

### /insights/engineer-of-record-texas needs a cannibalization check after indexing

`/about` is live on `engineer in responsible charge texas` and the new post owns
`engineer of record texas`. Those are the closest two entries in the registry.
The intents differ, the post explains the concept and `/about` states the firm's
position, and the post links to `/about` rather than competing with it.

**Wanted.** Once both are indexed, check Search Console for the two pages trading
impressions on the same queries. If they are, the post keeps the term and
`/about` loses it, because `/about` has other work to do.

### /insights/texas-pe-license-lookup will not rank this year

KD 55 against a domain with effectively no authority, competing with PDH Pro and
EngineeringID. It was accepted as a tier 2 target with that stated in advance
rather than discovered in six months, and the reasoning is in
`docs/keyword-batch-phase-1.md`.

**Why it shipped anyway.** It is the highest volume term this brand can honestly
own, the page is genuinely more useful than what ranks, and it earns its place as
a link target for the other three posts regardless of where it ranks.

### Three candidate topics were researched and dropped

The windstorm program authority angle, on call contracting, and veteran owned
positioning all measured no search demand at all. Recorded in
`docs/keyword-batch-phase-1.md` with the evidence, so they are not re-proposed.
The windstorm material is still true and belongs inside the TWIA county pages
when the county tier is built.

## Visual layer

### The logo derived texture is not built, and is deferred to Section 1

Section 4 called for four things and three shipped: the diagram system, the 254
county map, and the icon set. The brand texture was deferred on the operator's
instruction because it is derived from the logo, and the logo does not exist yet.

**What it waits on.** The same `/brand-assets/` delivery that blocks Section 1.
A texture derived from a placeholder wordmark would be thrown away with the
placeholder.

### The map restates hex values that also live in globals.css

`src/components/map/TexasCountyMap.tsx` hardcodes five colours as hex strings
rather than reading the Tailwind theme. SVG presentation attributes such as
`stroke` and `fill` do not resolve Tailwind utility classes, and the per element
alternative, a class on every one of 254 paths, costs more than it saves.

This is the same duplication `scripts/brand-rasters.mjs` already carries and it
has the same expiry: when the logo lands and the palette is confirmed against it,
both files are revisited together. If the palette moves before then, these five
values move by hand.

**The values.** County fill, active fill, hairline, boundary, and the two opacity
figures on the boundary strokes.

### The county geometry is generated and can go stale

`src/content/county-geometry.ts` is written by `npm run build-county-map` from
us-atlas, which repackages public domain US Census TIGER boundaries. Part of it,
`REGION_BOUNDARY_PATH`, is derived from the region assignment in
`src/content/regions.ts`.

**The guard.** The generator stamps a fingerprint of the region and county pairs
into the output. `TexasCountyMap` recomputes it at module scope and throws if it
has changed. Every page carrying the map is statically prerendered, so a stale
file fails the build rather than drawing a wrong boundary forever.

**Injection verified.** A county was moved between regions, the build failed with
the fingerprint mismatch and the regenerate instruction, and the change was
reverted. The guard has been watched to fail.

**What to do when regions change.** Run `npm run build-county-map` and commit the
regenerated file in the same commit as the region change.

**Dependencies.** `us-atlas`, `topojson-client`, `d3-geo`, and the two matching
`@types` packages are devDependencies used only by that generator. They are not
in the runtime bundle. The generated file is committed so a deploy never needs
them.

### There are no service line icons, deliberately

`src/components/ui/icons.tsx` holds three marks: external link, seal, and
document. Nine service line glyphs were considered and none was built.

**Why.** An icon earns its place when it is faster to recognise than the word or
carries something the word cannot. "Roof Inspections and Certifications" has no
faster glyph. What a drawn roof beside it would do is move the page toward the
register of a consumer services brand, which is the register this site is
explicitly not in.

**If this is revisited**, the argument to beat is that one, not the absence of a
visual system. The diagram set and the map are the visual system.

### The mobile menu marks stay in CSS

`MobileNav` draws its bars and its close cross with positioned spans. They were
left alone rather than converted to icons: the CSS is fewer bytes, scales with
the type, and works. Replacing it would have been churn dressed as consistency.

## Approved design port: open at the homepage gate

Sections 1 and 2 of the v5 port shipped in 0894461. Five things were decided
rather than deferred silently, and each is listed here so the decision is
reviewable and not buried in a diff.

### v5's two interactive constructs are static here

v5 renders How It Works as a selector: three steps in a rail, one detail panel
beside it, auto cycling on a timer. Coverage is the same construct with an eight
region list and a map. Both are ported as static compositions, three cards and a
list, keeping v5's step eyebrow, ghost numeral, and card chrome.

**Why.** The auto cycle hides two thirds of the content behind a timer, which is
worse for a reader who wants the whole answer and worse for a crawler that reads
the initial HTML. The material is short enough to show at once.

**If revisited**, the thing to build is a click-to-expand that is fully rendered
in the HTML and enhanced by script, never a construct whose content only exists
after a tick.

### The coverage map has no region pins

v5's map is a decorative outline of the state with eight numbered dots that
anchor the numbered region list. The map here is the real one, 254 county paths
with the eight region borders drawn from the same assignment the coverage lists
use, and it carries no numbers. The list is numbered with nothing on the map to
match.

**Cost.** A reader cannot tell which shape "Panhandle" refers to without
clicking. This is the largest single fidelity gap in the port.

### The windstorm band lost v5's coastal strip

v5 pairs the windstorm copy with a cropped map of the coast and a dot per first
tier county. Here it is a two column list on a white card. The counties are
correct and come from `src/content/windstorm.ts`, but the geography is gone.

### The waitlist form has no card

v5 wraps the form in a white card with a gold top rule and a "Reserve your
place" heading, and its submit is a full width gold bar. `LeadForm` renders bare
on the band with a navy submit. The wiring was left alone deliberately, per the
port's rule that forms wiring is untouched, but the chrome is presentation and
could be ported without touching the wiring.

### UTM parameters are still not captured

The gate ruling asked for the waitlist wired to `/api/lead` with UTM capture. The
wiring is done. The capture is not: the lead path records `landingPath` and
`referrer` only, and adding UTM would mean changing the lead schema, the API
route, and the storage column, which is exactly the internals change the port
was told not to make. Flagged rather than done.

## Two surfaces the sitewide propagation could not reach

`feat/onboarding-admin` is unmerged, so the onboarding stepper and the admin
views do not exist on `feat/approved-design`. The master prompt named both as
propagation targets and neither was touched, because there was nothing on this
branch to touch.

**What this costs.** Whichever branch merges second inherits the work. If the
design port merges first, the onboarding and admin surfaces arrive on main still
drawn in the pre-v5 language and need their own pass. If onboarding merges first,
that pass happens inside the design port's merge instead.

**The pass itself is small**, because the propagation went into shared
components. Both surfaces already render inside the root layout, so the header,
footer, mastheads, buttons, form fields, and card chrome all come across for
free. What would need looking at is the stepper's own progress rail and the admin
tables, which are the only two constructs neither branch shares with a page.

## forms-audit was filling the production tables, and reporting green

Found during the post deploy verification of the v5 design merge, not by an
audit. Thirty rows, twenty leads and ten applications, had accumulated in
`eng_leads` and `eng_applications` across one session of audit runs. Every run
had passed.

**The mechanism.** forms-audit drives real forms through a real browser at a
running Next server. That server loads `.env.local`, so every submission wrote a
real row into the production database. The audit process is a plain node script
and does not load `.env.local`, so it saw no Supabase credentials, skipped its
own round trip and teardown block, and printed a skip in green.

Two independent faults, either of which alone would have been caught:

1. The teardown asserted `!error` on the delete. A delete that matches nothing
   does not error, so the assertion and the thing it was meant to assert had no
   relationship to each other. It would have passed even with credentials
   present and a broken filter.
2. The skip was unconditional. If a submission succeeded, the server wrote a
   row, and "this leg was not checked" and "rows were created and cannot be
   removed" are different sentences. Only one of them is safe to print in green.

**Fixed.** The audit loads `.env.local` so its environment matches the server's.
The teardown counts what is left rather than trusting the delete. Missing
credentials after a successful submission is now a finding rather than a skip.
Verified by pointing the delete at a name that matches nothing and watching the
count check fail with `2 lead(s) still present`.

**No customer data was involved.** Every `254` row in both tables was audit
debris; the real count was zero before and after the cleanup.

**This is the third instance of one defect class**, after the `configured` bug in
the careers module and the image contrast audit sampling below the fold: a check
deciding what is true by looking at something other than the thing it claims to
measure. Worth treating as the standing risk in this harness rather than as three
unrelated bugs.

### One SKIP on main is closed on a branch that has not merged

`forms-audit` on main still skips "engineer: review, consent, and submit" with
the reason "Supabase storage is not configured for this run". That reason is no
longer true now that the audit loads the env file, and the skip is hardcoded
rather than gated.

It is already closed in `4b62549` on `feat/onboarding-admin`, which is unmerged.
Left alone rather than reimplemented here, because two divergent fixes to the
same check is worse than one skip. It arrives when that branch merges, which will
also conflict with this file and should be resolved in favour of the branch's
version of the careers checks plus main's teardown fix.

## Mobile app feel pass: what it could not cover

### The onboarding stepper was named as a target and does not exist here

Section 3 of the mobile brief lists the onboarding stepper among the surfaces to
walk. It lives on `feat/onboarding-admin`, which is still unmerged, so there was
nothing on this branch to walk or fix. This is the third workstream in a row to
hit the same wall.

**What it will and will not inherit.** The shared fixes come across for free,
because they are in components that branch already uses: the 16px control floor,
the keyboard attributes, the tap target sizes in the footer and breadcrumbs, the
viewport meta, the manifest, and the overscroll and press feedback rules in
globals.css. What will need its own pass is the stepper's progress rail and its
upload control, which are that branch's own components, and the fact that
`mobile-overflow-audit` reads the sitemap and the onboarding route is
deliberately not in it, so that route will not be covered by the new audit
without being added to it by hand.

### Inline links in prose are exempt from the 44px rule, deliberately

The brief asks for every interactive element at 44 by 44. 34 occurrences are
links inside running sentences: a citation in an insights paragraph, "join the
waitlist" inside the disclosure, a cross reference mid argument. WCAG 2.5.8
exempts them, and forcing them to 44px tall would break the line spacing of the
paragraph they sit in for no gain to anybody.

The sweep classifies inline against standalone rather than counting both, so this
is recorded as a decision rather than showing up as 34 unfixed findings on the
next pass. Every standalone target on the site now clears 44 by 44.

### The 8px separation rule is met by construction, not measured

Adjacent target separation was not audited independently. Every fix that grew a
target grew it to a full 44px row in a stacked flex column, so adjacent targets
are separated by their own height rather than by a margin, and nothing on the
site places two 44px controls closer than that. Worth a real measurement if a
dense control cluster is ever added.

## After the onboarding merge: what is now true, and what is still open

`feat/onboarding-admin` merged at 6e0777f. The five workstreams it had been
blocking are unblocked, and three of the entries above are now resolved rather
than pending:

- Its two email templates are on the shared branded layout and inside
  `email-audit`, which went from 4 templates and 102 checks to 6 and 152.
- The last three `forms-audit` skips are closed on main. The teardown now removes
  both rows and uploaded objects, and verifies both rather than trusting a delete
  not to error.
- The design port and the mobile pass no longer have an unreachable surface.

### The onboarding stepper is still outside two audits

`/onboarding/[token]` is deliberately not in the sitemap and is disallowed in
robots, which is correct for a private per person surface. The cost is that the
two audits which discover their own work by reading the sitemap, so that they
grow when a page is added, cannot see it:

- `mobile-overflow-audit` never checks the stepper at 360 or 390.
- `seo-audit` never checks it, which is fine and intended.

**What closing this would take.** The stepper only renders for a valid token, so
an audit would have to seed a probe onboarding through the service role, walk the
flow, and tear it down, which is what `forms-audit` already does for the careers
applications. The honest place for it is therefore `forms-audit`, extended with a
mobile width pass, rather than a second route list bolted onto the overflow
audit. Not done, and named here rather than left as an assumption that sitemap
coverage means full coverage.

### The admin portal was never built

Section 3 of the original onboarding master prompt is unstarted. `/admin` returns
404 on the live site today, and `onboarding.submitted` sends the operator a button
pointing at `/admin/onboarding/{id}`, which is a link to a page that does not
exist yet. That email is correct about where the record will live and wrong about
whether it is reachable, and it is the one thing in the merge that promises
something absent.

### A correction to an earlier report

`/waitlist` was reported in the metadata audit as indexable but missing from the
sitemap. It is disallowed in `robots.ts` and has been since before that audit, so
it is consistently non indexed rather than half configured. The finding was wrong
and the configuration was right.

## Interior parity: what the workstream found, and what it did not cover

### The dark bands were shipped with light ground text, and only pixel sampling saw it

Recomposing six pages onto navy bands moved the sections but not their colours.
`image-contrast-audit` measured **47 pairings under the 4.5 floor**, as low as
2.00:1, across the government, position, about, and insights surfaces.
`contrast-audit` passed every one of them, because the ground is a gradient and
axe resolves a gradient no better than a photograph. Same blind spot as the
invisible hero heading.

The audit now covers **126 pairings** rather than the 32 it carried into this
workstream, and every recomposed band is targeted by a stable id rather than a
structural selector.

**Two of the findings were the audit's fault, not the pages'.** `color:
transparent` does not clear an explicitly set `text-decoration-color`, so the
source citations kept their gold underline while their glyphs vanished and the
sampler read the underline as the background: 3.3:1 against gold, when the real
pairing is white on navy at 14:1. And four selectors matched nothing after the
recomposition, which the "selector matched nothing" check surfaced rather than
silently skipping. Both are fixed.

### The strip exemption

The homepage credibility strip, the position specification row, and the about
credentials strip carry no heading and are correct. A strip is a row of facts
read at a glance, not a section making an argument. Recorded in DESIGN_SPEC.md
rather than quietly relaxed, because the first measurement flagged all three as
failures and the rule was over strict rather than the pages being wrong.

### Not covered

The waitlist and the application steppers received the padding change and nothing
else. The brief asked to elevate their framing, including completion states, and
what shipped is the section rhythm only: their opening context bands and their
progress and completion treatments are unchanged. Named here rather than counted
as done.

## The admin portal, and the three things driving it found

Section 3 of the onboarding master prompt, built. Passphrase auth on a signed
httpOnly cookie, rate limiting, a proxy gate over every admin path, dashboard,
leads, applications with signed document links, and the onboarding review with
per item accept and reject, the two operator verification checks, invite
creation, and resend. `security-audit` joins the harness at 34 checks and is
injection verified.

### middleware.ts is deprecated in Next 16, and the rename is not cosmetic

Written as `middleware.ts` from memory, it built cleanly and returned 500 on
every admin route: middleware runs on the edge runtime, which has no
`node:crypto`, and the session gate verifies an HMAC. The failure is at module
evaluation in a runtime the build does not exercise, so nothing caught it until
a request arrived.

`proxy.ts` defaults to the Node.js runtime, which is why the same signing code
now serves the gate and the routes. The `runtime` config option is not available
in a proxy file and setting it throws. AGENTS.md says to read the installed docs
before writing; this is what happens when that is skipped.

### The public header and footer were rendering on the admin portal

An internal tool wearing a marketing header with a "Join the Waitlist" button,
and a public compliance footer under a table of applicant records. Same defect
the onboarding flow shipped once, caught the same way both times: by looking at a
screenshot rather than at the code.

A nested layout cannot remove what a parent rendered, so every public route moved
into a `(site)` route group with its own layout and the root layout now holds
only the document. The group is a URL noop: routes, canonicals, and the 33 entry
sitemap are unchanged, and that was verified rather than assumed.

### The verification checkboxes could be toggled off by an impatient operator

Controlled purely by the server value, so a click set the box, React reverted it
because the prop had not changed, and it only appeared checked after the round
trip and the refresh. For about a second nothing visibly happened, and the
obvious response to nothing happening is to click again, which toggles it back
off. Found by Playwright reporting "clicking the checkbox did not change its
state", which is exactly what a person would have experienced.

Optimistic local state leads now and the server value reconciles it, and a failed
call drops the optimistic value rather than leaving the screen claiming something
the record does not say.

### Not covered

The rate limiter is per instance and in memory. On a serverless platform a
determined attacker who can cause new instances can reset their own budget. The
reasoning for accepting that is written in admin-rate-limit.ts: a store on the
login path either fails open, defeating the control, or fails closed, locking the
operator out during an unrelated outage. For one operator and a twelve character
floor it is the better failure shape, and it should be revisited if this portal
ever has a second user.

Applications are a list, not a detail view. Every answer is in the operator's
email and in the payload column, but there is no per application page in the
portal yet.

## registry-audit rewritten to the differentiation model, 2026-08-31

The operator superseded the keyword ownership model. registry-audit no longer
flags topic overlap, which was the whole of what it used to do. It now fetches
all three live sitemaps and scores trigram similarity across titles, H1s,
descriptions, and heading structures, reporting every close pair and failing
above 0.75.

### The audit was reading production while claiming to read localhost

The thirteenth instance of the defect class this backlog names: a check that
passes while looking at the wrong thing.

Sitemap loc values are absolute canonical URLs, so the sitemap served from
localhost:3225 lists https://254engineering.com. pagesFor fetched those URLs
verbatim. Every run printed "read 33 pages from http://localhost:3225" and read
the deployed site instead, which means BASE_URL did nothing and no unshipped
change could ever be scored.

It was caught only because the audit flagged an H1, the H1 was rewritten, the
build was verified by curl to serve the new text, and the score did not move.
Computing the same trigram score by hand off both URLs gave 0.33 against the
audit's 0.81. The audit was measuring the old page.

Fixed by rebasing every loc onto the requested origin. The failure mode is worth
naming for the next audit that reads a sitemap: an absolute URL in fetched data
silently overrides the origin you thought you were testing.

### What the fix found once it could see the local build

/services/manufactured-home-foundation-certifications had the H1 "Manufactured
Home Foundation Certifications in Texas", which is a literal prefix of Sealed's
"Manufactured Home Foundation Certifications in Texas, FHA and VA". 0.81. That is
the find-and-replace test failing in the plainest possible way.

The H1 is now "What Lenders Require on a Manufactured Home Foundation", which is
this brand's angle rather than a reworded sibling. The page TITLE is unchanged,
per the operator's ruling that existing service page titles ship as they are. H1
and title are separate strings and only one of them was ruled on.

### Utility pages are compared but never failed

Privacy, terms, and contact reach 1.00 across all three brands because a privacy
policy is called a privacy policy. They stay in the comparison and stay printed
in the watch list, marked as not failed, because silently dropping a page from a
duplicate check is how a real duplicate later hides behind an exclusion.

### Still in the watch band, deliberately not acted on

title 0.69 on windstorm WPI-8 and title 0.65 on manufactured home foundations,
both against Sealed. Both are below the fail line and both are titles the
operator ruled stay as shipped. They are printed on every run so the decision
stays visible rather than forgotten.

### Injection verified

Set the solar page H1 to Sealed's solar H1 verbatim, rebuilt, ran: FAIL at 1.00
with exit code 1. Reverted, rebuilt, ran: PASS. The exit code was checked without
a pipe, because a script that prints FAIL and exits 0 is the same defect class
again.

## Phase 3, the proximity head term and an honest link count, 2026-08-31

### link-map was counting card navigation as prose

The fourteenth instance of the defect class this backlog names, and the first one
where the audit was inventing findings rather than missing them.

Card grids are marked up as lists, which is correct. That put every card link
inside an li, and the prose heuristic saw a container of about fifteen words with
a three word anchor and scored it as writing. The windstorm sibling cards
produced four inbound "contextual" links to /windstorm/appointed-engineers, all
with the same anchor, and the anchor discipline check then reported a repetition
that nobody had written into a sentence. The measurement manufactured both the
links and the violation, and the linking pass was being judged against it.

Links inside a heading are now stripped from the container before anchors are
read. A card title falls through to the chrome pass and is counted as template.

Measured on the pre-Phase-3 tree with the corrected script, in a worktree, rather
than assumed: baseline reported 35 contextual links, of which 11 were windstorm
card navigation. Genuine prose links at baseline were 24. After this pass, 37.

### What the inflation was hiding

All seven windstorm cluster pages had exactly one "contextual" inbound link,
which was their own sibling card. With the correction they show as what they are:
no prose inbound at all. The hub has two and the cluster has none.

That is a real gap and it is now visible instead of papered over. The cluster
pages need prose inbound from the service pages and the coastal region page in a
later pass. It was not done in this one because no sentence on those pages wanted
the link, and writing one to carry a link is what section 8 forbids.

### Links dropped rather than forced

/services/roof-inspections, /services/forensic-engineering, and
/services/manufactured-home-foundation-certifications were on the target list and
got nothing. No existing sentence on any source page wanted them. Each is still
reachable through template navigation, and each is a candidate for the next
content that legitimately mentions it.

### Contextual links now live in the copy, not the component

Body strings may carry [anchor](/path), rendered by ProseParagraph. The first
version of the proximity hub special cased one section in the page component and
appended a paragraph after it, which works exactly once before the component
fills with conditionals nobody can find copy in. The token pattern requires a
leading slash, so an external URL cannot be smuggled into body copy through it.

### No /roof-certification page, deliberately

"roof certification" measured 500/mo at KD 0 and is the second unqualified head
term worth having. /services/roof-inspections already opens by defining the term
and stating who orders one, so a second page would have restated it in different
words. The reasoning is recorded at the top of src/content/structural-engineer.ts
so the gap is not filled later by someone who reads it as an oversight.

### Still open

The seven windstorm cluster pages, /services/forensic-engineering,
/services/roof-inspections, /services/manufactured-home-foundation-certifications,
the seven non-coastal coverage regions, and /insights all have no contextual
inbound. The coverage regions in particular are a structural problem: nothing in
prose anywhere links to a specific region except the Coastal Bend.

## Performance pass and the perf gate, 2026-08-31

### What the measurement changed about the plan

The workstream anticipated image work: next/image everywhere, sizes attributes,
AVIF and WebP, priority and preload on the LCP image. None of it was done,
because the baseline said not to.

Every Largest Contentful Paint on all eight sampled templates is a TEXT node.
Not one is an image. Lighthouse reported zero recoverable bytes for both
modern-image-formats and uses-responsive-images on every route, and images were
9 to 65KB against 121KB of fonts and 214KB of JavaScript. There was no image
problem to solve, and "optimize the images" would have been work that looked
like performance and moved nothing.

Because the LCP is text on every template, it is gated on font delivery. That is
what made the font finding the important one rather than a tidy-up.

### The unused italic face

Open Sans italic was declared in the root layout and rendered nowhere. The only
occurrences of the word italic in the source tree were the declaration itself and
a single not-italic, which is the address element on the location page turning
OFF a browser default. Four live pages sampled for em, i, and italic utility
classes returned zero.

It cost a 44KB woff2 on every route, on the critical path for the metric it was
hurting. Fonts went from 121KB to 77KB per route.

### The county map was rendered twice on the homepage

Two identical 73.7KB inline SVGs, 256 paths each, in one document: the hero map
and the coverage section map. Because the map is a server component the geometry
was serialized again into the RSC flight payload, and one county's path string
appeared eight times in the homepage HTML. The homepage document was 105KB
against 15 to 18KB for a content page.

The geometry is now emitted once and drawn twice through a use element carrying
its own tone, which is opt in per page rather than automatic: a component cannot
know it is the second map on a page, and a registry that guessed would be a
hydration bug. Homepage HTML fell from 105KB to 73KB and total from 551KB to
455KB.

Screenshots at 390 and 1280 on homepage, coverage hub, and region page are
byte-identical before and after, verified by sha256 rather than by eye.

### What was measured and deliberately not done

**SVG coordinate rounding.** The prompt expected this to halve the map. The
county paths are already at one decimal place: 43KB of path data across 254
counties, 6,680 decimal numbers, all at 1dp. Rounding to integers would save
about 6.7KB uncompressed for real geometry risk. Not done.

**Dynamic import of the lead form.** Tried, measured, reverted. It made things
marginally worse: 756KB to 765KB of JavaScript, because next/dynamic added a
chunk that Next preloads anyway, and the chunk sets on the homepage and a static
content page stayed identical. The application flow at 61KB is already correctly
code split and loads only on the position page.

**Images, third party, caching, static generation.** No image work for the reason
above. Zero third party origins on public pages, so nothing to remove. Static
assets already carry public,max-age=31536000,immutable and documents are
prerendered and served from cache. The only dynamic routes are admin and the
token gated onboarding page, both correctly dynamic.

### The gate, and the two ceilings

perf-audit runs Lighthouse performance on ten templates at a fixed throttled
mobile profile and fails on LCP, CLS, TBT, or a per template byte budget.
Budgets live in scripts/perf-budgets.mjs with the reasoning.

Lighthouse varies. Measured on this site: the same route, same build, same
profile, moved 740ms of LCP between consecutive runs, and one route moved 693ms
across five runs. The gate measures each route three times and judges the BEST
run, so noise raises the ceiling rather than tripping it, and the spread is
printed on every line so a page getting noisier is visible before it fails.

The two ceilings need stating plainly because they look like fudging. The same
commit measured 1555 to 2901ms of LCP on the live host and 2919 to 3183ms served
from next start on this machine. Localhost is faster on TTFB by two orders of
magnitude, so the server is not the cause. What is established is that next start
serves gzip while the edge serves brotli, about 14 percent more wire bytes on the
same document. What is NOT established is the rest of the gap, which is larger
than 14 percent of anything. That is recorded as unexplained rather than given a
confident cause. So the operator's 2.0s specification applies to any real
deployment and an empirical 3.4s applies to localhost, and which one is used is
decided by the host being measured rather than by a flag.

### The injection test found a hole in the route set

Injecting a 250ms blocking task on /windstorm passed green, because /windstorm
was not in the route set. The hub is a different page shape from its cluster
pages, a card grid rather than prose, and nothing measured it. Added, and the
same injection then failed correctly at TBT 827ms against the 200ms ceiling.

The byte injection, a 500KB asset on /structural-engineer, failed at 892KB
against a 540KB budget on exactly that route with no false positives elsewhere.
Both reverted, both re-verified green.

### And the suite placement, which this file had already warned about

perf-audit was first added to the end of phase two and failed its preflight with
nothing answering on 3225. The comment above security-audit in scripts/audit.mjs
describes this exact trap: phase two audits start their own server by killing
whatever holds that port. It is now last in phase one.

### Still open

The suite is materially slower: perf-audit adds roughly ten minutes, thirty
Lighthouse runs. That is the price of the gate and it is worth it, but a future
pass might make the run count configurable per context so a quick local check is
not the full thirty.

/careers/professional-engineer measured 150ms WORSE on LCP after the change while
its bytes fell 64KB. That route's own spread across five runs was 452ms, so the
difference is inside its noise and cannot be called a regression or dismissed as
noise on the evidence available. Reported rather than filtered out.

## Operations platform, Phase 0: foundation, auth, roles, shell, 2026-09-02

### The whole program's schema landed in Phase 0, on purpose

Twenty five tables covering all six phases: identity, clients and files,
protocols and dispatch and evidence, credentials and certification, documents
and ledgers and the responsible charge log, tasks and threads and notifications,
and the fee schedule. Empty tables are cheap; retrofitting a foreign key onto a
populated table across a live portal is not.

Every one has RLS on with zero policies, the same closed door the eng_ tables
already used. Authorization is application code in src/lib/ops-authz.ts, in
front of every query, asserted by scripts/roles-audit.mjs.

### Two defects the schema had, both found by running it rather than reading it

**The audit trail's own foreign keys fought its immutability trigger.**
actor_id was declared "on delete set null", so deleting a profile asked Postgres
to UPDATE the append only table, and the trigger correctly refused. The result
was that a profile referenced by any trail row could not be deleted at all, and
the error named the trigger rather than the constraint. Found when a
demonstration teardown could not remove its own accounts.

The fix is to drop the reference, not weaken the trigger, and it is the better
model anyway: a regulatory trail whose rows depend on a profile still existing
loses its actor the day somebody leaves. That is why actor_email is denormalised
beside it. Same for eng_responsible_charge_log, which was "on delete restrict"
and would have blocked the delete outright, on a record that has to survive the
engineer leaving the firm for ten years.

**signInWithPassword silently turned the shared service role client into that
user.** supabaseAdmin() is a module level singleton. Calling
auth.signInWithPassword() on it succeeds and stores the user's session inside the
client, so every later .from() call travels as that user, RLS applies, and every
eng_ table returns nothing.

The symptom was worse than the cause: the sign in worked, the profile lookup
immediately after it came back empty, and the person was told their credentials
were wrong. It would have shipped as "the portal does not work" with no obvious
lead. Credential checks now use a throwaway client that never touches a table.

Both were found by the end to end demonstration, not by reading the code, and
neither would have been caught by a type checker or a unit test with a mocked
client.

### auth.users is shared with the other applications on this project

Every table this platform owns carries the eng_ prefix because the Supabase
project hosts several unrelated apps. auth.users has no prefix and cannot have
one. The operator's own address already existed there from another application.

So account creation has two outcomes and they are deliberately different. A new
address gets an auth user and a one time link. An EXISTING address is linked and
its password is left completely alone, because it is the same credential another
application uses and resetting it here would lock somebody out of something else
without telling them why. The admin is told which happened, and the invite email
changes its button from "choose your password" to "sign in".

The seed script does the same thing, which is why the first administrator was
linked rather than created.

### roles-audit is written so it cannot be a tautology

The obvious way to test an authorization module is to loop over its own matrix.
That passes forever, including on the day somebody widens a role. So the audit
states who may do what a second time, by hand, and fails when the two disagree.
Injection verified: granting field_tech pricing.read and audit.read produced four
failures across the matrix check and the redaction check.

The second half signs in as each role through the real endpoint and attempts what
each must not do. A pure matrix proves the module is self consistent; it proves
nothing about whether the route handlers call it.

### The passphrase is retired, the screens behind it are not

The shared ADMIN_PASSPHRASE, its session module, and the login, logout, and
session endpoints are deleted. security-audit asserts the old surface no longer
issues a session.

The leads, applications, and onboarding screens still answer under /admin and are
now gated by the same accounts as the portal, admin role only. They are real work
the operator does today and Phase 1 and Phase 3 absorb them properly. Deleting
them now to make the retirement look complete would have removed capability and
given nothing back. That is a deliberate temporary duplication and it is the one
piece of Phase 0 that is not finished architecture.

### Still open, and known

ADMIN_PASSPHRASE can be removed from the Vercel environment; nothing reads it.
OPS_SESSION_SECRET must be SET there before the portal works in production, and
it is not set yet. Without it the sign in screen says so rather than rejecting
correct passwords silently.

The command palette navigates and does not search. Searching clients and files
starts when there are clients and files, and the palette says so rather than
returning nothing.

The dashboard shows live counts and two designed empty states. It does not show a
revenue chart with invented numbers.

## Operations platform, Phase 2: dispatch and the field, 2026-09-02

Protocol authoring, dispatch by coverage and certification, offers with first
acceptance winning, protocol driven capture with the device camera and an
offline queue, the submission gate, and the roster with a coverage map and the
pay ledger. What follows is what it does not do, and why.

### Nothing geocodes, so proximity is half a feature

Dispatch ranks by open workload and then by straight line distance. Distance
needs two points and neither is filled automatically. There is no geocoder in
this stack, and the county geometry in this repo is projected screen coordinates
rather than latitude and longitude, so it cannot be used to derive one. Recorded
because that is the obvious idea and it is wrong.

An administrator enters a technician's base once on the roster, which is a thirty
second job with a map open. A property's coordinates are a column nothing fills.
Until both exist for a given file, the ranking is workload and then name, and the
dispatch panel says which side is missing rather than implying a proximity nobody
measured.

**What would finish it.** Either a geocoding call at intake, which is a paid
dependency and a network round trip on a form submit, or a county centroid table
built from a primary source. The second is the cheaper answer and would give
every file a usable point from the county it already carries.

### The offline queue survives signal loss, not a cold start

Captures are held in IndexedDB and upload when connectivity returns. That covers
the case that actually happens: the tab stays open and the signal comes and goes
across a two hour inspection.

It does not cover a technician who closes the tab in a dead zone. There is no
service worker, so the app cannot boot without a network. Making the whole portal
work from a cold start offline is a real piece of work with its own failure modes
around stale bundles and a signed session that has expired, and half of it would
be worse than none.

**localStorage was tried and is wrong**, recorded so it is not tried again. It
holds strings, so a photograph has to be base64 encoded, which inflates it by a
third against a quota of about five megabytes. One roof photograph from a modern
phone is four. The quota fills on the second frame.

### Certification is set against the record, not earned

Dispatch reads `eng_certifications` and refuses anybody not certified for the
service line. That gate works. The workflow that produces a certification, the
training run and the score, is Phase 3, and until it ships an administrator sets
the row directly.

### Evidence photographs have no thumbnails and no preview after the session

A technician sees local previews of what they captured in the session that
captured it. Coming back later, they see counts and status rather than the
images, because rendering a stored photograph needs a signed download URL per
capture and that endpoint is not built.

It belongs with Phase 4, where an engineer reviewing a package needs to see every
frame anyway, and building a worse version of that viewer for the technician
first would be building it twice.

### Four defects the walkthrough found that reading the code did not

Recorded because the lesson is about method, not about these four. All of them
typechecked, built, and passed the pure audits.

A technician could not accept a job, because reaching dispatched was keyed to an
administrator only permission. The offline queue's idempotency did not work at
all, because the unique index was partial and `ON CONFLICT` cannot infer a
partial index from a column list. Holding an offer was treated as holding the
job, so the technician who lost a race could still write evidence onto it. And a
corrected measurement stayed blocked forever, so an item was unsatisfiable for
the rest of a visit once a bad reading had been entered.

The second one is the one to remember. One check in the walkthrough went green on
the resulting refusal while asserting something else entirely, which is the
recurring defect class in this repo, and this time it caught me writing the check
rather than reading the code.

## Operations platform, Phase 3: the applicant to dispatchable path, 2026-09-02

Onboarding joined to dispatch, credential expiry as a hard gate, and the
protocol certification check. What follows is what it does not do.

### RESOLVED 2026-09-06. The legacy /admin surface is deleted

Operator ruling: duplicate capability behind weaker auth is a liability, and the
portal absorbed all three surfaces.

**Two thirds of that was true, and the third was found by checking rather than
by trusting the ruling.** Leads went to the clients screen and onboarding to the
portal's own. **Applications had never been absorbed.** The portal's onboarding
screen lists applications not yet invited, and `APPLICATION_COLUMNS` in
`ops-onboarding.ts` does not include `payload`, so a candidate's resume,
licence and certifications were visible nowhere in the portal at all. Deleting
`/admin` first would have removed the firm's only view of its hiring pipeline
and nobody would have noticed until somebody went looking for a CV.

**What shipped.** `/portal/applications`, ported rather than rewritten: same
query, same render time signed links, portal chrome, gated on
`profiles.create` because the person who reads an application is the person who
invites the successful one. Then `src/app/admin`, `src/components/admin` and
`src/app/api/admin` were deleted, `admin-data.ts` was trimmed to what the new
screen uses, the proxy redirects the whole `/admin` prefix to the portal sign in
rather than only its login page, and the onboarding email button was repointed
at `/portal/onboarding?id=`.

**The redirect covers the prefix on purpose.** The operator has had onboarding
emails in their inbox pointing at `/admin/onboarding/<id>` since Phase 3, and a
redirect that only covered the login page would have turned every one of them
into a 404 on the day the screens went.

**One capability genuinely went away, and it is the right one.** The deleted
admin route emailed an onboarding invite. The portal's replacement returns the
one time link to the operator to hand over, which is the pattern staff accounts
and partner accounts already use and the one the operator asked for by name.
`jobs-audit` no longer asserts a queued send for it, and says why.

Verified against a running build rather than the source: every `/admin` path
answers 307 to `/portal/login`, `/portal/applications` renders 200 for an
administrator, and the documents column is on it.

The original entry follows.

### The legacy /admin/onboarding screens now overlap this and are not deleted

The operator uses them today, and the invite flow the applicant actually sees
lives at /onboarding/[token] and is unchanged by any of this. Deleting the admin
screens to make the new one look complete would remove capability and give
nothing back, which is the same reasoning Phase 0 recorded about the leads and
applications screens.

Retiring them is its own piece of work: the item decisions, the reject reasons,
and the two operator verification steps all live there and would need to move.

### Nothing reads a document, so every date is typed

The reasoning also lives in `docs/ops-platform-program.md`, Phase 3, and this is
the index entry for it.

Expiry dates come from the person holding the card or the operator verifying it.
There is no OCR in this system and there will not be. The standing rule is that
the firm needs the document and not the data off it, and a date extracted by a
machine from a phone photograph is a date nobody checked, gating whether
somebody is sent to a property.

**The cost is real and is accepted.** An operator who accepts an insurance
certificate and does not type the expiry has an onboarding that will not
activate, and the readiness check names the document rather than saying the form
is incomplete. That is the trade: a refusal somebody can act on, instead of a
silent null that becomes a technician working uninsured eleven months later.

### Credential renewals after activation are an operator action, not a flow

Once somebody is activated, a renewed insurance certificate arrives by email and
the operator records it on the roster. There is no route for a technician to
upload a replacement document themselves, and there should be: the person whose
insurance lapsed is the person most motivated to fix it, and making them wait
for an operator is how a dispatchable technician stays blocked over a weekend.

It is not built because the upload surface a technician would use is the
onboarding flow, which is invite scoped and token authenticated, and reusing it
for a signed in person is a different auth path rather than a new button.

### The certification check is comprehension, not competence

Four multiple choice questions establish that somebody has read the protocol and
understands what the engineer expects. They do not establish that the person can
get onto a roof safely or hold a camera straight. Nothing here claims otherwise,
and the label on the record says certified against a protocol version rather
than qualified.

A field assessment, where an experienced technician reviews somebody's first
package before it counts, is the honest next step and is not built.

### Stale certifications warn rather than block, and that is a judgment call

A technician certified on version one of a protocol stays certified when version
two publishes. Blocking would empty the dispatch pool the moment an engineer
fixes a typo, and the pressure that creates is on the engineer not to improve
the protocol.

**If a version bump ever carries a material change, the honest answer is for the
engineer to revoke the certifications it supersedes**, which is an act they can
already take. The platform deliberately does not do it for them, because it
cannot tell a typo from a new required photograph.

### One forms-audit failure that was never explained

During the Phase 3 verification, forms-audit failed once inside a full suite run
on the check "round trip: the structured answers land in the payload column". It
passed on the immediately preceding run, passed 80/80 in isolation straight
afterwards, and passed again on the next full suite run.

**It is recorded because it is unexplained, not because it is understood.** The
suite run that failed had 81 checks where the isolated run had 80, which says
the environment differed, and the leading theory is leftover state from an
earlier suite run that was killed mid flight before its teardown. That was not
confirmed: by the time it was investigated the marker rows were gone, cleaned up
by the teardown of the run that failed.

If it recurs, the thing to capture BEFORE re-running is the contents of
eng_applications where name = 'Zzq Formsaudit', because the failing assertion is
about the payload column on that row and the evidence disappears at teardown.

### Production pay is more generous than the signed agreement, and needs an amendment

**Operator ruling, 2026-09-02:** engineer production pay attaches to the
completed review, not to the seal. A file the engineer declines to seal writes a
production ledger entry at the same tier a sealed one would have.

**The reasoning.** Paying only on a seal pays for a conclusion rather than for
the work, and creates financial pressure toward a favourable one. The operator
states that Recital E of the engineer's agreement forbids that pressure, and
their earlier refund ruling on the order engine had already rejected the same
incentive one layer out.

**The gap.** The operator states this is more generous than section 3.2 of the
signed agreement as written. The code now behaves the generous way, on their
instruction, which means the platform and the executed contract disagree in the
engineer's favour.

**What is needed: a short written amendment to section 3.2**, so the agreement
says what the platform does. Until it exists, an engineer who declines a file is
paid by the software under a term the contract does not yet contain. That is the
right way round for an ethical rule to fail, and it is still a disagreement
between two records and should not be left standing.

The agreement is not in this repository. The clause numbers above are the
operator's citations, recorded as given rather than paraphrased, because nothing
in this repo can verify them.

## Phase 6: documents, billing, dashboards

### There is no invoicing, and billing is read only

`/portal/billing` shows margin per file and per period from figures already on
the file. Nothing sends a bill, takes a payment, or talks to an accounting
system.

**Why it stops there.** Invoicing belongs with the order engine: what is billed,
when, at what price, and what happens on a refund are all decisions that layer
owns. Building half of it now would leave two billing models to reconcile, and
the second one always wins on a schedule nobody chose.

### The period a file counts toward is a judgment, not a fact from the data

A file counts toward the month it was delivered, and toward the month it was
opened when it has not been delivered. That is written into `fileMargins` with
the reasoning beside it.

**It is a defensible choice rather than a correct one.** An accountant may want
revenue recognised on a different event, and if one ever says so, the change is
one line and the exports move with it. Recorded because a number that looks
factual and is actually a convention is the kind of thing that gets discovered
during an audit rather than before one.

### The evidence binder is a CSV and not a PDF

Every reader a binder has, a client, an insurer, a board, a court, can open a
CSV without being told how, and can still open it in ten years with software
nobody has chosen yet. A PDF would look better and would need a rendering
dependency, a font decision, and a page layout that cannot be diffed.

**If a regulator or a client ever requires a paginated document**, the manifest
is already assembled purely in `ops-binder.ts` and only the rendering changes.

### The document centre does not accept uploads

Documents reach the platform through the surfaces that produce them: onboarding
for credentials, review for deliverables. A general uploader on the document
centre would be a second path into `eng_documents` with none of the checks those
surfaces run.

`recordDocument` exists in `ops-docs.ts` for the surfaces that need it and is not
wired to a form.

### Sixteen charge log rows in development will read oddly forever

The development project carries sixteen `eng_responsible_charge_log` rows from
Phase 4 walkthrough runs, all with a null `decision`, because the column was
added after those rows were written. The engineer's dashboard in development
therefore reports sixteen reviews for the current period against an empty
production ledger.

**They cannot be cleaned up.** The table refuses deletes by design, which is the
point of it. This is development noise and not a defect, and it is written down
so the next person to look at that dashboard does not spend an hour hunting a
ledger bug that is not there. Production is unaffected: those rows were never
written there.

### The dashboard is now on the nav for every role, superseding an earlier rule

`navFor` used to hide `/portal` from engineers and technicians, on the reasoning
that their dashboard was their queue and a generic one would be a third empty
page. Phase 6 built the two that were missing, so the filter is gone and the old
reasoning is recorded in `nav.ts` rather than deleted.

Sign in still lands each role on the surface they work in, through `homeFor`.

## The production outage of 2026-09-03, and the audit that scored it green

### What happened

Production ran for roughly two hours unable to reach its database. Every call
failed with `Invalid API key`, so nobody could sign in, a valid one time password
link reported itself invalid, and the failed sign ins wrote no audit rows because
the write that records them failed too.

`security-audit` was run against that host during the outage and **passed all 126
checks**.

### Why the audit passed, which is the part worth keeping

It was not lying. Every check it makes asks whether a signed out client is
refused, and a deployment that cannot reach a database refuses everybody. A
closed portal and a broken one are indistinguishable from outside, and **the
broken one scores better than a healthy one would**, because nothing can leak
from a system that can read nothing.

That is the recurring defect class in this repository at full size: a check that
passes while looking at the wrong thing.

### What was added

`/api/portal/health` returns exactly `{"ok":true}` with 200 or `{"ok":false}`
with 503 and nothing else. Not the project ref, not a row count, not the error,
not a build id. `security-audit` runs it first and prints
`THE PERIMETER WAS NOT MEASURED` instead of a perimeter result when it fails.

Injection verified three directions: healthy passes 128 checks, a wrong service
role key fails liveness and refuses to score the perimeter, and a probe body
carrying an extra field fails both checks so the endpoint cannot quietly become
a reconnaissance surface.

### The part that is still a hole

**Nothing watches the health probe on a schedule.** It is a check an audit runs
when somebody runs the audit. Production was down for two hours and the way it
was discovered was the operator trying to sign in.

A cron hitting `/api/portal/health` and alerting on a 503 is the obvious next
step and is not built. Until it is, the honest statement is that this platform
has no outage detection, only outage diagnosis.

### The signal I misread, recorded because the misreading is the lesson

Earlier the same day, verifying Phase 6 on the live host, I noticed production's
audit trail was unchanged at 215 rows after running `security-audit` against it,
and reported that as reassurance that the audit writes nothing.

It was the symptom. A failed sign in writes an audit row before it branches, so a
failure that leaves no row anywhere is a client that cannot reach its project at
all. **That exact inference had already been made and written down during the
Phase 5 preview incident, one day earlier, in this same repository.** I had the
diagnosis and did not apply it, because the number I was looking at was the
number I wanted to see.

**If a count that should have moved has not moved, that is a finding, not a
clean bill of health.**

### And a second one: fixing the key while the URL stayed wrong

After the key was corrected, production began writing to the **development**
database. One probe row landed in development at 13:29:29 before the URL was
also corrected. The outage had been replaced by something worse, and it was
caught only because the evidence test checks both databases rather than one.

The row cannot be removed; that table refuses deletes by design. It is
development, so it is noise rather than harm, but it is the second time in two
days that a Vercel environment variable change pointed a deployment at the wrong
project. `previewPointingAtProduction` in `src/lib/db-guard.ts` guards a preview
against production and has no counterpart guarding production against
development, because production legitimately has no fixed expectation the code
can assert from inside.

**A `PRODUCTION_EXPECTED_REF` check, asserting at boot that a production
deployment is pointed at the production ref, would close it.** Not built.

### The production guard, and the signal it is allowed to trust

`productionPointingElsewhere` in `src/lib/db-guard.ts` refuses to open a
database connection when a production deployment is pointed at anything but the
production project. It closes the hole that let production write one row into
development on 2026-09-03.

**Its first version fired on the operator's own laptop.** `.env.local` carries
`VERCEL_ENV="production"`, written there by `vercel env pull`, so any check that
trusts that variable alone treats a local `next start` as production. It refused
every local database connection and would have broken the entire audit harness.
It was caught by running the health probe locally and seeing it answer 503, not
by the predicate tests, which all passed.

So the guard also requires `VERCEL_DEPLOYMENT_ID`, which Vercel sets at runtime
and `vercel env pull` does not write.

**The known fragility.** If Vercel ever stops setting `VERCEL_DEPLOYMENT_ID`,
the guard returns false and silently stops guarding. That is a fail open, and it
is the deliberate direction: a guard that wrongly refuses production is a worse
outage than the one it prevents. It is written down here rather than treated as
a guarantee. `db-guard-audit` carries the laptop case as a permanent regression
test, so the misfire cannot come back quietly.

### The outage watcher's first alert was wrong, and that is why it classifies

`/api/cron/health-watch` runs every five minutes and emails on a fault. The
first version treated anything that was not a healthy 200 as a database outage.
The first time it ran for real it emailed one, because production was answering
403 with a Vercel Security Checkpoint page: a firewall challenging the monitor,
not a database fault.

An alert that names the wrong cause sends somebody to the wrong place, and one
that repeats every five minutes for a reason that is not an outage gets muted,
which loses the alert that matters. `classifyProbe` now separates four outcomes
and each carries its own sentence about where to look.

**What is still not solved: it keeps no state, so it repeats every five minutes
while a fault lasts.** Deduplicating needs somewhere to record "already
alerted", and the only durable store is the database being watched. The email
says it will repeat. For a fault that went unnoticed for two hours, noisy is the
right direction, but it is a tradeoff rather than a solved problem.

### Production served a Vercel Security Checkpoint to everything for a period

On 2026-09-03, for a window of roughly twenty minutes, every request to
production including `/` returned 403 with Vercel's Security Checkpoint page.
It cleared without intervention, which points at automatic DDoS mitigation
rather than a setting somebody changed.

**It matters more here than on most sites.** This firm's entire strategy is
organic search, and a challenge page served to crawlers is a site that cannot be
crawled. Nothing in this repository can see the firewall configuration, and the
watcher can now tell the operator when it is happening, which is the most this
layer can do about it.

Worth checking in the Vercel dashboard whether Attack Challenge Mode is on, and
worth knowing that it is a thing that can happen unattended.

### Phase 7: does anything still write eng_orders?

`eng_orders` is the legacy intake table reconstructed in migration 0000: a form
submission with `plan_type`, `file_paths`, UTM capture and `status` defaulting
to `received`. Phase 7's order lives in `eng_service_orders` instead, and 0006
leaves the legacy table untouched.

**The reason it was not repurposed is a question this repository cannot answer.**
It holds zero rows in production, nothing in `src/` writes it, and no `eng_files`
row references it. But the `eng_` tables are shared across the brand family and
it carries a `site` column, so **sealedengineering or stampmyplans may still
post to it.** Rewriting a shared table's meaning on the strength of what one of
three repositories can see is exactly the assumption that should not be made.

**What is needed: confirmation from the operator, or a look at the other two
repos, on whether either still writes eng_orders.** If neither does, it can be
dropped in a later migration and the name freed. Until then two tables with
similar names is the cost of not guessing, and the header of 0006 explains it so
the next session does not read it as an oversight.

### Migration 0006 is on development only

Applied to `ythzaiqeoijlrdibnieo`, fingerprint `f27078a89edc555283d50476b2be252e`
across 605 columns. Production stays at `1187b16a91c10ff758ce8953e4efb1ca` /
489 until the operator gives the merge word, which is the standing sequence:
migration to production before the code that needs it deploys.

### A payment row can never be deleted, including a demo one

`eng_order_payments` has a delete trigger and `order_id ... on delete restrict`,
so a payment cannot be removed and an order that took one cannot be removed
either. That is right for money and it has a consequence worth knowing before
somebody hits it: **any demo or test order that records a payment is permanent,
in development as well as production.**

A seeding script for the order flow should stop short of payments, or accept
that development accumulates them the way it accumulates audit rows. The
verification of 0006 worked around it by disabling the trigger inside a
transaction, which is available to a migration and deliberately not to the
application.

### The order flow UI and the Stripe leg are not built

Phase 7 has its catalog, its pure core, its schema and its intake API. What a
customer actually touches does not exist yet:

- **The six step flow** the program describes (service, qualification, property,
  requirements, price and terms, payment) as a shared embeddable component
  rendered on all three sites in each brand's own tokens and voice.
- **The Stripe leg.** Test keys are on Preview scope now. `eng_order_payments`
  is designed for it and nothing writes there. An order is created at
  `awaiting_payment` and stays there.
- **Auto dispatch on payment.** `landingStatusFor` says where a paid order
  belongs and nothing moves it, because nothing marks an order paid.
- **The customer portal.** `issueCustomerLink` and `orderForCustomerToken`
  exist and no page reads them, so no customer has anywhere to look.
- **Refund execution.** `refundFor` computes the three cases exactly and no code
  calls Stripe to carry one out.

The intake API is the whole path from a customer's answers to a file in the
portal, minus the till. That is a real milestone and it is not the phase.

### The intake walkthrough passed 24 checks while creating no files

The first run of the Phase 7 walkthrough asserted the HTTP responses and
nothing else. All 24 passed. Every order was recording a `client.failed` event
reading "Could not find the 'landingPath' column of 'eng_clients'", because
`createClient` spreads its `attribution` argument straight into the insert and
the keys have to be real column names, and intake was passing camelCase.

**No client and no file were created, and the API answered 201 either way.** The
defect was found by reading the order's own event trail in the database, not by
the walkthrough.

The walkthrough now asserts what landed: a client, a linked file, the catalog
snapshot, the disclosure text, the event trail, and that nothing in it ends in
`.failed`. That last check is the one that would have caught this on the first
run.

### The intake cannot place a real order today, by design

Every catalog price is null, so `orderBlockedReason` refuses every field and
desk order. The happy path was verified with fixture prices patched in locally
and reverted immediately afterwards; `order-audit` is green on the committed
catalog, which asserts no price is published in the repository.

**Until the operator sets prices, the only thing the intake will accept in a
live gate is a quote request.** That is the honest state and not a defect.

### Two prices in the operator's ruling have nowhere to go

The 2026-09-03 pricing ruling included **beam and header sizing at 750** and
**carport and patio cover plan set at 1500**. Neither is in `data/catalog.ts`
and neither is in `src/content/services.ts`.

They read as products rather than restatements of the nine service lines the
sites publish. A catalog entry naming a service page that does not exist fails
`order-audit`'s rule that every entry names a real service, and inventing two
service pages means inventing copy, titles and descriptions for regulated work,
which is not something to guess at.

**What is needed from the operator: are these two new service lines needing
their own pages, or fixed price variants of an existing one?** Beam and header
sizing plausibly sits under residential and light commercial design; a carport
and patio cover plan set plausibly does too, which would make that service
partly fixed price and partly quoted. That is a catalog structure question, not
a data entry one.

Until then the seven prices that map cleanly are set and those two are absent
rather than approximated.

### The coastal surcharge is applied to desk services, which is an interpretation

The operator gave "coastal surcharge 75 on the first tier counties" without
restricting it to field work, so it is set on all seven orderable entries
including the three desk services.

The reading: it is a property of the location rather than of the service, and a
coastal letter does carry windstorm design criteria an inland one does not.
**If the intent was field only, three entries change and nothing else does.**

Harris County gets no surcharge, because `twiaStatus` returns "check" there
rather than "designated": the designated area is the part east of State Highway
146 and a county name cannot express that. Erring toward not charging is the
right direction for a fee the firm cannot yet prove applies.

### A desk order could never have been sealed, and the fix has a boundary

`checklistState` sets `canSubmit` only when every required protocol item is
satisfied **and there is at least one required item**. That second condition was
right for every file that existed before Phase 7: a technician must not submit a
field job with no protocol, which is gathering nothing and calling it done.

A desk order legitimately has no evidence protocol. Under that rule every desk
order was permanently unsealable, found by trying to seal one.

`deskPackageComplete` now answers the question that applies to a desk order:
did the customer supply the inputs the catalog marked required? A file with no
order behind it, and a field order with no protocol, both still return
incomplete, so the original protection is untouched.

**The boundary worth knowing:** a desk order's completeness is now the presence
of the customer's files, not their adequacy. An engineer can still ask for
revisions or decline, which is the right place for that judgment, but the
platform no longer blocks the seal on a document being useless rather than
absent.

### Stripe is wired and has never spoken to Stripe

Everything is built: checkout sessions, the webhook with signature verification,
the paid transition, auto release to dispatch or review, the customer link, and
all three refund cases.

**It has only ever run against the fake provider.** The Stripe test keys are on
Preview scope, so the real adapter is unexercised: no real session has been
created, no real signature verified, and no real refund issued. The fake refuses
an unsigned webhook and the shapes match, which is not the same as Stripe
agreeing.

What is needed: a preview deployment with the Preview scoped keys, a test card
through a real Checkout session, a real webhook delivery, and a decline to watch
the refund land in the Stripe dashboard. That is the last verification the
program's Phase 7 gate asks for and it has not happened.

### settleDecision used to report a refund it had not recorded

Found by the walkthrough, through a colliding provider ref in the fake. The
first version wrote the customer facing "you have been refunded" event whether
or not the payment row landed, and only skipped the status change. The result
was the worst available shape: the customer told they were refunded, the order
still reading in fulfilment, and no payment row to reconcile against.

It now records `refund.unrecorded` internally, names the provider ref the money
went out under, and returns not-ok. The customer is not told a refund
succeeded, and not told it failed either, because by that point the money may
genuinely have moved.

### Nothing reconciles a started checkout against Stripe

Found on 2026-09-03, at the end of the real Stripe leg. Three probe orders in
development sit at `awaiting_payment` with a recorded `cs_test_` session id and
no payment row, because the webhook never delivered for them. Stripe's side of
those three is not visible from the platform at all.

The gap is not the missing webhook, which is a configuration fault and was
eventually fixed. The gap is that **the platform cannot tell the difference
between a checkout that was abandoned and a checkout that was paid while the
confirmation was lost.** Both look exactly like `awaiting_payment` with no
payment row, forever, and no surface anywhere counts them.

That is the money shaped version of the defect class this repo keeps finding: a
state that looks fine because nothing is looking. A customer in the second case
has been charged and has no order, and would find out by calling.

What is needed, in the order it matters:

1. A read only reconciliation that lists orders left at `awaiting_payment` past
   the Checkout session's own expiry, so the operator can see them at all.
2. Retrieving each session from Stripe and comparing `payment_status`, which is
   the only authority on whether money moved.
3. Only then, a way to complete or refund from that finding, through
   `markPaid` and `settleDecision` rather than around them.

`settleDecision` refuses to refund without a payment row, which is correct and
should stay correct. The answer is to record the charge that exists, not to
loosen the rule.

**Built the same day, on the operator's instruction, and this entry is kept
because the reasoning above is still the reason it exists.** All three steps
shipped in `e759b10`: `src/lib/reconcile-rules.ts` decides, `src/lib/ops-reconcile.ts`
carries it out through `markPaid`, and `POST /api/portal/orders/reconcile`
carries it, admin only, reading unless told to apply.

I had proposed deferring it on the grounds that a reconciler bolted on at the
end of a phase gets trusted before it has been tested against a real
discrepancy. The operator overruled that and was right to: three real
discrepancies were sitting in development waiting to be its first exercise,
which is a better test than anything a later phase would have invented.

**What remains undone here:** nothing surfaces the report in the portal. It is
an API route an admin can call and there is no screen for it, so an operator
learns about a stuck order only by asking. A dashboard count of orders left at
`awaiting_payment` past their session expiry is the piece that would make it
noticed rather than looked for.

### There is no way to refund an order except by declining to seal it

Found on 2026-09-03, immediately after reconciliation recorded three real
payments and the next step was to give the money back.

`settleDecision` is the only path to a refund, and the only caller is
`recordDecision` in `ops-engineer.ts`, on a seal or a refusal. That is right for
the case it was built for: the engineer's decision settles the money, in one
place, so a caller cannot forget it on a refusal.

It leaves no path at all for the cases that are not an engineering judgment:

- an order placed by mistake, or a duplicate;
- a customer who telephones to cancel before anybody starts;
- a probe or test order that has to be unwound;
- an order the firm decides not to take for a reason that is commercial rather
  than technical.

Cancelling the file does nothing to the order or its money. `markAbandoned`
only closes orders that were never paid. So a paid order can currently be
refunded only by routing it to an engineer and recording a refusal to seal.

**Why that workaround must not be used.** `review.refuse` writes to
`eng_audit_events`, which refuses deletes by design, and it records that a
licensed engineer reviewed a file and declined to seal it. Doing that to unwind
a payment would put a false professional judgment into the firm's regulatory
memory permanently. It is the one shortcut here that is worse than the problem.

What is needed: an operator refund that is honestly labelled as one. A fourth
refund case, `cancelled_by_the_firm`, full amount, no inspection fee, recorded
against the operator who authorised it rather than against an engineer. The
existing three cases stay exactly as the operator ruled them, because they are
about an engineering decision and this one is not.

Until it exists, the three reconciled probe orders in development stay paid.
They also can no longer be deleted: `eng_order_payments` is ON DELETE RESTRICT,
so an order that took a payment cannot be removed, which is correct and is the
price of recording the truth about them.

### Three brands write the same tables directly, and only one of them can read

Recorded 2026-09-03 during the production database cutover, where it surfaced as
a blocker and was worked around rather than fixed. Operator ruling the same day:
the fix is the right architecture and is separate work, to be done after launch.

**How it stands.** `sealedengineering` and `stampmyplans` hold a service role key
for the shared project and write `eng_leads` and `eng_orders` into it directly.
254 reads those tables with no site filter, which is deliberate: its portal is
the single inbox for all three brands, and `src/app/portal/(app)/clients/page.tsx`
says so in a comment.

**What that costs.** Three deployments hold a key that can read and write every
`eng_` table, including orders, payments and the audit trail. Two of them need
none of that; they need to record a lead. The coupling is also why the database
migration had to move three projects in one window instead of one, and why a
schema change to `eng_leads` is now a three repository change that nothing
enforces or verifies.

It is the same shape as the finding that started the migration. The `eng_`
prefix and the `site` column are a naming convention standing in for a boundary.

**The fix: the sisters POST to a 254 intake API.**

- One endpoint on this repository, keyed per brand, which is the pattern
  `/api/orders` already uses with `ORDER_INTAKE_KEYS`.
- The sisters hold a brand key that can create a lead and nothing else. No
  service role key, no database credential, no reach into orders or the trail.
- The `site` is taken from the key rather than from the request body, exactly as
  `/api/order-flow` takes it from `SITE_KEY`, so a brand cannot write as another.
- Validation, the compliance gate and the audit row all happen in one place
  instead of three.

**Why it was not done during the cutover.** It is a new public surface with a new
authorization boundary, and bolting it on inside a migration window is how a
thing that touches money and regulatory records gets shipped without being
exercised. The window needed two environment variables per sister; this needs an
endpoint, a key rotation, an audit, and a change to two repositories that would
then need their own verification.

**What has to be true before it ships:** the sisters' service role keys are
revoked afterwards, not merely unused, or the boundary is decorative.

### Evidence thumbnails: a column that has never been written

Recorded 2026-09-04, during Phase 8 Section 2.

`eng_evidence_items.thumb_key` has existed since migration 0001 and nothing has
ever written it. Generating a thumbnail needs an image pipeline this deployment
does not have: the captures are photographs uploaded from a phone, and producing
a small version of one means decoding, resizing and re-encoding it somewhere.

The job queue registers `evidence.thumbnail` and it fails on purpose, with a
sentence saying what is missing. That was a choice between two honest options.
Leaving the kind unregistered would dead letter any future enqueue with "no
handler is registered", which reads like a bug in the queue; failing with the
real reason is the difference between a defect and a decision. Nothing enqueues
the kind today, so the queue screen shows it registered with zero of everything.

**What would make it real:** an image pipeline. `sharp` does not run on the
Vercel Node runtime without care about the binary, and the alternative is a
provider that resizes on delivery, which would change how evidence is served
rather than how it is stored. Neither is a decision to take inside a queue
section.

**The condition to watch:** the first operator who opens a file with forty
captures on a phone and waits for forty full size photographs to load. That is
the day this stops being a nicety.

### eng_jobs grows forever, and nothing prunes it

Recorded 2026-09-04, during Phase 8 Section 2.

Every job that has ever run stays in `eng_jobs`. At the volumes this platform
sees today that is a table with hundreds of rows and it is the right default:
"did that email actually go" is a question worth answering three months later,
and a queue that deletes its own history cannot answer it.

It does not stay right. One email per order plus one notification per status
change puts the table into six figures inside a year of real trading, and
`queueHealth` reads every pending, running and dead row on every load of the
queue screen and on every worker run.

**What is needed:** a retention rule, and it has to distinguish the three states
rather than sweeping by age. A `done` job older than ninety days is a log line.
A `dead` job is a failure nobody has dealt with and must never be pruned by a
timer, because pruning it is exactly the silence this section was built to
remove. A `pending` job older than ninety days is a defect, not a candidate for
deletion.

**Why it was not done now:** a pruning job is a scheduled delete against a table
that records what the platform did, and the first version of one is where the
predicate is wrong. It deserves its own exercise on real data rather than being
written speculatively against a table with a few dozen rows in it.

**The condition to watch:** the queue screen taking a noticeable moment to load,
or `eng_jobs` passing about fifty thousand rows.

`eng_error_events` and `eng_cron_runs` grow forever on the same reasoning and
are indexed separately at the top of this file. When this rule is written, it is
written for all three.

### The responsible charge log has no evidence hash, and should

Recorded 2026-09-04, during the portal design port. Operator ruling the same
day: drop the column from the design, record the real thing here, because the
design was right to want it.

**What the design asked for.** An Evidence hash column on the responsible charge
log, with the footnote "Each entry embeds a hash of the evidence set exactly as
it stood at the moment of the decision."

**What exists.** The log is append only and that half is real:
`eng_rcl_immutable` refuses UPDATE and DELETE by trigger, and `migration-audit`
replays the table and asserts both refusals. There is no hash. Nothing computes
one anywhere in the codebase, and every occurrence of "hash" in the schema is a
credential: `invite_token_hash`, `token_hash`, `key_hash`, and the scrypt
password hash on customer accounts.

**And it is the same shape as the sealed letter ruling**, which is now standing
law in CLAUDE.md section 1: this platform does not render an assurance it did not
compute. The hash differs from the seal in one way that matters, and it is the
reason this entry stays open rather than being closed by that law: the firm COULD
compute a hash honestly, and does not yet.

**Why it was dropped rather than stubbed.** A hash on that screen is a claim that
the evidence behind a sealed document has not changed since a licensed engineer
put their name to it. Rendering a value the platform did not compute would be a
fabricated cryptographic assurance on the firm's regulatory record, which is the
worst place available for one. An empty column would be almost as bad, because a
column implies the thing exists and is merely missing today.

**What it would take, and why the hash is the easy part.**

1. *A canonical serialisation of the evidence set.* The hash has to cover
   something reproducible: for each evidence item, its protocol item key, its
   storage key, its byte length and its captured timestamp, sorted by item key.
   Anything that varies between two reads of an unchanged file, a signed URL for
   instance, must be excluded, or the hash fails to verify for a reason that has
   nothing to do with tampering.
2. *A column*, `evidence_hash text`, written in the same statement that writes
   the log row, so a decision cannot be recorded without one.
3. *A verifier*, and this is the part that makes it worth anything. A stored hash
   nobody can re-check is a string. There has to be a function that reads the
   file's evidence as it stands today, recomputes, and reports match or divergence,
   with a screen that shows the answer. Without it the column is decoration with
   a technical smell.
4. *A decision about what divergence MEANS.* Evidence can legitimately be added
   to a file after a decision, on a revision. So the verifier answers "the set
   this engineer sealed against is intact" rather than "the file has not changed",
   and the difference has to be visible or the first legitimate revision reads as
   tampering.

**The condition that makes it real:** the first time somebody outside the firm, an
insurer, an opposing expert, or a board investigator, asks the firm to
demonstrate that a sealed document's evidence is the evidence that was reviewed.
That question is the entire reason the column was drawn, and it is a good
question.

### An unmatched portal URL renders the public 404, a refused one renders the portal 404

Recorded 2026-09-04, during the portal design port. Operator ruling the same
day: leave it, record it, do not fix it.

**What happens.** `notFound()` called from inside a matched portal route, which
is what every role refusal does, renders `src/app/portal/(app)/not-found.tsx`
inside the portal chrome. A URL under `/portal` that matches no route at all
falls through to `src/app/not-found.tsx`, the public site's, with public site
copy and public site links.

**Why it is not a leak.** Both are only reachable by a signed in user: the proxy
sends a signed out client to `/portal/login` before either can render. A signed
in user learning that `/portal/queue` exists and is not theirs learns nothing,
because the navigation is built from the same permission list and simply does
not draw items their role cannot open. `security-audit`'s rule is about a signed
out client, and that rule is unaffected.

**Why it was not fixed.** Making them identical needs a catch all route under
`/portal`, which is a routing change in a workstream that is presentation only,
for a purely cosmetic gain. The wrong trade.

**The condition that would make it worth doing:** a signed in role that should
not be able to enumerate routes at all, which would be a genuinely different
security posture from the one this platform has, or a catch all arriving anyway
for another reason and this coming along free with it.

### The sealed letter screen is not built, and cannot be honestly

**Answered 2026-09-06.** A sealed document is UPLOADED, never generated, and that
is standing law in CLAUDE.md section 1 rather than a decision belonging to this
entry. What remains here is the reasoning that led to it and the two conditions
that still gate showing one at all: the registration issuing, and a PE in
responsible charge. Point 2 below, generated or uploaded, is decided; the screen
that becomes real is a viewer.

Recorded 2026-09-04, during the portal design port, Section 2 item 6.

**What the design has.** A "Sealed letter" screen: a 760px document sheet with a
letterhead, findings, a PE seal and a signature block.

**Why it was not built.** Nothing in this platform produces a sealed letter.
`eng_documents` can hold a deliverable with `sealed_at` and the sealing facts
beside it, and every deliverable that exists is an uploaded file. There is no
letter generator, no seal image, and no signature block, because there is no
Professional Engineer in responsible charge and `isPrelaunch()` stops a file
reaching `sealed` at all.

A screen rendering one would be a picture of a document that cannot exist,
carrying a seal and a signature for an engineer who has not reviewed anything.
That is the evidence hash finding again, in a worse place: a sealed engineering
letter is the actual regulated artifact.

**What was built instead.** The document sheet, over the evidence binder, which
has been assembled from real rows since Phase 6 and had only ever existed as a
CSV. `/portal/documents/binder/[fileId]` renders it on the sheet the design
specifies, and its limitations note says plainly that it is not an engineering
opinion, that it is not sealed, and that no sealed deliverable exists for the
file. The components the letter would need, `DocumentSheet`, `SheetLetterhead`
and `SheetRecordNote`, are built and in use, so the letter is a page and not a
system when it becomes real.

**What has to be true first, in order:**

1. The TBPELS firm registration issues and a PE is in responsible charge, so
   `LAUNCH_MODE` can go live and a file can reach `sealed`.
2. A decision about what a sealed letter IS: a generated PDF this platform
   composes, or a document the engineer produces elsewhere and uploads. Only the
   first needs this screen; the second needs a viewer.
3. If generated: the seal image, the signature, and where they are stored, which
   is a credential question rather than a design one. A seal that any staff
   account can render onto a document is a seal that has left the engineer's
   control.

### Nobody can decline to seal while no Professional Engineer is on staff

Recorded 2026-09-05, Phase 10 Section 2, found by the suite rather than by
reasoning: review-audit went red on "an administrator seals".

**What changed.** The five licensed capabilities stopped being permissions. All
four review decisions gate on them: sealing on `documents.seal`, and declining,
requesting revisions and sending for a site visit on `review.decide`. Both come
from holding the `engineer` role and are unrepresentable as grants, which is the
operator ruling and is working exactly as specified.

**The consequence, which is real and was not asked for.** Before this, an
administrator could decline to seal. `canReview` refuses sealing under the
compliance gate and says in its own words that "declining to seal is still
available, and deliberately so". That sentence is now only true for an active
engineer. Production holds one profile, an active administrator, so on
production today a file that reached review could not be declined by anybody.

**Why it is recorded rather than fixed.** The fix would be to make
`review.decide` grantable, which is the thing the operator ruled against, or to
special case declining, which is a check somebody can delete. Neither is a
change to make without the operator's word.

**OPERATOR RULING, 2026-09-06: it stays, and no workaround is built.** Aman holds
an invited engineer account on production and the condition resolves when he sets
a password, which is days rather than months. Building a special case for a state
that expires that soon means leaving a check in the codebase forever to cover a
fortnight, and that check is the one somebody deletes later without knowing what
it was for.

**What makes it moot.** A PE on staff, which is also what makes the review queue
reachable at all. Until then nothing reaches `under_review` in the ordinary
course, because nothing can be sealed and no engineer is taking files into
review. The exposure is a file already sitting under review with no engineer
account, and there is none.

### RESOLVED 2026-09-06: the portal version footer says "production" on a machine pointed at development

Recorded 2026-09-05, noticed while looking at the Section 2 screenshots at 1280.

`ENVIRONMENT` in `src/lib/ops-observability.ts` is
`VERCEL_ENV ?? NODE_ENV ?? "development"`, and the sidebar footer renders it
beside the release. `vercel env pull` writes `VERCEL_ENV="production"` into
`.env.local`, so a local server reading the DEVELOPMENT Supabase project
displays "production" to whoever is looking at it.

`src/lib/db-guard.ts` already says, at length and from an incident, that
"VERCEL_ENV is not proof of anything" and that a guard trusting it alone was a
defect. The same untrustworthy value is being shown to the operator as a fact
about which system they are looking at, which is the confusion the preview
pointing at production incident was made of.

**Not fixed when it was found, because it was not that section's work and it
was not free.** `ENVIRONMENT` also tags every fault the error store records, so
changing what it means changes how faults are grouped. The honest label is the
one `db-target.mjs` and `db-guard.ts` already compute: the Supabase project the
process is actually talking to. That is the shape to build, deliberately,
rather than as a side effect of a permissions branch.

**Built that way, in the closeout.** `environmentLabel()` in
`src/lib/db-guard.ts` answers the question a person reading a footer actually
has, which is which records are on the screen: "local on the development
database", "production on the production database", "an unrecognised database
(ref)" when it is a project nobody named, "no database" when there is none.
Where it runs is decided by `onAVercelDeployment`, the same test the production
guard makes and for the same reason, so a laptop holding a deployment's
variables says local. The portal footer and the status page both render it.

`ENVIRONMENT` is untouched and still tags faults, with the reasoning written
beside it. `db-guard-audit` asserts the label on every case including the one
that started this, and asserts by inspection that both screens render the label
rather than the build mode, because the functions being right is worth nothing
if a revert puts `{ENVIRONMENT}` back in the footer.

**And the other half of that line was empty, which nobody had noticed.**
The footer renders `RELEASE · <label>`, and on a local machine it rendered
" · local on the development database" with nothing where the commit belongs.
`vercel env pull` writes `VERCEL_GIT_COMMIT_SHA=` with nothing after it, an
empty string is neither null nor undefined, so `?.slice()` produced "" and the
`??` chain kept it. Every fallback behind it was dead. `sentry-config`'s
`release()` and `environment()` had the same shape, so a fault raised from a
machine in that state would have been tagged with an empty release, which
groups worse than no tag because it looks like a value.

`firstNonEmpty` in `src/lib/env-value.ts` is now what reads them, and
`observability-audit` asserts the fallback behaviour directly and asserts that
both readers go through it. The value checks in that audit are honest about
what they cannot see: on a machine where the variable is unset rather than
empty, the old code and the new code agree, so the coupling check is the one
doing the work.

Found in a screenshot, on the day the label beside it was being fixed. Not by
any check.

### The portal sidebar clips its own navigation with no affordance

Recorded 2026-09-05, seen in the Section 2 screenshot at 1280 by 900.

The rail is `fixed inset-y-0` with `flex-1 overflow-y-auto` around the nav, so
past about fourteen items the rest scroll out of sight with nothing on screen
saying so. At 1280 by 900 the visible list ends at Technicians, and People,
Audit, Roles and the rest are reachable only by scrolling inside the rail.

Verified rather than assumed: the inner container reports `scrollHeight` 1036
against `clientHeight` 684, so the links are reachable and this is not a
navigation failure. It is a discoverability one, and it got worse with every
screen this platform added. Not introduced by Section 2 and not fixed by it.

### RESOLVED 2026-09-06: the invite form still offers three roles, not seven

Recorded 2026-09-05, found while checking how a Professional Engineer would be
given an account after Phase 10 Section 2 shipped.

Roles became data. The invite path did not. `src/app/api/portal/people/route.ts`
validates the submitted role with `ROLES.includes(role)`, and `ROLES` in
`ops-authz.ts` is still the literal `["admin", "engineer", "field_tech"]`. So an
administrator can create an account only in one of the three original roles.

**What still works.** Dispatcher, sales, customer service and read only are
reachable, just not at creation: make the account in one of the three, then move
the person on the roles screen, which reads `eng_roles` and offers all seven.
The grants apply on their next request.

**Why it was not fixed in the same breath.** The role list is not the only thing
that form knows: it branches on the role to decide whether to ask for a licence
number and a TDI appointment, or for coverage counties and a base city, and
those branches are `role === "engineer"` and `role === "field_tech"` rather than
anything data driven. Making the SELECT read `eng_roles` while the fields around
it still key off three hardcoded strings would produce a form that offers a
dispatcher and then silently asks nothing about them, which is worse than the
honest three.

**The shape of the fix.** The per role fields belong on the role row, or in a
declaration beside `DEFAULT_ROLES`, in the same way `data/intake-fields.ts`
holds what a job can be asked. Then the form is generated from the definition
and the select follows for free.

**Built that way.** `inviteFields` is a required member of `DefaultRole`, so a
role cannot be declared without saying what creating one has to ask for, and
`inviteFieldsFor()` answers for a role invented on the roles screen with an
empty list rather than a guess. The form maps the roles the page hands it, read
from `eng_roles`, and names no role anywhere in its code. The endpoint asks the
table whether the key is a role instead of comparing against a literal, and
still refuses a key nobody created.

Asserted in `roles-audit`, including live: an administrator creates a
dispatcher through the real endpoint, the row comes back carrying that role, an
invented key is still refused with a 400, and the account is torn down by the
verified teardown. Injected four ways, each failing its own check and only its
own, plus a fifth against the built server with the three role list put back.

**Two more of the same defect were found while doing it, and both are fixed.**

`ROLE_LABEL` was `Record<Role, string>` with three keys, so a dispatcher, a
salesperson, customer service or a read only account rendered a BLANK where
their role should be: in the profile menu, as the eyebrow on their own
dashboard, in the roster, on the profile screen, and on the page where they set
their password and are told what they are. Nothing failed, because the roster
row was typed as `Role` and that type stopped being true when roles became
rows. It is now `roleLabel(key, nameFromTheRow)`, and `roles-audit` asserts
that no surface indexes a fixed map.

`visibleFiles` switched on the three role names with NO DEFAULT, and TypeScript
accepted it as exhaustive for the same reason. A dispatcher reached the end of
the function and got `undefined`, in a function whose every caller reads
`.kind`. The two identity scopes stay keyed on the role, because an engineer's
queue and a technician's own jobs are facts about who somebody is, and
everything else is answered by `files.list`.

**And one that is NOT fixed, recorded rather than swept.** Several modules still
gate on a role NAME rather than on a grant: `ops-tasks`, `ops-field`,
`ops-engineer`, `ops-dispatch`, `ops-comms` and `ops-dashboard` all compare
`actor.role === "admin"` in places where the question is really a permission.
The four newer roles therefore behave in those places as though they were
nobody: a dispatcher holds `offers.dispatch` and `ops-dispatch` still asks
whether their role is field_tech or admin. Nothing is unsafe, because the
comparisons all fail CLOSED, and none of it is reachable today because nobody
holds those roles yet. It is a day of careful work with real behavioural risk,
each comparison has to be read to decide which grant it meant, and doing it
inside a closeout queue item about a form would be the wrong place. The
platform's own rule is written in `ops-authz`: everything except the two
identity scopes asks the grants.

### A failed portal sign in inside forms-audit breaks careersChecks, and nobody knows why

Recorded 2026-09-05, Phase 11 Section 1, while bringing the portal inside
forms-audit.

**What happens.** `portalAuthFormChecks` submits a deliberately wrong credential
to `/portal/login`, which is the point of the check: a sign in that fails
silently is how somebody decides the software is broken. With that block running
BEFORE the marketing form checks, `careersChecks` then times out waiting for the
application flow submit button.

**Isolated to one line.** With the whole block present and only that single fill
disabled, 89 of 89 pass. With it enabled and the block first, careers fails.
Without the block at all, 80 of 80 pass.

**What it is not.** Not the login rate limiter: that is keyed by address and
identity, `/api/apply` does not consult it, and one attempt against one address
is not a lockout. Not a listener leak: `trackPosts` attaches to the page and
both pages are closed. Not a shared cookie: the sign in failed.

**What was done.** The block runs last, which removes the interference and is
the better order anyway, since the portal pre-session forms have nothing to do
with the public intake forms.

**Why it is still recorded.** Ordering is a mitigation, not an explanation. Two
audits interacting through a mechanism nobody has named is exactly the kind of
thing that comes back as a flake somebody re-runs until it passes. The next
session that touches forms-audit should find this written down rather than
rediscover it.

**OPERATOR RULING, 2026-09-06: the mitigation stands with the note.** Not worth a
session while it is reordered and green. This entry is the whole point of the
ruling: the next person to touch that file reads why the order matters before
they change it.

### Three small defects found by walking the portal at 390

Recorded 2026-09-05, Phase 11 Section 2, from the walk that filled
`docs/portal-screen-verdicts.md`. None was reported by any audit, because none
of them is a property an audit here measures.

1. **Platform status runs a sentence into a timestamp.** The dependency rows
   read "STRIPE_SECRET_KEY is not set, so nothing can be ordered Read 0s ago."
   The reading time is appended with no separator, so two sentences become one
   that says neither thing.

2. **The responsible charge log says "1 minutes".** A review that took a minute
   is pluralised as though it took several.

3. **Files fills a phone screen with filter chips before showing a file.**
   Eleven status chips wrap into six rows at 390. Not a defect in the chrome,
   which is correct on that screen, and not something any check can see: it is
   a content ordering decision. Recorded as the one Weak verdict in the table.
   The Tasks screen shows the pattern that works, three chips on one row.

The first two are copy. The third is a decision about what a phone should show
first on a list screen, and it should be taken deliberately rather than fixed in
passing.

### The eng-messages round trip is verified on development, not on production

Recorded 2026-09-05, Phase 11 Section 3, replacing the entry below which is now
resolved: the production bucket was created 2026-09-05 and is private.

**What IS verified on production**, directly and without credentials:

- The bucket exists, `public = false`, 20MB limit, the five allowed mime types,
  zero objects, and none of the four `eng-` buckets is public. Read from
  `storage.buckets`, which writes nothing.
- An unauthenticated GET on the public url form answers 400, and so does the
  listing endpoint. That is the request an outsider would actually make and it
  needs no key, which is why it is worth more than the column.

**What is NOT verified on production:** the full round trip. Upload, signed
retrieval, byte comparison and expiry all need either the service role key,
which standing law keeps out of the working tree, or a signed in portal session
which this session does not have.

`scripts/bucket-roundtrip.mjs` performs all of it and passes 11 checks against
development, including a one second url answering 200 and then 400 three seconds
later. The mechanism is the same service and the same bucket configuration on
both projects, so the development pass is evidence about production rather than
about a different system, but it is not the same claim and this entry exists so
nobody reads it as one.

**The cheapest way to close it** is the operator opening a file thread on
production, attaching a photograph, and seeing it render. That exercises exactly
the path the script cannot reach from here.

### RESOLVED: the eng-messages bucket exists on development only

Recorded 2026-09-05, Phase 11 Section 3.

Message attachments land in a private `eng-messages` bucket, created on the
development project by a script. Production does not have it, so an attachment
on production would fail at the point a signed upload url is asked for.

`docs/production-cutover-plan.md` step 3 lists three buckets and now needs a
fourth. Creating it is one call and it is not done here, because a bucket on
production is a production change and those happen on the operator's word.

The reasoning for a separate bucket rather than eng-evidence is in
`docs/messaging-section-3.md` section 8.

### Message attachments are not yet in the evidence binder

Recorded 2026-09-05, Phase 11 Section 3, item 8 of that report.

The bucket ruling says a file thread's attachments appear in the binder, so the
firm can produce them and they are honestly described as sent in conversation
rather than captured against a protocol item. The bucket and the attachments are
built; the binder section is not.

Until it is, a photograph on a file thread is visible to anybody who can see the
file and is NOT in the assembled record. That is a smaller gap than it sounds,
because the binder assembles fresh from rows and this is a section rather than a
migration, but it is the half of the ruling that is not yet true.

### RESOLVED: probe residue, and the demo block that was the file sequence

Recorded 2026-09-05, Phase 10 Section 3, operator ruling E.

**The sequence defect, which was worse than reported.** The next file number is
derived from the HIGHEST number in the year, and the demonstration block was
9001 to 9003. So on development the next real file would have been
254-2026-9004: the demo block was not at risk of advancing the sequence, it WAS
the sequence. Demo files now carry `254-DEMO-NNNN`, which the `%-2026-%` filter
cannot see, so the exclusion is structural rather than a rule to remember.

**The cause, not the residue.** `scripts/lib/probe-ledger.mjs` records what a run
creates and removes exactly that, the way `portal-probe.mjs` already did for
accounts. Wired into messaging-audit, which was leaving a thread and several
messages behind on every run.

The residue itself came from throwaway screenshot scripts that held no ledger,
not from the committed suite. That is worth knowing: the suite was mostly clean
and the mess was mine.

**What is deliberately still not swept:** `eng_audit_events`. That table refuses
deletes at the database level and should, so three and a half thousand probe
sign in rows remain on development. Their presence is the price of a guarantee
that a test run cannot erase from the firm's regulatory memory, and it is the
right trade.

### The example data is a described firm, and nothing in it is sealed

Recorded 2026-09-05.

`seed-field-demo` resets every run now, sweeps legacy residue, and produces
three files at three points in the process: one submitted, reviewed and
declined with six evidence items and a conversation; one dispatched, accepted
and mid capture; one waiting for dispatch.

**Nothing is sealed and nothing will be.** `isPrelaunch` refuses it, and a
seeded seal would be a claim that a Professional Engineer certified work at an
address, written into the same tables a real one goes in. The declined decision
is real, available today, and the more interesting thing to show.

`KEEP_EXISTING=1` tops up instead of rebuilding, spelled the way
`ALLOW_PRODUCTION_DB` is, for somebody mid demonstration.
