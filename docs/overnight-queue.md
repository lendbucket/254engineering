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

| Migration | Branch | Commit | SHA-256 | Sitting document | Status |
| --- | --- | --- | --- | --- | --- |
| `supabase/migrations/0084_a_line_opens_only_when_trained.sql` | `feat/training-record` | `454318d` (file unchanged since `e947a6e`) | `01b0170a3d26497f750b478de3c529b0e280bfb2d12fedca3e5e27b3f5013934` | `docs/production-sitting-0084-a-line-opens-only-when-trained.md` | **ready for chat** |

0084 needs 0083 on development, which it has (20261023024543). It is additive
only: two new tables, a backfill into them, one new function. It alters no
existing table or function, so an apply while a branch board's writers shard
runs changes nothing those branches read. Predicted: shape
`a4bbde8cac7f216a582875f8ff8d1e01` / 1280 before,
`79a8143e24f29af96b2a26573efd8803` / 1299 after.

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
| 3 | `feat/fc-pl-letters`: determination recording for FC-001 and PL-001 built; sealing both letters held for nine rulings; hold | board pushed, writers queued |

**Item 3, what the templates file showed.** The 2026-10-06 file is the
engineer's answered copy: his `[ENGINEER: ...]` notes are his words, and
template 4's options, method values and limitation sentences are his.
Determination recording is built (`2c3e103`). Sealing either letter is NOT
built, because both templates name facts the platform does not hold or a
mapping nobody has ruled; nine points, written up in
`docs/fc-pl-letters-open-points.md` on the branch. The sharpest: FC's option C
is a sealed "declines to certify" letter, while FC-001's DECLINE is declining
the job, which the standing decision says gets an email and a refund, never a
sealed letter.

**Item 3 prediction, stated before the push.** `feat/fc-pl-letters` at
`2c3e103` (on `merge/pl-determination-on-main-1`): 61 of 61, no FAIL, retries
at most 5; migration-audit 139, protocol-registry 156, order-audit 559,
review-audit 91, protocol-run-audit 59, proofs-audit 96; perf passes with
/coverage's NOT STABLE as the one undecided check; tonight's five standing notes.
| 4 | Training record migration 0084 (`feat/training-record`); hold | ready for chat on development; board after the apply |
| 5 | Fast lane: logo on site and email, "Services" out of staff email, JobPosting schema | queued |
