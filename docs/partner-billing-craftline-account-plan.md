# Partner billing on Craftline's own Stripe account: the plan

Operator ruling of 2026-10-15: the partner program is contracted by Craftline
Brands LLC doing business as 254 Partners, under a business opportunity
exemption on file, and partner billing must run on Craftline's own Stripe
account, never 254 Engineering's. This reverses the 2026-10-11 one-account
ruling. **Plan only. Nothing here is built until Robert says build.** Billing
stays disabled and counsel's sign-off is still required to enable it.

## Where the code stands today (main at 828939f)

- One Stripe client, built from `STRIPE_SECRET_KEY` in `src/lib/payments-stripe.ts:75`.
  `startPartnerCheckout` (`src/lib/partner-billing.ts:103`) calls
  `createPartnerCheckout` in that same file, so a partner checkout today would
  be created **on 254 Engineering's account**. It is unreachable while
  `PARTNER_BILLING.enabled` is false, and the proof asserts it refuses before
  Stripe is asked.
- One webhook, `/api/stripe/webhook`, verified with `STRIPE_WEBHOOK_SECRET`.
  `partnerBillingEventOf` (`src/lib/partner-billing-rules.ts:106`) sends any
  event carrying `metadata.kind = partner_billing` to the partner lane
  (`applyPartnerBillingEvent`), on 254's endpoint.
- `confirmStripeAccount` (payments-stripe.ts:417) checks, on the first webhook
  per process, that the key and the webhook belong to one account, and stops
  new charges on a mismatch. It knows of one account.
- 0074's two tables (`eng_partner_billing`, `eng_partner_billing_events`) hold
  no account identity: they would not say which Stripe account an event came
  from.

## 1. Keys

| Name | Where | What |
| --- | --- | --- |
| `PARTNER_STRIPE_SECRET_KEY` | Vercel, Production only | Craftline's secret key, a restricted key (`rk_live_`) with write access to Checkout Sessions, Customers, Subscriptions and Invoices, and read access to the account and webhook endpoints. Never 254's key |
| `PARTNER_STRIPE_WEBHOOK_SECRET` | Vercel, Production only | The signing secret of Craftline's endpoint below |

- Both declared in `src/config/credential-inventory.ts` (environments,
  Preview distinct or absent) and in the soc2 credential list, so
  `soc2-audit` refuses them undeclared.
- **Craftline's account id recorded** in a console declaration beside
  `src/config/stripe-console.ts` (a `partnerAccount` block: account id, legal
  name "Craftline Brands LLC", public name "254 Partners", statement
  descriptor, read by a person and dated). Asserted different from 254's
  account id, so the two can never be configured as one.
- Nobody pastes either key into a chat. Robert sets them in Vercel himself.

## 2. Webhook endpoint

- A **separate route**, `/api/partner-billing/webhook`, registered only in
  Craftline's dashboard, verified only with `PARTNER_STRIPE_WEBHOOK_SECRET`.
  Subscribed to exactly the five events the partner lane handles:
  `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
  `customer.subscription.updated`, `customer.subscription.deleted`.
- 254's endpoint goes back to its four order events (Robert removed the four
  partner events from it on 2026-10-15).
- A separate route rather than a second secret tried on one route, because a
  route that accepts either signature cannot say which account sent an event,
  and that is the one fact this ruling turns on.

## 3. Router

- **254's webhook refuses the partner lane.** An event carrying
  `metadata.kind = partner_billing` arriving at `/api/stripe/webhook` is
  answered 200 and refused, logged as "partner billing on 254's account", and
  never applied. Today it is applied.
- **The partner route accepts only the partner lane.** An event without the
  partner kind, or carrying an order, batch or statement id, is refused there,
  exactly as `partnerBillingEventOf` refuses a mix today.
- **Two clients, chosen by lane, never by fallback.** A `partnerStripe()` built
  only from `PARTNER_STRIPE_SECRET_KEY`, used by `createPartnerCheckout` and
  the administrator's end-of-period action. If the partner key is unset it
  throws; it never falls back to `STRIPE_SECRET_KEY`.
- **The account check per lane.** `confirmStripeAccount`'s mismatch check runs
  for each lane against its own declared account, and stops new partner
  checkouts on a mismatch without touching customer orders.
- **The account recorded on each event.** If the operator wants the ledger to
  say which account an event came from, `eng_partner_billing_events` gains an
  `account_ref` column. That is a migration, so it stops after the development
  apply for a sitting. Recommended, because the lane alone is an inference.

## 4. What rides on the wiring (the rulings of 2026-10-15 that act on Stripe)

- **The administrator's end-of-period action** (ruling 3): sets
  `cancel_at_period_end` on Craftline's subscription, with the written notice
  recorded and the act audited. It calls Craftline's account, so it is built
  with this wiring rather than before it.
- **Late fee** (ruling 1): an invoice item of 2475 cents on the next invoice,
  once per missed payment, keyed on the failed invoice so a redelivery cannot
  charge it twice.
- **Suspension at 10 days** (`graceExpired` already computes it): a scheduled
  sweep moves `past_due` to `suspended`. `suspended` is already allowed by
  0074, so no migration is needed for the status.
- **Reinstatement**: a payment of the past due balance, the late fee and the
  7500 cent fee, then `suspended` to `active`.
- **Receipt name and seller**: the product "254 Partners" on Craftline's
  account. Craftline's own statement descriptor, recorded in its console
  declaration.

## 5. Proofs

Each is injection-verified by putting the defect back.

1. **No fallback.** With `PARTNER_STRIPE_SECRET_KEY` unset and
   `STRIPE_SECRET_KEY` set, a partner checkout throws and no client is built
   from 254's key. Injection: a fallback to `STRIPE_SECRET_KEY` turns it red.
2. **254's webhook refuses the partner lane.** A signed partner-kind event
   delivered to `/api/stripe/webhook` writes no partner row. Injection: today's
   routing turns it red.
3. **The partner webhook refuses everything else.** An order event signed with
   the partner secret writes no order row, and a 254-signed event is refused at
   the signature.
4. **Two accounts, declared different.** The partner account id equals what
   Craftline's key reaches (live half, keyed, run by Robert) and differs from
   254's.
5. **The lane imports nothing from the order path**, kept from today's proof.
6. **stripe-webhook-audit gains a partner half**: Craftline's endpoint exists,
   is enabled, and is subscribed to exactly the five events, with the event
   list parsed from the partner router rather than typed. Its live half needs
   the partner key and is run by Robert.

## Questions before building

1. Add `account_ref` to `eng_partner_billing_events` (a migration, development
   apply then a sitting)? Recommended yes.
2. Build the administrator's end-of-period action with this wiring, rather than
   now against no account? Recommended yes. Ruling 3 asked for it audited, and
   it cannot end anything without Craftline's account.
3. Does Craftline's account exist yet, and who reads its console for the
   declaration?
