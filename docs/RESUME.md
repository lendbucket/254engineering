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
| 13o | Overnight item 3, template publishing | none yet | **UNBLOCKED 2026-10-14: Aman's written answer (13p) names Structural; recorded on the protocol signing branch.** Was: **BLOCKED, needs a ruling.** All five signed protocols (MH, SL, PL, RS, DS v1.1) carry `requires_discipline` null, in the database (0065) and in their transcriptions. The approval refuses a protocol with no stated discipline, because the engineer's declared competence is checked against it; RC-001 cleared only through 0056, which records Aman's written direction ("Structural Engineering governs this requirement"). Publishing the five through eng_approve_protocol now would skip that check, so nothing is written. Needed: Aman's written direction per protocol, as for RC-001. Checked meanwhile, operator's points 3 and 4: every checklist label (109), intake question (96) and determination heading and criterion (113) of the five is word for word in its signed text, no differences. Transcription sha each signature must carry: MH d5fb2893, SL c19522c8, PL c8814496, RS 47e8e9ec, DS c47536b8 (full values in the morning report). Development holds no protocol seal acts, so a backfill publishes nothing there |
| 13q | Overnight: 12.3 no offer without a rate | `fix/no-offer-without-a-rate` at 5c058dd | **MERGED as e986da0**, 61 of 61 |
| 13r | Overnight: 0073 | `fix/function-grants` at 6e5cf9d | **MERGED as dbe7507**; first board 59 + 1 + 1 (a `/portal/login` timeout at 390, see the morning report), re-board exact 60 + 1 |
| 13s | Overnight: partner billing, 0074 | `feat/partner-billing` at 90e6d4e | **STAGED**, `docs/production-sitting-feat-partner-billing.md`; billing off |
| 13t | Existing-client account match | `fix/existing-client-account` at 83b774d | **MERGED LOCALLY as 1588d5b** (parents 9480a46, 83b774d, tree 5c146ee identical to 83b774d), board 61 of 61 exact. The first push was refused by the classifier and not retried; **PUSHED on Robert's approval 2026-10-13**, origin/main confirmed 9480a462 before, ls-remote 1588d5b12a97eec88a73f9836b6cc9e17d43e273 after |
| 13u | 0076, a refund update is applied once | `fix/refund-update-event` at aa809a2 | **MERGED as 449216f** (parents 1588d5b, aa809a2; tree c73240d identical to aa809a2), pushed, ls-remote confirmed. 0076 applied to development and production 2026-10-13, read back exact, recorded. Board 59 + 2 exact (stripe-webhook's declaration line, schema-ledger's applied-not-on-main line, which the merge clears). Robert added `charge.refund.updated` to the live endpoint (confirmed 2026-10-14) and registeredEvents gained it in 0cc6792 on `copy/scope-structural`. **Remaining:** the counterpart confirms the deploy READY (not yet reported), and the keyed live half of stripe-webhook-audit reads the four events back |
| 13v | 0077, protocol signing: WP-001 v1.2 and FC-001 v1.0 signable, Structural on the eight | `feat/protocol-signing-wp-fc` at 81f4ee7 | **MERGED as 689dc15** (parents 449216f, 81f4ee7; tree 643c770 identical to 81f4ee7), pushed, ls-remote confirmed. 0077 applied to development and production 2026-10-14 by the counterpart, read back exact, recorded. Boards: 6260e08 60 + 1 exact, 81f4ee7 59 + 2 exact. **Still owed:** Aman's signatures on WP-001 v1.2, WS-001 v1.1 and FC-001 v1.0 and his approval of each protocol. **Next:** the scope copy branch (terms Draft 1, design inquiry fifth card), then fix/refund-pending-wording, then partner onboarding |
| 13w | Scope copy, and charge.refund.updated registered | `copy/scope-structural` at 0cc6792 (3702712 the copy, 0cc6792 the event) | Pushed, ls-remote 0cc6792. Board **61 + 0, exact**, QR 0.4s. **Awaiting:** Robert's merge word (origin/main expected 689dc15), and his ruling on whether the terms EFFECTIVE date moves from 16 August 2026 (recommended yes, which would need its own board). **Next:** fix/refund-pending-wording, then partner onboarding |
| 13x | File panel stale copy | `fix/file-panel-stale-copy` at d30a8ad | **MERGED as 6b68fa6** (parents 828939f, d30a8ad; tree identical to d30a8ad), board 61 of 61 exact 2026-10-15, QR 0.4s, retries 4. The session's push was refused by the classifier and not retried; **Robert pushed it from PowerShell 2026-10-15**, ls-remote 6b68fa6 confirmed |
| 13y | Declined file says paid | `fix/declined-file-says-paid` at e6211d2 | **MERGED as a5d9866** (parents 6b68fa6, e6211d2; tree 10bcb0e identical to e6211d2), pushed, ls-remote confirmed. First board 60 + 1 could not tell (mobile-overflow: /portal/applications at 360 timed out, untouched by the branch); re-board on the same commit 61 of 61 exact, retries 9 (mobile-overflow 5). **Next:** fix/timeline-says-queued (95a15b4, readers running), then files-list-says-when-capped, refund wording, cancel-refuses-unread-charges, gates, quotes (ruled B 2026-10-15 2:30 PM) |
| 13z | Timeline says queued | `fix/timeline-says-queued` at 95a15b4 | **MERGED as ee07466** (parents a5d9866, 95a15b4; tree 4a0121a identical), pushed, ls-remote confirmed. Board 61 of 61; perf printed /coverage NOT STABLE unlisted, and Robert ruled it an exact pass and a standing note. /coverage LCP recorded as after launch on `docs/backlog-coverage-lcp` |
| 13aa | Files list says when capped | `fix/files-list-says-when-capped` at 29df1d7 | **MERGED as 2302912** (parents ee07466, 29df1d7; tree 2705b08 identical to 29df1d7), pushed, ls-remote confirmed. First board 60 of 61: retention-audit FAILED its plan check on 2026-09-15 (67 dev cron rows, no rollup) after the board crossed midnight UTC; perf NOT STABLE on /services/windstorm-wpi-8 and /coverage/coastal-bend. Robert ruled 2026-10-15: run `rollupDay` on development for 09-15 only (done, cron.runs 67 read back equal to 67 rows), any perf NOT STABLE line is a standing note if there is no LCP FAIL, both routes and the retention fixture entry go to BACKLOG (`docs/backlog-coverage-lcp` at f50d70c). Re-board unchanged 61 of 61 exact, QR 0.9s, retries 3. **Next:** refund wording (64e1e7b), cancel-refuses-unread-charges, gates, quotes, then the backlog record board |
| 13ab | Refund pending wording | `fix/refund-pending-wording` at c45ce0a (main 2302912 merged in) | Readers 16 of 16 clean. **Push refused by the classifier 2026-10-16, not retried; origin still holds 84ec3a6.** To run from PowerShell: `git -C C:\Users\salon\projects\254engineering-v10 push origin fix/refund-pending-wording`, then `git ls-remote origin fix/refund-pending-wording` expecting c45ce0a. Board 60 of 61, prediction NOT met: retention-audit FAILED "with the rollups reconciling, a plan is written" because development now holds **66** eng_cron_runs rows for 2026-09-15 against a rollup of 67 (read back 67 = 67 on 2026-10-15; one source row has gone since). Nothing on the branch touches retention. **Held for Robert's word.** |
| 13ac | Saturday stack | refund c45ce0a, then `fix/clock-judged-at-capture` b7636af, `fix/photo-item-takes-its-answer` 4e3f4d2, `fix/order-thread-button` 8cef657, `feat/no-charge-is-admin-and-mfa` 2aea7f1, each merging the one before (local only, not pushed) | Stacked so each board measures the tree after the merges before it. All merges clean, tsc clean at 2aea7f1. Readers running at 2aea7f1. `migration/intake-photo-0078` 7c8a128 goes on top after its development apply |
| 13p | Question for Aman | | **SENT 2026-10-14** by Robert, with FC-001 added as item 6, and **ANSWERED the same day** in writing: "Everything we do will be under structural as we will be doing structural observations and structural calculations if required. We won't be covering any architectural or MEP aspects in any of the services." Recorded on the protocol signing branch (queue: refund merge, protocol signing, fix/refund-pending-wording, partner onboarding). The text below is kept as what was sent |
| 13e | The run of 2026-10-10 | | Everything else built that day, its branches, boards and questions: `docs/audit-2026-10/RUN-2026-10-10.md`. 0070 amended before any apply to the engineer role only (admin stays optional, operator ruling 2026-10-10); staged chain 0068, 0069, 0070, 0071, 0072, in that order |
| 13a | Rulings of 2026-10-10 morning | | Order: engineer pay one home (`engineer-pay.ts`, productionFeeFor reads the tier; production eng_fee_schedule is EMPTY), then template published on signing (migration unapplied), then WP-001 v1.2 and FC-001 v1.0 transcriptions (migration unapplied), then the rest |
| 14 | Public site colours | | after the audit and the defects |

## For Aman (sent 2026-10-14 with FC-001 as item 6, answered the same day; see 13p)

Aman, a question about the five protocols below. Before the platform can put
them in force, it needs one more answer from you for each: which
engineering discipline the work under that protocol requires. For the roof
certification protocol you told us on September 21 that Structural Engineering
governs it, and the platform checks your declared competence against that
answer before a protocol goes in force. Could you state the required discipline
for each of these?

1. 254-MH-001, Manufactured Home Foundation Certification Protocol
2. 254-SL-001, Solar Structural Letter Protocol for Existing Roofs
3. 254-PL-001, Structural Letter Protocol for Permits
4. 254-RS-001, Repair Specification Protocol for Existing Structures
5. 254-DS-001, Structural Design Protocol for Residential and Light Commercial Work

A one line answer per protocol is enough, in your own words.

## Main

`origin/main` at dbe7507 (0068 merged as c14144f, 0069 as dcfe8af, 0070 as 446547d, 0071 as 3bb9cf7, 0072 as 730df43, the demo-audit fix as f828a56, item 9 as 1d34e75, item 10 as fb9ff42, 12.3 as e986da0, 0073 as dbe7507). Production has 0068 to 0073, all on main; 0074 staged on feat/partner-billing. Next: the overnight order of 2026-10-12, see docs/MORNING-2026-10-12.md, in order, on exact passes under the standing word. Dated not-yet-V10 list: **0**. The board has **61** audits and prints a transient retry count.

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
