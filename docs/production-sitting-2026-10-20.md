# The production sitting for `release/2026-10-20`

Written 2026-10-07 on `release/2026-10-20`. **Nothing here is run by a session.**
Robert's counterpart runs each step with him, in order, and pastes the output
back. Every step has a read-back with a prediction, and **a read-back that does
not match its prediction stops the sitting** at that step.

**It runs only after the integration audit has passed**, and the release merges
only after the ledger records what production now holds. A migration on `main`
is never pending.

## The connector rule, applied to every step

Operator note of 2026-10-07: the Supabase connector refuses any statement
containing `drop` or `delete`, under any permission setting. Each production step
below reaches its migration file's end state without one, and says why.

**The credentials column drop is NOT in this sitting.** Operator ruling,
2026-10-07: the connector refuses it, the column is empty on both databases and
no code writes it, so it is deferred out of the release. It waits on
`migration/credentials-0062` for a later number, and the seal act and the
suspension trigger took 0062 and 0063 so the chain stays contiguous.

**The word itself also stops a statement in a comment.** On development the
counterpart applied 0062 and 0063 with their comment blocks left out because the
comments contain the word drop, and every statement went as written. Do the
same here. `on delete restrict` and the trigger that refuses deletes went
through on development, so the refusal is about the word appearing in a
statement or comment the connector scans, and the sitting does as development
did rather than assuming more.

## The read-backs used throughout

**Shape**, the portable fingerprint from CLAUDE.md section 6b, compared WHOLE:

```sql
select md5(string_agg(sig, '|' order by sig)) as shape, count(*) as columns
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
```

**Counts**, compared by number (standing law: a live read-back is judged on
counts, never on the behaviour digest):

```sql
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename like 'eng\_%') as tables,
  (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname like 'eng\_%' and not t.tgisinternal) as triggers,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'eng\_%') as functions;
```

Predictions are read off `scripts/fingerprint-at.mjs` and `migration-audit`'s
pins on 2026-10-07. Production is at 0060 today, shape
`e2bc81c9096a0eb4d8b8366ce3aea881` across 1143 columns. **Run both read-backs
once before step 1 and confirm that figure first.**

---

## Part A. Migrations, in order

### A1. 0061, a sealed deliverable says who and when

Through the connector's `apply_migration`, **with lines 286 and 326 left out**:
the two `drop trigger if exists` lines on `eng_seal_images`. The file is not
edited.

**Why that is equivalent:** the same file creates `eng_seal_images` at line 219,
so on a database that does not have it there is no trigger for either line to
act on, and each is a no-op. Development took it exactly this way on 2026-10-07
and every object matched.

**Predict:** shape `a4af1b6c8fc4cd070e15e9d5346f9004`, **1155** columns.

### A2. 0062, a seal is applied once and locked

`apply_migration`, comment blocks left out, every statement as written.
Development took it this way on 2026-10-07, under its earlier number 0063.

**Predict:** shape `aff578e18d558ee5af26fb2cb8c9eb88`, **1170** columns.

### A3. 0063, a suspension spends every live link

`apply_migration`, the same way. Development took it as 0064.

**Predict:** shape unchanged at `aff578e18d558ee5af26fb2cb8c9eb88`, **1170**
columns, and then:

```sql
select tgname from pg_trigger
where tgname in ('eng_customer_users_suspension_spends_links',
                 'eng_customer_accounts_suspension_spends_links')
order by tgname;
```

**Predict:** exactly those two names.

### A4. 0064, closing an account spends its links too

`apply_migration`, the same way. It replaces the body of the function A3
created and adds nothing, so neither the shape nor any count moves. Its
read-back is the body:

```sql
select position('closed' in prosrc) > 0 as covers_closing
from pg_proc where proname = 'eng_spend_links_on_suspension';
```

**Predict:** one row, `true`. Development took 0064 this way on 2026-10-07 and
read back the same.

**After Part A**, run the counts read-back once. **Predict** the table count
**two higher** than before A1 (`eng_seal_images` in 0061, `eng_seal_acts` in
0062) and the function count **eleven higher** (three in 0061, seven in 0062,
one in 0063, none in 0064; migration-audit's pins go 25 to 28 to 35 to 36). The
trigger count is compared against the figure read before A1 rather than
predicted absolutely, because production's own trigger count has never been read
against the replay's.

**Then the ledger**: each of 0061 to 0064 gets its `production` record in
`supabase/applied.mjs` from the pasted output, written by the session afterwards.

### PART A RAN ON 2026-10-07, AND EVERY PREDICTION HELD

Applied by the operator's chat counterpart with the operator present, through
`apply_migration`, and read back:

| Step | Read back |
| --- | --- |
| 0 | shape `e2bc81c9096a0eb4d8b8366ce3aea881`, 1143 columns; tables 81, triggers 69, functions 25 |
| A1, 0061 | shape `a4af1b6c8fc4cd070e15e9d5346f9004`, 1155; buckets `eng-documents` and `eng-seals` present |
| A2, 0062 | shape `aff578e18d558ee5af26fb2cb8c9eb88`, 1170 |
| A3, 0063 | shape unchanged; both suspension triggers present |
| A4, 0064 | `covers_closing` true |
| After Part A | tables 83 (+2), functions 36 (+11), triggers 77 (+8) |

**Two departures from the steps as written, both recorded.** A1 left out
0061's comment blocks as well as its two drop lines, which development had not
done; the comments carry the words the connector stops on and change nothing in
the schema. A2 kept the `comment on table eng_seal_acts` statement, whose text
contains the word delete, and the connector accepted it, so production's table
carries its description. The trigger count was not predicted absolutely; 77 is
the replay's own figure at 0063, so production and the replay now agree on all
three counts. Each migration's record is in `supabase/applied.mjs`.

---

## Part B. The `eng_cron_runs` rollup backfill, fifteen rows

> **CORRECTED 2026-10-07, AT THE SITTING, AND RUN THE SAME DAY.** This part was
> written for two days, six rows, with 2026-09-06 as the control. **Both were
> wrong.** Production holds no `cron.runs` rollup for ANY day from 2026-09-04
> to 2026-09-08 (503, 1729, 1729, 1729 and 1729 runs); its rollups begin on
> 2026-09-09. So the B1 control as first written had nothing stored to compare
> against, and the hole was five days, not two. The steps below are corrected
> to what was run: the control on three days that do have a stored rollup, and
> the backfill over the five-day range. The two-day reasoning that follows
> immediately below is kept as written, because it is why the range was wrong.
>
> **RAN 2026-10-07.** Control: computed equals stored on all nine rows for
> 2026-09-10, 2026-09-15 and 2026-10-01. Backfill: 15 rows upserted into
> `eng_metrics_daily`, read back with stored equal to computed on all 15:
>
> | Day | `cron.runs` | `cron.failures` | `cron.seconds` |
> | --- | --- | --- | --- |
> | 2026-09-04 | 503 | 0 | 417 |
> | 2026-09-05 | 1729 | 0 | 1299 |
> | 2026-09-06 | 1729 | 0 | 1249 |
> | 2026-09-07 | 1729 | 0 | 1374 |
> | 2026-09-08 | 1729 | 0 | 1781 |

**READ BY THE COUNTERPART ON 2026-10-07: THE ROWS ARE THERE.** Production
held **503** `eng_cron_runs` rows for 2026-09-04 and **1729** for 2026-09-05
(UTC), so the backfill stays in the sitting. They are past the 30-day
retention floor (CLAUDE.md section 6c) and were still there 3 days after it,
so retention is not pruning them today, but nothing here says it will not
before 2026-10-20. **B2's stop condition stands**: if `cron.runs` reads 0 on
either day at the sitting, the rows went in the meantime, and a hand count is
not a substitute. Running Part B before the sitting, on its own, is a
question for the operator rather than something this script assumes.

Two days, 2026-09-04 and 2026-09-05, three metrics each: `cron.runs`,
`cron.failures` and `cron.seconds`. **The figures come from the rollup's own
computation, never from a hand count.** The rollup is `rollupDay` in
`src/lib/ops-metrics.ts`, which reads the day's `eng_cron_runs` rows once,
midnight to midnight UTC, by `started_at`, and derives all three from that one
read. The query below is that computation in SQL. Because a SQL copy is a second
account of the rule, it is **checked against the rollup's own stored output
first**.

### B1. The control, read only

Run the computation for days production's rollup DID compute, beside what it
stored. **Corrected 2026-10-07:** first written for 2026-09-06, which has no
stored rollup; run instead on **2026-09-10, 2026-09-15 and 2026-10-01**, once
per day, setting `D` to the day and `D+1` to the next:

```sql
with runs as (
  select ok, started_at, finished_at from eng_cron_runs
  where started_at >= 'DT00:00:00Z' and started_at < 'D+1T00:00:00Z'
), computed as (
  select 'cron.runs' as metric, count(*)::numeric as value from runs
  union all
  select 'cron.failures', count(*) filter (where ok = false)::numeric from runs
  union all
  select 'cron.seconds', round(coalesce(sum(extract(epoch from (finished_at - started_at)))
           filter (where finished_at is not null and finished_at >= started_at), 0)) from runs
)
select c.metric, c.value as computed, m.value as stored
from computed c left join eng_metrics_daily m on m.day = 'D' and m.metric = c.metric
order by c.metric;
```

**Predict:** `computed` equals `stored` on all three rows of each day, nine in
all. **Held on 2026-10-07.** **If any differs,
STOP**: either the SQL does not mirror the code, or rows for that day have been
pruned since the rollup ran, and the backfill would write figures nothing can
vouch for. (Retention prunes `eng_cron_runs` after its floor, so a day older than
the floor can no longer be recomputed at all; that is a finding, not a reason to
use a hand count.)

### B2. The dry run, read only

The same computation for the five days, beside whatever is stored:

```sql
with days(day) as (values (date '2026-09-04'), (date '2026-09-05'), (date '2026-09-06'),
                          (date '2026-09-07'), (date '2026-09-08')),
runs as (
  select (started_at at time zone 'UTC')::date as day, ok, started_at, finished_at
  from eng_cron_runs
  where started_at >= '2026-09-04T00:00:00Z' and started_at < '2026-09-09T00:00:00Z'
), computed as (
  select d.day, 'cron.runs' as metric, count(r.started_at)::numeric as value
    from days d left join runs r on r.day = d.day group by d.day
  union all
  select d.day, 'cron.failures', count(r.started_at) filter (where r.ok = false)::numeric
    from days d left join runs r on r.day = d.day group by d.day
  union all
  select d.day, 'cron.seconds', round(coalesce(sum(extract(epoch from (r.finished_at - r.started_at)))
           filter (where r.finished_at is not null and r.finished_at >= r.started_at), 0))
    from days d left join runs r on r.day = d.day group by d.day
)
select c.day, c.metric, c.value as computed, m.value as stored
from computed c left join eng_metrics_daily m on m.day = c.day and m.metric = c.metric
order by c.day, c.metric;
```

**Predict:** fifteen rows, `stored` empty on all fifteen (the hole), and
`cron.runs` greater than zero on every day. **If `cron.runs` is 0 on a day, STOP**: the rows
have been pruned and there is nothing to compute from.

### B3. The write

```sql
insert into eng_metrics_daily (day, metric, value, computed_at)
with runs as (
  select (started_at at time zone 'UTC')::date as day, ok, started_at, finished_at
  from eng_cron_runs
  where started_at >= '2026-09-04T00:00:00Z' and started_at < '2026-09-09T00:00:00Z'
)
select day, 'cron.runs', count(*)::numeric, now() from runs group by day
union all
select day, 'cron.failures', (count(*) filter (where ok = false))::numeric, now() from runs group by day
union all
select day, 'cron.seconds', round(coalesce(sum(extract(epoch from (finished_at - started_at)))
         filter (where finished_at is not null and finished_at >= started_at), 0)), now()
from runs group by day
on conflict (day, metric) do update set value = excluded.value, computed_at = excluded.computed_at;
```

An upsert on the same key the rollup uses, so it recomputes rather than adds,
exactly as `rollupDay` does.

### B4. The read-back, its own statement

Run B2 again. **Predict:** `stored` now equals `computed` on all fifteen rows.
**Held on 2026-10-07**, with the figures in the table at the head of this part.

---

## Part C. Robert as a field technician

**C0. Before any of it:** the release must be merged and deployed, or dispatch
will block the new profile on a W-9 and a contractor agreement. The owner
exemption is in code (`OWNER_EXEMPTIONS` in `src/lib/ops-credentials.ts`), never
a credential row for a document that does not exist.

### C1. The profile, by Robert on the portal

On production, `/portal/people`: add **Robert Reyna**,
**robertreyna88@yahoo.com**, role **field technician**. The invite goes to his
own address. This is a person acting on the product, not a SQL insert, so the
auth user, the profile and the audit row are made the one way the product makes
them.

```sql
select id, role, status, certification_status, cardinality(coverage_counties) as counties
from eng_profiles where lower(email) = 'robertreyna88@yahoo.com';
```

**Predict:** one row, `field_tech`, `invited`, `none`, `0`.

**RAN 2026-10-07. ONE DIFFERENCE, AND IT IS EXPLAINED BY THE CODE, NOT A FAULT
IN THE ROW.** Profile `c9d46cd2-9ee3-4479-9768-2b27e13c0044`, `field_tech`,
certification `none`, 0 counties, as predicted, and status **`active`**, not
`invited`.

`createAccount` in `src/lib/ops-auth.ts` has two outcomes. The production auth
table is shared with the other applications on the project, and
`robertreyna88@yahoo.com` already had an auth user there. For an existing
address the profile is created against that user and is active at once,
because the person already has a working password: no set password link is
issued and no password is touched, since resetting it would lock him out of the
other application. **The prediction was written for the new-address branch and
should have allowed for either.**

What the invite path does that this one skipped: it creates the auth user,
issues a one time set password token, and he chooses a password that has never
existed before. Here he signs in to the portal with the password his existing
account already uses. The invite email is still queued, in its existing-account
form, with no link in it.

**And the audit row this wrote is wrong in two fields.** The People route
records `status: invited` and an `invite_delivery` in the `profile.create` diff
unconditionally, so for a linked account the permanent trail says invited while
the row says active, and names a delivery for an invite that has no link. The
summary sentence beside it is right ("Linked the existing account"). In
`BACKLOG.md` for a ruling; the row itself cannot be changed.

### C2. Coverage, all 254 counties

The array below was **generated from `TEXAS_COUNTIES`** in
`src/lib/ops-counties.ts` on 2026-10-07, 254 names, 254 distinct, and compared
back against it name by name by a script: none missing, none extra (the order
differs, which an array of counties does not depend on). It is not a
second home for the list: the read-back checks it against the count, and the
dispatch code compares against the same canonical spellings.

```sql
update eng_profiles set coverage_counties = ARRAY[
  'Anderson', 'Andrews', 'Angelina', 'Aransas', 'Archer', 'Armstrong', 'Atascosa', 'Austin',
  'Bailey', 'Bandera', 'Bastrop', 'Baylor', 'Bee', 'Bell', 'Bexar', 'Blanco',
  'Borden', 'Bosque', 'Bowie', 'Brazoria', 'Brazos', 'Brewster', 'Briscoe', 'Brooks',
  'Brown', 'Burleson', 'Burnet', 'Caldwell', 'Calhoun', 'Callahan', 'Cameron', 'Camp',
  'Carson', 'Cass', 'Castro', 'Chambers', 'Cherokee', 'Childress', 'Clay', 'Cochran',
  'Coke', 'Coleman', 'Collin', 'Collingsworth', 'Colorado', 'Comal', 'Comanche', 'Concho',
  'Cooke', 'Coryell', 'Cottle', 'Crane', 'Crockett', 'Crosby', 'Culberson', 'Dallam',
  'Dallas', 'Dawson', 'Deaf Smith', 'Delta', 'Denton', 'DeWitt', 'Dickens', 'Dimmit',
  'Donley', 'Duval', 'Eastland', 'Ector', 'Edwards', 'El Paso', 'Ellis', 'Erath',
  'Falls', 'Fannin', 'Fayette', 'Fisher', 'Floyd', 'Foard', 'Fort Bend', 'Franklin',
  'Freestone', 'Frio', 'Gaines', 'Galveston', 'Garza', 'Gillespie', 'Glasscock', 'Goliad',
  'Gonzales', 'Gray', 'Grayson', 'Gregg', 'Grimes', 'Guadalupe', 'Hale', 'Hall',
  'Hamilton', 'Hansford', 'Hardeman', 'Hardin', 'Harris', 'Harrison', 'Hartley', 'Haskell',
  'Hays', 'Hemphill', 'Henderson', 'Hidalgo', 'Hill', 'Hockley', 'Hood', 'Hopkins',
  'Houston', 'Howard', 'Hudspeth', 'Hunt', 'Hutchinson', 'Irion', 'Jack', 'Jackson',
  'Jasper', 'Jeff Davis', 'Jefferson', 'Jim Hogg', 'Jim Wells', 'Johnson', 'Jones', 'Karnes',
  'Kaufman', 'Kendall', 'Kenedy', 'Kent', 'Kerr', 'Kimble', 'King', 'Kinney',
  'Kleberg', 'Knox', 'La Salle', 'Lamar', 'Lamb', 'Lampasas', 'Lavaca', 'Lee',
  'Leon', 'Liberty', 'Limestone', 'Lipscomb', 'Live Oak', 'Llano', 'Loving', 'Lubbock',
  'Lynn', 'Madison', 'Marion', 'Martin', 'Mason', 'Matagorda', 'Maverick', 'McCulloch',
  'McLennan', 'McMullen', 'Medina', 'Menard', 'Midland', 'Milam', 'Mills', 'Mitchell',
  'Montague', 'Montgomery', 'Moore', 'Morris', 'Motley', 'Nacogdoches', 'Navarro', 'Newton',
  'Nolan', 'Nueces', 'Ochiltree', 'Oldham', 'Orange', 'Palo Pinto', 'Panola', 'Parker',
  'Parmer', 'Pecos', 'Polk', 'Potter', 'Presidio', 'Rains', 'Randall', 'Reagan',
  'Real', 'Red River', 'Reeves', 'Refugio', 'Roberts', 'Robertson', 'Rockwall', 'Runnels',
  'Rusk', 'Sabine', 'San Augustine', 'San Jacinto', 'San Patricio', 'San Saba', 'Schleicher', 'Scurry',
  'Shackelford', 'Shelby', 'Sherman', 'Smith', 'Somervell', 'Starr', 'Stephens', 'Sterling',
  'Stonewall', 'Sutton', 'Swisher', 'Tarrant', 'Taylor', 'Terrell', 'Terry', 'Throckmorton',
  'Titus', 'Tom Green', 'Travis', 'Trinity', 'Tyler', 'Upshur', 'Upton', 'Uvalde',
  'Val Verde', 'Van Zandt', 'Victoria', 'Walker', 'Waller', 'Ward', 'Washington', 'Webb',
  'Wharton', 'Wheeler', 'Wichita', 'Wilbarger', 'Willacy', 'Williamson', 'Wilson', 'Winkler',
  'Wise', 'Wood', 'Yoakum', 'Young', 'Zapata', 'Zavala'
]
where lower(email) = 'robertreyna88@yahoo.com' and role = 'field_tech';
```

```sql
select cardinality(coverage_counties) as counties,
       (select count(distinct c) from unnest(coverage_counties) c) as distinct_counties
from eng_profiles where lower(email) = 'robertreyna88@yahoo.com';
```

**Predict:** `254`, `254`. **Held on 2026-10-07: 254 counties, 254 distinct.**

### C3. The roof certification, dated 2026-09-23

The training and the supervised inspection with the engineer of record on
2026-09-23, as recorded in `verifiedTechnicianTraining` in
`src/config/credentials.ts` (RC-001 v1.1). First, the template it attaches to,
read only:

```sql
select id, version_label, status from eng_protocol_templates
where document_number = '254-RC-001' and status = 'published';
```

**Predict:** exactly one row, `1.1`, `published`. **If it is not exactly one,
STOP**: a certification attached to the wrong version is a technician certified
on a protocol he was not trained on.

```sql
insert into eng_certifications (profile_id, service_slug, template_id, status, attempts, certified_at)
select p.id, 'roof-inspections', t.id, 'certified', 1, '2026-09-23T00:00:00-05:00'
from eng_profiles p, eng_protocol_templates t
where lower(p.email) = 'robertreyna88@yahoo.com' and p.role = 'field_tech'
  and t.document_number = '254-RC-001' and t.status = 'published';

update eng_profiles set certification_status = 'certified'
where lower(email) = 'robertreyna88@yahoo.com' and role = 'field_tech';
```

```sql
select c.service_slug, c.status, c.certified_at, t.version_label, p.certification_status
from eng_certifications c
join eng_profiles p on p.id = c.profile_id
join eng_protocol_templates t on t.id = c.template_id
where lower(p.email) = 'robertreyna88@yahoo.com';
```

**Predict:** one row, `roof-inspections`, `certified`, 2026-09-23, `1.1`,
`certified`.

**Held on 2026-10-07.** The template read returned exactly one row, RC-001 v1.1
published. The certification read back `roof-inspections`, `certified`,
`certified_at` 2026-09-23 05:00 UTC (00:00 Central), RC-001 v1.1, and the
profile's `certification_status` `certified`.

**C4 IS WAITING ON ROBERT'S DOCUMENTS**, as of 2026-10-07. Nothing is written
for it until he is holding them.

### C4. His credentials: the licence and the vehicle insurance only

**Values Robert reads off his own documents at the sitting.** Nothing here is
filled in in advance, and a credential is written only for a document that
exists and that he is holding. The W-9 and the contractor agreement are NOT
written: the owner exemption covers them in code.

```sql
insert into eng_credentials (profile_id, kind, label, issued_on, expires_on, status, verified_at)
select id, 'drivers_license', 'Texas driver''s license', '<issued, from the card>', '<expires, from the card>', 'verified', now()
from eng_profiles where lower(email) = 'robertreyna88@yahoo.com' and role = 'field_tech';

insert into eng_credentials (profile_id, kind, label, issued_on, expires_on, status, verified_at)
select id, 'vehicle_insurance', '<insurer and policy, from the declarations page>', '<effective>', '<expires>', 'verified', now()
from eng_profiles where lower(email) = 'robertreyna88@yahoo.com' and role = 'field_tech';
```

`verified_by` is left null on purpose: the sitting is not a portal session, and
a verifier id typed into SQL is a claim nothing checked. If Robert wants his
admin profile named as verifier, he verifies them on the portal instead.

```sql
select kind, status, expires_on from eng_credentials c
join eng_profiles p on p.id = c.profile_id
where lower(p.email) = 'robertreyna88@yahoo.com' order by kind;
```

**Predict:** two rows, `drivers_license` and `vehicle_insurance`, both
`verified`, both expiring in the future.

### C5. The end state, read as a person would

Robert opens `/portal/certification` signed in as the technician profile.
**Predict:** roof inspections certified, and no paperwork blocker: not the W-9,
not the contractor agreement, not the licence, not the insurance.

---

## Development

**Applied by the counterpart on 2026-10-07 and read back:** 0062 (as 0063 that
afternoon) and 0063 (as 0064), comment blocks left out, every statement as
written, every object present. Development's provider history therefore names
them by their earlier numbers; the ledger records that against each entry.

**And 0064**, closing an account, applied the same way later on 2026-10-07 and
read back: the function covers closed accounts. Development holds the whole
release chain.

**The credentials column drop is not applied anywhere and is not in this
release.** Development still has `eng_credentials.storage_key`, 0 rows
populated. Nothing on the release branch writes or reads it: the product
stopped writing it in the onboarding hotfix of 2026-10-02, and migration-audit's
pins now expect the column to be present (1170 columns).
