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
| 1 | Pricing board `39893229124`; merge on a match; confirm $709 roof live | running |
| 2 | Board 0082 and 0083 branches on current main; hold on a match | next |
| 3 | `feat/fc-pl-letters`: determination and sealing for FC-001 and PL-001; hold | queued |
| 4 | Training record migration; hold | queued |
| 5 | Fast lane: logo on site and email, "Services" out of staff email, JobPosting schema | queued |
