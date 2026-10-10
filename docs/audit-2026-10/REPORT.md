# Product audit, October 2026

Report only. Nothing here changes the product; findings are ranked
blocks-launch, before-the-20th, or later, and a decision with two reasonable
answers goes on the decisions list rather than being taken.

Started 2026-10-09 after main reached 804fc29 with the not-yet-V10 list at
zero.

## Preflight: nothing this audit does can reach a real person or a real service

### What the operator's counterpart read on the development database

- No edge functions.
- No `pg_net` or `http` extension.
- No database function or trigger that makes an outbound call.

So the one remaining outbound path from development is **Supabase Auth's own
email**: password reset, confirmation and magic link.

### The rules this audit follows for Supabase Auth (operator, 2026-10-09)

- Every auth test, every brute force attempt and every seeded account uses
  only `@audit-probe.invalid` addresses.
- No reset, confirmation or link is ever triggered for any real address that
  exists in development, including robertreyna88@yahoo.com and ceo@36west.org.
- Seeded users are created through the admin API with the email already
  confirmed (`email_confirm: true`), so no confirmation mail is queued.

### What the code can make Supabase Auth send: nothing

Read from the source on 2026-10-09, every call into Supabase Auth:

| Call | Where | Sends mail? |
| --- | --- | --- |
| `auth.signInWithPassword` | `src/lib/ops-auth.ts` (sign in, and re-checking a current password) | No |
| `auth.admin.createUser` | `src/lib/ops-auth.ts`, with `email_confirm: true` | No |
| `auth.admin.updateUserById` | `src/lib/ops-auth.ts` (password set by the platform) | No |
| `auth.admin.listUsers`, `deleteUser` | `src/lib/ops-auth.ts` | No |
| `auth.admin.createUser` | `scripts/lib/portal-probe.mjs`, with `email_confirm: true` | No |

No call to `resetPasswordForEmail`, `signInWithOtp`, `signUp`,
`inviteUserByEmail`, `generateLink` or `resend` exists anywhere in `src/` or
`scripts/`. Staff password resets and customer links are the platform's own
tokens, sent through its own email path, below.

### The process.env scan: every name the application reads

Derived from the source, not listed by hand: `process.env.X`,
`process.env["X"]`, a local `env("X")` helper, and a constant handed to
`process.env[...]`, across the 488 files of `src/` and `data/`. 36 names.
Cross-checked against `src/config/credential-inventory.ts`, the declaration
`soc2-audit` keeps in step with the environment files. Whether development's
`.env.local` sets each was read by NAME ONLY; no value was read into any
output.

Names that can reach an outside service:

| Name | Set in development | What it would reach |
| --- | --- | --- |
| `RESEND_API_KEY` | **no** | email (Resend). Unset, the platform logs `[notify] skipped ... RESEND_API_KEY is not set` and sends nothing; seen in the board's own server log |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **no** | Stripe. Unset, no charge or refund can be made |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `*_RELEASE` | **no** | error telemetry |
| `CRON_SECRET` | **no** | the scheduled routes' bearer; not outbound |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | the **development** project, which `scripts/lib/db-target.mjs` refuses to swap for production without `ALLOW_PRODUCTION_DB=1` |
| `NEXT_PUBLIC_SITE_URL` | yes | the site's own origin, for links in messages that are not sent |

**SMS and Checkr: no path exists.** No Twilio, SMS or Checkr name appears in
the source or in the credential declaration; neither integration is built.

`ALLOW_REAL_EMAIL_SENDS` is declared and read by nothing in the source; it is
unset.

### Process

The scan script, the auth call list and the env names were each re-derived on
the day rather than copied from an earlier note. A later change that adds an
outbound integration adds a name the scan would show.

## How the audit was run (2026-10-09 into 2026-10-10)

From main at d282d5a, on development only, with the audit seed (one partner
statement, one customer bulk order) and the demonstration records already
there. Every probe was on `@audit-probe.invalid`; the demonstration personas
(`demo.*@example.com`) were signed in with development's known password and
nothing else.

1. **Inventory and screenshots.** Every route of every portal was opened by
   every principal that could plausibly reach it: the four staff probes (empty),
   the five demonstration staff personas (populated), a partner and a customer
   probe, the seeded partner and customer, and signed out. 92 targets, 440
   screenshots at 390 and 1280, `screens/2026-10-10/<portal>/INDEX.md` lists
   each route, who reached it, who was refused and how.
2. **A capture fault, disclosed.** The first recapture, which grows the window
   to the screen's full scroll height, saved about 110 sign in pages under
   screen names. Two causes: scripts this session ran beside it swept the whole
   probe domain (destroyProbes is deliberately broad), and the demonstration
   personas, enrolled in a second factor by the first run, were given half
   sessions that expire in ten minutes. The lock exists to stop the first; it
   was worked around and should not have been. Those captures are being retaken
   with a check that refuses to save a sign in page; until then the review
   notes mark each "capture invalid" and were written from the source.
3. **Five notes per screen**, written by five read-only reviewers (technician,
   engineer, administrator and customer service, partner customer and order,
   public), each told to verify against the source and to mark every defect a
   candidate. The lead reproduced each candidate before it counted.
4. **Brute force**, beyond the break-it sweep of 2026-10-02: sign in limits on
   the three doors, double submit, two tabs, back button, refresh mid action,
   an expired session, offline and resubmit, slow network, and every role
   opening other accounts' records.

## Brute force log

| Area | Attempt | Result | Verdict |
| --- | --- | --- | --- |
| Sign in limit | portal: 12 wrong passwords for one probe | 401 x8, then 429 | held |
| Sign in limit | partner: the same | 401 x8, then 429 | held |
| Sign in limit | **customer: the same** | **401 x12, never limited** (also found 2026-10-02) | **defect, fixed** |
| Sign in limit | a different account, right password, same address, after 24 failures | 429 | by design (20 per address) |
| Double submit | certification credential, double click | 1 pending row | held |
| Two tabs | **the same credential from two tabs at once** | **2 pending rows, twice** | **defect, migration staged** |
| Back button | submit, leave, back, submit again | 1 row, refused by name | held |
| Refresh mid action | submit and reload at once | at most 1 row | held |
| Expired session | cookie removed after the form loaded | nothing written, "Not signed in." | held (copy gap) |
| Offline | **submit with the network off** | **button stuck disabled, nothing said, twice** | **defect, fixed** |
| Other accounts | customer opens another customer's bulk order | 404 | held |
| Other accounts | partner opens another partner's statement | 404 | held |
| Other accounts | technician opens another technician's job | 404 | held |
| Other accounts | technician opens the roster; customer opens the staff portal; partner opens the account | 404; sign in; sign in | held |
| Slow network | 400 kbps, 400 ms, at 390: home, order start, certification, My jobs | 6.9 to 7.5 s, all render | held |

## Defects

A defect is the product not doing what it already claims. Each was reproduced
(live, or in the source where the shape is a single line read by every path,
which is said) before it counted. Access and money first.

| # | Defect | Found by | Reproduced | Status |
| --- | --- | --- | --- | --- |
| 1 | **A stolen password alone could replace an account's second factor** and open the portal: from the half session, begin and confirm ran for an already enrolled account, and codes_saved minted a full session | engineer review | **live, on d282d5a**: a probe administrator enrolled, signed in with the password alone, ran begin, confirm with a new secret and codes_saved; the active factor was replaced and the minted cookie opened /portal (200) | fixed, `fix/mfa-no-replace-from-password`, **merged in 8c991fd** (board 61 of 61) |
| 2 | **Any engineer account could decide another engineer's file**: canReview never read the assignee and both callers passed the caller's own id | engineer review | live, through openReview and decideReview, two probes | fixed, `fix/review-belongs-to-its-engineer`, **merged in 8c991fd** (board 61 of 61) |
| 3 | **Customer sign in had no rate limit** | brute force (and 2026-10-02) | twice, live | fixed, `fix/customer-sign-in-limit`, **merged in 8c991fd** (board 61 of 61) |
| 4 | **An offer with no rate could be accepted**, and no pay entry is written for it at submission | the "not set" rate on My jobs | live, through acceptOffer | fixed, `fix/offer-needs-a-rate`, **merged in 8c991fd** (board 61 of 61) |
| 5 | **Void pay counted as owed** on both dashboards; the Pay screen summed a different set over a silent 300 row cap | technician review | in the source and by a ledger built to separate the cases | fixed, `fix/pay-owed-one-home`, **merged in 8c991fd** (board 61 of 61) |
| 6 | **Partner pages said thirty days; the rule credits ninety** | partner screenshot | in the source against the pinned rule | fixed, `fix/partner-window-copy`, **merged in 8c991fd** (board 61 of 61) |
| 7 | **39 server rendered dates named no zone**, so after 7 pm Central a date read as the next day | technician screenshot | in a child process with TZ=UTC | fixed, `fix/dates-in-central`, **merged in 8c991fd** (board 61 of 61) |
| 8 | **Credential form stuck busy offline**, and the verify queue the same | brute force | twice, live | fixed, `fix/credential-form-offline`, **merged in 8c991fd** (board 61 of 61) |
| 9 | **Two tabs wrote two pending credentials** | brute force | twice, live | migration 0067 staged, `fix/credential-one-pending`; not merged |
| 10 | **Sign out on the second factor screens answered 405** | technician review | in the source: a GET link to a route with POST and DELETE only | fixed, `fix/mfa-sign-out`, **merged in 8c991fd** (board 61 of 61) |
| 11 | **Waiting on owners linked every row to a route that does not exist** | engineer review | in the source | fixed, `fix/waiting-links`, **merged in 8c991fd** (board 61 of 61) |
| 12 | **A refund reason carried from one order's panel to the next** | admin review | in the source | fixed, `fix/refund-reason-per-order`, **merged in 8c991fd** (board 61 of 61) |

### Defects found and still open, with the reason

| # | Defect | Where | Why open |
| --- | --- | --- | --- |
| 13 | A signed in customer cannot open their own single orders from Your orders: rows link to `/order/<ref>` with no token, and that page says the link does not open an order | `account/orders/page.tsx:132,142` | The fix is either an account scoped order page (a new screen) or issuing a signed link on render (a behaviour change). A ruling, then a branch |
| 14 | An approved partner asset ("Who performs the work", v5) tells partners the registration is pending and names 254 Engineering Services as the firm | the asset row, seeded at `seed-field-demo.mjs:1331` on development; production's assets not read | Partner facing compliance copy in a database row; needs your re-approval of the asset, and a check that published assets track the register |
| 15 | Public sentences typed by hand say no phone, no registration, no engineer of record, beside a footer saying otherwise; /services says nine lines and shows eight; the privacy policy says there is no account system | `contact/page.tsx:134`, `data/positions.ts:147`, `insights.ts:317`, `services/page.tsx:18,36,54`, the privacy page | Regulatory and customer facing copy: your ruling per sentence (the public review proposes routing each through the register's derivers and a compliance-audit check) |
| 16 | Partner Referrals and Statements say "Showing all N" over lists capped at 100 and 60; Recent activity shows 8 rows under "Every entry on your ledger" | `ops-partner-portal.ts:59` and the two pages | **Fixed later the same night**, `fix/partner-true-totals`, merged in 8c991fd |
| 17 | Customer service dashboard: "most recent N days ago" reads the OLDEST row; the thread count includes private direct messages (7 against the user's 1) | `ops-dashboard.ts:1636, 1733` | "Most recent" **fixed**, `fix/csr-most-recent`, merged in 8c991fd. The thread count is still open: limiting it to the viewer's threads needs the participants table |
| 18 | An administrator's Your pay and Responsible charge sum the whole firm's money under "you", with no person column | `ops-field.ts:2011`, `ops-engineer.ts:1160` | Not reached tonight; needs a person column, a design choice |
| 19 | Launch readiness labels roof "Sellable" while the gate is shut (it asks the signature, not the gate) | `launch/page.tsx:130` | **Fixed later the same night**, `fix/launch-sellable-needs-the-gate`, merged in 8c991fd |
| 20 | The Files list stops at 300 rows without saying so | `ops-crm.ts:421` | Not reached tonight |
| 21 | The file panel says tasks, messages and documents "have not shipped" and that invoicing "arrives with Stripe in a later phase" | `files/page.tsx:367, 439-444` | Staff copy; small; not reached tonight |
| 22 | The order timeline says "The order confirmation was sent" when it was queued, so a send that later fails still reads as sent | `ops-payments.ts:816-830` | The CLAUDE.md 2c class (a timeline entry claiming contact); the wording is customer facing, so a ruling on the sentence |
| 23 | "Back to my jobs" on a job page, and the Documents "audit trail" link, are 404 for an engineer | `jobs/[id]/page.tsx:43-48`, `documents/page.tsx:242` | **Fixed later the same night**, `fix/engineer-dead-links`, merged in 8c991fd |
| 24 | An accepted job whose file is later cancelled disappears from My jobs (matches neither list) | `jobs/page.tsx:51-63` | Not reached tonight |
| 25 | Two links on /about and /government are navy on the navy band, visible only by their underline, and contrast-audit is green over both | `about/page.tsx:115`, `government/page.tsx:116` | Not reproduced tonight (a contrast-audit blind spot if it holds) |
| 26 | Statements can be closed and issued on a closed account | `ops-statements.ts:81` | Not a clear defect: a final invoice for work before closure may be right. On the decisions list |

## The break-it sweep, re-run against 8c991fd

`break-it-sweep-2026-10-10.md`, beside this file: 121 routes, 63 API routes as 7
principals, 16 forms with 37 hostile submissions, 668 of 749 controls pressed
at 390 and 1280. 72 distinct findings from 1,049 observations, 2 could not tell.
Read against tonight's work:

- **The customer sign in limit holds live**: ten wrong passwords are refused
  with 429 (it found the same route unlimited on 2026-10-02).
- **And it masked three of the sweep's own checks.** The email typed in
  capitals, or with a leading or trailing space, also met 429, because the same
  run had just spent the address's attempts. Those three measured the limiter,
  not email normalisation; the route trims and lowercases before it limits, but
  the sweep should run them before its password guessing. A sweep fix, not a
  product defect.
- **`/portal/partners/disputes`, "Look it up" with empty, oversized or markup
  input, reported as showing no message.** Not reproduced: the form sets a
  message for each case (`LookupForm.tsx:60-68`) in an aria-live paragraph; the
  sweep's detector is looking for a different signal. Recorded, not counted.
- **Length**: every public page is long by design; `/order` is 3,342 px, four
  phone heights on an app screen, which is gap material, not a defect.
- **Wording that warrants**: "usually" on `/account/settings` and the customer
  service dashboard, as on 2026-10-02.
