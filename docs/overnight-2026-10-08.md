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

## 02:15, the 03:00 note, written 45 minutes early

Written early for the same reason: the V10 board would be running at 03:00.

**Item 2: MERGED.** Board 3 on `6d21cf4` returned **59 of 59**, exactly its
prediction. `origin/main` confirmed unmoved at `7710037`; merged as
**`1e13dd0`** (parents `7710037`, `6d21cf4`), pushed, `git ls-remote` reads
`1e13dd0a0eb5cce1bc3200ba2bf5afce0e81c1d8`. That carries the credentials
screen, coverage counties, the People linked-login fix and certification
recording.

**Item 4, V10: built to the engineer screens, boarding next.** On
`feat/v10-shell` at `8354689`, brought up to main:

- The layout check, measuring the rendered page. **Proven red on today's
  `/portal/profile`** on the pre-restyle code: 125 corners, 97 monospace
  elements (the permission tags), 110 boxes (the cards).
- Its frozen original list was measured, not guessed: 64 routes failed before
  any restyle. Measured on `8354689`: **28 pass, 38 still listed**.
- The shell (navy top bar, gold rule, white rail), the shared pieces, and the
  engineer screens: review queue and review, held before dispatch, sealing,
  protocols and signing, profile, seal upload, two-step setup and challenge,
  sign in and set password.

**Screenshot verdicts**, at 390 and 1280, read against `docs/design-v10/screens`:

| Screen | 1280 | 390 |
| --- | --- | --- |
| Review queue (V10E-queue) | Matches the structure: navy bar and gold rule, white rail with the gold marker, the held-before-dispatch section under its 2px rule, the queue as ruled rows. Differs: the queue is a plain list rather than the drawing's table with "Automatic checks" columns, a content difference V10 does not ask this pass to make. | Bar, rule and bottom tabs match. **Differs: sections sit on the grey ground, where V10 draws white sections on grey.** |
| Profile | Matches: sections with 2px ink rules, details as ruled rows, the permissions as plain names in two columns, square button. | Not read in this pass. |
| Protocols and signing | Matches: each protocol for his signature as a ruled block, square buttons; the list as ruled rows. The status words are plain text. | Not read in this pass. |

**One deviation I am not claiming as fixed.** The captures above predate one
change: the desktop page ground is now white, as V10 rule 6 says. The same
change makes the phone white throughout, which is not rule 7's grey ground
behind white sections either. It is open and recorded.

**Lint**: four "setState in an effect" errors in `PortalChrome.tsx` and
`Sheet.tsx` are pre-existing: the same counts on main's versions of both files.

## 04:37, the 05:00 note, written 23 minutes early

**The V10 board on `0e68723` returned 58 of 60 against a prediction of 60.** It
waited about two hours on the machine lock first. Both misses were mine:
`v10-layout-audit` had no npm script, so the suite could not run it at all (a
check never run through the path the board uses), and its two switches were
undeclared environment values (`soc2-audit`). Fixed in `a75e219`; re-boarding
now, predicted 60 of 60. If it passes, V10 merges under the standing word.

**Not reached tonight:** item 5 (technician, admin and customer V10) and item 6
(the approval-backed screens). Item 3's branch, `feat/protocols-v1-1`, is built
and staged but has had no board: the lock allowed three boards in eight hours.
