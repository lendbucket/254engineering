# Production sitting: fix/stripe-webhook-once (0075)

Staged 2026-10-13. Nothing here has been run. The counterpart runs each step;
the session runs none. **0075 follows 0074**, so 0074 is applied and read back
first, from `docs/production-sitting-feat-partner-billing.md`, on each
database. This branch carries both migrations and merges only after both are
applied to production and read back.

`supabase/migrations/0075_a_payment_event_is_applied_once.sql`. Additive: one
table, one trigger, eight functions, no change to any existing table, and **no
drop statement of any kind** (check: a search of the file for `drop` finds
only the sentence in its header that says so).

Operator rulings of 2026-10-12 on Stripe webhooks: every payment event is
recorded once by its id before any effect, in `eng_payment_events`; each
webhook branch's money writes commit in one transaction with that record; the
release of the work runs after commit under claimed then done; an event
claimed and not done for fifteen minutes shows on the admin dashboard as "Paid,
work not released" and is reported by the health watch.

- `eng_payment_events`: twelve columns, keyed by the event id. Never deleted
  and its identity never edited (`eng_guard_payment_event`); done never goes
  back to claimed.
- Functions: `eng_claim_payment_event`, `eng_finish_payment_event`,
  `eng_apply_order_paid`, `eng_apply_batch_paid`, `eng_apply_statement_paid`,
  `eng_apply_checkout_expired`, `eng_apply_refund`, and the trigger function
  `eng_guard_payment_event`. EXECUTE is revoked from public, anon and
  authenticated in the same file, by 0073's rule, and the file asserts it.

## 0. Before anything: payments already charged with no work released

Read only. **Run on production before the dry run**, and send back every row.
This is the state the ledger exists to prevent, and anything it finds was
already there before 0075; it is listed so a person can release it by hand,
not so the migration can.

```sql
-- Orders charged, and not in fulfilment or past it.
select 'order' as kind, o.reference, o.id, o.status, p.amount_cents as charged_cents, p.created_at as charged_at,
       'charged, and the order never moved to fulfilment' as problem
from eng_order_payments p
join eng_service_orders o on o.id = p.order_id
where p.kind = 'charge' and p.status = 'succeeded'
  and o.status not in ('in_fulfilment', 'complete', 'refunded')

union all

-- Orders charged and in fulfilment, whose release never moved the file or
-- never issued the customer's link.
select 'order', o.reference, o.id, o.status, p.amount_cents, p.created_at,
       case
         when not exists (select 1 from eng_order_events e where e.order_id = o.id and e.event in ('work.released', 'work.blocked'))
           then 'charged and in fulfilment, and the file was never released'
         else 'charged and in fulfilment, and no status link was ever issued'
       end
from eng_order_payments p
join eng_service_orders o on o.id = p.order_id
where p.kind = 'charge' and p.status = 'succeeded'
  and o.status = 'in_fulfilment'
  and (
    not exists (select 1 from eng_order_events e where e.order_id = o.id and e.event in ('work.released', 'work.blocked'))
    or not exists (select 1 from eng_order_events e where e.order_id = o.id and e.event = 'customer_link.issued')
  )

union all

-- Batches charged, with an order beneath still waiting or closed.
select 'batch', b.reference, b.id, b.status, p.amount_cents, p.created_at,
       'charged, and ' || count(o.id) || ' order(s) under it never reached fulfilment'
from eng_order_payments p
join eng_order_batches b on b.id = p.batch_id
join eng_service_orders o on o.batch_id = b.id
where p.kind = 'charge' and p.status = 'succeeded'
  and o.status not in ('in_fulfilment', 'complete', 'refunded')
group by b.reference, b.id, b.status, p.amount_cents, p.created_at

union all

-- Statements charged and not marked paid.
select 'statement', s.reference, s.id, s.status, p.amount_cents, p.created_at,
       'charged, and the statement is not marked paid'
from eng_order_payments p
join eng_statements s on s.id = p.statement_id
where p.kind = 'charge' and p.status = 'succeeded'
  and s.status <> 'paid'

order by charged_at;
```

**Predict:** no rows, because no live card payment has been taken: the gate is
shut and `stripe` is an unmet launch condition. **Any row is a customer who
paid and is waiting**, and is sent to Robert before anything else happens.
Orders marked `is_demo` or carrying a `-DEMO-` reference are not filtered, on
purpose: a demonstration charge with no release is still worth seeing once.

## 1. Dry run, read only, on each

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_name = 'eng_payment_events';

select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('eng_guard_payment_event', 'eng_claim_payment_event', 'eng_finish_payment_event',
                  'eng_apply_order_paid', 'eng_apply_batch_paid', 'eng_apply_statement_paid',
                  'eng_apply_checkout_expired', 'eng_apply_refund');

select md5(string_agg(sig, '|' order by sig)) as shape, count(*) as columns
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
```

**Predict, on development and on production alike, after 0074:** no table, no
function, shape `e4b2e3505c71594d6aba4ca47025bf3f` across **1194** columns.

## 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`. If the MCP
cancels it, stop and report rather than retrying. One retry is allowed after a
timeout, and only after the section 1 dry run reads exactly as before, the same
rule as 0074's sitting.

Nothing in the file reads or backfills a row. It locks nothing outside its own
new table except what each foreign key takes on `eng_service_orders`,
`eng_order_batches` and `eng_statements`, which waits only if another session
holds a conflicting lock on one of them.

## 3. Read back, on each

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'eng_payment_events'
order by ordinal_position;

select conname from pg_constraint
where conrelid = 'public.eng_payment_events'::regclass
order by conname;

select tgname from pg_trigger
where tgrelid = 'public.eng_payment_events'::regclass and not tgisinternal;

select indexname from pg_indexes where tablename = 'eng_payment_events' order by indexname;

select relrowsecurity from pg_class where relname = 'eng_payment_events';

select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'eng\_%payment\_event%' or p.proname like 'eng\_apply\_%')
order by p.proname;

select count(*) as event_rows from eng_payment_events;
```

**Predict:**

- **12 column rows**, in order: `event_id` text NO, `source` text NO,
  `event_type` text NO, `order_id` uuid YES, `batch_id` uuid YES,
  `statement_id` uuid YES, `charge_ref` text YES, `status` text NO,
  `claimed_at` timestamp with time zone NO, `done_at` timestamp with time zone
  YES, `release_attempts` integer NO, `last_error` text YES.
- **8 constraints:** `eng_payment_events_batch_id_fkey`,
  `eng_payment_events_done_has_a_time`, `eng_payment_events_order_id_fkey`,
  `eng_payment_events_pkey`, `eng_payment_events_source_known`,
  `eng_payment_events_statement_id_fkey`, `eng_payment_events_status_known`,
  `eng_payment_events_type_known`. These are the eight a PostgreSQL 17
  database lists; the in-process replay, on 18, also lists `_not_null` rows,
  which are not expected here.
- **1 trigger:** `eng_payment_events_guarded`.
- **2 indexes:** `eng_payment_events_claimed_idx`, `eng_payment_events_pkey`.
- **Row level security true.**
- **8 function rows**: `eng_apply_batch_paid`, `eng_apply_checkout_expired`,
  `eng_apply_order_paid`, `eng_apply_refund`, `eng_apply_statement_paid`,
  `eng_claim_payment_event`, `eng_finish_payment_event`,
  `eng_guard_payment_event`, each with anon **false**, authenticated
  **false**, service_role **true**.
- **0 event rows.**

The shape fingerprint moves from `e4b2e3505c71594d6aba4ca47025bf3f` across 1194
columns to **`318b0fa346fc0f92167df9b9f44ce1cf` across 1206**, 86 tables to
**87**. Behaviour facts go from 998 to 1018 on a replay; judge a live
read-back on the counts, per CLAUDE.md 6b.

## What this does not do

It writes no row and changes no existing one. The deployment that follows the
merge is what starts recording events: until it is live, the webhook on
production is the one before this branch. And it does nothing about a charge
section 0 finds: that is a person's decision, made order by order.
