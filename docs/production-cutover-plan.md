# The production database cutover, step by step

Written 2026-09-03. **Nothing in this document has been executed.**

Operator ruling of 2026-09-03: migrate, `us-east-1`, rehearse first, preserve the
`eng_profiles` uuid by direct insert, and stop before touching production.

The rehearsal is done and is recorded in section 1. The sequence in section 3 is
what remains, and it does not begin until the operator says so.

---

## 1. What the rehearsal already proved

Run against `254engineering-rehearsal` in `us-east-1`, since deleted.

| Question | Answer |
| --- | --- |
| Do the migration files rebuild the schema from nothing? | **Not before the repair.** `0001` line 387 was `as $` and line 399 was `$;`, a syntax error. Repaired in `766b069`. |
| Do they now? | Yes. Fingerprint `eac11d782d44bd11cb893637f67d2ee1`, 607 columns, 39 tables, 4 functions, 24 triggers, 117 indexes, RLS on all 39. Identical to development and production. |
| Can `auth.users` take a chosen uuid? | Yes, by direct insert. The admin API assigns its own, which is why this is SQL. |
| Does `eng_profiles` accept it as its primary key? | Yes. That key is referenced by more than thirty foreign keys. |
| Can an append only table take a bulk load? | Yes, 239 rows, immutable immediately afterwards. |
| Does the payment delete refusal survive? | Yes, and `ON DELETE RESTRICT` still prevents deleting an order that took money. |

**Not rehearsed, and stated rather than implied:** the transport of real rows
between two live projects. The rehearsal loaded synthetic rows of the same shape
and volume. What was being tested is the mechanism that could silently corrupt
identity, which is the uuid preservation, and that was tested exactly.

---

## 2. Before step 1

- The operator confirms PITR state and price on the new project.
- The operator has the production service role key to hand. It stays in Vercel
  and in `.env.local`, never in the repository.
- A quiet window. The only live write paths are the waitlist and contact forms.
- `npm run audit` green on the branch, including `migration-audit`.

---

## 3. The sequence

Every step names what to do if it goes wrong. Steps 1 to 6 are reversible by
doing nothing, because production is untouched throughout.

### Step 1. Create the project

Create `254engineering-prod` in `us-east-1`. $10 per month, on the Pro
organisation.

**Rollback:** delete the project. Production is untouched.

### Step 2. Replay the migrations

Apply `0000` through `0008` in order.

**Verify:** fingerprint equals `eac11d782d44bd11cb893637f67d2ee1`, 607 columns,
39 tables, 4 functions all with `search_path` pinned, 24 triggers, RLS on 39.
`migration-audit` asserts the same numbers against a scratch database, so a
mismatch here means the project, not the files.

**Rollback:** delete the project and start again. Production is untouched.

### Step 3. Create the buckets

`eng-evidence`, `eng-onboarding`, `eng-uploads`. All private. `eng-evidence`
carries the size limit and mime types 0002 sets.

**Verify:** three buckets, `public = false` on every one. A public evidence
bucket would expose property photographs, so this is checked rather than assumed.

**Rollback:** delete the project. Production is untouched.

### Step 4. Enable leaked password protection

Operator, in the dashboard, on the new project. Not available to this session.

**Rollback:** none needed; it is a toggle.

### Step 5. Dry run the copy, writing nothing

Run the copy script in read only mode against both projects. It reports the row
count per table it would move and the storage objects it would move.

**Verify:** the counts are read from the source AT COPY TIME and compared to what
the copy would write. They are not compared to a figure recorded earlier.

Operator amendment, 2026-09-03: the 244 row figure in section 1 of the decision
document is already stale, because `eng_audit_events` grows on every production
touch including the operator's own sign ins, and it can never shrink. A check
asserting a number written down yesterday would fail for the most ordinary
reason there is, and worse, it would pass if the source had somehow shrunk to
match. The count has one meaning: source and destination agree, now.

**Rollback:** none needed; nothing was written.

### Step 6. Freeze the write paths

Put the waitlist and contact forms into maintenance, or accept a window in which
a submission fails visibly. `forms-audit` guarantees it fails visibly rather than
silently, which is why accepting the window is defensible.

**Rollback:** unfreeze. Production is untouched and still serving.

---

**Everything above this line leaves production exactly as it was. Everything
below writes to the new project, and step 9 is the first step that changes what
customers reach.**

---

### Step 7. Copy

In dependency order: `eng_leads`, `eng_applications`, then the auth user by
direct insert with its original uuid, then `auth.identities`, then
`eng_profiles`, then `eng_auth_tokens`, then `eng_audit_events`.

The password hash is **not** copied. A set-password link is issued in step 12.

**Verify:** row count per table equals production, and the set of
`eng_audit_events` ids in the new project equals the set in production. The audit
trail is the one table where a missing row is a regulatory problem, so it is
compared by id rather than by count.

**Rollback:** delete every row from the new project and repeat. The new project
is not serving anything yet, and production has not been read destructively:
every read is a `select`.

### Step 8. Copy storage

The 2 objects in `eng-uploads`. Download from the old, upload to the new, at the
same keys.

**Verify:** object count and byte size match per bucket, and one object is
downloaded from the new project and compared byte for byte.

**Rollback:** delete the objects and repeat.

### Step 8b. Resolve the sister brands. THIS BLOCKS STEP 9.

Operator amendment, 2026-09-03, and it was the right call: this was originally
placed before step 14, on the reasoning that dropping the old tables is what
would break the sisters. That reasoning was wrong. The damage happens at step 9.

**What was found, by reading the two repositories and the live tables:**

| | Writes | Portal | Points at |
| --- | --- | --- | --- |
| stampmyplans | `eng_leads`, `eng_orders` | none | `fsaryeciduszuahgjbly`, confirmed in its `.env.local` |
| sealedengineering | `eng_leads`, `eng_orders` | none | unknown from here; its deployed value is in its own Vercel project |

**And the part that makes it a blocker.** 254's portal reads leads and
applications with NO SITE FILTER. Verified by reading the queries, not by
grepping around them:

- `listLeads()` in `src/lib/admin-data.ts` selects `site` and never filters on it
- `listApplications()` in the same file does the same
- the lead conversion inbox in `src/app/portal/(app)/clients/page.tsx` filters
  only on `status`, and its own comment says the leads "have been here since the
  sites launched"

254's portal is deliberately the shared inbox for all three brands. Cut over 254
alone and the sisters keep writing to the old project while the only screen
anybody opens reads the new one. No error, no gap in a sequence, nothing to
notice, and it surfaces as a customer who was never called back.

**One fact that makes the fix cheap:** every row in every shared table carries
`site = '254'`. The sisters have written zero rows to date. There is no data to
move, only future writes to redirect.

**The options, for the operator:**

1. **Move all three in the same window.** Recommended. The sisters have no
   portal, no auth, no storage and no rows; each is two environment variables
   and a redeploy. The single inbox survives.
2. **Leave the sisters on the old project.** Rejected: 254 would need a second
   client pointed at the wattsmith project to read its own inbox, which defeats
   the entire purpose of the migration.
3. **Have the sisters POST to a 254 intake API** rather than writing Supabase
   directly. The better architecture, and it removes the shared table coupling
   permanently. It is new work, not a cutover step, and should not be folded
   into this window.

**Rollback:** not applicable. This step is a decision and a verification, not a
change. Step 9 does not begin until it is answered.

### Step 9. Point the application at the new project

On the branch: update `PRODUCTION_REF` and `PRODUCTION_EXPECTED_REF` in
`src/lib/db-guard.ts`, `PRODUCTION_REF` in `scripts/lib/db-target.mjs`, the
assertions in `scripts/db-guard-audit.mjs`, and the table in CLAUDE.md section
6b. Run the suite. Merge to main.

Then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the Vercel Production
scope to the new project, and redeploy.

**This is the first irreversible-feeling step, and it is not actually
irreversible:** the old project still holds every row, untouched.

**A deployment's environment is snapshotted at creation.** Setting the variables
without redeploying changes nothing, and redeploying before merging serves the
old code against the new database, which `productionPointingElsewhere` will
refuse. Merge first, then set, then redeploy.

**Rollback:** restore the two Vercel variables to the old project and redeploy,
then revert the merge. Recovery time is one deploy. Any row written to the new
project between step 9 and the rollback would be lost, which is why step 10
follows immediately.

### Step 10. Verify from outside

- `/api/portal/health` returns `{"ok":true}`
- `/portal/login` renders the form, not the mispointed explanation, which proves
  `productionPointingElsewhere` is satisfied by the new ref
- `/order/start/roof-inspections` still renders the prelaunch refusal
- `BASE_URL=https://254engineering.com npx tsx scripts/security-audit.mjs` passes
- the operator signs in, and **that sign in appears in the NEW project's audit
  trail with the old project's count unchanged at 239**

That last one is the evidence test. It is the same one that caught production
pointing at development on 2026-09-03, and it is the only check here that cannot
be satisfied by a deployment talking to the wrong database.

**Rollback:** as step 9.

### Step 11. Unfreeze

Restore the forms.

**Rollback:** as step 9.

### Step 12. Issue a set-password link

The operator's password was not copied. Mint a `reset_password` token in the new
project and confirm the link opens and names the right person and role.

**Rollback:** as step 9.

### Step 13. Leave the old tables alone for thirty days

Do not drop the `eng_` tables in the `wattsmith` project. They are the rollback,
and they cost nothing.

**Rollback:** the whole cutover, by restoring two Vercel variables and reverting
one merge.

### Step 14. Drop the old tables

Only after thirty days, only on the operator's word, and as a separate
deliberate act with its own report. This is the step that has no rollback, which
is why it is thirty days away from the one that needed it.

---

## 4. What would make me stop mid sequence

- The fingerprint at step 2 not matching.
- Any bucket at step 3 reading `public = true`.
- Row counts at step 5 or step 7 differing from production by any amount.
- Any `eng_audit_events` id present in one project and not the other.
- `/portal/login` at step 10 rendering the guard explanation rather than the
  form, which would mean the ref constants and the environment disagree.

In every one of those cases the correct action is the step's own rollback, and a
report, rather than pressing on.

## 5. What this plan does not cover

**The three sister brands.** `sealedengineering` and `stampmyplans` do not read
this database today. If they ever wrote to `eng_orders`, the legacy table, that
question is open in `BACKLOG.md` and must be answered before step 14, not before
step 1: dropping the old tables is what would break them, not moving this
firm's.
