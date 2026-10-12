# Partner billing: the plan, for approval

Item 17 of the run of 2026-10-10. **Nothing in this document is built.** It
stops here for Robert's approval, and item 18 (provisioning) waits on it.

## What is being billed

A reseller pays **$800 once and $99 a month** for access to the program. They
sell under their own brand; **254 Engineering LLC, TBPELS Firm F-29811,
performs and seals all engineering**, and a partner never presents as an
engineering firm.

**There is one Stripe account.** Partners pay 254 Engineering, operated by
Craftline Brands, through 254's existing account, with the same
`STRIPE_SECRET_KEY` and the same webhook (`STRIPE_WEBHOOK_SECRET`) as customer
orders. What keeps the two apart is products, prices and metadata, never a
second account.

## What already exists, read on 2026-10-10

| Piece | Where | What it means for this plan |
| --- | --- | --- |
| The webhook | `src/lib/payments-stripe.ts` | Handles `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, and finds the order by `metadata.order_id` |
| The live-key guard | `liveKeyOffProduction()` in `src/lib/db-guard.ts` | An `sk_live_` key off production already refuses an order charge; partner checkout calls the same guard |
| Partner status | `eng_partners.status`: `active`, `suspended`, `ended` (0013) | The **program** status. Billing status is a separate fact (below) |
| Compensation | `src/lib/partner-comp.ts`, four models in `eng_partner_terms` | Untouched by billing; item 21 gates the percentage model |
| The Stripe console record | `src/config/stripe-console.ts` | Records the account's public business name and descriptor; receipts read from those |
| The webhook audit | `scripts/stripe-webhook-audit.mjs` | Parses the handled events from the adapter, so new events turn it red until the endpoint subscribes to them |

## The design

### 1. Products, prices and configuration

Two Stripe Prices on one Product, "254 Engineering partner program":

- a **one time** Price of $800.00, and
- a **recurring monthly** Price of $99.00.

The amounts live in `src/config/partner-billing.ts` as cents (80000, 9900) and
are pinned as literals in the audit that covers them, per CLAUDE.md 6c, so a
price change costs two deliberate edits. The Stripe Price ids live beside them,
**one pair for test mode and one for live**, and the code picks the pair by the
key's mode. A test-mode id never meets a live key.

### 2. Checkout

One Stripe Checkout Session in `subscription` mode, carrying both Prices (Stripe
takes a one time Price as a line on the first invoice of a subscription). Card
on file comes from that checkout: the subscription's default payment method.

Every partner billing object carries `metadata.kind = "partner_billing"` and
`metadata.partner_application_id`, on the Session **and** on
`subscription_data`, so every later invoice and subscription event carries it
too. The session is created with an idempotency key derived from the
application id, so a double click cannot open two subscriptions.

### 3. The webhook: one endpoint, two routers that cannot cross

The handler branches on `metadata.kind` **before anything else**:

- `partner_billing`: the partner router. It writes only the partner billing
  tables. It never reads or writes an order, a file, a payment row or a sealed
  document.
- anything else: today's order path, unchanged.

An event carrying `partner_billing` and an `order_id` together is refused and
logged, because that is the mix this design exists to prevent.

New events the endpoint must subscribe to: `invoice.paid`,
`invoice.payment_failed`, `customer.subscription.updated`,
`customer.subscription.deleted`. **Subscribing them is a change in Stripe's
dashboard**, which only Robert can make; `stripe-webhook-audit` will name each
missing one until he does.

### 4. Four states

| State | Entered when | The partner can |
| --- | --- | --- |
| `active` | The first invoice is paid, or a later failed one is | Order, and has a live partner page |
| `past_due` | An invoice fails | Order, page live, and sees a banner to update the card |
| `suspended` | Still unpaid when the grace period ends | Nothing: no ordering, page gone |
| `cancelled` | The subscription ends, by the partner or by us | Nothing |

**Retries** are Stripe's Smart Retries, a dashboard setting recorded in
`stripe-console.ts` with its date like the other console facts. **The grace
period** is counted by this platform from `past_due_since`, by a scheduled job,
so suspension is a recorded transition with an audit row rather than something
Stripe did silently.

### 5. Tables (one migration, written after approval and staged, never merged unattended)

- `eng_partner_billing`: one row per partner. Stripe customer and subscription
  ids, `status`, `past_due_since`, `current_period_end`. Updated in place, with
  a check constraint on the four states and one tying `past_due_since` to
  `past_due`.
- `eng_partner_billing_events`: append only, one row per webhook event applied,
  keyed by Stripe's event id so a replay applies nothing twice.

### 6. What a lapse touches, and what it never touches

A lapsed partner (`suspended` or `cancelled`) loses **ordering and their page**.
Nothing else moves. Specifically, a lapse never changes a customer order, a
file, a payment, a refund, an evidence item or a sealed document. Orders already
placed through the partner proceed exactly as before.

This is enforced twice: the partner router has no import of the order modules,
and item 22's test lapses a partner holding an order in flight and reads the
order, the file and the sealed document back unchanged.

### 7. Receipts

Stripe's receipts and invoices carry the account's public business name, which
`stripe-console.ts` records. Receipts therefore read **254 Engineering**, the
public brand, with the registrant line where Stripe's invoice footer allows it.
No receipt names the partner as the seller.

### 8. Off until counsel signs off

`partnerBilling.enabled` is `false` in configuration. It may be set `true` only
when the register records counsel's sign-off (who, when, on what text), and
`compliance-audit` asserts that pairing so the flag cannot be flipped alone.
Development runs in Stripe test mode; the live-key guard refuses a live key
anywhere but production.

## Questions for Robert, each with a recommendation

1. **Grace period.** Recommendation: **14 days** from the first failed invoice,
   then `suspended`.
2. **Is the $800 refundable?** Recommendation: **not after the partner's page is
   live**; refundable in full before that. Copy for it waits on counsel.
3. **Cancellation.** Recommendation: **at the end of the paid month**, no
   proration.
4. **Does a lapsed partner still earn on orders already attributed to them?**
   Recommendation: **yes**, for orders placed while they were active; a lapse
   stops new attribution, never past credit. This touches compensation, so it is
   yours to rule.
5. **Sales tax.** Whether Texas taxes this subscription is a question for the
   firm's accountant. Nothing in this plan collects tax; Stripe Tax can be
   switched on later without a schema change. Recommendation: ask before launch.
6. **Receipt name.** Recommendation: "254 Engineering" as the public business
   name, matching the site, with the registrant line in the invoice footer.

## What approval unlocks

Item 18 (a paid checkout invites the partner, with the idempotency key above),
then the migration in section 5, written unapplied and staged with its sitting
document.
