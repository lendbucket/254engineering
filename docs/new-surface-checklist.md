# The new surface checklist

**Every declared inventory a new SIGNED IN screen, a new API route, or a new
table must appear in.** Read it before building one, and again before the board.

> ### IT SAID "PORTAL" UNTIL 2026-10-03, AND THAT WORD COST A ROW.
>
> `/account/orders` is a CUSTOMER screen. It was built, declared in the design
> document, added to `token-audit`'s customer V10 list, and added to the capture
> script, and it reached row 1 of this table, the page perimeter list, only when
> a board named it:
>
>     FAIL: every portal page on disk is in the perimeter list (not covered: /account/orders)
>
> **The page was never open.** It calls `currentCustomer()` and redirects to the
> login, and `/account/orders` is not in `CUSTOMER_OPEN_PATHS`, so both layers
> held. What was missing is the outer guard being ASKED about it, which is what
> row 1 is for and which this document told nobody to do, because the screen was
> not a portal screen.
>
> **Row 1 never cared.** `security-audit`'s page list covers `/account`,
> `/partner` and `/portal` alike and always has: `/account/settings` and
> `/account/statements` are sitting in it four lines above where the new entry
> went. The word "portal" in this document was narrower than the inventory it
> was describing.
>
> **So the scope is every signed in surface**, and rows 8 and 9 below are the
> two a customer screen needs that a portal screen does not. That is a CLASS
> fix rather than an instance one: adding `/account/orders` to row 1 and moving
> on would have left the next customer screen to be caught by a board again.

This exists because a screen shipped on 2026-09-21 that was built, secured,
declared in the surface inventory and audited, and **no operator could reach
it.** The board named four declarations it was missing from. It could not name
the fifth, and the fifth was the navigation.

**Every row below was verified on disk** against `/portal/inquiries` and
`eng_design_inquiries`, which are the worked example: a screen, its API route
and its table, all shipped correctly. Nothing here is from memory.

---

## The nine rows

| # | Inventory | Applies to | Verified against |
| --- | --- | --- | --- |
| 1 | `scripts/security-audit.mjs`, page perimeter list | **any signed in screen**, portal, partner or account | `/portal/inquiries` line 97, `/account/orders` 2026-10-03 |
| 2 | `scripts/security-audit.mjs`, API perimeter list | a portal API route | `/api/portal/inquiries`, line 209 |
| 3 | `scripts/roles-audit.mjs`, the engineer ruling | a portal screen | `/portal/inquiries`, line 1541 |
| 4 | `src/components/portal/nav.ts` | a portal screen | `/portal/inquiries`, line 95 |
| 5 | `src/lib/retention-policy.ts` | a table | `eng_design_inquiries`, line 318 |
| 6 | `supabase/applied.mjs`, and the pins in `scripts/migration-audit.mjs` | a table | every migration entry |
| 7 | `scripts/lib/surfaces.mjs`, `roleFor` | a portal screen, **only** if the default probe role cannot open it | `/portal/waiting`, `/portal/review` |
| 8 | `scripts/token-audit.mjs`, **both** `PORTED` and one of `CUSTOMER_V10` / `STAFF_V10` | any screen held to the design system | `/account/orders`, missed BOTH on 2026-10-01 |
| 9 | `scripts/probe-capture.mjs`, `SCREENS` | a signed in CUSTOMER screen | `/account/orders`, added 2026-10-03 |

---

## What rows 8 and 9 cost, and why 8 is two lists rather than one

**Row 8 is the one with the trap in it, and `/account/orders` fell into it.**
`token-audit` holds two lists that sound like one thing. `PORTED` decides which
files the audit READS. `CUSTOMER_V10` and `STAFF_V10` decide which RULES a file
it reads is held to. A screen on the second and not the first is **declared and
never looked at**: neither the type scale nor the colour rule touches it, and
every check about it passes over nothing.

That is what happened. The orders list sat on `CUSTOMER_V10` and off `PORTED`
from 2026-10-01 to 2026-10-02, and the day it was added to `PORTED` the audit
immediately found four capital-transformed table headers and two monospace
columns that had been invisible. `FileSelection.tsx` was the same shape and
hiding three raw hexes including a red.

`token-audit` carries its own check for this, "every file declared as V10 is one
this audit reads", so the board does name it. The cost of missing it is that
nothing names it until somebody adds the second line.

**Row 9 costs a screen nobody has looked at.** Captures are how a person reads a
surface, and this repository's rule is that a report naming no artefact is a
report written from the board. A customer screen absent from `SCREENS` is one
no capture exists of, so the one check that finds what the harness cannot was
never run on it.

## What each row costs if you miss it

**1, 2, 3 and 5 are swept against disk, so the board names them.** A new screen,
route or table that is missing from those four fails on the first run with the
path or the table in the message. They cost a board, not a defect.

**4 is not swept, and that is the one to carry.** Three audits import `NAV` and
every one of them asks the OUTWARD question: `compliance-audit` asserts one
hard-coded route is reachable, `reporting-audit` asks whether everyone who may
read a report is offered its link, and `overnight-roles.mjs` asks which
destinations a role is offered. **Nothing asks whether every screen on disk is
reachable from the navigation.** A screen can pass every check and be invisible.

**6 costs a red `schema-ledger-audit` and a red `migration-audit`.** The pinned
figures move with the migration, which is the section 6c mechanism: changing one
costs a second deliberate edit, and the reason for the count is written beside
it.

**7 is conditional and the condition is easy to get backwards.** The entry names
which role a browser audit should probe a screen with, and it is needed ONLY
where the default role cannot open the screen. `/portal/windstorm-inquiries`
gates on `files.create`, which the default admin probe holds, so it correctly
needs no entry and `surface-audit` confirms that at 25 checks. **Adding one
naming the wrong role breaks what works.** Where a screen calls `holdsLicence`,
`surface-audit` derives the requirement and fails without it.

---

## Two things the worked example teaches that a list cannot

**THE NAV ACTION MATCHES THE PAGE'S GUARD, NOT THE OTHER WAY ROUND.** The
`/portal/inquiries` entry carries the reason in the file: on `files.list` the
link appeared for an engineer and the page then refused him. A nav entry whose
action is looser than the door is a link that leads to a refusal, which reads
as the platform being broken.

**`retention-policy.ts` IS ALPHABETICAL AND THE AUDIT ENFORCES IT.** The first
attempt at row 5 put the new table beside its sibling because they are the same
retention decision, and `retention-audit` refused it by name. Grouping by
meaning is exactly the judgement the ordering exists to remove: a list that can
be diffed against the schema needs no opinion about which tables are alike.

---

## The question behind the list

The rows will go out of date. The question will not:

**What would have to be true on disk for this surface to be honest, and does
anything assert it?**

A screen nothing routes to, a route nothing secures, a table nothing retains,
and a migration nothing declares are each a thing that looks finished. Three of
those four are swept. The one that is not is the one a person meets.

## Before the board: a change to a library the audits import

**Operator ruling, 2026-10-09. Standing.** Any change to a file the audits and
proofs import (`scripts/lib/portal-probe.mjs` and every shared helper under
`scripts/lib/`) runs, standalone and before the board:

1. the full `proofs-audit`, and
2. every audit that imports the changed file, the list DERIVED by searching the
   imports, never recalled.

A green run of only the new proof is not enough, and it is the miss this rule
exists for: `feat/audit-seed` changed the probe teardowns, ran only its own new
proof, and the board found an existing proof whose stand-in client could not
express the new call (60 of 61 at 7731c79). The full `proofs-audit` would have
found it in a minute.

The import list is derived the same way every time, so it is a command rather
than a memory:

    grep -rl "lib/<changed file>" scripts --include=*.mjs

## Before the board: a new migration

**Operator ruling, 2026-10-09. Standing.** Any new migration:

1. moves `migration-audit`'s pinned shape, `EXPECTED_COLUMNS` and
   `EXPECTED_FINGERPRINT` in `scripts/migration-audit.mjs` (and the table,
   trigger and function counts if it changes them), **in the same commit** as
   the migration, with a comment naming the migration and what moved; the
   figures come from `scripts/fingerprint-at.mjs`, never from a guess;
2. runs `migration-audit` standalone before the board, with its declared
   condition (`npx tsx --conditions=react-server scripts/migration-audit.mjs`,
   as package.json invokes it), along with every audit that reads
   `supabase/migrations` or `supabase/applied.mjs`, the list found by searching
   the imports, never recalled:

    grep -rlE "supabase/applied|supabase/migrations|applied\.mjs" scripts --include=*.mjs

The miss this rule exists for: `fix/certification-unblock` added 0066 and
boarded without moving the pinned shape, and the board of d1e18d2 returned 59
of 61 against a prediction of 60, migration-audit naming the replay at 1171
columns against its pinned 1170. The constant is pinned so a migration moves it
on purpose; the rule is that the move happens with the migration, not after a
board finds it.
