# Production sitting: fix/review-and-credit-one-write (0068)

Staged 2026-10-10 in the weekend run. Nothing here has been run. The
counterpart runs each step; the session runs none. Per the operator's weekend
rule, the counterpart applies it on its own when every prediction below holds,
and the branch is boarded and merged once the ledger records the apply.

`supabase/migrations/0068_a_decision_and_its_credit_are_one_write.sql`, on
`fix/review-and-credit-one-write`. Two parts:

1. **One function**, `eng_record_review_decision(jsonb)`: a decided review,
   its credit, its status move, its charge log row, its audit rows and its
   queued outside work, in one transaction. Additive.
2. **Three check constraints widened** from four actions to five, adding
   `repairs`: `eng_review_sessions_decision_check`,
   `eng_production_ledger_decision_check` and
   `eng_responsible_charge_log_decision_check`. Each is a `drop constraint` and
   an `add constraint` in the same file. No row is rewritten.

**The second part is destructive in shape.** CLAUDE.md section 6b records that
the Supabase MCP cancels a destructive statement before it runs, with
`{"status":"cancelled"}` and no error body. If `apply_migration` comes back
cancelled: **do not retry it.** Run the file in the Supabase SQL editor
instead, then record in the ledger that it went in by hand.

## 1. Dry run, read only, before applying, on each project

```sql
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in ('eng_review_sessions_decision_check',
                  'eng_production_ledger_decision_check',
                  'eng_responsible_charge_log_decision_check')
order by conname;
```

**Predict:** three rows, each `CHECK ((decision = ANY (ARRAY['seal'::text,
'revisions'::text, 'site_visit'::text, 'refuse'::text])))`. If a name is
missing or the definition differs, **stop**: the drop would miss it and the
old check would stay.

```sql
select 'eng_review_sessions' as t, decision, count(*) from eng_review_sessions group by decision
union all
select 'eng_production_ledger', decision, count(*) from eng_production_ledger group by decision
union all
select 'eng_responsible_charge_log', decision, count(*) from eng_responsible_charge_log group by decision
order by 1, 2;
```

**Predict:** every `decision` is one of seal, revisions, site_visit, refuse, or
null. No `repairs` row can exist, because the old checks refuse it. That is the
defect this migration closes: on main, a repairs decision moved the file and
then failed to write its charge log row and its credit.

```sql
select proname from pg_proc where proname = 'eng_record_review_decision';
```

**Predict:** no rows.

## 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`. If cancelled,
the SQL editor, as above.

## 3. Read back, on each

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in ('eng_review_sessions_decision_check',
                  'eng_production_ledger_decision_check',
                  'eng_responsible_charge_log_decision_check')
order by conname;
```

**Predict:** the same three names, each now listing five values, `repairs`
between `site_visit` and `refuse`.

```sql
select proname, prosecdef, proconfig
from pg_proc
where proname = 'eng_record_review_decision';
```

**Predict:** one row, `prosecdef` false, `proconfig` `{search_path=""}`.

The shape fingerprint does **not** move (a function and a check are not
columns): `18826fa5b3e7d9c9979ca81b96666bb7` across 1171 columns, before and
after. Behaviour facts go from 972 to 973 on a replay; judge a live read-back
on the count, per CLAUDE.md 6b.

## 4. After the apply

The session records the apply in `supabase/applied.mjs` when the counterpart
reports it, and that ledger entry is the signal for the branch's board: with
production holding 0068, schema-ledger-audit's parity line is the one
predicted failure, and the merge resolves it.
