# Functional gaps found while restyling to V10

Started 2026-10-08, on the operator's ruling that each V10 batch notes the
functional gaps of the screens it restyles, one line each, without fixing them.
The product audit starts from this file. Visual defects are not listed here:
they were fixed in the batch. Each line carries its ruling where one was given
(operator rulings on bb3ee90, 2026-10-08).

## Customer and order flow (feat/v10-customer, feat/v10-customer-2, feat/v10-technician)

- `/account`: shows no orders and no status of any order; the customer has to open "See your orders" to learn anything has happened. **Ruled: audit fix round, before-the-20th.**
- `/account`: has no single-property order entry; its primary action is the multi-property submission, which most customers do not need. **Ruled: audit fix round, before-the-20th.**
- `/account/login`: no "email me a sign in link" and no "create an account" option, both drawn on V10-login. Behaviour change, held for the audit (operator ruling 4 of 2026-10-08).
- `/account/statements`: statement due dates are formatted without a time zone, so they render in the server's zone, not Central.
- `/account/orders/[reference]`: not measured by v10-layout-audit until a test customer owns a bulk order; the audit's development seed creates one by inserting rows (operator ruling 5 of 2026-10-08). Its entry stops being excused on 2026-10-19.
- `/order/[reference]` (the status page): each v10-layout-audit run issues a one-day status link for the newest demonstration order through issueCustomerLink, so each run leaves one expired row in eng_customer_access on development (kept pending counsel).
- `/order/start/[slug]`: the line under the notice reads "Read what roof certifications covers"; the subject is plural, so the verb is wrong. **Ruled: "cover", in feat/v10-admin-ops.**
- "What you receive" on three service lines makes claims the operator may want to rule on: foundation "condition and performance"; repair specification "a document three contractors can price against identically"; carport and patio plan set "a document a permit office can review without asking for more". **Ruled: every line quotes its own signed protocol or carries the pending sentence; on fix/receive-quotes-protocol.**
- `src/content/insights-coastal.ts:877` says a roof certification often states remaining service life. **Ruled: one sentence added after it, on fix/receive-quotes-protocol.**
- `/services/[slug]`, "What arrives at the end": each public service page lists its own deliverable in the firm's words, not its protocol's (foundation "the engineer's opinion of foundation performance"; roof a photographic record and a loan-file PDF RC-001 does not promise). **Ruled overnight: same rule as "what you receive"; merged in bce1a41.** The roof page's removed items are candidates for RC-001's next version (morning report).
- The order email's pending sentence says the scope "is published here", and in an email "here" is the email. The operator's wording, kept; noted for the operator.

## Admin ops (feat/v10-admin-ops)

- `/portal/techs`: stays on the dated list. Its only findings are ten "tints", and they are the coverage map legend's colour swatches (`rgb(29, 42, 53)` and darker), which encode data rather than tint a box. **On the decisions list:** does V10's no-tint rule apply to a map legend? Not redrawn to dodge the check.
- `/portal` (administrator): the "Margin by period" table's last two column headers render run together as "MARGINCOVERAGE". For the admin-accounts batch, which owns the shared table header.
- `/portal/intake` on a phone: the whole form is one white section under the title; the check passes because the title and the form are two. V10 would likely want each group (who, what, property, price, getting paid) as its own section. No reference screen; patterned on /portal/tasks.
- `/portal/files`, `/portal/onboarding`, `/portal/intake`: no reference screens; patterned on /portal/tasks (ruled rows), with the selected row marked by the navy bar per the ruling of 2026-10-08.

## Partner (feat/v10-partner)

- `/partner/statements/[reference]`: still not measured. Development holds no partner statement at all, and a statement stands on partner ledger rows, which cannot be deleted; a fixture making one per board would leave permanent rows on an append-only table every run, which the teardown ruling forbids. Resolved the way ruling 5 of 2026-10-08 resolved the customer's order page: by the product audit's one-time seed. Its excusal lapses 2026-10-19 either way.
- No reference screens for the partner portal; the sign in screens are patterned on the portal sign in, the rest on /portal/tasks.

## Admin accounts (feat/v10-admin-accounts)

- `/portal/accounts` renders about 9,100 px tall at 1280 on development, 25 accounts a page, nearly all probe accounts from audit runs (the 641 probe client rows deferred by the ruling of 2026-10-03). A real firm's list will be shorter; the probe rows are the existing backlog item.
- The table header fix (headers now carry the cells' right padding) is in the shared table, so it reaches every portal table, not only the dashboard's.
- No reference screens for these seven; patterned on /portal/tasks.

## Admin dashboard speed (fix/admin-dashboard-speed, merged as b190559)

- Opening `/portal` as an administrator prefetched the margin export and wrote an "Exported margin by period" audit row on every view; development held 1,196 such rows before the fix. Production is not read here: **needs a counterpart read** (query and prediction in the morning report). The rows are append-only and are not touched.

## Technician (feat/v10-technician)

- `/portal` (dashboard): "Needs you" and "Your pay" sit in one white section on a phone, because the page wraps them together; V10 would give each its own. **Ruled: separate sections, in feat/v10-admin-ops.**
- `/portal` as an administrator: the screenshot run timed out at 90 seconds on 2026-10-08 (twice, on two separate days); v10-layout-audit, which waits less for the network to go quiet, measured it. **Ruled: fix/admin-dashboard-speed, under 2 seconds, a check failing above 3.**
- `/portal/jobs/[id]`: no reference screen was drawn for the engineer's view of a technician's capture screen; patterned on the technician's own capture screen.
- `/portal/messages`: no reference, patterned on /portal/tasks (rows, square controls, sections under the ink rule).
- `/portal`: no reference for the technician's dashboard (V10T-today is drawn for the day's jobs, not counts); patterned on V10's KPI row.
- `/portal/messages`: a selected thread is marked by a navy left bar only. **Ruled: navy left bar only; the grey select fill comes out of DESIGN_V10.md with the ruling date, in feat/v10-admin-ops.**

## Decisions list (overnight of 2026-10-08, neither path taken)

1. **The coverage map legend on `/portal/techs`.** V10 refuses tinted fills; the legend's swatches are colour that carries data. Either V10's tint rule excepts a map legend (recorded in DESIGN_V10.md, and the check learns the exception by a property it can test), or the legend is redrawn without fills (for example labelled bands). Recommendation: the exception, because a choropleth with no colour is not a map. `/portal/techs` stays on the dated list until ruled.
2. **"Read what ... cover" for singular names.** Ruled as "cover"; applied as the name's number requires: "cover" after the six plural names, "covers" after "Windstorm WPI-8" and "Design". Recorded rather than asked, because the literal ruling would have written "what design cover"; say if every line should read otherwise.
3. **How `/partner/statements/[reference]` and `/account/orders/[reference]` get measured.** Both need a record the probe owns, and both records stand on append-only rows. Recommendation: the product audit's seed makes one of each, once, marked as demonstration, and the layout check reads them; no per-board fixture.
