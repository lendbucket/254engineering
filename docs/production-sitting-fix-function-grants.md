# Production sitting: fix/function-grants (0073)

Staged 2026-10-11. Nothing here has been run. The counterpart runs each step;
the session runs none. **0073 follows 0072**, which production has had since
2026-10-10 16:41 CT.

**A security fix, so it is worth applying ahead of anything else waiting.**
Until it is applied, every `eng_` function on production is callable through
PostgREST `rpc` by anybody holding the publishable key, and four of them run as
their owner (`SECURITY DEFINER`), past row level security. The one that writes
is `eng_set_trade_price`: a stranger can set a trade price.

`supabase/migrations/0073_no_function_is_callable_without_the_service_role.sql`.
For every function in `public` whose name starts `eng_`, as the database holds
it when the migration runs: revoke `EXECUTE` from `PUBLIC`, `anon` and
`authenticated`, grant it to `service_role`. Then it checks the result and
raises, rolling the whole migration back, if any `eng_` function is still
executable by `anon` or `authenticated`, or is not executable by
`service_role`.

**What it does not touch.** Only `eng_` functions. Production's `public` schema
is shared with applications that are not this firm's; their functions, and the
schema's default privileges, are left exactly as they are.

**Why the platform keeps working.** Every call the platform makes goes through
the service role: `src/lib/supabase.ts` builds the only client, there is no
anon or publishable key anywhere in the repository, and the eight `rpc` calls in
`src` (`eng_record_letter_seal`, `eng_record_review_decision`,
`eng_approve_protocol`, `eng_claim_jobs`, `eng_take_sign_in_attempt`,
`eng_record_protocol_signature`, `eng_record_seal_image`, `eng_set_trade_price`)
all use it. Trigger functions fire without their `EXECUTE` grant, because
PostgreSQL checks it when a trigger is created, not when it fires; tried in a
replay before this was written.

## 1. Dry run, read only

```sql
select p.oid::regprocedure::text                               as function,
       pg_get_userbyid(p.proowner)                             as owner,
       p.prosecdef                                             as security_definer,
       exists (select 1 from pg_trigger t where t.tgfoid = p.oid) as trigger_fn,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role,
       p.proacl::text                                          as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'eng!_%' escape '!'
order by 1;
```

**Predict: 38 rows**, the 38 the migration chain creates, listed below; on every
row `anon` true, `authenticated` true and `service_role` true, which is the
defect; `owner` `postgres` on every row. Development should read the same.

| function | security definer | kind |
| --- | --- | --- |
| `eng_approve_protocol(uuid,uuid,text,jsonb)` | no | called |
| `eng_assert_no_open_repairs(uuid)` | no | called |
| `eng_claim_jobs(text,integer,integer)` | no | called |
| `eng_file_no_conditional_certification()` | no | trigger |
| `eng_forbid_account_delete()` | **yes** | trigger |
| `eng_forbid_mutation()` | no | trigger |
| `eng_forbid_mutation_allow_cascade()` | no | trigger |
| `eng_forbid_partner_entry_delete()` | no | trigger |
| `eng_forbid_payment_delete()` | no | trigger |
| `eng_forbid_record_delete()` | no | trigger |
| `eng_forbid_retention_run_delete()` | no | trigger |
| `eng_forbid_sealed_work_delete()` | no | trigger |
| `eng_forbid_trade_price_delete()` | **yes** | trigger |
| `eng_freeze_attribution()` | no | trigger |
| `eng_freeze_items_of_a_protocol_in_force()` | no | trigger |
| `eng_freeze_partner_entry()` | no | trigger |
| `eng_freeze_partner_submission()` | no | trigger |
| `eng_freeze_repair_item()` | no | trigger |
| `eng_freeze_trade_price()` | **yes** | trigger |
| `eng_guard_protocol_approval()` | no | trigger |
| `eng_guard_protocol_insert_in_force()` | no | trigger |
| `eng_protocol_in_force_holds_items()` | no | trigger |
| `eng_record_letter_seal(uuid,uuid,uuid,uuid,text,text,bigint,text,text,uuid,uuid,uuid,uuid,timestamp with time zone)` | no | called |
| `eng_record_protocol_signature(uuid,text,text,text,uuid,uuid,uuid,timestamp with time zone)` | no | called |
| `eng_record_review_decision(jsonb)` | no | called |
| `eng_record_seal_image(uuid,uuid,text,text,text,integer,integer,integer,timestamp with time zone)` | no | called |
| `eng_repair_no_conditional_certification()` | no | trigger |
| `eng_seal_act_audit()` | no | trigger |
| `eng_seal_act_check()` | no | trigger |
| `eng_seal_act_guard()` | no | trigger |
| `eng_seal_image_audit()` | no | trigger |
| `eng_seal_image_guard()` | no | trigger |
| `eng_sealed_document_lock()` | no | trigger |
| `eng_set_trade_price(uuid,text,text,integer,integer,uuid,text)` | **yes** | called |
| `eng_spend_links_on_suspension()` | no | trigger |
| `eng_take_sign_in_attempt(text,text,integer,integer,integer)` | no | called |
| `eng_touch_updated_at()` | no | trigger |
| `eng_void_seal_act(uuid,uuid,text)` | no | called |

**If the rows differ:**
- **An extra row** is an `eng_` function the chain does not create. 0073 covers
  it as well. Report its name before applying, because this repository should
  know about it.
- **An owner other than `postgres`**: the revoke may do nothing for that
  function, and the migration's own check will then raise and roll everything
  back. Report it before applying.
- **`anon` already false everywhere**: somebody has fixed it by hand. Report it;
  the migration is still safe to apply.

## 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`. It revokes and
grants and drops nothing, so the MCP should not cancel it; if it does, stop and
report rather than retrying. If it raises one of its own `eng:` exceptions,
nothing was changed: report the message.

## 3. Read back, on each

Run the dry run query again.

**Predict: the same 38 rows**, now with `anon` false, `authenticated` false and
`service_role` true on every one, and `acl` reading
`{postgres=X/postgres,service_role=X/postgres}`. The form may differ if
production's grants were made by a different grantor; judge on the three
boolean columns.

Then one call through the platform, so the read-back is not only a catalogue
read. The job queue claims work through `eng_claim_jobs` with the service role
on every cron run:

```sql
select name, started_at, ok, detail from eng_cron_runs order by started_at desc limit 5;
```

Predict: a run that started after the apply, with `ok` as the runs before it
had it.

The shape fingerprint does not move: **`3cffb39b56eda13ab54bbe8823b4c26d`
across 1181**, 84 tables. Neither fingerprint can see a grant; judge this
sitting on the query above.
