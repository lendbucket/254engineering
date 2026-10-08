# Development ran three migrations behind main for two weeks, and nothing noticed

Report only, operator order of 2026-10-07. Nothing here is built; the proposed
check waits for the operator's word.

## What happened

0058, 0059 and 0060 merged to main and were applied to production on 2026-09-23
and 2026-09-24. None of them reached development until the operator's
counterpart applied them on 2026-10-07. In between, every board ran against a
development database that:

- **still granted the engineer `pricing.read`** and did not grant
  `pricing.read_own_pay` (0059), so the operator's ruling that the engineer sees
  no money did not hold on the database every audit points at;
- carried the older `eng_protocol_in_force_holds_items` (0058), which treats a
  retired protocol as in force on insert as well as on update;
- carried the older settings of four buckets (0060).

**The ledger said so the whole time.** Each of the three entries in
`supabase/applied.mjs` carried `development: { at: null, ... }`, which was true.
Every entry up to 0057 carries a figure there. Nothing reads that field for
whether development has caught up: its only reader compares behaviour digests,
and a null digest is skipped.

**The shape fingerprint matched throughout, and could not have done otherwise.**
None of the three adds a column. 0058 replaces a function body, 0059 moves rows
in `eng_role_grants`, and 0060 writes rows into `storage.buckets`, which is not
in the public schema. The fingerprint reads `information_schema.columns` and
nothing else.

## Why no check of "the engineer sees no money" caught it

Every check of the rule builds the engineer from the CODE declaration,
`DEFAULT_ROLES`, and none reads development's `eng_role_grants`. Read in the
source on 2026-10-07:

| Check | What it reads | Could it see development's rows |
| --- | --- | --- |
| `roles-audit`, the expectation matrix and the margin rule | `active(role)`, whose grants are `actionsFor(role)` from `src/lib/ops-authz.ts` | No |
| `roles-audit`, the redaction checks ("an engineer sees NO price charged" and the three beside it) | `redactFile(active("engineer"), ...)`, the same declared actor | No |
| `roles-audit`, the seed comparison | The migration FILES, parsed in order, against `DEFAULT_ROLES` | No: it proves the chain says the right thing, not that a database ran it |
| `reporting-audit`, "the engineer role may read its own pay and not the firm's" | `actorFor("engineer")` in `src/lib/figure-surfaces.ts`, built from `DEFAULT_ROLES` | No |
| `exploratory-portal-audit`, the money sweep per role | A real engineer signed in to a running server, which reads `eng_role_grants` on every request (`src/lib/ops-auth.ts`, the grant read) | **Yes, and it is the only one.** It is not on the board, and its browser half has never run: `docs/overnight-2026-09-24.md` section 3 records that only the static half ran |

**So each check was right about what it was asked, and none was asked about
the database.** It is the declaration agreeing with a declaration, which
CLAUDE.md records at the access review and at the credential inventory: a check
derived from a declaration is exactly as true as the declaration, and here the
declaration was true and the database was not.

The product itself was never in doubt on this point, because it reads the
database: on development, an engineer who signed in during those two weeks held
`pricing.read`, and the portal would have shown that person the firm's money.
Production was correct throughout, because production had 0059.

## Which audit results the missing migrations could have changed

Read audit by audit in the source, not inferred from names.

- **0059.** No board result. Every check of the rule reads the declaration (the
  table above), so all of them passed and would have passed with or without the
  migration. The result that SHOULD have changed is one nothing produced: what
  an engineer sees on development's screens.
- **0058.** No board result. The live audits that touch
  `eng_protocol_templates` (`demo-audit`, `protocol-registry-audit`) never insert
  or update a retired protocol. The function is exercised only inside
  `migration-audit`'s replayed database, which has always had 0058.
- **0060.** No board result found. `forms-audit` uploads to and removes from
  `eng-uploads`, inside any limit either version sets. `messaging-audit` reads
  `eng-messages` only for whether it is private, which both versions are, and its
  wrong-type and oversized refusals go through the application's own checks,
  never through the bucket limits. Nothing on the board uploads anything a
  bucket limit would have refused.

**So the honest summary is that no recorded green was wrong, and that is the
problem rather than the comfort**: three migrations could be missing from the
database every audit runs against, for two weeks, and no audit's answer depended
on whether they were there.

## The proposed check, in three layers, cheapest first

**1. The ledger asserts development has caught up with main (no credentials).**
`schema-ledger-audit` already fails when a migration on main is pending for
PRODUCTION. Add the same rule for development: every migration reachable from
main must carry a `development.at`. It reads only the ledger, so it runs on
every board. **It would have gone red on the first board after 2026-09-24**, the
same day, naming 0058, 0059 and 0060. It proves the question was asked, not the
answer; layers 2 and 3 check the answer.

**2. The board reads what PostgREST can show it, on development (the board's
existing credential).** Every audit already reaches development through
`scripts/lib/db-target.mjs`. Two comparisons need nothing new:

- **Grants and roles.** `roles-audit` already derives the expected grant set from
  the migration chain in order. Read `eng_role_grants` and `eng_roles` from
  development and compare row for row. This catches 0059 directly, and any
  future seeded row a database did not run.
- **Buckets.** `migration-audit` already derives every bucket the chain creates,
  with its privacy, size limit and types. Read `storage.listBuckets()` on
  development and compare. This catches 0060.

**3. The catalogue, which PostgREST cannot show (functions, triggers,
constraints, indexes).** A read-only function, say
`eng_schema_facts()`, added by migration, returning the per-kind fact counts and
the portable definitions (`pg_get_constraintdef`, normalised function bodies)
that section 6b already uses for live read-backs. The board compares
development's figures against the replay at the migration development's ledger
record names. This catches 0058, and the drifted `NOT VALID` foreign key the
2026-09-14 replay found. It is the one layer that adds a migration, so it needs
its own ruling and goes to production at a sitting like any other.

**What none of the three can see**, said rather than implied: a development row
somebody edited by hand to a value the chain also allows, and anything outside
the `eng_` tables and storage. The first is what a fixture leaves behind, and
section 6b's teardown rule is what governs it.

**Recommendation:** layer 1 now, because it is one assertion over a file and
would have caught this the day it began; layer 2 next; layer 3 when the operator
rules on the migration it needs.
