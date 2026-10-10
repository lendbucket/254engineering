# Production sitting: fix/sign-in-limiter-in-the-database (0071)

Staged 2026-10-10 in the weekend run. Nothing here has been run. The
counterpart runs each step; the session runs none. **0071 follows 0070**: apply
0068, 0069 and 0070 first.

`supabase/migrations/0071_sign_in_attempts_are_counted_in_the_database.sql`.
Additive: one table, `eng_sign_in_attempts`, with row level security on and no
policies, and one function, `eng_take_sign_in_attempt`. The sign in limiter
(operator ruling 2026-10-10, decision 14) counts there instead of in each
server instance's memory. Until 0071 is on a database, the code's call to the
function fails and the in-memory count answers, which is the protection there
was before; nothing breaks in the meantime.

## 1. Dry run, read only

```sql
select to_regclass('public.eng_sign_in_attempts') as table_exists,
       (select count(*) from pg_proc where proname = 'eng_take_sign_in_attempt') as function_exists;
```

**Predict:** `table_exists` null, `function_exists` 0.

## 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`.

## 3. Read back, on each

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'eng_sign_in_attempts'
order by ordinal_position;

select relrowsecurity from pg_class where relname = 'eng_sign_in_attempts';

select proname, proconfig from pg_proc where proname = 'eng_take_sign_in_attempt';
```

**Predict:** five columns: `id` bigint not null, `created_at` timestamp with
time zone not null, `address` text not null, `identity` text nullable, `kind`
text not null. `relrowsecurity` true. One function row, `proconfig`
`{search_path=""}`.

The shape fingerprint moves, from `18826fa5b3e7d9c9979ca81b96666bb7` across
1171 columns to **`bc55a14f40a4c7a78cc061fd262e785b` across 1176**, 84 eng_
tables. Behaviour facts go from 973 to 979 on a replay; judge a live read-back
on the counts, per CLAUDE.md 6b.

## 4. After the apply

The first sign in after the apply writes the first row. A failed attempt on
development, then a correct one, should leave one `attempt` row and one `reset`
row for that address; that is the read that shows the code reached the table.
