# Survey: reads under scripts/ that discard their error

Overnight item 4 of 2026-10-14 into 2026-10-15. BACKLOG "SURVEY OWED: READS
WHOSE ERROR IS DISCARDED". **Findings only; nothing changed.** Read from main
at 689dc15.

## How the list was derived

The BACKLOG figure of 21 came from one search for `const { data } = await ...
.in(`. This survey widened it, and the figure is what each search produced, not
a total of the problem:

- `const { data|count [: alias] } = await`: 248 lines, about 17 of them writes
  rather than reads.
- the ternary form `= cond ? await ... : { data: [] }`: 9.
- `let { data } =`: 1.
- inline `(await ...).data`: 8 (six `auth.admin.getUserById`).

Each was classed by reading the line that turns the read into a verdict:

- **A**: a failed read (data or count null) can come out PASS.
- **B**: a failed read makes the check FAIL or throw.
- **C**: no verdict rides on it.

**A: 40 sites in 25 files. B: about 75. C: about 70.**
`exercises/order-path-walk-child.mjs` (32 reads) and `seed-field-demo.mjs`
(about 20) were not read line by line.

## Three that fail open on a safety gate, each confirmed by reading the source

| Site | What a failed read does |
| --- | --- |
| `scripts/lib/queue-drain.mjs:59` `refuseIfOutwardWorkIsWaiting` | `(hazards ?? []).length === 0` returns `{ ok: true }`, so an audit goes on to run a worker while live outward email jobs may be waiting. This is the guard that keeps an audit from sending real email. |
| `scripts/queue-audit.mjs:1443` | "nothing on this queue that could reach outside is eligible for an audit's worker to claim" passes on `(liveOutward ?? 0) === 0` when the count failed. |
| `scripts/seed-admin.mjs:49` | A failed count reads as no administrator, so the script goes on to create one. It is the one script that legitimately runs against production. |

## The rest of class A, as the survey read them (not each re-read here)

**Teardown verifications that read null as "nothing left"**, the mirror-sweep
shape of CLAUDE.md 6:

- forms-audit 673
- bulk-audit 1139
- bucket-roundtrip 140
- doors-audit 248, 392, 790, 812
- mobile-overflow-audit 218
- sister-intake-audit 357
- `scripts/lib/probe-ledger.mjs` 125, 259, 267
- `scripts/lib/portal-probe.mjs` 633/634, 879, 893, 1071/1077, 1181
- these proofs:
  - a-replaced-key-says-so 302
  - a-teardown-never-takes-the-seed 86/87
  - a-review-request-with-no-order 187, 218/219
  - a-review-belongs-to-its-engineer 84, 97
  - a-decided-review-credits-its-tier 157/158
  - an-uncredited-review-reaches-the-office 112/113
  - an-offer-without-a-rate-cannot-be-accepted 107
  - one-search-finds-a-record-and-widens-nothing 127/128
  - a-review-request-goes-once-or-not-at-all 58
- nine `getUserById` loops that count `data?.user` as left and an error as gone.

**Counts compared to counts**, which pass at 0 === 0 when both reads fail:

- dashboards-audit 239/246
- `scripts/lib/standing-demo.mjs:229` `ledgerRowCount` (returns `count ?? 0`), read by demo-audit 930 and dashboards-audit about 400
- exercises/system-raises-task 117
- overnight-queue-load 221, 308, 355, 379

**Others:**

- messaging-audit 325: a failed read becomes no attachments.
- queue-audit 610: an rpc whose failure reads as nothing stolen.
- a-certification-waits-for-the-engineer 145.

**Transport ceilings in the same reads.** These are the 1000-row and 150-id class, not error handling:

- probe-ledger 125: an unbounded `.in()`.
- probe-ledger 259: every `eng_files` row, unpaged, so capped at 1000.
- doors-audit 812: an unbounded `.in()`.
- queue-audit 1398: an unbounded `.in()`.
- overnight-queue-load 379: checks only the first 100 ids.

**Reports that print a reassuring figure on a failed read:**

- principals 355: "0 remain".
- order-flow-walk-shots 217.

## What a fix would be, for a ruling

One shape for every A site, the one `fix/demo-audit-reads-its-error` already
uses: destructure `error`, and when it is set record COULD NOT TELL rather than
PASS. Page or chunk the unbounded `.in()` lists at 100. The three gates above
would be first:

- queue-drain refuses on an error.
- queue-audit reports COULD NOT TELL.
- seed-admin exits on an error.

`ledgerRowCount` would return null, and its callers would say they could not
count.

**Recommendation:** one branch for the three gates, then one per file group,
each injection-verified by forcing the read to fail. This is a change to
checks, which makes them stricter and never looser, but it touches about 25
audit files, so it waits for the operator's word.
