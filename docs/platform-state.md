# The platform, as it actually stands

Written 2026-09-03, at `a2d1637`, after Phase 7 and the order attention work
merged and deployed.

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
schema fingerprint `eac11d782d44bd11cb893637f67d2ee1` across 607 `eng_` columns,
identical to development.

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

### The harness

23 audits, all passing at `787bd5d`, the commit under the final merge. Every one
has been verified by injecting the violation it exists to catch and watching it
fail. `order-audit` alone is 411 checks.

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

### Not built, and it should be

Ranked by what it costs if it stays missing. `BACKLOG.md` carries the full
reasoning and the incident behind each.

1. **The order flow exists only in this repository.** `sealedengineering` and
   `stampmyplans` need their own sessions. `data/catalog.ts` must be copied
   verbatim; every rendered sentence must be written fresh for that brand's
   buyer. This is the largest open item.
2. **Quote pipeline surfaces.** A quote request can be taken and stored. Nothing
   in the portal scopes it, sends it, or converts it to an order. Until that
   exists, every quote only service is a form that produces a row somebody has
   to find.
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
2. **Run the suite.** `npm run audit`. It must be 23 of 23 before anything
   changes. A red suite on launch day means launch day moves.
3. **Check the fee schedule matches the catalog.** `eng_fee_schedule` prices by
   `(kind, service_slug, tier, county_band, urgency)`. Every tier the catalog
   sells needs a row, or an order will be taken at a price the platform cannot
   pay production against.

### The flip

4. **Set `LAUNCH_MODE=live` on the Production scope in Vercel, and only
   Production.** Preview stays as it is.
5. **Set the live Stripe keys on Production scope**: `STRIPE_SECRET_KEY` as
   `sk_live_...` and `STRIPE_WEBHOOK_SECRET` from a **live mode** endpoint
   pointed at `https://254engineering.com/api/stripe/webhook`, subscribed to
   exactly `checkout.session.completed`, `checkout.session.expired` and
   `charge.refunded`.

   The live key will be refused by `liveKeyOffProduction()` anywhere that is not
   a production deployment. That is intended. Do not add
   `ALLOW_LIVE_KEY_OFF_PRODUCTION`.
6. **Redeploy production.** A deployment's environment is snapshotted when the
   deployment is created, so a variable added afterwards is invisible to a build
   that already exists. This has cost this project three separate debugging
   sessions. Redeploy, and confirm from the deployment record that the new build
   is the one the domain serves before testing anything.

### Verify, in this order, before telling anybody

7. **`launch-audit`** proves the gate flipped both ways. Then read the site:
   service pages must now speak in the present tense and offer the order.
8. **The webhook, before any customer can reach it.** Send a test event from the
   Stripe dashboard and confirm a 200 and a log line naming what it did. A
   webhook that verifies and does nothing is indistinguishable from one that was
   never sent; that is exactly how three orders were lost on 2026-09-03.
9. **Place one real order yourself**, with a real card, on a real property, and
   let it run the whole way to a sealed document or a decline. Then refund it
   from `/portal/orders` using the firm cancellation. Anything that only works
   in test mode is not known to work.
10. **`BASE_URL=https://254engineering.com npx tsx scripts/security-audit.mjs`.**
    It writes nothing and it is the perimeter check that matters most on the day
    the doors open.
11. **Confirm the health cron is firing.** It is the only thing that will tell
    you the portal is down at two in the morning.

### After

12. **Create the Google Business Profile**, following `docs/gbp-brief.md`. Not
    before: the profile is a public, permanent, indexed statement that the firm
    offers engineering services, and it is one of the few mistakes on this build
    that is genuinely hard to undo.
13. **Then the sister brands.** They are separate businesses with separate
    buyers, and each needs its own order flow and its own copy.

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
