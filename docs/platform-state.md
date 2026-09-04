# The platform, as it actually stands

Written 2026-09-03 and last revised 2026-09-04, at `e4a4417`, after Phase 8
Section 1 merged and deployed.

This is the answer to three questions a session or an operator picking this up
will ask: what is live, what was deliberately not built, and what happens on the
day the TBPELS registration issues.

It is deliberately a separate file from `docs/ops-platform-program.md`, which is
the program and the specifications. **This file is the state. When the two
disagree, this one is newer.**

---

## 1. What is live

Everything below is merged to `main`, deployed to production, and verified from
the running host rather than from intent.

**Production** is `254engineering.com`, Supabase project `fsaryeciduszuahgjbly`,
schema fingerprint `9b32a7cced94549f7aeea93cc3ee3d6e` across 719 `eng_` columns and
48 tables, identical to development and to what `migration-audit` replays to from
an empty database.

### The site

The public marketing site: services, the eight coverage regions and all 254
counties, government and commercial, careers, insights, the firm's own location
page at `/corpus-christi`, and the waitlist.

### The operations platform

| Phase | What it does |
| --- | --- |
| 0 | Auth, roles, the portal shell, the audit trail |
| 1 | Clients, contacts, files, the file state machine |
| 2 | Dispatch by coverage and certification, offers, protocol driven capture with an offline queue, the submission gate |
| 3 | Field technician onboarding, credentials, expiry, certification |
| 4 | Engineer review, the four decisions, responsible charge |
| 5 | Tasks, messages, notifications |
| 6 | The document centre, the evidence binder, billing hooks, three role dashboards, CSV exports |
| 7 | The order engine, the customer's path, payments, refunds, reconciliation |
| 8.1 | The B2B ordering path: customer accounts, bulk ordering, saved defaults, the ordering API, invoicing |

### The order engine, in more detail

Because it is the newest and the least obvious from the code.

- **The catalog** (`data/catalog.ts`) is synchronized verbatim across all three
  brand repositories. A service line can carry several deliverables, keyed on
  the same `tier` the fee schedule has used since migration 0001, so one
  deliverable has one client price and one engineer production figure.
- **The prices** the operator set on 2026-09-03: solar structural letter 450,
  roof certification 600, foundation certification 650, manufactured home
  foundation 650, structural letter for permit 550, WPI-8E windstorm evaluation
  850, repair specification 900, beam and header sizing 750, carport and patio
  cover plan set 1500. Forensic and custom work is quote only. The coastal
  surcharge is 75 on first tier counties and sits on desk services, because a
  coastal letter carries windstorm criteria an inland one does not whether or
  not anybody drives out. Harris County carries none; the reasoning about SH-146
  is recorded in the catalog itself.
- **Capture is at submission.** A Stripe Checkout session in payment mode.
- **The refund rule** is the operator's three cases from 2026-09-02, carried by
  one pure function with three invariants the audit enforces: a refusal with no
  visit is always a full refund; what the firm retains is exactly the
  **disclosed** inspection fee of 175 and never a proportion; and when the firm
  retains anything the customer receives the engineer's findings. The purpose of
  all three is that the firm must never be paid more for certifying than for
  refusing.
- **A fourth case**, `cancelled_by_the_firm`, added 2026-09-03. Deliberately not
  an engineering decision: it always refunds everything including after a
  technician has attended, requires a written reason, and is recorded against
  the operator. It costs the firm strictly more than declining, which is what
  stops it becoming the cheap way out of an awkward engineering decision.
- **The customer never gets an account.** `/order/<reference>` opens on a signed
  token and shows the refund disclosure that was stored at submission, not
  today's copy.
- **Reconciliation** asks Stripe what really happened, rather than waiting to be
  told. `/portal/orders` shows only orders that have stopped moving, and the
  admin dashboard carries a tile and a first place entry in "Needs you".

### Phase 8 Section 1, the B2B ordering path

The unit economics assume repeat buyers. A consumer flow completed eight times is
not a product for a solar installer ordering eight structural letters a month, so
this is the surface those buyers actually use.

**A customer is not a member of staff, structurally rather than by policy.**
`eng_profiles.id` IS the `auth.users` id, and `can()` decides what a row in that
table may do. A customer has no row in either, so `currentActor()` cannot return
one and `can()` cannot grant one anything. `ops-authz` does not know the type
exists. Everything that could confuse the two sessions differs: the cookie name,
the secret, the HMAC label, and the payload shape. The label is the one that
matters, because it means setting both secrets to the same string, which somebody
eventually will, still leaves neither cookie readable as the other.

**Bulk ordering.** One submission, many properties, one payment, and each
property still becomes its own order and its own file because dispatch, review
and responsible charge are all per property. It calls `placeOrder`, the same
function the website uses, rather than reimplementing what the firm may take.

Partial failure is explicit: three of ten rejected means the three are NAMED with
the catalog's own words, and the total is for the seven. A batch with nothing
acceptable produces no checkout at all.

**Saved organisation defaults.** Billing contact, standing access instructions
that reach every order, default counties, and saved properties. Each is wired to
something, because a stored preference that nothing reads is a settings screen
that lies. The one exception says so on the screen: a preferred turnaround is
recorded and shown to the firm and changes nothing, because the catalog does not
sell a priced expedited tier and setting a file to expedited from a saved
preference would commit the firm to faster work at the standard price.

**The ordering API**, documented in `docs/ordering-api.md` and deliberately not on
the public site. The account is read from the key, so there is no field in which
a caller could ask to order for somebody else. Rate limited in the database
rather than in memory, because a limiter in process memory is enforced per
function instance and the real ceiling would be the limit times however many
happen to be warm.

**Invoicing.** An account may be set to invoice, in which case orders are
accepted without payment and billed at period close. Closing and issuing are
separate acts on separate buttons: closing gathers and lets the operator look,
issuing is the moment it becomes a document that has been sent and the clock
starts. An issued statement is never reopened, and a late order belongs on the
next period.

There is no dunning, no reminder schedule, no escalation and no late fee. The
only automatic consequence of an overdue statement is that further invoiced
ordering stops and the customer is told why. That restraint is the operator's
ruling and is asserted as an absence by the audit.

**Where money can attach.** `eng_order_payments.order_id` is nullable and money
may attach to an order, a batch or a statement. The constraint is AT LEAST one
subject rather than exactly one, because a refund of one property out of a batch
legitimately names both, and that row is what says which property the money went
back for.


### Phase 8 Section 2, the job queue

Requests enqueue and return. Nothing that talks to a provider is done while
somebody waits, and the rule the whole section is shaped by is that **a job that
did not run must be visible**.

**Claiming is lease based, not status based.** `eng_claim_jobs` is one SQL
statement using `FOR UPDATE SKIP LOCKED`, so two workers take different rows
rather than the same row or blocking. A row marked running whose lease has
lapsed is claimable again, and that single fact is what makes a worker killed
mid job recoverable instead of silently lost. The alternative, trusting the
status, produces a job that never runs again and never says so.

**Idempotency is mandatory by construction.** A lease expires, so a job CAN run
twice; that is the price of surviving a worker killed without warning, and the
alternative is worse and quieter. So every registration declares how it survives
it: a key function that dedupes the enqueue, or the literal `"naturally"` with a
sentence saying why. `jobs-audit` fails the build on a kind carrying neither, on
a thin reason, and on a key function that returns the same string for different
work.

**Registration is not a side effect import.** The first version had each caller
write `import "@/lib/job-handlers"` for its side effect, which is a line with no
referenced symbol and therefore the line a tidy up deletes. Losing it would
produce the worst failure available: an empty registry, every enqueue refused
and every claimed job dead lettered on "no handler is registered", for code that
was correct. `loadHandlers()` is a lazy dynamic import inside `enqueue` and
`runBatch`, and the audit now bans the bare import rather than asserting it.

**What moved onto the queue.** Every outbound email, the notification delivery,
the evidence binder's timeline record, statement issuance and the applying
reconciliation sweep. The notification ROW stays synchronous, because the bell
has to be right the moment the request returns.

**Three things deliberately did not move**, each asserted so it cannot drift:

- **The outage alert.** The queue lives in the database being watched. Routed
  through it, the alert could not leave during precisely the outage it exists to
  report, and the symptom would be silence.
- **The binder download.** A queued CSV is a CSV nobody receives. What is queued
  is the record that it was assembled.
- **The read only reconciliation sweep.** It IS the report the operator opened
  the screen to read.

**Retries** back off exponentially with full jitter, floored so a first retry is
not effectively immediate and capped at an hour so the whole sequence stays
inside an afternoon. A fatal failure skips the retries entirely, because five
identical failures spread over an hour only delay the moment somebody sees a
queue that needs a person. Exhausted and fatal jobs become `dead`. Nothing is
deleted.

**/portal/queue** shows depth, the oldest wait, dead letter contents with the
error in full, and retry by hand. `queueHealth` returns null on a failed read and
the screen renders that as a failure, because a dashboard reporting an empty
queue because it could not look is the exact defect the section removes.

### Phase 8 Section 3, observability

**The scrubber is verified by what actually leaves the process.** The weak
version of that check reads `beforeSend` and asserts it calls the scrubber,
which proves a wire is connected and nothing about what travels along it. So
`observability-audit` stands up a real Sentry client with a transport that
captures the envelope instead of posting it, throws a real error carrying a
service role JWT, a live Stripe key, a webhook secret, a Resend key, a bearer
token, a signed evidence URL, a driver licence number and an email address, in
the message, in headers, in extras nested three deep, in a breadcrumb and in the
user object, and asserts on the serialised bytes the transport was handed.

Cookies and the raw request body are dropped outright rather than scrubbed,
because a field that cannot be made safe and is not needed should not be sent at
all. The user is reduced to an id.

**Faults are recorded in this firm's own database as well as in Sentry.** Sentry
is configured by a DSN in the environment; unset, wrong, or lapsed, it reports
nothing and says nothing, and an error dashboard with nothing on it looks exactly
like a platform with no errors. Alerting reads the local store, so it cannot be
silenced by a third party or by a variable nobody set. `onRequestError` in
`src/instrumentation.ts` catches every server side fault Next handles, not only
the ones somebody remembered to wrap.

**Alerting is about not sending.** The failure that actually happens is four
hundred emails, a filter rule, and a real outage landing in that folder. So:
a new fault type alerts once, a fault crossing ten occurrences in fifteen minutes
alerts, both on an hour cooldown, at most three per sweep with the count of what
was held back, and a fault older than an hour never announces itself as news
because a backfill is a report rather than an alert. Muting silences the email
and never the counting, so a muted fault still appears on the status page.

**Daily metrics are recomputed, never accumulated**, and an absent figure is
absent rather than zero. If a source query fails, that metric is left out of the
table and the job retries; a gap therefore means "not computed" and a zero means
"genuinely none". Exercised twice in a row on real data: identical.

**/portal/status** shows every dependency, every cron and the queue, each with
the timestamp it was read at. A cron's verdict is computed against its own
interval, because a timestamp is not a verdict: "last run 09:12" looks the same
whether the job ran a minute ago or stopped a month ago. Never run, stalled and
late are three separate verdicts. `configured` and `checked` are separate claims
and the page never conflates them: only the database is actually probed, and
nothing else claims it was.

**What the walk found that the code review did not.** Twelve occurrences of one
fault rendered as twelve separate faults, each with a count of one. The
fingerprint stripped only word bounded digit runs, and `cs_test_4` has no word
boundary between the underscore and the digit. Because the rate threshold counts
per fingerprint, twelve faults of one occurrence each could never have alerted:
the function was failing at exactly the thing it was written to prevent, and every
fingerprint check in the audit had used a number with spaces either side. The fix
groups uuids, long opaque references, identifier shaped tokens and digit runs. The
cost is over grouping, which is the right way to be wrong here, and nothing is
lost, because `eng_error_events` keeps every message exactly as recorded.

### The portal design system

The operator designed the portal externally and approved it. The export is at
`design-reference/portal/`, and `docs/PORTAL_DESIGN_STANDARDS.md` is the copy
that governs every portal and customer surface.

**The document and the code cannot drift.** `token-audit` parses the standards
file's own css block and asserts each token in `src/styles/portal.css` matches
it value for value. Editing one and not the other is a failing build. The tokens
are spelled exactly as the document spells them, so somebody holding the two
side by side moves between them without translating.

**77 files are held to it**: every file under `src/app/portal`,
`src/components/portal`, `src/app/account`, `src/app/(site)/order` and
`src/components/order`. No colour literal, no font size off the scale, no radius
off the scale, no gradient, no shadow outside the two overlay tokens, and no CSS
`text-transform` faking sentence case. The public marketing site is deliberately
outside this: it has its own approved v5 design and its own voice audit, and
marketing copy may legitimately be warmer than an interface.

**The absent data chip is wired to `ops-money`**, not reimplemented. It is the
visual form of a rule the platform already enforces in three places, so
`MoneyFigure` calls the same `isKnown` and `money` that billing, the CSV exports
and `money-audit` use. There is exactly one definition of absent.

#### What the design claimed that was not true

The design was drawn against a description of the platform rather than against
the platform, which is the right way to design and the wrong thing to build from
unexamined. Its standards file stated six product truths. Four held.

| Claim | As built |
| --- | --- |
| Technicians paid flat rate on submission, independent of the decision | True, with one word wrong. The entitlement is WRITTEN on submission and an operator approves and pays it later. |
| Engineer decisions equal weight and pay the same | Equal weight is true and enforced by `refundFor`. "Pay the same" is unimplemented: there is no engineer pay ledger. |
| Declines refund everything except the disclosed $175 fee | **Describes one of four cases as the rule.** Two of the four are full refunds. |
| Protocols versioned, a file governed by the version captured under | True. |
| Charge log append only and embeds an evidence hash per decision | Append only is true and trigger enforced. **The hash does not exist.** |
| Roles are owner, engineer, technician, dispatcher | **Three roles**: admin, engineer, field_tech. |

Two of those would have put an untrue sentence on a screen, and a third was
found while porting: the sign in screen claimed multi factor authentication is
required for all staff accounts, and there is no MFA in this platform.

All three were dropped rather than rendered. The evidence hash is the one worth
remembering: it was a fabricated cryptographic assurance on the one screen whose
purpose is to be the regulatory record an engineer's licence stands on.

#### What was not built, and the condition for each

**The sealed letter.** Nothing produces one, and `isPrelaunch()` stops a file
reaching sealed at all. A screen rendering one would carry a seal for an
engineer who has reviewed nothing. The document sheet was built over the
evidence binder instead, which had only ever existed as a CSV, and its
limitations note says plainly that it is not sealed and that no sealed
deliverable exists for the file. BACKLOG carries the three things that must be
true first, and the third is a credential question rather than a design one.

**The 403.** Every gated route answers `notFound()`, and `security-audit` asserts
a refusal is indistinguishable from a route that does not exist. A 403 confirms
the page exists to somebody who should not know that.

**The command palette's search index, saved views, bulk table actions, the SLA
engine, the reports module, per user notification channels, and the dispatcher
role.** All recorded in BACKLOG with what the prototype already models. Two
screens port without an affordance and say so: the dashboard's action list is
unranked because there is no SLA engine, and the files toolbar has no saved
views.

#### Two rulings made while porting

The restricted mode statement has one wording. Three screens described the
compliance gate in three different sentences, all accurate, only one audited.
`RestrictedMode` says it once and reads `isPrelaunch()` itself, so a screen
cannot forget it; a screen with something additional passes `also` and may never
restate the shared part.

The screen title stays in `PageHead` and is not repeated in the header. The
chrome rule was drawn before `PageHead` existed, and the same word twice forty
pixels apart is noise on screens already dense with real information.

### The guards

| Guard | Stops |
| --- | --- |
| `isPrelaunch()` and `LAUNCH_MODE` | Any present tense service claim or order while registration is pending |
| `db-target.mjs` | Any script reaching production without `ALLOW_PRODUCTION_DB=1` |
| `neverProduction` | `roles-audit` and `seed-field-demo` reaching production at all, with no override |
| `previewPointingAtProduction()` | A Vercel preview inheriting the production database |
| `productionPointingElsewhere()` | A production deployment reaching development |
| `liveKeyOffProduction()` | An `sk_live` Stripe key on anything that is not production |
| The health cron | Silence when the portal or its database goes down |
| `eng_cron_runs` | A cron that stopped firing looking the same as a cron with nothing to do |
| `scrubEvent` and `beforeBreadcrumb` | A credential, a signed URL or an identity document leaving in an error report |
| `token-audit` | The design document and the code disagreeing, and any colour, size or radius escaping the tokens |
| `portal-voice-audit` | An exclamation, an emoji, reassurance or Title Case reaching an operational screen, and the gate 0 corrections being quietly reverted |
| `readCustomerSession` and the proxy's account branch | A customer session opening a portal route, or a staff session opening a customer one. Neither branch reads the other's cookie, and the account branch is decided first |

### The harness

29 audits, all passing. Every one has been verified by injecting the violation it
exists to catch and watching it fail, and several of those injections found the
check rather than the code.

`order-audit` is 499 checks, `security-audit` 207, `observability-audit` 139,
`jobs-audit` 136, `token-audit` 67, `accounts-audit` 69, `roles-audit` 36,
`portal-voice-audit` 25, `migration-audit` 17.

Four are new in Phase 8 and two in the design port.

`accounts-audit` asks whether a customer and a member of staff can be confused
for each other, which is the failure that would look like a working site right up
until a buyer opened the review queue.

`migration-audit` replays every migration into an in process Postgres and
fingerprints the result. It exists because `0001` spent a month unable to apply
to an empty database while both live projects held the objects it failed to
create, which comparing the two projects to each other could never have caught.

`jobs-audit` enforces the mandatory idempotency declaration, the lease surviving
a killed worker, and every route that was supposed to move onto the queue having
actually moved. Nineteen injected violations, nineteen caught.

`observability-audit` asserts on the bytes a real Sentry transport was handed,
and that a stalled cron reads as stalled rather than as a timestamp. Twenty nine
injected violations, twenty nine caught.

**Of the forty eight injections across those two, eight walked past on the first
run and every one was a defect in the check rather than in the code.** A SQL
comment explaining `FOR UPDATE SKIP LOCKED` satisfied a check for `FOR UPDATE
SKIP LOCKED`. A backoff cap was compared against the constant it was meant to
bound. `indexOf(a) < indexOf(b)` returned true when `a` was absent and returned
`-1`. A function body scoper ran past its function into the next one and answered
with the wrong function's guard. That is the recurring defect class in this
repository, and it is worth writing down that it appears most often inside the
audits written to hunt it.

---

## 2. What is deliberately not built

This section exists so nobody mistakes an absence for an oversight.

### Not built, and correctly so

**Invoicing.** Billing reads margin from figures already on a file. It sends
nothing, takes nothing, and talks to no accounting system. Building half of it
during Phase 6 would have left two billing models to reconcile.

**A customer account system.** A customer orders one document, once. An account
is a password they forget, a reset flow, a support burden, and one more
credential this firm becomes responsible for. The signed link is the whole
authentication story.

**Review or rating schema.** No `AggregateRating` anywhere, and none until real
third party reviews exist. Fabricating one is the single fastest way to lose the
authority the whole build exists to create.

**City geo pages and service-times-place combinations.** That is the doorway
trap. Geo on this brand is the eight coverage regions and the county hub.
`/corpus-christi` is the one exception and is about the firm's own address, not
about a place it covers.

**A Google Business Profile.** Blocked on the registration and on a verifiable
address. See `docs/gbp-brief.md`, which is a brief rather than a submission for
exactly this reason.

### Not built in Phase 8, and the condition that would make each real

Section 4 of the phase, recorded here rather than in a commit message so it
outlives the branch.

**Evidence thumbnails.** `eng_evidence_items.thumb_key` has existed since `0001`
and nothing has ever written it. The job kind is registered and fails on purpose
with a sentence saying what is missing, which is the difference between a defect
and a decision: leaving it unregistered would dead letter any future enqueue with
"no handler is registered", which reads like a bug in the queue.

*The condition:* the first operator who opens a file with forty captures on a
phone and waits for forty full size photographs. It needs an image pipeline this
deployment does not have, and choosing one is not a decision to take inside a
queue section.

**Retention.** `eng_jobs`, `eng_error_events` and `eng_cron_runs` all grow
forever. At today's volumes that is correct: "did that email actually go" is
worth answering three months later, and a queue that deletes its own history
cannot answer it. It stops being correct somewhere in the first year of real
trading, and `queueHealth` reads every pending, running and dead row on every
page load.

*The condition:* the queue screen taking a noticeable moment, or `eng_jobs`
passing about fifty thousand rows. The rule has to distinguish the states rather
than sweeping by age: a `done` job older than ninety days is a log line, a
`pending` one is a defect, and a `dead` one must never be pruned by a timer,
because pruning it is the exact silence Section 2 exists to remove.

**Sentry alert rules.** The DSN is not set and no Sentry project is wired.
Release tagging, environment tagging and the scrubbing are all in place and
exercised, and nothing reaches Sentry until somebody sets `SENTRY_DSN` in Vercel.
Alerting does not wait on that, because it reads this firm's own fault store.

*The condition:* wanting the grouping, the stack frames and the release
comparison that Sentry does better than a table in Postgres. The status page
says plainly when the DSN is absent, so this cannot be quietly forgotten.

**Metric charts.** The status page shows yesterday as figures. Fourteen days are
stored and nothing plots them.

*The condition:* enough days to have a shape worth looking at. A chart over four
data points is decoration.

**Uptime as a number.** There is no percentage anywhere. The watcher detects an
outage and emails; nothing computes availability over a period.

*The condition:* a customer or an insurer asking for one. Computing it from the
watcher's runs would produce a figure whose denominator is "times we happened to
check", and a number like that on a page invites a promise the firm has not made.

**Alerting on queue depth.** A queue that is behind is visible on two screens and
emails nobody. A dead letter is visible and emails nobody.

*The condition:* the first time somebody finds out about a stuck queue from a
customer. The rules are already written for faults and would extend; the reason
to wait is that a depth threshold picked before there is any traffic is a
threshold picked from nothing.

### Not built, and it should be

Ranked by what it costs if it stays missing. `BACKLOG.md` carries the full
reasoning and the incident behind each.

1. **The order flow exists only in this repository.** `sealedengineering` and
   `stampmyplans` need their own sessions. `data/catalog.ts` must be copied
   verbatim; every rendered sentence must be written fresh for that brand's
   buyer. This is the largest open item.

   It is also a blocker on the database migration rather than a separate
   question. Both sisters hold a service role key for the shared project and
   write `eng_leads` and `eng_orders` directly, and 254's portal reads those
   tables with no site filter because it is deliberately the shared inbox for
   all three brands. Move 254 alone and the sisters keep writing to the old
   project while the only screen anybody opens reads the new one. See
   `docs/production-cutover-plan.md` step 8b.
2. **Quote pipeline surfaces.** A quote request can be taken and stored. Nothing
   in the portal scopes it, sends it, or converts it to an order. Until that
   exists, every quote only service is a form that produces a row somebody has
   to find.

   The bulk screen offers only fixed price deliverables for the same reason:
   forty quoted properties is forty conversations rather than one submission.
3. **The auto dispatch alert threshold**, and the `eng_orders` legacy table
   question: whether the sister sites still write to it.
4. **Nothing tells the operator a refund failed at the provider.** It is
   recorded and visible, but only to somebody already looking.

---

## 3. Launch day, in order

The compliance gate is one function and one environment variable, and flipping
it requires a rebuild because the pages are statically prerendered. That is
deliberate: a compliance state that could change without a deploy leaving an
audit trail is not one this firm should want.

**Do not begin until the registration certificate is in hand and a Professional
Engineer is in responsible charge.** Everything below assumes both.

### Before you touch anything

1. **Put the real credentials in `src/config/credentials.ts`.** The firm
   registration number, the PE's name, licence number, and the date. Nothing
   else in the codebase may state a credential;
   `scripts/placeholder-audit.mjs` fails the build on any credential string not
   present in that file, which is what has kept the site honest so far.
2. **Run the suite.** `npm run audit`. It must be 25 of 25 before anything
   changes. A red suite on launch day means launch day moves.
3. **Check the fee schedule matches the catalog.** `eng_fee_schedule` prices by
   `(kind, service_slug, tier, county_band, urgency)`. Every tier the catalog
   sells needs a row, or an order will be taken at a price the platform cannot
   pay production against.

### The flip

4. **Set `LAUNCH_MODE=live` on the Production scope in Vercel, and only
   Production.** Preview stays as it is.
5. **Confirm `CUSTOMER_SESSION_SECRET` is set** on Production and Preview, and
   that it is a DIFFERENT value from `OPS_SESSION_SECRET`. Set on 2026-09-04.
   Unset means no customer can sign in, which fails closed and is correct, but it
   fails silently from the customer's side: the sign in screen says accounts are
   not available rather than erroring.

6. **Set the live Stripe keys on Production scope**: `STRIPE_SECRET_KEY` as
   `sk_live_...` and `STRIPE_WEBHOOK_SECRET` from a **live mode** endpoint
   pointed at `https://254engineering.com/api/stripe/webhook`, subscribed to
   exactly `checkout.session.completed`, `checkout.session.expired` and
   `charge.refunded`.

   The live key will be refused by `liveKeyOffProduction()` anywhere that is not
   a production deployment. That is intended. Do not add
   `ALLOW_LIVE_KEY_OFF_PRODUCTION`.
7. **Redeploy production.** A deployment's environment is snapshotted when the
   deployment is created, so a variable added afterwards is invisible to a build
   that already exists. This has cost this project three separate debugging
   sessions. Redeploy, and confirm from the deployment record that the new build
   is the one the domain serves before testing anything.

### Verify, in this order, before telling anybody

8. **`launch-audit`** proves the gate flipped both ways. Then read the site:
   service pages must now speak in the present tense and offer the order.
9. **The webhook, before any customer can reach it.** Send a test event from the
   Stripe dashboard and confirm a 200 and a log line naming what it did. A
   webhook that verifies and does nothing is indistinguishable from one that was
   never sent; that is exactly how three orders were lost on 2026-09-03.
10. **Place one real order yourself**, with a real card, on a real property, and
   let it run the whole way to a sealed document or a decline. Then refund it
   from `/portal/orders` using the firm cancellation. Anything that only works
   in test mode is not known to work.
11. **`BASE_URL=https://254engineering.com npx tsx scripts/security-audit.mjs`.**
    It writes nothing and it is the perimeter check that matters most on the day
    the doors open.
12. **Confirm the health cron is firing.** It is the only thing that will tell
    you the portal is down at two in the morning.

    And separately, sign in as a customer on a real account. The customer
    surface fails CLOSED when `CUSTOMER_SESSION_SECRET` is missing, which is
    correct, but from outside it looks like a working page that says accounts
    are not available. Nothing alerts on that.

### The order pages become indexable, and this is a separate step on purpose

Operator ruling, 2026-09-04, recorded here rather than done then, because doing
it now would submit a refusal to the index.

**What is true today.** `/order/start/[slug]` serves
`<meta name="robots" content="noindex, follow">` and is absent from the
sitemap. That is correct while the gate is on: the page renders a refusal saying
the firm's registration is pending, and a refusal is the worst possible thing to
have ranking for the highest intent query on the site. Somebody searching "order
a windstorm certificate" would find a page saying the firm cannot sell them one,
and would leave with that as their impression of the firm.

**What changes at launch.** These are the highest intent pages the site has and
they should be indexable the moment they say yes instead of no.

14. **Drop the noindex from the order flow.** Remove
    `robots: { index: false, follow: true }` from
    `src/app/(site)/order/start/[slug]/page.tsx`. Leave
    `/order/[reference]` noindexed forever: it is one customer's order and has
    no business in a search result.
15. **Add the order routes to `src/app/sitemap.ts`**, one per orderable
    catalog deliverable, at a priority at least matching the service page they
    sell. Generate them from the catalog rather than listing them by hand, so a
    deliverable added later is not silently missing.
16. **Do NOT add them while any of them is unorderable.**
    `orderBlockedReason` refuses a deliverable with no published price and one
    with no inspection fee, and those refusals survive launch. A sitemap entry
    for a page that still says no is the same mistake as today's, in a smaller
    place. Submit the ones that can actually be bought.
17. **Resubmit the sitemap in Search Console** and confirm the new URLs are
    discovered before announcing anything.

**The same decision is owed on the sister brands, and one of them is already
wrong.** `sealedengineering.com/order` serves no robots directive at all and
is crawlable, and it renders that brand's waitlist page with a title byte
identical to `sealedengineering.com/waitlist`, which IS in its sitemap. That is
two URLs serving one page on a site whose entire strategy depends on not looking
like a doorway. It wants fixing before launch rather than at it. See section 2's
note on the sitemap audit of 2026-09-04.

### After

13. **Create the Google Business Profile**, following `docs/gbp-brief.md`. Not
    before: the profile is a public, permanent, indexed statement that the firm
    offers engineering services, and it is one of the few mistakes on this build
    that is genuinely hard to undo.
14. **Then the sister brands.** They are separate businesses with separate
    buyers, and each needs its own order flow and its own copy.

    This is also what unblocks the database migration. See open item 1 in
    section 2 and `docs/production-cutover-plan.md` step 8b.

---

## 4. The one thing to carry forward

The recurring defect in this project has never been a broken feature. It is a
**success indistinguishable from nothing happening**: an audit passing while
pointed at the wrong thing, a webhook verifying and recording nothing, a refund
reported to a customer that never reached the ledger, an intake creating no
files while answering 200.

Not one of those was caught by a test that was written to catch it. Every one
was caught by somebody going to look for a row that should have existed and
finding it absent.

**Absence of an expected row is a finding.** That is the habit worth keeping.
