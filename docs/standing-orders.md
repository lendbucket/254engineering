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
   - Built: `scripts/ci/screenshots.mjs` and a `screenshots` job in board.yml on dispatch input only (`-f screenshots=true -f after=none|build`). **The preview answers 302 to Vercel Authentication** and section 6 forbids a bypass secret, so asked (6562823861). **Robert's answer: "after" from the board's own build of the branch, served inside the job; no bypass secret, section 6 stands; "before" stays on production.** l boards with `-f screenshots=true -f after=build`.
   - **SPEED MOVES TO THE FRONT (Robert, 2026-11-01, after e boarded).**
     1. Board l next, ahead of e's successors; then i, f, g, d, c, j.
     2. Site-wide speed survey, no code changes: mobile LCP, CLS, TBT on one page of every public template (home, a service page, an insights article, `/coverage`, a region page, a city coverage page, `/press`, `/partners/badge`, `/order` entry), three runs each, median. Post the table on issue #1 with the largest cost on each slow page's LCP path.
     3. Target: every public template under **2,500 ms** mobile LCP and CLS under **0.1**. Fix in order of search impressions: service pages, then insights, then coverage.
     4. Allowed without asking: remove unused JavaScript from public pages, lazy-load anything below the fold, defer non-critical third-party scripts (analytics after interaction or idle), preconnect only to origins used above the fold, and the font and photo changes already approved. Same look, same content.
     5. **Ask first:** inlining the full stylesheet, removing or replacing any third-party script, any visual change.
     6. Never raise a ceiling. Report before and after for each fix across two boards.
   - **ITEM m, GA4 (Robert, 2026-11-01).** Turn on Google Analytics 4 on public pages with the existing `NEXT_PUBLIC_GA_MEASUREMENT_ID`. First find out why it is set but not loading and report it on issue #1 (done, 6563216436: nothing has ever read it). Load through `next/script` `lazyOnload`, adding nothing to LCP or blocking time. Record page views and two events, order started (first step of /order) and order paid (the confirmation page). No analytics on /portal, /admin, /partner or /account. No cookie banner unless a check requires one. Prove with a board that LCP and TBT do not change on the surveyed pages. Board it after item l. **Asked (6563216436):** Q1 the privacy page paragraph; Q2 a repository variable carrying the ID so the board's build renders the tag.
9. **WPI-8 guide height** (same ruling): nothing more goes on `/insights/wpi-8-certificate` until it is measured. If a future item needs space there, move content to the lookup guide or the service page instead. (g closes the lookup guide, not this one; checked.)
10. **Item k:** keep parked until the PDFs are attached. **Do not search for other copies.**
- Board order stands: b, a, h, e, i, f, g, one at a time. The e answers (2 and 3) join e before it boards; d and c board after g, then j, then k, then l (k parked does not hold l).

| Item | State |
| --- | --- |
| 7 | **Merged as `5b6a259`** (board 41314145201); morning report posted (6559831819) |
| b | **Merged as `cf59a77`** (board 41320517236) |
| a | **Merged as `0a01a5b`** (board 41326354068); `/coverage` 3,249 to 2,745, coastal-bend 3,237 to 3,103; posted (6561831283) |
| h | **Merged as `970ff56`** (board 41334970182); WPI-8 guide 15,880 px, 120 px under the ceiling |
| e | **Merged as `a605060`** (board 41340491179) |
| l | **Merged as `c1fd530`** (board 41347983909); font 98 to 48 KB; `/coverage` 2,591 to 2,339, coastal-bend 3,100 to 2,642, service 3,039 to 2,675, home 2,742 to 2,584; screenshots identical apart from orderable lines (production database against development). Second reading on i's board |
| i | **Merged as `e8a6806`** (board 41354122919, 64 of 64; `/` missed my range on variance, merged on Robert's answer to 6565116449, miss in the merge message) |
| f | **Merged as `a07b25e`** (board 41362833959; the WPI-8 guide 15,880 to 15,856 px through `relatedReading()`, merged on Robert's yes, miss in the merge message) |
| g | Built on f, `seo/closing-links` `1b27854`, preflight GREEN |
| d | Built, `feat/catastrophe-zones` `dc40648`, preflight GREEN; boards after g |
| c | Built, `feat/partner-badge` `5538443`, preflight GREEN; boards after d |
| j | Built on e, `fix/mh-loan-programs` `e39c7f4`, preflight GREEN; boards after c |
| k | Parked: HB-1-3555 answers 403 on rd.usda.gov and VAP26-07 renders only behind JavaScript on KnowVA; asked for the two PDFs (6560997657). **Robert's answer (relayed 2026-11-01): both chapters are attached to his comment on issue #1; download them into `docs/sources/` on ops/day, read both in full, cite the official rd.usda.gov and va.gov addresses with each edition's date, build k with its proof, and do not use the LINC copy.** As of 17:03 UTC no such comment or attachment exists on issue #1 or anywhere in the repo; k builds the moment it appears |
| speed survey | **Posted (6563269468).** On production every measured template is under 2,500 ms and CLS 0.000 (home closest at 2,451); the board reads 500 to 1,000 ms slower (localhost profile). Largest shared costs: italic font preload (item l), header logo 51 KB raw (asked), a 72 KB chunk 22 to 29 KB unused (next) |
| n | Header mark at drawn size, `perf/header-mark` `4c6b1f5` from `970ff56`, preflight GREEN, proof byte-exact and injection verified; 52 to 22 KB light, 30 to 15 KB dark. **Boards only on Robert's word** (asked in 6563269468). The 72 KB chunk is the React DOM and Next runtime; its unused bytes are framework paths, nothing to remove |
| m | **Merged as `cd09409`** (board 41381816477, every line met). Production check posted (6569169362): LCP unchanged, TBT +1 to +6 ms inside variance, not reverted. Was: GA4, `feat/ga4` `c30be50`. Bundle 61 on `a01eb49` met every line. **Robert: Q1 yes; Q2 no repository variable, merge on a green board without the tag; after the production deploy, three production runs each on `/`, `/coverage/coastal-bend`, `/services/windstorm-wpi-8`, LCP and TBT posted beside today's; revert GA4 and tell him if either worsens beyond variance.** Queue after m: g, d, c, j, then k only if the PDFs arrive |
| truss letter, "5 year roof certification" | Parked by Robert, do not build |

## ROBERT'S ANSWERS, 2026-11-03 morning (relayed in session). Verbatim.

"Q9: bucket per audit on development only. The key comes from the harness, never from a request. Production keeps one bucket per address, unchanged. When Q9 merges, revert 2ad0d95 in the same merge.
Q8 order: 0118 boards after M2, accepted.
Q8c: I registered charge.dispute.created and charge.dispute.closed on the live endpoint, go ahead. (only after you actually add them in Stripe)
Review-request proof: seal one fixture file once and reuse it.
F9: yes, template v1.1, I will have Aman re-sign MH-001 and SL-001."

**How it reads.** Q9 is unparked: build the per audit bucket (development only, keyed by the harness, production unchanged), re-board Q9, and revert `2ad0d95` in Q9's merge. Q8b stays after M2. Q8c: `src/config/stripe-webhook.ts` is updated to the two events as a dated record of Robert's word; the parenthetical is read as the condition that they are actually on the endpoint, confirmed back to him before Q8c boards. The review-request proof's fixture changes to one sealed file reused across runs. F9 is unparked: template v1.1 with the protocol line, the engineer re-signs 254-MH-001 and 254-SL-001; until he does, letters seal as today.

## OVERNIGHT RULING (Robert, 2026-11-02), GOVERNS TONIGHT. Verbatim.

"Run until everything below is merged or parked, then post the morning report and stop. Follow docs/standing-orders.md. Record this on ops/day first.

ORDER
1. P2 (fourth board running). On green: post the production sitting request for 0108 on issue #1. The chat counterpart checks issue #1 at 12:15, 2:15, 4:15 and 6:15 AM Central and sits whatever has passed its board; merge P2 when its read-back is posted.
2. Then in this order, one board per item: Q1, Q2, Q3, Q4, Q7, Q9, Q10, Q11, Q12, Q13, Q14, then Q5 (0109 production sitting after its board), Q6 (0110 after its board), Q8, then the CRM R1 to R8 (request the development sittings for 0111 and 0112 on issue #1 before R1 boards, and each later CRM migration before its item), then the follow-ups (review request suppression, per-door counters, message search, F9), then M2 (0117), then the five low bundles.
3. While a board waits on a sitting, board the next code-only item whose branch does not depend on the unsat migration, if one exists; otherwise wait.

RULES
- One board at a time. Never re-run an unchanged commit. Never merge red. Never loosen a check or raise a ceiling. The green-board variance rule stands.
- A question never stops the queue: post it on issue #1 with your recommendation, park the item, take the next.
- A board that fails twice on new commits for the same item: park it.
- No production database writes, no email or SMS to real people, no force push, no branch deletion, no secrets in output, 12 GB memory floor. Migrations to development only on stage/ branches, and only through the counterpart's sittings.
- Content rules apply everywhere: no long dashes, no hyphens as sentence connectors, no AI-tell words, US spelling, "254 Engineering", no engineer name or license number on public pages.
- Wake on board completion, not on a timer.

MORNING REPORT (issue #1, then stop)
- Merged: item, commit, board, audits passed, live URL where public.
- Parked: item, why, the exact answer needed from Robert, your recommendation.
- Sittings done and sittings still owed, by migration number.
- /coverage, /coverage/coastal-bend, / and /services/windstorm-wpi-8 from the last board.
- Main's head from ls-remote."

**How it reads against the state at 2026-11-02 22:00 Central.** P2's fourth board passed (41568841308, 65 of 65) and the 0108 production sitting is already asked (6595054766). Development holds 0108's revokes, so a branch without P2's role table fails roles-audit; under item 3, Q1 to Q14 therefore board with P2's branch merged in while 0108 waits, and each merges after P2 does, with only the ledger commit between its boarded tree and its merge (the same shape as the P1, P3, P5 merge of 34599d9). F9 waits on Robert's template question (6594767802): parked until answered.

## OVERNIGHT RULING (Robert, 2026-11-01), superseded by the one above

Run until everything below is merged or parked, then post the morning report and stop.

**ORDER**
1. Finish the current queue: GA4 (then the production speed check with the tag live, reverting if LCP or TBT gets worse beyond variance), g, d, c, j.
2. Then the portal list, P1 to P10, in order: onboarding end to end, the seven-role permissions draft (post only, never apply), the training academy engine, review queue search/filter/sort, the evidence hash (development only), the sister ordering door behind its closed switch, the holiday calendar, the two exports, the mobile questions.

**RULES FOR TONIGHT**
- One board at a time. Never re-run an unchanged commit. Never merge red. Never loosen a check or raise a ceiling.
- The green board merge rule stands: a missed prediction line on a page the branch does not touch, bytes unchanged and under its ceiling, may merge with the miss recorded. Anything else stops the merge.
- A question never stops the queue: post it on issue #1 with a recommendation, park the item, take the next.
- A board that fails twice on new commits for the same item: park it and move on.
- Migrations: development only, on a stage/ branch, waiting for the chat counterpart's production sitting. No production database writes. No drop or delete shapes.
- Nothing that seals, prices, refunds or emails a real customer changes tonight beyond what P1 to P10 state. No email or SMS to real people; onboarding proofs use probe addresses.
- No force push, no branch deletion, no secrets in output. Keep the 12 GB memory floor; if memory is short, wait for the board rather than building locally.
- Content rules: no long dashes, no hyphens as sentence connectors, no AI-tell words, US spelling, "254 Engineering", no engineer name or license number on public pages.
- Wake on board completion, not on a timer.

**MORNING REPORT (issue #1, then stop):** merged (item, commit, board, audits passed, live URL where public); parked (item, why, the exact answer needed, recommendation); migrations waiting for a production sitting (file, branch, development read-back); the permissions draft link; speed for /, /coverage/coastal-bend and /services/windstorm-wpi-8 from the last board and from production with GA4 live; main's head from ls-remote.

**How this reads against the queue as it stands.** P1, P3 and P5 need their migrations on development, which the chat sits from the stage branches (asked in 6568178900); until then they cannot board green, so each is parked behind the sitting and the next item boards. P1 and P3 also carry questions to Robert (same comment); by "a question never stops the queue" they are parked until answered. P2 and P10 are posts, done. P6 is a docs-only record fix (fast lane). P7 is closed.

## ROBERT'S ANSWERS, 2026-11-02 morning (relayed in session, all as recommended)

- **P2 permissions (6567596115): approved with one addition.** engineer loses `clients.list`; read_only loses `pricing.read`, `billing.read`, `ledger.read_all` **and `clients.list`**; every CSV export moves to the admin export gate (option a), per his 2026-10-28 ruling "owner or admin only". The chat read production's `eng_role_grants` on 2026-11-02 and it matches the posted table. **Build it**: the revoke migration on a `stage/` branch for the counterpart's sitting, and roles-audit EXPECTED for all nine roles.
- **P1 counties (6568178900 Q1): yes, field technicians only.** P1 is built that way; no change.
- **P3 enrollment block (Q2): accepted; merge P3 after P1's walk.** Draft course 2 (ladder use and roof fall protection) from OSHA 29 CFR 1926 Subpart X and Subpart M, cited, marked "Awaiting Robert" for his approval.
- **P3 back doors (Q3): yes, keep both refused.** His own technician profile is untouched.
- **Item d (6570990439): yes, merge with both misses recorded.** Brought up to the current main and boarded on that tree first (a merge only from a boarded tree that includes main).
- **Item c (6572085510): link `/partners/badge` from the `/press` sentence only, remove it from the sitemap and mark it noindex. No footer link.**
- **P10 mobile (6567562093):** 1 deferred until a native app is needed; 2 yes, installable portal with offline start first; 3 yes, no sealing on the phone; 4 yes, field technician first; 5 yes, second factor required for technicians signing in on the app, except the owner's own account, which keeps its owner override; 6 yes, offers and returned evidence only. Recorded; nothing built for mobile tonight.
- **Development sitting for 0105, 0106, 0107 done (6578648098). Board P1, P3, P5 in order.**

**Board order from here:** P9 (running) → d (re-merged) → c (fixed) → P1 → P3 → P5 → P2. P1, P3, P5 and P2 carry migrations, so each is boarded and staged for a production sitting, not merged unattended.

**Robert, 2026-11-02 (relayed in session), P2's two single-record exports: keep both on their current gates.** The engineer's monthly responsible charge log is his own record; one file's evidence binder follows access to that file. P2 is built that way; no change. **Development sitting for 0108 done (6581087129).** Board order stands: c (running), P1, P3, P5, P2.

**Robert, 2026-11-02 (relayed in session): the chat restored the five grants on development (6581232441), so development matches main.** Board c, P1, P3, P5 as planned. **Before P2's board, tell the counterpart on issue #1** and it re-runs 0108's deletes on development; production sits 0108 after P2 passes. If any check objects to development's ledger recording 0108, post it on issue #1.

## AUDIT FIXES, Q1 TO Q14 (Robert, 2026-11-02, relayed in session)

The chat posted five audit files on issue #1: auth 6585008053, money 6585008424, field and seal 6585008833, office 6585009173, the live site REPORT 6585009543. Read in full 2026-11-02. **After P1, P3, P5 and P2 board, build these in this order, one board per item, standing orders apply, a question never stops the queue.** Verbatim:

- **Q1** field F1: evidence count. Count standing evidence (not revision_requested) and refuse a draft at zero. Re-check every live letter template's count line.
- **Q2** field F2 and F4: sign_upload loads the file through jobView, requires the assigned technician and an open status, uploads with upsert false; record_capture refuses a storage key that is not exactly fileId/captureId.ext and confirms the object exists.
- **Q3** field F3, F7, F16, F15: assigned technician guard on submitEvidence; acceptance only when status is needs_dispatch, withdraw offers when a file leaves needs_dispatch; refused and repairs_required close capture; evidence writes scoped to evidence.capture and the assigned technician.
- **Q4** field F8 and F12: foundation decline delivery. Let refused move to sealed under documents.seal, set delivered_at, run accruals; decide letters-instead from the FC-001 determination, refund otherwise.
- **Q5** field F5: migration on a stage branch: unique partial index on eng_profiles (license_number) where role = engineer; createAccount and eng_seal_act_check refuse a duplicate.
- **Q6** field F6, F13, F14, F10, F11: revoke withdraws offers and re-checks at acceptance; dispatch refuses when the protocol pin write fails; the self service check writes in_progress not certified; a trigger refuses sealed or delivered on eng_files without a live seal act (stage branch); transitionFile checks its row count.
- **Q7** money F1, F3, F4: single orders through refundableOn, capped at what is left; invoiceAccount writes account_id, runs creditDecision, calls acceptOnInvoice; exposure counts open and issued statements.
- **Q8** money F2, F5, F7, F8: refund row inserted pending before the Stripe call and matched by the webhook; expireCheckout skips when a newer session exists and a payment on a cancelled order raises a staff task; batch total recomputed from accepted members; unique (account_id, period) on eng_statements and unique order_id on statement lines (stage branch). Disputes (F10): dispute.created raises a task, dispute.closed lost records a refund row.
- **Q9** auth H1 and H2: success resets only the signed in identity, never the address bucket; documentUrl loads the document's file and applies canSeeFile.
- **Q10** auth M1, M3, M4: replacing a second factor from a full session requires a current code or the password; setPartnerPassword refuses a suspended user; verifyOwnPassword goes through takeLoginAttempt. **M2 session epoch: post the schema design on issue #1 for his ruling before building.**
- **Q11** office F1 and F2: set_tech_coverage action for the technician sheet; rate limit lead, design inquiry, windstorm inquiry and apply per address and IP, one acknowledgement per address per kind per day.
- **Q12** office F3, F5, F6, F8: Resend idempotency key per job; apply refuses a document path outside the applicant's own prefix; applications page signs links for ten minutes; setGrants becomes one SQL function (stage branch).
- **Q13** office F4, F7, F9, F10, F11, F12, F13: every failed read renders an error, never an empty state or a count; messages scoped in SQL before the limit; uninvited applications from a database query; error state copy says "a failed read, not an empty list".
- **Q14** website: remove the $995 figure from the five pages and llms-full until the line opens, saying ongoing construction is quoted; fix the cost guide sentence; replace "leverage"; remove the waitlist references from privacy and terms; https for the txrules links; add CSP report only, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and includeSubDomains; poweredByHeader false; server render the onboarding not found page; own titles for account login and 404.
- **Low findings: build after Q14 as one bundle per audit file, skipping any that touch a ruling. Post a report on issue #1 when Q1 to Q14 are merged or parked.**

**How it is built (my plan, not a ruling).** Code is built by forks on their own branches while boards run, stacked within a group so each item's branch carries the one before it (Q1, Q2, Q3, Q4 stacked from main; the money, auth, office and website groups likewise), and boarded strictly Q1 to Q14. Items carrying a migration (Q5, Q6's trigger, Q8's indexes, Q12's function) take the next numbers after 0108 (0109 onward) and must stack on P2's branch for contiguity, so they board after P2 and wait for production sittings with the P chain. Q2 overlaps P5 in `recordCapture` (P5 already hashes the object and refuses a foreign key prefix); resolved when the two meet. Forks never push, merge or dispatch.

## SALES CRM, R1 TO R8 (Robert, 2026-11-02, relayed in session)

**Build as items R1 to R8 after Q7 and before Q8.** One board per item, standing orders apply, a question never stops the queue; migrations to development on stage/ branches for the counterpart's sitting. Extend eng_prospects and the rep and ops_manager roles; do not start a second CRM beside the one that exists. Must work end to end in the real flow, intuitive on a phone and on a desk, nothing half built. Verbatim:

- **R1 Data model.** Companies and contacts (several people per company), vertical (roofer, solar, manufactured home dealer, foundation repair, real estate, lender, insurance agent, other), source and source record id, territory (county and region from the existing region map), owner, stage (new, attempted, connected, interested, account_opened, ordering, dormant, do_not_contact), score, next_action_at, tags, website, address with county, permit activity (count and last permit date), and a link to the converted account. Activities table for every call, email, note and stage change, written through the existing contact log. Unique on normalized (name, phone) and on (source, source record id).
- **R2 Import engine.** A job per source, scheduled, with a dry run that reports adds, merges and conflicts before writing: San Antonio, Corpus Christi, Houston, Dallas, Austin and Fort Worth open data building permits filtered to roofing, re-roof, solar and foundation repair work types, keyed by contractor name; TDLR electrical contractor license file; TDHCA manufactured housing licensee lists; TREC license data file for brokers and agents. Read each portal's terms before the first pull and record the URL and terms date in docs/crm-sources.md; skip any source whose terms forbid storage. Dedupe by normalized name, phone and address; merge keeps every source. CSV import (purchased lists) through the same dedupe. No Google Places data is stored; a Places lookup may enrich one record on demand with the 30 day cache rule.
- **R3 Call queue.** /portal/crm/queue: the next prospect by due next_action_at then score, filtered to the rep's territory and owner. One card: company, contacts with tap to call tel links, vertical script (one per vertical in src/content/crm-scripts.ts, drafted for my approval), permit activity, last three activities, the account's orders if converted. Outcomes: no answer, voicemail, callback (date and time), interested (opens account creation prefilled), not interested (reason), wrong number, do not call. Each outcome writes the activity, sets stage and next_action_at by the sequence, and loads the next card. Do-not-contact and the suppression list are checked before the card renders; calling hours 8 AM to 8 PM Central enforced on the screen.
- **R4 Pipeline and lists.** /portal/crm as a stage board with drag between stages (writes the stage change activity), and a list view with search, filters (vertical, territory, owner, source, stage, score range, last activity), sort, pagination, saved views per person, bulk assign and bulk tag. Company page with the full timeline, contacts, notes with mentions through the existing threads, documents sent, and the linked account.
- **R5 Territories and assignment.** Territories by county grouped into regions; a rep holds one or more; new imports assign round robin within the territory; ops_manager and admin reassign singly or in bulk; a rep sees only their own and unassigned in their territory, managers see all.
- **R6 Account management.** For prospects converted to accounts: last order date, days since, orders this quarter, lifetime revenue, a reorder reminder at the account's own average interval, a check-in task every 90 days, a churn flag at 90 days quiet. Account manager view lists accounts by risk.
- **R7 Sequences and email.** A default sequence per vertical (call day 1, email day 2, call day 5, email day 9, call day 14, then dormant) that creates the next task on each outcome; email templates per vertical with the unsubscribe link, From and Reply-To rules, suppression consulted, one send per address per day; a reply to any email lands in the existing inbox linked to the company.
- **R8 Manager dashboard and attribution.** /portal/crm/reports: dials, connects, interested, accounts opened, orders and revenue attributed, per rep per day, week and month; conversion by source and vertical; a leaderboard; CSV export on the admin export gate. Attribution chain prospect to account to order written on conversion and on each order.
- **Grants:** crm.use for queue, board, lists and company pages; crm.import and crm.assign for admin and ops_manager; crm.reports for admin and ops_manager; reps see no revenue figures beyond their own attributed orders. Add every new grant to roles-audit EXPECTED for all nine roles. **Post the scripts, the source terms table and the sequence timings on issue #1 for his approval before R3 and R7 merge.**

**Board order now:** P5 (running), P2, Q1 to Q7, R1 to R8, Q8 to Q14, then the low findings. Migration numbers follow board order after 0108 (Q5, Q6, the R items, Q8, Q12), each stacked on the one before for contiguity; none merges without its production sitting.

## ROBERT'S RULINGS, 2026-11-02 afternoon (relayed in session), verbatim in substance

- **Auth M2 (6586517364):** option A, rollout 1, built after Q14. **Per-door attempt counters:** yes, follow-up after Q14.
- **Q14 (6586655667):** 1a, keep the waitlist sentences until /waitlist is retired. 2: accept 200 with noindex.
- **Q7 (6586714607):** keep both as built; the label "On statements, unpaid" is accepted.
- **Q4 (6586834020):** 1 suppress the review request on a decline, as a follow-up. 2 keep as built; Q6 boards right after.
- **Q11 to Q13 (6587319903):** the form limits are confirmed (10 an hour per connection per form, 5 an hour per address per form, 1 acknowledgement per address per form per firm day). Extend message search and mentions to every readable conversation, as a follow-up.
- **Q6 (6587395359):** keep the retake as built.
- **0109:** fix the walks as the counterpart asked (6587890300): unique probe licence per run, and null the licence at teardown. The counterpart may null license_number on the 11 leftover probe profiles. Then it sits 0109.
- **CRM (6587550325):** 1 yes, reply subdomain with Resend Inbound; **post the exact DNS records on issue #1**; support mailbox until then. 2 yes, ops_manager is the sales manager and the rep is also the account manager; sales gets no crm.use. 3 yes, keep the rule and hold no-contact records. 4 yes, preview then a person presses Write. 5 yes, one thread per company. 6 yes, a rep presses Send on each email. 7 yes, build San Antonio, Austin, TDLR and TREC first; **draft the open records request letters for Houston, Dallas, Fort Worth and Corpus Christi for him to send**, each naming the dataset, the fields and the format. **For the Austin terms PDF and TDLR's three policy pages, read them in the session's browser or fetch and record the dates; if they cannot be read, say so and he will open them.** 8 yes, replace the prospect kind check with the eight verticals; **prepare it as a destructive sitting per docs/production-sitting-destructive.md.**
- **Scripts (6587550851), sequences and emails (6587551356), sources (6587551734): approved as drafted. Scripts may show to reps once R3 merges.**

**Robert, 2026-11-02 (relayed in session), answers to 6588393366:**
1. Prospect kinds: as drafted. Title companies go to `other` tagged `title_company`, contractors to `other` tagged `contractor`.
2. **AMENDMENT TO THE 2026-09-09 LEDGER RULING:** approved. Add the named route `operator_sql_editor`, allowed only for migrations listed in `docs/production-sitting-destructive.md`, each carrying the sentence saying what the provider's history will not show. 0025 stays the only grandfathered `execute_sql`. (Built with the prospect kind migration: schema-ledger-audit's WAYS gains the route with the list check, and the audit's comment and the destructive sitting document record the amendment with this date.)
3. TDLR residential solar retailer and salesperson files: yes, add both as sources beside the electrical contractor file, same attribution rule.
4. Austin: Robert opens the terms PDF and posts its date and answer. Austin stays on hold until then.
- **The chat sat 0109 on development (6588568307). Q5 may board after P2.**

**Robert, 2026-11-02 evening (relayed in session):**
- **Board P2 on 8852119 (6591248382).** Q6 boards with the same proof fix in its turn.
- **R3 (6589813147):** 1 approved: the narrow counted exemption for the open script variants in src/content/crm-scripts.ts only, with the second check that they render nowhere except behind the sellable test. 2 keep Houston and Waxahachie; add a city only after its published checklist is read. 3 yes, R3 and R7 merge in the same sitting. 4 yes, "other" follows the roof line.
- **R2 (6589406190):** 1 keep TREC running. 2 yes, retire the old prospects CSV import in a later R item. 3 yes, a count of previews waiting on the manager's home screen in R5.
- **0111 (fb7c092) and 0112: the counterpart sits them on development immediately before R1's board, not earlier.** (The same holds in spirit for 0113 and 0114 before R4 and R5; ask each sitting just before its board.)

**Robert, 2026-11-02 night (relayed in session):**
- **P2 (6592694625): option a. Board P2 a fourth time with 1acae24, the tasks page select fix, as its only new change.**
- **R7 (6592143963):** 1 reword the "other" open email as proposed; do not widen the exemption. 2 approved: the rep signature variant "{{rep}}, 254 Engineering, {{phone}}" above the firm footer, **recorded as an email identity ruling**. 3 approved, the second suppression check in the marketing-only branch with email-audit asserting it. 4 yes, delivery webhook in BACKLOG. 6 add the List-Unsubscribe and List-Unsubscribe-Post headers to every marketing template as a follow-up; the footer link stays.
- **M2 (6593730973):** 1 yes, bump in the same update when an individual customer or partner suspension path is built. 2 keep (restore leaves the epoch). 3 leave it (no partner sign-out-everywhere).
- **Low bundles:** the 1 to 60 per minute API cap is accepted as mine. L6 comes back as a question when the bundle is ready.

**Robert, 2026-11-02 night, F9 (6594543361), verbatim:** "do not refuse the draft. When the visit capture's clock disagreed or was never measured, the letter states the inspection date from the server's receipt of the first standing capture, which is a recorded fact, and uses the protocol's own wording that the device time was recorded as disagreeing. A draft is refused only if no standing capture has a receipt time. Own branch, boards with the follow-ups."

**Follow-ups queued after Q14, in this order:** M2 session epoch; per-door attempt counters; suppress the review request on a decline; message search and mentions over every readable conversation. Then the low findings.

(The "Finish the portal" heading below was dropped by my edit of the Q section and is restored here, 2026-11-02.)

## Finish the portal (Robert, 2026-11-01 evening), after GA4, g, d, c, j

Robert's ruling, relayed in session, verbatim in substance:
- Work through P1 to P10 after the current queue (GA4, g, d, c, j), **one board per item**, standing orders apply.
- Questions never stop the queue: post on issue #1 with a recommendation, park that item, move on.
- **Any migration goes to development on a `stage/` branch and waits for the chat counterpart's production sitting.** Build the screens behind it so they work the day it lands. No production writes from here.
- When P1 to P10 are each merged or parked, post one report on issue #1 listing every item with its commit or its parked question, **then stop**.

| # | Item | State |
| --- | --- | --- |
| P1 | **Technician and engineer onboarding, end to end** (BACKLOG "Technician onboarding cannot finish"). Admin screen to accept or reject each onboarding item, reject needs a reason, an audit row, the person told by email. Identity and I-9 verification restored as an admin step on that screen: "verified", document type seen, who and when; **no copy of any ID or I-9 stored**. Activation records the engineer's license number and expiry; the coverage form renders for every role readiness requires counties for. Fix the checklist text (no photo ID, W-4, I-9 or voided check uploads; payroll paperwork is in Gusto) and the completion screen's step count per role. Proof: a probe technician and a probe engineer go from invite to activated with no SQL | **Built**, `feat/onboarding-end-to-end` `2761a8b`, preflight GREEN, tsc clean; 0105 staged (`stage/0105-identity-and-i9` `b697c2d`, sha256 140dd47c), sitting asked (6568178900). Asked Robert: counties for technicians only (recommend yes). Adds onboarding-walk-audit (board 65). Boards after the chat sits 0105 on development |
| P2 | **Permissions for all seven roles** (BACKLOG "EXPECTED in roles-audit states three roles"). Draft the full EXPECTED table for admin, engineer, field_tech, customer_service, dispatcher, sales, read_only, from least privilege: money, refunds, pricing, roles, sealing and exports admin only unless a ruling grants them; licensed actions engineer only. **Post on issue #1** as a table grouped by area with changing grants marked. **Do not apply until Robert approves**; the chat counterpart reviews first | **Posted (6567596115), waiting on Robert.** Nine roles, not seven (rep and ops_manager kept as ruled). Proposed: engineer loses clients.list; read_only loses pricing.read, billing.read, ledger.read_all; exports question (recommend all admin only; the clients CSV is gated on clients.list today) |
| P3 | **Technician training academy** (BACKLOG). Engine: courses, lessons, a quiz per lesson, pass mark, attempts recorded, each course versioned to the protocol version it teaches, graduation from both required courses before a field_tech enrollment can be created; admin and engineer progress screens. Course 1 drafted from each signed protocol's own text, "Awaiting engineer approval"; course 2 (ladder and roof fall safety) a placeholder "Awaiting Robert"; nothing graduates against a draft. No video, no generated person. Certification still needs the engineer's sign off after a supervised inspection; graduation is the entry requirement only | **Built**, `feat/training-academy` `eb12b61`, tsc clean; preflight red only on contiguity until 0105 is on main; 0106 staged (`stage/0106-academy` `924fc56`, sha256 dbc81e35). Asked Robert: enrollment blocked until courses approved (recommend accept, merge after P1's walk), People and roles screens refused (recommend keep). Boards after P1 merges and 0106 is on development |
| P4 | **Engineer review queue: search, filter, sort.** The default order stays exactly as today; filters only narrow; nothing changes what he sees first unless he chooses it | **Built**, `feat/review-queue-controls` `5abf9fc`, preflight GREEN, proof injection verified. Replaces item 25 (no re-sorting), by this ruling |
| P5 | **Duplicate photo check.** SHA-256 of every evidence file at upload (migration, development first); the "no duplicate photos" check on the engineer's queue once every item in a job has a hash. Items captured before show "not checked", never a pass. Property location check stays off; no geocoder | **Built**, `feat/evidence-sha256` `97a4b02`, migration 0107 (pending). Preflight red only on contiguity until 0105 and 0106 are on main; boards after P1 and P3 merge and the chat sits 0107 |
| P6 | **Sister site ordering door**: per-site rate limit, signed upload door for a sister's order files, fresh checkout for a duplicate still awaiting payment, all behind the existing closed switch. Sealed and StampMyPlans stay closed | **Already built** on 2026-10-27 (ruling 6, 0959af0, 0100 on production); both proofs pass. The spec and BACKLOG still said open: corrected on `docs/sister-door-record` `10e2a61`, docs only (fast lane) |
| P7 | **Sign-up and insurance override switches stay in configuration**, shown on /portal/launch as today. Close that question as ruled | **Closed** on issue #1 (6567562093) |
| P8 | **Firm holiday calendar**: New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving, the day after, Christmas, in one config file; business days skip them. Status page target dates stay hidden until the gate opens | **Built**, `feat/firm-holidays` `708532f`, preflight GREEN, tsc clean, proof injection verified. A fixed date on a weekend is observed on the weekday beside it (my call, in the report) |
| P9 | **Exports**: CSV on credential review and insurance, same gate as the other staff lists. "Asked to be forgotten" gets no export | **Built**, `feat/credential-insurance-exports` `5d4091b`, preflight GREEN, tsc clean, proof injection verified |
| P10 | **Mobile apps**: post the six questions from `docs/mobile-plan.md` on issue #1 with a recommendation each; publisher recommendation Craftline Brands IP LLC. Build nothing for mobile | **Posted (6567562093)**, waiting on Robert; nothing built |

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
   - **A green board with one kind of miss may merge** (Robert, 2026-11-01, answer to 6565116449). If the only missed line is a page the branch does not touch, whose bytes are unchanged, and which is still under its ceiling, merge, and write the miss into the merge message and ops/day. A missed line on a page the branch touches, or any page over its ceiling, still stops the merge.
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
