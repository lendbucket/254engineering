# Master undone list, 2026-11-19

Robert's all-day prompt of 2026-11-19, job one: everything he has asked for that is not done, and every bug he
reported that is not fixed, in one place. Built against main `428fb36`. Every status was checked against the code
on that commit today unless the row says otherwise. A row says **done** only where it names the commit and the
file on main that make it true.

Who it waits on: **nobody** (a session can do it now), **Robert**, **Aman**, or **others** (counsel, TBPELS, the
chat, a sibling repository's window, a vendor).

## 1. How this was built, and what each source gave

| # | Source | How it was read | What it gave |
| --- | --- | --- | --- |
| 1 | Issue #1, every comment | All **767** comments, 2026-10-23 13:26 UTC to 2026-11-19 12:31 UTC, 26,389 lines, 2,095,173 characters, fetched in full. A script read every line and pulled out each one carrying Robert's words, a "later", or something waiting on him: **977 lines from 397 comments**. I read all 977. Where a line pointed at a list (an audit file, a numbered question set), I read that comment's list. **I did not read the other 25,412 lines by eye.** | The asks behind the rows that name a comment id, in sections 3 to 6 and 8 |
| 2 | `BACKLOG.md` | Whole file, 11,200 lines, **218 entries**. **58** say closed in their heading or opening lines. For each of the other **160**, a script pulled up to four open-work lines, and I read those; the code was read where a line made a claim I could check. **I did not re-read every line of all 160 entries.** | **160 entries**, all placed in section 7 |
| 3 | `CLAUDE.md` and `docs/` | 138 markdown files, scanned with `backlog-audit`'s own 13 open-work markers. **42 carry a marker.** 41 are named in `BACKLOG.md` by path, so their open work is in source 2. The 42nd, `docs/RESUME.md`, carries one marked line, item 13o, which it already records as unblocked on 2026-10-14. | **0 new rows**. Everything they carry is already a row from source 2 |
| 4 | `handoff/10-standing-list.md`, `lendbucket/wattsmith-backups` (read only) | Whole file, 110 lines, last commit `50f89b0d`, 2026-11-19 11:00 UTC | **FR1 to FR13, 17 queue rows, 5 residue lines, X1 to X7, T1 to T9, the franchisee app, 23 of Robert's own items**. Rowed where open; four of its rows are wrong today (section 2) |
| 5 | `BACKLOG.md` entries saying "waits on Robert" or "needs a ruling" | The subset of source 2 that names him | **18 entries**, all in sections 4 and 9 |

The counts in the third column come from the scripts that read each source, not from one search. The scripts are
kept in the session scratchpad and are not part of the repository.

**Rows in sections 3 to 6, de-duplicated across the five sources: 63.** Of those, 16 wait on nobody, 36 on
Robert, 5 on Aman and 6 on others. Section 7 places all 160 open `BACKLOG.md` entries, including **57 older
entries whose open residue I did not re-check against the code today**; those are counted as undone, not done.
Section 8 lists 20 asks confirmed done on main today.

## 2. The records that disagree, settled against main by name

| Item | What the records said | What main says today | Verdict |
| --- | --- | --- | --- |
| **T2, offline start** | Standing list: "Not built" | `1783d0d` merged `feat/t2-offline-start` on 2026-11-09, board 42666611633 65/65; `src/app/field-sw.js/route.ts`, `src/app/portal/(app)/jobs/[id]/CaptureClient.tsx`, proof `scripts/proofs/a-field-day-starts-and-replays-with-no-signal.mjs` | **Built and merged.** The standing list is stale |
| **T5, returned evidence** | Standing list: "Not built" | `1d48ede` merged `feat/t5-returned-evidence` on 2026-11-09, board 42717564601 65/65; `src/app/portal/(app)/jobs/[id]/RevisionAnswer.tsx`, `src/lib/revision-rules.ts`, proof `returned-evidence-is-answered-from-the-phone.mjs` | **Built and merged** |
| **T9, push alerts** | Standing list: "Not built" | `614f216` merged `feat/t9-offer-push` on 2026-11-09, board 42728079385; `src/lib/native-push.ts`, `src/app/portal/(app)/jobs/OfferAlerts.tsx`; 0124 on production 2026-11-10; the VAPID keys set in Production 2026-11-10 (`credential-inventory.ts`, `0c67e0c`) | **Built and merged.** What stays open is row R21: email stays on beside push until push is proven on Robert's own phone |
| **T6, visit clock** | Standing list: "Built, unboarded" | Merged as `babfcdc` 2026-11-09, board 42623837095 65/65 met prediction 6740971608; `src/lib/visit-clock-rules.ts`, `src/app/portal/(app)/jobs/[id]/VisitClock.tsx` | **Boarded and merged** |
| **T7, phone enrol** | Standing list: "Built, unboarded" | Merged as `af3d55a` 2026-11-09, board 42703705505 65/65 met prediction 6752042956; `src/app/portal/(public)/mfa/enrol/EnrolForm.tsx`, proof `a-technician-enrols-on-the-phone-that-holds-the-app.mjs` | **Boarded and merged** |
| **The four re-check items "still open out of 156"** | My morning report 7006631674 | The 156 were the entries the re-check script flagged, not every open entry. Of those, 19 were corrected and 4 confirmed open. Today's full count is 160 entries not marked closed out of 218, placed in section 7. The four: WPI-8 ongoing (R40, Aman), the review request (R30, Robert's link), applications not yet invited (R5), regions have no sources (N3) | **Four confirmed open.** R5 is no longer a gap but the entry still says open (section 7) |
| **73 to 90 unmeasured signed-in screens** | Standing list: 73; every board prints 90 | `scripts/perf-audit.mjs` derives the deferred set from `scripts/lib/surfaces.mjs` and prints its size. 73 was the size when the standing list line was written; the inventory has grown to **90 screens across 5 surfaces**. The board measures public templates only, by ruling, because the whole gate takes 25 minutes. The screens are measured on demand with `PERF_SCOPE=all npx tsx scripts/perf-audit.mjs` | **Open, row N1.** Not run today: it is a long local run, allowed 22:00 to 06:00 Central |
| **The nested page 404** | `BACKLOG.md`, "A WRITERS DEV SERVER ANSWERS 404 ON NESTED PAGES, TWICE IN SIX DAYS, UNEXPLAINED" | It has not recurred since the second instance. Every board since 2026-11-17 printed no nested-page 404: 44329451565, 44349830904, 44386006339, 44404513150, 44466346241, 44479083427, 44493748143 and 44509950955 | **Watched, row N2.** If it comes back a third time, the diagnostic is built first and the check is never loosened (answer 3 of 2026-11-18) |

## 3. Waits on nobody: a session can do these now

Ordered as job two works them: orders, payments, refunds, dispatch and customer pages first.

| # | What | Where it was asked or found | Status checked today | Waits on |
| --- | --- | --- | --- | --- |
| N4 | Two money reads with no page bound: the partner ledger read for margins (`partnerCostByFileRead`, one `.in()` over every partner file) and the production ledger lookup. Past roughly 150 ids the request is refused, so the margin screen goes from a figure to "could not be read" as volume grows | `BACKLOG.md` L1368, "Partial reads"; not re-checked 2026-11-17 | Open. `src/lib/ops-partner-comp.ts:661` sends one `.in("file_id", withPartner)` with no chunking. Latent: production holds no partner rows | nobody |
| N5 | Partial reads under a figure with nothing saying so: `fileMargins` and `uncreditedReviews` at `.limit(500)`, `listTasks` at `.limit(300)` | `BACKLOG.md` L1368 | Not re-checked line by line today. `fileMargins` now reads through `readEvery` (`src/lib/ops-docs.ts:471`), so that one is paged. The others are owed a read | nobody |
| N6 | The public sign-up limiter and the reset limiter count in each server's memory, so a second instance gives an attacker a fresh count | `BACKLOG.md` L1588 ("what stays open") | Open. `src/lib/ops-rate-limit.ts:87`, `takeSignUpAttempt` and `takeResetAttempt` use the in-memory `buckets` map. Sign in moved to the database in 0071 | nobody |
| N3 | A region page cannot carry a sourced fact: `Region` has no `sources` field | `BACKLOG.md` L3390, operator ruling 2026-10-17 | Open. `src/content/regions.ts:32` has no `sources` | nobody (no copy changes; the field is empty until a sourced sentence is written) |
| N7 | The engineer's added capture items are shown but not captured against | `BACKLOG.md` L1057 | Not built. Needs evidence to carry a file-level item, a schema change | nobody (migration, so it is staged, not merged) |
| N8 | Self-service password reset for staff and partners | Robert's answer 1 on the sign-in redesign, 2026-11-08 (6724956292): "a separate full-lane item later" | Not built. `src/app/portal/(public)/forgot-password/page.tsx` says an administrator sends the link (`1a9503b`) | nobody |
| N9 | The customer screens still judged on the staff type scale | `BACKLOG.md` L3180 | **Re-checked 2026-11-19: twelve of the entry's thirteen files are on `CUSTOMER_V10`** (`scripts/token-audit.mjs` lines 753 onward). Only `src/app/account/layout.tsx` is still on the staff scale (line 353, `PORTED` only) | nobody |
| N10 | `mfa-audit` reports an unreachable database as a content finding | `BACKLOG.md` L4234 | Open | nobody |
| N11 | The build guard's port range is typed, not derived | `BACKLOG.md` L3569 | Recorded, not built | nobody |
| N12 | The build guard cannot tell a foreign checkout's server from ours (read the working directory, move the ports) | `BACKLOG.md` L2774, CLAUDE.md 6 | Not built. Deliberately not built at night | nobody |
| N13 | Surveys owed: discarded read errors, prefix matches, checks that expire on success, findings recorded where nobody looks | `BACKLOG.md` L1350, L4978, L5015, L4943 | Owed, report only | nobody |
| N14 | `voice-audit` has no British word list | `BACKLOG.md` L3404 | Proposed, not built; the list itself wants Robert's eye | nobody to build, Robert to approve the list |
| N1 | Measure the 90 signed-in screens with `PERF_SCOPE=all` | Section 2 | Not run since the inventory grew | nobody, 22:00 to 06:00 only |
| N2 | The nested-page 404 diagnostic, if it comes back a third time | Section 2 | Not recurred | nobody |
| N15 | The `.in()` lists and capped lists in N4 and N5 that feed figures, once fixed, need a check that fails when a list is silently short | Same | Owed with N4 and N5 | nobody |
| N16 | The internal audit report on issue #1, item 7 of the day list of 2026-11-15 | Robert's add-on of 2026-11-15 | Not found on issue #1 (section 8) | nobody; this document is offered as it, question 13 in section 9 |

## 4. Waits on Robert

| # | What | Where | Status today | Waits on |
| --- | --- | --- | --- | --- |
| R1 | **`feat/record-outside-payment` merge and 0138 on production** | His answers 2 to 5 of 2026-11-18; 7009201891 | Staged at `f1022aa`, board 44509950955 65/65; 0138 on development (7006862329). Peter's invoice amount is confirmed later | Robert, in a sitting |
| R2 | Question 13: the real-estate letter's pay tier and $702 floor against the Schedule 2 ruling of 2026-10-22 | 6933965747 | Held on `fix/real-estate-tier-floor`; he reads Schedule 2 first | Robert |
| R3 | Stripe's support address to 11103 San Pedro Ave, then `stripe-console.ts` updated | His answer 8, 2026-11-18 | `src/config/stripe-console.ts:207` still reads the Corpus Christi address | Robert in Stripe, then a session |
| R4 | TBPELS mailing address, and the IRS name letter | `BACKLOG.md` L349; standing list Part 4 | `src/config/credentials.ts:289` still reads the Corpus Christi address | Robert |
| R5 | "Applications not yet invited": no ruling was ever recorded | `BACKLOG.md` L439; 6995912168 | The screen states its bound (`src/app/portal/(app)/onboarding/page.tsx:200`). Q13 merge `1fc01b9` made the read exact. The open half is only whether to page it | Robert (recommendation: no change, the bound is stated) |
| R6 | Customer and partner session reads treat a failed read as signed out | Answer 4 of 2026-11-18: after the ads launch, wording to him first | Open, `src/lib/customer-auth.ts`, `src/lib/partner-auth.ts` | Robert's wording, after ads |
| R7 | The parked production cutover (254 onto its own Supabase project), plan due in January | `src/config/parked-work.ts`, re-ruled 2026-10-31 through 2027-03-31 (`77e4241`) | Parked by ruling | Robert, Q1 2027 |
| R8 | The job queue on development, past its 1,000 row ceiling | Standing list residue; his list of 2026-11-19 | Not pruned. On his never-without-him list | Robert |
| R9 | The credentials column drop, `eng_credentials.storage_key` (0061, now needing a new number) | `BACKLOG.md` L1946 | Deferred and destructive; runs in his SQL editor | Robert |
| R10 | `feat/reviewer-override` at `755ff25`: the store reviewer's sign-in override | 6902473032 ("your 38: it comes later") | One commit ahead of main, id unset | Robert gives the reviewer's account id |
| R11 | `store/prep` at `7aee428`: store screenshots, console steps, privacy field-app section | Standing list T8; his answers 3 and 7 | Six commits ahead of main, not merged, "awaiting Robert's merge word" | Robert's merge word; he uploads the screenshots himself |
| R12 | T8 store credentials: App Store Connect API key, Apple push key, Play service account key, the Firebase project, all into Codemagic | Standing list T8 | Not in the repository by rule | Robert |
| R13 | T3 and T4 phone pass (capture and offers on a real phone) | Standing list T3, T4 | Built on web; phone pass not done | Robert's phone |
| R21 | Push proven on Robert's own phone before email stops carrying offers | His T9 answer 6 (6759074924) | Email stays on beside push | Robert |
| R14 | Google Ads and GA4 credentials in Vercel before ads run on `/start` | 6933856055 | Not set, per the record | Robert |
| R15 | Four field technicians onboarded on production (one is active) | 6906845847 | One active `field_tech` on production | Robert |
| R16 | `REVIEW_LINK`, the Google review link | `BACKLOG.md` L1323 | `src/config/review-request.ts:14` is `""` | Robert |
| R17 | The backup bucket and its eight secrets, then `BACKUP_ENABLED` | His 22:46 addendum item 11 (6415570636) | `.github/workflows/backup.yml` built and switched off (`4303188`) | Robert |
| R18 | Resend reply subdomain DNS and `RESEND_WEBHOOK_SECRET` | Standing list Part 4 | `credential-inventory.ts:536`: "Nowhere yet"; `/api/inbound/resend` answers 404 until set | Robert |
| R19 | Austin terms PDF and four open records letters for the CRM sources | Standing list Part 4; 6588394639 | Sources without terms do not run (`src/config/crm-sources.ts`) | Robert |
| R20 | The R6 and R8 questions the standing list names (6591993537, 6593031538) | Standing list Part 4 | No comment with either id is on issue #1, so I could not read the questions. R6 and R8 are merged and on production | Robert or the chat: say whether they still stand |
| R22 | Manufactured home loans: "FHA, VA and USDA" or "FHA only", and the VA and USDA PDFs | 6560030875, 6560997657; standing list Part 4 | Parked; the placeholder answer was never filled | Robert |
| R23 | Truss letter, and the 5 year roof certification answers; question 22 (truss in a title) | 6884480717; standing list Part 4 | No truss wording, by his ruling of 2026-11-01 | Robert (with Aman) |
| R24 | Google Business Profile completion, the Upwork backlink job, GA4 double counting and the Search Console link, the Brand Radar swap | Standing list Part 4 | Outside the repository | Robert |
| R25 | E&O before December 31; SAM.gov TIN; VetCert; hire the second structural PE | Standing list Part 4, FR6, FR10 | Outside the repository | Robert |
| R26 | Franchise FR1 to FR4 and FR9 to FR12; X5 and X7 held until FR1 | Standing list Part 1 | FR5, FR7 done (`3950aa4`, `3d61bec`); FR3 decided and in `src/config/franchise-fees.ts`; the rest not started | Robert, counsel |
| R27 | The keyword registry's four edits in Sealed and StampMyPlans, and Form 20-18 still named in all three | 6933934846; `BACKLOG.md` L948 | `data/keyword-registry.ts` lines 361, 377, 393 still name TREC form 20-18 | Robert rules; the sibling windows edit |
| R28 | The seal's place on the repair specification, his own document | `BACKLOG.md` L750 | Still open | Robert |
| R29 | How the gate counts an insurance register policy (a second database read in the opening direction) | `BACKLOG.md` L898 | Owed back to him | Robert |
| R30 | The review request's delay | `BACKLOG.md` L1323 | Pinned in the proof as the run's default | Robert |
| R31 | The sign-up and insurance override screens: shown, not switchable | `BACKLOG.md` L616 | Awaiting a ruling | Robert |
| R32 | 0073's open half: public schema default privileges still grant a new function to `anon` | `BACKLOG.md` L1333 | For a ruling | Robert |
| R33 | One portal gate decided by a role name, not a grant (`/portal/certification`) | `BACKLOG.md` L5908; `docs/overnight-report.md` 7.2 | `src/app/portal/(app)/layout.tsx:34` and the certification gate compare `role === "field_tech"` | Robert |
| R34 | May the firm seal something that is not one job's deliverable | `BACKLOG.md` L1912 | Nobody has ruled | Robert and Aman |
| R35 | The 641 probe client rows on development, deferred by ruling | `BACKLOG.md` L2130 | Deferred | Robert |
| R36 | `wattsmith-dedicated`, a project in the organisation no 254 document accounts for | `BACKLOG.md` L5747 | Needs his ruling | Robert |

## 5. Waits on Aman

| # | What | Where | Status today | Waits on |
| --- | --- | --- | --- | --- |
| R40 | WPI-8 ongoing construction: his signed per-job scope addendum, then the public pages' "quoted" figure restored | `BACKLOG.md` L330; `SCOPE_ADDENDUM_REQUIRED` in `src/config/engineer-pay.ts` | Closed until signed (0095, 0096) | Aman, then a session restores the figure |
| R41 | His signatures on WP-001 v1.2, WS-001 v1.1, FC-001 v1.0 and the other v1.1 protocols, and each line's "what you receive" quoted from the signed text | `BACKLOG.md` L1471, L1696 | Since 2026-11-15 an unsigned protocol no longer closes its line (6905345382). The quotation per signature is still owed | Aman |
| R42 | RC-001's routing questions 8 to 12 route nothing | `BACKLOG.md` L1824 | A behaviour ruling | Aman and Robert |
| R43 | The engineer's TDI orientation: the line should name WPI-2E filed and WPI-8E issued | `BACKLOG.md` L2602 | Reported by him, not verified | Aman and Robert |
| R44 | Academy course 2 approval | Standing list Part 4 | Only the engineer approves a training | Aman |

## 6. Waits on others

| # | What | Where | Waits on |
| --- | --- | --- | --- |
| O1 | TBPELS opinion letter, FR1 (what a franchisee may say; commission; supervision) | Standing list FR1 | Counsel, then TBPELS |
| O2 | The offer clause on the terms page, two questions | `BACKLOG.md` L4067 | Counsel |
| O3 | The franchise documents' gaps | `BACKLOG.md` L7; `docs/franchise/*.md` | Robert and his attorney |
| O4 | Sealed and StampMyPlans: the registry edits, their three compliance sentences, their Supabase credentials | 6933934846; `BACKLOG.md` L5933, L7644 | The sibling repositories' windows |
| O5 | Five wattsmith audit accounts on production | `BACKLOG.md` L4730 | Whoever owns wattsmith |
| O6 | Production reads: Vercel and Stripe console declarations (`stripe-console.ts`, `credential-inventory.ts`) re-read against the consoles | CLAUDE.md 6 | The chat, on Robert's word |

## 7. `BACKLOG.md`: where each of its 160 open entries sits

Each entry is named by the line its heading sits on in `BACKLOG.md` at `428fb36`.

| Placement | Entries | Which |
| --- | --- | --- |
| **Open, and rowed in sections 3 to 6** | **42** | L7, L181, L306, L330, L349, L439, L616, L750, L898, L948, L1057, L1323, L1333, L1350, L1368, L1471, L1588, L1610, L1687, L1696, L1824, L1912, L1946, L2130, L2449, L2602, L2774, L3180, L3390, L3404, L3569, L4067, L4234, L4730, L4943, L4978, L5015, L5657, L5747, L5908, L5933, L7644 |
| **Open, recorded and not built by an operator ruling.** Each is the harness or a control, not a customer path. It waits on nobody to build and on Robert to schedule | **20** | L228, L1126, L1311, L1599, L1622, L2337, L2367, L2415, L2868, L3635, L3694, L4696, L4806, L4836, L4874, L5126, L5713, L5830, L6247, L9568 |
| **Done, though the entry still reads open**, confirmed on main today | **5** | L1997, the second client at one address: answer 8, `8454509`. L2084, checklist row 2: `7c5a7dd`. L5244, roof letters state no remaining service life: `src/content/services.ts:155`, `cb46721`. L6616, a phone-in job carries a refund disclosure: `src/lib/ops-job-billing.ts:261`, `475a5af`. L6761, voluntary enrolment from the profile: `src/app/portal/(app)/profile/page.tsx:80`, `46e840a` |
| **Open residue inside older entries, NOT re-checked against the code today.** Counted as undone. Each needs its own read before it is called anything | **57** | L54, L394, L795, L807, L927, L937, L1119, L1183, L1445, L1578, L2221, L2259, L2279, L2561, L2753, L2847, L2898, L3347, L3373, L3843, L4177, L4260, L4624, L4661, L4714, L5288, L5328, L5468, L5525, L5697, L5733, L5794, L5973, L6172, L6397, L6642, L6661, L6680, L6709, L7121, L7254, L7381, L7449, L7816, L7857, L8232, L8348, L8436, L8458, L8844, L8915, L8987, L9077, L9285, L9868, L10913, L11142 |
| **Records with nothing open**: a sitting that ran, an applied migration, a phase account, a superseded plan | **36** | L78, L1011, L1046, L1067, L1107, L1162, L1172, L1250, L1426, L1663, L1676, L2292, L2478, L2996, L3726, L3975, L4025, L4291, L4308, L6274, L6739, L6833, L7065, L7309, L7414, L8151, L8762, L8969, L9038, L9124, L9163, L9224, L9350, L9468, L9647, L9800 |

42 + 20 + 5 + 57 + 36 = 160.

Who the 57 unchecked entries probably wait on, from their own words: Robert on L394, L807, L927, L1119, L1183,
L1445, L2221, L2279, L2561, L2753, L3347, L3373, L3843, L4714, L5288, L5328, L5468, L7816, L8232, L8844 and
L11142; the cutover (R7) on L5697, L7121 and L7381; nobody on the other 33.

**Re-checked against main `2c304e9` and `0e68e85` on the afternoon of 2026-11-19**, eleven of the 57, each read in the code:

| Entry (line at `428fb36`) | What the code says today | Placement now |
| --- | --- | --- |
| L5733, an audit that cannot open a screen must not report it as passing | `contrast-audit` reports a combination that never loaded as COULD NOT TELL and lists it (`scripts/contrast-audit.mjs` lines 509 and 587), from `0946bf7` (2026-09-20) | **Done**; the entry still reads "Not yet fixed" |
| L10913, `/portal/accounts` renders in 50 seconds | The board of 2026-11-19 (44552289997) served it in 1.7 to 2.5 seconds of application code; the cliff was fixed and recorded in `775746d` (2026-09-24) | **The 50 seconds is done.** Whether 2.5 seconds on development meets the office-ready two-second standard is N1's measurement, not this entry's |
| L8915, UTM parameters are not captured on `/api/lead` | Still not: `src/app/api/lead/route.ts` reads no `utm_` field. The order routes and `/start` (0137) carry their own attribution | **Open, waits on nobody**; it needs a lead column, so a migration, staged not merged |
| L9077, the onboarding stepper is outside two audits | Still outside `mobile-overflow-audit`: nothing in it or `forms-audit` walks `/onboarding/[token]` at 360 or 390 | **Open, waits on nobody**; a writer-audit change, so it is built in a night run |
| L927, the letterhead prints the registrant until the board confirms "254 Engineering" | `letterheadBrand()` (`src/lib/letter-seal.ts:118`) prints the brand only when `dbas` holds `business.shortName`; `dbas` (`src/config/credentials.ts:288`) holds Sealed Engineering, Stamp My Plans and 254 Engineering Services | **Open, waits on Robert**: whether the board holds "254 Engineering" itself |
| L1578, a partner's approved logo on the partner order page | `src/app/(order)/order/referred/[code]/page.tsx` renders no logo | **Open, waits on Robert**: a partner's mark on a 254 order page is a branding question beside the "own name only" ruling |
| L1445, 0076's keyed live half | `liveConfirmedOn` is still `2026-09-16` (`src/config/stripe-webhook.ts:86`); the keyed read needs `STRIPE_SECRET_KEY`, which no session holds | **Open, waits on others**: the chat, on Robert's word, runs the keyed half |
| L1119, removing the signed protocols from history | The removal from the tree is ruled (2026-10-22); rewriting history is not, because it rehashes about 955 commits and force pushes 126 branches (`docs/history-rewrite-proposal-2026-10-22.md`) | **Open, waits on Robert**; a force push is never the session's |
| L2259, development ran three migrations behind main | A three-layer check is proposed in `docs/development-drift-2026-10-07.md` and not built, by his order "report only until his word" | **Open, waits on Robert** |
| L2898, whether anything deployed drains development's job queue | Still unconfirmed in the code: `/api/cron/jobs` is the only drain, and whether a Preview cron runs against development is a Vercel console fact no session can read | **Open, waits on others**: the chat reads the Vercel cron runs, on Robert's word |
| L3180, customer screens on the staff scale | Twelve of thirteen now on `CUSTOMER_V10`; only `src/app/account/layout.tsx` remains | **Nearly done**; row N9 updated |

Eleven of the 57 re-checked so far: two done, one nearly done, two open on nobody, four on Robert, two on others.

## 8. Asked, and done: confirmed on main today

| What | Where it was asked | The commit and file on main |
| --- | --- | --- |
| T2, T5, T6, T7, T9 | Standing list T rows | Section 2 |
| The five October audits (money F1 to F14, field and seal F1 to F19, office F1 to F20, auth, site) | Robert's audit fixes of 2026-11-02 | Q1 `0e0ccaa`, Q2 `ff97f63`, Q3 `86c70a3`, Q4 `ab90ea6`, Q5 `c94fed0`, Q6 `754bcc0`, Q7 `3446a44`, Q8 `e8b4966`, Q9 `97f249d`, Q10 `e19ebc0`, Q11 `2927425`, Q12 `df52b98`, Q13 `1fc01b9`, Q14 `550f8ac`, F8 `0737b78`, Q8b `c11f0f9`, F12/F6 `e99683e`, low-money `b705676`, low-field `bc4bd4e`, low-office `6b772bd`, low-auth `920f6a6`, low-site `76682f4`; each merge names the findings it closes and a proof that passed on its board |
| Stripe dispute events registered and handled (Q8c) | 6878458673 item 2 | `src/config/stripe-webhook.ts:58` lists `charge.dispute.created` and `charge.dispute.closed`, `2c91b18` |
| Design brief: "start a quote from this brief" | 6447951314 | `src/lib/ops-inquiries.ts` `startQuoteFromBrief`, `44ef03b` |
| Turnaround targets per line | Addendum item 6 | `src/config/turnaround.ts` `targetDaysFor`, `cca79c0`; design and WPI-8 ongoing have none, by his targets |
| The backup workflow built and switched off | Addendum item 11 | `.github/workflows/backup.yml`, `4303188`; the bucket is R17 |
| The parked cutover re-ruled through 2027-03-31 | 6548143393 question 1 | `src/config/parked-work.ts`, `77e4241` |
| Forgot password on staff and partner pages | Sign-in answer 1 | `src/app/portal/(public)/forgot-password/page.tsx`, `1a9503b` |
| Voluntary second-factor enrolment from the profile | `BACKLOG.md` L6761 | `src/app/portal/(app)/profile/page.tsx:80` links to `/portal/mfa/enrol` when not enrolled. The entry still says open |
| The bell, billing's uncredited reviews and the login return path say a failed read | `BACKLOG.md` L1368 | `9bbf7e0` (`70713e8`) |
| Every public API route declared; token routes sent the no-token and wrong-token pair | Answer 6 of 2026-11-18 | `dd868ad`, `scripts/lib/public-api-routes.mjs` |
| A batch paid after its expiry says so on each order it could not release | Answers 6 and 1 | `1c34ea8`, `src/lib/ops-payments.ts` |
| An unattached paid checkout is a fault and an office alert | Answer 7 | `5d6455d`, `src/lib/unattached-payment.ts` |
| A second client at the same address is a real second client, marked possible duplicate | Answer 8 | `8454509`, `src/lib/client-duplicate-rules.ts` |
| Checklist row 2 covers any API route | Answer 9 | `7c5a7dd`, `docs/new-surface-checklist.md` |
| The machine lock created exclusively | Answer 3 | `87ff8f0`, `scripts/lib/machine-lock.mjs` |
| The compliance-audit reads the firm calendar | `BACKLOG.md` | `11aff7b` |
| The day list of 2026-11-15, items 1 to 5 and 9: quick wins, `154a6a6`, pages 1, 2, 4, 6, 7, 8 and 9, the nightly, the fixes boarded | Robert's add-on of 2026-11-15 | `39a5674`, `6e8ba02`, `e06d7ec`, `ccd4517`, `5ba9455`; nightly 44493748143 |
| The day list item 6, the second every-role walk and its fixes | Same | `fa8df85` (`fix/walk2-findings`), board 43760698518 |
| The field technician label in one home | `docs/overnight-2026-09-22.md` ruling 1 | `src/lib/portal-labels.ts:63` |

Two items of the day list of 2026-11-15 are **not** claimed done. Item 8, store prep, is built on `store/prep` and
not merged (R11). Item 7, "internal audit report on issue #1", matched no comment when issue #1 was searched for
"internal audit", "audit report" and "item 7", so it is counted undone.

## 9. Rulings only Robert can make

Each has a recommendation, so the answer can be "1 yes, 2 no". None of these is built ahead of his answer.

1. **Sit 0138 on production and merge `feat/record-outside-payment` (`f1022aa`) in your next sitting** (R1). Peter's
   amount is entered when it is confirmed; the merge does not depend on it. **Recommendation: yes.**
2. **Prune development's job queue back under its 1,000 row ceiling, oldest pending rows first, with you present**
   (R8). It is on your never-without-you list, so nothing has been pruned. **Recommendation: yes, in a sitting.**
3. **The credentials column drop** (R9): I renumber the parked migration past 0138 and stage its three blocks (dry
   run, the drop, the verification read) for your SQL editor. **Recommendation: yes, staged only.**
4. **Merge `store/prep` (`7aee428`)** (R11): the store screenshots, the console steps, the feature graphic, the app
   manifests and the privacy field-app section you approved on 2026-11-14. It touches a public page and the app
   shell, so it boards in the full lane first. **Recommendation: yes.**
5. **"Applications not yet invited"** (R5): leave the screen as it is, newest 200 shown with the bound stated.
   **Recommendation: yes, leave it.**
6. **The R6 and R8 questions your standing list names** (R20): treat them as closed. Both items are merged and on
   production, and neither question is on issue #1. **Recommendation: yes, closed.**
7. **Manufactured home loans** (R22): "FHA only" until the VA and USDA rules are read from their own sources.
   **Recommendation: yes, FHA only for now.**
8. **Form 20-18 in the keyword registry** (R27): change it to 20-19 in all three repositories at once, each by its
   own window. **Recommendation: yes.**
9. **The sign-up and insurance override switches** (R31): keep them in configuration, shown on `/portal/launch`
   but not switchable there. A screen that sets a gate condition makes the gate read the database, which section 1
   allows for a signed protocol only. **Recommendation: keep as is.**
10. **New `eng_` functions and `anon`** (R32): leave the shared public schema's default privileges alone until the
    cutover, with the board's replay check as the guard. **Recommendation: leave as is.**
11. **The certification screen's role-name gate** (R33): replace `actor?.role !== "admin"` with a new read grant,
    `certification.read`, held by the administrator, seeded by a one-row migration. **Recommendation: yes.**
12. **May the firm seal something that is not one job's deliverable** (R34): no, until you and Aman rule a case.
    **Recommendation: no.**
13. **The internal audit report, day list item 7** (N16): treat this document as that report.
    **Recommendation: yes.**
14. **`voice-audit`'s British word list** (N14): approve the list as proposed in `BACKLOG.md` L3404, after which
    it is built. **Recommendation: yes.**
15. **`wattsmith-dedicated`** (R36): record it in `supabase/projects.mjs` as wattsmith's, not this firm's.
    **Recommendation: yes.**
16. **The 641 probe client rows on development** (R35): leave them deferred. **Recommendation: yes, leave them.**
17. **How the gate counts an insurance register policy** (R29): keep the gate reading configuration. The register
    stays a record. **Recommendation: yes.**
18. **The sign-up and reset limiters** (found during the day, `BACKLOG.md`, "THE SIGN-UP AND RESET LIMITERS DO NOT
    DO WHAT THEIR COMMENT SAYS"): five requests naming somebody's email, from anywhere, refuse that person's own
    sign-up for the rest of the hour, three for a password reset, and the route does not tell them. Confirmed by
    calling the limiters. Refuse on the connection alone, so nobody can lock another person out, and keep a much
    higher address ceiling, so walking an address list is still slowed. Then the count moves into the database
    (N6). **Recommendation: yes.**
19. **A staff sentence still describes the gate as shut.** The Documents screen's empty "Filed documents" panel
    says "Sealed deliverables land here when the compliance gate lifts and a Professional Engineer seals one." The
    firm takes payment on production (Robert, 2026-11-14) and the engineer seals letters, so the first clause no
    longer describes the firm. It mentions the gate and sealing, which
    makes it regulatory copy, so it is not changed without you. Suggested: "Sealed deliverables land here when the
    engineer seals one. Credentials and agreements are filed from onboarding." **Recommendation: yes.**
20. **The live region pages state facts with no sources.** Read as a visitor on 2026-11-19 (`/coverage/coastal-bend`):
    "seven Coastal Bend counties ... are inside the catastrophe area designated by the Texas Department of
    Insurance", and "Hurricane Harvey made landfall near Rockport in 2017", among others, carry no citation. A
    region can carry sources since batch 2 (N3). Adding them puts a new sources band, with its labels, on public
    pages. **Recommendation: yes. I propose the sources for each region's existing sentences, read from the
    primary pages, and post them for your approval before anything renders.**

## 10. During the day

| When | What | Where |
| --- | --- | --- |
| 2026-11-19 | **Batch 1 merged as `2f06c26`**: the partner ledger (N4), the Waiting for travel panel, the travel-hold read, the failed-refund panel, the unpaid-orders read and the pipeline report's cycle time now read every row or say they could not. N5's production ledger and uncredited reviews were already paged. Board 44533031128, 65 of 65 | issue #1, 7012641457 |
| 2026-11-19 | **N6 moved to waiting on Robert**, question 18 above, because the database count would spread the lockout to every server | `BACKLOG.md` |
| 2026-11-19 | **The 69-site `.in()` survey** recorded as owed, with how the count was made | `BACKLOG.md`, "OPEN: SCREEN READS THAT STILL HIDE A FAILURE" |
| 2026-11-19 | **Five `BACKLOG.md` headings corrected** to say what main says (section 7's "done" row) | this commit |
| 2026-11-19 | **I ran three writer audits locally** against development, against the standing rule; confessed | issue #1, 7010344148 |
| 2026-11-19 | **Batch 2 merged as `d6eebb1`**: bulk dispatch and the bulk export read a selection whole or say they could not; the Documents screen's Filed documents panel says a failed read and its cap; a large batch's checkout expiry is no longer refused for its size; a region can carry its sources (N3, built). Board 44552289997, 65 of 65 | issue #1, 7013182807 |
| 2026-11-19 | **Held, each for a stated reason:** N10 (the `mfa-audit` change) needs a standalone run and `mfa-audit` is a writer, so it waits for a night run with the turn lock; N8 (staff and partner self-service reset) sends an email whose wording goes to Robert; N9 (the customer screens restyle) needs signed-in screenshots, which a local writer run would make | this table |

**Values only you hold, not rulings:** the store reviewer's account id (R10); `REVIEW_LINK` and the review delay
(R16, R30); where the seal goes on the repair specification (R28); the T8 store keys (R12); the Google Ads and
GA4 credentials (R14); the backup bucket and its secrets (R17); the Resend reply subdomain and its secret (R18);
the Austin terms and the four records letters (R19); the truss answers with Aman (R23).

### Already answered: do not ask again

| Ruling | His answer | Where |
| --- | --- | --- |
| Questions 9 and 10: wording A, wording B and the heading "The terms of your order" | Yes | His all-day prompt of 2026-11-19, recorded in 7009201891 |
| Peter Bulatao's invoice amount | Confirmed later; change nothing for it | Same |
| Question 13, the real-estate letter's tier and floor | Held until he reads Schedule 2 | 6979592150; restated 2026-11-19 |
| Customer and partner session reads | After the ads launch, wording to him first | 6979592150, answer 4 |
| Recording an outside payment: administrator only; the amount equals the job's total; terms stated after payment | Yes, yes, yes | 7000773061, answers 2 to 4 |
| The seven store screenshots | He uploads them himself, without DEMO | 7000773061, answer 7 |
| Stripe's support address | He changes it; `stripe-console.ts` after he says so | 7000773061, answer 8 |
| A standing note means "may print"; name the whole set every time | Yes | 6979592150, answer 2 |
| The nested-page 404 | Build the diagnostic on a third recurrence; never loosen the check | 6979592150, answer 3 |
| Batch commission | Leave it alone | 6979592150, answer 5 |
| A batch paid after its expiry | `payment.unexpected` | 6979592150, answer 6 |
| An unattached checkout | A fault and an administrator alert | 6979592150, answer 7 |
| A second client at the same address | A real second client, with a possible-duplicate mark | 6979592150, answer 8 |
| The parked production cutover | Acknowledged through 2027-03-31, the move planned for Q1 2027 | His ruling of 15:07 Central 2026-10-31, `src/config/parked-work.ts` |
| An unsigned protocol and its line | An unsigned protocol no longer closes its line; only Aman seals | 6905345382 |
| Truss wording | None until he confirms truss letters | His ruling of 2026-11-01, restated in 6884480717 |
| His own accounts and a second factor | Exempt; never suggest enrolling them | 6470882290 |
| Turnaround targets per line | Roof 10 business days and the others he gave; none for design or WPI-8 ongoing | 2026-10-27, `src/config/turnaround.ts` |
| **Rulings 1 to 20 of section 9** | **All 20 as recommended**: 1 yes, 2 yes, 3 yes, 4 yes, 5 yes, 6 yes, 7 yes, 8 yes, 9 keep, 10 leave, 11 yes, 12 no, 13 yes, 14 yes, 15 yes, 16 yes, 17 yes, 18 yes, 19 yes, 20 yes. Rulings 1, 2 and 3 happen in his next sitting with him present: 0138 stays off production, the queue is not pruned, and the credentials drop is staged only, as a dry run, the drop and a verification read for his SQL editor. Ruling 20's sources are posted to him and nothing renders until he says so | His overnight prompt of 2026-11-19 into 2026-11-20, recorded in 7029872252 |
| A partner's approved logo on a 254 order page (row L1578 of section 7) | **No.** 254 is the only brand on its own order pages until the franchise rules are set | Same, 7029872252 |
| Whether the board holds "254 Engineering" itself as an assumed name (row L927) | **His to check.** The letterhead goes on printing the registrant | Same, 7029872252 |
