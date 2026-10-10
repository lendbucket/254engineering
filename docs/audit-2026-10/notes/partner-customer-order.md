# Screen notes: partner portal, customer account, public order flow

Reviewer scope: PARTNER (`/partner/*`), CUSTOMER ACCOUNT (`/account/*`), PUBLIC ORDER FLOW (`/order/*`).
Screenshots from `audit-out/partner`, `audit-out/customer`, `audit-out/order`, read against main at d282d5a.
No screenshot in these three folders showed a sign in page where the route is not a sign in screen, so the
capture fault the lead reported does not touch this set. Every redirect seen (signed out to `/partner/login`
or `/account/login`, signed in away from login and sign up) matches `inventory.json`.

Coverage note for the lead: `inventory.json` reaches `/partner/statements/254-P202610-N8TPE` only as its
owner and `/account/orders/254-B2026-DEMO01` only as its owner. No capture tried either as a DIFFERENT
partner or customer. I verified the scoping in source instead (`ops-partner-portal.ts:263-269` filters on
`partner_id` and `reference` together; `account/orders/[reference]/page.tsx:37-44` filters on `account_id`
in the query and 404s otherwise). Both look right, but nothing in this capture run proves it live.

---

## /partner (overview)

Read: `partner__seedPartner__1280.jpg`, `partner__seedPartner__390.jpg`, `partner__partner__1280.jpg`.

1. Purpose: the referral partner's home. What they have earned, what is held back, what is on an issued
   statement, how many referrals, recent ledger entries, and how they are paid.
2. Can do: read four figures, read up to eight recent ledger entries, follow the agreement banner.
3. Cannot do but would need to:
   - See their own commission terms. The agreement says "A commission becomes payable after the holdback
     period recorded on the partner's account", but no screen shows the partner their rate, flat fee or
     holdback length. A partner cannot check a single figure against their terms.
   - See the full ledger. Recent activity is capped at eight rows (`ops-partner-portal.ts:59`) with no link
     to the rest; Statements only shows entries already on an issued statement.
   - Copy or share their referral link. The code is shown as text; the link itself (the URL a client would
     follow) is never printed, and there is no copy button, while Materials has copy buttons for everything else.
   - No expected payment date for "On an issued statement".
4. Contradictions: the probe partner's empty state says "An entry appears here when the firm delivers work
   you referred", while the seed partner's only entry is an adjustment, which is not delivery. Minor.
5. Copy: "Every entry on your ledger, in the order it happened" is untrue past eight entries (see defect 5).
   "In the order it happened" is newest first in practice; say so.

## /partner/referrals

Read: `partner-referrals__seedPartner__1280.jpg`.

1. Purpose: every order credited to the partner's code, with state and commission.
2. Can do: read the list and the attribution rules.
3. Cannot do: open a referral, filter by period or state, or dispute an attribution in the product ("ask
   the firm" is the only route even though `/portal/partners/disputes` exists on the staff side). No export.
4. Contradictions: the list reads at most 100 orders (`ops-partner-portal.ts:143,154`) and passes the
   sample length as the total (`referrals/page.tsx:126`), so above 100 the footer would say "Showing all 100
   records" while the overview's Referrals figure, an exact count (`ops-partner-portal.ts:65-69`), says more.
5. Copy: thirty days is the known item, not re-reported.

## /partner/statements

Read: `partner-statements__seedPartner__1280.jpg`, `partner-statements__seedPartner__390.jpg`.

1. Purpose: statements issued to the partner, with total and paid state.
2. Can do: list issued and paid statements, open one.
3. Cannot do: download a statement (PDF or CSV) for their own books, see a voided statement (status `void`
   is filtered out, `ops-partner-portal.ts:228`, so a statement the partner was told about can disappear
   with no trace), see a year to date total for tax purposes (a 1099 relevant figure for a US referral payee).
4. Contradictions: same capped total pattern as referrals: `.limit(60)` with `total={statements.length}`
   (`statements/page.tsx:84`). Five years of monthly statements would read "Showing all 60 records".
5. Copy: period printed as raw `2026-10`; "October 2026" reads better to a partner.

## /partner/statements/[reference]

Read: `partner-statements-reference-__seedPartner__1280.jpg`.

1. Purpose: one statement and every ledger entry on it.
2. Can do: read the total, state, issue date, entries.
3. Cannot do: download or print it; see the payout reference until paid; contact the firm about one line.
4. Contradictions: none seen.
5. Copy: "The firm pays a partner the way it pays anybody" is vague; the method is on the overview and
   could be shown here.

## /partner/materials

Read: `partner-materials__seedPartner__1280.jpg`.

1. Purpose: approved wording the partner may use, the mandatory disclosure line, and a form to send their
   own wording for approval.
2. Can do: copy the mandatory line and approved assets; submit wording or a URL; see what they sent.
3. Cannot do: be told when an approved asset they are using has been superseded or withdrawn; see why
   something was refused before resubmitting (only "the answer" is promised).
4. Contradictions: the mandatory line at the top names **254 Engineering LLC, F-29811, registered**. The
   approved asset directly below it ("Who performs the work", version 5, published 2026-09-06) tells the
   partner to say the work is carried out by **254 Engineering Services** and that **"Firm registration is
   pending with the Texas Board of Professional Engineers and Land Surveyors"**. Registration issued
   2026-09-10 and was reissued in the LLC's name 2026-09-21. The page tells the partner to use it "as
   written". See defect 2.
5. Copy: "It is always accepted, whatever it says" (`materials/page.tsx:138`) reads as "your wording is
   always approved". It means "always received". "programme" in the assets versus "program" everywhere else.

## /partner/agreement

Read: `partner-agreement__seedPartner__1280.jpg`.

1. Purpose: the current program agreement and the partner's acceptance of it.
2. Can do: read the current version and accept it.
3. Cannot do: read the version they previously accepted, download the accepted text, or see their own
   acceptance record (who, when). There is also no staff screen to publish or edit an agreement: no code in
   `src/` writes `eng_partner_agreements` (only `ops-partner-portal.ts:302` reads it), so a real agreement
   can only reach a partner by a direct database insert.
4. Contradictions:
   - "Nothing has been accepted on this account yet." followed immediately by "This is a newer version than
     the one on file." Nothing is on file. `agreementOutstanding` is `principal.partner.agreementVersion !==
     agreement.version` (`ops-partner-portal.ts:391-393`), which is true for a null version, and the alert
     text does not distinguish first acceptance from an update (`agreement/page.tsx:64-69`). The overview
     banner says "The program agreement has been updated" to the same partner (`page.tsx:48-56`).
   - The agreement body is ONE global document (`currentAgreement`, latest published row) yet its text names
     a specific partner: every partner, including "Audit Seed Partner", reads "Demo Title Partners refers
     clients to...". That is development data, but the model is what makes it possible: a body written for
     one partner is served to all of them. See gap 6.
   - The body says "254 Engineering Services performs and seals the work, contracts with the client" (the
     rendered text is present tense; the current seed at `scripts/seed-field-demo.mjs:1204` says "will
     perform"), while the footer on the same page says 254 Engineering LLC is the firm that will perform it.
5. Copy: the brand name is used as the contracting party in a contract. Per standing law the legal name in
   a sentence is 254 Engineering LLC.

## /partner/login

Read: `partner-login__public__1280.jpg`.

1. Purpose: partner sign in.
2. Can do: sign in.
3. Cannot do: reset a forgotten password; the screen says "ask the firm to send a new link". Customers have
   a self service reset; partners do not.
4. Contradictions: none.
5. Copy: fine.

## /partner/set-password

Read: `partner-set-password__seedPartner__1280.jpg`.

1. Purpose: landing page for an invitation or reset link.
2. Can do: set a password with a valid token. Without one it says the link is not valid.
3. Cannot do: a signed in partner who lands here is offered "Go to sign in" although already signed in, and
   there is no change password function anywhere in the partner portal.
4. Contradictions: none.
5. Copy: fine.

## /account (customer home)

Read: `account__seedCustomer__1280.jpg`, `account__customer__1280.jpg`.

1. Purpose: home for an organisation that orders regularly: start a bulk submission, see orders, settings,
   statements (invoiced accounts only).
2. Can do: navigate to the four areas; sign out.
3. Cannot do: see a summary on arrival (open orders, balance due, overdue statement); see who else is on the
   account; change password.
4. Contradictions: "Start a submission" is offered as a primary button with present tense copy ("One
   submission, one payment, and each property becomes its own file"), and the button leads to "The firm is
   not taking orders yet" (`account/page.tsx:89` has no gate read; `account-order__seedCustomer__1280.jpg`).
5. Copy: see above; the invitation should be gated the same way the destination is.

## /account/order (bulk submission)

Read: `account-order__seedCustomer__1280.jpg`.

1. Purpose: order for several properties at once.
2. Can do today: nothing; the gate is shut and the page says so. Correct by design.
3. Cannot do: no way to leave the properties with the firm ("arranged with the office" with no link or
   phone number on this page).
4. Contradictions: with the home page CTA above.
5. Copy: fine.

## /account/orders

Read: `account-orders__seedCustomer__1280.jpg`, `account-orders__seedCustomer__390.jpg`, `account-orders__customer__1280.jpg` not opened (probe has no orders; source read instead).

1. Purpose: everything the account has ordered, newest first.
2. Can do: open a bulk submission.
3. Cannot do:
   - Open a SINGLE order. Single order rows link to `/order/<reference>` with no token
     (`account/orders/page.tsx:132,142`), and that page opens nothing without one
     (`(order)/order/[reference]/page.tsx:53,96-111`). See defect 1.
   - Filter, search, or see a count. Each of three reads is `.limit(200)` and there is no footer, so a busy
     account silently loses its oldest orders from "Everything this account has ordered".
4. Contradictions: the list says "3 properties, roof inspections" (from `submitted_count`, `page.tsx:118`)
   and the detail page for the same reference is headed "2 properties submitted together" (from
   `accepted_count`, `[reference]/page.tsx:78`). See defect 3.
5. Copy: the batch status renders the raw word "accepted" because `words()` looks batch statuses up in the
   ORDER status map (`page.tsx:112`), which has no `accepted` key.

## /account/orders/[reference]

Read: `account-orders-reference-__seedCustomer__1280.jpg`.

1. Purpose: one bulk submission: accepted properties with their share, and the ones not taken.
2. Can do: read it.
3. Cannot do: open any property's own status (the per property references are plain text, not links),
   download an invoice or receipt, see the per property timeline or the sealed letter when there is one,
   cancel a property that has not been attended.
4. Contradictions: heading "2 properties submitted together" when three were submitted and one was not
   taken (defect 3). "Accepted and paid" here while `/account/statements` shows the same $1,275.00 issued and
   unpaid; I traced `paid_at` on batches and only card checkout sets it (`ops-payments.ts:338-340`), so this
   is most likely an impossible seed state rather than a product defect. Not counted.
5. Copy: fine.

## /account/settings

Read: `account-settings__seedCustomer__1280.jpg` (reader), `account-settings__customer__1280.jpg` (owner).

1. Purpose: account defaults (billing contact, statement address, standing access notes, turnaround,
   counties), saved properties, API keys.
2. Can do: owner edits and saves, adds and removes properties, creates and revokes keys. Reader sees
   everything read only, which the screen explains.
3. Cannot do: manage users (invite, remove, change role), see who the owner is (a reader is told "Only an
   account owner can change them" with no name), change their own password, set notification preferences.
4. Contradictions: a card paying account is offered "Where statements go", while its statements page says
   "no statements are produced".
5. Copy: a read only reader is shown the API key prefix and label; harmless, but the reader cannot act on it.

## /account/statements

Read: `account-statements__seedCustomer__1280.jpg`, `account-statements__customer__1280.jpg`.

1. Purpose: invoiced accounts see statements and pay outstanding ones; card accounts are told none exist.
2. Can do: see issued and unpaid total, not yet billed total, each statement, pay one by card.
3. Cannot do: open a statement to see its lines (which orders it bills), download it as an invoice or PDF,
   see past payments with receipts. A statement due 10/4/2026 is shown on 2026-10-10 with no overdue mark
   (`statements/page.tsx:99-100` prints "due" and nothing else).
4. Contradictions: date format `10/4/2026` here versus `Sep 4, 2026` on orders.
5. Copy: fine.

## /account/login

Read: `account-login__public__1280.jpg`.

1. Purpose: customer sign in, with a side column describing the roof certification.
2. Can do: sign in, reset password.
3. Cannot do: n/a.
4. Contradictions: the side column (`login/page.tsx:215-256`) is headed by "Order online", "We visit", "An
   engineer decides... You can follow each step in your account. We email you when it is issued", on a
   signed out page while every order door says the firm is not taking orders. "You can follow each step in
   your account" is also untrue for a single order (defect 1).
5. Copy: "Order online" and "We visit" are present tense service and invitation claims under a shut gate.
   The code comment says the heading was fixed for exactly this; the step titles were not. Regulatory copy,
   needs the operator's ruling.

## /account/sign-up

Read: `account-sign-up__public__1280.jpg`.

1. Purpose: self service account creation; closed today, correctly.
2. Can do: nothing but go to sign in.
3. Cannot do: request an account online (a form for the office would be the natural substitute).
4. Contradictions: none.
5. Copy: fine.

## /account/forgot-password

Read: `account-forgot-password__public__1280.jpg`.

1. Purpose: email a reset link. 2. Can do: request it. 3. Nothing missing for the role. 4. None. 5. Fine.

## /account/set-password

Read: `account-set-password__customer__1280.jpg`.

1. Purpose: landing page for reset or invitation links.
2. Can do: set a password with a valid token.
3. Cannot do: a signed in customer is offered "Go to sign in". No change password inside settings, and
   `/account/forgot-password` redirects a signed in customer to settings, which has none.
4. Contradictions: none.
5. Copy: fine.

## /order/start/[slug] (roof-inspections)

Read: `order-start-roof-inspections__public__1280.jpg`, `order-start-slug-__public__390.jpg`.

1. Purpose: start a single order for a service.
2. Can do: today, only contact the firm or read the service page. Correct while the gate is shut.
3. Cannot do: leave details on this page (it sends the visitor to a separate contact page).
4. Contradictions: the slug is `roof-inspections` and the page is "Roof certifications"; the kicker is
   title case "Roof Certifications" over a sentence case h1.
5. Copy: fine.

## /order/[reference] (signed link status page)

Read: `order-reference-__public__1280.jpg`, `order-reference-__public__390.jpg`,
`order-254-B2026-000000__public__1280.jpg`.

1. Purpose: a customer follows one order by a signed link: where it is, what happened, what they paid,
   what they receive, and the refund terms they were shown.
2. Can do: read status, timeline (Central time, labelled), price lines, deliverable, stored disclosure;
   download a sealed letter when one exists.
3. Cannot do: download a receipt or invoice; request a fresh link (the page says reply to an email); see
   the scheduled visit date or give access notes; cancel before attendance; contact the firm about this order
   from the page.
4. Contradictions:
   - The refusal page says "The firm emails a link when an order is paid for" (`page.tsx:104-105`); the
     paid landing on the same route says the link is emailed "once it is released for work"
     (`page.tsx:87`), which is what the code does.
   - A bulk reference (`254-B2026-000000`) gets "This link does not open an order", and a real bulk
     reference would too: a batch is only viewable at `/account/orders/<ref>`.
5. Copy: the timeline entry "The order confirmation was sent to <address>." is written when the email was
   QUEUED, not sent (defect 4).

---

## Defect candidates

Every item: CANDIDATE, needs reproduction.

1. **A signed in customer cannot open their own single orders from "Your orders".**
   Screen: `/account/orders`. Screenshot: none shows it (the seed customer has only a batch); found in source.
   What: single order rows link to `/order/${reference}` with no token (`src/app/account/orders/page.tsx:132`
   and `:142`). `/order/[reference]` only opens with `?token=` (`src/app/(order)/order/[reference]/page.tsx:53`,
   `:96-111`) and otherwise says "This link does not open an order". The account's own copy promises "with
   where each one has got to", and the login page promises "You can follow each step in your account".
   Why a defect: every single order row on the list is a dead link to a refusal page; the screen claims to
   show orders and their progress. Reproduce: an account with one non batch order, click its reference.

2. **Approved partner material tells partners the firm's registration is pending, under the wrong name.**
   Screen: `/partner/materials`. Screenshot: `partner-materials__seedPartner__1280.jpg`.
   What: the "Who performs the work" asset, version 5 of 2026-09-06, says the work is carried out by
   254 Engineering Services and "Firm registration is pending with the Texas Board...". The asset body is
   composed with `registrationStatement()` at publish time (`scripts/seed-field-demo.mjs:1331-1335`), so the
   sentence is frozen at whatever the register said that day, and an approved version never changes.
   Nothing re-checks a published asset when the register changes. The same page's mandatory line, derived
   live, says 254 Engineering LLC, registered, F-29811.
   Why a defect: the product hands partners a compliance sentence about the firm that has been false since
   2026-09-10 and tells them to use it as written; a fact with two homes, one frozen. The row is development
   data, but the mechanism (a frozen derived compliance sentence in an immutable asset) is the product's.

3. **Bulk order list and bulk order page disagree on how many properties were submitted.**
   Screen: `/account/orders` and `/account/orders/254-B2026-DEMO01`.
   Screenshots: `account-orders__seedCustomer__1280.jpg` ("3 properties") and
   `account-orders-reference-__seedCustomer__1280.jpg` ("2 properties submitted together").
   What: list uses `submitted_count` (`src/app/account/orders/page.tsx:118`), detail heading uses
   `accepted_count` with the word "submitted" (`src/app/account/orders/[reference]/page.tsx:78`).
   Why a defect: three were submitted and two accepted; the heading states a false count of submissions
   and contradicts the list one click earlier.

4. **The customer's timeline says the confirmation "was sent" when it was only queued.**
   Screen: `/order/[reference]`. Screenshot: `order-reference-__public__1280.jpg` (third timeline entry).
   What: `src/lib/ops-payments.ts:816-830` writes event `email.sent`, customer visible, with "The order
   confirmation was sent to <email>." whenever `queued.ok`, i.e. the job was enqueued. A job that later
   dead letters leaves the sentence standing.
   Why a defect: a customer facing claim of contact backed by a database write, the exact class CLAUDE.md
   section 2c records for `customer_link.issued`. Reproduce: force the email job to fail after enqueue and
   read the order page.

5. **Partner counts and "every entry" claims are capped samples presented as totals.**
   Screens: `/partner/referrals`, `/partner/statements`, `/partner` (recent activity).
   Screenshots: `partner-statements__seedPartner__1280.jpg` ("Showing all 1 record"), `partner__seedPartner__1280.jpg`.
   What: referrals read `.limit(100)` (`src/lib/ops-partner-portal.ts:143,154`) and statements `.limit(60)`
   (`:230`), each passed as `total={rows.length}` (`referrals/page.tsx:126`, `statements/page.tsx:84`), so
   `TableFooter` (`src/components/portal/design/Table.tsx:219-225`) prints "Showing all N records" at the
   cap. Recent activity is `limit: 8` (`ops-partner-portal.ts:59`) under the description "Every entry on your
   ledger" (`page.tsx:102`). The overview's Referrals figure is an exact count and will disagree with the list.
   Why a defect: the repository's own named class (a sample's length reported as a count). Latent until a
   partner passes 100 referrals or 60 statements, but the "every entry" sentence is false at nine entries.
   Reproduce: a partner with nine ledger entries, or 101 credited orders.

6. **First time partners are told the agreement was "updated" and is "newer than the one on file".**
   Screens: `/partner`, `/partner/agreement`. Screenshots: `partner__seedPartner__1280.jpg`,
   `partner-agreement__seedPartner__1280.jpg` ("Nothing has been accepted on this account yet." directly
   above "This is a newer version than the one on file.").
   What: `agreementOutstanding` returns true for a null accepted version (`src/lib/ops-partner-portal.ts:391-393`)
   and both alerts assume a prior acceptance (`src/app/partner/(app)/page.tsx:48-56`,
   `src/app/partner/(app)/agreement/page.tsx:64-69`).
   Why a defect: the screen contradicts itself in adjacent sentences. Small, but it is copy about a contract.

## Gaps

1. **Single orders are not followable from the account at all (beyond defect 1).** `before-the-20th`.
   Why: once the gate opens, an account holder's only way to follow a single order is to dig out an email.
   Fix: give `/account/orders` an account scoped order page (or mint a token server side for the owner) and
   link per property references on the batch page to it.

2. **No staff path to publish or version a partner agreement.** `blocks-launch` (for the partner program).
   Why: no code in `src/` writes `eng_partner_agreements`; the first real agreement would need a hand insert,
   with no review or voice check. Fix: an admin screen to draft, check and publish a version, with the
   existing append only acceptance.

3. **Partners cannot see their own commission terms (rate or fee, holdback length).** `before-the-20th`.
   Why: the agreement defers to "the holdback period recorded on the partner's account", which the partner
   cannot read, so no figure is checkable. Fix: a read only "Your terms" panel on the overview.

4. **Published partner assets do not track the register.** `before-the-20th`.
   Why: defect 2's mechanism; any asset carrying a registration or name sentence goes stale silently.
   Fix: render the registration sentence at view time (as the mandatory line does) or flag and withdraw
   assets whose embedded statement no longer matches `registrationStatement()`.

5. **Customer login side column makes present tense service claims under a shut gate.** `before-the-20th`.
   Why: "Order online", "We visit" on a signed out page while every order door refuses; regulatory copy.
   Fix: gate the column like the sign up link, or rewrite it in the descriptive future; operator ruling.

6. **The partner agreement is one global document.** `later`.
   Why: a body naming one partner is shown to all partners. Fix: either forbid partner names in the body at
   publish, or substitute the partner's organisation at render and record what was rendered with the acceptance.

7. **No statement drill in, invoice download or overdue state for customers.** `before-the-20th`.
   Why: an AP department pays from an invoice listing what it bills; a past due statement shows as merely
   "due". Fix: statement detail page with lines and a PDF, and an "overdue since" label past `due_at`.

8. **No partner statement download or year to date total.** `later`.
   Why: partners need a document for their books and US tax reporting. Fix: PDF or CSV per statement and a
   calendar year total.

9. **"Start a submission" CTA is ungated on the account home.** `before-the-20th`.
   Why: invites an action the next screen refuses; present tense ordering copy. Fix: read the same gate as
   `/account/order` and show the "arranged with the office" sentence instead.

10. **No customer user management or password change.** `later`.
    Why: an organisation account with readers and owners has no way to add or remove people or see who owns
    it; signed in users cannot change their password (forgot password redirects them to a settings page with
    no such control). Fix: an owner only "People" section and a change password form.

11. **Partner self service password reset missing.** `later`.
    Why: customers have one, partners must ask the firm. Fix: reuse the customer reset flow for partners.

12. **Order status page lacks receipt, visit date and a contact action for the order.** `later`.
    Why: mature field service portals show the appointment and let the customer reach the office about the
    job. Fix: show the scheduled window when one exists, a receipt download, and a "contact us about this
    order" link carrying the reference.

13. **`/account/orders` silently capped at 200 per source with no count.** `later`.
    Why: same sample as total class as defect 5, for large accounts. Fix: count first and show a footer, or page.

14. **Order and account email match ignores the `site` column.** `later`.
    Why: `account/orders/page.tsx:84-98` does not filter by site, so a sister brand order placed with the
    same email may appear in a 254 account and link to a 254 order URL. Needs a ruling on whether that is
    wanted. Fix: filter by `site` or label the brand on the row.

15. **Copy cleanups.** `later`.
    "It is always accepted, whatever it says" (Materials) should say "received"; "programme" versus
    "program"; raw "accepted" batch status; raw period `2026-10`; mixed date formats; the order refusal page
    saying links are emailed "when an order is paid for" (they are emailed at release); "Where statements go"
    shown to card accounts.
