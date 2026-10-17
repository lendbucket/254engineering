# The break it sweep, 2026-10-10

Report only. Nothing in this file has been fixed.

## What was swept

- Static routes on disk belonging to no declared surface: **0**
- Declared routes with no page: **2**
- Dynamic routes, which need a parameter and were not visited: **16**

### Form abuse, and every control that does not submit

Forms: **16** found on **16** route(s), **37** submission(s) made. Each form got four payloads: nothing at all, far too much text, markup, and the wrong type in every typed field.

Controls: **749** pressable controls that do not submit, found on **102** route(s), **668** pressed. A control counts as dead only when pressing it moves none of four things: a DOM mutation, its own aria state, the URL, or a request.

**One principal per route.** A portal route was opened as admin, an account route as the customer, a sign in or recovery screen signed out because that is who it is for, and everything else signed out. The owning principal is read from the perimeter's own open path set rather than guessed from the prefix. No route was opened as all six roles, so a control visible only to one of the others was not pressed.

**Controls were clicked at 1280 and at 390. Forms were abused at 1280 only.** The first run clicked at 1280 alone and pressed roughly one control per page, which reads like thorough coverage of a site with no buttons: the mobile menu button measures zero by zero at 1280, so the most pressable control in the product was never pressed anywhere. A form's fields do not appear and disappear with the viewport the way a menu does, so abusing each one twice would have doubled the expensive half for no new subject.

**6 form(s) and 2 control(s) were deliberately not pressed**, because their visible label says they take money or send something. Nothing matching pay, checkout, refund, send, email, SMS, notify, invite, resend or place the order was touched, which is why this sweep made no charge and sent nothing.

- not pressed: / "Send message"
- not pressed: /account/forgot-password "Email me a link"
- not pressed: /contact "Send message"
- not pressed: /design-inquiry "Send this brief"
- not pressed: /partner/materials "Send for approval"
- not pressed: /portal/accounts "Send the link"
- not pressed: /portal/messages "Message somebody"

**2 route(s) have more than forty pressable controls**, and only the first forty were pressed on each. The number found is the true count; the number pressed is not. Stated rather than left as a figure that reads like a total: /portal/people at 1280 (77), /portal/people at 390 (77)

## Findings, ranked

72 distinct finding(s), collapsed from 1049 observation(s). A finding seen by four roles at two widths is one finding and seven copies; the roles and widths it was seen at are in their own columns.

| # | Route | Role | Width | What happened | Severity | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `/account/settings` | customer | 1280, 390 | wording that promises or warrants: "usually :: .... No preference Standard As soon as the firm can Urgent Counties you usually work in Comma separated. Offered when you are filling in a bulk subm..." | 2 wrong data shown | behaviour |
| 2 | `/api/account/session` | customer | n/a | an email uppercased did NOT sign in (429), so a person who types their own address with different case or a pasted space cannot get in | 2 wrong data shown | behaviour |
| 3 | `/api/account/session` | customer | n/a | an email with a trailing space did NOT sign in (429), so a person who types their own address with different case or a pasted space cannot get in | 2 wrong data shown | behaviour |
| 4 | `/api/account/session` | customer | n/a | an email with a leading space did NOT sign in (429), so a person who types their own address with different case or a pasted space cannot get in | 2 wrong data shown | behaviour |
| 5 | `/api/account/session` | customer | n/a | ten wrong passwords were refused identically (429), so nothing visibly rate limits a password guess on this route | 2 wrong data shown | behaviour |
| 6 | `/portal` | csr | 1280, 390 | wording that promises or warrants: "usually :: .... Nobody outside the firm is waiting on these, but work sitting still usually is. What could not be counted Reported rather than fixed by widenin..." | 2 wrong data shown | behaviour |
| 7 | `(the surface inventory)` | n/a | n/a | 2 declared route(s) have no page on disk: /order/start/roof-inspections, /order/254-B2026-000000 | 3 dead path | behaviour |
| 8 | `/order` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 3342px tall, 4.0 phone heights against a ceiling of three. This is an app screen, where length is a form somebody has to finish. | 3 dead path | presentation |
| 9 | `/portal/partners/disputes` | admin | n/a | submitting "Look it up" with nothing at all sent no request, did not move, and showed no message | 3 dead path | behaviour |
| 10 | `/portal/partners/disputes` | admin | n/a | submitting "Look it up" with far too much text sent no request, did not move, and showed no message | 3 dead path | behaviour |
| 11 | `/portal/partners/disputes` | admin | n/a | submitting "Look it up" with markup in every text field sent no request, did not move, and showed no message | 3 dead path | behaviour |
| 12 | `/` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 12645px tall, 15.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 13 | `/about` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8062px tall, 9.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 14 | `/careers` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 14018px tall, 16.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 15 | `/careers/field-inspection-technician` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9596px tall, 11.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 16 | `/careers/professional-engineer` | signed out | 390 | 10573px tall, 12.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 17 | `/careers/professional-engineer` | customer, partner, admin, csr, technician, engineer | 390 | 10190px tall, 12.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 18 | `/contact` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 4177px tall, 4.9 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 19 | `/corpus-christi` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8731px tall, 10.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 20 | `/coverage` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8105px tall, 9.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 21 | `/coverage/austin-central-texas` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8838px tall, 10.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 22 | `/coverage/coastal-bend` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9070px tall, 10.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 23 | `/coverage/dallas-fort-worth` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9702px tall, 11.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 24 | `/coverage/greater-houston` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8900px tall, 10.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 25 | `/coverage/panhandle` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9414px tall, 11.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 26 | `/coverage/rio-grande-valley` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8536px tall, 10.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 27 | `/coverage/san-antonio` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8659px tall, 10.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 28 | `/coverage/west-texas` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9738px tall, 11.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 29 | `/design-inquiry` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 5431px tall, 6.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 30 | `/government` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7747px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 31 | `/insights` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8048px tall, 9.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 32 | `/insights/engineer-letter-vs-windstorm-certificate` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 10151px tall, 12.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 33 | `/insights/engineer-of-record-texas` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 13026px tall, 15.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 34 | `/insights/inspection-vs-forensic-report` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 10725px tall, 12.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 35 | `/insights/ongoing-vs-completed-improvement` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9771px tall, 11.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 36 | `/insights/post-construction-evaluation-report` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 10566px tall, 12.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 37 | `/insights/roof-certification-vs-wpi-8` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9858px tall, 11.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 38 | `/insights/texas-engineering-firm-registration` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 12717px tall, 15.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 39 | `/insights/texas-pe-license-lookup` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 11538px tall, 13.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 40 | `/insights/texas-professional-services-procurement-act` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 14944px tall, 17.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 41 | `/insights/texas-windstorm-certificate-lookup` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 11630px tall, 13.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 42 | `/insights/twia-coverage-homes-built-before-1988` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9950px tall, 11.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 43 | `/insights/twia-eligibility-requirements` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 12078px tall, 14.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 44 | `/insights/windstorm-certificate-of-compliance` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 10502px tall, 12.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 45 | `/insights/windstorm-inspection-for-roofers` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 10412px tall, 12.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 46 | `/privacy` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7754px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 47 | `/process` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 10776px tall, 12.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 48 | `/services` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7879px tall, 9.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 49 | `/services/foundation-inspections` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9375px tall, 11.1 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 50 | `/services/manufactured-home-foundation-certifications` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8692px tall, 10.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 51 | `/services/repair-specifications` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7832px tall, 9.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 52 | `/services/residential-light-commercial-design` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8901px tall, 10.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 53 | `/services/roof-inspections` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 10524px tall, 12.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 54 | `/services/solar-structural-letters` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8159px tall, 9.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 55 | `/services/structural-letters` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8743px tall, 10.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 56 | `/services/windstorm-wpi-8` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 10674px tall, 12.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 57 | `/structural-engineer` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 9989px tall, 11.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 58 | `/structural-engineer/cost` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7253px tall, 8.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 59 | `/structural-engineer/how-to-choose` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8029px tall, 9.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 60 | `/structural-engineer/inspection` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7199px tall, 8.5 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 61 | `/structural-engineer/when-you-need-one` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8302px tall, 9.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 62 | `/terms` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7973px tall, 9.4 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 63 | `/what-is-a-structural-engineer` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8442px tall, 10.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 64 | `/windstorm` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7795px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 65 | `/windstorm/appointed-engineers` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7464px tall, 8.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 66 | `/windstorm/before-work-begins` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 8478px tall, 10.0 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 67 | `/windstorm/buying-and-selling` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7413px tall, 8.8 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 68 | `/windstorm/catastrophe-area` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7853px tall, 9.3 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 69 | `/windstorm/completed-construction` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7774px tall, 9.2 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 70 | `/windstorm/opening-protection` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7292px tall, 8.6 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 71 | `/windstorm/re-roofs-and-repairs` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7339px tall, 8.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |
| 72 | `/windstorm/twia-coverage` | signed out, customer, partner, admin, csr, technician, engineer | 390 | 7375px tall, 8.7 phone heights against a ceiling of three. This is long-form marketing content, where length may be intended. | 4 presentation | presentation |

## Exercised and held

Not findings. These are the cases the sweep attacked and the product refused correctly, listed so a case that PASSED can be told apart from one that never ran.

- `/account` as signed out: redirected to /account/login, which is the perimeter refusing a signed out on a account route
- `/account` as partner: redirected to /account/login, which is the perimeter refusing a partner on a account route
- `/account` as admin: redirected to /account/login, which is the perimeter refusing a admin on a account route
- `/account` as csr: redirected to /account/login, which is the perimeter refusing a csr on a account route
- `/account` as technician: redirected to /account/login, which is the perimeter refusing a technician on a account route
- `/account` as engineer: redirected to /account/login, which is the perimeter refusing a engineer on a account route
- `/account` as customer with an expired session: an expired session was refused with 307, and a valid reproduction was accepted first, so the case was genuinely exercised
- `/account` as customer with a tampered expiry: an expiry edited to a future value was refused with 307, so the signature covers it
- `/account/forgot-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/account/forgot-password` as customer: redirected to /account/settings because this principal is already signed in, which is what a sign in screen should do
- `/account/login` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/account/login` as customer: redirected to /account because this principal is already signed in, which is what a sign in screen should do
- `/account/login` as signed out: "Sign in" with nothing at all was handled: the handler answered 400
- `/account/login` as signed out: "Sign in" with far too much text was handled: the handler answered 400
- `/account/login` as signed out: "Sign in" with markup in every text field was handled: the handler answered 400
- `/account/login` as signed out: "Sign in" with the wrong type in every typed field was handled: the handler answered 400
- `/account/order` as signed out: redirected to /account/login, which is the perimeter refusing a signed out on a account route
- `/account/order` as partner: redirected to /account/login, which is the perimeter refusing a partner on a account route
- `/account/order` as admin: redirected to /account/login, which is the perimeter refusing a admin on a account route
- `/account/order` as csr: redirected to /account/login, which is the perimeter refusing a csr on a account route
- `/account/order` as technician: redirected to /account/login, which is the perimeter refusing a technician on a account route
- `/account/order` as engineer: redirected to /account/login, which is the perimeter refusing a engineer on a account route
- `/account/orders` as signed out: redirected to /account/login, which is the perimeter refusing a signed out on a account route
- `/account/orders` as partner: redirected to /account/login, which is the perimeter refusing a partner on a account route
- `/account/orders` as admin: redirected to /account/login, which is the perimeter refusing a admin on a account route
- `/account/orders` as csr: redirected to /account/login, which is the perimeter refusing a csr on a account route
- `/account/orders` as technician: redirected to /account/login, which is the perimeter refusing a technician on a account route
- `/account/orders` as engineer: redirected to /account/login, which is the perimeter refusing a engineer on a account route
- `/account/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/account/settings` as signed out: redirected to /account/login, which is the perimeter refusing a signed out on a account route
- `/account/settings` as partner: redirected to /account/login, which is the perimeter refusing a partner on a account route
- `/account/settings` as admin: redirected to /account/login, which is the perimeter refusing a admin on a account route
- `/account/settings` as csr: redirected to /account/login, which is the perimeter refusing a csr on a account route
- `/account/settings` as technician: redirected to /account/login, which is the perimeter refusing a technician on a account route
- `/account/settings` as engineer: redirected to /account/login, which is the perimeter refusing a engineer on a account route
- `/account/sign-up` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/account/sign-up` as customer: redirected to /account because this principal is already signed in, which is what a sign in screen should do
- `/account/statements` as signed out: redirected to /account/login, which is the perimeter refusing a signed out on a account route
- `/account/statements` as partner: redirected to /account/login, which is the perimeter refusing a partner on a account route
- `/account/statements` as admin: redirected to /account/login, which is the perimeter refusing a admin on a account route
- `/account/statements` as csr: redirected to /account/login, which is the perimeter refusing a csr on a account route
- `/account/statements` as technician: redirected to /account/login, which is the perimeter refusing a technician on a account route
- `/account/statements` as engineer: redirected to /account/login, which is the perimeter refusing a engineer on a account route
- `/api/account/forgot-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/account/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/account/set-password` as customer: a reset link was spent once and the second attempt was refused with 400, with the first spend proven to have succeeded first
- `/api/account/set-password` as customer: and the stored password did not change on the second spend, so the refusal actually prevented the change rather than only reporting one
- `/api/account/sign-up` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/api/partner/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/partner` as signed out: redirected to /partner/login, which is the perimeter refusing a signed out on a partner route
- `/partner` as customer: redirected to /partner/login, which is the perimeter refusing a customer on a partner route
- `/partner` as admin: redirected to /partner/login, which is the perimeter refusing a admin on a partner route
- `/partner` as csr: redirected to /partner/login, which is the perimeter refusing a csr on a partner route
- `/partner` as technician: redirected to /partner/login, which is the perimeter refusing a technician on a partner route
- `/partner` as engineer: redirected to /partner/login, which is the perimeter refusing a engineer on a partner route
- `/partner/agreement` as signed out: redirected to /partner/login, which is the perimeter refusing a signed out on a partner route
- `/partner/agreement` as customer: redirected to /partner/login, which is the perimeter refusing a customer on a partner route
- `/partner/agreement` as admin: redirected to /partner/login, which is the perimeter refusing a admin on a partner route
- `/partner/agreement` as csr: redirected to /partner/login, which is the perimeter refusing a csr on a partner route
- `/partner/agreement` as technician: redirected to /partner/login, which is the perimeter refusing a technician on a partner route
- `/partner/agreement` as engineer: redirected to /partner/login, which is the perimeter refusing a engineer on a partner route
- `/partner/login` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/partner/login` as partner: redirected to /partner because this principal is already signed in, which is what a sign in screen should do
- `/partner/login` as signed out: "Sign in" with nothing at all was handled: the handler answered 400
- `/partner/login` as signed out: "Sign in" with far too much text was handled: the handler answered 400
- `/partner/login` as signed out: "Sign in" with markup in every text field was handled: the handler answered 400
- `/partner/login` as signed out: "Sign in" with the wrong type in every typed field was handled: the handler answered 400
- `/partner/materials` as signed out: redirected to /partner/login, which is the perimeter refusing a signed out on a partner route
- `/partner/materials` as customer: redirected to /partner/login, which is the perimeter refusing a customer on a partner route
- `/partner/materials` as admin: redirected to /partner/login, which is the perimeter refusing a admin on a partner route
- `/partner/materials` as csr: redirected to /partner/login, which is the perimeter refusing a csr on a partner route
- `/partner/materials` as technician: redirected to /partner/login, which is the perimeter refusing a technician on a partner route
- `/partner/materials` as engineer: redirected to /partner/login, which is the perimeter refusing a engineer on a partner route
- `/partner/referrals` as signed out: redirected to /partner/login, which is the perimeter refusing a signed out on a partner route
- `/partner/referrals` as customer: redirected to /partner/login, which is the perimeter refusing a customer on a partner route
- `/partner/referrals` as admin: redirected to /partner/login, which is the perimeter refusing a admin on a partner route
- `/partner/referrals` as csr: redirected to /partner/login, which is the perimeter refusing a csr on a partner route
- `/partner/referrals` as technician: redirected to /partner/login, which is the perimeter refusing a technician on a partner route
- `/partner/referrals` as engineer: redirected to /partner/login, which is the perimeter refusing a engineer on a partner route
- `/partner/set-password` as signed out: it is a door for somebody with no session and the perimeter lets it through
- `/partner/statements` as signed out: redirected to /partner/login, which is the perimeter refusing a signed out on a partner route
- `/partner/statements` as customer: redirected to /partner/login, which is the perimeter refusing a customer on a partner route
- `/partner/statements` as admin: redirected to /partner/login, which is the perimeter refusing a admin on a partner route
- `/partner/statements` as csr: redirected to /partner/login, which is the perimeter refusing a csr on a partner route
- `/partner/statements` as technician: redirected to /partner/login, which is the perimeter refusing a technician on a partner route
- `/partner/statements` as engineer: redirected to /partner/login, which is the perimeter refusing a engineer on a partner route
- `/portal` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/accounts` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/accounts` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/accounts` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/accounts` as csr, technician, engineer: redirected to /portal, which is how this platform sends a role elsewhere when a screen is not theirs. It is declared for no role in particular
- `/portal/applications` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/applications` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/applications` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/applications` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/audit` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/audit` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/audit` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/audit` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/billing` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/billing` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/billing` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/billing` as csr, technician, engineer: redirected to /portal, which is how this platform sends a role elsewhere when a screen is not theirs. It is declared for no role in particular
- `/portal/certification` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/certification` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/certification` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/certification` as admin, csr, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/charge-log` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/charge-log` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/charge-log` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/charge-log` as csr, technician: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/clients` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/clients` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/clients` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/clients` as technician: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/deletion-requests` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/deletion-requests` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/deletion-requests` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/deletion-requests` as technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/deletion-requests` as admin: "Record the request" with nothing at all was handled: it said why
- `/portal/deletion-requests` as admin: "Record the request" with far too much text was handled: it said why
- `/portal/deletion-requests` as admin: "Record the request" with markup in every text field was handled: it said why
- `/portal/deletion-requests` as admin: "Record the request" with the wrong type in every typed field was handled: it said why
- `/portal/documents` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/documents` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/documents` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/documents` as csr, technician: redirected to /portal, which is how this platform sends a role elsewhere when a screen is not theirs. It is declared for no role in particular
- `/portal/files` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/files` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/files` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/files/dispatch` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/files/dispatch` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/files/dispatch` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/files/dispatch` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/inquiries` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/inquiries` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/inquiries` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/inquiries` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/intake` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/intake` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/intake` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/intake` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/jobs` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/jobs` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/jobs` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/jobs` as csr, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/launch` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/launch` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/launch` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/launch` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/login` as admin: redirected to /portal because this principal is already signed in, which is what a sign in screen should do
- `/portal/login` as csr: redirected to /portal/files because this principal is already signed in, which is what a sign in screen should do
- `/portal/login` as technician: redirected to /portal/jobs because this principal is already signed in, which is what a sign in screen should do
- `/portal/login` as engineer: redirected to /portal/review because this principal is already signed in, which is what a sign in screen should do
- `/portal/login` as signed out: "Sign in" with nothing at all was handled: the handler answered 400
- `/portal/login` as signed out: "Sign in" with far too much text was handled: the handler answered 400
- `/portal/login` as signed out: "Sign in" with markup in every text field was handled: the handler answered 400
- `/portal/login` as signed out: "Sign in" with the wrong type in every typed field was handled: the handler answered 400
- `/portal/messages` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/messages` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/messages` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/messages` as admin: "Search" with nothing at all was handled: the handler answered 200
- `/portal/messages` as admin: "Search" with far too much text was handled: the handler answered 200
- `/portal/messages` as admin: "Search" with markup in every text field was handled: the handler answered 200
- `/portal/messages` as admin: "Search" with the wrong type in every typed field was handled: the handler answered 200
- `/portal/mfa` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/mfa` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/mfa` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/mfa` as admin: redirected to /portal because this principal is already signed in, which is what a sign in screen should do
- `/portal/mfa` as csr: redirected to /portal/files because this principal is already signed in, which is what a sign in screen should do
- `/portal/mfa` as technician: redirected to /portal/jobs because this principal is already signed in, which is what a sign in screen should do
- `/portal/mfa` as engineer: redirected to /portal/review because this principal is already signed in, which is what a sign in screen should do
- `/portal/mfa/enrol` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/mfa/enrol` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/mfa/enrol` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/onboarding` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/onboarding` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/onboarding` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/onboarding` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/orders` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/orders` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/orders` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/orders` as csr, technician, engineer: redirected to /portal, which is how this platform sends a role elsewhere when a screen is not theirs. It is declared for no role in particular
- `/portal/partners` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/partners` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/partners` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/partners` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/partners` as admin: "Add partner" with nothing at all was handled: the handler answered 400
- `/portal/partners` as admin: "Add partner" with far too much text was handled: the handler answered 400
- `/portal/partners` as admin: "Add partner" with markup in every text field was handled: the handler answered 400
- `/portal/partners` as admin: "Add partner" with the wrong type in every typed field was handled: the handler answered 400
- `/portal/partners/disputes` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/partners/disputes` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/partners/disputes` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/partners/disputes` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/pay` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/pay` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/pay` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/pay` as csr: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/people` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/people` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/people` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/people` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/pricebook` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/pricebook` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/pricebook` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/pricebook` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/profile` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/profile` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/profile` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/profile` as admin: "Change password" with nothing at all was handled: it said why
- `/portal/profile` as admin: "Change password" with far too much text was handled: it said why
- `/portal/profile` as admin: "Change password" with markup in every text field was handled: it said why
- `/portal/profile/seal` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/profile/seal` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/profile/seal` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/profile/seal` as admin, csr, technician: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/protocols` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/protocols` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/protocols` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/protocols` as admin, csr, technician: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/protocols/rc-001` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/protocols/rc-001` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/protocols/rc-001` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/protocols/rc-001` as admin, csr, technician: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/queue` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/queue` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/queue` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/queue` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/reports` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/reports` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/reports` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/reports` as csr, technician: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/review` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/review` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/review` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/review` as admin, csr, technician: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/roles` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/roles` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/roles` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/roles` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/status` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/status` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/status` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/status` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/suppressions` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/suppressions` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/suppressions` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/suppressions` as technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/suppressions` as admin: "Record the request" with nothing at all was handled: it said why
- `/portal/suppressions` as admin: "Record the request" with far too much text was handled: it said why
- `/portal/suppressions` as admin: "Record the request" with markup in every text field was handled: it said why
- `/portal/suppressions` as admin: "Record the request" with the wrong type in every typed field was handled: it said why
- `/portal/tasks` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/tasks` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/tasks` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/tasks` as admin: "Add" with nothing at all was handled: it said why
- `/portal/tasks` as admin: "Add" with far too much text was handled: it said why
- `/portal/tasks` as admin: "Add" with markup in every text field was handled: it said why
- `/portal/techs` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/techs` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/techs` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/techs` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/waiting` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/waiting` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/waiting` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/waiting` as admin, csr, technician: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular
- `/portal/windstorm-inquiries` as signed out: redirected to /portal/login, which is the perimeter refusing a signed out on a portal route
- `/portal/windstorm-inquiries` as customer: redirected to /portal/login, which is the perimeter refusing a customer on a portal route
- `/portal/windstorm-inquiries` as partner: redirected to /portal/login, which is the perimeter refusing a partner on a portal route
- `/portal/windstorm-inquiries` as csr, technician, engineer: HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for no role in particular

## Could not tell

- **form abuse and control clicking on /portal/mfa**: no session could be built for its owning role: no principal owns this route. The screen was never opened as the principal that owns it
- **form abuse and control clicking on /portal/mfa/enrol**: no session could be built for its owning role: no principal owns this route. The screen was never opened as the principal that owns it

## The probes, and what was removed

- removed: staff probes: swept, 0 left on audit-probe.invalid
- removed: partner probes: swept, 0 left on audit-probe.invalid
- removed: 1 customer auth token(s)
- removed: 1 customer user
- removed: 1 customer account superseded and closed
- read back: 0 account(s) remain on the probe domain

Audit rows these probes caused are permanent. `eng_audit_events` refuses deletes
by design, and a customer account is superseded rather than removed because the
orders and statements attached to one are the record of what somebody was charged.
