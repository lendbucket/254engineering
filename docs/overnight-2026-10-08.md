# The overnight run, 2026-10-07 into 2026-10-08

Progress notes at 01:00, 03:00 and 05:00 Central, and the final report at 06:30.
Times are Central (UTC minus 5).

## 00:42, the 01:00 note, written 18 minutes early

Written early because the next board would otherwise be running at 01:00, and a
board gets no tool calls of any kind.

**Item 1, certification recording: built.** An administrator records supervised
training on the technician's page; it counts for dispatch only when the engineer
of record approves it from his own session on the review screen. Proved both
ways on development, 22 checks. Stored as audit events, no migration: interim
decision 1 in `docs/rulings-2026-10-06.md` section 9.

**Item 2, the board of the credentials work, the People fix and certification
recording: not yet merged.**

| Board | Commit | Predicted | Result |
| --- | --- | --- | --- |
| 1 | `531426b` | 59 of 59 | **57 of 59.** db-guard-audit (an undeclared machine clock read in the certification module) and native-audit (the roster's new name link showed nothing while pressed). Both fixed in `36ecff0`. |
| 2 | `36ecff0` | 59 of 59 | **58 of 59.** native-audit again, the same link. The pressed style was there; a long name wraps, and the centre of a wrapped inline link's box falls between its two lines, on the paragraph. Confirmed on a running server before the fix: with the link one box, each press dims it from 1 to 0.7. |
| 3 | next | 59 of 59 | |

**Item 3, the seven protocols: built and staged, not boarded yet.**
`feat/protocols-v1-1` carries 0065, seven draft rows with each PDF's digest,
generated and proved against the generator, with
`docs/production-sitting-2026-10-08.md` for the counterpart. It opens no line.
The conflict report's catalogue and intake changes were already on main; items
13 and 25 stay referred as money rulings.

**Item 4, V10: started.** The layout check is written on `feat/v10-shell` and has
not yet run against a server; its frozen list must come from a measurement.

**The machine lock** was held by dispatch-scheduling and wattsmith from 22:36 to
23:58, and taken back within a second of being released once. The first board
queued on it rather than lose the slot again.
