# Production sitting: feat/partner-billing (0074)

Staged 2026-10-12 overnight. Nothing here has been run. The counterpart runs
each step; the session runs none. **0074 follows 0073**, which development and
production have had since 2026-10-11 13:54 CT.

`supabase/migrations/0074_a_partner_pays_254_through_one_account.sql`.
Additive: two tables, no function, no change to any existing table.

- `eng_partner_billing`: one row per partner, what the partner owes 254 now.
  Eight columns. Four states, and `past_due_since` is set exactly when the
  state is `past_due`.
- `eng_partner_billing_events`: append only (update and delete refused by
  `eng_forbid_mutation`), one row per Stripe event applied, keyed by Stripe's
  event id. Five columns.

Operator ruling of 2026-10-11, on `docs/partner-billing-plan.md`: a partner pays
$800 upfront and $99 a month to 254 through 254's one Stripe account. **Billing
is off** (`src/config/partner-billing.ts`), so on the day this is applied
nothing writes to either table, and the partner portal reads neither.

## 1. Dry run, read only, on each

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_name in ('eng_partner_billing', 'eng_partner_billing_events');

select md5(string_agg(sig, '|' order by sig)) as shape, count(*) as columns
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;

select count(*) as partners from eng_partners;
```

**Predict, on development and on production alike:** no rows from the first
query; shape `3cffb39b56eda13ab54bbe8823b4c26d` across **1181** columns (the
figure after 0072 and 0073); `partners` whatever each holds, which this
migration does not touch.

## 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`. It creates two
tables, two triggers and an index, and **the file contains no drop statement of
any kind** (check: a search of the file for `drop` finds only the comment that
says so). If the MCP cancels it, stop and report rather than retrying.

**Why the file changed, 2026-10-12.** The retry on development at 23:16 CT came
back "cancelled". The counterpart's read-back after it was clean: neither table,
1181 columns, no 0074 row in the ledger, production untouched. The most likely
cause is the two `drop trigger if exists` lines that stood before each
`create trigger`: a drop makes the tool ask the operator to confirm a destructive
statement, and an unanswered confirmation ends as a timeout or a cancellation.
Both lines are removed and nothing else in the file changed. They protected
nothing: both tables are created in this same migration, so no trigger on either
can exist before it runs. That was a hypothesis about the 230 second timeout as
well, and the next attempt tests it.

**One retry is allowed after a timeout, and only after a clean read-back.**
Operator ruling, 2026-10-12. The first `apply_migration` on development timed
out after 230 seconds; the read-back after it found neither table, the shape
unchanged at `3cffb39b56eda13ab54bbe8823b4c26d` across 1181, no 0074 row in the
provider's migration history, and no blocking sessions. Nothing in the file can
make it slow: two `create table` on new, empty tables, one index on an empty
table, two triggers, two comments, and row level security switched on. It reads
no rows and backfills nothing. The only lock it takes outside its own new tables
is the one each foreign key takes on `eng_partners` (development 0 rows,
production 12), which waits only if another session holds a conflicting lock on
that table. So: after a timeout, run the section 1 dry run again; if it reads
exactly as before (no tables, same shape, no ledger row, no blocking sessions),
retry `apply_migration` once. A second timeout, or any difference in the
read-back, stops the sitting and is reported. A cancellation is still never
retried.

## 3. Read back, on each

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in ('eng_partner_billing', 'eng_partner_billing_events')
order by table_name, ordinal_position;

select conname from pg_constraint
where conrelid in ('public.eng_partner_billing'::regclass, 'public.eng_partner_billing_events'::regclass)
order by conname;

select tgname from pg_trigger
where tgrelid in ('public.eng_partner_billing'::regclass, 'public.eng_partner_billing_events'::regclass)
  and not tgisinternal
order by tgname;

select relname, relrowsecurity from pg_class
where relname in ('eng_partner_billing', 'eng_partner_billing_events');

select (select count(*) from eng_partner_billing) as billing_rows,
       (select count(*) from eng_partner_billing_events) as event_rows;
```

**Predict:**

- **13 column rows.** `eng_partner_billing`: `partner_id` uuid NO,
  `status` text NO, `past_due_since` timestamp with time zone YES,
  `current_period_end` timestamp with time zone YES, `stripe_customer_ref` text
  YES, `stripe_subscription_ref` text YES, `created_at` timestamp with time zone
  NO, `updated_at` timestamp with time zone NO. `eng_partner_billing_events`:
  `stripe_event_id` text NO, `partner_id` uuid NO, `event_type` text NO,
  `status_after` text YES, `applied_at` timestamp with time zone NO.
- **8 constraints:** `eng_partner_billing_events_partner_id_fkey`,
  `eng_partner_billing_events_pkey`, `eng_partner_billing_events_status_known`,
  `eng_partner_billing_events_type_known`, `eng_partner_billing_partner_id_fkey`,
  `eng_partner_billing_past_due_has_a_start`, `eng_partner_billing_pkey`,
  `eng_partner_billing_status_known`. These are the eight a PostgreSQL 17
  database lists, which both projects are (17.6). The in-process replay, on
  PostgreSQL 18, also lists eight `_not_null` rows, one per NOT NULL column,
  because 18 records those as named constraints; those eight are not expected
  here.
- **2 triggers:** `eng_partner_billing_events_immutable`,
  `eng_partner_billing_touch`.
- **Row level security true on both.**
- **0 billing rows and 0 event rows.**

The shape fingerprint moves from `3cffb39b56eda13ab54bbe8823b4c26d` across 1181
columns to **`e4b2e3505c71594d6aba4ca47025bf3f` across 1194**, 84 tables to
**86**. Behaviour facts go from 983 to 998 on a replay; judge a live read-back on
the counts, per CLAUDE.md 6b.

## What this does not do

It does not turn billing on, create any Stripe object, or subscribe the webhook
endpoint to the invoice and subscription events. Each of those is a later step,
and turning billing on waits on the attorney.
