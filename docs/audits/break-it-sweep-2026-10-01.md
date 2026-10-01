# The break it sweep, 2026-10-01

Report only. Nothing in this file has been fixed.

## What was swept

- Static routes on disk belonging to no declared surface: **0**
- Declared routes with no page: **2**
- Dynamic routes, which need a parameter and were not visited: **15**

### Form abuse, and every control that does not submit

Forms: **6** found on **6** route(s), **12** submission(s) made. Each form got four payloads: nothing at all, far too much text, markup, and the wrong type in every typed field.

Controls: **193** pressable controls that do not submit, found on **64** route(s), **193** pressed. A control counts as dead only when pressing it moves none of four things: a DOM mutation, its own aria state, the URL, or a request.

**One principal per route.** A portal route was opened as admin, an account route as the customer, a sign in or recovery screen signed out because that is who it is for, and everything else signed out. The owning principal is read from the perimeter's own open path set rather than guessed from the prefix. No route was opened as all six roles, so a control visible only to one of the others was not pressed.

**Controls were clicked at 1280 and at 390. Forms were abused at 1280 only.** The first run clicked at 1280 alone and pressed roughly one control per page, which reads like thorough coverage of a site with no buttons: the mobile menu button measures zero by zero at 1280, so the most pressable control in the product was never pressed anywhere. A form's fields do not appear and disappear with the viewport the way a menu does, so abusing each one twice would have doubled the expensive half for no new subject.

**3 form(s) and 0 control(s) were deliberately not pressed**, because their visible label says they take money or send something. Nothing matching pay, checkout, refund, send, email, SMS, notify, invite, resend or place the order was touched, which is why this sweep made no charge and sent nothing.

- not pressed: / "Send message"
- not pressed: /contact "Send message"
- not pressed: /design-inquiry "Send this brief"

## Findings, ranked

122 distinct finding(s), collapsed from 1035 observation(s). A finding seen by four roles at two widths is one finding and seven copies; the roles and widths it was seen at are in their own columns.

| # | Route | Role | Width | What happened | Severity | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `/account/forgot-password` | signed out | n/a | it is a door for somebody with no session and the perimeter does NOT let it through, so the people it exists for are redirected to sign in | 1 money or a customer's order | behaviour |
| 2 | `/api/account/forgot-password` | signed out | n/a | it is a door for somebody with no session and the perimeter does NOT let it through, so the people it exists for are redirected to sign in | 1 money or a customer's order | behaviour |
| 3 | `/account/settings` | customer | 1280, 390 | wording that promises or warrants: "usually :: .... No preference Standard As soon as the firm can Urgent Counties you usually work in Comma separated. Offered when you are filling in a bulk subm..." | 2 wrong data shown | behaviour |
| 4 | `/api/account/session` | customer | n/a | ten wrong passwords were refused identically (401), so nothing visibly rate limits a password guess on this route | 2 wrong data shown | behaviour |
| 5 | `/insights/post-construction-evaluation-report` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | wording that promises or warrants: "warranty :: ...n a party to a transaction treats a sealed report as though it were a warranty of the construction. Who can call the engineer to account Subsectio..." | 2 wrong data shown | behaviour |
| 6 | `/services/roof-inspections` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | wording that promises or warrants: "usually :: ...an issue a sealed opinion on the condition observed, and that seal is usually what a lender or a carrier is actually asking for. How long is a roof..." | 2 wrong data shown | behaviour |
| 7 | `/services/structural-letters` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | wording that promises or warrants: "usually :: ...letter be issued without anyone visiting the site? Rarely, and it is usually a mistake to try. The letter turns on what is actually there: span, m..." | 2 wrong data shown | behaviour |
| 8 | `/structural-engineer/cost` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | wording that promises or warrants: "typically :: ...s the market a residential structural inspection with a sealed letter typically runs from the high hundreds into the low thousands, and firms that wi..." | 2 wrong data shown | behaviour |
| 9 | `/structural-engineer/when-you-need-one` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | wording that promises or warrants: "usually :: ...ct answer, and an honest engineer will tell you so. SIGNALS What is usually worth looking at Not a diagnostic list. These are the observations t..." | 2 wrong data shown | behaviour |
| 10 | `(the surface inventory)` | n/a | n/a | 2 declared route(s) have no page on disk: /order/start/roof-inspections, /order/254-B2026-000000 | 3 dead path | behaviour |
| 11 | `/account` | signed out, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /account/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 12 | `/account/forgot-password` | signed out, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /account/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 13 | `/account/forgot-password` | customer | 1280, 390 | it did not render: the browser was redirected to /account/settings, so nothing below was measured on this route | 3 dead path | behaviour |
| 14 | `/account/login` | customer | 1280, 390 | it did not render: the browser was redirected to /account, so nothing below was measured on this route | 3 dead path | behaviour |
| 15 | `/account/order` | signed out, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /account/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 16 | `/account/settings` | signed out, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /account/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 17 | `/account/sign-up` | customer | 1280, 390 | it did not render: the browser was redirected to /account, so nothing below was measured on this route | 3 dead path | behaviour |
| 18 | `/account/statements` | signed out, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /account/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 19 | `/partner` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 20 | `/partner/agreement` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 21 | `/partner/materials` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 22 | `/partner/referrals` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 23 | `/partner/statements` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /partner/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 24 | `/portal` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 25 | `/portal/accounts` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 26 | `/portal/applications` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 27 | `/portal/audit` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 28 | `/portal/billing` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 29 | `/portal/certification` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 30 | `/portal/charge-log` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 31 | `/portal/clients` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 32 | `/portal/deletion-requests` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 33 | `/portal/documents` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 34 | `/portal/files` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 35 | `/portal/files/dispatch` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 36 | `/portal/inquiries` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 37 | `/portal/intake` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 38 | `/portal/jobs` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 39 | `/portal/launch` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 40 | `/portal/messages` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 41 | `/portal/mfa` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 42 | `/portal/mfa/enrol` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 43 | `/portal/onboarding` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 44 | `/portal/orders` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 45 | `/portal/partners` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 46 | `/portal/partners/disputes` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 47 | `/portal/pay` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 48 | `/portal/people` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 49 | `/portal/pricebook` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 50 | `/portal/profile` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 51 | `/portal/protocols` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 52 | `/portal/protocols/rc-001` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 53 | `/portal/queue` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 54 | `/portal/reports` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 55 | `/portal/review` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 56 | `/portal/roles` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 57 | `/portal/status` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 58 | `/portal/suppressions` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 59 | `/portal/tasks` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 60 | `/portal/techs` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 61 | `/portal/waiting` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 62 | `/portal/windstorm-inquiries` | signed out, customer, admin, csr, technician, engineer | 1280, 390 | it did not render: the browser was redirected to /portal/login, so nothing below was measured on this route | 3 dead path | behaviour |
| 63 | `/` | signed out, customer, admin, csr, technician, engineer | 390 | 12155px tall, 14.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 64 | `/about` | signed out, customer, admin, csr, technician, engineer | 390 | 8062px tall, 9.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 65 | `/careers` | signed out, customer, admin, csr, technician, engineer | 390 | 14018px tall, 16.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 66 | `/careers/field-inspection-technician` | signed out, customer, admin, csr, technician, engineer | 390 | 9596px tall, 11.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 67 | `/careers/professional-engineer` | signed out, customer, admin, csr, technician, engineer | 390 | 10190px tall, 12.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 68 | `/contact` | signed out, customer, admin, csr, technician, engineer | 390 | 4177px tall, 4.9 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 69 | `/corpus-christi` | signed out, customer, admin, csr, technician, engineer | 390 | 8731px tall, 10.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 70 | `/coverage` | signed out, customer, admin, csr, technician, engineer | 390 | 8105px tall, 9.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 71 | `/coverage/austin-central-texas` | signed out, customer, admin, csr, technician, engineer | 390 | 8838px tall, 10.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 72 | `/coverage/coastal-bend` | signed out, customer, admin, csr, technician, engineer | 390 | 9070px tall, 10.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 73 | `/coverage/dallas-fort-worth` | signed out, customer, admin, csr, technician, engineer | 390 | 9702px tall, 11.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 74 | `/coverage/greater-houston` | signed out, customer, admin, csr, technician, engineer | 390 | 8900px tall, 10.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 75 | `/coverage/panhandle` | signed out, customer, admin, csr, technician, engineer | 390 | 9414px tall, 11.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 76 | `/coverage/rio-grande-valley` | signed out, customer, admin, csr, technician, engineer | 390 | 8536px tall, 10.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 77 | `/coverage/san-antonio` | signed out, customer, admin, csr, technician, engineer | 390 | 8659px tall, 10.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 78 | `/coverage/west-texas` | signed out, customer, admin, csr, technician, engineer | 390 | 9738px tall, 11.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 79 | `/design-inquiry` | signed out, customer, admin, csr, technician, engineer | 390 | 5431px tall, 6.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 80 | `/government` | signed out, customer, admin, csr, technician, engineer | 390 | 7747px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 81 | `/insights` | signed out, customer, admin, csr, technician, engineer | 390 | 8048px tall, 9.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 82 | `/insights/engineer-letter-vs-windstorm-certificate` | signed out, customer, admin, csr, technician, engineer | 390 | 10151px tall, 12.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 83 | `/insights/engineer-of-record-texas` | signed out, customer, admin, csr, technician, engineer | 390 | 13026px tall, 15.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 84 | `/insights/inspection-vs-forensic-report` | signed out, customer, admin, csr, technician, engineer | 390 | 10725px tall, 12.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 85 | `/insights/ongoing-vs-completed-improvement` | signed out, customer, admin, csr, technician, engineer | 390 | 9771px tall, 11.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 86 | `/insights/post-construction-evaluation-report` | signed out, customer, admin, csr, technician, engineer | 390 | 10566px tall, 12.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 87 | `/insights/roof-certification-vs-wpi-8` | signed out, customer, admin, csr, technician, engineer | 390 | 9798px tall, 11.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 88 | `/insights/texas-engineering-firm-registration` | signed out, customer, admin, csr, technician, engineer | 390 | 12717px tall, 15.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 89 | `/insights/texas-pe-license-lookup` | signed out, customer, admin, csr, technician, engineer | 390 | 11538px tall, 13.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 90 | `/insights/texas-professional-services-procurement-act` | signed out, customer, admin, csr, technician, engineer | 390 | 14944px tall, 17.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 91 | `/insights/texas-windstorm-certificate-lookup` | signed out, customer, admin, csr, technician, engineer | 390 | 11630px tall, 13.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 92 | `/insights/twia-coverage-homes-built-before-1988` | signed out, customer, admin, csr, technician, engineer | 390 | 9950px tall, 11.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 93 | `/insights/twia-eligibility-requirements` | signed out, customer, admin, csr, technician, engineer | 390 | 12078px tall, 14.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 94 | `/insights/windstorm-certificate-of-compliance` | signed out, customer, admin, csr, technician, engineer | 390 | 10502px tall, 12.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 95 | `/insights/windstorm-inspection-for-roofers` | signed out, customer, admin, csr, technician, engineer | 390 | 10412px tall, 12.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 96 | `/privacy` | signed out, customer, admin, csr, technician, engineer | 390 | 7754px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 97 | `/process` | signed out, customer, admin, csr, technician, engineer | 390 | 10776px tall, 12.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 98 | `/services` | signed out, customer, admin, csr, technician, engineer | 390 | 7415px tall, 8.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 99 | `/services/foundation-inspections` | signed out, customer, admin, csr, technician, engineer | 390 | 9627px tall, 11.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 100 | `/services/manufactured-home-foundation-certifications` | signed out, customer, admin, csr, technician, engineer | 390 | 8832px tall, 10.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 101 | `/services/repair-specifications` | signed out, customer, admin, csr, technician, engineer | 390 | 7897px tall, 9.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 102 | `/services/residential-light-commercial-design` | signed out, customer, admin, csr, technician, engineer | 390 | 9043px tall, 10.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 103 | `/services/roof-inspections` | signed out, customer, admin, csr, technician, engineer | 390 | 10511px tall, 12.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 104 | `/services/solar-structural-letters` | signed out, customer, admin, csr, technician, engineer | 390 | 8337px tall, 9.9 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 105 | `/services/structural-letters` | signed out, customer, admin, csr, technician, engineer | 390 | 8543px tall, 10.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 106 | `/services/windstorm-wpi-8` | signed out, customer, admin, csr, technician, engineer | 390 | 10459px tall, 12.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 107 | `/structural-engineer` | signed out, customer, admin, csr, technician, engineer | 390 | 9989px tall, 11.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 108 | `/structural-engineer/cost` | signed out, customer, admin, csr, technician, engineer | 390 | 7180px tall, 8.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 109 | `/structural-engineer/how-to-choose` | signed out, customer, admin, csr, technician, engineer | 390 | 8029px tall, 9.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 110 | `/structural-engineer/inspection` | signed out, customer, admin, csr, technician, engineer | 390 | 7064px tall, 8.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 111 | `/structural-engineer/when-you-need-one` | signed out, customer, admin, csr, technician, engineer | 390 | 8273px tall, 9.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 112 | `/terms` | signed out, customer, admin, csr, technician, engineer | 390 | 7973px tall, 9.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 113 | `/what-is-a-structural-engineer` | signed out, customer, admin, csr, technician, engineer | 390 | 8442px tall, 10.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 114 | `/windstorm` | signed out, customer, admin, csr, technician, engineer | 390 | 7795px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 115 | `/windstorm/appointed-engineers` | signed out, customer, admin, csr, technician, engineer | 390 | 7607px tall, 9.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 116 | `/windstorm/before-work-begins` | signed out, customer, admin, csr, technician, engineer | 390 | 8478px tall, 10.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 117 | `/windstorm/buying-and-selling` | signed out, customer, admin, csr, technician, engineer | 390 | 7413px tall, 8.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 118 | `/windstorm/catastrophe-area` | signed out, customer, admin, csr, technician, engineer | 390 | 7853px tall, 9.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 119 | `/windstorm/completed-construction` | signed out, customer, admin, csr, technician, engineer | 390 | 7774px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 120 | `/windstorm/opening-protection` | signed out, customer, admin, csr, technician, engineer | 390 | 7292px tall, 8.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 121 | `/windstorm/re-roofs-and-repairs` | signed out, customer, admin, csr, technician, engineer | 390 | 7339px tall, 8.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 122 | `/windstorm/twia-coverage` | signed out, customer, admin, csr, technician, engineer | 390 | 7375px tall, 8.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |

## Exercised and held

Not findings. These are the cases the sweep attacked and the product refused correctly, listed so a case that PASSED can be told apart from one that never ran.

- `/account` as customer with an expired session: an expired session was refused with 307, and a valid reproduction was accepted first, so the case was genuinely exercised
- `/account` as customer with a tampered expiry: an expiry edited to a future value was refused with 307, so the signature covers it
- `/account/login` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/account/login` as signed out: "Sign in" with nothing at all was handled: the handler answered 400
- `/account/login` as signed out: "Sign in" with far too much text was handled: the handler answered 400
- `/account/login` as signed out: "Sign in" with markup in every text field was handled: the handler answered 400
- `/account/login` as signed out: "Sign in" with the wrong type in every typed field was handled: the handler answered 400
- `/account/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/account/sign-up` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/account/session` as customer: an email uppercased signed in, so the address is normalised before it is compared
- `/api/account/session` as customer: an email with a trailing space signed in, so the address is normalised before it is compared
- `/api/account/session` as customer: an email with a leading space signed in, so the address is normalised before it is compared
- `/api/account/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/account/sign-up` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/partner/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/partner/login` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/partner/login` as signed out: "Sign in" with nothing at all was rate limited before the input was evaluated, so this payload proved nothing about validation. The limiter engaging is itself correct
- `/partner/login` as signed out: "Sign in" with far too much text was rate limited before the input was evaluated, so this payload proved nothing about validation. The limiter engaging is itself correct
- `/partner/login` as signed out: "Sign in" with markup in every text field was rate limited before the input was evaluated, so this payload proved nothing about validation. The limiter engaging is itself correct
- `/partner/login` as signed out: "Sign in" with the wrong type in every typed field was rate limited before the input was evaluated, so this payload proved nothing about validation. The limiter engaging is itself correct
- `/partner/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/portal/login` as admin: "Sign in" with nothing at all was handled: the handler answered 400
- `/portal/login` as admin: "Sign in" with far too much text was rate limited before the input was evaluated, so this payload proved nothing about validation. The limiter engaging is itself correct
- `/portal/login` as admin: "Sign in" with markup in every text field was rate limited before the input was evaluated, so this payload proved nothing about validation. The limiter engaging is itself correct
- `/portal/login` as admin: "Sign in" with the wrong type in every typed field was rate limited before the input was evaluated, so this payload proved nothing about validation. The limiter engaging is itself correct

## Could not tell

- **the reused reset link case**: no reset token was present to reuse, and the sweep does not call the public reset route because that route queues mail
- **form abuse and control clicking on the partner surface, 7 route(s)**: the sweep builds no partner principal, so these screens were reached signed out, redirected, and never opened. Their forms and controls are unmeasured rather than clean
- **form abuse and control clicking on /portal**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/accounts**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/applications**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/audit**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/billing**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/certification**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/charge-log**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/clients**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/deletion-requests**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/documents**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/files**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/files/dispatch**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/inquiries**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/intake**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/jobs**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/launch**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/messages**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/mfa**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/mfa/enrol**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/onboarding**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/orders**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/partners**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/partners/disputes**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/pay**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/people**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/pricebook**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/profile**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/protocols**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/protocols/rc-001**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/queue**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/reports**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/review**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/roles**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/status**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/suppressions**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/tasks**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/techs**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/waiting**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /portal/windstorm-inquiries**: it redirected to /portal/login as admin, so its own forms and controls were never reached
- **form abuse and control clicking on /partner**: it redirected to /partner/login as signed out, so its own forms and controls were never reached
- **form abuse and control clicking on /partner/agreement**: it redirected to /partner/login as signed out, so its own forms and controls were never reached
- **form abuse and control clicking on /partner/materials**: it redirected to /partner/login as signed out, so its own forms and controls were never reached
- **form abuse and control clicking on /partner/referrals**: it redirected to /partner/login as signed out, so its own forms and controls were never reached
- **form abuse and control clicking on /partner/statements**: it redirected to /partner/login as signed out, so its own forms and controls were never reached
- **form abuse and control clicking on /account/forgot-password**: it redirected to /account/settings as customer, so its own forms and controls were never reached

## The probes, and what was removed

- removed: staff probes: swept, 0 left on audit-probe.invalid
- removed: 0 customer auth token(s)
- removed: 1 customer user
- removed: 1 customer account superseded and closed
- read back: 0 account(s) remain on the probe domain

Audit rows these probes caused are permanent. `eng_audit_events` refuses deletes
by design, and a customer account is superseded rather than removed because the
orders and statements attached to one are the record of what somebody was charged.
