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

## Round 3, in board order (Robert, 2026-11-01 morning)

1. **Item 7:** merge if green, per standing orders. Then post the morning report on issue #1 accounting for every item queued on 2026-10-31: AVIF, item 15, and GEO items 1 to 8. For each, merged (commit, board, audits passed, live URL) or parked (why, the exact answer needed from Robert, a recommendation). Include `/coverage` and `/coverage/coastal-bend` from every board, and main's head from ls-remote.
2. **Round 3, after the report, one board per item.** Standing orders and content rules apply.
   - **a. `/coverage` headroom.** Both pages read 3,170 to 3,270 ms against 3,400. Target: under 3,000 ms on every board. Find the largest remaining cost on the LCP path (hero photo bytes, its sizes attribute, priority and preload, render-blocking CSS or fonts) and fix it. Report before and after readings. Do not raise the ceiling. (A font change comes to Robert first, ruling of 2026-10-31.)
   - **b. `/press`:** firm facts (legal name 254 Engineering LLC, TBPELS F-29811, offices, service lines, veteran owned as plain prose, never certified), logo files to download, media contact support@254engineering.com, and expert topics (Texas windstorm and WPI-8, foundations on expansive clay, solar structural review, manufactured home foundations for FHA). No engineer name.
   - **c. Partner badge:** a small SVG "Engineering by 254 Engineering" badge with copy-paste HTML linking to 254engineering.com, on a `/partners/badge` page. Plain link, no tracking script.
   - **d. Draft only, do not publish:** `/insights/texas-windstorm-certification-by-county`, covering the 14 first tier coastal counties, what TDI requires, and how to look up a certificate (TDI search for WPI-8 and WPI-8-E, TWIA lookup for WPI-8-C only), sourced and linked to TDI and TWIA pages actually read. Post the draft URL on issue #1 for Robert's review.
3. Questions never stop the queue: post on issue #1 with a recommendation, park the item, move to the next. Wake on board completion, not on a timer. When round 3 is done or every item is parked, post a short report on issue #1 and stop.

**Round 3 addition (Robert, 2026-11-01, from Search Console: 28 days, 11 clicks, 2.26K impressions, 0.5% CTR, average position 24.2; impressions rising; top queries buyer intent: wpi-8 certificate cost, foundation certification, windstorm inspection, structural engineer report, foundation inspection cost, truss certification letter, twia coverage, wpi-8, 5 year roof certification cost):**
   - **e. Titles and meta descriptions.** Every service page, and `/insights/wpi-8-certificate`, `/insights/texas-windstorm-inspections`, `/insights/texas-windstorm-certificate-lookup` and `/windstorm/twia-coverage`, gets a title that leads with the search phrase and, on service pages, the catalog price from `catalog.ts`, ending "| 254 Engineering", 60 characters or less where possible. Meta descriptions state the price, the turnaround wording from the catalog, and that a licensed Texas PE seals it. Preflight rule: a service page title price must equal `catalog.ts`.
   - **f. The cost guide** (`/insights/structural-inspection-cost-texas`) answers "WPI-8 certificate cost", "foundation inspection cost" and "roof certification cost", each under its own question H2 with the catalog price.
   - **g.** The four informational articles with the most impressions (`texas-pe-license-lookup`, `texas-engineering-firm-registration`, `texas-professional-services-procurement-act`, `texas-windstorm-certificate-lookup`) each get one short closing section linking to the matching service. No rewording of their existing text.
   - **Parked until Robert answers:** a truss certification letter page, and any "5 year roof certification" wording. Do not build either.

**Round 3 decisions (Robert, 2026-11-01, with Search Console findings his chat counterpart pulled, 100 queries with positions):**
   - **a: approved.** Serve the county map as a separate SVG file. County names stay in the HTML as the text list. This amends "keep the county map server rendered" for the drawing only.
   - **c: approved with the recommendation.** The badge carries "254 Engineering LLC, Firm F-29811" read from the register.
   - **d: approved to publish after three fixes.** Jefferson County shows Port Arthur under both Seaward and Inland I, so the Seaward entry reads "part of Port Arthur" with a note the way Corpus Christi is handled; a closing section links to `/services/windstorm-wpi-8` with the catalog price; "None listed" and the Corpus Christi treatment stay as recommended. Boards on its own.
   - **h, cannibalization (before item e's titles).** WPI-8 queries are split across up to six URLs ranking 45 to 80. One page per intent: hire or price a WPI-8, `/services/windstorm-wpi-8`; what a WPI-8 is, `/insights/wpi-8-certificate`; look one up, `/insights/texas-windstorm-certificate-lookup`; TWIA coverage and eligibility, `/windstorm/twia-coverage`. Compare `/insights/windstorm-certificate-of-compliance`, `/insights/windstorm-inspection-coastal-buyers` and `/insights/texas-windstorm-inspections` against the four owners. A duplicate is 301ed to its owner with any unique sourced facts folded into the owner; a distinct intent is kept with its title and H1 retargeted to it. **Post the mapping on issue #1, with the reason for each, before merging.**
   - **e, revised priority.** Titles and meta first on pages already ranking 4 to 25: `/insights/roof-certification-letter` (position 4; no truss wording until Robert confirms truss letters), `/services/structural-letters` ("engineering letter for permit", 11), `/insights/pre-purchase-home-inspection` (11.75), `/services/manufactured-home-foundation-certifications` ("manufactured home foundation inspectors texas", 14), `/insights/texas-windstorm-inspections` ("wind storm inspections", 14.5; skipped if h redirects it). Then the rest of e.
   - **i.** `/coverage/san-antonio` ranks 3.5 for "soil engineering san antonio". The firm offers no geotechnical engineering. Check the page makes no soil or geotechnical claim; where it mentions expansive clay, it is in the context of foundation inspections only.

**Round 3 answers (Robert, issue #1, 2026-11-01):**
1. **d: approved as recommended.** Fold the county zone table, with the Port Arthur fix and the WPI-8 price link, into `/windstorm/catastrophe-area`. No new URL. Keep its sources list.
2. **e descriptions: approved.** Descriptions state the price and "sealed by a licensed Texas PE"; the turnaround stays on the page.
3. **Solar title: approved,** "Solar Structural Letter, from $709 | 254 Engineering". This amends the 2026-10-31 solar ruling for the title and meta description only; scope text and wind uplift wording stay frozen.
4. **c badge: approved as recommended.** A text-only SVG, gate-aware wording, carrying "254 Engineering LLC, Firm F-29811".
5. **Keyword registry:** record the WPI-8 line change in `docs/day-queue.md` as a pending sync for the Sealed Engineering and StampMyPlans repos. Do not touch those repos from here.
6. **Manufactured home loans: FHA, VA and USDA** (Robert's answer to 6560030875, 2026-11-01): "The manufactured home foundation certification serves FHA, VA and USDA loans. Make the service page, catalog wording, llms.txt and JSON-LD say FHA, VA and USDA consistently." The 2026-10-30 "FHA only" ruling was scoped to the loans insight, until the VA and USDA handbooks are read; this answer names the four surfaces above and not that post, so the post stays FHA only. **Item j**, built on e: the catalog wording names the three programs, e's manufactured home description keeps them, and a proof holds all four surfaces to the same three.
7. **Item k, the loans insight gets VA and USDA, sourced** (Robert, 2026-11-01): read the VA Lenders Handbook (VA Pamphlet 26-7) chapter on manufactured homes and USDA HB-1-3555 on manufactured housing, from va.gov and rd.usda.gov, for their permanent foundation and engineer certification requirements. Add a section per program to `/insights/manufactured-home-foundation-certification-loans` stating only what those sources say, each linked, beside the existing FHA section. If either source does not address the foundation certification, say what it does require and stop there. Board it as item k after j. **This lifts the 2026-10-30 FHA-only hold for that post.** (On 2026-10-30 HB-1-3555 answered 403 and the VA handbook sat behind a JavaScript check; a source that cannot be read is not cited, and no bot check is worked around.)
8. **Item l, the load path to the masthead** (Robert's ruling on 6561831283, coastal-bend at 3,014 ms, 2026-11-01). Approved, and nothing else:
   - **Fonts:** change how fonts load, not which fonts or how they look. Same typefaces, weights and sizes. Allowed: self-host through next/font, subset to Latin, preload only the weights used above the fold, font-display swap or optional, remove unused weights. Prove no visual change with before and after screenshots of `/`, `/coverage` and one service page at phone and desktop width.
   - **Hero photo:** tighten its `sizes`, set fetchpriority high, serve a smaller phone variant. Same photo, same crop.
   - **CSS:** remove unused CSS, and inline critical CSS for the hero only.
   - Board it as item l after the current queue. Report before and after for `/coverage`, `/coverage/coastal-bend` and `/services/windstorm-wpi-8` across two boards.
   - **Robert, second ruling on l (2026-11-01): approved as built.** Screenshots are taken in the board on GitHub Actions, never locally: Playwright against the preview and current production, for `/`, `/coverage` and `/services/windstorm-wpi-8` at 390 and 1440 px, uploaded as board artifacts. Do not wait for local memory and do not lower the floor. **Full stylesheet inlining: wait for l's two boards; if coastal-bend is still over 3,000 ms, post the measured case on issue #1 and Robert decides.**
   - Built: `scripts/ci/screenshots.mjs` and a `screenshots` job in board.yml on dispatch input only (`-f screenshots=true -f after=none|build`). **The preview answers 302 to Vercel Authentication** and section 6 forbids a bypass secret, so asked (6562823861): recommendation, "after" is the run's own build under `next start`. Until answered, l boards with `after=none`, production shots only.
9. **WPI-8 guide height** (same ruling): nothing more goes on `/insights/wpi-8-certificate` until it is measured. If a future item needs space there, move content to the lookup guide or the service page instead. (g closes the lookup guide, not this one; checked.)
10. **Item k:** keep parked until the PDFs are attached. **Do not search for other copies.**
- Board order stands: b, a, h, e, i, f, g, one at a time. The e answers (2 and 3) join e before it boards; d and c board after g, then j, then k, then l (k parked does not hold l).

| Item | State |
| --- | --- |
| 7 | **Merged as `5b6a259`** (board 41314145201); morning report posted (6559831819) |
| b | **Merged as `cf59a77`** (board 41320517236) |
| a | **Merged as `0a01a5b`** (board 41326354068); `/coverage` 3,249 to 2,745, coastal-bend 3,237 to 3,103; posted (6561831283) |
| h | **Merged as `970ff56`** (board 41334970182); WPI-8 guide 15,880 px, 120 px under the ceiling |
| e | Boarding, 41340491179 on `d138781` (main `970ff56` merged in) |
| i | Built, `fix/sa-soil-scope` `91b58a5`, preflight GREEN |
| f | Built on e (first part), `seo/cost-guide` `ac0fd98`, preflight GREEN |
| g | Built on f, `seo/closing-links` `1b27854`, preflight GREEN |
| d | Built, `feat/catastrophe-zones` `dc40648`, preflight GREEN; boards after g |
| c | Built, `feat/partner-badge` `5538443`, preflight GREEN; boards after d |
| j | Built on e, `fix/mh-loan-programs` `e39c7f4`, preflight GREEN; boards after c |
| k | Parked: HB-1-3555 answers 403 on rd.usda.gov and VAP26-07 renders only behind JavaScript on KnowVA; asked for the two PDFs (6560997657). **Robert's answer (relayed 2026-11-01): both chapters are attached to his comment on issue #1; download them into `docs/sources/` on ops/day, read both in full, cite the official rd.usda.gov and va.gov addresses with each edition's date, build k with its proof, and do not use the LINC copy.** As of 17:03 UTC no such comment or attachment exists on issue #1 or anywhere in the repo; k builds the moment it appears |
| l | Approved as built; `perf/load-path` `6e6bbde` from `970ff56`, preflight GREEN: italic font not preloaded (proof, injection verified), screenshots job; hero photo and CSS split measured and left; boards after j, twice, dispatched with `-f screenshots=true` |
| truss letter, "5 year roof certification" | Parked by Robert, do not build |

## Tonight's queue, in board order (Robert, 22:12 Central 2026-10-29)

| # | Item | State |
| --- | --- | --- |
| 1 | **Bundle 28, the credit terms panel**, a money flow confirmed by password re-entry (`feat/credit-terms`). Merge on a match. | Board 40990127640 on `a267eb8` read 63 of 64. The one FAIL is perf `/coverage/coastal-bend` LCP 3402 ms against 3400 ms (spread 234 ms), on a public route the branch does not touch. Under Robert's 22:12 rule for bundle 22 there is no merge on a red board. **Merged as `cf94d65`** (board 41002078784). |
| 2 | **The preflight's US spelling check** (`ci/preflight-us-spelling`). One shared list, `scripts/lib/us-spelling.mjs`, covering 635 written-copy files. | **Merged as `1e16714`** (board 40996170450). |
| 3 | **Bundle 22 re-boarded on main.** List controls on five staff screens; the audit trail pages every event. Robert: "no merge on that red board. Bring it up to main and board the new commit; merge if it passes." | **Merged as `3975b96`** (board 41008700702) |
| 4 | **The favicon set** (`feat/favicon`, `ab0a58f`), drawn from the held corrected logo. Robert: "yes, merge as shown". | **Merged as `05dbb6a`** (board 41014921146) |
| 5 | **The `/corpus-christi` revision**, as proposed (6504744447), with the gate-derived verb and the H1 "Corpus Christi Engineering for the Coastal Bend". It stays live and highlighted, is never replaced or redirected, and prints no street address until Robert gives one. Recommendations taken: the plain "The firm's office is in San Antonio", the home page chip, and "serves" only once the gate reads trading. Built as `f295c3c`:
- the verb comes from `servesVerb()`;
- four links in;
- the schema carries only the breadcrumb;
- preflight GREEN.

**The navigation, measured on production:** nine items overran the bar by 47 px at 1024. The link padding now narrows, leaving at least 14 px spare from 1024 to 1440. | **Merged as `d011bba`** (board 41022947388) |
| 6 | **The `/san-antonio` location page**, as proposed (6504744856), with the H1 "San Antonio Engineering Firm: 254 Engineering's Office", and the CLAUDE.md section 2 wording in the same bundle. Robert took all four recommendations: the route `/san-antonio`; the code edition described generally; IB224 only; the section 2 wording as written. It is added alongside `/corpus-christi`, not in place of it. Built as `35a8596`, preflight GREEN.
- **Read in full and cited:** Chapter 10, IB224, and 30 TAC 213 for Bexar in the Edwards program.
- **Dropped, for want of a source read in full:** the Houston Black soil under the city, "county seat", the courthouse, and the map viewer.
- **Links in:** `/press` and `/contact`.
- **Schema:** the breadcrumb only.
- **CLAUDE.md:** section 2 replaced word for word. | **Merged as `9854131`** (board 41030775857) |
| 7 | **`/coverage` well under 3400 ms without raising the ceiling.** Profile what it loads, and make static or defer what can be. **Not met.** The LCP element is the masthead photo.
- `e7f4711` loads it eagerly at high priority, with a proof. The gain is within the run spread: `/coverage` went from 3251 to about 3180 ms, and coastal-bend from 3241 to 3168 to 3337 ms.
- What moves the region pages is the county map in the HTML (coastal-bend 3016 ms without it). That reverses Robert's 2026-09-07 decision.
- Two questions are on issue #1 (6521207420). Recommend no on the map, and yes to merging `e7f4711`. | Waiting on Robert |
| 8 | **The WPI-8 process details** added to `/insights/wpi-8-certificate` (article proposal item 2). | **Merged as `e248703`** (board 41040053857) |
| 9 | **The articles, one per board, under `/insights`, with `/guides` as their index:** the manufactured home article, then the solar article, then the foundation article ("what a Texas foundation letter says and what a city does with it", with San Antonio's bulletin as the example). **Every HUD, San Antonio, VA and USDA source is read before it is cited; anything not read is not cited.**
- **Manufactured home article and `/guides`:** built on `content/mh-article` (`d5dc677`), and **held.** The VA and USDA handbooks could not be read (a JavaScript bot check, and a 403), so the body states FHA only while the title names all three.
- **Question on issue #1:** Robert pastes the VA and USDA passages, or the article is retitled to FHA. Recommend the paste. - **Solar article:** merged as `4c292ab` (board 41058621423). The `/insights` hub now shows the newest twelve in full and the rest as a compact list (decided overnight, Robert to confirm).
- **Finding for Robert:** the solar letter service page says the letter does not calculate wind uplift, while Houston and Waxahachie, as published, ask for wind loads. The article says so plainly. Whether the service scope changes is Robert's to rule. | Manufactured home held; solar boarding |
| 10 | **The remaining 10:52 rulings on `/portal/launch`:** the proving charge button (admin only, states the charge before it runs, used only on Robert's word) and the waitlist "we are open" button (enabled only when the gate reads live, preview to Robert first, never sent by a board or a probe). Built as `4417544` on `feat/launch-buttons`, preflight GREEN.

- **The proving charge:** `runProvingCharge` wraps the existing `provingChargeBlockers` and `startProvingCheckout`. It runs these steps in order:
  1. the typed reference;
  2. the existing conditions;
  3. no probe account;
  4. the password;
  5. `proving_charge.started` written first;
  6. the checkout.

  It refuses a second charge.
- **The announcement:** `announcementBlockedReason` gates it on `isOpen()`. The preview goes only to `business.notificationEmail`. The send needs a preview of the same content hash, and goes through the existing queue-based `sendLaunchAnnouncement`, which skips suppressed addresses.
- **Injections:** four, each restored byte identical.
- **Question:** a send that fails partway is recorded as sent, so nobody is mailed twice, and anyone missed is resent by hand. Recommend keeping it. | **Merged as `2852892`** (board 41067718105) |
| 12 | **The "receives" placeholder (Robert, 09:28).** Every order deliverable whose protocol is in force says what the signed protocol delivers, taken from its own record. A check refuses the pre-signature text on any in-force line. Its own small bundle, next in the queue. | Built as `59b2b34`, preflight GREEN.
- **The six in-force lines** quote their protocol's section 11: WS, FC, MH, SL, PL and RS.
- **Ongoing and design** stay pending.
- **The check:** `scripts/lib/receives-check.mjs`, used by protocol-registry-audit and a static proof.
- **Robert 09:48: yes.** The windstorm page quotes the completed tier only until the addendum puts ongoing in force. **Merged as `694b79b`** (board 41090210363). |
| M | **The preflight checks every title and description** with seo-audit's own rules, which now live in `scripts/lib/metadata-rules.mjs`. Built as `e4d2fd4`: 84 checked, 0 not statically known, three injections. **Found:** `CTA_VERB` counts "call" inside "on-call" as a call to action, so a description can pass without one. Recorded; tightening it is its own small bundle. | **Merged as `764b4b5`** (board 41136495238) |
| H | **The height warning (Robert, 15:08: yes, a warning only).** mobile-overflow-audit names every public route within 1,000 px of the 16,000 px ceiling at 390. The verdict is unchanged. Built as `0695325`:
- `HEIGHT_WARNING_HEADROOM_PX = 1000`, decided by `nearCeiling()`;
- a static proof with two injections;
- `board-verdict.mjs` counts verdict files, not log lines;
- preflight GREEN. | **Board 41150373240 on `c892f84`: 63 of 64.** The warning worked: `/insights/wpi-8-certificate` 15,380 px, and pre-purchase 15,090 px. seo-audit failed on the job postings' `validThrough` 2026-11-30, now inside its 30-day window. That fails every board, main included. **Blocked on Robert** (job question). Re-board after the positions fix. |
| C2 | **`CTA_VERB` no longer counts a verb inside a hyphenated compound** (`ci/cta-word`, `e5eeb02`). "on-call" no longer passes as a call to action. All 86 titles and descriptions still pass; `/government` also ends "Read it here." Six matcher tests, one injection, preflight GREEN. | Built; boards after the job postings fix |
| J | **The job postings (blocks every board).** For each role in `data/positions.ts`, a new real `validThrough`, or `open: false`. Asked; recommend 2027-01-31 if still open. | **Waiting on Robert; boards first** |
| 15 | **"In force" read from the database (Robert, 09:48, later).** The scope sentence reads the live signed protocol record, as `lineIsSellable` does under ruling 11, so a voided signature drops it. To scope first: the pages are statically prerendered, so the read decides whether those pages become dynamic or the order flow alone reads it. | Queued |
| 13 | **The manufactured home article, FHA only (Robert, 09:26).** Title "FHA Manufactured Home Foundations in Texas | 254 Engineering" (60; the ruled wording runs 73). `/guides` is in the same branch. Preflight GREEN at `44a37dd`. | **Board 41109712078 on `b5d7ae6` read 64 of 64. Held for the title.**
- **Robert 15:08:** a 55 character title with no suffix. Asked, because seo-audit requires the suffix.
- **Robert 15:53:** "Manufactured Home Foundation Certification | 254 Engineering". Asked, because that is the service page's title and duplicates are refused (6533242185).
- **Robert 16:23, final:** the title is "FHA Mobile Home Foundation Requirements | 254 Engineering" (57). It targets the research search, and the service page keeps the certification title. The H1 is his full FHA phrase. **Merged as `f229723`** (board 41143149087). |
| 14 | **The masthead photo fix `e7f4711` (Robert, 09:26: yes).** | **Board 41118588757 on `576faec`: 63 of 64.** The miss was its own route: `/coverage/coastal-bend` LCP 3402 ms, spread 23 ms, every sample over. Not merged. **Robert 16:23: yes to the map first.** The map shrink boards, then the photo fix on top, and both merge on a passing board. |
| 14b | **The county map's markup shrunk, still server rendered** (`perf/map-markup`). Built as `70cd154`:
- markup 61,365 to 34,015 bytes;
- 0 pixels differ;
- map-markup-audit checks every county.

**LCP did not move:** coastal-bend 3,168 to 3,167 ms. The lead is that the LCP element is the prelaunch compliance paragraph, which is text. Asked Robert (6535822312) to add an LCP-element diagnostic line to perf-audit and board it alone. **Held**, with the photo fix, until the real fix. | Held |
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
- **Robert, 09:26 Central 2026-10-30:**
  1. The manufactured home article is retitled to FHA only ("FHA Manufactured Home Foundation Certification in Texas | 254 Engineering", with the H1 and description to match) and boarded now. VA and USDA come later as an update, once their sources are read. USDA's foundation rule is HB-1-3555 chapter 13, section 13.6, not chapter 12.
  2. `/coverage`: board and merge the masthead photo fix (`e7f4711`). Keep the county map server rendered.
  3. Confirmed: the navigation padding, and the compact `/insights` list.
  4. The four questions from built work are kept as built: certification withdraw, the onboarding bound, the password for every administrator, and the announcement sent once.
  5. Robert takes the solar letter scope to the engineer himself. **Until he says otherwise, do not promote solar letters for cities whose published submittal asks for wind loads.**
  6. Bring `/insights/wpi-8-certificate` under the height ceiling at 390 in its own small bundle. **Correction sent:** the last board measured it at 15,326 px, already 674 px under the 16,000 px ceiling. Its question is on issue #1.

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
4. **After every commit, confirm with `git rev-parse HEAD` that the branch head actually moved to the new commit, before pushing or dispatching a board.** (Robert, 2026-10-30, after a commit refused by the commit guard went unnoticed and run 41136208166 was dispatched on the unchanged commit.)
5. Board: push the branch, then `gh workflow run board.yml --ref <branch>` when the head carries `[skip ci]`. Confirm the run's `headSha` is the commit just made. Then `gh run watch` in the background.
6. Read the sealed logs (`scripts/ci/seal.mjs open` with `C:/Users/salon/.254-ci/log-key.pem`). Tally with `scripts/ci/board-verdict.mjs` run from the bundle's own worktree.
7. **On a match:**
   - confirm `origin/main` has not moved;
   - `git merge --no-ff` with `[skip ci]`, then `git rev-parse HEAD` to confirm the merge commit exists;
   - `git -C C:/Users/salon/projects/254engineering push origin main`;
   - `ls-remote`;
   - a short status on issue #1.
8. **On a miss:** read the sealed log, repair the cause, prove it with an injection, bring the branch up to main, and board again. Never re-run an unchanged commit. A red board never merges (Robert, 22:12).
9. While a board runs, build the next bundle in its own worktree. Forks are allowed, local only.
10. **Every fork brief says: no push, no merge, no board dispatch. The parent session does all three.** (Robert, 2026-10-29, after a fork planned to merge on its own.)
11. One board at a time.

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
