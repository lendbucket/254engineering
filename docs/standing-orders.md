# Standing orders

The source of truth for the running loop. Robert, 2026-10-29: the loop prompt is one line, "Follow docs/standing-orders.md. Wake on board completion, not on a timer.", and this file holds everything else. It is kept current as items finish. CLAUDE.md stays as it is and still wins any conflict.

## How each wake runs

1. Read the board that woke the session: `gh run view <id> -R lendbucket/254engineering --json status,conclusion,headSha`, then the sealed logs. Also read the issue #1 comments since the last wake.
2. Act: merge on a match, repair on a miss. Then put the next item on its board.
3. Update this file: move the finished item to "Done", and mark the next one "Boarding" with its run id.
4. Write at most three lines to Robert.

**Pacing.**
- When a board starts, run `gh run watch <id> -R lendbucket/254engineering --exit-status` in the background, and let its completion wake the session.
- Schedule only one fallback wakeup of 7200 seconds, in case a board hangs.
- Do not poll.

## Queue, in board order

| # | Item | State |
| --- | --- | --- |
| 22 | List controls on five staff screens: people, do not contact, asked to be forgotten, insurance, credential review. The audit trail pages every event. People, do not contact and the audit trail export CSV. `feat/list-controls-2` at `97f4475`, on main `647fc18`, preflight GREEN. | **Held for Robert.** Board 40906332499 read 63 of 64; the one FAIL is perf `/coverage` LCP 3417 ms against 3400 ms (spread 125 ms). It is a public route the branch does not touch, and it passed on bundle 21's board. Question on issue #1. |
| 23 | WF-030 step 5: a delete button for a field capture while the file is in the field. The audit row goes into `deleteCapture` first. Built as `93866aa` on `feat/capture-delete`, preflight GREEN. Robert ruled yes to all three on 2026-10-29:
- a capture a repair was verified against is refused;
- the photograph stays in the evidence bucket, with its storage path in the audit row;
- the engineer and the administrator may delete, as they may capture. | **Reboarding, run 40930082505, on `c4225b0`.** The first board (40918058948) missed on a time printed with no zone; that is fixed. |
| P | The preflight runs every repo-wide static proof (`ci/preflight-static-proofs`), so a miss like bundle 23's is caught before the board. Built as `e14bea7`:
- 109 of 182 proofs are static, derived by `scripts/lib/proof-needs.mjs`.
- The preflight takes 91 to 98 s, up from 43 s.
- An injection named the file. Preflight GREEN, 37 rules. | Built; boards after the address bundle |
| 24 | WF-017 step 6: an engineer-only panel on `/portal/review` to withdraw or restore a technician's certification, with the reason required. | To build |
| 25 | List controls for `/portal/onboarding`: search, filter, sort, paging, counts over every matching row, and a failed read said. | To build |
| 26 | WF-022 step 3: an admin panel on `/portal/accounts` to set an account's credit terms. **This is a money flow: it gets its own proof and an injection.** It must: confirm by password re-entry, the same as the no-charge override, never an authenticator code (the owner's admin account uses none); write an audit row on every change. | To build |
| 27 | WF-024 step 3: a proving-charge button on `/portal/launch`, admin only. It states the charge before it runs, and is used only on Robert's word. | To build |
| 28 | WF-024 step 4: a waitlist "we are open" email button on `/portal/launch`. It is enabled only when the gate reads live and sends Robert a preview first. Never sent by a board or a probe. | To build |

| A | The San Antonio address and hours (Robert, 12:50 Central 2026-10-29): 11103 San Pedro Ave, San Antonio, TX 78216; (281) 940-4490, which matches `FIRM_PHONE`; Mon to Sun 8 AM to 8 PM Central; the brand stays "254 Engineering". One bundle covers the source of truth, footer, /contact, /press, schema and the pinned literals. Being built on `feat/sa-address`. **Robert, 13:11, replacing his 13:09 option 1: do NOT redirect `/corpus-christi`.** San Antonio is the primary name, address and phone for the footer, /contact, /press and the Organization schema. The address bundle merges on that basis. In this bundle, `/corpus-christi` loses its street address block and any Corpus Christi location in its schema, and keeps the San Antonio phone. The address bundle merges on a passing board. Robert changes Stripe's support address, TBPELS's mailing address and the GBP himself. | **Bundle 24, boarding** at `44988d7` |
| B | Robert 13:05, items 2 and 3, folded into bundle A:
- remove "254 Engineering Services" from every public page and add it to the banned-phrase check;
- closed-for-business sentences only where the gate per line is really closed. | Building |
| C | Robert 13:05, item 4: the square favicon set and a square Organization logo, on `feat/favicon`. The 48 px and 192 px images go on issue #1 for his approval before merge. **Robert 13:09: the corrected held logo** (`hold/logo-254-engineering`, `bf391d6`). Post both renders on issue #1 for comparison before it merges. | Building |
| F | Robert 13:11, item 2: highlight Corpus Christi. `/corpus-christi` stays live and in the sitemap, and is linked from the home page, the main navigation and `/coverage`. It presents the firm as serving Corpus Christi and the Coastal Bend now, with the San Antonio phone. Until Robert gives the address, it prints no street address, claims no office, and its schema carries no Corpus Christi location. **The revised copy is proposed on issue #1 before it boards.** | Proposal first |
| G | Robert 13:11, item 3: the San Antonio location page, the firm's location page, with its outline and sources on issue #1 first. CLAUDE.md section 2 is amended in the same bundle: the location page rule covers the firm's open offices with a real address, plus Corpus Christi as a highlighted market until its address is set. | Proposal first |
| D | Robert 13:05, item 5: the GBP link goes into `sameAs` only after Robert says the profile is verified. | Waiting on Robert |
| E | Robert 13:05, item 6: `/guides` and four articles, one per board, then San Antonio. The section 8 proposal is being drafted. **Robert 13:09:**
- Post the research proposal for his yes.
- The foundation article is written for Texas foundations generally, with San Antonio's permit facts as the example.
- The San Antonio location page's outline and sources are proposed on issue #1 before it is written. | Proposal first |

Source of 23 to 28: Robert, 10:52 Central 2026-10-29, issue #1 comment 6501552714.

## Ruled, nothing to build

- The six overnight decisions of the morning report (6493300958) are confirmed as they stand:
  - the onboarding invite emailed by default;
  - the WF-007 step 4 map wording;
  - superseded accounts left out of "all";
  - the CSV exports gated on `accounts.manage`;
  - the board runs the preflight first;
  - a preflight "could not tell" does not stop the board.
- WF-021 step 4: releasing a sign-in lock stays off screen, behind the operator's token.
- WF-006 step 2: a request to be forgotten stays taken by staff.
- No CSV export for the forget list until counsel rules.
- No list controls on orders, the job queue, waiting, technician jobs or messages.
- No re-sorting or filtering on `/portal/review`. Its order is what the engineer reviews first.

## Waiting on Robert, do not build

- The office address change for the Google Business Profile.
- Whether a `--no-ff` merge whose tree matches its boarded branch should also skip the board. The 2026-10-22 ruling says same commit only. Recommendation: keep it that way.

## Done (newest first)

| Bundle | Merge | Board |
| --- | --- | --- |
| 21, undefined portal tokens | `647fc18` | 40895736424 |
| 20, a green commit is not boarded twice | `2c29803` | 40881396384 |
| 19, token-audit reads every portal file | `a23dc9f` | 40870134329 |
| 18, copy-project's bucket list from the chain | `fae1331` | 40859705400 |
| 17, the board runs the preflight first | `a902e22` | 40851638472 |
| 16, W3 round 2 | `4d7e537` | 40842438078 |
| 15, CSV exports on six staff lists | `417bdfa` | 40825157227 |
| 14, superseded accounts hidden | `da6d165` | 40817335866 |
| 13, the preflight | `8a5bbb7` | 40809554227 |
| 12, the walk's records | `f897936` | 40801619224 |

## EVERY BUNDLE

1. Built from main, in its own worktree with no environment file.
2. `node scripts/preflight.mjs` GREEN. Every prediction states the preflight result, and no bundle boards on a red preflight.
3. The prediction is pushed to `docs/day-queue.md` on ops/day with `[skip ci]` BEFORE the board.
4. Board: push the branch, then `gh workflow run board.yml --ref <branch>` when the head carries `[skip ci]`. Then `gh run watch` in the background.
5. Read the sealed logs (`scripts/ci/seal.mjs open` with `C:/Users/salon/.254-ci/log-key.pem`). Tally with `scripts/ci/board-verdict.mjs` run from the bundle's own worktree.
6. **On a match:**
   - confirm `origin/main` has not moved;
   - `git merge --no-ff` with `[skip ci]`;
   - `git -C C:/Users/salon/projects/254engineering push origin main`;
   - `ls-remote`;
   - a short status on issue #1.
7. **On a miss:** read the sealed log, repair the cause, prove it with an injection, bring the branch up to main, and board again. Never re-run an unchanged commit.
8. While a board runs, build the next bundle in its own worktree. Forks are allowed, local only.
9. **Every fork brief says: no push, no merge, no board dispatch. The parent session does all three.** (Robert, 2026-10-29, after a fork planned to merge on its own.)
10. One board at a time.

## MIGRATIONS

- No drop shapes unless the drop is the point.
- Every new `eng_` table and serial sequence revokes from public, anon and authenticated in its own file.
- Stage each migration on its own `stage/` branch with an empty `[skip ci]` commit. Staging branches are never rewritten; use a new name.
- Post it on issue #1 with:
  - the path and sha256;
  - the predicted shape and column count;
  - Section 0 and the read-back.
- The chat sits development from the stage branch, and production only from a passed board's boarded commit.
- Merge only after the production read-back. Record the version in `supabase/applied.mjs`.

## RULES

**Process:**
- `[skip ci]` on every queue and merge commit.
- A change to a Robert ruling is asked before it is built.
- Never loosen a check.
- Write anything that needs Robert as one question with a recommendation, and keep going on whatever does not depend on it.

**Writing:**
- No long dashes and no AI-tell words.
- US spelling.
- "254 Engineering".
- No Aman name or license on public pages.

**People and accounts:**
- Never suggest enrolling Robert's own accounts in a second factor.
- No email or SMS to real people.
- Never use Aman's account.
- Never paste secrets.

**Git and databases:**
- No force push and no branch deletion.
- No production writes from this machine.
- Never sign in to Vercel or Supabase.
- Never run `vercel dev` or `vercel env pull`.
- No local writer audits.

**The machine:**
- Never lower the 12 GB memory floor.
- Never set `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP`.

## MORNING REPORT

By 06:30 Central, at the top of `docs/day-queue.md` on ops/day, and also posted on issue #1. It holds:
- what merged, with commits;
- migrations, with versions;
- what is boarding;
- what missed and why;
- every item that needs Robert, with a recommendation;
- anything decided overnight, under "decided overnight, Robert to confirm";
- the next five items.
