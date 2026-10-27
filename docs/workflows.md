# Workflows, from first contact to records retention

**Phase W1 of Robert's instruction of 22:05 Central, 2026-10-26.** This is the map of every real workflow on the platform, for each role, written so that a Playwright walk (W2) can drive each step and so that each role's Procedures page (W4) can render it as numbered written procedures.

**How it was derived, and what that means for a reader.** Every step names the page that renders it (a directory under `src/app`), the API route and action it calls, the function in `src/lib` that does the work, the notice it raises, the email it queues, and the table it writes. Those facts were read off the code at main `b6abbde` on 2026-10-27, by three read-only passes over the source that did not run the app:

- which API route actions each screen sends (a search of every page and component under `src/app` and `src/components` for the action's name);
- which `src/lib` functions each action calls, and which `eng_` tables those functions insert, update, upsert or delete directly;
- for the steps that write through a database function, the function named in the `rpc(...)` call, which is given instead of a table.

A write made two calls deep, or inside a database function, is named by the function that makes it. Where the code did not show what a step does, the step says **not found in code** rather than describing what it probably does. Robert's rulings come from `docs/day-queue.md` on `ops/day`, `BACKLOG.md`, `CLAUDE.md` and the rulings recorded in the code beside the thing they rule.

**Nothing here was walked.** Every step's W2 result reads "not walked yet". A step that reads well here and fails in a browser is exactly what W2 exists to find.

## The two marks

- **[NEEDS SQL, A SCRIPT OR A CODE EDIT]**: the step cannot be done from a screen today. The script, the file or the SQL is named. Robert's rule is that nothing operational needs SQL, a script or code (the office-ready standard, `CLAUDE.md` section 2d, 2026-10-20, which states it in those words; the instruction cites a ruling of 2026-10-07, whose own text was not found in the repository). Some of these are deliberate, and the reason is given beside them, because a deliberate one is a ruling for Robert to confirm and an accidental one is a gap.
- **[NO SCREEN]**: the step exists in code and nothing a person can open performs it. That includes an API route no screen calls, an email template nothing sends, and a door that is a machine interface by design. Each says which.

## Robert's seven roles, and the code's roles

The roles are declared in `DEFAULT_ROLES` (`src/lib/ops-authz.ts`), and since 0018 they are rows in `eng_roles` and `eng_role_grants`.

| Robert's name | Code role | Where they land | Notes |
| --- | --- | --- | --- |
| Customer | none: a customer user (`eng_customer_users`) on the `/account` surface, or nobody signed in on `/order` | `/account` | Scoped by ownership in `customer-auth.ts`, not by grants. |
| Rep | `rep`, "Customer Service and Sales Rep" | `/portal` | `REP_GRANTS`. Three older narrower roles still exist and are not system roles: `sales` (lands `/portal/clients`), `customer_service` (`/portal/files`) and `dispatcher` (`/portal/files`). Each holds a subset of the rep's work, and is noted on the steps it can do. |
| Ops manager | `ops_manager`, "Operations Manager" | `/portal` | The rep's grants plus `refunds.approve_within_limit`, `technicians.onboard`, the four reports with no pay in them, and `insurance.manage`. |
| Admin / owner | `admin`, "Administrator" | `/portal` | Every grant in `MATRIX.admin`. The owner override (`src/lib/owner-override.ts`) names two ids, and some acts are refused by role key to anybody but `admin`, a no-charge job among them. |
| Field technician | `field_tech`, "Field Technician" | `/portal/jobs` | |
| Engineer | `engineer`, "Professional Engineer" | `/portal/review` | The five licensed acts are not grantable to anybody; they are gated on `holdsLicence` and his own session. |
| Partner | none: a partner user (`eng_partner_users`) on the `/partner` surface | `/partner` | Scoped by ownership in `partner-auth.ts`. Partners never operate under a 254 mark (ruling of 2026-10-15). |

`read_only` also exists, landing on `/portal`, and only reads. It has no workflow of its own and is not mapped here.

**Where the gate stands, which shapes almost every customer step.** `launchMode()` reads prelaunch while any open condition is unmet (`src/lib/launch.ts`, `CLAUDE.md` section 1). While it does, `/api/order-flow` refuses an order with the sentence `notYetAcceptingEngagements()`, and the public pages send a buyer to `/waitlist`. Each order step below is written for the open gate and says what happens while it is shut.

**Emails.** An email is rendered from a template in `src/lib/email-templates.ts`. Mail from a public form, and the staff notices, are queued with `queueEmail`, which writes an `email.send` row to `eng_jobs`; the cron at `/api/cron/jobs` delivers it. "The firm's inbox" below means `business.notificationEmail`, which `notify()` in `src/lib/notify.ts` sends to when a template names no recipient.

**In-app notices.** A notice is raised by `raise()` in `src/lib/ops-notify.ts`, of a kind declared in `NOTIFICATION_KINDS` (`src/lib/ops-comms.ts`), and written to `eng_notifications`. Whether it is also emailed is the person's preference, except for the three kinds marked mandatory: `credential.expiring`, `certification.revoked` and `insurance.expiring`.

---

## Customer

### 254-WF-001 Ask the firm something before ordering (the enquiry forms and the waitlist)

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/(site)/contact`, `src/app/(site)/waitlist` (`LeadForm`) | Anybody | A form, and on `/waitlist` the sentence that the firm is not yet accepting engagements | Submits name, contact and message | `/api/lead` writes the lead (`insertLead`); a partner's visitor key is read (`partnerForVisitor`) | The firm's inbox (`leadNotification`); the person (`inquiryAcknowledged`) | `eng_leads` insert; two `email.send` jobs | | not walked yet |
| 2 | `src/app/(site)/design-inquiry` (`DesignInquiryForm`) | Anybody | The design brief form | Submits a brief | `/api/design-inquiry`, `insertDesignInquiry` | The firm's inbox (`inquiryNotification`); the person (`inquiryAcknowledged`) | `eng_design_inquiries` insert | | not walked yet |
| 3 | `src/app/(site)/windstorm-inquiry` (`WindstormInquiryForm`) | Anybody | The windstorm enquiry form | Submits it | `/api/windstorm-inquiry`, `insertWindstormInquiry` | The firm's inbox (`inquiryNotification`); the person (`inquiryAcknowledged`) | `eng_windstorm_inquiries` insert | | not walked yet |
| 4 | none | A sister brand's site | | Posts a lead to `/api/intake/lead` with its intake key | `acceptSisterLead`, at 20 a minute (`src/lib/sister-intake.ts`) | The firm's inbox (`leadNotification`) | `eng_leads` insert | **[NO SCREEN]** by design: a machine door for the two sister sites | not walked yet |

Staff pick these up in 254-WF-007.

### 254-WF-002 Order and pay online

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/(site)/order`, `src/app/(order)/order/start/[slug]` (`OrderFlow`) | A buyer | The service, its price from the price book, the questions, and the refund terms | Answers the questions, uploads what is asked (`sign-upload`) and submits | `/api/order-flow`. **Gate shut:** refused with `notYetAcceptingEngagements()`. A quoted line: `requestQuote`. Otherwise `placeOrder`, then `attributeOrder` (the 90 day partner rule), then `startCheckout` | Nobody yet | `eng_service_orders` insert, `eng_order_inputs` insert, `eng_clients` update; `eng_quote_requests` insert for a quote; audit `order.placed` or `quote.requested` | | not walked yet |
| 2 | Stripe Checkout (outside this platform) | The buyer | Stripe's card page | Pays | Stripe calls `/api/stripe/webhook`, which runs `markPaid`: the database function `eng_apply_order_paid`, then `releaseForFulfilment` | The buyer: `orderConfirmed`, carrying the status link from `issueCustomerLink`; `accountWelcome` if this payment opened their account | Through `eng_apply_order_paid`; then `eng_files` update and `eng_service_orders` update; order events such as `customer_link.issued` in `eng_order_events` | | not walked yet |
| 3 | `src/app/(order)/order/referred/[code]` (`ReferralCapture`) | A buyer sent by a partner | The partner's page | Arrives, then orders as in step 1 | `/api/referral`, `recordTouch` | Nobody | `eng_partner_touches` insert | | not walked yet |
| 4 | none | A trade account's own system | | Posts orders to `/api/v1/orders` with an API key | `verifyApiKey`, `previewBatch`, `placeBatch`, `startBatchCheckout` | Nobody | `eng_account_api_requests` insert, `eng_order_batches` insert and update, `eng_service_orders` update; audit `batch.placed` | **[NO SCREEN]** by design: the account API | not walked yet |
| 5 | none | A sister brand's site | | Posts an order to `/api/orders` | `placeOrder`, `startCheckout` (refused while the gate is shut) | Nobody | As step 1 | **[NO SCREEN]** by design: a machine door | not walked yet |

### 254-WF-003 Follow an order to its sealed letter

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/(order)/order/[reference]` | The buyer, from the link in `orderConfirmed` | Where the order stands. A dead or wrong link shows a failure sentence while the page still answers 200 (`CLAUDE.md` section 6) | Reads | Nothing; it reads | | | | not walked yet |
| 2 | Email only | The buyer | `orderTechnicianAccepted` when a technician accepts (254-WF-029) | Reads | | The buyer | `notifyTechnicianAccepted`, from `acceptOffer` | | not walked yet |
| 3 | Email only | The buyer | One of: `orderSealed`, `orderRepairsRequired`, `orderDeclined` | Reads | Follows from the engineer's decision (254-WF-033), through `settleDecision` and the `review.after_decision` job | The buyer | `refund.none` or the refund event on the order | | not walked yet |
| 4 | `src/app/(order)/order/[reference]` | The buyer | The sealed letter, once sealed | Downloads it | `/api/order-document`, `customerLetterFor` | | `eng_customer_access` update; audit `document.customer_download` | | not walked yet |
| 5 | Email only | The buyer | `orderCancelled`, `refundSucceeded` or `refundFailed` | Reads | Follows a firm-side cancellation (254-WF-023) or the refund on a decline | The buyer | Through `cancelAndRefund` and the refund events | | not walked yet |
| 6 | Email only | The buyer | `reviewRequest`, a request for a review | Reads | The `review.request` job, `REVIEW_REQUEST_DELAY_DAYS` after delivery (`src/lib/review-request.ts`) | The buyer | `eng_jobs` | | not walked yet |

### 254-WF-004 Open a customer account and sign in

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/account/sign-up` | A new customer | The form, or, while the `self-service-signup` condition is unmet, `selfServiceSignUpClosedSentence()` | Gives an address and a password | `/api/account/sign-up`, `createCustomerAccount`; for a known address, `issueLinkForExistingAccount` | The person (`accountWelcome`) | `eng_clients`, `eng_customer_accounts` and `eng_customer_users` insert; audit `customer_account.create` | Opening self-service sign-up is a condition stated in configuration: **[NEEDS SQL, A SCRIPT OR A CODE EDIT]**, `selfServiceSignup` in `src/config/launch-readiness.ts` (by design: a gate condition is opened by an edit on purpose, `CLAUDE.md` section 1). Since 2026-10-27 `/portal/launch` shows where it stands and the edit, and a screen that sets it waits on Robert's ruling | not walked yet |
| 2 | `src/app/account/set-password` | The customer, from the email link | The password form | Sets a password | `/api/account/set-password`, `setCustomerPassword` | | `eng_customer_auth_tokens` update, `eng_customer_users` update | | not walked yet |
| 3 | `src/app/account/login` | The customer | The sign in form | Signs in | `/api/account/session`, `signInCustomer`, `issueCustomerSession` | | `eng_sign_in_attempts` insert, `eng_customer_users` update, `eng_audit_events` insert | | not walked yet |
| 4 | `src/app/account/forgot-password` | The customer | The form | Asks for a reset | `/api/account/forgot-password`, `issueResetForAccount` | The person (`passwordReset`) | Audit `customer_account.reset_link_issued` | | not walked yet |

The other two doors into an account are an operator opening one (254-WF-022) and paying for an order (254-WF-002 step 2). All three are declared in `src/lib/account-doors.ts`.

### 254-WF-005 Use a customer account

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/account`, `src/app/account/orders`, `src/app/account/orders/[reference]` | An account holder | Every order the account owns | Reads | | | | | not walked yet |
| 2 | `src/app/account/order` (`BulkOrderClient`) | A trade account | A batch order form with trade prices and the credit position | Previews, then submits | `/api/account/bulk`: `preview` (`previewBatch`, `creditDecision`), then `submit` (`placeBatch`, `startBatchCheckout`) | | `eng_order_batches` insert and update, `eng_service_orders` update; audit `batch.placed` | | not walked yet |
| 3 | `src/app/account/statements` (`PayStatementButton`) | An account on terms | The statements issued to it | Pays one | `/api/account/statements`, `startStatementCheckout`; Stripe's webhook then runs `markStatementPaid` | | Through `markStatementPaid` | | not walked yet |
| 4 | `src/app/account/settings` (`SettingsClient`) | An account holder | Defaults, properties, API keys | Changes defaults, adds or archives a property, creates or revokes a key | `/api/account/settings`: `defaults`, `add-property`, `archive-property`, `create-key`, `revoke-key` | | `eng_customer_accounts` update, `eng_account_properties` insert or update, `eng_account_api_keys` insert or update; audits `account.defaults_changed`, `account.api_key_created`, `account.api_key_revoked` | | not walked yet |

### 254-WF-006 Stop hearing from the firm, or ask to be forgotten

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/(site)/unsubscribe` | A person, from a marketing email's link | A confirmation, or one sentence for a missing, wrong or malformed token | Opens the link | The page checks the token (`tokenValid`) and records the suppression (`suppress`) | | `eng_marketing_suppressions` | | not walked yet |
| 2 | none for the customer | A person | | Asks on the telephone or by email to be forgotten | Staff record it in 254-WF-027 | | | **[NO SCREEN]** for the customer: there is no customer-side request form. The request is taken by staff | not walked yet |

---

## Rep

### 254-WF-007 Work the inbox

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)` (home) and `LiveCounts` | Rep, ops manager, admin | Counts of new work, refreshed without reloading (`/api/portal/desk`, `inboxCountsSince`) | Opens the inbox | | | | | not walked yet |
| 2 | `src/app/portal/(app)/inbox` | Rep (`inbox.read`, `inbox.answer`) | The leads and enquiries, exportable to CSV (`/api/portal/inbox/export`) | Marks a lead contacted | `/api/portal/desk` `lead_contacted`, `markLeadContacted` | | `eng_leads` update; audit `lead.contacted` | | not walked yet |
| 3 | `src/app/portal/(app)/inquiries`, `src/app/portal/(app)/windstorm-inquiries` | Rep | The design briefs and windstorm enquiries | Marks one answered | `/api/portal/inquiries` and `/api/portal/windstorm-inquiries`, `mark_answered` | | `eng_design_inquiries` or `eng_windstorm_inquiries` update; audit `design_inquiry.answered` or `windstorm_inquiry.answered` | The reply itself is written outside the platform; the screen records that it was answered | not walked yet |
| 4 | Any record (`ContactLogForm`) | Rep (`contact_log.write`) | The call log form | Logs a call | `/api/portal/contact-log`, `logContact` | | `eng_contact_log` insert, `eng_prospects` update | | not walked yet |
| 5 | `src/app/portal/(app)/clients` (`ClientsClient`) | Admin | A lead | Converts it to a file | `/api/portal/files` `convert_lead`, `convertLead` | | `eng_leads` update, `eng_file_events` insert; audit `lead.convert` | Converting a lead is the administrator's by owner ruling of 2026-10-20 (the `sales` role note in `DEFAULT_ROLES`) | not walked yet |

### 254-WF-008 Take a job over the telephone

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/intake` (`IntakeClient`) | Rep, sales, admin (`files.create`) | The New job form: client search, service, questions, price. While the gate is shut, the sentence that no payment link can be sent until the firm opens | Finds or creates the client (`search_clients`), uploads (`sign_intake_upload`), reads dispatch context (`dispatch_context`) and takes the job (`take_job`) | `/api/portal/files` `take_job`, `takeJob`: `createClient` if new, `createFile`, the answers, `transitionFile`, then `sendPaymentLink` | The customer (`jobPaymentLink`) | `eng_clients` insert, `eng_files` insert, `eng_file_events` insert, `eng_file_inputs` insert, `eng_files` update; audits `file.create`, `job.taken`, `file.payment_link_sent` | | not walked yet |
| 2 | `src/app/portal/(app)/intake` | Admin only, by role key | The no-charge option | Opens the job unpaid, with his password and a fresh code | `takeJob`'s no-charge branch (`verifyOwnPassword`, `verifyFreshCode`) | | Audit `job.no_charge` | | not walked yet |
| 3 | Stripe Checkout | The customer | The payment page | Pays | As 254-WF-002 step 2 | The customer (`orderConfirmed`) | As 254-WF-002 step 2 | | not walked yet |
| 4 | `src/app/portal/(app)/payment-links` (`BillButton`), added 2026-10-27 (W2) | Admin (`payments.charge`), by Robert's W2 ruling "owner or admin only" | Every job not yet paid, with which way to be paid is open and why the other is not | Sends a payment link, or invoices an account | `/api/portal/files` `send_payment_link` and `invoice_account` (`sendPaymentLink`, `invoiceAccount`), which now refuse a second order for a job that already has one not canceled or refunded | The customer (`jobPaymentLink`) | `eng_service_orders` insert, `eng_files` update; audits `order.raised_for_file`, `file.payment_link_sent`, `file.invoiced` | Marked no screen until 2026-10-27. A job already billed is sent to Order lookup to resend its link | not walked yet |

### 254-WF-009 Chase what a job is missing

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/files` (`FileClient`) | Rep, customer service | The file and what is missing | Asks the customer for it | `/api/portal/files` `request_information`, `requestOutstanding` | The customer (`outstandingInformation`) | Audit `file.information_requested` | | not walked yet |
| 2 | `src/app/portal/(app)/files` (`DeskFileClient`) | Rep (`files.update_details`) | The file's details | Corrects them | `/api/portal/desk` `update_file_details`, `updateFileDetails` | | `eng_file_inputs` upsert; audit `file.details_updated` | | not walked yet |
| 3 | `src/app/portal/(app)/files` (`FileClient`) | Staff with `files.transition` | The file's status | Moves it on | `/api/portal/files` `transition`, `transitionFile` | | `eng_files` update, `eng_file_events` insert; audit `file.transition` | | not walked yet |

### 254-WF-010 Dispatch a file to a technician

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/files` (`DispatchPanel`) | Rep, dispatcher, admin (`offers.dispatch`) | The technicians who cover the county and are certified. The technician's pay is shown to admin only (ruling of 2026-10-20) | Sends offers | `/api/portal/field` `send_offers`, `sendOffers` | Each technician offered (`offer.received`) | `eng_assignments` upsert, `eng_files` update, `eng_file_events` insert; audit `offers.send` | | not walked yet |
| 2 | `src/app/portal/(app)/files/dispatch` (`BulkDispatchClient`) | The same | Many files at once | Sends offers in bulk | `/api/portal/files/dispatch`, `sendBulkOffers` | Each technician offered | Through `sendBulkOffers` | | not walked yet |
| 3 | `src/app/portal/(app)/files` (`DeskFileClient`) | Rep | The assigned technician | Releases the technician | `/api/portal/desk` `release_technician`, `releaseAssignment` | The technician (`offer.lost`) | `eng_files` update, `eng_assignments` update; audit `offers.released` | | not walked yet |

The technician's half is 254-WF-029.

### 254-WF-011 Work the sales list

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/prospects` (`ProspectsClient`) | Rep (`crm.use`) | The prospects, sortable and exportable | Adds one, or imports a list | `/api/portal/prospects` `create` and `import` | | `eng_prospects` insert; audits `prospect.created`, `prospect.imported` | | not walked yet |
| 2 | `src/app/portal/(app)/prospects/[id]` (`ProspectClient`) | Rep | One prospect | Updates them, or converts them to an account | `update`; `convert`, `convertProspect` | The new account holder (`accountWelcome`) on a conversion | `eng_prospects` update; audits `prospect.updated`, `prospect.converting`, `prospect.converted` | | not walked yet |

### 254-WF-012 Ask for a refund

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/refunds` (`RefundClient`) | Rep (`refunds.request`) | The order and the request form | Requests a refund | `/api/portal/refunds` `request`, `requestRefund` | Not found in code: no notice is raised to whoever decides it; it waits on the refunds screen | `eng_refund_requests` insert; audit `refund.requested` | | not walked yet |

The decision is 254-WF-015.

### 254-WF-013 Look up an order for a caller

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/order-lookup` | Rep (`orders.read`) | Orders found by any field, exportable (`/api/portal/order-lookup`) | Searches | | | | | not walked yet |
| 2 | `src/app/portal/(app)/order-lookup/[id]` | Rep (`orders.resend_link`) | One order | Resends the status link | `/api/portal/desk` `resend_status_link`, `resendStatusLink` | The buyer | Audit `order.status_link_resent` | | not walked yet |
| 3 | `src/app/portal/(app)/search` | Any staff | One search over orders, customers, prospects and addresses | Searches | | | | | not walked yet |

### 254-WF-014 Tasks and messages

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/tasks` (`TasksClient`) | Any staff (`tasks.use`) | Their tasks | Creates, assigns or closes a task; seeds the compliance tasks | `/api/portal/comms` `create_task`, `assign_task`, `set_task_status`, `seed_compliance` | The assignee (`task.assigned`). `task.due` is declared and not found raised anywhere in code | `eng_tasks` insert or update; audits `task.create`, `task.assign`, `task.status` | | not walked yet |
| 2 | `src/app/portal/(app)/messages` (`MessagesClient`), and a file's thread (`FileThreadButton`) | Any staff (`messages.use`) | Threads and channels | Opens a thread, posts, attaches, searches | `open_file_thread`, `open_direct`, `create_channel`, `post_message`, `prepare_attachment`, `search_messages` | Thread members (`message.received`); anybody named (`mention`) | `eng_threads`, `eng_thread_participants`, `eng_messages`; audit `channel.create` | | not walked yet |
| 3 | `src/app/portal/(app)/profile` (`PreferencesForm`) | Any staff | Their notice preferences | Turns email off or on per kind | `save_preference`, `savePreference` | | `eng_notification_prefs` upsert | The three mandatory kinds cannot be turned off | not walked yet |

---

## Ops manager

### 254-WF-015 Decide a refund

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/refunds` (`RefundClient`) | Ops manager up to the limit (`refunds.approve_within_limit`); admin | The requests, exportable (`/api/portal/refunds/export`) | Approves or refuses one | `/api/portal/refunds` `decide`, `decideRefund` | Not found in code: no notice to the rep who asked | `eng_refund_decisions` insert | | not walked yet |
| 2 | `src/app/portal/(app)/refunds` | Admin | The approval limit | Sets it | `set_limit`, `setRefundLimit` | | `eng_refund_approval_limits` insert; audit `settings.refund_limit_set` | The limit is also shown on `src/app/portal/(app)/settings` | not walked yet |
| 3 | `src/app/portal/(app)/orders` (`OrdersClient`) | Admin (`payments.refund`) | The order | Cancels it and refunds | `/api/portal/orders/refund`, `cancelAndRefund` | The buyer (`orderCancelled`, then `refundSucceeded` or `refundFailed`) | `eng_order_payments` insert, `eng_service_orders` update; audit `order.cancelled_by_firm` | Not found in code: what joins an approved request (step 1) to the money moving (step 3). They read as two separate acts | not walked yet |

### 254-WF-016 Bring a technician on from a careers application

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/(site)/careers/[slug]` (`ApplicationFlow`) | An applicant | The open role and the application | Applies, with uploads (`/api/upload`) | `/api/apply`, `insertStructuredApplication` | The firm's inbox (`applicationNotification`); the applicant (`applicantConfirmation`) | `eng_applications` insert | | not walked yet |
| 2 | `src/app/portal/(app)/applications` | Ops manager, admin | The applications | Reads one | | | | | not walked yet |
| 3 | `src/app/portal/(app)/onboarding` (`OnboardingClient`) | Ops manager (`technicians.onboard`), admin | The application | Invites them from it | `/api/portal/onboarding` `invite_from_application`, `inviteFromApplication` | Nobody by email: the screen shows the link once, "Send this to them" | `eng_onboardings` update, `eng_applications` update; audit `onboarding.invite_from_application` | The link is delivered by hand, outside the platform. The `onboardingInvite` template exists and nothing calls it: **[NO SCREEN]** for sending it | not walked yet |
| 4 | `src/app/(site)/onboarding/[token]` (`OnboardingFlow`) | The technician | Their checklist | Uploads and acknowledges each item | `/api/onboarding`: `createOnboardingUpload`, `markItemUploaded`, `markItemAcknowledged`, `setStatus` | The firm's inbox (`onboardingSubmitted`) | `eng_onboarding_items` update, `eng_onboardings` update | | not walked yet |
| 5 | `src/app/portal/(app)/onboarding` | Ops manager | The submission | Sets item dates and coverage, then activates | `set_item_dates`, `set_coverage`, `activate` (`activateTechnician`, which creates the portal account) | Nobody by email: the screen shows the set password link | `eng_onboarding_items` update, `eng_onboardings` update, `eng_credentials` insert, `eng_profiles` update; audits `onboarding.set_dates`, `onboarding.set_coverage`, `onboarding.activate` | The set password link is delivered by hand | not walked yet |
| 6 | `src/app/portal/(public)/set-password` | The technician | The password form | Sets a password | `/api/portal/set-password`, `consumeTokenAndSetPassword` | | `eng_auth_tokens` update, `eng_profiles` update, `eng_audit_events` insert | | not walked yet |

### 254-WF-017 Keep a technician's credentials and training current

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/certification` (`SubmitCredentialForm`) | Technician | Their credentials | Submits a new one | `/api/portal/onboarding` `submit_credential` | | `eng_credentials` insert and update; audit `credential.submitted` | | not walked yet |
| 2 | `src/app/portal/(app)/techs` (`VerificationQueue`) | Ops manager, admin | Submitted credentials | Verifies or rejects one | `verify_credential`, `reject_credential` | Not found in code | Not found in code: neither function writes directly, and what each records was not traced | | not walked yet |
| 3 | `src/app/portal/(app)/techs/[id]` (`RecordCredentialForm`) | Ops manager, admin | One technician | Records a credential seen | `record_credential`, `recordCredential` | The technician as it nears expiry (`credential.expiring`, mandatory email; the daily `credentials.refresh_tasks` job) | `eng_credentials` insert; audit `credential.recorded` | | not walked yet |
| 4 | `src/app/portal/(app)/techs/[id]` (`RecordTrainingForm`, `AttachConfirmationForm`) | Ops manager, admin | Their training | Records training, and attaches the engineer's written confirmation of a relayed approval | `record_training`, `attach_relayed_confirmation` | | `eng_training_records` insert, `eng_training_confirmations` insert | | not walked yet |
| 5 | `src/app/portal/(app)/techs/[id]` (`CoverageForm`), `src/app/portal/(app)/techs` (`TechsClient`) | Ops manager, admin | Coverage and base | Sets coverage counties and base | `set_coverage` (`setTechCoverage`), `/api/portal/field` `set_tech_base` | | `eng_profiles` update; audits `profile.coverage_set`, `profile.set_base` | | not walked yet |
| 6 | none | Admin | | Withdraws or restores a certification | `/api/portal/onboarding` `revoke_certification` and `restore_certification` exist | The technician (`certification.revoked`, mandatory email) | `eng_certifications` update; audits `certification.revoke`, `certification.restore` | **[NO SCREEN]**: no screen sends either action | not walked yet |

### 254-WF-018 Keep the firm's insurance on record

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/insurance` (`InsuranceClient`) | Ops manager, admin (`insurance.manage`) | The policies and their certificates | Records a policy with its certificate PDF, or withdraws one; opens a certificate (`certificateLink`) | `/api/portal/insurance`, `recordPolicy`, `withdrawPolicy` | The office and the owner at 45, 14 and 1 days (`insurance.expiring`, mandatory email; the daily `insurance.expiry_alerts` job) | `eng_insurance_policies` insert or update (0090) | | not walked yet |
| 2 | none | Admin | | Extends the insurance override while ordering stays live | `insuranceOverride` in `src/config/credentials.ts` (Robert's ruling of 23:49 Central, 2026-10-25, to 2026-12-31) | | | **[NEEDS SQL, A SCRIPT OR A CODE EDIT]**: a code edit to `src/config/credentials.ts`. Since 2026-10-27 `/portal/launch` shows the override, who set it, its expiry and the edit, under "Switches stated in configuration"; a screen that sets it waits on Robert's ruling, because the gate reads only configuration (`CLAUDE.md` section 1) | not walked yet |

### 254-WF-019 Read the reports

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/reports` | Ops manager (revenue, pipeline, turnaround, activity); admin also production | The reports | Reads and exports one | `/api/portal/exports`; a large export is queued (`report.export`) | | Audit of the export; `eng_jobs` insert | | not walked yet |
| 2 | `src/app/portal/(app)/clients` | Staff with `clients.list` | The client list | Exports it | `/api/portal/clients/export` | | | | not walked yet |
| 3 | `src/app/portal/(app)/files` (`FileSelection`) | Staff with `files.list` | Selected files | Exports them | `/api/portal/files/export`, `exportFiles` | | Audit `export.files.selected` | | not walked yet |

---

## Admin and owner

### 254-WF-020 Give somebody a staff account

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | none | The owner | | Creates the first administrator | `ALLOW_PRODUCTION_DB=1 npx tsx scripts/seed-admin.mjs "Name" email` (`CLAUDE.md` section 6b) | | `eng_profiles` | **[NEEDS SQL, A SCRIPT OR A CODE EDIT]**: `scripts/seed-admin.mjs`, by design for the first account only | not walked yet |
| 2 | `src/app/portal/(app)/people` (`PeopleClient`) | Admin (`profiles.create`) | The staff | Creates an account with a role; asks for the role's invite fields (a license for an engineer, coverage for a technician) | `/api/portal/people` `create`, `createAccount` | The new person (`portalInvite`) | `eng_profiles` insert, `eng_audit_events` insert | | not walked yet |
| 3 | `src/app/portal/(app)/people` | Admin | One person | Resends the invite, forces a reset, suspends or restores | `resend_invite`, `force_reset`, `suspend`, `restore` | The person (`portalInvite` or `portalPasswordReset`) | `eng_auth_tokens` delete and insert, `eng_audit_events` insert | | not walked yet |
| 4 | `src/app/portal/(app)/roles` (`RolesClient`) | Admin (`roles.manage`) | Roles and their grants | Changes grants, assigns a role, creates or deletes a role | `/api/portal/roles` `set_grants`, `set_user_role`, `create_role`, `delete_role` | | `eng_role_grants`, `eng_profiles` update, `eng_roles`; audits `role.grants_changed`, `role.assigned`, `role.created`, `role.deleted` | | not walked yet |
| 5 | `src/app/portal/(app)/profile` (`PasswordForm`) | Any staff | Their profile | Changes their own password | `/api/portal/password`, `changeOwnPassword` | | `eng_audit_events` insert | | not walked yet |

### 254-WF-021 Sign in to the portal with a second factor

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(public)/login` (`LoginForm`) | Any staff | The sign in form | Signs in | `/api/portal/session`: `verifyCredentials`, `mfaRequirementFor`, then a session or a pending one | | `eng_sign_in_attempts` insert, `eng_audit_events` insert | Required today for the engineer only: 0025 made admin optional, and the development sitting of 0093 read admin, ops manager and rep optional. 0093 makes the administrator, the operations manager and the rep required, and is not yet on production; the owner's administrator account is exempt in code, as an owner override with an audit row every time (`src/lib/sign-in-factor.ts`, on `migration/0093-second-factor-for-staff`) | not walked yet |
| 2 | `src/app/portal/(public)/mfa/enrol` (`EnrolForm`) | Staff with no enrolment | A QR code, then recovery codes | Enrols, confirms a code, says the codes are saved | `/api/portal/mfa` `begin`, `confirm`, `codes_saved` | | `eng_mfa_enrolments`, `eng_mfa_recovery_codes`, `eng_audit_events` | | not walked yet |
| 3 | `src/app/portal/(public)/mfa` (`MfaChallengeForm`) | Enrolled staff | The code prompt, and the break glass door | Types a code, or uses break glass | `answerChallenge`; `break_glass` | | `eng_sign_in_attempts`, `eng_mfa_enrolments`, `eng_audit_events` | | not walked yet |
| 4 | none | Admin | | Releases a sign in lock | `/api/portal/unlock` (`inspectLock`, `releaseLock`) with the operator's token | | `eng_audit_events` insert | **[NO SCREEN]**: no screen calls it | not walked yet |

### 254-WF-022 Open and run a customer account

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/accounts` (`OpenAccountClient`) | Admin (`accounts.manage`) | The open account form | Opens an account from a call | `/api/portal/accounts/create`, `createCustomerAccount` | The person (`accountWelcome`, a set password link) | `eng_clients`, `eng_customer_accounts`, `eng_customer_users` insert; audit `customer_account.create` | | not walked yet |
| 2 | `src/app/portal/(app)/accounts/[id]/pricing` (`TradePricingClient`) | Admin | The account's trade prices against the floors | Sets a trade price | `/api/portal/accounts/pricing`, `setTradePrice` | | Through the database function; audit `trade_price.set` | | not walked yet |
| 3 | none | Admin | | Sets an account's credit limit and terms | `/api/portal/accounts` `set-terms` exists | | `eng_customer_accounts` update, `eng_audit_events` insert | **[NO SCREEN]**: no screen sends `set-terms` | not walked yet |
| 4 | `src/app/portal/(app)/accounts` (`AccountsClient`) | Admin | An account's period | Closes the period, then issues the statement | `close-period` (`closePeriod`), `issue-statement` (enqueues `statement.issue`, which runs `issueStatement`) | Nobody: `issueStatement` "writes rows and nothing else: it does not email the account" (`src/lib/job-handlers.ts`). The account holder sees it on `/account/statements` | `eng_statements` and `eng_statement_lines` insert, `eng_service_orders` update; audit `statement.period_closed`; `eng_jobs` insert | | not walked yet |
| 5 | `src/app/portal/(app)/accounts` | Admin | An account holder | Sends a password reset | `/api/portal/accounts/reset-password` | The person (`passwordReset`) | Audit `customer_account.reset_link_issued` | | not walked yet |

### 254-WF-023 Mend an order

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/orders` (`OrdersClient`) | Admin (`payments.reconcile`) | Orders and payments that disagree with Stripe | Reconciles | `/api/portal/orders/reconcile`, `reconcileAll`, enqueues `orders.reconcile` | | `eng_jobs` insert, `eng_audit_events` insert | | not walked yet |
| 2 | `src/app/portal/(app)/orders` (`AttachAccountClient`) | Admin (`accounts.manage`) | An order with no account | Attaches it to one | `/api/portal/orders/attach-account`, `attachOrderToAccount` | The buyer (`orderConfirmed`) | `eng_service_orders` update; audit `order.account_attached` | | not walked yet |
| 3 | `src/app/portal/(app)/orders` | Admin | An order | Cancels and refunds | As 254-WF-015 step 3 | | | | not walked yet |

### 254-WF-024 Open the firm for work

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/launch` | Admin | `launchReadiness()`: each unmet condition, who clears it and where it is stated | Reads | Nothing; the screen computes nothing itself | | | | not walked yet |
| 2 | none | The owner, with a deploy | | States a condition met: the operator's switch `LAUNCH_MODE`, `verifiedFirmRegistrations`, `verifiedEngineers`, `stripeAccount`, `offeredServiceLines`, `verifiedTechnicianTraining`, `pointInTimeRecovery`, `selfServiceSignup`, `FIRM_PHONE` | A rebuild, because the pages are prerendered | | | **[NEEDS SQL, A SCRIPT OR A CODE EDIT]**: `src/config/credentials.ts`, `src/config/launch-readiness.ts` and environment variables, by design (`CLAUDE.md` section 1: "a compliance state that could change without a deploy leaving an audit trail is not one this firm should want") | not walked yet |
| 3 | none | Admin | | Runs the proving charge, a live charge and its refund that proves the Stripe account | `/api/portal/proving-charge`, `provingChargeBlockers`, `startProvingCheckout` | | | **[NO SCREEN]**: no screen calls it | not walked yet |
| 4 | none | Admin | | Tells the waitlist the firm is open | The `launchAnnouncement` template exists, sent by `src/lib/ops-announce.ts` | The waitlist | | **[NO SCREEN]**: nothing in `src` calls it; only the audits read it | not walked yet |
| 5 | `src/app/portal/(app)/pricebook` | Admin | The price book: price, technician rate, tier, floor and what a clean job makes, per line | Reads | | | | Changing a price is **[NEEDS SQL, A SCRIPT OR A CODE EDIT]**: `src/config/prices.ts`, pinned again in `price-book-audit` on purpose so a change costs two edits (`CLAUDE.md` section 6c). A trade floor is `src/config/trade-floors.ts` | not walked yet |
| 6 | none | Admin | | Opens or closes a service line for sale | `offeredServiceLines` in configuration and the deploy; a signed protocol is read from the database (ruling 11) | | | **[NEEDS SQL, A SCRIPT OR A CODE EDIT]**, by design: opening a line takes a deploy and the operator's word; a voided signature closes it without one | not walked yet |

### 254-WF-025 Credit production and pay technicians

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/billing` (`UncreditedReviews`) | Admin | Reviews the engineer finished that are not yet credited | Credits them | `/api/portal/review` `credit`, `creditUncreditedReviews` | | `eng_files` update, `eng_production_ledger` insert; audits `file.deliverable_recorded`, `ledger.credited_late` | | not walked yet |
| 2 | `src/app/portal/(app)/techs` (`TechsClient`) | Admin | The technician pay ledger, written when evidence is submitted | Marks an entry's status | `/api/portal/field` `set_ledger_status`, `setLedgerStatus` | | `eng_tech_pay_ledger` update; audit `ledger.update` | | not walked yet |
| 3 | `src/app/portal/(app)/pay` | Technician | What they have earned and what has been paid, the ledger behind their dashboard totals | Reads | | | | | not walked yet |

### 254-WF-026 Keep the platform running

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | none | The scheduler | | `/api/cron/daily`, `/api/cron/jobs`, `/api/cron/health-watch` | Daily jobs (`metrics.rollup`, `credentials.refresh_tasks`, `insurance.expiry_alerts`), the queue, and the health watch | The firm: `outageAlert`, `queueAlert`, `retentionAlert`, `unreleasedPaymentsAlert`, `errorAlert` | `eng_cron_runs`, `eng_jobs`, `eng_alert_state`, `eng_error_events` | **[NO SCREEN]** by design: the scheduler | not walked yet |
| 2 | `src/app/portal/(app)/queue` (`QueueClient`) | Admin (`jobs.manage`) | The job queue and its dead letters | Retries a dead job | `/api/portal/queue`, `retryDeadJob` | | `eng_jobs` update, `eng_audit_events` insert | | not walked yet |
| 3 | `src/app/portal/(app)/status` (`StatusClient`) | Admin (`jobs.manage`) | Errors by type | Mutes an error type | `/api/portal/status`, `muteErrorType` | | `eng_error_types` update, `eng_audit_events` insert | | not walked yet |
| 4 | `src/app/portal/(app)/audit` | Admin, read only (`audit.read`) | The audit trail | Reads | | | | | not walked yet |
| 5 | `src/app/portal/(app)/settings`, `src/app/portal/(app)/credentials` | Admin | The values the firm sets, and the credentials record | Reads and sets the refund limit | As 254-WF-015 step 2 | | | | not walked yet |

### 254-WF-027 Records retention, suppressions and requests to be forgotten

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/suppressions` (`SuppressionsClient`) | Customer service, admin (`suppressions.manage`) | The suppression list | Records that somebody asked, by telephone, to stop hearing from the firm; voids an operator entry | `/api/portal/suppressions`, `suppress`, `voidOperatorEntry` | | `eng_marketing_suppressions` upsert or update, `eng_audit_events` insert | | not walked yet |
| 2 | `src/app/portal/(app)/deletion-requests` (`DeletionRequestsClient`) | Customer service, admin (`suppressions.manage`) | Requests to be forgotten | Records one, then answers it | `/api/portal/deletion-requests`, `recordDeletionRequest`, `answerDeletionRequest` | | `eng_deletion_requests` insert and update, `eng_audit_events` insert | A request produces a task, not a deletion, by ruling: what the firm may delete is with counsel and TBPELS (`src/lib/deletion-requests.ts`) | not walked yet |
| 3 | none | The operator | | Plans and enqueues a retention pass | `npm run retention-dry-run` (`scripts/retention-dry-run.mjs`), then the `retention.sweep` job; the floor and the deletable tables are in `src/lib/retention-policy.ts` | | `eng_retention_runs`; deletes from `eng_cron_runs` and `eng_jobs` only | **[NEEDS SQL, A SCRIPT OR A CODE EDIT]** and **[NO SCREEN]**, both by ruling: a pass that ran itself, or that a screen could start, before anybody had read one is what the dry-run-first ruling prevents (`BACKLOG.md`, "Retention has no screen and no schedule, on purpose") | not walked yet |
| 4 | `src/app/portal/(app)/documents`, `src/app/portal/(app)/documents/binder/[fileId]` | Admin and staff with `documents.read` | The sealed documents and a file's binder | Opens a document, exports a binder | `/api/portal/documents` (`documentUrl`), `/api/portal/exports` (`binderFor`, the `document.binder` job) | | `eng_audit_events` insert; `eng_jobs` insert | | not walked yet |

### 254-WF-028 Run the partner program

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/partners` (`NewPartner`) | Admin (`partners.manage`) | The partners | Creates one | `/api/portal/partners`, `createPartner` | | `eng_partners` insert; audit `partner.created` | | not walked yet |
| 2 | `src/app/portal/(app)/partners/[id]` (`PartnerActions`) | Admin | One partner | Invites a partner user | `/api/portal/partners/[id]`, `invitePartnerUser` | Nobody by email: "a set password link was issued for (address), to be delivered by hand" | `eng_partner_users` insert | The link is delivered by hand, outside the platform | not walked yet |
| 3 | `src/app/portal/(app)/partners/[id]` | Admin | Status and terms | Changes status, sets terms | `setPartnerStatus`, `setPartnerTerms` | | `eng_partners` update, `eng_partner_terms`; audits `partner.status_changed`, `partner.terms_set` | | not walked yet |
| 4 | `src/app/portal/(app)/partners/[id]` | Admin | Submitted materials and the uploaded logo | Decides each | `decideSubmission`, `decidePartnerLogo` | | `eng_partner_submissions` update | | not walked yet |
| 5 | `src/app/portal/(app)/partners/[id]` | Admin | The partner's period | Closes it, issues the statement, records the payout or an adjustment | `closePartnerPeriod`, `issuePartnerStatement`, `recordPartnerPayout`, `recordAdjustment` | | `eng_partner_statements`, `eng_partner_entries`; audits `partner.period_closed`, `partner.statement_issued`, `partner.payout_recorded`, `partner.adjustment` | The payout itself is made outside the platform; the screen records it | not walked yet |
| 6 | `src/app/portal/(app)/partners/disputes` (`LookupForm`) | Admin | Every touch behind an order's attribution, the losing ones too (0014, 0022) | Looks up a dispute | | | | | not walked yet |

---

## Field technician

### 254-WF-029 Take an offered job

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/jobs` (`JobsClient`) | Technician | The jobs offered to them | Accepts one | `/api/portal/field` `accept_offer`, `acceptOffer`, then `notifyTechnicianAccepted` | The other technicians offered (`offer.lost`); the buyer (`orderTechnicianAccepted`) | `eng_files` update, `eng_assignments` update; audit `offer.accept` | | not walked yet |
| 2 | `src/app/portal/(app)/jobs` | Technician | The same | Declines one | `decline_offer`, `declineOffer` | | `eng_assignments` update, `eng_file_events` insert; audit `offer.decline` | | not walked yet |

### 254-WF-030 Capture on site and submit the evidence

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/jobs/[id]` (`CaptureClient`) | Technician | The protocol's checklist for this job | Captures each item: a photo, a reading or an answer. Captures queue on the device when offline (`src/lib/offline-queue.ts`) and send when the connection returns | `/api/portal/field` `sign_upload`, then `record_capture` (`recordCapture`) | | `eng_evidence_items` upsert | | not walked yet |
| 2 | `src/app/portal/(app)/jobs/[id]` | Technician | An item that cannot be captured | Records an exception, or withdraws one | `record_exception` (from the offline queue), `withdraw_exception` | | `eng_checklist_exceptions` upsert or delete | | not walked yet |
| 3 | `src/app/portal/(app)/jobs/[id]` | Technician | The repair items, on a repairs job | Verifies one closed | `close_repair_item`, `closeRepairItem` | | `eng_repair_items` update; audit `repair.verified` | | not walked yet |
| 4 | `src/app/portal/(app)/jobs/[id]` | Technician | What blocks submission, or a ready package | Submits the evidence | `submit_evidence`, `submitEvidence` | The engineer (`evidence.submitted`) | `eng_tech_pay_ledger` insert | | not walked yet |
| 5 | none | Technician | | Deletes a capture | `delete_capture` exists (`deleteCapture`) | | `eng_evidence_items` delete | **[NO SCREEN]**: no screen and not the offline queue sends it | not walked yet |
| 6 | Notice only | Technician | The engineer sent the file back | Captures again from step 1 | From 254-WF-033 | The technician (`review.revisions`) | | | not walked yet |

### 254-WF-031 Get certified on a protocol

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/certification` (`CertificationClient`) | Technician | Each line with a protocol in force and their standing on it | Takes the check | `/api/portal/onboarding` `submit_attempt`, `submitAttempt` (scored on the server) | | `eng_certification_attempts` insert, `eng_certifications` upsert, `eng_profiles` update | | not walked yet |
| 2 | `src/app/portal/(app)/protocols` (`ProtocolsClient`) | Admin | A protocol's check questions | Adds or removes a question | `add_question`, `remove_question` | | `eng_protocol_questions` insert or delete; audit `protocol.question_add` | | not walked yet |
| 3 | `src/app/portal/(app)/review` (`TrainingDecisionPanel`) | Engineer | A technician's training to decide | Decides it | `/api/portal/review` `training_decision`, `decideTraining` | | `eng_training_decisions` insert, `eng_certifications` upsert, `eng_profiles` update | | not walked yet |

---

## Engineer

### 254-WF-032 Put a protocol in force, and keep a seal on file

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | none | The firm | | Transcribes the protocol the engineer sent, verbatim, into `src/content/protocols/`, checked against his document by `protocol-registry-audit` | A deploy | | | **[NEEDS SQL, A SCRIPT OR A CODE EDIT]**, by design: a signed document is carried exactly and checked against its source (`CLAUDE.md` section 3) | not walked yet |
| 2 | `src/app/portal/(app)/protocols` (`SignProtocolPanel`) | Engineer, his own session with a fresh second factor (`verifyFreshCode`) | The transcription he is asked to sign | Signs it | `/api/portal/protocols/sign`, `signProtocol`, the database function `eng_record_protocol_signature` | | Through the database function; the signature puts the protocol in force (ruling of 2026-10-06) | | not walked yet |
| 3 | `src/app/portal/(app)/protocols` (`SignAddendumPanel`) | Engineer | A scope addendum the owner drafted | Signs it | `/api/portal/addenda/sign`, `signAddendum`, `eng_record_addendum_signature` | | Through the database function | | not walked yet |
| 4 | `src/app/portal/(app)/profile/seal` (`SealImageForm`) | Engineer | His stored seal and signature, never displayed elsewhere | Uploads them | `/api/portal/seal`, `uploadSealImage`, `eng_record_seal_image` | | Through the database function | | not walked yet |
| 5 | `src/app/portal/(app)/protocols` (`ProtocolsClient`) | Admin | A protocol record | Creates one, adds or removes an item, approves one | `/api/portal/field` `create_protocol`, `add_protocol_item`, `remove_protocol_item`, `approve_protocol` (`eng_approve_protocol`) | | `eng_protocol_templates` insert, `eng_protocol_items`; audits `protocol.create`, `protocol.item_add`, `protocol.item_remove`, `protocol.approve` | | not walked yet |

### 254-WF-033 Review a file and seal its letter

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/review`, `src/app/portal/(app)/waiting` | Engineer | The files waiting for him | Opens one | `/api/portal/review` `open_review`, `openReview` | | `eng_files` update, `eng_review_sessions` insert | | not walked yet |
| 2 | `src/app/portal/(app)/review` (`PrereviewPanel`) | Engineer | A file held for his pre-review | Records the pre-review | `prereview`, `recordPrereview` | | `eng_file_events` insert | | not walked yet |
| 3 | `src/app/portal/(app)/review` (`LetterFactsPanels`) | Office staff and engineer | The facts a letter needs | The office records a fact, the engineer confirms one; triage; a capture item added | `/api/portal/letter-facts`: `office_fact`, `engineer_fact`, `triage`, `capture_item` | | `eng_letter_facts` insert, `eng_job_triage` insert, `eng_job_capture_additions` insert; audits `letter.fact_recorded`, `letter.fact_confirmed`, `job.triaged`, `job.capture_item_added` | | not walked yet |
| 4 | `src/app/portal/(app)/review` (`ReviewClient`) | Engineer | The evidence package | Decides: seal, revisions, repairs or refuse | `decide`, `decideReview`, the database function `eng_record_review_decision`, then the `review.after_decision` job | The technician on revisions (`review.revisions`); admin on a refusal (`review.refused`); the buyer on repairs (`orderRepairsRequired`) or a refusal (`orderDeclined`, then the refund) | Through the database function; `eng_jobs` for the after-decision job | | not walked yet |
| 5 | `src/app/portal/(app)/review` (`LetterSealPanel`) | Engineer, his own session with a fresh second factor | The full preview of the letter drafted from his determination | Seals it | `/api/portal/letters` `draft` (`draftForDetermination`), then `seal` (`sealLetter`, `eng_record_letter_seal`), then `settleDecision` | Admin (`review.sealed`); the buyer (`orderSealed`) | `eng_seal_acts` through the database function; audit `letter.sealed`; `refund.none` on the order | | not walked yet |

### 254-WF-034 Keep the responsible charge record

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/portal/(app)/charge-log` (`ChargeLogClient`) | Engineer | His responsible charge log | Records time against a file; exports a month | `/api/portal/review` `record_time`, `recordTime`, `monthlyExport` | | `eng_time_log` insert; audit `time.record` | | not walked yet |

---

## Partner

### 254-WF-035 Join the program

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/partner/(public)/set-password` | A partner user, from the link the admin delivered by hand (254-WF-028 step 2) | The password form | Sets a password | `/api/partner/set-password`, `setPartnerPassword` | | `eng_partner_tokens` update, `eng_partner_users` update, `eng_audit_events` insert | | not walked yet |
| 2 | `src/app/partner/(public)/login` | Partner user | The sign in form | Signs in | `/api/partner/session`, `signInPartner` | | `eng_sign_in_attempts` insert, `eng_partner_users` update, `eng_audit_events` insert | | not walked yet |
| 3 | `src/app/partner/(app)/agreement` (`AcceptForm`) | Partner user | The program agreement | Accepts it | `/api/partner/agreement`, `acceptAgreement` | | `eng_partner_acceptances` insert, `eng_partners` update; audit `partner.agreement_accepted` | | not walked yet |

### 254-WF-036 Refer work and read earnings

| # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/partner/(app)` | Partner user | Their referral code and link, and program billing | Shares the link; starts program billing when it is open | `/api/partner/billing`, `startPartnerCheckout`, while billing is on | | Stripe's webhook: `eng_partner_billing` upsert, `eng_partner_billing_events` insert | | not walked yet |
| 2 | `src/app/partner/(app)/materials` (`SubmitForm`), `LogoUpload` | Partner user | The materials and their logo | Submits material for approval; uploads a logo | `/api/partner/materials` (`submitMaterial`), `/api/partner/branding` (`uploadPartnerLogo`) | Not found in code: no notice to the admin who decides (254-WF-028 step 4) | `eng_partner_submissions` insert, `eng_partners` update; audits `partner.material_submitted`, `partner.logo_uploaded` | | not walked yet |
| 3 | `src/app/partner/(app)/referrals`, `src/app/partner/(app)/statements`, `src/app/partner/(app)/statements/[reference]` | Partner user | Their referrals, statements and earnings | Reads | | | | | not walked yet |

---

## The marks, counted per role

Counted from the tables above. A step carrying both marks is counted once under each.

| Role | [NEEDS SQL, A SCRIPT OR A CODE EDIT] | [NO SCREEN] |
| --- | --- | --- |
| Customer | 1 (254-WF-004 step 1) | 4 (254-WF-001 step 4, 254-WF-002 steps 4 and 5, 254-WF-006 step 2) |
| Rep | 0 | 0 (254-WF-008 step 4 gained a screen on 2026-10-27) |
| Ops manager | 1 (254-WF-018 step 2) | 2 (254-WF-016 step 3, 254-WF-017 step 6) |
| Admin and owner | 5 (254-WF-020 step 1; 254-WF-024 steps 2, 5 and 6; 254-WF-027 step 3) | 6 (254-WF-021 step 4; 254-WF-022 step 3; 254-WF-024 steps 3 and 4; 254-WF-026 step 1; 254-WF-027 step 3) |
| Field technician | 0 | 1 (254-WF-030 step 5) |
| Engineer | 1 (254-WF-032 step 1) | 0 |
| Partner | 0 | 0 |

**Read the counts with the reasons beside them.** Of the eight [NEEDS SQL, A SCRIPT OR A CODE EDIT] steps, six are by standing ruling: the first administrator, the gate's conditions, prices and floors, opening a service line, the protocol transcription, and the retention pass. Each is recorded in `CLAUDE.md` or `BACKLOG.md` with why it is not a screen. The other two, opening self-service sign-up and the insurance override, are gate or override values stated in configuration on the same principle. **Whether each should stay that way is Robert's to confirm, not this document's to decide.** Of the thirteen [NO SCREEN] steps (fourteen until the payment links screen of 2026-10-27), four are machine doors or the scheduler by design: the sister intake door, the sister order door, the account API, and the cron.

## The five that most need a screen, in order

These are the steps where a person has to do something today and nothing they can open lets them, ranked by how often the work arises and whether a customer or the firm's record waits on it.

1. **Resending a payment link, and invoicing an account** (254-WF-008 step 4). The actions exist and no screen sends them. A customer who loses the link from the telephone job cannot be sent another from the portal.
2. **Setting an account's credit limit and terms** (254-WF-022 step 3). `set-terms` exists and no screen sends it, so a trade account's credit cannot be set from the portal, while the bulk order screen decides credit against it.
3. **Withdrawing or restoring a technician's certification** (254-WF-017 step 6). The mandatory-email notice behind it exists, and no screen can start it.
4. **Delivering the technician and partner invitation links** (254-WF-016 steps 3 and 5, 254-WF-028 step 2). Each is shown once on screen and delivered by hand outside the platform; the onboarding invite template exists and nothing sends it.
5. **The proving charge and the launch announcement** (254-WF-024 steps 3 and 4). Both are needed exactly once, at opening, and neither has a screen.

**One gap carries neither mark and belongs beside these.** Issuing an account's statement tells nobody: `issueStatement` writes rows and sends no email (254-WF-022 step 4). An account on terms learns of a statement only by signing in.

## What the code did not show

Recorded so W2 looks at these first rather than trusting a gap in this map:

- what `verifyCredential` and `rejectCredential` record (254-WF-017 step 2);
- whether anybody is told when a refund request is made or decided (254-WF-012, 254-WF-015 step 1), and what joins an approved request to the refund itself (254-WF-015 step 3);
- whether the admin is told when a partner submits material (254-WF-036 step 2).

## Where this sits

The walk that fills the W2 column is Phase W2 of the same instruction: a Playwright run on manual dispatch in GitHub Actions, against development, as probe accounts on `@audit-probe.invalid`. The fixes are W3, by severity, and anything that changes what a customer is charged or what a letter says goes to Robert. The Procedures pages are W4. The plan is recorded in `docs/day-queue.md` on `ops/day` under Robert's instruction of 22:05 Central, 2026-10-26.
