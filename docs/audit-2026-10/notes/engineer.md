# Engineer portal: screen notes

Scope: every route the `engineer` probe and `demo-engineer` reached with HTTP 200 in
`inventory.json` (19 routes). Source read at main d282d5a. Read only; nothing changed.

## Capture status, read first

Of 76 screenshots in `audit-out/engineer`, 56 are the Operations portal sign in page
(byte identical: every `*__1280.jpg` of that kind is 24,859 bytes, every `*__390.jpg`
18,877). Those screens are marked "capture invalid, being retaken" below and are written
from source only.

One correction to the lead's list: for the `engineer` probe these six ARE valid and show
the real screen: `/portal`, `/portal/charge-log`, `/portal/clients`, `/portal/documents`,
`/portal/files`, `/portal/messages` (1280 and 390). `mfa-enrol` and `set-password` are
valid for both principals. Everything else, and every demo-engineer screen except those
two, is the sign in page.

A likely cause for demo-engineer, offered as a hypothesis only: its `mfa-enrol` capture
shows the enrol screen WITHOUT "Not now", which the source gives only to a PENDING session
(`src/app/portal/(public)/mfa/enrol/page.tsx:83`). A pending session is issued when a
factor is required or already enrolled. If demo-engineer has an enrolled factor, the
capture never passed the challenge and every portal page would bounce to sign in. Worth
checking before the retake, because the retake will fail the same way. See defect
candidate 1, which this screenshot is also evidence for.

Valid screenshots read: `portal__engineer__1280/390`, `portal-charge-log__engineer__1280/390`,
`portal-clients__engineer__1280`, `portal-documents__engineer__1280/390`,
`portal-files__engineer__1280/390`, `portal-messages__engineer__1280`,
`portal-mfa-enrol__engineer__1280`, `portal-mfa-enrol__demo-engineer__1280`,
`portal-set-password__engineer__1280`. Sign in page confirmed by reading
`portal__demo-engineer__1280/390` and `portal-review__demo-engineer__1280`, and by hash for the rest.

Inventory facts worth carrying: `/portal/review` took 7.5 to 8.2 s for both principals
(every other engineer screen 1.1 to 2.8 s). `/portal/accounts`, `/portal/billing`,
`/portal/orders` and `/portal/accounts/[id]/pricing` redirect the engineer to `/portal`
(correct refusals). `/portal/jobs`, `/portal/audit` and the admin screens are 404 for him.

---

## /portal (Dashboard)

Screenshots: `portal__engineer__1280.jpg`, `portal__engineer__390.jpg` (valid);
`portal__demo-engineer__1280/390.jpg` capture invalid, being retaken.

1. Purpose: the engineer's landing summary: queue counts, review time, overdue tasks,
   unread notifications, and his own production pay for the month.
2. Can do: read counts (4 waiting, 2 open in review, 0 reviews this month, 0 tasks overdue),
   see "4 packages waiting" under Needs you, see Production and Not yet paid for 2026-10.
3. Cannot but would need: none of the tiles or the "4 packages waiting" row is a link on
   the screenshot, so the one thing that needs him does not take him to it. No oldest
   waiting age (the queue is sorted oldest first but the dashboard does not say how old the
   oldest is). No count of letters waiting for his seal, held-before-dispatch jobs, or
   certifications awaiting his approval, all of which the review queue shows and which are
   things only he can clear. No licence expiry or TBPELS renewal date surfaced, although the
   tasks tile says it includes "the license and filing dates".
4. Contradictions: "Open in review 2" sits under "Your queue" but on the probe's data these
   are files under review by somebody else (the probe has 0 reviews and 0 minutes). The
   tile does not say whose.
5. Copy: "Reviews in 2026-10" uses the period code rather than "October 2026". Money panel
   shows only his own pay, consistent with the 2026-09-24 ruling.

## /portal/review (Review queue)

Screenshots: `portal-review__engineer__1280/390.jpg`, `portal-review__demo-engineer__1280/390.jpg`
all capture invalid, being retaken. From source: `src/app/portal/(app)/review/page.tsx`.

1. Purpose: the engineer's main work screen. Evidence packages oldest first, the selected
   package's evidence against the protocol, and the decision panel. Also held-before-dispatch
   jobs, certifications awaiting approval, and letters waiting for his seal.
2. Can do: open a package into review (starts the timer), view each item's captures with
   clock disagreement and location, see technician exceptions, see administrative shortfalls,
   record a determination (seal, revisions, site visit, repairs, decline), seal a pass letter
   through LetterSealPanel, accept or decline held jobs, approve training records.
3. Cannot but would need: no property history (prior files, prior determinations on the
   same address), no view of the customer's intake answers beside the evidence (only the
   held-before-dispatch subset), no client or addressee name although the screen warns a
   letter to the wrong party must be reissued, no map or aerial, no way to annotate or
   compare photographs, no message thread with the technician from the package (messages
   live on another screen), no queue filter or search, and submission date shown as month
   and day only. Only a PASS determination gets a seal panel (line 565); a letter for any
   other determination listed under "Letters waiting for your seal" opens to the decision
   buttons instead, which `decideReview` then refuses. 7.5 s load (five sequential awaits,
   lines 58 to 67) on the screen he uses most.
4. Contradictions: `availableReviewActions` is called with `assignedEngineerId: actor!.id`
   (line 98) rather than the file's assigned engineer, see defect candidate 4.
   `determination.replace("-", " ")` (line 209) replaces only the first hyphen.
5. Copy: lede is clear. "In review for N minutes. The elapsed time goes on your responsible
   charge record" is accurate against `charge-log`.

## /portal/waiting (Waiting on owners)

Screenshots: `portal-waiting__engineer__*`, `portal-waiting__demo-engineer__*` capture
invalid, being retaken. From source: `src/app/portal/(app)/waiting/page.tsx`.

1. Purpose: files where he withheld certification pending repairs, oldest first, so none is
   forgotten.
2. Can do: read the list with days waiting and open repairs count.
3. Cannot but would need: every row links to `/portal/files/<id>` (line 62), a route that
   does not exist (defect candidate 2), so he cannot open any of them. No action to record
   the owner's contact, schedule the revisit, or send a reminder; no last-contact date.
4. Contradictions: footer says a file leaves "when the owner has had the work done and the
   revisit is dispatched" but nothing on this screen or linked from it does either.
5. Copy: fine.

## /portal/charge-log (Responsible charge)

Screenshots: `portal-charge-log__engineer__1280.jpg`, `__390.jpg` valid;
`portal-charge-log__demo-engineer__*` capture invalid, being retaken.

1. Purpose: his responsible charge record: every decision, its production pay, and time.
2. Can do: read the month, change period, add time by hand, export (CSV via
   `/api/portal/review?period=`).
3. Cannot but would need: no period picker visible when empty (only "Nothing recorded for
   2026-10"), so he cannot reach an earlier month from the empty state without editing the
   URL; worth confirming on the retake with demo data. No annual total, which is what a
   board inquiry asks for.
4. Contradictions: none seen.
5. Copy: "Nothing for 2026-10. An entry is written when you decide a file, if a production
   rate exists for that service line." honestly says a decision can produce no pay row; but
   it does not say who to ask when it does not.

## /portal/tasks

Screenshots: all four capture invalid, being retaken. Source:
`src/app/portal/(app)/tasks/page.tsx`.

1. Purpose: his task list, including licence and filing dates.
2. Can do: view and filter by status, act on his own tasks.
3. Cannot: assign or create tasks for others (`canAssign` needs `profiles.list`, which the
   engineer does not hold). Reasonable for the role; a PE does often need to hand a task to
   the office, so a "ask the office" path would help.
4/5. Nothing further without a capture.

## /portal/messages

Screenshots: `portal-messages__engineer__1280.jpg` valid; `__390` not read (valid by size);
demo-engineer capture invalid.

1. Purpose: file threads, direct messages, role channels.
2. Can do: message somebody, switch Conversations / Addressed to you, search with author and
   since date.
3. Cannot: no "new thread on a file" from here; a file thread only exists once somebody
   writes on it, and the review package has no message link, so starting a conversation about
   a package means leaving it.
4. None.
5. Copy: "A direct message is private, including from an administrator" is a strong claim;
   it is a policy statement the lead may want verified against the messages read path.

## /portal/files

Screenshots: `portal-files__engineer__1280.jpg`, `__390.jpg` valid; demo-engineer invalid.

1. Purpose: the file register, scoped for an engineer to files assigned to him or in queue
   statuses (`scopedFileQuery`, `src/lib/ops-crm.ts:385`).
2. Can do: filter by status, select files and export, open a file into the side panel.
3. Cannot but would need: the selected file panel has no link to the review package or the
   binder (no `/portal/review` or binder href in `files/page.tsx`); its only evidence link is
   "Open the checklist" to `/portal/jobs/<id>`, the technician's capture screen. Filters
   Intake, Needs dispatch and Dispatched can never contain a file in his scope.
4. Contradictions: the selected file panel prints "Documents and sealing arrive with review,
   and tasks and messages after that. They are empty because those phases have not shipped"
   (`files/page.tsx:440-444`) on every file, for every role, while Documents, Tasks, Messages
   and sealing all ship (defect candidate 3). Files list shows 6 files while Documents lists
   sealed deliverables for 6 other files he cannot see here (defect candidate 5).
5. Copy: the bulk export writes "Client price" and "Technician cost" columns that
   `redactFile` has emptied for him (`src/lib/ops-bulk-files.ts:114-115`); the same export's
   own rule is that an empty money cell means "not entered", so his spreadsheet says no price
   was ever set. No figure leaks; the columns should be dropped for him.

## /portal/jobs/[id]

Screenshots: all four capture invalid, being retaken. Source:
`src/app/portal/(app)/jobs/[id]/page.tsx`.

1. Purpose: the technician's capture screen. The engineer reaches it through "Open the
   checklist" on Files and `jobView` admits any engineer (`src/lib/ops-field.ts:1210`).
2. Can do: read the checklist, repair list and notes; Directions.
3. Cannot: the first link on the page is "Back to my jobs" to `/portal/jobs`, which is 404
   for the engineer (inventory line 1294). Capture controls render unless the file is in a
   closed status, but he does not hold `evidence.capture`.
4. Contradictions: an engineer looking at evidence here sees a capture tool, while the
   review queue is where he actually reviews; two screens for one file with different
   affordances.
5. Copy: "Do not drive out until it does" is addressed to a technician.

## /portal/documents

Screenshots: `portal-documents__engineer__1280.jpg`, `__390.jpg` valid; demo-engineer invalid.

1. Purpose: evidence binders (assembled on demand) and filed documents (signed links).
2. Can do: read or CSV-export a binder, open a filed document.
3. Cannot: filter filed documents by file or kind; no sealed date or sealer shown, only
   "Sealed"; no link from a filed document to its file.
4. Contradictions: the filed documents list is firm-wide (`listDocuments` filters only
   `admin_only`, `src/lib/ops-docs.ts:80-81`) while binders use the file scope, so he sees six
   sealed roof certifications for files 254-DEMO-0016, 0012, 0009, 0006, 0004 and 254-2026-0002,
   none of which is in his Files list (defect candidate 5). The footer links "audit trail" to
   `/portal/audit` (`documents/page.tsx:242`), which is 404 for the engineer (defect candidate 6).
5. Copy: the empty state says sealed deliverables land here "when the compliance gate lifts";
   the screen already holds six "Released to client" sealed deliverables while the gate is
   shut. Test data, but the sentence is only true if nothing can be sealed prelaunch.

## /portal/documents/binder/[fileId]

Screenshots: all four capture invalid, being retaken. Source:
`src/app/portal/(app)/documents/binder/[fileId]/page.tsx`, `binderFor` in `src/lib/ops-docs.ts`.

1. Purpose: the evidence binder read on screen, same data as the review package.
2. Can do: read, export CSV.
3. Cannot: print or PDF (a board or court asks for a document, not a CSV).
4/5. Nothing further without a capture.

## /portal/clients

Screenshots: `portal-clients__engineer__1280.jpg` valid (6790 px tall); demo-engineer invalid.

1. Purpose: the CRM client list; the engineer holds `clients.list`.
2. Can do: read 100 of 376 clients (name, contact, city, source, added date).
3. Cannot: search or page ("Search and paging for the rest are not built yet"); open a
   client. For an engineer the useful question is "what else have we done for this client",
   and nothing here answers it.
4. None.
5. Whether the engineer needs the whole CRM, contacts included, is a scope decision worth
   making explicitly (gap 9).

## /portal/reports

Screenshots: all four capture invalid. Source: `src/app/portal/(app)/reports/page.tsx`,
`src/lib/ops-reports.ts:538-577`.

1. Purpose: for the engineer, only the Production report, scoped at the query to his own
   ledger rows.
2. Can do: change period, expand figures to rows, export CSV.
3/4. Money scoping verified in source: own rows only, export goes through the same builder.
5. Copy: lede switches to "Your own work in ..." for him, correct.

## /portal/protocols

Screenshots: all four capture invalid. Source: `src/app/portal/(app)/protocols/page.tsx`.

1. Purpose: protocols for his signature (verbatim text, sign with a fresh code), and the
   template list with draft authoring.
2. Can do: read full text, sign unsigned protocols, draft a new template, add items and
   questions, approve an `awaiting_engineer` template.
3. Cannot: a draft he creates here can never be moved forward from this screen: the draft
   branch says "It cannot be approved until the signature date is recorded" (line 294) and
   nothing on the screen records one. Authoring therefore ends in a dead end.
4. Contradictions: lede says "A job cannot be dispatched in a service line with no published
   protocol"; ruling 11 makes the signed record the gate, and the signing section is the
   newer mechanism. The status chip prints the raw value (`awaiting_engineer`).
5. Copy: "Signed 2026-10-07" from `signedAt.slice(0, 10)` is a UTC date (time zone class,
   already known).

## /portal/protocols/rc-001

Screenshots: all four capture invalid. Source: `protocols/rc-001/page.tsx` delegates to
`ProtocolDocumentPage`. Purpose: read 254-RC-001 v1.1 in the portal (inventory h1 confirms).
Nothing further can be judged without a capture.

## /portal/pay (Your pay)

Screenshots: all four capture invalid. Source: `src/app/portal/(app)/pay/page.tsx`.

1. Purpose: his ledger, owed and paid.
2. Can do: read entries and totals.
3. Cannot: filter by month; see which file an entry is for (only `note`); see an expected pay
   date.
4. Contradictions: the whole screen is written for a TECHNICIAN: eyebrow "Field", lede "A
   flat rate per job, written to the ledger when you submit the evidence", status text
   "Recorded when you submitted the evidence", empty state "the flat rate that was on the
   offer". The engineer is paid per completed review, written when he decides
   (`charge-log` copy). Shown to the engineer this is untrue on every line (gap 3).
5. As above.

## /portal/profile

Screenshots: all four capture invalid. Source: `src/app/portal/(app)/profile/page.tsx`.

1. Purpose: his details, password, two-step verification, seal link, notification
   preferences, permission list.
2. Can do: change password, set up MFA, go to seal management, set email preferences.
3. Cannot: see his licence expiry (only number), TDI appointment expiry, or the firm
   registration he is in responsible charge under.
4. None.
5. "What this role can do" is a raw list of permission keys (`files.transition`,
   `pricing.read_own_pay`); meaningless to a PE.

## /portal/profile/seal

Screenshots: all four capture invalid. Source: `src/app/portal/(app)/profile/seal/page.tsx`.

1. Purpose: store seal and signature images, behind MFA.
2. Can do: see whether each is on file, since when, fingerprint; replace with a fresh code.
3. Cannot: see the image he stored (by ruling, never shown). No history of previous seals.
4/5. Copy is consistent with the 2026-10-06 ruling.

## /portal/mfa/enrol

Screenshots: `portal-mfa-enrol__engineer__1280.jpg`, `portal-mfa-enrol__demo-engineer__1280.jpg`
valid; 390s not read separately.

1. Purpose: set up a second factor.
2. Can do: start enrolment; probe engineer (full session) can choose Not now.
3. Cannot: demo-engineer (pending session) has no way forward except setting up a new factor
   or signing out; if that account is already enrolled, it should be on the challenge, not here.
4. Contradictions: the demo-engineer screen shows the optional copy ("A second factor means a
   stolen password is not enough") on a pending session, i.e. a state the source says arises
   only when a factor is required or already enrolled. That combination is defect candidate 1.
   For the probe, "Your role does not require this" conflicts with the seal screen, which
   refuses sealing without MFA: for the one role whose core act needs it, the copy should say so.
5. As above.

## /portal/set-password

Screenshots: `portal-set-password__engineer__1280.jpg` valid. No token in the URL, so "That
link is not valid" is the correct refusal. Copy fine.

---

## Defect candidates

1. **MFA can be replaced from a password-only session.** CANDIDATE, needs reproduction.
   Screen: `/portal/mfa/enrol`; evidence screenshot `portal-mfa-enrol__demo-engineer__1280.jpg`
   (pending session on the enrol screen). Source: the enrol page accepts any pending session
   (`src/app/portal/(public)/mfa/enrol/page.tsx:42-50`); the API's `begin` and `confirm` do
   not refuse an account that already has an active factor (`src/app/api/portal/mfa/route.ts:101-102,
   171-180`; `beginEnrolment` upserts, `src/lib/ops-mfa.ts:343-351`; `confirmEnrolment`
   overwrites `secret_cipher` and clears the acknowledgement, `ops-mfa.ts:425-443`); `codes_saved`
   then issues a FULL session to a pending caller (`route.ts:283-285`). Read together: somebody
   holding only an enrolled user's password gets a pending session, opens `/portal/mfa/enrol`,
   enrols their own authenticator, acknowledges, and is in, with the owner's factor replaced.
   For the engineer this is also his seal, which rests on that factor. Why a defect: the
   product claims a second factor means a stolen password is not enough; this path makes the
   password enough. Reproduce on development with an enrolled probe.

2. **Every row on Waiting on owners links to a route that does not exist.** CANDIDATE, needs
   reproduction. Screen `/portal/waiting` (capture invalid). `src/app/portal/(app)/waiting/page.tsx:62`
   links `/portal/files/${f.id}`; there is no `files/[id]` route (`src/app/portal/(app)/files/`
   holds only `page.tsx` and `dispatch/`); the Files screen selects with `?id=`
   (`files/page.tsx:45`). Defect: the screen exists so these files are followed up, and none can be opened.

3. **The Files panel says shipped features have not shipped.** CANDIDATE, needs reproduction.
   Screen `/portal/files` with a file selected. `src/app/portal/(app)/files/page.tsx:440-444`:
   "Documents and sealing arrive with review, and tasks and messages after that. They are empty
   because those phases have not shipped". Unconditional, every role. Documents, Tasks, Messages
   and letter sealing are all live in the engineer's own sidebar. Untrue copy on a live screen.

4. **The review decision check uses the actor as the assigned engineer.** CANDIDATE, needs
   reproduction. `src/lib/ops-engineer.ts:648-652` and `review/page.tsx:98` pass
   `assignedEngineerId: actor.id`, never the file's `assigned_engineer_id`; `openReview`
   accepts a file already `under_review` by another engineer and opens a second session
   (`ops-engineer.ts:430-456`, it only looks for the CALLER's open session). So engineer B can
   decide a file engineer A took into review, while `assigned_engineer_id` stays A, and A's own
   pay rule in `redactFile` (`src/lib/ops-authz.ts:998-1006`) keys on that column. Defect
   because the subject field exists to ask whether this engineer is the assigned one, and the
   value supplied makes the answer always yes. Low live impact with one PE; it matters for
   responsible charge the day there are two.

5. **Filed documents are not scoped to the files the engineer can see.** CANDIDATE, needs
   reproduction. Screen `/portal/documents`, `portal-documents__engineer__1280.jpg`: six sealed
   deliverables "Released to client" for files absent from his Files list
   (`portal-files__engineer__1280.jpg`). `listDocuments` filters only `admin_only`
   (`src/lib/ops-docs.ts:80-81`) and `documentUrl` likewise (`ops-docs.ts:94-105`), while files
   go through `scopedFileQuery` (`src/lib/ops-crm.ts:385-391`). Two answers to "which files may
   this engineer see". Whether a PE should see every sealed deliverable is a ruling; the defect
   is that the two screens disagree.

6. **"audit trail" link on Documents is a 404 for the engineer.** CANDIDATE, needs reproduction.
   `portal-documents__engineer__1280.jpg` footer; `src/app/portal/(app)/documents/page.tsx:242`
   links `/portal/audit` unconditionally; inventory shows the engineer gets 404 there (line 329).
   The nav entry is gated on `audit.read` (`src/components/portal/nav.ts:231`), the footer link is not.

7. **The engineer's only evidence link from Files leads to a technician screen whose back link 404s.**
   CANDIDATE, needs reproduction. `files/page.tsx:430-435` "Open the checklist" to
   `/portal/jobs/<id>`; `jobs/[id]/page.tsx:43-48` "Back to my jobs" to `/portal/jobs`, 404 for the
   engineer (inventory line 1294).

## Gaps

1. **Review queue loads in 7.5 to 8.2 s.** `before-the-20th`: it is the engineer's main screen and
   the slowest he has. Fix: run the five independent reads in `review/page.tsx:58-67` in parallel and profile `reviewQueue`.
2. **MFA copy for the engineer says his role does not require it, while sealing refuses without it.**
   `blocks-launch`: the engineer of record must not be told the factor his seal rests on is optional.
   Fix: make MFA required for the engineer role, or at minimum show sealing-specific copy on enrol.
3. **Your pay is written for technicians.** `before-the-20th`: every sentence is false for the
   engineer (paid per decision, not per submission). Fix: role-specific lede, statuses and empty
   state, or send the engineer to the charge log's production view.
4. **Review package lacks context a PE decides with**: client and addressee, intake answers, prior
   files at the address, map, technician thread. `before-the-20th`: the screen itself warns that a
   misaddressed letter must be reissued. Fix: add an addressee and intake panel and a prior-files list.
5. **Dashboard tiles and Needs you rows are not links, and omit seal letters, held jobs and training
   approvals.** `before-the-20th`: the things only he can clear are invisible from his landing page.
   Fix: link every tile and add those three counts to Needs you.
6. **Protocol drafting dead-ends** (a draft can never be approved from the screen). `later`: RC-001
   arrives by signed transcription; but the Draft button invites work that cannot finish. Fix: hide
   new-draft for now or explain the route to signature.
7. **Waiting on owners has no follow-up actions** (contact, reminder, schedule revisit). `later`
   once candidate 2 is fixed. Fix: add last contact date and a reminder task.
8. **Files filters and bulk export columns not tailored to the engineer** (filters that are always
   empty; empty price columns that read as "not entered"). `later`. Fix: role-aware filter set and drop redacted columns from his export.
9. **Engineer sees the whole CRM (376 clients with contacts) with no search and no client page.**
   `later`: needs a ruling on scope. Fix: either remove `clients.list` from the engineer or scope it to clients on his files and add search.
10. **Profile shows licence number but no licence or TDI expiry, and a raw permission key list.**
    `later`. Fix: show expiries from the register and replace the key list with plain sentences.
11. **Filed documents show "Sealed" with no sealed date, sealer or file link.** `later`. Fix: add those three columns.
12. **Binder has no print or PDF form.** `later`. Fix: a print stylesheet on the binder page.
