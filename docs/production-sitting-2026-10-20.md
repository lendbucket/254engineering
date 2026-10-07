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

**Predict:** one row, `true`. **Development does not have 0064 yet**; see the
last section.

**After Part A**, run the counts read-back once. **Predict** the table count
**two higher** than before A1 (`eng_seal_images` in 0061, `eng_seal_acts` in
0062) and the function count **eleven higher** (three in 0061, seven in 0062,
one in 0063, none in 0064; migration-audit's pins go 25 to 28 to 35 to 36). The
trigger count is compared against the figure read before A1 rather than
predicted absolutely, because production's own trigger count has never been read
against the replay's.

**Then the ledger**: each of 0061 to 0064 gets its `production` record in
`supabase/applied.mjs` from the pasted output, written by the session afterwards.

---

## Part B. The `eng_cron_runs` rollup backfill, six rows

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

Run the computation for **2026-09-06**, a day production's rollup did compute,
beside what it stored:

```sql
with runs as (
  select ok, started_at, finished_at from eng_cron_runs
  where started_at >= '2026-09-06T00:00:00Z' and started_at < '2026-09-07T00:00:00Z'
), computed as (
  select 'cron.runs' as metric, count(*)::numeric as value from runs
  union all
  select 'cron.failures', count(*) filter (where ok = false)::numeric from runs
  union all
  select 'cron.seconds', round(coalesce(sum(extract(epoch from (finished_at - started_at)))
           filter (where finished_at is not null and finished_at >= started_at), 0)) from runs
)
select c.metric, c.value as computed, m.value as stored
from computed c left join eng_metrics_daily m on m.day = '2026-09-06' and m.metric = c.metric
order by c.metric;
```

**Predict:** `computed` equals `stored` on all three rows. **If any differs,
STOP**: either the SQL does not mirror the code, or rows for that day have been
pruned since the rollup ran, and the backfill would write figures nothing can
vouch for. (Retention prunes `eng_cron_runs` after its floor, so a day older than
the floor can no longer be recomputed at all; that is a finding, not a reason to
use a hand count.)

### B2. The dry run, read only

The same computation for the two days, beside whatever is stored:

```sql
with days(day) as (values (date '2026-09-04'), (date '2026-09-05')),
runs as (
  select (started_at at time zone 'UTC')::date as day, ok, started_at, finished_at
  from eng_cron_runs
  where started_at >= '2026-09-04T00:00:00Z' and started_at < '2026-09-06T00:00:00Z'
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

**Predict:** six rows, `stored` empty on all six (the hole), and `cron.runs`
greater than zero on both days. **If `cron.runs` is 0 on a day, STOP**: the rows
have been pruned and there is nothing to compute from.

### B3. The write

```sql
insert into eng_metrics_daily (day, metric, value, computed_at)
with runs as (
  select (started_at at time zone 'UTC')::date as day, ok, started_at, finished_at
  from eng_cron_runs
  where started_at >= '2026-09-04T00:00:00Z' and started_at < '2026-09-06T00:00:00Z'
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

Run B2 again. **Predict:** `stored` now equals `computed` on all six rows.

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

**Predict:** `254`, `254`.

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

**Still owed on development:** 0064, closing an account, through
`apply_migration` the same way, with A4's read-back. Nothing in the integration
audit needs it: migration-audit proves it in its own replay, and no live audit
closes an account.

**The credentials column drop is not applied anywhere and is not in this
release.** Development still has `eng_credentials.storage_key`, 0 rows
populated. Nothing on the release branch writes or reads it: the product
stopped writing it in the onboarding hotfix of 2026-10-02, and migration-audit's
pins now expect the column to be present (1170 columns).
