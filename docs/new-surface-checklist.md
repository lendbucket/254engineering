# The new surface checklist

**Every declared inventory a new portal screen, a new portal API route, or a new
table must appear in.** Read it before building one, and again before the board.

This exists because a screen shipped on 2026-09-21 that was built, secured,
declared in the surface inventory and audited, and **no operator could reach
it.** The board named four declarations it was missing from. It could not name
the fifth, and the fifth was the navigation.

**Every row below was verified on disk** against `/portal/inquiries` and
`eng_design_inquiries`, which are the worked example: a screen, its API route
and its table, all shipped correctly. Nothing here is from memory.

---

## The seven rows

| # | Inventory | Applies to | Verified against |
| --- | --- | --- | --- |
| 1 | `scripts/security-audit.mjs`, page perimeter list | a portal screen | `/portal/inquiries`, line 97 |
| 2 | `scripts/security-audit.mjs`, API perimeter list | a portal API route | `/api/portal/inquiries`, line 209 |
| 3 | `scripts/roles-audit.mjs`, the engineer ruling | a portal screen | `/portal/inquiries`, line 1541 |
| 4 | `src/components/portal/nav.ts` | a portal screen | `/portal/inquiries`, line 95 |
| 5 | `src/lib/retention-policy.ts` | a table | `eng_design_inquiries`, line 318 |
| 6 | `supabase/applied.mjs`, and the pins in `scripts/migration-audit.mjs` | a table | every migration entry |
| 7 | `scripts/lib/surfaces.mjs`, `roleFor` | a portal screen, **only** if the default probe role cannot open it | `/portal/waiting`, `/portal/review` |

---

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
