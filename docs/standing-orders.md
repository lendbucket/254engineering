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

## Tonight's queue, in board order (Robert, 22:12 Central 2026-10-29)

| # | Item | State |
| --- | --- | --- |
| 1 | **Bundle 28, the credit terms panel**, a money flow confirmed by password re-entry (`feat/credit-terms`). Merge on a match. | Board 40990127640 on `a267eb8` read 63 of 64. The one FAIL is perf `/coverage/coastal-bend` LCP 3402 ms against 3400 ms (spread 234 ms), on a public route the branch does not touch. Under Robert's 22:12 rule for bundle 22 there is no merge on a red board. It is re-boarded on a new commit brought up to main after item 2 merges. |
| 2 | **The preflight's US spelling check** (`ci/preflight-us-spelling`). One shared list, `scripts/lib/us-spelling.mjs`, covering 635 written-copy files. | Preflight GREEN, 38 rules, at `588e5d6` on main `ed779ae`. **Boarding next.** |
| 3 | **Bundle 22 re-boarded on main.** List controls on five staff screens; the audit trail pages every event. Robert: "no merge on that red board. Bring it up to main and board the new commit; merge if it passes." | To board |
| 4 | **The favicon set** (`feat/favicon`, `ab0a58f`), drawn from the held corrected logo. Robert: "yes, merge as shown". | To board |
| 5 | **The `/corpus-christi` revision**, as proposed (6504744447), with the gate-derived verb and the H1 "Corpus Christi Engineering for the Coastal Bend". It stays live and highlighted, is never replaced or redirected, and prints no street address until Robert gives one. Recommendations taken: the plain "The firm's office is in San Antonio", the home page chip, and "serves" only once the gate reads trading. Built as `f295c3c`:
- the verb comes from `servesVerb()`;
- four links in;
- the schema carries only the breadcrumb;
- preflight GREEN.

**For the board:** the main navigation now has nine items. It is computed to fit at 1280; nothing measures 1024 to 1150, where the bar may overflow. | Built |
| 6 | **The `/san-antonio` location page**, as proposed (6504744856), with the H1 "San Antonio Engineering Firm: 254 Engineering's Office", and the CLAUDE.md section 2 wording in the same bundle. Robert took all four recommendations: the route `/san-antonio`; the code edition described generally; IB224 only; the section 2 wording as written. It is added alongside `/corpus-christi`, not in place of it. Built as `35a8596`, preflight GREEN.
- **Read in full and cited:** Chapter 10, IB224, and 30 TAC 213 for Bexar in the Edwards program.
- **Dropped, for want of a source read in full:** the Houston Black soil under the city, "county seat", the courthouse, and the map viewer.
- **Links in:** `/press` and `/contact`.
- **Schema:** the breadcrumb only.
- **CLAUDE.md:** section 2 replaced word for word. | Built |
| 7 | **`/coverage` well under 3400 ms without raising the ceiling.** Profile what it loads, and make static or defer what can be. | To build |
| 8 | **The WPI-8 process details** added to `/insights/wpi-8-certificate` (article proposal item 2). | To build |
| 9 | **The articles, one per board, under `/insights`, with `/guides` as their index:** the manufactured home article, then the solar article, then the foundation article ("what a Texas foundation letter says and what a city does with it", with San Antonio's bulletin as the example). **Every HUD, San Antonio, VA and USDA source is read before it is cited; anything not read is not cited.** | To build |
| 10 | **The remaining 10:52 rulings on `/portal/launch`:** the proving charge button (admin only, states the charge before it runs, used only on Robert's word) and the waitlist "we are open" button (enabled only when the gate reads live, preview to Robert first, never sent by a board or a probe). | To build |
| 11 | If the queue empties: BACKLOG items that need no ruling, smallest first. | |

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
- **Robert, 13:11:** San Antonio is the primary name, address and phone. `/corpus-christi` stays live as a highlighted market, with no street address, until Robert gives one.
- **Robert, 22:12:** a red board does not merge, including a perf miss on a route the branch does not touch. The branch is brought up to main and boarded on the new commit.

## Waiting on Robert, do not build

- The GBP link goes into Organization `sameAs` only after Robert says the profile is verified.
- Whether a `--no-ff` merge whose tree matches its boarded branch should also skip the board. The 2026-10-22 ruling says same commit only. Recommendation: keep it that way.
- **Open questions from built work, each with a recommendation:**
  - Certification withdraw still accepts a record that is not certified. Recommend keeping it, because that behavior is unchanged.
  - "Applications not yet invited" on onboarding stays bounded at the newest 200. Recommend keeping it bounded.
  - Every administrator confirms a terms change with a password, not only the owner. Recommend yes, as built.

## Done (newest first)

| Bundle | Merge | Board |
| --- | --- | --- |
| 27, onboarding list controls | `ed779ae` | 40984065455 |
| 26, the certification panel on `/portal/review` | `ba7a8e4` | 40977483013 |
| 25, the preflight runs the static proofs | `00e66a0` | 40960219426 |
| 24, the San Antonio name, address, phone and hours | `da81f0a` | 40951053748 |
| 23, the capture delete button | `a190a10` | 40930082505 |
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
7. **On a miss:** read the sealed log, repair the cause, prove it with an injection, bring the branch up to main, and board again. Never re-run an unchanged commit. A red board never merges (Robert, 22:12).
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
- what missed and why;
- every item that needs Robert, with a recommendation;
- anything decided overnight, under "decided overnight, Robert to confirm";
- the next five items.
