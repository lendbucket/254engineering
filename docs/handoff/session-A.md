# Handoff, session A (2026-11-03)

Written on Robert's stop order of 2026-11-03. This session started nothing, dispatched nothing, merged nothing and pushed nothing new after the stop, apart from recording the running board's result, this file, and its pointer.

## Where this session is

- **The branch this file is on:** `ops/day`, worktree `C:/Users/salon/projects/254-wt-day`. Every record this session wrote is on this branch: `docs/day-queue.md` and `docs/standing-orders.md`. The main checkout sits on `main`, but a push to main needs Robert's merge word, so this file is not there.
- **Main:** `3446a44` on origin, read with ls-remote. Merged today, in order, each merged tree being its boarded tree plus the 0108 ledger line and nothing else:

| Item | Merge commit | Board |
| --- | --- | --- |
| P2 | `18c6024` | 41568841308 |
| Q1 | `0e0ccaa` | 41577228672 |
| Q2 | `ff97f63` | 41584441642 |
| Q3 | `86c70a3` | 41598989978 |
| Q4 | `ab90ea6` | 41616890435 |
| Q7 | `3446a44` | 41627371607 |

- **Production migrations:** 0105 to 0108 are on production. The chat counterpart applied 0108 at 2026-11-03 14:00:06 UTC (6605797441), and the ledger records it on main.

## In flight

- **Q10's board, 41642696380 on `2ad0d95`** (`fix/q10-factor-and-passwords`): finished GREEN, 65 of 65 (details at the end of this file). **Not merged**, per Robert's stop order.
- **Nothing else is running.** The three background agents (the Q9 per-audit bucket, the review-request fixture, F9) have all finished. The background waiter on Q10's board was reaped for memory and was not restarted.

## What this session was about to do next

1. **On a green Q10:** merge Q10 (its tree plus the 0108 ledger line, checked by `scratchpad/merge-q.sh`).
2. **Q9 next, and the order matters.** Q10 carries `2ad0d95`, which reverts Q9 (`677767b`).
   - Q9 (`fix/q9-signin-and-documents` at `092c06f`) must take the new main and revert `2ad0d95` on its own branch (Robert: "When Q9 merges, revert 2ad0d95 in the same merge"), then board on that tree, then merge.
   - **Q9 must never merge before Q10.** Q10's merge would then take Q9 back out of main.
3. **Then the rest of the Q queue, in this order.** Each branch already carries everything before it, plus P2 and the Q9 hold back, and each is preflight GREEN and unboarded.
   - **Q11 to Q14:** Q11 `55b8c87`, Q12 `a809e12`, Q13 `ac749b6`, Q14 `cb649f3`.
   - **Q5 `fd81e8b`:** carries 0109, which is on development. The production sitting follows its board.
   - **Q6 `3a0f0ef`:** carries 0110, which is on development. The production sitting follows its board.
   - **Q8 part 1 `3de8bca`:** code only, on `fix/q8-money-integrity`.
   - **Each needs main merged in first.** Main now carries P2, Q1 to Q4 and Q7 plus the ledger line.
4. **Then the CRM, R1 to R8** (`feat/crm-r1-data-model` to `feat/crm-r8-reports`).
   - **Not yet stacked on the current main.**
   - **Development sittings for 0111 and 0112 are asked of the chat just before R1 boards,** and each later R migration just before its item.
   - **Do not ask earlier.** A development schema ahead of the boarding branches breaks their audits, which is what 0108 did to P2.
5. **Then the follow-ups:** the review-request decline suppression (`fix/f3-no-review-request-on-decline` `99ead60`), the per-door counters (`fix/f2-per-door-counters` `93ca1e4`; it carries Q9, so re-stack it), message search (`fix/f4-search-every-thread` `76d6fa6`), the review-request fixture (`fix/review-request-fixture-once` `f9761a2`), and F9 roof (`fix/f9-visit-date-receipt` `c7e8a31`).
6. **Then M2 (`fix/m2-session-epoch` `b16b496`, 0117).** It carries Q9 and sits on R8.
7. **Then Q8b** (`fix/q8b-money-constraints` `6c7e064`, 0118, after M2, accepted by Robert) **and Q8c** (`fix/q8c-disputes` `97b01ae`, stacked on Q8b; see the open questions).
8. **Then the five low bundles:** `fix/low-auth` `5ba2528`, `fix/low-money` `a434253`, `fix/low-site` `5a80123`, `fix/low-field` `b4f9530`, `fix/low-office` `3b583fb`. low-office meets P2 in the export routes.

## Stage branches (pushed) and sittings

| Migration | Stage branch head | Development | Production |
| --- | --- | --- | --- |
| 0109 | `7b499ee` | sat | owed after Q5's board |
| 0110 | `43a28e1` | sat | owed after Q6's board |
| 0111 | `fb7c092` | owed before R1 | after R1 |
| 0112 | `e18e002` | owed before R1 (R2's) | after R2 |
| 0113 | `d49576c` | owed before R4 | after R4 |
| 0114 | `c0e5d83` | owed before R5 | after R5 |
| 0115 | `e967ddd` | owed before R7 | after R7 |
| 0116 | `e4bbffb` | owed before R8 | after R8 |
| 0117 | `659b1fe` | owed before M2 | after M2 |
| 0118 | `7113306` | owed before Q8b, after 0117 | after Q8b |

**Before 0118 is sat:** the pre-sitting duplicate read for the chat is in the scratchpad, `q8-0118-duplicate-read.sql`. It must be posted with the sitting request.

## Parked, and why

| Item | Why | Answer needed |
| --- | --- | --- |
| Q8c (disputes) | stripe-webhook-audit fails until `src/config/stripe-webhook.ts` declares `charge.dispute.created` and `charge.dispute.closed` | Robert wrote "I registered ... go ahead. (only after you actually add them in Stripe)". The session read the parenthetical as a condition and asked, in session, for confirmation that both events are on the live endpoint. Update the declaration, dated and attributed, only once he confirms. |
| F9, four of five letters | The quoted section 9 sentence exists only in 254-RC-001 | F9 correction comment 6606054209, question 1 |
| Austin CRM source | Robert has not posted its terms | His terms |

## Open questions for Robert, with their issue #1 comment ids

- **6606054209 (F9 correction).**
  - The earlier F9 question was wrong twice: no template is signed since 0091, and the sentence is RC-001 only.
  - Q1: the four other letters. Recommended: keep refusing until the engineer gives a sentence per protocol.
  - Q2: is adoption by sealing enough for the new roof line? Recommended: yes.
  - It supersedes 6594767802.
- **6600889921 (Q8):** all three questions answered on 2026-11-03. Only the Q8c confirmation above remains.
- **6594441148:** L6, the F12/F6 migration, and the L3 upload limit. Unanswered.
- **6593031538:** R8's two questions. Unanswered.
- **6591993537:** R6's two questions. Unanswered.
- **Answered, closed:** 6604805129 (Q9: bucket per audit, answered and built) and 6589406190 (R2).

## Conventions this session followed that are not in standing-orders.md or CLAUDE.md

**Branches and stacking**
- **One worktree per item.** Each is named `C:/Users/salon/projects/254-wt-<x>` and carries a `node_modules` junction to the main checkout's (`cmd //c mklink /J`).
- **Each queued branch takes the previous item's boarded head.** Every later branch carries everything before it, so a board measures what will be on main ahead of it.
- **A fix found on one board is merged up the whole stack at once.** This was done for the Q3 rate fixture, the bulk-audit sample and the Q9 hold back.

**Conflicts and merges**
- **Conflicts are resolved by a script written to the scratchpad with the editor.** Examples: `resolve-q2p5.mjs`, `resolve-q11.mjs`, `take-ours.mjs`. Each refuses unless the expected number of hunks is found. Every proof that reads the resolved file is run afterwards.
- **Merging a boarded branch uses `scratchpad/merge-q.sh <boarded commit> <expected origin/main> <message file>`.** It checks the branch, that origin/main is the expected head, and that the merged tree differs from the boarded tree only in `supabase/applied.mjs`. Push with `git -C C:/Users/salon/projects/254engineering push origin main`, then ls-remote.
- **A ledger flip uses `scratchpad/flip-ledger.mjs <worktree> <date> <json>`.** The `note` in the json is an ARRAY of comment lines. schema-ledger-audit fails on the branch ("applied but not on main") until the merge, and passes on main after.

**Reading a board**
1. Download to `scratchpad/run-<id>`.
2. Copy `verdict-*/*.json` to `v/` and run `scripts/ci/board-verdict.mjs`.
3. Open each `board-log-*/*.sealed` with `scripts/ci/seal.mjs open ... C:/Users/salon/.254-ci/log-key.pem` and untar it.
4. Read `x-board-log-writers/board/suite.log` for the LCP table, WARNING and FAIL.
5. Save the LCP table as `scratchpad/b-<id>.txt` and diff it against the last green board for unchanged bytes.

**Predictions and fixtures**
- **The prediction is committed on ops/day before dispatch.** Once, an edit refusal put it after dispatch; that is recorded on ops/day as such.
- **Reading development read-only for a diagnosis** uses `auditClient(purpose, { neverProduction: true })` from the main checkout, the only worktree with `.env.local`. Example: `scratchpad/newest-files.mjs`. It is never a writer audit.
- **A board failure caused by a fixture or a sample, not by the branch, is fixed in the harness without loosening the check, and recorded as not the branch's doing.** Examples: the Q3 rate fixture status, and bulk-audit's newest priced file.
- **A writer audit changed locally is syntax checked only.** The board is its first real run, and the prediction says so.

**Waiting**
- **A background waiter on a board is `until completed; do gh run watch || sleep 60; done`, with a ScheduleWakeup fallback.** If the memory reaper kills the waiter, it is not restarted.

## Q10's board result

**Board 41642696380 on `2ad0d95` passed: 65 of 65, every gating audit, 0 could not tell.**
- **Sign-ins:** no probe sign-in was refused with 429.
- **Public pages:** bytes identical to Q7's board.
- **Speed:** `/` 2,486, `/coverage` 2,562, `/coverage/coastal-bend` 2,412, `/services/windstorm-wpi-8` 2,721.
- **Not merged, per the stop order.** Q10 is ready to merge on Robert's word as the next item, and Q9 follows it as described above.
