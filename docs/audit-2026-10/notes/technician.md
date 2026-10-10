# Technician portal: screen notes

Scope: every route a field technician reaches, as the empty probe `field_tech`
and the demonstration technicians `demo-tech-coastal`, `demo-tech-valley`,
`demo-tech-uncertified`, plus the technician's job capture screen
`/portal/jobs/[id]`. Main at d282d5a. Read only.

## Capture validity (read this first)

Checked by hash rather than by eye: 48 of the 80 technician files are one of
two byte identical images (`21d6b8ad...` at 1280, `bcf0192b...` at 390), the
Operations portal SIGN IN page. Per the lead's correction these are
"capture invalid, being retaken" and nothing below is written from them:

- every route as demo-tech-coastal, demo-tech-valley and demo-tech-uncertified
  (portal, certification, files, jobs, messages, pay, profile, tasks), both widths;
- portal-pay, portal-profile and portal-tasks as field_tech, both widths;
- all four `engineer/portal-jobs-id-*` files (engineer and demo-engineer), so
  the job capture screen has NO valid screenshot. It is covered from source.

Valid captures used: field_tech at portal, certification, files, jobs,
messages, mfa-enrol, set-password (390 read, 1280 confirmed for portal and files).

One observation for whoever retakes them. `portal-mfa-enrol__demo-tech-*` are
NOT the sign in page: they show the enrol screen with no "Not now" link and no
"your role does not require this" line. By `src/app/portal/(public)/mfa/enrol/page.tsx:83`
the "Not now" link is withheld only when the cookie reads as a PENDING session
rather than a full one (a dead cookie would have redirected to sign in at line
50). So at capture time the demo technicians' cookie was being read as pending,
which is consistent with every other demo screen rendering the sign in page,
even though `inventory.json` recorded h1 "Dashboard" on the 1280 visit. Worth
checking `signInFully` for the demo personas before the retake.

The inventory itself (from the same run) is still usable for who reached what:
technicians reach `/portal`, `/portal/jobs`, `/portal/certification`,
`/portal/files`, `/portal/messages`, `/portal/pay`, `/portal/profile`,
`/portal/tasks`, `/portal/mfa/enrol`, `/portal/set-password`. They are refused
everything else; `/portal/jobs/[id]` was resolved to a file not assigned to the
probe, so the 404 there is the product refusing correctly.

---

## /portal (Dashboard)

Screenshots read: `portal__field_tech__390.jpg`, `portal__field_tech__1280.jpg`.
Invalid: all three demo-tech captures.

1. Purpose: the technician's landing summary. Six count tiles (offers waiting,
   jobs held, due in 48 hours, past due, tasks overdue, unread notifications),
   a "Needs you" list, and "Your pay" (owed, paid to date).
2. Can do: read the counts; tap a tile through to My jobs or Tasks.
3. Cannot do but would need: see WHY no offers arrive. The empty probe has no
   credentials and no certification (see Certification below), so it can never
   be offered work, and the dashboard says "Nothing needs you right now". A
   mature field app puts "you cannot receive jobs until X" on the home screen.
   No next appointment or today's schedule; no link to the nearest due job; the
   unread notifications tile has no destination (comment at
   `src/lib/ops-dashboard.ts:836` confirms there is no notifications page).
4. Contradictions:
   - "Needs you" says nothing needs the technician while the Certification
     screen, same account, same minute, says "Something below is stopping jobs
     reaching you" and lists four unsubmitted credentials and an untaken check.
   - The empty state promises "expiring credentials appear here when they
     exist", but the technician's attention list only ever contains offers and
     overdue jobs.
   - "Owed to you" note says an entry appears "when a job you completed is
     approved"; the Pay screen says an entry is written "the moment you submit
     the evidence ... It does not wait on the engineer's decision".
5. Copy: "An empty list means the checks ran and found nothing, not that nothing
   was checked" is untrue for this role: credentials and certification are not
   checked at all. "Answer before they expire" (tile note) refers to an expiry
   the technician is never shown (see My jobs).

## /portal/jobs (My jobs)

Screenshots read: `portal-jobs__field_tech__390.jpg`, `..._1280.jpg` confirmed.
Invalid: demo-tech captures, so the populated state (offer cards, accepted
cards, Earlier list) is covered from `src/app/portal/(app)/jobs/page.tsx`.

1. Purpose: the technician's main screen. Live offers with the flat rate,
   address, county, distance and evidence due date; accepted work linking to the
   checklist; an "Earlier" history.
2. Can do: accept an offer (goes straight to the checklist), decline with an
   optional reason, open an accepted job's checklist.
3. Cannot do but would need:
   - See when an offer expires. `expires_at` is read by `listOffers`
     (`src/lib/ops-field.ts:881`) and never rendered, while the dashboard warns
     "an offer that expires goes to somebody else".
   - See the evidence deadline on ACCEPTED work. The accepted card shows file
     number, address, county, rate and status, but no due date, although the
     dashboard counts "Due in 48 hours" and "Past due" from exactly that field.
   - Schedule or record an appointment time with the occupant, call or message
     the site contact, see access notes before accepting.
   - Any record of a job that was cancelled after acceptance (see defect 5).
   - Filter or sort; history beyond what `listOffers` returns.
4. Contradictions: empty state says a job reaches you "in one of your coverage
   counties", but the technician cannot see or change coverage here (it is on
   Profile, read only, "An administrator maintains these").
5. Copy: "Earlier" prints the raw state words `declined` and `expired` in lower
   case next to the human "Taken by someone else" and "Completed". "You can work
   one with no signal" overpromises: the capture queue is offline (`src/lib/offline-queue.ts`),
   but the page is `force-dynamic` with no service worker, so opening or
   reloading a job with no signal shows the browser's offline error.

## /portal/jobs/[id] (job capture, the technician's checklist)

Screenshots: none valid (all four engineer folder captures are the sign in page;
inventory h1 for admin and engineer was "1 Audit Walk Street, not a real
address"). Covered from `src/app/portal/(app)/jobs/[id]/page.tsx` and
`CaptureClient.tsx`.

1. Purpose: one accepted job as the technician works it: address, county,
   service line, status, windstorm flag, capture progress, Directions (Google
   Maps), notes, the engineer's repair list, and the protocol checklist with
   photo, measurement and exception capture, then Submit.
2. Can do: capture each item, record an item as not applicable or not
   accessible with a reason, withdraw that, see the offline queue and its last
   error, submit once every required item is captured and the queue is empty.
3. Cannot do but would need: see the evidence due date on this screen (it is
   not rendered); contact the customer or site contact; check in or out on
   arrival (no arrival timestamp or location); see the rate they accepted; ask
   the reviewing engineer a question from the job (the file thread lives under
   Messages, with no link from here); see what the engineer said after a
   "revisions requested" beyond the repair list.
4. Contradictions: "Back to my jobs" links to `/portal/jobs` for every viewer,
   but engineers also open this page (`evidence.review`) and are refused
   `/portal/jobs` (inventory: engineer and demo-engineer refused). See defect 6.
5. Copy: "No protocol is attached ... Do not drive out until it does." is
   clear. Nothing untrue found in the copy read.

## /portal/certification

Screenshots read: `portal-certification__field_tech__390.jpg`. Invalid:
demo-tech captures, so the certified, uncertified and expiring states are from
`src/app/portal/(app)/certification/page.tsx`.

1. Purpose: what the technician is certified to work (one line today, Roof
   Inspections and Certifications, 254-RC-001 v1.1) and their credential
   paperwork (driver license, vehicle insurance, Form W-9, independent
   contractor agreement), each submitted by type, state and expiry and
   verified by the office.
2. Can do: start the protocol check; submit a credential record; see each
   credential's state, verification date, expiry and the last rejection reason.
3. Cannot do but would need: sign the independent contractor agreement or
   provide the W-9 anywhere in the product (the screen says nothing asks for a
   document, so how either becomes "verified" is invisible to the technician);
   see an ETA or who verifies; see a certification's expiry or recertification
   date; get a reminder before a credential lapses that lands on the dashboard
   (see dashboard contradictions).
4. Contradictions: this screen says jobs are blocked; the dashboard says nothing
   needs the technician (defect 1).
5. Copy: "Not started" for a line never attempted is fine. "Both have to be in
   order before a job can reach you" is true and is the sentence the dashboard
   is missing.

## /portal/files

Screenshots read: `portal-files__field_tech__390.jpg`, `..._1280.jpg`.
Invalid: demo-tech captures.

1. Purpose: the firm's file list, scoped for a technician to their own files
   (`scopedFileQuery` via `listFiles`, `src/lib/ops-crm.ts:405`). It is in the
   technician's sidebar at 1280, not in the phone bottom bar.
2. Can do: filter by 13 status chips, open a file in the side panel.
3. Cannot do but would need: nothing a technician needs that My jobs does not
   already give; this is a second, office oriented view of the same work.
4. Contradictions: two screens for one technician's work (My jobs and Files)
   with different vocabularies (offers and checklists versus file statuses such
   as "Needs dispatch", "Declined to seal", "Revisions requested").
5. Copy: the empty state says "Open one above, or convert a lead from the
   clients screen" (`files/page.tsx:179`). A technician cannot create a file and
   is refused `/portal/clients` (404 in the inventory). Untrue for this role.

## /portal/messages

Screenshots read: `portal-messages__field_tech__390.jpg`. Invalid: demo-tech
captures.

1. Purpose: file threads, direct messages and role channels.
2. Can do: message somebody, switch between Conversations and Addressed to you,
   search by word, author and date.
3. Cannot do but would need: attach a photo to a message (a field staple);
   reach the thread of the job in hand from the job screen; see who in the
   office is on duty.
4. Contradictions: none seen.
5. Copy: "A direct message is private, including from an administrator" is a
   strong claim; not verified here against the access model. Flagged for the
   messaging reviewer rather than reported.

## /portal/pay (Your pay)

Screenshots: capture invalid, being retaken (field_tech and all demo-tech
captures are the sign in page). Inventory h1 "Your pay". From
`src/app/portal/(app)/pay/page.tsx` and `payLedger` in `src/lib/ops-field.ts`.

1. Purpose: the technician's pay ledger: owed, paid to date, entry count, and
   one row per entry with status (Written, Approved, Paid, Void).
2. Can do: read only.
3. Cannot do but would need: the file number or address on each row (rows show
   only `note` or the word "Job"); a pay date or expected pay date; a statement
   or remittance per payout; a 1099 summary; a way to query an entry.
4. Contradictions: the dashboard's "Owed to you" counts VOID entries as owed
   (defect 2); the dashboard pages the whole ledger and excludes demonstration
   files while this screen caps at 300 rows and includes them (defect 3); the
   two screens disagree on when an entry is written (defect 4).
5. Copy: "Most recent first" as the note on an entry COUNT tile is out of place.

## /portal/profile

Screenshots: capture invalid, being retaken. Inventory h1 "Audit Probe
field_tech" and "Demo Tech, Coastal Bend". From `profile/page.tsx`.

1. Purpose: details the platform holds (phone, base, coverage counties), the
   password form, two step verification, notification preferences, what the
   role can do.
2. Can do: change password, enrol a second factor, set notification preferences.
3. Cannot do but would need: change their own phone, base or coverage counties
   (all "An administrator maintains these"); set availability or time off; set
   a travel radius. These are the inputs dispatch uses to decide whether they
   get work at all.
4. Contradictions: none confirmed without a capture.
5. Copy: nothing confirmed without a capture.

## /portal/tasks

Screenshots: capture invalid, being retaken. Inventory h1 "Tasks". From
`tasks/page.tsx` and `TasksClient.tsx`.

1. Purpose: a to do list "including compliance deadlines".
2. Can do: quick add a task, set a due date and repeat, mark done; no assignee
   picker for a technician (`canAssign` is `profiles.list`).
3. Cannot do but would need: tasks generated from their own credentials and
   jobs are not visibly linked to the screen that resolves them (not confirmed
   without a capture).
4. Contradictions: dashboard tile says "0 open in total, including credential
   expiry"; whether credential expiry tasks are created for a technician was not
   verified. Left for the retake.
5. Copy: not assessed without a capture.

## /portal/mfa/enrol

Screenshots read: `portal-mfa-enrol__field_tech__390.jpg` (valid, full
session). Demo-tech captures discussed under capture validity.

1. Purpose: offer of two step verification; optional for a technician.
2. Can do: set up a second factor, "Not now", sign out.
3. Cannot do but would need: nothing material.
4. Contradictions: none.
5. Copy: the "Sign out" link does not sign out (defect 7).

## /portal/set-password

Screenshots read: `portal-set-password__field_tech__390.jpg`.

1. Purpose: landing for an emailed password set link. Without a token it says
   "That link is not valid".
2. Can do: go to sign in.
3. Cannot do but would need: request a fresh link themselves (the copy says ask
   an administrator; there is no self service reset for staff).
4. Contradictions: reached while signed in, it tells a signed in technician to
   "Go to sign in", which then bounces them to My jobs. Harmless.
5. Copy: fine.

---

## Defect candidates

1. **Dashboard tells a blocked technician nothing needs them.** CANDIDATE, needs reproduction.
   Screen `/portal`, `portal__field_tech__390.jpg` and `..._1280.jpg`: "Nothing needs you right now ... expiring credentials appear here when they exist. An empty list means the checks ran and found nothing". Same account on `portal-certification__field_tech__390.jpg`: "Something below is stopping jobs reaching you", four credentials not submitted, check not started.
   Source: `src/lib/ops-dashboard.ts:864-880` builds the technician's attention list from offers and overdue jobs only; credentials and certification are never read. Copy at `src/components/portal/Dashboard.tsx:154`.
   Why a defect: the screen states a check ran and found nothing when the check it names (credentials) does not exist for this role, and the two screens disagree about the same account.

2. **Dashboard "Owed to you" counts void ledger entries as owed.** CANDIDATE, needs reproduction.
   Screen `/portal` money panel (no populated capture; field_tech shows $0.00).
   Source: `src/lib/ops-dashboard.ts:793`, `outstanding = rows.filter((r) => r.status !== "paid")`, so `void` is summed into "Owed to you". The Pay screen sums only `pending` and `approved` (`src/app/portal/(app)/pay/page.tsx:89`) and labels void "Canceled".
   Why a defect: a figure tells a technician they are owed money the firm canceled, and disagrees with the Pay screen's figure from the same ledger. Reproduce by voiding one entry for a demo technician and comparing the two screens.

3. **Pay screen totals are computed from a silent 300 row cap and include demonstration files.** CANDIDATE, needs reproduction.
   Screen `/portal/pay` (capture invalid). Source: `src/lib/ops-field.ts:2018-2022`, `payLedger` reads `.limit(300)` with no count check and no `is_demo` filter; `pay/page.tsx` sums "Owed to you", "Paid to date" and "Entries" from that list. The dashboard reads the same ledger with `readEvery` (paged, whole history) and excludes `is_demo` files (`ops-dashboard.ts:778-792`), and its comment names a truncated read as showing a technician LESS than they are owed.
   Why a defect: two screens state the technician's pay from one ledger and can disagree; past 300 entries the Pay screen undercounts paid to date and owed.

4. **Two screens disagree on when a pay entry is written.** CANDIDATE, needs reproduction.
   Dashboard note (`ops-dashboard.ts:850`): "An entry appears when a job you completed is approved." Pay screen (`pay/page.tsx:140` and the lede): "written the moment you submit the evidence ... It does not wait on the engineer's decision." At most one is true; the Pay screen's status table ("Written: Recorded when you submitted the evidence") suggests the dashboard sentence is the false one.
   Why a defect: untrue copy about money on the technician's home screen.

5. **An accepted job that is cancelled vanishes from My jobs.** CANDIDATE, needs reproduction.
   Source: `src/app/portal/(app)/jobs/page.tsx:51-63`. `mine` excludes accepted offers whose file is `cancelled`; `past` includes accepted offers only when the file is `delivered` or `closed`. An accepted offer on a cancelled file matches neither list and is not rendered anywhere.
   Why a defect: a technician who accepted a job and may be driving to it loses it from the screen with no record or explanation; the "Earlier" list exists precisely to show what happened to past offers.

6. **"Back to my jobs" on the job screen is a dead link for engineers.** CANDIDATE, needs reproduction.
   Source: `src/app/portal/(app)/jobs/[id]/page.tsx:43-48` always links `/portal/jobs`; the page admits `evidence.review` holders (line 24), and `inventory.json` records engineer and demo-engineer refused at `/portal/jobs` while reaching `/portal/jobs/[id]`. No valid screenshot (engineer captures are the sign in page).
   Why a defect: a link the product renders leads to a 404 for one of the two roles the page is built to serve.

7. **"Sign out" on the second factor screens does not sign out.** CANDIDATE, needs reproduction.
   Screen `/portal/mfa/enrol`, `portal-mfa-enrol__field_tech__390.jpg` (and `/portal/mfa`). Source: `src/app/portal/(public)/mfa/enrol/page.tsx:110` and `src/app/portal/(public)/mfa/page.tsx:117` render `<a href="/api/portal/session">`, a GET. `src/app/api/portal/session/route.ts` exports only `POST` (line 38) and `DELETE` (line 251); sign out is `DELETE` (as `PortalChrome.tsx:247` uses). A GET should answer 405 and leave the cookie in place.
   Why a defect: the control's label says it ends the session; on the one screen where somebody half signed in most needs a way out, it does not.

## Gaps

1. **The dashboard does not say why a technician gets no work.** `blocks-launch`. A new technician's first screen tells them all is well while they cannot receive a single offer; this is the first day experience of every hire. Fix: add credential and certification blockers (from `credentialBlockers` and the certification rows) to the technician's attention list, linking to Certification.
2. **Offer expiry is not shown.** `before-the-20th`. The dashboard tells technicians offers expire, and `expires_at` is already read. Fix: print "Answer by <time, Central>" on each live offer card.
3. **Accepted work shows no evidence deadline, on the list or the job screen.** `before-the-20th`. The dashboard counts due and past due from a date the technician cannot see on the job. Fix: show `evidence_due_at` on the accepted card and in the job screen meta line.
4. **No in app path for the W-9 and independent contractor agreement.** `blocks-launch`. Both are listed as blocking dispatch, and the screen says nothing asks for a document, so a technician cannot complete their own onboarding. Fix: an e-sign or upload step, or copy that says exactly how the office collects them.
5. **Job pages do not open offline.** `before-the-20th`. "You can work one with no signal" holds only if the page was already open; a reload in a dead zone loses the checklist. Fix: cache the job page and checklist with a service worker, or change the copy to "keep the job open".
6. **Technician cannot set coverage, base, travel radius or availability.** `later`. All are administrator maintained, which is workable at three technicians. Fix: self service with office approval.
7. **No contact with the customer or site contact from the job.** `before-the-20th`. Access, gate codes and appointment times are the commonest field failure. Fix: show the site contact and a call button on accepted jobs, gated to the assigned technician.
8. **No arrival and departure record.** `later`. Evidence timestamps exist, but no check in. Fix: a "Arrived" and "Left" tap that writes to the file timeline.
9. **Pay rows do not name the job; no pay dates or statements.** `before-the-20th`. A row that reads "Job" cannot be checked by the person being paid. Fix: show file number and address, and the paid date, on each row.
10. **Files screen is shown to technicians with office vocabulary and a false empty state.** `later`. Duplicates My jobs. Fix: remove Files from the technician nav, or give it technician copy.
11. **Refusals are inconsistent.** `later`. For a technician, `/portal/accounts`, `/portal/billing`, `/portal/documents`, `/portal/orders` and `/portal/accounts/[id]/pricing` silently redirect to the dashboard (200), while every other forbidden route answers 404 (inventory). Fix: one refusal behaviour.
12. **"Earlier" shows raw state words.** `later`. `declined` and `expired` in lower case beside human labels. Fix: label map.
13. **Unread notifications tile has no destination.** `later`. Fix: a notifications page or make the tile open the bell.
14. **Staff cannot request their own password reset.** `later`. "Ask an administrator" is a support cost every time a technician forgets a password in the field. Fix: self service reset by email.
