# The production database: a decision for the operator

Prepared 2026-09-03 at `c1cca7d`, opening Phase 8 Section 0. **Nothing here has
been executed.** This is the evidence and the proposal; the ruling is the
operator's.

Every number below was read from the live projects through the Supabase
management API or by querying the databases directly. Where something could not
be verified, it says so rather than estimating.

---

## 1. What is actually true today

The production database is **not a shared project. It is another company's
project.**

| | |
| --- | --- |
| Project ref | `fsaryeciduszuahgjbly` |
| **Project name** | **`wattsmith`** |
| Created | 2026-07-26 |
| Region | `us-west-2` (Oregon) |
| Postgres | 17.6.1.147 |
| Organization | Salon Envy, **Pro** plan |

This firm's production data was added to a database provisioned three weeks
earlier for Watt Smith Electric. The six auth users besides the operator are all
`@wattsmithelectric.com`, created 2026-07-28 and 2026-08-05. The `eng_` prefix
convention exists because of this, and it has done its job: nothing has
collided. But the prefix is a naming convention, not a boundary.

### What lives in there

| | Tables | Size |
| --- | --- | --- |
| This firm (`eng_`) | 39 | 1,768 kB |
| Other applications | 41 | 4,888 kB |
| Whole database | | 21 MB |

The other 41 tables belong to at least four separate products: `os_*` (an
operations app), `pricebook_*`, `craftline_*`, and a set of unprefixed tables
including `customers`, `estimates`, `leads`, `waitlist`, `applicants` and
`subscribers`.

### What this firm actually holds in production, right now

| Table | Rows |
| --- | --- |
| `eng_audit_events` | 239 |
| `eng_leads` | 2 |
| `eng_applications` | 1 |
| `eng_profiles` | 1 |
| `eng_auth_tokens` | 1 |
| **Total** | **244** |

Plus 2 storage objects totalling 152 kB across three buckets (`eng-evidence`,
`eng-onboarding`, `eng-uploads`), and one auth user.

Storage in the shared project is 52.7 MB across 12 buckets. **50 MB of that
belongs to `coyoteville-media` and `coyoteville-permits`, which are not this
firm's.**

---

## 2. What sharing costs at volume

Five costs, in the order they will bite.

### 2.1 The connection ceiling is shared, and it is 60

`max_connections` is **60**. Fifteen are in use at rest with almost no traffic.
That ceiling is not this firm's; it is divided among every application in the
project, and none of them knows the others exist.

At volume the failure is not gradual. A neighbour that opens a connection per
request during its own traffic spike exhausts the pool, and this firm's portal
and order intake begin refusing connections during somebody else's busy hour.
Nothing in this platform can prevent that, detect the cause, or route around it.

### 2.2 The service role key is a key to every application

The key this platform holds reads and writes **every table in the project**,
including `customers`, `estimates`, `leads` and `os_profiles`. That is a
symmetric exposure and both directions are real:

- A compromise of this firm's key is a compromise of four other applications'
  customer data.
- A compromise of any of those applications' keys is a compromise of this firm's
  regulatory records, customer PII, and identity documents.

The platform's own perimeter is genuinely good: RLS on with zero policies,
service role only, no browser client, no anon key in any bundle. **None of that
constrains the other four applications**, and they share the same database and
the same key namespace.

For a firm that will hold identity documents for field technicians and property
records for customers, the honest answer to "who else can reach this data" is
currently "four other applications and whoever holds their keys".

### 2.3 Restore cannot be exercised, so effectively it does not exist

Point in time recovery operates on a project. Restoring to recover one deleted
`eng_` table rewinds `wattsmith`, `pricebook`, `craftline` and `coyoteville` to
the same moment.

In practice nobody will ever authorise that. Which means **this firm has no
usable restore path**, regardless of what the plan includes, and will not
discover this until the day it needs one.

This is the same defect class the platform keeps finding: a capability that
looks present and does nothing. The append only triggers, the payment delete
refusal and the immutable audit trail are all built on the assumption that
history is recoverable. It is not.

I could not verify from the API whether PITR is currently enabled on this
project. **Check that in the dashboard before deciding.** If it is off, the
above is worse than described; if it is on, the firm is paying for a capability
it cannot use.

### 2.4 A migration mistake reaches everything

The service role can run DDL. A mistaken migration, from any of the five
applications or any session working on them, can drop or alter a table belonging
to another. The `eng_` prefix does not prevent this; it only makes it obvious
afterwards.

Two things this project already does correctly become impossible to guarantee:
the schema fingerprint check (which compares only `eng_` tables and would not
notice another application's damage), and migration ordering (there is one
`supabase_migrations` history for the project, and this repository is not the
only thing writing to it).

### 2.5 The database is on the wrong coast

Production Postgres is in `us-west-2` (Oregon). The Vercel production deployment
serves from `iad1` (Virginia). Every query crosses the continent.

Measured against the live host, five samples each:

| Endpoint | Time to first byte |
| --- | --- |
| `/api/portal/health` (one database query) | 0.43s, 0.62s, 0.62s, 0.71s, 0.95s |
| `/about` (prerendered, no query) | 0.15s, 0.16s, 0.39s |

**Caveat, stated rather than buried:** this delta conflates the round trip with
function cold starts and is suggestive rather than conclusive. It is consistent
with a cross-country round trip of roughly 60 to 80 ms per query, which matters
because portal pages issue several queries in sequence. A dedicated project in
`us-east-1` would be co-located with `iad1`.

This one is not a security argument. It is the one the operator will feel every
day.

---

## 3. Two real findings, unrelated to the decision

Found while gathering the above, from Supabase's own advisors. Reporting them
because they are true now, whatever is decided.

**Four of this platform's functions have a mutable `search_path`:**
`eng_touch_updated_at`, `eng_forbid_mutation`,
`eng_forbid_mutation_allow_cascade`, and `eng_forbid_payment_delete`. A trigger
function whose `search_path` is not pinned can, in principle, be made to resolve
a different object than intended by anyone who can create objects in an earlier
schema. The fix is one clause per function. **I introduced the fourth of these
today**, in migration 0006.

**Leaked password protection is disabled.** Supabase Auth can check new
passwords against HaveIBeenPwned. It is a single toggle and the portal is where
the firm's regulatory records live.

Neither is urgent. Both are cheap. Neither is a reason to migrate or not to.

---

## 4. The proposal

### What it costs

Read from the management API for this organization, not asserted:

| | |
| --- | --- |
| Organization plan | **Pro** |
| A new project | **$10 per month** |
| A rehearsal project, deleted afterwards | **$10 per month** while it exists |

So the recurring cost of the decision is **$10 per month**, and the one off cost
is roughly another $10 for the rehearsal.

**Not verified and worth checking before deciding:** the current price of point
in time recovery as an add-on, and whether it is presently enabled on the shared
project. I did not want to quote a figure I could not read from the API.

### What has to move

This is the part that argues for doing it now.

| | Volume |
| --- | --- |
| Schema | 39 tables, 8 migrations (`0000` to `0007`) |
| Data | **244 rows**, in five tables |
| Storage | **2 objects, 152 kB**, three buckets |
| Auth | **one user**, `ceo@36west.org` |
| Edge functions | none |
| Cron jobs in the database | none (the health cron is Vercel's) |

**The auth row is not shared.** I verified this earlier today: the row was
created 2026-09-02 by `seed-admin`, no table in the project references its uuid,
and there are no foreign keys into the `auth` schema from any application. The
address `ceo@36west.org` does appear in five other-application tables
(`pricebook_techs`, `pricebook_account_tokens`, `pricebook_account_audit`,
`customers`, `estimates`), but those key on the email, not the auth row, and are
unaffected.

**One detail that must not be got wrong:** `eng_profiles.id` **is** the auth user
uuid, and **more than thirty foreign keys** point at `eng_profiles` from across
the schema. The new auth user must be created with the same uuid, by direct
insert into `auth.users`, rather than through the admin API which assigns its
own. Getting this wrong means rewriting every reference, including 239
append-only audit rows that refuse updates.

### What has to change in the code

Both guards hardcode the refs, deliberately, and both audits assert them:

- `src/lib/db-guard.ts`: `PRODUCTION_REF`, `DEVELOPMENT_REF`,
  `PRODUCTION_EXPECTED_REF`
- `scripts/lib/db-target.mjs`: `PRODUCTION_REF`, `DEVELOPMENT_REF`
- `scripts/db-guard-audit.mjs`: the 65 checks that assert both directions
- `CLAUDE.md` section 6b: the table of the two projects
- Vercel Production scope: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

The guards are the reason this is safe to attempt. They are also the reason it
cannot be done piecemeal: a deployment pointing at the new project while
`PRODUCTION_EXPECTED_REF` still names the old one will refuse to boot, which is
the guard working correctly and would read as an outage.

### Downtime

**Minutes, and no customer is affected.**

`LAUNCH_MODE` is prelaunch on production, so no order can be placed and none
exists: zero orders, zero payments, zero quote requests. The only live surfaces
are the marketing site (static, unaffected), the waitlist and contact forms, and
a portal with one user.

The exposure is a waitlist or contact submission during the cutover window. It
would fail visibly rather than silently, because `forms-audit` enforces that.
Choose a quiet window and accept it, or take the site's forms down for ten
minutes.

### The sequence, if the answer is migrate

Its own branch, with a rehearsal first and a written rollback, as instructed.

1. Create `254engineering-rehearsal` in `us-east-1`. Apply `0000` through `0007`
   in order. Confirm the fingerprint equals `eac11d782d44bd11cb893637f67d2ee1`
   at 607 columns. This proves the migration files reconstruct the schema from
   nothing, which has never been tested.
2. Rehearse the whole cutover against it, including the auth uuid preservation
   and the storage copy. Delete the rehearsal project.
3. Create `254engineering-prod` in `us-east-1`. Apply the migrations. Verify the
   fingerprint again.
4. Create the three private buckets.
5. Freeze: put the forms into maintenance, or accept the window.
6. Copy the 244 rows in dependency order, then the 2 storage objects, then
   insert the auth user with its original uuid.
7. Verify by fingerprint, row count per table, and a diff of `eng_audit_events`
   ids. The audit trail is the one table where a missing row is a regulatory
   problem.
8. Update the two guard files, `db-guard-audit`, and CLAUDE.md on the branch.
9. Update the Vercel Production variables. Redeploy, and confirm from the
   deployment record that the new build is the one the domain serves.
10. Verify: `/api/portal/health` returns `{"ok":true}`, the operator signs in
    and the sign in lands in the **new** project's audit trail with the old one
    unchanged, and `BASE_URL=https://254engineering.com npx tsx
    scripts/security-audit.mjs` passes.
11. Leave the old `eng_` tables in the wattsmith project **untouched and
    readable** for at least thirty days. That is the rollback.

**Rollback:** revert the branch and restore the two Vercel variables. The old
tables still hold everything, because step 11 does not delete them. The only
loss is any row written to the new project after cutover, which is why the
thirty day window exists rather than a drop.

Drop the old `eng_` tables only after thirty days, on the operator's word, as a
separate deliberate act.

---

## 5. Recommendation

**Migrate, and do it now rather than later.**

Not primarily for security or for latency, though both are real. For this:

> This firm holds **244 rows, 152 kB of files and one user** in production
> today. That is the smallest this migration will ever be.

Every order taken, every evidence photograph captured, every sealed document and
every audit row makes it larger and riskier, and the audit trail and the payment
ledger both refuse deletion by design, so nothing ever shrinks. The platform is
about to start taking money and storing identity documents. Doing this after
that begins means moving a live financial ledger; doing it before means moving
almost nothing.

The counter argument, honestly: $10 a month buys nothing a customer can see, the
current arrangement has not failed, and there are four other things in Phase 8
that would each do more for the business. That is a real argument for deferring.
It is not an argument for deferring past launch, because the cost curve only
goes one way.

**It also does not foreclose multi tenancy.** A dedicated project makes future
tenancy easier rather than harder: the `site` discriminator and the `eng_` prefix
survive unchanged, and the firm gains the ability to reason about capacity,
restore and blast radius for its own tenants without four unrelated applications
in the same blast radius.

---

## 6. What I need from the operator

1. **Migrate, or stay?**
2. If migrate: **confirm the region.** `us-east-1` co-locates with Vercel's
   `iad1` and is the recommendation. `us-east-2` (Ohio) is nearer Texas by map
   and further from the servers that actually query it.
3. **Check the dashboard for PITR**, current state and price, before deciding.
4. Whether to fix the four `search_path` warnings and enable leaked password
   protection now, or fold them into whichever branch comes next.

Nothing proceeds on this until there is an answer.
