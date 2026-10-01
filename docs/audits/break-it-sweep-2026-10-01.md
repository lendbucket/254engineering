# The break it sweep, 2026-10-01

Report only. Nothing in this file has been fixed.

## What was swept

- Static routes on disk belonging to no declared surface: **0**
- Declared routes with no page: **2**
- Dynamic routes, which need a parameter and were not visited: **15**

### Form abuse, and every control that does not submit

Forms: **14** found on **14** route(s), **33** submission(s) made. Each form got four payloads: nothing at all, far too much text, markup, and the wrong type in every typed field.

Controls: **629** pressable controls that do not submit, found on **97** route(s), **616** pressed. A control counts as dead only when pressing it moves none of four things: a DOM mutation, its own aria state, the URL, or a request.

**One principal per route.** A portal route was opened as admin, an account route as the customer, a sign in or recovery screen signed out because that is who it is for, and everything else signed out. The owning principal is read from the perimeter's own open path set rather than guessed from the prefix. No route was opened as all six roles, so a control visible only to one of the others was not pressed.

**Controls were clicked at 1280 and at 390. Forms were abused at 1280 only.** The first run clicked at 1280 alone and pressed roughly one control per page, which reads like thorough coverage of a site with no buttons: the mobile menu button measures zero by zero at 1280, so the most pressable control in the product was never pressed anywhere. A form's fields do not appear and disappear with the viewport the way a menu does, so abusing each one twice would have doubled the expensive half for no new subject.

**5 form(s) and 6 control(s) were deliberately not pressed**, because their visible label says they take money or send something. Nothing matching pay, checkout, refund, send, email, SMS, notify, invite, resend or place the order was touched, which is why this sweep made no charge and sent nothing.

- not pressed: / "Send message"
- not pressed: /account/forgot-password "Email me a link"
- not pressed: /contact "Send message"
- not pressed: /design-inquiry "Send this brief"
- not pressed: /portal/accounts "Send the link"
- not pressed: /portal/messages "Message somebody"
- not pressed: /portal/people "Resend invite"

## Findings, ranked

186 distinct finding(s), collapsed from 1014 observation(s). A finding seen by four roles at two widths is one finding and seven copies; the roles and widths it was seen at are in their own columns.

| # | Route | Role | Width | What happened | Severity | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `/account/settings` | customer | 1280, 390 | wording that promises or warrants: "usually :: .... No preference Standard As soon as the firm can Urgent Counties you usually work in Comma separated. Offered when you are filling in a bulk subm..." | 2 wrong data shown | behaviour |
| 2 | `/api/account/session` | customer | n/a | ten wrong passwords were refused identically (401), so nothing visibly rate limits a password guess on this route | 2 wrong data shown | behaviour |
| 3 | `/portal` | csr | 1280, 390 | wording that promises or warrants: "usually :: .... Nobody outside the firm is waiting on these, but work sitting still usually is. What could not be counted Reported rather than fixed by widenin..." | 2 wrong data shown | behaviour |
| 4 | `(the surface inventory)` | n/a | n/a | 2 declared route(s) have no page on disk: /order/start/roof-inspections, /order/254-B2026-000000 | 3 dead path | behaviour |
| 5 | `/account` | signed out, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /account/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 6 | `/account/forgot-password` | customer | 1280, 390 | it did not render: the browser was redirected to /account/settings, so nothing below was measured on this route | 3 dead path | behaviour |
| 7 | `/account/login` | customer | 1280, 390 | it did not render: the browser was redirected to /account, so nothing below was measured on this route | 3 dead path | behaviour |
| 8 | `/account/order` | signed out, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /account/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 9 | `/account/settings` | signed out, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /account/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 10 | `/account/sign-up` | customer | 1280, 390 | it did not render: the browser was redirected to /account, so nothing below was measured on this route | 3 dead path | behaviour |
| 11 | `/account/statements` | signed out, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /account/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 12 | `/partner` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 13 | `/partner/agreement` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 14 | `/partner/materials` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 15 | `/partner/referrals` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 16 | `/partner/statements` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 17 | `/portal` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 18 | `/portal/accounts` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 19 | `/portal/accounts` | csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal, so nothing below was measured on this route | 3 dead path | behaviour |
| 20 | `/portal/applications` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 21 | `/portal/applications` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 22 | `/portal/applications` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 23 | `/portal/audit` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 24 | `/portal/audit` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 25 | `/portal/audit` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 26 | `/portal/billing` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 27 | `/portal/billing` | csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal, so nothing below was measured on this route | 3 dead path | behaviour |
| 28 | `/portal/certification` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 29 | `/portal/certification` | admin, csr, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 30 | `/portal/certification` | admin, csr, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 31 | `/portal/charge-log` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 32 | `/portal/charge-log` | csr, technician | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 33 | `/portal/charge-log` | csr, technician | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 34 | `/portal/clients` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 35 | `/portal/clients` | technician | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 36 | `/portal/clients` | technician | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 37 | `/portal/deletion-requests` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 38 | `/portal/deletion-requests` | technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 39 | `/portal/deletion-requests` | technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 40 | `/portal/documents` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 41 | `/portal/documents` | csr, technician | 1280, 390 | it did not render: the browser was redirected to /portal, so nothing below was measured on this route | 3 dead path | behaviour |
| 42 | `/portal/files` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 43 | `/portal/files/dispatch` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 44 | `/portal/files/dispatch` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 45 | `/portal/files/dispatch` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 46 | `/portal/inquiries` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 47 | `/portal/inquiries` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 48 | `/portal/inquiries` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 49 | `/portal/intake` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 50 | `/portal/intake` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 51 | `/portal/intake` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 52 | `/portal/jobs` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 53 | `/portal/jobs` | csr, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 54 | `/portal/jobs` | csr, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 55 | `/portal/launch` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 56 | `/portal/launch` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 57 | `/portal/launch` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 58 | `/portal/login` | admin | 1280, 390 | it did not render: the browser was redirected to /portal, so nothing below was measured on this route | 3 dead path | behaviour |
| 59 | `/portal/login` | csr | 1280, 390 | it did not render: the browser was redirected to /portal/files, so nothing below was measured on this route | 3 dead path | behaviour |
| 60 | `/portal/login` | technician | 1280, 390 | it did not render: the browser was redirected to /portal/jobs, so nothing below was measured on this route | 3 dead path | behaviour |
| 61 | `/portal/login` | engineer | 1280, 390 | it did not render: the browser was redirected to /portal/review, so nothing below was measured on this route | 3 dead path | behaviour |
| 62 | `/portal/messages` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 63 | `/portal/mfa` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 64 | `/portal/mfa` | admin | 1280, 390 | it did not render: the browser was redirected to /portal, so nothing below was measured on this route | 3 dead path | behaviour |
| 65 | `/portal/mfa` | csr | 1280, 390 | it did not render: the browser was redirected to /portal/files, so nothing below was measured on this route | 3 dead path | behaviour |
| 66 | `/portal/mfa` | technician | 1280, 390 | it did not render: the browser was redirected to /portal/jobs, so nothing below was measured on this route | 3 dead path | behaviour |
| 67 | `/portal/mfa` | engineer | 1280, 390 | it did not render: the browser was redirected to /portal/review, so nothing below was measured on this route | 3 dead path | behaviour |
| 68 | `/portal/mfa/enrol` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 69 | `/portal/onboarding` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 70 | `/portal/onboarding` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 71 | `/portal/onboarding` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 72 | `/portal/orders` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 73 | `/portal/orders` | csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal, so nothing below was measured on this route | 3 dead path | behaviour |
| 74 | `/portal/partners` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 75 | `/portal/partners` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 76 | `/portal/partners` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 77 | `/portal/partners/disputes` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 78 | `/portal/partners/disputes` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 79 | `/portal/partners/disputes` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 80 | `/portal/partners/disputes` | admin | n/a | submitting "Look it up" with nothing at all sent no request, did not move, and showed no message | 3 dead path | behaviour |
| 81 | `/portal/partners/disputes` | admin | n/a | submitting "Look it up" with far too much text sent no request, did not move, and showed no message | 3 dead path | behaviour |
| 82 | `/portal/partners/disputes` | admin | n/a | submitting "Look it up" with markup in every text field sent no request, did not move, and showed no message | 3 dead path | behaviour |
| 83 | `/portal/pay` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 84 | `/portal/pay` | csr | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 85 | `/portal/pay` | csr | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 86 | `/portal/people` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 87 | `/portal/people` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 88 | `/portal/people` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 89 | `/portal/pricebook` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 90 | `/portal/pricebook` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 91 | `/portal/pricebook` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 92 | `/portal/profile` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 93 | `/portal/protocols` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 94 | `/portal/protocols` | admin, csr, technician | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 95 | `/portal/protocols` | admin, csr, technician | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 96 | `/portal/protocols/rc-001` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 97 | `/portal/protocols/rc-001` | admin, csr, technician | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 98 | `/portal/protocols/rc-001` | admin, csr, technician | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 99 | `/portal/queue` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 100 | `/portal/queue` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 101 | `/portal/queue` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 102 | `/portal/reports` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 103 | `/portal/reports` | csr, technician | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 104 | `/portal/reports` | csr, technician | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 105 | `/portal/review` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 106 | `/portal/review` | admin, csr, technician | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 107 | `/portal/review` | admin, csr, technician | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 108 | `/portal/roles` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 109 | `/portal/roles` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 110 | `/portal/roles` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 111 | `/portal/status` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 112 | `/portal/status` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 113 | `/portal/status` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 114 | `/portal/suppressions` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 115 | `/portal/suppressions` | technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 116 | `/portal/suppressions` | technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 117 | `/portal/tasks` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 118 | `/portal/techs` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 119 | `/portal/techs` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 120 | `/portal/techs` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 121 | `/portal/waiting` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 122 | `/portal/waiting` | admin, csr, technician | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 123 | `/portal/waiting` | admin, csr, technician | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 124 | `/portal/windstorm-inquiries` | signed out, customer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 125 | `/portal/windstorm-inquiries` | csr, technician, engineer | 1280, 390 | HTTP 404 on a route the inventory declares | 3 dead path | behaviour |
| 126 | `/portal/windstorm-inquiries` | csr, technician, engineer | 1280, 390 | 1 console error(s), first: Failed to load resource: the server responded with a status of 404 (Not Found) | 3 dead path | behaviour |
| 127 | `/` | signed out, customer, admin, csr, technician, engineer | 390 | 12155px tall, 14.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 128 | `/about` | signed out, customer, admin, csr, technician, engineer | 390 | 8062px tall, 9.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 129 | `/careers` | signed out, customer, admin, csr, technician, engineer | 390 | 14018px tall, 16.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 130 | `/careers/field-inspection-technician` | signed out, customer, admin, csr, technician, engineer | 390 | 9596px tall, 11.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 131 | `/careers/professional-engineer` | signed out, customer, admin, csr, technician, engineer | 390 | 10190px tall, 12.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 132 | `/contact` | signed out, customer, admin, csr, technician, engineer | 390 | 4177px tall, 4.9 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 133 | `/corpus-christi` | signed out, customer, admin, csr, technician, engineer | 390 | 8731px tall, 10.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 134 | `/coverage` | signed out, customer, admin, csr, technician, engineer | 390 | 8105px tall, 9.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 135 | `/coverage/austin-central-texas` | signed out, customer, admin, csr, technician, engineer | 390 | 8838px tall, 10.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 136 | `/coverage/coastal-bend` | signed out, customer, admin, csr, technician, engineer | 390 | 9070px tall, 10.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 137 | `/coverage/dallas-fort-worth` | signed out, customer, admin, csr, technician, engineer | 390 | 9702px tall, 11.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 138 | `/coverage/greater-houston` | signed out, customer, admin, csr, technician, engineer | 390 | 8900px tall, 10.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 139 | `/coverage/panhandle` | signed out, customer, admin, csr, technician, engineer | 390 | 9414px tall, 11.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 140 | `/coverage/rio-grande-valley` | signed out, customer, admin, csr, technician, engineer | 390 | 8536px tall, 10.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 141 | `/coverage/san-antonio` | signed out, customer, admin, csr, technician, engineer | 390 | 8659px tall, 10.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 142 | `/coverage/west-texas` | signed out, customer, admin, csr, technician, engineer | 390 | 9738px tall, 11.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 143 | `/design-inquiry` | signed out, customer, admin, csr, technician, engineer | 390 | 5431px tall, 6.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 144 | `/government` | signed out, customer, admin, csr, technician, engineer | 390 | 7747px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 145 | `/insights` | signed out, customer, admin, csr, technician, engineer | 390 | 8048px tall, 9.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 146 | `/insights/engineer-letter-vs-windstorm-certificate` | signed out, customer, admin, csr, technician, engineer | 390 | 10151px tall, 12.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 147 | `/insights/engineer-of-record-texas` | signed out, customer, admin, csr, technician, engineer | 390 | 13026px tall, 15.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 148 | `/insights/inspection-vs-forensic-report` | signed out, customer, admin, csr, technician, engineer | 390 | 10725px tall, 12.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 149 | `/insights/ongoing-vs-completed-improvement` | signed out, customer, admin, csr, technician, engineer | 390 | 9771px tall, 11.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 150 | `/insights/post-construction-evaluation-report` | signed out, customer, admin, csr, technician, engineer | 390 | 10566px tall, 12.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 151 | `/insights/roof-certification-vs-wpi-8` | signed out, customer, admin, csr, technician, engineer | 390 | 9798px tall, 11.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 152 | `/insights/texas-engineering-firm-registration` | signed out, customer, admin, csr, technician, engineer | 390 | 12717px tall, 15.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 153 | `/insights/texas-pe-license-lookup` | signed out, customer, admin, csr, technician, engineer | 390 | 11538px tall, 13.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 154 | `/insights/texas-professional-services-procurement-act` | signed out, customer, admin, csr, technician, engineer | 390 | 14944px tall, 17.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 155 | `/insights/texas-windstorm-certificate-lookup` | signed out, customer, admin, csr, technician, engineer | 390 | 11630px tall, 13.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 156 | `/insights/twia-coverage-homes-built-before-1988` | signed out, customer, admin, csr, technician, engineer | 390 | 9950px tall, 11.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 157 | `/insights/twia-eligibility-requirements` | signed out, customer, admin, csr, technician, engineer | 390 | 12078px tall, 14.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 158 | `/insights/windstorm-certificate-of-compliance` | signed out, customer, admin, csr, technician, engineer | 390 | 10502px tall, 12.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 159 | `/insights/windstorm-inspection-for-roofers` | signed out, customer, admin, csr, technician, engineer | 390 | 10412px tall, 12.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 160 | `/privacy` | signed out, customer, admin, csr, technician, engineer | 390 | 7754px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 161 | `/process` | signed out, customer, admin, csr, technician, engineer | 390 | 10776px tall, 12.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 162 | `/services` | signed out, customer, admin, csr, technician, engineer | 390 | 7415px tall, 8.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 163 | `/services/foundation-inspections` | signed out, customer, admin, csr, technician, engineer | 390 | 9627px tall, 11.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 164 | `/services/manufactured-home-foundation-certifications` | signed out, customer, admin, csr, technician, engineer | 390 | 8832px tall, 10.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 165 | `/services/repair-specifications` | signed out, customer, admin, csr, technician, engineer | 390 | 7897px tall, 9.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 166 | `/services/residential-light-commercial-design` | signed out, customer, admin, csr, technician, engineer | 390 | 9043px tall, 10.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 167 | `/services/roof-inspections` | signed out, customer, admin, csr, technician, engineer | 390 | 10511px tall, 12.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 168 | `/services/solar-structural-letters` | signed out, customer, admin, csr, technician, engineer | 390 | 8337px tall, 9.9 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 169 | `/services/structural-letters` | signed out, customer, admin, csr, technician, engineer | 390 | 8543px tall, 10.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 170 | `/services/windstorm-wpi-8` | signed out, customer, admin, csr, technician, engineer | 390 | 10459px tall, 12.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 171 | `/structural-engineer` | signed out, customer, admin, csr, technician, engineer | 390 | 9989px tall, 11.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 172 | `/structural-engineer/cost` | signed out, customer, admin, csr, technician, engineer | 390 | 7153px tall, 8.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 173 | `/structural-engineer/how-to-choose` | signed out, customer, admin, csr, technician, engineer | 390 | 8029px tall, 9.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 174 | `/structural-engineer/inspection` | signed out, customer, admin, csr, technician, engineer | 390 | 7064px tall, 8.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 175 | `/structural-engineer/when-you-need-one` | signed out, customer, admin, csr, technician, engineer | 390 | 8273px tall, 9.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 176 | `/terms` | signed out, customer, admin, csr, technician, engineer | 390 | 7973px tall, 9.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 177 | `/what-is-a-structural-engineer` | signed out, customer, admin, csr, technician, engineer | 390 | 8442px tall, 10.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 178 | `/windstorm` | signed out, customer, admin, csr, technician, engineer | 390 | 7795px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 179 | `/windstorm/appointed-engineers` | signed out, customer, admin, csr, technician, engineer | 390 | 7607px tall, 9.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 180 | `/windstorm/before-work-begins` | signed out, customer, admin, csr, technician, engineer | 390 | 8478px tall, 10.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 181 | `/windstorm/buying-and-selling` | signed out, customer, admin, csr, technician, engineer | 390 | 7413px tall, 8.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 182 | `/windstorm/catastrophe-area` | signed out, customer, admin, csr, technician, engineer | 390 | 7853px tall, 9.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 183 | `/windstorm/completed-construction` | signed out, customer, admin, csr, technician, engineer | 390 | 7774px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 184 | `/windstorm/opening-protection` | signed out, customer, admin, csr, technician, engineer | 390 | 7292px tall, 8.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 185 | `/windstorm/re-roofs-and-repairs` | signed out, customer, admin, csr, technician, engineer | 390 | 7339px tall, 8.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 186 | `/windstorm/twia-coverage` | signed out, customer, admin, csr, technician, engineer | 390 | 7375px tall, 8.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |

## Colour as status on staff surfaces

One row, per the operator's ruling of 2026-09-30: V10 supersedes the portal
standard's status dots for stages 2 to 4, and the portal is not restyled yet, so
this is recorded as work to come rather than as a defect per screen.

**To be removed in stages 2 to 4.** 1 staff screen(s) carry status in colour:

- `/portal/partners`

## Exercised and held

Not findings. These are the cases the sweep attacked and the product refused correctly, listed so a case that PASSED can be told apart from one that never ran.

- `/account` as customer with an expired session: an expired session was refused with 307, and a valid reproduction was accepted first, so the case was genuinely exercised
- `/account` as customer with a tampered expiry: an expiry edited to a future value was refused with 307, so the signature covers it
- `/account/forgot-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/account/login` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/account/login` as signed out: "Sign in" with nothing at all was handled: the handler answered 400
- `/account/login` as signed out: "Sign in" with far too much text was handled: the handler answered 400
- `/account/login` as signed out: "Sign in" with markup in every text field was handled: the handler answered 400
- `/account/login` as signed out: "Sign in" with the wrong type in every typed field was handled: the handler answered 400
- `/account/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/account/sign-up` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/account/forgot-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/account/session` as customer: an email uppercased signed in, so the address is normalised before it is compared
- `/api/account/session` as customer: an email with a trailing space signed in, so the address is normalised before it is compared
- `/api/account/session` as customer: an email with a leading space signed in, so the address is normalised before it is compared
- `/api/account/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/account/sign-up` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/partner/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/partner/login` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/partner/login` as signed out: "Sign in" with nothing at all was handled: the handler answered 400
- `/partner/login` as signed out: "Sign in" with far too much text was handled: the handler answered 400
- `/partner/login` as signed out: "Sign in" with markup in every text field was handled: the handler answered 400
- `/partner/login` as signed out: "Sign in" with the wrong type in every typed field was handled: the handler answered 400
- `/partner/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/portal/deletion-requests` as admin: "Record the request" with nothing at all was handled: it said why
- `/portal/deletion-requests` as admin: "Record the request" with far too much text was handled: it said why
- `/portal/deletion-requests` as admin: "Record the request" with markup in every text field was handled: it said why
- `/portal/deletion-requests` as admin: "Record the request" with the wrong type in every typed field was handled: it said why
- `/portal/messages` as admin: "Search" with nothing at all was handled: the handler answered 200
- `/portal/messages` as admin: "Search" with far too much text was handled: the handler answered 200
- `/portal/messages` as admin: "Search" with markup in every text field was handled: the handler answered 200
- `/portal/messages` as admin: "Search" with the wrong type in every typed field was handled: the handler answered 200
- `/portal/partners` as admin: "Add partner" with nothing at all was handled: the handler answered 400
- `/portal/partners` as admin: "Add partner" with far too much text was handled: the handler answered 400
- `/portal/partners` as admin: "Add partner" with markup in every text field was handled: the handler answered 400
- `/portal/partners` as admin: "Add partner" with the wrong type in every typed field was handled: the handler answered 400
- `/portal/profile` as admin: "Change password" with nothing at all was handled: it said why
- `/portal/profile` as admin: "Change password" with far too much text was handled: it said why
- `/portal/profile` as admin: "Change password" with markup in every text field was handled: it said why
- `/portal/suppressions` as admin: "Record the request" with nothing at all was handled: it said why
- `/portal/suppressions` as admin: "Record the request" with far too much text was handled: it said why
- `/portal/suppressions` as admin: "Record the request" with markup in every text field was handled: it said why
- `/portal/suppressions` as admin: "Record the request" with the wrong type in every typed field was handled: it said why
- `/portal/tasks` as admin: "Add" with nothing at all was handled: it said why
- `/portal/tasks` as admin: "Add" with far too much text was handled: it said why
- `/portal/tasks` as admin: "Add" with markup in every text field was handled: it said why

## Could not tell

- **the reused reset link case**: no reset token was present to reuse, and the sweep does not call the public reset route because that route queues mail
- **form abuse and control clicking on the partner surface, 7 route(s)**: the sweep builds no partner principal, so these screens were reached signed out, redirected, and never opened. Their forms and controls are unmeasured rather than clean
- **form abuse and control clicking on /portal/login**: it redirected to /portal as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/mfa**: it redirected to /portal as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /partner**: it redirected to /partner/login as signed out, so its own forms and controls were never reached
- **form abuse and control clicking on /partner/agreement**: it redirected to /partner/login as signed out, so its own forms and controls were never reached
- **form abuse and control clicking on /partner/materials**: it redirected to /partner/login as signed out, so its own forms and controls were never reached
- **form abuse and control clicking on /partner/referrals**: it redirected to /partner/login as signed out, so its own forms and controls were never reached
- **form abuse and control clicking on /partner/statements**: it redirected to /partner/login as signed out, so its own forms and controls were never reached

## The probes, and what was removed

- removed: staff probes: swept, 0 left on audit-probe.invalid
- removed: 0 customer auth token(s)
- removed: 1 customer user
- removed: 1 customer account superseded and closed
- read back: 0 account(s) remain on the probe domain

Audit rows these probes caused are permanent. `eng_audit_events` refuses deletes
by design, and a customer account is superseded rather than removed because the
orders and statements attached to one are the record of what somebody was charged.
