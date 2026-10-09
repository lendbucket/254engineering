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
- `/services/[slug]`, "What arrives at the end": each public service page lists its own deliverable in the firm's words, not its protocol's (foundation "the engineer's opinion of foundation performance"; roof a photographic record and a loan-file PDF RC-001 does not promise). Outside the "what you receive" ruling, which covers the catalogue only; on the decisions list.
- The order email's pending sentence says the scope "is published here", and in an email "here" is the email. The operator's wording, kept; noted for the operator.

## Technician (feat/v10-technician)

- `/portal` (dashboard): "Needs you" and "Your pay" sit in one white section on a phone, because the page wraps them together; V10 would give each its own. **Ruled: separate sections, in feat/v10-admin-ops.**
- `/portal` as an administrator: the screenshot run timed out at 90 seconds on 2026-10-08 (twice, on two separate days); v10-layout-audit, which waits less for the network to go quiet, measured it. **Ruled: fix/admin-dashboard-speed, under 2 seconds, a check failing above 3.**
- `/portal/jobs/[id]`: no reference screen was drawn for the engineer's view of a technician's capture screen; patterned on the technician's own capture screen.
- `/portal/messages`: no reference, patterned on /portal/tasks (rows, square controls, sections under the ink rule).
- `/portal`: no reference for the technician's dashboard (V10T-today is drawn for the day's jobs, not counts); patterned on V10's KPI row.
- `/portal/messages`: a selected thread is marked by a navy left bar only. **Ruled: navy left bar only; the grey select fill comes out of DESIGN_V10.md with the ruling date, in feat/v10-admin-ops.**
