# Resume note, 2026-10-09

Updated after every merge. Read this first after a restart; it is the queue
position, not the reasoning (that is in GAPS.md and the commit messages).

## Queue position

| # | Item | Branch | State |
| --- | --- | --- | --- |
| 1 | What a customer receives quotes a signed protocol | `fix/receive-quotes-protocol` at 50e61ca | **MERGED as bce1a41**, board 60 of 60. Carried fix/doors-probe-teardown (92786d7), whose stranded probe order failed the first board 58 of 60 |
| 1a | The machine lock skips itself when .env.local carries VERCEL | `fix/machine-lock-env` at 1771eb1 | **MERGED** inside b190559; proof's fourth case injection-verified |
| 2 | Admin dashboard speed | `fix/admin-dashboard-speed` at abe2486 | **MERGED as b190559**, board 61 of 61. Cause: a prefetched export link hung and wrote an export audit row per view. Median 807 ms after (board: 673 ms) |
| 3 | V10 admin-ops | `feat/v10-admin-ops` at c3cd79e | **MERGED as 64fb7d3**, board 61 of 61; list 19 to 11; /portal/techs stays listed (map legend decision) |
| 4 | V10 admin-accounts | `feat/v10-admin-accounts` at 2af5641 | **MERGED as 33bdbb2**, 61 of 61 on the permitted re-board (first board: two roles-audit lines, an engineer session refused twice between successes); list 11 to 4 |
| 5 | V10 partner | `feat/v10-partner` at 7545f9c | **MERGED as 62d3133**, board 61 of 61; list 4 to 1; the partner surface is held to the phone sections rule |
| 6 | V10 techs finish | `feat/v10-techs-finish` | **MERGED as 804fc29**; list 1 to 0 |
| 7 | Audit seed | `feat/audit-seed` at 60171b3 | **MERGED as f2b6031**, on the permitted re-board (first: a demo-audit fetch failed) |
| 8 | Certification unblock | `fix/certification-unblock` at 2bff1b5 | **MERGED as 3bb883e** (parents f2b6031, 2bff1b5), board 60 of 61, the one predicted line being schema-ledger-audit's parity on 0066, which the merge resolves. schema-ledger-audit on main afterwards: 32 of 32, applied 67, pending 0. The first board, d1e18d2, missed (59 of 61): migration-audit's pinned shape had not moved with 0066 |
| 9 | Probe transient retry | `fix/probe-transient-retry` at fdc6015 | **MERGED as b24046a** (parents 3bb883e, fdc6015), 61 of 61 on the permitted re-board, Transient retries 3 equal to the log. Boards before it: e9b0346 61 of 61 but its retry count read 0 over 3 retries (fixed), and the pattern change reverted under the operator's ruling; fdc6015's first board 60 + 1 could not tell (roles-audit probe create, connect timeout, correctly not retried) |
| 10 | Health watch log level | `fix/health-watch-log-level` at ab38049 | **MERGED in d282d5a** via `integrate/2026-10-10` at a823a2a, board 61 of 61, retries 3 equal to the log |
| 10a | Probe ids | `fix/probe-ids` at 45a6aae | **MERGED in d282d5a**, same board |
| 11 | Product audit, portal by portal | this branch | **IN PROGRESS**: inventory, 220 valid screenshots, notes for all five portals, brute force log, defects pushed (7f71185). Pending: 220 captures to retake, the break-it sweep re-run |
| 12 | Defect fixes, no migration | `integrate/2026-10-10b` at b631786 (15 branches: offer-needs-a-rate, partner-window-copy, dates-in-central, customer-sign-in-limit, credential-form-offline, mfa-no-replace-from-password, review-belongs-to-its-engineer, pay-owed-one-home, refund-reason-per-order, mfa-sign-out, waiting-links, launch-sellable-needs-the-gate, engineer-dead-links, csr-most-recent, partner-true-totals) | **MERGED as 8c991fd** (parents d282d5a, b631786), board 61 of 61, retries 3 equal to the log; importing audits standalone 19 of 19. The MFA bypass was reproduced live on d282d5a first. The lock was held by other projects 04:42Z to 08:02Z and 08:08Z to 08:26Z |
| 12a | Three more small fixes | `integrate/2026-10-10c` at ee3f487 | Board **59 of 61** (voice-audit: "Cancelled"; token-audit: a 13.5px size), split per the rule. `fix/cancelled-job-stays-visible` at f19438b boarded alone 61 of 61, **MERGED as 7cdb9d0**. `fix/files-list-says-when-capped` (75d9c8e) and `fix/file-panel-stale-copy` (1d50cea) fixed and pushed, **NOT YET BOARDED ALONE**: next |
| 13 | Two tabs, two pending credentials | `fix/credential-one-pending` at 39863c3, migration 0067 | **MERGED as d99ede9** (parents 7cdb9d0, 39863c3), board 60 of 61, the one predicted line being schema-ledger-audit's 0067-not-on-main, which the merge resolves. 0067 applied to development then production by the counterpart 2026-10-10, read back as predicted |
| 13b | Engineer pay, one home | `fix/engineer-pay-one-home` at b57eb60 | **MERGED as b3482dd** (parents d99ede9, b57eb60), 61 of 61. First board 7f561eb 60 of 61 (stale db-guard clock allowance) |
| 13d | Tech dashboard names dispatch blockers | `fix/tech-dashboard-names-blockers` at e9da5f3 | **MERGED as 2beb06c** (parents b3482dd, e9da5f3), 61 of 61 as predicted |
| 13f | 0068, a decision and its credit are one write | `fix/review-and-credit-one-write` at 0a27586 | **MERGED as c14144f** (parents 2beb06c, 0a27586), 60 of 61 as predicted (schema-ledger: 0068 applied, not on main). First board 36e2dff 58 + 2 + 1: bulk-audit counted two assignment writers because 0068 moved the third into eng_record_review_decision (scan widened to migrations, injection-verified), and a mobile-overflow timeout on /portal/inquiries that did not recur. Pushed by the operator from PowerShell after the classifier refused the session's push |
| 13g | 0069, WP-001 v1.2 and FC-001 v1.0 drafts | `feat/wp-001-v1-2-and-fc-001` at 89389c4 | **MERGED as dcfe8af** (parents c14144f, 89389c4), 60 of 61 as predicted |
| 13i | 0070, the second factor required for the engineer | `fix/second-factor-required` at a0c0457 | **MERGED as 446547d** (parents dcfe8af, a0c0457), 60 of 61 as predicted. Carried the SOC 2 gap's engineer half closing and the pack regenerated |
| 13j | 0071, sign in attempts counted in the database | `fix/sign-in-limiter-in-the-database` at 8c23c75 | **MERGED as 3bb9cf7** (parents 446547d, 8c23c75), 60 of 61 as predicted; the first board with the limiter's table present, no fallback logged |
| 13k | 0072, a partner's logo approved before it shows | `feat/partner-branding-upload` at 43416ad | **MERGED as 730df43** (parents 3bb9cf7, 43416ad), 60 of 61 as predicted; the first board with the logo columns present |
| 13h | 0073, no eng_ function callable without the service role | `fix/function-grants` at 81e4e5e | **STAGED**, boarded 61 of 61 as predicted on 730df43, pushed; sitting document `docs/production-sitting-fix-function-grants.md`. Merges once the counterpart's apply is pasted (bring it up to main first) |
| 13l | demo-audit read its lookup's error | `fix/demo-audit-reads-its-error` at 9095153 | **MERGED as f828a56** (parents 730df43, 9095153), 61 of 61 as predicted. The clients-screen check had passed over a failed read since the 0070 board; the class (21 reads that take data and not error) is a BACKLOG survey |
| 13m | Run item 9, staff record search | `feat/staff-record-search` at 0036f5e | **MERGED as 1d34e75**, 61 of 61 as predicted |
| 13n | Run item 10, one price story with the coastal line | `fix/one-price-story` at ca31b4e | **MERGED as fb9ff42**, 61 of 61 as predicted |
| 13o | Overnight item 3, template publishing | none yet | **BLOCKED, needs a ruling.** All five signed protocols (MH, SL, PL, RS, DS v1.1) carry `requires_discipline` null, in the database (0065) and in their transcriptions. The approval refuses a protocol with no stated discipline, because the engineer's declared competence is checked against it; RC-001 cleared only through 0056, which records Aman's written direction ("Structural Engineering governs this requirement"). Publishing the five through eng_approve_protocol now would skip that check, so nothing is written. Needed: Aman's written direction per protocol, as for RC-001. Checked meanwhile, operator's points 3 and 4: every checklist label (109), intake question (96) and determination heading and criterion (113) of the five is word for word in its signed text, no differences. Transcription sha each signature must carry: MH d5fb2893, SL c19522c8, PL c8814496, RS 47e8e9ec, DS c47536b8 (full values in the morning report). Development holds no protocol seal acts, so a backfill publishes nothing there |
| 13e | The run of 2026-10-10 | | Everything else built that day, its branches, boards and questions: `docs/audit-2026-10/RUN-2026-10-10.md`. 0070 amended before any apply to the engineer role only (admin stays optional, operator ruling 2026-10-10); staged chain 0068, 0069, 0070, 0071, 0072, in that order |
| 13a | Rulings of 2026-10-10 morning | | Order: engineer pay one home (`engineer-pay.ts`, productionFeeFor reads the tier; production eng_fee_schedule is EMPTY), then template published on signing (migration unapplied), then WP-001 v1.2 and FC-001 v1.0 transcriptions (migration unapplied), then the rest |
| 14 | Public site colours | | after the audit and the defects |

## Main

`origin/main` at fb9ff42 (0068 merged as c14144f, 0069 as dcfe8af, 0070 as 446547d, 0071 as 3bb9cf7, 0072 as 730df43, the demo-audit fix as f828a56, item 9 as 1d34e75, item 10 as fb9ff42). Production has 0068 to 0072 (counterpart, 2026-10-10), all on main; 0073 staged. Next: the rest of the run's queue, item 12.3 at 5c058dd first, in order, on exact passes under the standing word. Dated not-yet-V10 list: **0**. The board has **61** audits and prints a transient retry count.

## Worktrees

- `C:/Users/salon/projects/254engineering`: main (its .next is the audit's capture build)
- `C:/Users/salon/projects/254engineering-v10`: integrate/2026-10-10b (do not switch while a run builds it)
- `C:/Users/salon/projects/254engineering-tdi`: fix/machine-lock-env (merged)
- `C:/Users/salon/projects/254engineering-audit`: docs/product-audit-2026-10 (this file)

## Open decisions

None. All three were ruled on 2026-10-09: the map legend allowed inside a
`data-v10-map` element only; "cover"/"covers" by number confirmed; the audit
seed makes one partner statement and one customer bulk order, once,
demo-marked.

## Correction to the morning report of 2026-10-09

The report predicted that production held a false "Exported margin by period"
audit row for every administrator dashboard view since the Export button
shipped. **That prediction was wrong.** The operator read production: there are
**2** `export.period` rows (2026-09-04, and 2026-10-07 at 21:54 CT, the same
account), not one per view. No annotation is wanted. Development's 1,196 rows
came from audit and screenshot runs loading the dashboard many times a day;
production's dashboard is opened far less, and the prediction extrapolated
development's count to a system with different traffic without saying so. The
defect and the fix stand as merged in b190559; only the claim about
production's extent was wrong.

## Current branch

None in flight. The product audit runs from the main checkout (254engineering at d282d5a); its screenshots and findings land on this branch.

## Things a resumed session must know

- The machine lock: launch only when `C:/Users/salon/.test-lock` is ABSENT, and
  read it after launching to confirm it names our pid. 1771eb1 (merged in
  b190559) stops .env.local's VERCEL from making the lock skip itself.
- The first dashboard timing (12 to 16 ms response) did not record what page it
  measured and is not trusted; the measuring mode now records the final URL and
  the heading.
