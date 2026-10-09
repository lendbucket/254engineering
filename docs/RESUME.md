# Resume note, overnight 2026-10-08 into 2026-10-09

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
| 6 | Product audit | | **NOT STARTED, by the run's own condition**: it starts when the list is at zero, and /portal/techs waits on decision 1 (the map legend) |

## Main

`origin/main` at 62d3133 (feat/v10-partner merged). Dated not-yet-V10 list: **1** (/portal/techs). The board has **61** audits since dashboard-speed-audit joined.

## Worktrees

- `C:/Users/salon/projects/254engineering`: main, next fix/admin-dashboard-speed
- `C:/Users/salon/projects/254engineering-v10`: feat/v10-admin-ops
- `C:/Users/salon/projects/254engineering-tdi`: fix/machine-lock-env
- `C:/Users/salon/projects/254engineering-audit`: docs/product-audit-2026-10 (this file)

## Open decisions

Two, both in GAPS.md under "Decisions list": the map legend on /portal/techs, and the cover verb after a singular name.

## Things a resumed session must know

- The machine lock: launch only when `C:/Users/salon/.test-lock` is ABSENT, and
  read it after launching to confirm it names our pid. Until 1771eb1 merges, any
  script that loads .env.local before taking the lock skips it silently. The
  board is not affected.
- The first dashboard timing (12 to 16 ms response) did not record what page it
  measured and is not trusted; the measuring mode now records the final URL and
  the heading.
