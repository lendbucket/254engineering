# Production sitting: fix/refund-update-event (0076)

Staged 2026-10-13. Nothing here has been run. The counterpart runs each read;
the session runs none. **0076 follows 0075**, which both databases already
have (applied 2026-10-13).

`supabase/migrations/0076_a_refund_update_is_applied_once.sql`. One function
and **one drop statement, by ruling**: the event type constraint on
`eng_payment_events` is dropped and added again with a fourth kind,
`charge.refund.updated`, in the same transaction. A check constraint cannot be
widened in place. Nothing else is dropped, no column is added, and no row is
written or changed.

Operator rulings of 2026-10-13: Stripe's `charge.refund.updated` goes through
the payment event ledger, recorded once by its event id in one transaction
with its effect. Pending to succeeded marks the refund row succeeded; pending
to failed or canceled marks it failed or cancelled with Stripe's reason, so it
stops counting as given back, and the firm is alerted. Nothing reinstates a
reversed commission, moves an order's status or writes to the customer.

- Function: `eng_apply_refund_update`. EXECUTE is revoked from public, anon
  and authenticated in the same file, by 0073's rule, and the file asserts it.
- Constraint: `eng_payment_events_type_known`, widened from three kinds to four.

## 0. Before anything: the constraint, and what is on file under it

Read only, **on development and on production**, and send back every row. The
new constraint accepts every value the old one did, so nothing on file can
break it; this reads that rather than assuming it.

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.eng_payment_events'::regclass
  and conname = 'eng_payment_events_type_known';

select event_type, count(*) as rows
from eng_payment_events
group by event_type
order by event_type;
```

**Predict, on each:** one constraint row,
`CHECK ((event_type = ANY (ARRAY['checkout.completed'::text, 'checkout.expired'::text, 'charge.refunded'::text])))`.
Event rows only under those three types, or none at all. **Any other type is a
stop**, sent to Robert before anything else happens.

And one more read, on production only, so the sitting knows what the first
real update will meet:

```sql
-- Refunds this platform recorded as pending, which nothing has ever moved.
select o.reference, p.id, p.amount_cents, p.provider_ref, p.refund_case, p.created_at, o.status as order_status
from eng_order_payments p
left join eng_service_orders o on o.id = p.order_id
where p.kind = 'refund' and p.status = 'pending'
order by p.created_at;
```

**Predict:** no rows, because no live card payment has been taken. Any row is a
refund whose outcome nobody has read from Stripe, and is sent to Robert.

## 1. Dry run, read only, on each

```sql
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'eng_apply_refund_update';

select md5(string_agg(sig, '|' order by sig)) as shape, count(*) as columns
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
```

**Predict, on each:** no function row; shape
`318b0fa346fc0f92167df9b9f44ce1cf` across **1206** columns.

## 2. Apply, development first, then production

`apply_migration` with the file as written, never `execute_sql`. The
connector is tried **once**. A drop statement is the shape it has cancelled
before (CLAUDE.md 6b, 2026-10-03). **If it answers cancelled, it is not
retried**: Robert runs the file himself in the Supabase SQL editor, with the
counterpart's section 0 and section 1 reads before it and the section 3 read
after it. The SQL editor sends the file as one request, which PostgreSQL runs
as one transaction, so the drop and the add commit together or not at all.

It takes a brief lock on `eng_payment_events` for the constraint. The table
holds a handful of rows on each database, so the add re-validates in well
under a second.

## 3. Read back, on each

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.eng_payment_events'::regclass
  and conname = 'eng_payment_events_type_known';

select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'eng_apply_refund_update';

select event_type, count(*) as rows from eng_payment_events group by event_type order by event_type;

select md5(string_agg(sig, '|' order by sig)) as shape, count(*) as columns
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
```

**Predict:**

- **One constraint row**, the four kinds:
  `CHECK ((event_type = ANY (ARRAY['checkout.completed'::text, 'checkout.expired'::text, 'charge.refunded'::text, 'charge.refund.updated'::text])))`.
- **One function row**, `eng_apply_refund_update`, anon **false**,
  authenticated **false**, service_role **true**.
- **The event rows exactly as section 0 read them.**
- **Shape unchanged**, `318b0fa346fc0f92167df9b9f44ce1cf` across **1206**.
  Behaviour facts go from 1018 to 1019 on a replay; judge a live read-back on
  the counts, per CLAUDE.md 6b.

## 4. After the merge, in this order

1. The merge, on Robert's word, after both databases read back as section 3
   predicts.
2. Wait for the production deployment to show **READY**.
3. Robert adds the event in the Stripe dashboard: endpoint
   **`https://254engineering.com/api/stripe/webhook`**, event
   **`charge.refund.updated`**. The other three stay as they are.
4. On Robert's confirmation, `registeredEvents` in
   `src/config/stripe-webhook.ts` gains `charge.refund.updated`, in its own
   commit. Until then `stripe-webhook-audit` fails one line, naming it, which
   is the record of the dashboard not yet holding it rather than a defect.

Before step 3 a refund update is never sent, so nothing is lost: main before
this branch answers an unhandled type with a 200 and ignores it, which is why
the dashboard change comes after the deployment and not before.

## What this does not do

It writes no row and changes no existing one. It moves no refund that is
already pending: the first update Stripe sends for one does that, through the
deployment. And it reinstates nothing a failed refund reversed: the orders
screen names the state, "Refund failed at Stripe, order still marked refunded",
and a person decides.
