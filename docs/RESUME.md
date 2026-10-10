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
| 12 | Defect fixes, no migration | `integrate/2026-10-10b` (15 branches: offer-needs-a-rate, partner-window-copy, dates-in-central, customer-sign-in-limit, credential-form-offline, mfa-no-replace-from-password, review-belongs-to-its-engineer, pay-owed-one-home, refund-reason-per-order, mfa-sign-out, waiting-links, launch-sellable-needs-the-gate, engineer-dead-links, csr-most-recent, partner-true-totals) | **WAITING ON THE MACHINE LOCK** (held by wattsmith since 04:42Z). Next: the MFA reproduction on main, the importing audits standalone, then the board; prediction 61 of 61. If it fails: split, never debug together |
| 13 | Two tabs, two pending credentials | `fix/credential-one-pending` at 080fedc, migration 0067 | **STAGED, NOT MERGED**: 0067 written unapplied; docs/production-sitting-2026-10-10.md |
| 14 | Public site colours | | after the audit and the defects |

## Main

`origin/main` at d282d5a (integrate/2026-10-10 merged). Dated not-yet-V10 list: **0**. The board has **61** audits and prints a transient retry count.

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
