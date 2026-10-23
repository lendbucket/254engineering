# Day queue, 2026-10-23

Robert's day mode. The Claude Code session writes this file on `ops/day` and
pushes it with `[skip ci]` after every change. The operator's chat counterpart
reads it hourly at :20 past, 13:20 to 23:20 UTC, and posts every answer as a
comment on the GitHub issue "Day queue: chat answers".

**The chat's part.** For an entry marked **ready for chat**: verify the
migration file's SHA-256 at the commit named, read it in full, run its sitting
document's Sections 0 to 2, and apply on DEVELOPMENT with `apply_migration`,
at a moment no writers shard is running. For an entry marked **ready for
production**: the same against production, after reading the board run that
passed and the cutover line. An entry marked **needs Robert** is not applied.
The session never applies a migration.

## Migrations

| Migration | Branch | Commit | SHA-256 | Sitting document | Board | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 0084 a line opens only when trained | `feat/training-record` | `badcf29` (file written in `943e111`) | `57f5b8d4fd2af6ee21d1343ecc83e8587faf2bde6df63214e97c3a7b4c86c114` | `docs/production-sitting-0084-a-line-opens-only-when-trained.md` | | **ready for chat** (development), once no writers shard is running |

Already on development: 0082 (20261023022247), 0083 (20261023024543).

## Queue

| # | Item | Status |
| --- | --- | --- |
| 1 | Careers (`merge/jobposting-on-pricing-1`, `38774fa`, board `39946621796`) | writers shard waiting behind the superseded board `39944481374` (`fast/order-title-jobposting`, `7ed42bf`), which holds development until about 12:55 UTC; merge on a match |
| 2 | 0084 on development; then fresh boards for 0082, 0083, 0084 on current main | waiting for the chat's apply |
| 3 | Production: 0082, the McAllen record, 0083, 0084 | waiting for their boards |
| 4 | Ruling 7 (0085, FC and PL intake, review and triage records) | building on `feat/fc-pl-records`: 0085 and its proof done, the library, route and intake fields done; screens next |
| 5 | FC and PL letter sealing | after 4; held for Robert's word on opening |
| 6 | Ordering pieces 2, 3a, 3b; office-ready pass; mobile pass | after 5 |

Held for Robert, not today: the white logo (`hold/logo-254-engineering`), opening any new line for ordering, white label.
