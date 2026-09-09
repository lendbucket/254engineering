# Retention, Section 0: the inventory

Phase 12 Section 3. Read before the floors are set, because a floor set without
this is a number somebody imagined.

**Everything here was measured on 2026-09-09 against the live databases, except
where it says "assumed", and every assumption is written beside the number it
produces so it can be corrected.**

Production is `fsaryeciduszuahgjbly`. Development is `ythzaiqeoijlrdibnieo`.

---

## 1. What is actually there, and what grows

### The firm has not opened, and the database is already growing fast

Production carries **no** orders, files, payments, clients, partners, statements,
leads worth the name, or responsible charge entries. It carries 2 profiles and 1
application. Everything else with rows in it is the MACHINE.

| Table | Production rows | Rows per month | Time to 1,000 | Driven by |
| --- | --- | --- | --- | --- |
| `eng_cron_runs` | **7,719** | **51,878** | **~14 hours** | the clock |
| `eng_jobs` | 1,290 | 8,675 | ~3.5 days | the clock |
| `eng_audit_events` | 476 | 2,309 | ~13 days | the clock, plus every action |
| `eng_metrics_daily` | 52 | 520 | ~1.9 months | the daily rollup |
| everything else | 0 to 118 | 0 | never, yet | the firm |

Measured over 4.46 days of cron history and 6.19 days of audit history. These
are not projections: they are the observed rate with the firm doing no work at
all, so they are a floor rather than an estimate.

**The single most important number here is 51,878 rows a month from
`eng_cron_runs`, and the reason it matters is not its size. It is that the rate
does not depend on the firm.** A firm doing one file a month and a firm doing a
thousand generate the same cron history. Every other table in the schema grows
because the business grew; this one grows because time passed.

### Development grows from a different cause

| Table | Development rows |
| --- | --- |
| `eng_audit_events` | **7,627** |
| `eng_jobs` | 415 |
| `eng_notifications` | 43 |
| `eng_responsible_charge_log` | 28 |
| `eng_error_events`, `eng_order_events` | 24 each |
| `eng_partner_touches` | 17 |
| everything else | 8 or fewer |

Development's largest table is the audit trail, and it is large because **the
audit harness signs probes in and out on every board run**, and that table
refuses deletes. Production's largest table is the cron log. The two databases
are big for entirely different reasons, and a retention rule written from one
would be wrong about the other.

### Every table has a column to age it by

All 72 carry `created_at`, except `eng_metrics_daily` (`day`) and
`eng_error_events` (`occurred_at`). Twenty-two carry a second, more meaningful
timestamp: `closed_at`, `delivered_at`, `sealed_at`, `finished_at`, `ended_at`,
`completed_at`, `paid_at`, `issued_at`, `reviewed_at`. A retention cutoff has
something honest to compare against on every table in the schema, which is not
something to take for granted.

---

## 2. Ten tables cannot be deleted from at all, and that is already law

Not policy. A trigger, at the database, refusing the most privileged credential
this platform has.

**Absolute refusal, no cascade** — nothing can remove these, ever:

- `eng_audit_events`
- `eng_responsible_charge_log`
- `eng_partner_touches`
- `eng_partner_acceptances`
- `eng_partner_asset_versions`

**Refuses a direct delete, permits a cascade from its parent:**

- `eng_file_events`
- `eng_order_events`
- `eng_certification_attempts`

**Its own refusal, for its own reason:**

- `eng_order_payments` — "Record a refund instead"
- `eng_partner_entries` — a partner ledger entry cannot be removed

### Proved rather than read

The service role is the most privileged credential the platform has. Attempting
a real delete of a real row on development, with before and after counts:

```
eng_responsible_charge_log
  before 28, after 28, rows lost 0
  refusal: eng: eng_responsible_charge_log is append only. DELETE is not permitted on it.
eng_audit_events
  before 7627, after 7627, rows lost 0
  refusal: eng: eng_audit_events is append only. DELETE is not permitted on it.
eng_partner_touches
  before 17, after 17, rows lost 0
  refusal: eng: eng_partner_touches is append only. DELETE is not permitted on it.
```

**So the kept-forever list is already enforced for the responsible charge log,
and a retention job running as admin cannot touch it.** That is the proof asked
for, and it did not need a line of new code.

**The consequence nobody should miss: retention cannot shrink
`eng_audit_events` either.** It is development's largest table and it grows on
production at 2,309 rows a month. The only way to bound it is to loosen the
trigger, which would be the wrong repair for the same reason it has always been:
the audit trail is what an enforcement action reads. It grows forever, by
design, and the section should say so rather than quietly wish otherwise.

---

## 3. Retention is already half decided by the foreign keys

`ON DELETE RESTRICT` is a retention floor written in the schema, and the
declaration has to agree with it or the job fails at runtime.

- **A file cannot be deleted while its client exists** — `eng_files → eng_clients`
  is RESTRICT. And deleting a file CASCADES to `eng_documents`,
  `eng_evidence_items`, `eng_file_events`, `eng_file_inputs`,
  `eng_review_sessions`, `eng_tasks`, `eng_threads` and `eng_assignments`. One
  file deletion is eight tables.
- **An order cannot be deleted while it has a payment** — `eng_order_payments →
  eng_service_orders` is RESTRICT, and payments are kept forever. So an order
  that ever took money is kept forever too, without anybody ruling it.
- **A person cannot be deleted while they have earnings** — `eng_production_ledger`,
  `eng_tech_pay_ledger` and `eng_time_log` all RESTRICT against `eng_profiles`.
- **A partner who was ever touched cannot be deleted** — `eng_partner_touches`,
  `eng_partner_entries` and `eng_partner_statements` all RESTRICT against
  `eng_partners`. Already known and recorded in BACKLOG.

### And one interaction that would silently undo Section 2's work

`eng_production_ledger.file_id` and `eng_tech_pay_ledger.file_id` are **ON DELETE
SET NULL**.

Section 2 scopes a person's pay figures through the FILE: an entry is a
demonstration when the work it is about is, and an entry with no file is counted
because `file_id` is nullable and an inner join would quietly reduce somebody's
pay.

So **deleting a demonstration file would null its ledger entries' `file_id`, and
those entries would start counting in a real person's pay figures.** Retention
would silently undo the money scoping built three days earlier. This needs a
ruling before any file retention runs, and it is flagged rather than solved.

---

## 4. Rollups: what exists, and the biggest table has none

`eng_metrics_daily` is the only rollup. Thirteen metrics, keyed `(day, metric)`,
computed by `metrics.rollup` on the daily cron.

**It reads eleven source tables**: `eng_service_orders`, `eng_order_payments`,
`eng_files`, `eng_leads`, `eng_applications`, `eng_jobs`, `eng_error_events`,
`eng_error_types`, `eng_account_api_requests`, and `eng_audit_events` (sign-ins).

Which surfaces read the rollup rather than source: the metrics screen only,
through `ops-metrics.ts:228`, `day >= from`, defaulting to 14 days. Everything
else on every dashboard and every report reads SOURCE. So today the rollup
replaces nothing: deleting a source row would lose a figure that a report still
computes from source.

**`eng_cron_runs` has no rollup at all.** No metric reads it. It is written by
`cronStarted`/`cronFinished` and read in exactly one place, `cronHealth`, as
`.limit(500)` — the last 500 runs. The fastest growing table in the schema, at
51,878 rows a month, is machine telemetry that nothing aggregates and nothing
reads beyond the most recent 500 rows.

**And the rollup hits the cap itself in under two months.** 520 rows a month at
13 metrics a day. Its reader defaults to 14 days, about 182 rows, so the default
is safe; a longer window truncates. A rollup designed to outlive its sources
needs its own bound.

---

## 5. Legal and contractual floors found in the repository

*(Section 0 item 4. From a search of the repository only. Where the repo is
silent this says so and supplies nothing. No number here comes from general
knowledge, and none is presented as the firm's obligation unless the repo says
it is.)*

### The finding, in one line

**Nowhere in this repository is a retention PERIOD stated for any record.** Not
in the terms, not in the partner agreement, not in the employment agreement, not
in any cited TBPELS rule, not in the privacy policy. The repo asserts that
obligations exist and repeatedly, deliberately declines to say what they are.

### Item by item

**Customer terms accepted at checkout.** The checkout acceptance is not the
`/terms` page at all: what a customer ticks is one of two sentences in
`src/components/order/OrderFlow.tsx:572` and `:613`, about a quote not being an
order and about what happens if the engineer declines to seal. The `/terms` page
carries no section on record keeping, retention, deletion or a right of
deletion. **THE REPOSITORY IS SILENT.**

**Partner agreement.** The text is a database column
(`0013_partner_program.sql:218`), not repo text. The only bodies committed are
demo seeds in `scripts/seed-field-demo.mjs:960`, covering firm of record,
marketing marks, commission and holdback. No record-keeping clause. The one
durability statement is about the agreement record itself
(`0013_partner_program.sql:215`): "An agreement whose text changed after
acceptance is an agreement nobody can prove the terms of." No duration.
**THE REPOSITORY IS SILENT.**

**Employment agreement.** Not in the repository, and the repo says so at
`BACKLOG.md:3142`: "The agreement is not in this repository. The clause numbers
above are the operator's citations, recorded as given rather than paraphrased,
because nothing in this repo can verify them." **THE REPOSITORY IS SILENT.**

**TBPELS rules cited.** Five citations exist, all in `src/content/insights.ts`:
22 TAC §137.33 (sealing procedures), §131.2 (definitions), Tex. Occ. Code
§1001.401, §1001.405, §1001.301, and Tex. Gov't Code §2254.002–.005. Every one
is about sealing, the use of a seal, or procurement. **Not one concerns
retention of project records, responsible charge records or sealed documents.**
**THE REPOSITORY IS SILENT ON A TBPELS RETENTION RULE.**

**Privacy policy — the only place retention is addressed at all.**
`src/app/(site)/privacy/page.tsx:122`, verified verbatim:

> **Enquiries and waitlist entries.** Kept while they are useful for the
> correspondence and for business records, and reviewed periodically. An entry
> is deleted on request.
>
> **Applications.** Kept for as long as the application is live plus a
> reasonable period afterward, so that a candidate can be reconsidered when a
> suitable role opens. Deleted on request.
>
> **Engineering records.** Records relating to engineering work, once the firm
> is performing it, are retained for the periods required of a registered
> engineering firm in Texas. Those obligations sit above a deletion request, and
> this policy does not promise otherwise.

**Read that last one carefully, because it is the only obligation the firm has
published and it is a POINTER rather than a period.** The firm has told the
public that engineering records are kept for as long as Texas requires, and has
not said, anywhere in this repository, how long that is. It also publishes at
`:143` that Texas residents have a right to deletion under the Texas Data
Privacy and Security Act, and that engineering obligations sit above it.

So the customer-facing promise is already made and already correct, and Section
3 must not contradict it: **a retention floor shorter than the Texas requirement
would make the privacy policy false**, and this repository cannot tell anybody
what that requirement is.

**Stripe and payment records.** `docs/disaster-recovery.md:252` lists what the
Stripe key reaches, as blast radius rather than retention. **THE REPOSITORY IS
SILENT.**

### Everywhere else that mentions retention says it does not exist yet

- `BACKLOG.md:916`, verified verbatim: "**Operator ruling, 2026-09-06: build no
  retention deletion yet. Keep everything.** A firm with two staff and no
  customers deletes nothing at zero cost, and a retention rule written before
  there is volume is a rule written from nothing that can destroy evidence." And
  at `:929`: "The actual periods are set when there is something to retain."
- `docs/disaster-recovery.md:342`: "It does not state a retention window or a
  recovery time objective... Writing a plausible number here would be exactly
  the fabricated assurance this platform refuses everywhere else."
- `docs/platform-state.md:452`: the telemetry proposal, and it is a PROPOSAL:
  "a `done` job older than ninety days is a log line, a `pending` one is a
  defect, and a `dead` one must never be pruned by a timer." Ninety days is a
  queue-pruning suggestion, not a records obligation, and nothing has ruled it.
- `CLAUDE.md:664`: the telemetry tables "are meant to be pruned on a schedule".
  No period.
- `docs/PORTAL_DESIGN_STANDARDS.md:491`: "Data retention policy + legal hold on
  files" is listed as NOT BUILT.

The only "ten years" in the repository is a design rationale rather than an
obligation, at `BACKLOG.md:2840`, about the responsible charge log surviving an
engineer leaving the firm. It cites no rule. **It is not evidence of a period
and must not be used as one.**

### What this means for the floors

Every floor in this section is a BUSINESS RULING and none of them can be derived
from this repository. The one thing the repo does constrain is the direction: the
privacy policy has already promised the public that engineering records are kept
for the periods Texas requires, so no floor may be set below that, and what that
is has to come from outside this repository, on advice, exactly as the
kept-forever list already says for sealed files.

---

## 6. The twenty-two reads, by deadline

The survey in BACKLOG ranked by **what a truncated result corrupts**. This ranks
the same reads by **when they break**, and the two orders are close to inverted.

**Assumption, stated so it can be corrected: 40 files a month.** Nothing in this
repository states a target volume, so this number is mine and not the firm's.
Every figure below scales linearly with it: at 400 files a month divide every
deadline by ten.

Rows per file, derived from the schema's own write paths rather than measured,
because production has no files to measure:

| Per file | Rows | Derived from |
| --- | --- | --- |
| `eng_files` | 1 | one row per file |
| `eng_file_events` | ~8 | the status check constraint has 12 states; a completed file passes through 8 |
| `eng_service_orders` | ~1 | one order per file that was paid for |
| `eng_order_events` | ~6 | measured on development: 6 distinct event names per order |
| `eng_evidence_items` | ~15 | one per protocol item captured |
| `eng_responsible_charge_log` | 1+ | one per review decision, more with revisions |
| `eng_production_ledger` | 1 | one per completed review |
| `eng_tech_pay_ledger` | 1 | one per completed job |
| `eng_partner_entries` | ≤1 | only attributed orders |
| `eng_statement_lines` | ≤1 | only invoice-mode accounts |

### The ranking that results

| Deadline | Read | Table | Rows/month at 40 files |
| --- | --- | --- | --- |
| **passed** | `ops-observability.ts:270` cron health | `eng_cron_runs` | 51,878, machine |
| **passed** | queue depth (`ops-jobs.ts:330`) reads only pending/running/dead, **which is 0 on production today**; the table is 1,290 and all done | `eng_jobs` | 8,675, machine |
| **passed** | anything reading `eng_audit_events` unbounded | `eng_audit_events` | 2,309, machine, **and undeletable** |
| ~2 months | metrics window beyond 14 days | `eng_metrics_daily` | 520, machine |
| ~1.7 months | evidence lists per firm | `eng_evidence_items` | 600 |
| ~3 months | file timelines in aggregate | `eng_file_events` | 320 |
| ~4 months | order timelines in aggregate | `eng_order_events` | 240 |
| ~25 months | `eng_files`, `eng_responsible_charge_log`, ledgers | 40 each |
| **years** | every Tier 1 money read in the survey: partner balances, statement totals, credit decisions | partner and statement tables | ≤40 |

**The finding this section turns on: the reads that would corrupt money have
deadlines measured in years, and the reads already past the cap are all machine
telemetry.** The survey's danger ranking and this deadline ranking disagree
almost completely, and both are correct about different questions. Retention
answers the deadline question. It does not answer the money question, because
partner balances and statement totals will not reach a thousand rows for years,
and the reason to fix those is that they are wrong when they break, not that
they break soon.

---

## 7. THE FLOORS, RULED 2026-09-09

The operator's rulings on this inventory. These are the input to Section 2's
declaration; nothing here is inferred.

1. **No business record is deleted by retention in this section.** The repo is
   silent on the Texas period, the privacy policy points at it, and a floor set
   below it would make a published policy false. Every table holding a business
   record is declared **"kept, floor pending counsel"** with that as the stated
   reason, and retention treats it as kept forever until the operator replaces
   the line. The question is with counsel and TBPELS and is on the operator's
   standing list. **Retention's deletion scope in this section is TELEMETRY
   ONLY.**

2. **`eng_cron_runs`: a rollup first, then a 30 day floor.** Runs, failures and
   duration per job, per day, into `eng_metrics_daily`, proven against the
   source before anything is deleted. It is the one table with a real floor in
   this section, and it is the one going from empty to a thousand rows in
   fourteen hours regardless of what the firm does. **The same shape for
   completed job queue rows: rollup, then 30 days. Failed and pending rows are
   never aged out by a timer.**

3. **`eng_audit_events`: kept forever, declared as such**, because that is what
   an audit trail is. Its growth is bounded by PAGING ITS READS, which is
   Section 1's work rather than retention's. **Recorded so nobody expects
   retention to bound it.**

4. **Ledger `file_id` becomes `ON DELETE RESTRICT` by migration.** A ledger
   entry whose file is gone cannot be scoped, and an unscopable money row is
   worse than an undeleted demonstration file. Consequence accepted: a
   demonstration file with earnings is KEPT, and `is_demo` keeps it out of every
   figure. Retention refuses such a file and names the ledger entries as the
   reason.

5. **The foreign keys that already decide this are recorded as kept-forever
   rules in the declaration, with RESTRICT as the stated reason**, so the
   declaration and the schema say the same thing and the audit proves they still
   do: an order that took money, a person with earnings, a partner ever touched.

6. **Item 4's finding goes in the declaration's header**: the repository states
   no retention period, the privacy policy points at Texas, and the one "ten
   years" in the repo is a design rationale citing no rule and is unusable.

## 8. What I asked before the floors were set

*(Kept as asked. Rulings 2, 3 and 4 above are the answers.)*

1. **`eng_cron_runs` has no rollup.** Deleting it loses nothing anybody reads
   past the most recent 500 rows, but the standing rule is that a source is
   deleted only after a rollup replaces it. Either it gets one (runs and
   failures per day, per name) or it is ruled exempt as telemetry no figure is
   derived from. The second is defensible and it is a ruling, not an inference.
2. **The `SET NULL` on ledger `file_id`** would make deleted demonstration work
   count in a real person's pay. Needs a decision before any file retention.
3. **`eng_audit_events` cannot be bounded by retention** and grows at 2,309 a
   month on production. Recorded so nobody expects this section to solve it.

## 9. What Section 2 built, and where each finding above landed

Written 2026-09-09 at gate 2. This closes the loop on section 8's three
questions and section 7's six rulings, so the inventory does not read as though
it is still waiting on any of them.

**The declaration is `src/lib/retention-policy.ts`**, 73 tables: 41 kept pending
counsel, 22 kept forever, 8 not a record, 2 deletable. A table in the schema and
not in it fails the board, and so does a table in it and not in the schema.
`scripts/retention-audit.mjs` derives the list from the migration chain, which
is independent of both.

**Section 8 question 1, the cron rollup: built.** `cron.runs`, `cron.failures`
and `cron.seconds` are computed in `rollupDay`, read as rows in one pass so the
duration cannot disagree with the counts, and the duration is a sum rather than
a mean so days can still be combined. The 30 day floor exists only because they
do, and the job refuses to delete a day whose rollup is absent or disagrees,
naming the day.

**Section 8 question 2, the `SET NULL` on ledger `file_id`: closed by 0030.**
Both are `ON DELETE RESTRICT` now. Proved rather than declared: a demonstration
file with a $600.00 production ledger entry against it refuses to delete, by
constraint name, with the entry's `file_id` still set.

**Section 8 question 3, `eng_audit_events`: recorded, not solved.** It is
declared kept forever with the ruling attached and the sentence that nobody
should expect retention to bound it. Section 1's paging is what bounds its
readers.

**Sections 2 and 3 above, the ten tables that refuse deletes and the foreign
keys: both are now rules in the declaration** rather than facts in this
document, with the trigger or the constraint named as the reason, and the audit
proves the declaration and the schema still agree.

### What the manifest carries, and the two defects the audit found

`eng_retention_runs`, added by 0031, is written before a run touches anything:
the policy as it stood, the set by id range and by sha256 over the ids, the
rollups proved per day, the mode, the actor, and the time in Central written by
the database from the same `now()` as the UTC instant beside it. It refuses
DELETE and allows UPDATE, both proved with the service role.

Two defects were found by the audit disagreeing with the code rather than by
anybody reading it:

1. **`eng_evidence_items` was declared kept pending counsel** while the
   operator's ruling says the evidence binder of a sealed file is kept forever.
   The audit pins that ruling as a literal the declaration cannot reach, and
   they disagreed. The table holds the evidence of every file and nothing in its
   shape tells a sealed one from an unsealed one, so the stricter rule takes the
   whole table.

2. **The first dry run sent twenty emails.** The script called the queue's
   worker to watch its own job finish, and the worker claims the oldest eligible
   row of any kind. Development's queue holds 399 pending jobs that nothing
   drains, 307 of them email, and Resend accepted the twenty it reached. The
   script refuses to drain over a backlog now; the backlog is its own item in
   `BACKLOG.md`.

### What is deliberately absent

No schedule and no screen. A retention pass is planned and enqueued by hand with
`npm run retention-dry-run`, and no execute run has happened anywhere, because
`executeAuthority` refuses to mint the authority to delete while the prelaunch
gate is on. All four absences are in `BACKLOG.md` with their reasons.
