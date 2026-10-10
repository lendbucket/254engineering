# Administrator and Customer Service portal: screen notes

Scope: every /portal route reached by `admin`, `demo-admin` and `customer_service`, main at d282d5a.
Screenshots read from `audit-out/admin` and `audit-out/csr`. Source read under
`src/app/portal/(app)`, `src/app/api/portal`, `src/lib`.

## Capture validity (read first)

The sign in page is 24,859 bytes at 1280 and 18,877 bytes at 390. Every file of those sizes shows
"Operations portal / Sign in" and not the named screen. Measured with `ls -l` and confirmed by
opening a sample.

- **demo-admin: every screen is capture invalid, being retaken** (all 74 files are the sign in page,
  except `portal-mfa-enrol` and `portal-set-password`). No populated administrator state was
  available; notes below come from the empty probe `admin` plus source.
- **admin, capture invalid, being retaken:** `portal-accounts-id-pricing`, `portal-documents-binder-fileId-`,
  `portal-jobs-id-`, `portal-orders` (1280 only; the 390 is valid), `portal-partners`,
  `portal-partners-disputes`, `portal-partners-id-`, `portal-pay`, `portal-people`,
  `portal-pricebook`, `portal-profile`, `portal-queue`, `portal-reports`, `portal-roles`,
  `portal-tasks`, `portal-techs`, `portal-techs-id-`, `portal-windstorm-inquiries`.
- **customer_service, capture invalid, being retaken:** `portal-profile`, `portal-tasks`.
- **No screenshot at all:** `/portal/status` and `/portal/suppressions` (inventory lists them under
  "refused" although both answered 200 with their real H1 for admin and, for suppressions, CSR).
  That is a harness classification fault, not a product refusal.

Those screens are covered from source only and say so.

---

## /portal (Dashboard)

Screenshots: `portal__admin__1280.jpg`, `portal__admin__390.jpg`, `portal__customer_service__1280.jpg`;
`portal__demo-admin__*` capture invalid.

1. Purpose: landing screen. Admin: firm wide tiles, "Needs you", money, margin by period. CSR: orders
   waiting on payment, payment links, refunds in flight, do not contact counts, quiet threads.
2. Can do: read tiles, follow tile links (unreachable links are pruned, `ops-dashboard.ts:910`),
   export margin by period (admin).
3. Missing: admin cannot open the review queue the "Waiting on an engineer" tile counts (link pruned
   because review is licence gated), so the count has no drill down. No date range on the money
   panel. CSR tiles for orders and refunds link nowhere because CSR cannot open Orders, so CSR sees
   a count it cannot act on.
4. Contradictions: admin tiles exclude demonstration files (`is_demo=false`, `ops-dashboard.ts:264-294`)
   while the Files list shows them unmarked, so "Not yet dispatched 1" sits beside a Files list with
   about a dozen "Needs dispatch" rows. CSR "7 thread(s) quiet for three days or more" while CSR's own
   Messages list shows one thread (see defect 3). "Revenue this period: No total" while Billing shows
   a known client price on all three files ($624.00 each); revenue is withheld because cost is
   missing, which the copy only half explains.
5. Copy: CSR panel "What could not be counted" quotes schema names to a customer service user:
   `eng_messages`, `eng_threads.last_message_at`, `refund_case`, `awaiting_customer`, "PAYMENT".
   "Do not contact, by how it arrived: most recent 30 day(s) ago" is wrong (defect 2).

## /portal/accounts

Screenshots: `portal-accounts__admin__1280.jpg` (too dense to read at scale, used source),
`portal-accounts__admin__390.jpg`; demo-admin invalid.

1. Purpose: ordering accounts, invoiced terms, credit limit, statements. Admin only (`accounts.manage`).
2. Can do: search by organisation, page 50 at a time, open trade pricing, "Close this period",
   "Issue it" (queues a statement email to the customer), send a customer password reset link.
3. Missing: no confirmation on "Issue it" (sends a bill to a customer) or "Close this period"
   (`AccountsClient.tsx:247-273`); no undo or void for an issued statement on this screen; no
   statement history or PDF preview before issuing; no record of payments received against a
   statement; the result and error notes render below the 50 row list, far from the row pressed
   (`AccountsClient.tsx:282-291`). Close and Issue stay available on accounts with status "closed";
   `closePeriod` reads `status` and never checks it (`ops-statements.ts:81-89`), so a closed
   account can be given a new statement. Many rows show "open, $0.00" statements, so closing an
   empty period creates an empty statement.
4. Contradictions: none confirmed beyond the above.
5. Copy: "Close this period" closes the CURRENT month (`periodKey()` in
   `api/portal/accounts/route.ts:47`) mid month without saying so.

## /portal/accounts/[id]/pricing

Screenshots: capture invalid, being retaken (both principals). Source only.

1. Purpose: trade prices per deliverable for one account, above a floor. `pricing.write` (admin).
2. Can do: set an agreed price, see price history.
3. Missing: no effective date range or expiry for an agreed price visible in the lede; cannot judge
   further without a capture.
4/5. Not assessable from capture.

## /portal/applications

Screenshot: `portal-applications__admin__1280.jpg`.

1. Purpose: careers applications. Admin (`profiles.create`).
2. Can do: read name, position, email, city, applied date, document links.
3. Missing: no status column, no invite or reject action here (that is on Onboarding), no link from a
   row to its onboarding record, no notes, no filter by position.
4. Contradiction: lede says "Both open positions" but only one position appears; "Demo Applicant,
   mid onboarding" appears once here and twice on Onboarding (see Onboarding).
5. Copy: "Document links last about ten minutes" while the Documents column reads "none" for both.

## /portal/audit (Audit trail)

Screenshots: `portal-audit__admin__1280.jpg`, `portal-audit__admin__390.jpg` (8,000px tall, read
via source).

1. Purpose: regulatory memory, append only. Admin (`audit.read`).
2. Can do: read the newest 200 events.
3. Missing: no search, no filter by actor, entity, file or date, no paging beyond 200, no export
   (`audit/page.tsx:43-48`). A regulator or counsel question ("everything done to file X") cannot be
   answered on screen. The `stamp()` format has no year (`audit/page.tsx:29-36`), separate from the
   known time zone item.
4. None.
5. "capped at 200 for now" is honest.

## /portal/billing

Screenshot: `portal-billing__admin__1280.jpg`.

1. Purpose: margin per file and per period. Admin (`billing.read`).
2. Can do: toggle By file / By period, read missing figures per file.
3. Missing: no way to enter the missing technician cost or engineer production from here (the
   "Missing" column is a dead end); no invoices or payments; no drill into a file.
4. Partner shows "$0.00" (a knowable zero) beside "not set" figures, which is correct but unexplained.
5. Fine.

## /portal/charge-log (Responsible charge)

Screenshot: `portal-charge-log__admin__1280.jpg`.

1. Purpose: the engineer's own record of reviews, production pay and time. Admin also reaches it.
2. Can do: pick a month, export, add time by hand.
3. Missing: for an administrator there is no engineer column or engineer filter.
4. Contradiction and defect: the admin sees EVERY engineer's rows and production (`read_all`) under
   copy written to one engineer (see defect 4). "7 reviews, 7 sealed" here against 6 sealed
   deliverables on Documents (test data, but nothing reconciles the two).
5. "What you were responsible for... including by you", "Flagged on your own record" and "Add time by
   hand" are all addressed to the reader, who is not the engineer.

## /portal/clients

Screenshots: `portal-clients__admin__1280.jpg`, `portal-clients__customer_service__1280.jpg`,
`..._390.jpg`.

1. Purpose: organisations, individuals, leads. Admin and CSR (`clients.list`).
2. Can do: read the 100 most recent; admin can create and convert leads.
3. Missing: no search, no paging ("100 of 376 clients", page says search and paging are not built),
   rows are not links, no contacts under an organisation, no per client history, no merge of
   duplicates. For CSR this is the main lookup tool and it cannot find a caller who is not in the
   newest 100.
4. None.
5. Footer "arrive with the rest of the CRM" names no date.

## /portal/deletion-requests (Asked to be forgotten)

Screenshots: `portal-deletion-requests__admin__1280.jpg`, `portal-deletion-requests__customer_service__1280.jpg`.

1. Purpose: record a request to delete personal data; stops marketing and raises a task. Admin and
   CSR (`suppressions.manage`).
2. Can do: record a request, record what was said back.
3. Missing: not reachable from any menu or link (defect 1). No response deadline or age shown (the
   example has waited since 2026-09-09 with "Waiting on an answer" and no clock); no owner (the task
   is unassigned on purpose, `deletion-requests.ts:174-191`, and CSR cannot assign); no identity
   verification step recorded.
4. None.
5. Clear.

## /portal/documents

Screenshot: `portal-documents__admin__1280.jpg`.

1. Purpose: evidence binders per file and filed (sealed) documents. Admin and engineer.
2. Can do: read or CSV a binder, open a filed document (signed link, one hour).
3. Missing: no search or filter; no indication which documents were actually delivered to the
   customer and when (only "Released to client"); no revoke or supersede action.
4. Demonstration files are listed unmarked, as on Files.
5. Fine.

## /portal/documents/binder/[fileId]

Screenshots: capture invalid, being retaken. Source not reviewed further.

## /portal/files

Screenshots: `portal-files__admin__1280.jpg`, `portal-files__customer_service__1280.jpg`, both 390s.

1. Purpose: one file per deliverable, list plus detail. Admin, CSR, engineer, technician.
2. Can do: filter by status, tick files for export or bulk dispatch (admin), open a file, request
   missing information (CSR via `messages.use`), transition status (admin).
3. Missing: no search box although the page supports `?q=` (`files/page.tsx:45-55`, no input
   anywhere in the folder); no "Cancelled" filter chip although cancelled files are listed
   (`files/page.tsx:160`); no count or total, and `listFiles` silently stops at 300
   (`ops-crm.ts:421`, defect 6); demonstration files are not marked; CSR has no customer contact
   details or order link on a file.
4. See Dashboard on demo exclusion.
5. Untrue copy on the detail pane: "Documents and sealing arrive with review, and tasks and messages
   after that. They are empty because those phases have not shipped" (`files/page.tsx:439-446`) and
   "Invoicing arrives with Stripe in a later phase" (`files/page.tsx:367-370`). Tasks, Messages,
   Documents and Stripe all exist (defect 7). Timeline entries of a non status kind print the raw
   event key (`files/page.tsx:394`).

## /portal/files/dispatch

Screenshot: `portal-files-dispatch__admin__1280.jpg`.

1. Purpose: dispatch plans for files ticked on Files. Admin.
2. Can do: nothing when opened directly; empty state links back.
3. Missing: opened from the sidebar context it is a dead end; could list files awaiting dispatch.
4/5. Fine.

## /portal/inquiries (Design briefs)

Screenshot: `portal-inquiries__admin__1280.jpg` (empty state).

1. Purpose: design briefs from the site, with reply deadline. Admin.
2/3. Empty; cannot judge actions. Lede promises deadlines are recorded.
4/5. Fine.

## /portal/intake (New job)

Screenshot: `portal-intake__admin__1280.jpg`.

1. Purpose: take a telephone job: client, service, property, price, payment decision. Admin.
2. Can do: search or create a client, choose service and deliverable, override price with a reason,
   choose payment path (two disabled while the gate is shut), record channel and call time.
3. Missing: no site contact, gate code or access fields (they are later chased by message); no
   upper or lower bound shown for a price override; no duplicate property check.
4. Files page has a second creation path ("Open a file") beside "New job"; two ways to start a file
   with different fields.
5. Button "Take the job" while the same screen says "The firm is not yet accepting engagements".

## /portal/jobs (My jobs)

Screenshot: `portal-jobs__admin__1280.jpg`.

1. Purpose: technician offers and accepted work. Shown to admin because admin holds `offers.list_own`.
2. Can do: nothing for an administrator.
3/4. An administrator is not a technician; the menu item and the phone bottom bar "Jobs" lead to an
   always empty screen for this role.
5. "You will see the flat rate before you accept" addressed to an administrator.

## /portal/jobs/[id]

Screenshots: capture invalid, being retaken. Not assessed.

## /portal/launch (Launch readiness)

Screenshots: `portal-launch__admin__1280.jpg`, `..._390.jpg`.

1. Purpose: the gate's conditions and what each line looks like to the order page. Admin
   (`roles.manage`).
2. Can do: read only.
3. Missing: no date each condition was stated true, no expiry shown for insurance or registration.
4. Contradiction: "Each offered line, as the order page sees it now: Sellable roof-inspections"
   while the gate is shut and the panel above says the firm "takes no online order and no card"
   (defect 5).
5. "1 of 11 conditions are not met" (grammar). "launchMode() answers trading" exposes a function
   name. The trading name row is "Met" yet its "Who clears it" still reads "TBPELS, by reissuing
   F-29811 in the new name. Until then..." (`launch.ts:289`); the reissuance happened 2026-09-21.

## /portal/messages

Screenshots: `portal-messages__admin__1280.jpg`, `portal-messages__customer_service__1280.jpg`.

1. Purpose: internal threads per file, direct messages, channels. All staff.
2. Can do: message somebody, open a channel (admin), search, filter by author and date.
3. Missing for CSR: there is no conversation with a customer anywhere in the platform (the CSR
   dashboard says so itself). A customer service role with no customer inbox, no email log and no
   call log is the largest gap in this portal.
4. CSR dashboard counts 7 quiet threads; this list shows 1 (defect 3).
5. Fine.

## /portal/mfa/enrol

Screenshots: `portal-mfa-enrol__admin__1280.jpg`, `portal-mfa-enrol__demo-admin__1280.jpg`,
`portal-mfa-enrol__customer_service__1280.jpg`.

1. Purpose: second factor enrolment.
2. Can do: set up, or "Not now" (admin probe and CSR), or sign out.
3. The administrator, who can refund, issue statements and move people between roles, is told
   "Your role does not require this" (gap).
4. The demo administrator gets no "Not now" option while the probe administrator does; two accounts
   of the same role see different rules, unexplained on screen.
5. Fine.

## /portal/onboarding

Screenshot: `portal-onboarding__admin__1280.jpg`.

1. Purpose: application to active technician. Admin.
2. Can do: select a person, record document expiry, set coverage, activate.
3. Missing: no dates beyond "invited"; no reminder or stalled indicator.
4. "Demo Applicant, mid onboarding" appears twice as "invited" for one application; nothing stops or
   flags a duplicate invitation.
5. Fine.

## /portal/orders (Orders needing attention)

Screenshots: `portal-orders__admin__390.jpg` (valid), `..._1280.jpg` invalid.

1. Purpose: orders stuck on payment over 24 hours. Admin (`payments.reconcile`).
2. Can do: ask the provider, record what the provider says, cancel and refund in full with a reason.
3. Missing: there is no list of all orders anywhere in the portal, no lookup by order reference, no
   partial refund, no refund for an order that is not stuck. CSR cannot reach this screen at all,
   so CSR cannot look up an order a customer calls about.
4. "Record what the provider says" re-runs the reconciler with `apply: true` (`OrdersClient.tsx:56-74`)
   rather than applying what was shown, while the comment says it "applies exactly what was shown".
   The refund reason is one shared state across rows: open row A, type, open row B, and A's reason is
   prefilled into B's refund (`OrdersClient.tsx:51,195`).
5. Fine.

## /portal/partners, /portal/partners/[id], /portal/partners/disputes

Screenshots: all capture invalid, being retaken. Source only.

1. Purpose: partner roster, terms, statements, payouts, ledger adjustments; attribution lookup.
2. Can do (source): change status, set terms, invite, close period, issue statement, record a payout,
   add an adjustment, decide a submission (`PartnerActions.tsx:114-531`).
3. Missing: none of "issue", "pay" or "adjustment" asks for confirmation; a payout and an
   adjustment are money written to an append only ledger with no undo (correction needs a second
   adjustment).
4/5. Not assessable without capture.

## /portal/pay (Your pay)

Screenshots: capture invalid, being retaken. Source only.

1. Purpose: a technician's pay ledger. Admin reaches it via `ledger.read_own`.
3/4. For an administrator `payLedger` returns every technician's rows (`ops-field.ts:2015-2025`) and the
   page sums them as "owed to you" under "Your pay" (defect 4). Read is capped at 300 rows with no
   statement that totals cover only those.

## /portal/people

Screenshots: capture invalid, being retaken. Source only.

1. Purpose: staff accounts. Admin.
2. Can do: create, resend invite, force reset (confirmed), suspend (confirmed), restore.
3. Missing: no role change here (it lives on Roles); no clear or reset of a second factor for a
   locked out person (the 2026-09-13 lockout was cleared by hand); no last sign in shown.

## /portal/pricebook

Screenshots: capture invalid, being retaken. Source only.

1. Purpose: prices, cost per job estimates, cost inputs. `pricing.write`.
2. Read only despite the `pricing.write` gate; prices change only by code deploy.
3. Missing: no edit, no history.
4. "Margin per job: Nothing to report... needs completed jobs" while Billing and the dashboard compute
   margin per delivered file.
5. Lede "Margin per job arrives with the first job" is stale. Floor sentence renders a space before a
   period: "... trade pricing . Estimating tier 2." (`pricebook/page.tsx:116-117`).

## /portal/profile

Screenshots: capture invalid for admin, demo-admin and CSR. Source: details, password, two step
verification, notifications, "What this role can do". Not assessed further.

## /portal/queue (Job queue) and /portal/status (Platform status)

Queue screenshots invalid; Status has none. Source: admin (`jobs.manage`). Queue offers "Retry" on a
dead letter with no confirmation; a retried `statement.issue` or `email.send` can reach a customer
twice. Status is read only.

## /portal/reports

Screenshots: capture invalid. Source: four reports gated per report. Not assessed further.

## /portal/roles

Screenshots: capture invalid. Source only.

1. Purpose: roles, grants, holders. Admin.
2. Can do: move a person to another role, edit grants, create and delete roles.
3. Moving a person happens on the dropdown `onChange` with no confirmation (`RolesClient.tsx:157-166`);
   a slip of the select moves someone, including into "Professional Engineer". The server only
   refuses stranding the firm (`role-rules.ts:93-115`). `holdsLicence` is role only
   (`ops-authz.ts:737-745`), so the dropdown grants review screens without the licence questions the
   invite form asks; sealing itself is still refused unless the licence number matches the register
   (`letter-seal.ts:198-202`). "Delete this role" has no confirmation either.

## /portal/set-password

Screenshots: admin, demo-admin and CSR all show "That link is not valid", which is the correct
answer with no token. Fine.

## /portal/suppressions (Do not contact)

No screenshot. Source only. Admin and CSR.

1. Purpose: record and list marketing opt outs.
2. Can do: record a request; mark a typed row as a mistake.
3. A CSR can void a typed suppression with "There is no correct address" and a free text reason
   (`SuppressionsClient.tsx:131-269`), and the rows written by a deletion request are typed rows
   (`deletion-requests.ts:163`), so a CSR can lift the marketing stop on somebody who asked to be
   forgotten. Nothing in the API refuses that case.

## /portal/tasks

Screenshots: capture invalid (admin, CSR). Source: non admin roles see only tasks assigned to them
or created by them (`ops-tasks.ts:71-72`); CSR cannot assign (`profiles.list`), so deletion request
tasks a CSR raises stay unowned unless an administrator looks.

## /portal/techs and /portal/techs/[id]

Screenshots: capture invalid. Source: roster, coverage, credentials, training, pay ledger per tech.
Not assessed further (Certification panel copy already known).

## /portal/windstorm-inquiries

Screenshots: capture invalid. Source: windstorm briefs, `files.create`. Not assessed.

---

## Defect candidates

All CANDIDATE, needs reproduction.

1. **"Asked to be forgotten" is unreachable.** Screen `/portal/deletion-requests`
   (`portal-deletion-requests__admin__1280.jpg`, `..._customer_service__1280.jpg`). No sidebar item
   (`src/components/portal/nav.ts:44-244` has none) and no link anywhere in `src` points at the route.
   The raised task tells the reader to "record what was said on the request itself"
   (`src/lib/deletion-requests.ts:189`) without a link. Defect because the product claims a recorded,
   answerable request and gives no path to the screen that answers it.
2. **"most recent N day(s) ago" reports the oldest row.** CSR dashboard
   (`portal__customer_service__1280.jpg`, both groups "most recent 30 day(s) ago").
   `src/lib/ops-dashboard.ts:1636-1641` reads suppressions `ascending: true`; `groupBy` keeps that
   order (`:1041-1055`); the detail uses `group[0].created_at` (`:1733`), the oldest. Wrong data.
3. **CSR dashboard counts threads CSR cannot read.** Dashboard says "7 thread(s) quiet" and "over a
   week 7, 1 attached to a file"; CSR Messages lists one thread
   (`portal-messages__customer_service__1280.jpg`). `customerServiceDashboard` reads every
   `eng_threads` row with the service client (`ops-dashboard.ts:1605-1611`), including direct
   messages Messages calls "private, including from an administrator". A figure that disagrees with
   its own screen, and a count over private threads.
4. **"Your pay" and "Responsible charge" show firm wide data as the viewer's own.** Admin
   (`portal-charge-log__admin__1280.jpg`: 7 reviews, $888.00 "This month / Unpaid" under "What you
   were responsible for"; `/portal/pay` capture invalid). `chargeLog`, `productionLedger`
   (`ops-engineer.ts:1160-1177`) and `payLedger` (`ops-field.ts:2011-2028`) return all rows for
   `read_all`, while both pages (`charge-log/page.tsx:71,151`, `pay/page.tsx:111-112`) address one
   person and have no engineer or technician column. Wrong attribution of money figures; also both
   reads stop at 300 rows with no notice, so totals are silently partial past 300.
5. **Launch readiness says a line is "Sellable" while the gate is shut.**
   `portal-launch__admin__1280.jpg`. `launch/page.tsx:130-147` reports `lineIsSellable()` (protocol
   signature only) under "as the order page sees it now", while the same page states the mode takes
   no online order. The order page also applies the launch gate, so the screen does not show "the
   answer a customer would get" as its comment claims (`:127`).
6. **Files list silently truncates at 300.** `/portal/files` (`portal-files__admin__1280.jpg`).
   `ops-crm.ts:421` `.limit(300)` with no count or "showing N of M" on the page. The product's own
   rule (accounts, clients) is to state the window; here a 301st file vanishes without a sign.
7. **File detail copy states shipped features are unshipped.** `/portal/files?id=`
   (`files/page.tsx:439-446`: tasks, messages, documents "have not shipped"; `:367-370`: "Invoicing
   arrives with Stripe in a later phase"). All four exist in the sidebar of the same screenshot.
   Untrue copy on an operator screen.
8. **Launch readiness trading name row is stale.** `portal-launch__admin__1280.jpg`, row "Met" with
   "Who clears it: TBPELS, by reissuing F-29811 in the new name. Until then the copy names the
   registrant" (`src/lib/launch.ts:289`). Reissued 2026-09-21. Untrue copy on the compliance screen.
9. **Refund reason carries between orders.** `/portal/orders` (`OrdersClient.tsx:51,148-199`): one
   `reason` state for all rows; switching rows does not clear it, so a reason typed for one order can
   be submitted as the recorded reason for another refund. The reason is "the only record of why".
10. **Statements can be opened on a closed account.** `/portal/accounts`: Close and Issue render for
    every invoiced row regardless of status (`AccountsClient.tsx:245-277`), and `closePeriod` never
    checks `account.status` (`ops-statements.ts:81-89`). Screenshot shows "closed" rows with open
    statements.

## Gaps

1. **No customer conversation channel for Customer Service** (no inbox, email log or call log; every
   thread is staff to staff). `blocks-launch`: the role exists to answer customers and has nothing to
   answer them in. Fix: a per order customer timeline showing every email sent and reply received.
2. **CSR cannot look up an order or a person who calls.** No orders list or reference lookup, Clients
   capped at newest 100 with no search, Files has no search box, the header Search only navigates
   (`PortalChrome.tsx:428-435`). `blocks-launch`. Fix: one record search (order reference, email,
   address, file number) honouring each role's scope.
3. **Administrator second factor is optional** ("Your role does not require this"). `blocks-launch`:
   this account can refund, issue bills and change roles. Fix: require MFA for admin before the gate
   opens (revisits the 0025 ruling).
4. **No confirmation on money and permission actions**: Issue statement, Close period, partner pay
   and adjustment, queue Retry, role change on select, Delete role. `before-the-20th`. Fix: a confirm
   step naming the amount and recipient, and an explicit Save for role moves.
5. **Deletion requests have no deadline, owner or navigation** (see defect 1). `before-the-20th`:
   statutory response windows run from the request date. Fix: nav item, due date, assigned owner.
6. **CSR can lift a do not contact entry, including one from a deletion request.** `before-the-20th`.
   Fix: refuse voids for rows linked to a deletion request, or require admin.
7. **Role dropdown can make anyone a "Professional Engineer"** without licence capture. `before-the-20th`.
   Fix: route engineer assignment through the invite flow that asks for the licence, or refuse it on
   Roles.
8. **Audit trail has no search, filter, paging or export, and no year.** `before-the-20th`. Fix:
   filter by entity, actor and date, CSV export.
9. **Demonstration files unmarked on Files and Documents** while dashboards exclude them. `later`.
   Fix: a "Demonstration" chip on the row.
10. **Billing "Missing" figures cannot be entered from Billing.** `later`. Fix: link each missing
    figure to the field that sets it.
11. **No list of all orders; refunds only for stuck orders; no partial refund.** `before-the-20th`.
    Fix: an orders list with status filter and a refund action per order.
12. **Applications and Onboarding: no status, no reject, duplicate invitations possible.** `later`.
    Fix: application status column, reject action, refuse a second invite for one application.
13. **People has no second factor reset and no last sign in.** `before-the-20th`: the September
    lockout needed SQL. Fix: an admin "clear second factor" action with audit row.
14. **Admin sees technician screens (My jobs, Your pay) that are empty or misattributed.** `later`.
    Fix: hide `offers.list_own` items for admin, or give admin a firm wide pay view labelled as such.
15. **Price book is read only and its margin copy is stale.** `later`. Fix: update the lede and the
    margin panel; decide whether prices are edited in the portal.
16. **Schema names in CSR copy** (`eng_messages`, `refund_case` and others). `later`. Fix: plain
    language.
17. **Intake has no site access or site contact fields.** `later`. Fix: contact name, phone and access
    notes on the job.
18. **Export of files for a role without pricing leaves price columns blank**, which the export defines
    as "not entered" (`ops-bulk-files.ts:110-116`). `later`. Fix: write "not visible to your role".
