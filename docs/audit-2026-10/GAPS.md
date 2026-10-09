# Functional gaps found while restyling to V10

Started 2026-10-08, on the operator's ruling that each V10 batch notes the
functional gaps of the screens it restyles, one line each, without fixing them.
The product audit starts from this file. Visual defects are not listed here:
they were fixed in the batch.

## Customer and order flow (feat/v10-customer, feat/v10-customer-2, feat/v10-technician)

- `/account`: shows no orders and no status of any order; the customer has to open "See your orders" to learn anything has happened.
- `/account`: has no single-property order entry; its primary action is the multi-property submission, which most customers do not need.
- `/account/login`: no "email me a sign in link" and no "create an account" option, both drawn on V10-login. Behaviour change, held for the audit (operator ruling 4 of 2026-10-08).
- `/account/statements`: statement due dates are formatted without a time zone, so they render in the server's zone, not Central.
- `/account/orders/[reference]`: not measured by v10-layout-audit until a test customer owns a bulk order; the audit's development seed creates one by inserting rows (operator ruling 5 of 2026-10-08). Its entry stops being excused on 2026-10-19.
- `/order/[reference]` (the status page): each v10-layout-audit run issues a one-day status link for the newest demonstration order through issueCustomerLink, so each run leaves one expired row in eng_customer_access on development (kept pending counsel).
- `/order/start/[slug]`: the line under the notice reads "Read what roof certifications covers"; the subject is plural, so the verb is wrong.
- "What you receive" on three service lines makes claims the operator may want to rule on (reported 2026-10-08, not changed): foundation "condition and performance"; repair specification "a document three contractors can price against identically"; carport and patio plan set "a document a permit office can review without asking for more".
- `src/content/insights-coastal.ts:877` says a roof certification often states remaining service life. It describes the industry, not this firm's letter, but sits beside pages that sell one.

## Technician (feat/v10-technician)

- `/portal` (dashboard): "Needs you" and "Your pay" sit in one white section on a phone, because the page wraps them together; V10 would give each its own.
- `/portal` as an administrator: the screenshot run timed out at 90 seconds on 2026-10-08 (twice, on two separate days); v10-layout-audit, which waits less for the network to go quiet, measured it. Speed, for the audit.
- `/portal/jobs/[id]`: no reference screen was drawn for the engineer's view of a technician's capture screen; patterned on the technician's own capture screen.
- `/portal/messages`: no reference, patterned on /portal/tasks (rows, square controls, sections under the ink rule).
- `/portal`: no reference for the technician's dashboard (V10T-today is drawn for the day's jobs, not counts); patterned on V10's KPI row.
- `/portal/messages`: a selected thread is marked by a navy left bar only. V10 names a grey selected-row fill (`select`), which the tint rule refuses inside main; whether V10's selected fill is an exception to that rule is a decision for the operator.
