# Resume note, overnight 2026-10-08 into 2026-10-09

Updated after every merge. Read this first after a restart; it is the queue
position, not the reasoning (that is in GAPS.md and the commit messages).

## Queue position

| # | Item | Branch | State |
| --- | --- | --- | --- |
| 1 | What a customer receives quotes a signed protocol | `fix/receive-quotes-protocol` at 50e61ca | **MERGED as bce1a41**, board 60 of 60. Carried fix/doors-probe-teardown (92786d7), whose stranded probe order failed the first board 58 of 60 |
| 1a | The machine lock skips itself when .env.local carries VERCEL | `fix/machine-lock-env` at 1771eb1 (worktree 254engineering-tdi) | committed, NOT pushed, proof not yet run (it runs from the main checkout) |
| 2 | Admin dashboard speed | `fix/admin-dashboard-speed` | not started; first measurement suspect (see below) |
| 3 | V10 admin-ops | `feat/v10-admin-ops` at ce1224f (worktree 254engineering-v10) | carried rulings and the nine screens edited, token-audit 113 of 113; committed as WIP; not measured rendered |
| 4 | V10 admin-accounts | | not started |
| 5 | V10 partner | | not started |
| 6 | Product audit | | not started |

## Main

`origin/main` at bce1a41 (fix/receive-quotes-protocol merged). Dated not-yet-V10 list: **19**.

## Worktrees

- `C:/Users/salon/projects/254engineering`: main, next fix/admin-dashboard-speed
- `C:/Users/salon/projects/254engineering-v10`: feat/v10-admin-ops
- `C:/Users/salon/projects/254engineering-tdi`: fix/machine-lock-env
- `C:/Users/salon/projects/254engineering-audit`: docs/product-audit-2026-10 (this file)

## Open decisions

None taken overnight. See GAPS.md, decisions list.

## Things a resumed session must know

- The machine lock: launch only when `C:/Users/salon/.test-lock` is ABSENT, and
  read it after launching to confirm it names our pid. Until 1771eb1 merges, any
  script that loads .env.local before taking the lock skips it silently. The
  board is not affected.
- The first dashboard timing (12 to 16 ms response) did not record what page it
  measured and is not trusted; the measuring mode now records the final URL and
  the heading.
