# Overnight queue, 2026-10-23

## MORNING REPORT

**Needed from Robert, three rulings, and the first blocks everything full lane.**

1. **The walk's leftover probe accounts.** `bf376756-f8c4-4525-9eef-ca2492b6c6aa`
   and `3b09b3a2-b6e6-43ad-ab7b-dcc4f041ebbe`, made by the design-addendum
   walk on development, are held by records that refuse deletion (a scope
   addendum, seal acts), so every probe sweep fails on them and every writers
   shard tonight failed seven audits on that line alone. Recommendation: rule
   such an account "kept by design", counted and named in the sweep's output,
   as the 2026-10-03 ruling does for customer accounts; and the walk must not
   make one again. The session caused this; it is set out in full below.
2. **bulk-audit counts a replaced function twice.** 0083 restates
   eng_record_review_decision, so the audit reads 5 assignment writers against
   its pinned 4 on every branch carrying 0083. The live database has one
   definition. Recommendation: count a function once, by its latest
   definition, keeping the pinned 4.
3. **The open copy and asset questions**, each in item 5 or item 3 below: the
   `/order` title (recommended "Order engineering work online in Texas | 254
   Engineering", 56); the derived white logo on `hold/logo-254-engineering`
   (Vercel preview); the JobPosting fault; and the nine FC and PL letter points
   in `docs/fc-pl-letters-open-points.md` on `feat/fc-pl-letters`.

**Three faults of the session's own tonight**: `retention-audit` run from the
PC at about 03:24 inside pricing's writers window (that board was voided and
re-run); the walk's probe accounts above; and, found by the chat in the
morning, a false report that 0084 was on development (corrected in item 4).

### Each item against its prediction

| # | Item | Result |
| --- | --- | --- |
| 1 | Pricing (`97af17b`, board `39895075922`) | **Stopped, not merged.** 54 of 61; the seven misses are the probe set; everything pricing measures passed (trade-pricing 40, the credit proof, order 556, price-book 67, intake 116, perf 81). $709 is not live. |
| 2a | 0082 on main (`db821b6`, board `39895256012`) | **Held.** 54 of 61, the probe set only; every predicted figure met. |
| 2b | 0083 on main (`e6ee6f8`, board `39895258058`) | **Held.** 53 of 61: the probe set and the bulk-audit double count; every predicted figure met. |
| 3 | FC and PL determination recording (`2c3e103`, board `39896119586`) | **Held.** 53 of 61, the same two causes; its new proof passed in the cloud. Letter sealing for both is not built: nine points for rulings. |
| 4 | 0084 training record | **NOT on development; to be redesigned.** CORRECTED 2026-10-23 morning: the chat held 0084 at 04:15 (a writers shard was running, and as written it pins test technicians forever through on delete restrict). The session's 04:45 claim that it was applied was FALSE: its read printed "present" for tables that do not exist, because the client returned no error and a null count. Board `39902040395` ran without 0084 on development and does not count. The false ledger record is reverted (`ce12e69`). |
| 5a | "Services" out of every email and the ruled site strings | **Merged** as `b8fbf19`, fast lane, readers all green. |
| 5b | Logo swap | **Held** on `hold/logo-254-engineering` (`bf391d6`) for Robert's look. |
| 5c | JobPosting | **Stopped**: the fault is not visible from the code. |
| Nightly | Board on main `b8fbf19` (`39929835070`) | **54 of 61, exactly as predicted:** the probe seven and nothing else; perf 81, retries 4. Under the lane rule a nightly miss stops all merges, both lanes, until Robert rules; nothing has merged since `b8fbf19`. |

### The production sitting order, once rulings 1 and 2 are made and the boards pass

Each migration is applied by the chat with `apply_migration` from its sitting
document, read back, recorded in `supabase/applied.mjs`, and only then is its
branch merged. Every branch is re-boarded on the main it lands on first.

| Order | Migration | SHA-256 | Sitting document | Branch to merge after the read-back |
| --- | --- | --- | --- | --- |
| 0 | none: pricing | | | `fix/engineer-pay-schedule-2` (no migration; merges on its board) |
| 1 | 0082 scope addendum | `03355c41011ee76966b0ee764497bfd444662005464f00be1514938d1ae08a6c` | `docs/production-sitting-0082-scope-addendum.md` | `feat/design-addendum`; then the chat writes the McAllen record on production |
| 2 | 0083 permit letter option | `57673888998a4802a8adfb241e68ea80ae2bbdb0aef3930dad6a9c0253b94005` | `docs/production-sitting-0083-permit-letter-option.md` | `feat/pl-determination`, then `feat/fc-pl-letters` (no migration of its own) |
| 3 | 0084 a line opens only when trained | `01b0170a3d26497f750b478de3c529b0e280bfb2d12fedca3e5e27b3f5013934` | `docs/production-sitting-0084-a-line-opens-only-when-trained.md` | `feat/training-record` |

### What opens for ordering once each lands, line by line

| Line | After tonight's work lands |
| --- | --- |
| Roof (RC-001) | Already open. Pricing makes it $709 (floor $702), $75 coastal on top. Its path through the money door is unchanged by 0084. |
| Foundation (FC-001) | Stays closed. Determination recording is built; the letter needs four rulings; it is not offered. |
| Permit letter (PL-001) | Stays closed. Determination and option recording built (0083); the letter needs five rulings; not offered. |
| Repair specification (RS-001) | Stays closed: the letter waits on Aman's approval of the actual letter. |
| Manufactured home, solar, WPI-8 | Quote request, as ruled, until their letters exist. WPI-8 ongoing unorderable until a scope addendum. |
| Design | A quote. Pays the engineer 35% only under a signed scope addendum (0082). |
| Any line once offered | From 0084, opens only when its protocol is signed AND an approved training record exists on that exact version. |

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
| `supabase/migrations/0084_a_line_opens_only_when_trained.sql` | `feat/training-record` | `454318d` (file unchanged since `e947a6e`) | `01b0170a3d26497f750b478de3c529b0e280bfb2d12fedca3e5e27b3f5013934` | `docs/production-sitting-0084-a-line-opens-only-when-trained.md` | **WITHDRAWN.** Held by the chat at 04:15 for the probe pinning; to be redesigned (Robert's ruling 6) and re-queued with a new SHA-256. Not on development. |

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

## STOP: EVERY WRITERS SHARD TONIGHT WILL FAIL, AND THE SESSION CAUSED IT

**Found 03:58 UTC, reading the voided pricing run's writers log.** The
design-addendum walk (run on development 02:31 and 02:33 on Robert's
instruction) created two test engineers on the probe domain,
`bf376756-f8c4-4525-9eef-ca2492b6c6aa` and
`3b09b3a2-b6e6-43ad-ab7b-dcc4f041ebbe`, and recorded a scope addendum and seal
acts against them. Those records refuse deletion by design (0082, 0062), so
the accounts can never be deleted, and every probe sweep now reports them:

    FAIL: the probe accounts were removed (left behind on audit-probe.invalid:
    2 profile(s), 2 auth user(s) with no profile, which can still sign in,
    deleteUser refused: bf376756...: Database error deleting user; 3b09b3a2...)

On the voided run that line failed native, messaging, dashboard-speed,
break-glass, mobile and contrast; proofs-audit failed six writer proofs that
create and remove probes, very probably the same cause but not confirmed from
their output. **Everything else in that writers shard passed, including
trade-pricing-audit and a-decided-review-credits-its-tier**, the two pricing
development readers.

The walk's own header said those records would stay; what it did not foresee
is that the sweep treats an undeletable probe account as a failure. The sweep
has a "kept by design" category (operator ruling 2026-10-03) for customer
accounts and partners only. Extending it to a staff probe held by sealed
records changes a check, which needs Robert's ruling; nothing has been
loosened. Both accounts are suspended in eng_profiles; their auth users exist.

**Consequence: every board tonight (pricing, the 0082, 0083, FC/PL and brand
boards) fails its writers shard on that line, so no full-lane item can merge
tonight, pricing included.** Each board is still read: a writers shard whose
only FAIL lines are that one is reported as such, with everything else it
measured.

**For Robert, one ruling unblocks it:** treat a probe account held by records
that refuse deletion (a seal act, a scope addendum) as kept by design, counted
and named in the sweep's output, exactly as the 2026-10-03 ruling does for
customer accounts; or rule another way. And the walk must not leave one again:
its test engineer should be created and recorded only where a sweep accounts
for it.

## Queue and status

| # | Item | Status |
| --- | --- | --- |
| 1 | Pricing: board `39893229124` VOIDED; clean board `39895075922` on `97af17b` | **STOPPED, not merged.** 54 of 61 against a predicted 61. The seven misses are exactly the leftover-probe ones (six audits on that line, proofs-audit on six writer proofs that passed on every board before the walk). Everything pricing is about passed: trade-pricing-audit 40 ("nothing sells beneath a floor"), a-decided-review-credits-its-tier, order 556, price-book 67, intake 116, perf 81; static, pages, gate and documents with no retries. Merges on Robert's word once the probe ruling lands and a board passes. $709 is not live. |

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
| 2 | Board 0082 and 0083 branches on current main; hold on a match | **0082 (`39895256012`, `db821b6`): 54 of 61, held.** Every predicted figure met (migration-audit 138, protocol-registry 156, proofs-audit of 94; static, pages, gate, documents clean, retries 4). The seven misses are exactly the probe-cause set; the prediction, written at 03:30, predates finding it, so it is a miss with a known cause. **0083 (`39895258058`, `e6ee6f8`): 53 of 61, held.** Predicted figures met (migration-audit 139, protocol-registry 156, proofs-audit of 95). The probe-cause seven, plus ONE NEW MISS: bulk-audit, "only accepting work writes an assignment (5 writer(s), 2 of which set one)" against a pinned 4. Cause, read from the audit's source: it counts every migration STATEMENT that writes eng_files.assigned_*, and 0083 restates eng_record_review_decision (0068's text plus two fields), so one live function is counted twice. The live database is unchanged: one definition, which only clears an assignment. Proposed repair, for a ruling: count a function once, by its latest definition, keeping the pinned 4. Not made tonight, because bulk-audit is a writer and cannot be run standalone from the PC before the change is committed. The FC/PL and training boards carry 0083 and will show the same miss. |

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
| 3 | `feat/fc-pl-letters`: determination recording for FC-001 and PL-001 built; sealing both letters held for nine rulings; hold | **Board `39896119586` on `2c3e103`: 53 of 61, held.** Every predicted figure met (proofs-audit of 96 with fc-and-pl-reviews-record-a-determination PASS in the cloud, migration-audit 139, review-audit 91, protocol-run-audit 59, protocol-registry 156; static, pages, gate, documents clean). The eight misses are the probe-cause seven and bulk-audit's double count of 0083, both explained above. |

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
| 4 | Training record migration 0084 (`feat/training-record`); hold | **NOT on development (corrected: see the morning report). The board below does not count.** Board pushed at `6145a69`. Prediction: 54 of 61 with exactly the seven probe-cause misses (native, messaging, dashboard-speed, break-glass, mobile, contrast on the probe line; proofs-audit on the same six proofs, which MASK a-certification-waits-for-the-engineer, the writer proof of the training record); migration-audit 140, protocol-registry 156, order 559; everything else passes, retries at most 5. |
| 5 | Fast lane: (a) "Services" out of every email and the ruled site strings; (b) logo swap HELD on `hold/logo-254-engineering` (`bf391d6`); (c) JobPosting STOPPED | (a) MERGED as `b8fbf19`, pushed 04:03:34 UTC, ls-remote confirmed; readers from board `39897561918`: static 28/28 incl. email-audit, pages 8/8, gate 2, documents 1, no retries. Vercel deploys it (skip ci does not stop a deploy). |

**Item 5, what was held or stopped, and why.**
(b) The new `254-engineering-logo.png` is navy artwork for light backgrounds.
The email header band and three dark surfaces (portal sidebar, mobile menu,
footer) use the white `logo-dark.png`; the email layout's own comment records
that the light artwork on the navy band is invisible. Swapping light surfaces
only would leave the old lockup in the footer and every email. A white version
of the new artwork is needed first: the session can derive one mechanically,
as the letter mark was, but a brand asset is Robert's to approve.
(c) The morning log has "JobPosting hiringOrganization fix, full lane" (Robert,
2026-10-21) and no description of the fault. The careers pages emit the
Organization node the `@id` points at, so no defect is visible from the code,
and the session does not guess at one. Question: what is the fault (for
instance a Search Console or Rich Results message)?
Also held from (a): the `/order` title, which without "Services" is 47
characters, under the 50 the SEO law requires; recommended wording for a
ruling: "Order engineering work online in Texas | 254 Engineering" (56).
