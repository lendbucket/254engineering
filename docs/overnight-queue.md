# Overnight queue, 2026-10-23

Robert's overnight mode, until about 11:30 UTC. The Claude Code session writes
this file on `ops/overnight` and pushes it with `[skip ci]` after every change.
The operator's chat counterpart reads it every hour at :15 past, 04:15 to 11:15
UTC.

**The chat's part:** for each entry marked **ready for chat**, verify the
migration file's SHA-256 at the commit named, read the file in full, run the
sitting document's Sections 0 to 2, and apply on DEVELOPMENT
(`ythzaiqeoijlrdibnieo`) with `apply_migration`. Never production. The session
detects the apply by reading development's live shape fingerprint against the
sitting document's prediction. An entry with no apply after an hour is taken as
a mismatch the chat found, and is left for the morning.

## Migrations for development

None ready yet.

## Already on development tonight

| Migration | Branch | Provider version | Read back |
| --- | --- | --- | --- |
| 0082 scope addendum | `feat/design-addendum` | 20261023022247 | every answer as predicted |
| 0083 permit letter option | `feat/pl-determination` | 20261023024543 | every answer as predicted |

## Queue and status

| # | Item | Status |
| --- | --- | --- |
| 1 | Pricing: board `39893229124` VOIDED; clean board `39895075922` on the same commit `97af17b` (branch `merge/pricing-on-main-2`); merge on a match; confirm $709 roof live | clean board running |

**Item 1, the voided board, the session's own fault.** At about 03:24 to
03:25 UTC the session ran `retention-audit` from the PC as part of a batch of
static readers for item 2. retention-audit is a WRITER: it inserts and removes
its own `eng_cron_runs` rows on development. Pricing's cloud writers shard had
held development since 03:11:11, so the two overlapped, against the standing
rule of 2026-10-22. That makes `39893229124`'s result arguable, and pricing
never merges on it. A cancel of that run was refused by the session's
permissions, so it runs to the end and is ignored. The clean board
`39895075922` measures the same commit; its writers shard waits its turn
behind the voided one.
| 2 | Board 0082 and 0083 branches on current main; hold on a match | boards pushed, writers queued |

**Item 2 predictions, stated before the pushes.**
`merge/design-addendum-on-main-1` at `db821b6` (feat/design-addendum 5025953
on main 7994969): 61 of 61, no FAIL, retries at most 5; migration-audit 138,
protocol-registry 156, order-audit 559, proofs-audit 94; perf passes with
/coverage's NOT STABLE as the one undecided check; standing notes: stripe-webhook's
two, dashboards' empty firm, retention's 5 naming eng_jobs, 68 signed-in
screens unmeasured, compliance's one acknowledgement.
`merge/pl-determination-on-main-1` at `e6ee6f8` (feat/pl-determination
a339992 on main 7994969): the same, migration-audit 139, proofs-audit 95.
Static readers run on the PC first, every one green; no writer audit.
| 3 | `feat/fc-pl-letters`: determination and sealing for FC-001 and PL-001; hold | queued |
| 4 | Training record migration; hold | queued |
| 5 | Fast lane: logo on site and email, "Services" out of staff email, JobPosting schema | queued |
