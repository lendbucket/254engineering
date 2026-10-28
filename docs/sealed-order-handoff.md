# Sealed Engineering orders: the hand-off spec

Robert's addendum of 2026-10-25, item 10, in his words:

> 10. SEALED ENGINEERING ORDERS. On the 254 side only: confirm /api/orders accepts a Sealed site key and creates a normal order with checkout, so Sealed can send orders here instead of writing eng_orders directly. Write the hand-off spec in docs/ for the Sealed repo. Do not touch the Sealed repo. Sealed ordering stays closed until it uses this.

This document is for whoever changes the Sealed Engineering repository. Nothing in that repository was read or changed to write it. Everything below was read off this repository's code on 2026-10-27, on `feat/sealed-handoff-and-w2`.

**State on 2026-10-27: the door works, and it is closed to Sealed by a switch.** A request carrying Sealed's key is answered `409` with "Orders from this site are not open yet." Nothing is placed and nothing is charged. Opening it is the last section below.

## What was confirmed, and what was added

| Question | Answer | How it is known |
| --- | --- | --- |
| Does `/api/orders` accept a Sealed site key? | Yes. The key is checked against `ORDER_INTAKE_KEYS`, a JSON map of site to key held in Vercel, and the matching site name is what the order is written under. | `siteFromKey` in `src/lib/ops-intake.ts` |
| Does it create a normal order? | Yes. It calls `placeOrder`, the function 254's own order flow uses. That function prices from the catalogue, asks the qualifying questions, resolves the county, applies the windstorm area rule, reads the engineer's signed record (ruling 11) and records the refund terms. | `src/app/api/orders/route.ts`, and the proof below |
| Does it open checkout? | Yes. It calls `startCheckout` on the order it placed and returns the URL. | same |
| Was Sealed ordering closed? | **Only by Vercel**: whether `ORDER_INTAKE_KEYS` held a Sealed key, which nothing in this repository can see. Adding the key to test the hand-off would have opened ordering with no edit and no commit. | reading the route |
| **Added** | A switch, `sisterOrdering` in `src/config/sister-ordering.ts`. Sealed and StampMyPlans are closed in it. A site the switch does not name is closed too. The route asks it after the key and before reading the body. | `scripts/proofs/a-sister-order-is-a-normal-order-behind-its-switch.mjs` |

**What the proof does not cover:** a Sealed order going all the way to a database row and a Stripe checkout. That needs an open gate, an open switch and a database, and none of the three is true in a proof. The route places a Sealed order through the same two functions as 254's own flow. It writes no table itself, and nothing in this repository touches the legacy `eng_orders` table. Each of those is asserted.

## The request

```
POST https://254engineering.com/api/orders
content-type: application/json
x-intake-key: <Sealed's key, the value under "sealed" in ORDER_INTAKE_KEYS>
```

**Call it from Sealed's server, never from a browser.** A key in a browser bundle is a key anybody has. The customer's browser talks to Sealed's own origin; Sealed's server calls this.

**The site name is `sealed`**, the same name the lead door uses (`SisterSite` in `src/lib/sister-intake.ts`). It comes from the key, never from the body. A body that claims another site changes nothing.

Body, for an order:

```json
{
  "clientRequestId": "a value unique to this order on Sealed's side",
  "serviceSlug": "roof-inspections",
  "tier": "optional: the deliverable, required where a service sells more than one",
  "customer": { "name": "...", "email": "...", "phone": "optional", "company": "optional" },
  "property": { "propertyAddress": "...", "city": "optional", "county": "optional", "postalCode": "optional" },
  "answers": [{ "qualifierId": "...", "optionIndex": 0 }],
  "inputs": { "optional": "the service's own questions, by key" },
  "attribution": { "utm_source": "...", "utm_medium": "...", "utm_campaign": "...", "utm_content": "...", "utm_term": "...", "landing_path": "...", "referrer": "..." }
}
```

For a quoted line, the same body with `"intent": "quote"`, plus `brief` and optionally `neededBy`.

- **Price:** do not send one. The firm prices every order from its own catalogue, and anything sent is ignored.
- **Qualifying answers:** these are re-asked, so a stale copy of the questions on Sealed's side is refused rather than trusted.
- **County:** must resolve from the city or county given, or the order is refused, because the county decides who can be dispatched.

## Idempotency

`clientRequestId` is required. It must be the same on every retry of one order and different for every new order.

A request whose `clientRequestId` was already accepted returns the existing order with `duplicate: true` and **no new checkout**. A Sealed server that times out waiting should retry with the same value.

**Known gap: a duplicate carries no checkout link.** A customer whose first response was lost needs a link from the office: the payment links screen, or Order lookup.

## Responses

| Status | Body | Meaning |
| --- | --- | --- |
| `201` | `{ ok: true, orderId, reference, totalCents, duplicate: false, checkout: { url } }` | Placed. Redirect the customer to `checkout.url`. |
| `201` | as above with `checkout: { error }` | Placed and the checkout could not be opened. The order stands at awaiting payment, and the office can send a link. Tell the customer the firm will email a payment link; do not place it again. |
| `200` | `{ ok: true, orderId, reference, totalCents, duplicate: true, checkout: null }` | Already placed under this `clientRequestId`. |
| `201` / `200` | `{ ok: true, quoteId, reference, duplicate }` | A quote request was recorded (`intent: "quote"`). The office prices it and emails the customer. |
| `400` | `{ ok: false, error: "Send a JSON body." }` | The body is not JSON. |
| `404` | `{ ok: false }` | No key, or a wrong key. The two are deliberately the same. |
| `409` | `{ ok: false, error, closed: true }` | **Sealed ordering is not open.** Nothing was placed. |
| `409` | `{ ok: false, error, prelaunch: true }` | The firm is not yet accepting engagements, for any site. Nothing was placed. |
| `422` | `{ ok: false, error, field? }` | The firm declined this order, with a sentence to show the customer and the field it concerns. |

Show the customer `error` as given on a `409` or a `422`. Those sentences are written to be read.

## After payment

Stripe calls 254's webhook, not Sealed's. The order is marked paid there and released to the firm's work queue. The customer is emailed the order confirmation by 254 Engineering, with a signed link to the order's status page on 254engineering.com. **Sealed receives no callback.** If Sealed wants to show a status, the reference returned at placement is what the customer and the office both use.

## Files

**An order with files cannot come through this door from Sealed yet.** Files attached to an order must already be in this site's own upload folder. They are put there by the upload door 254's own order page uses, and that door is not open to a sister site. A Sealed order today is an order without attachments, and the office asks the customer for documents from the file. This is a question for Robert, below.

## What Sealed must stop doing

- **Writing `eng_orders` directly.** That is the legacy table. It is not the one 254's portal, payments, refunds or reports read, so an order written there is an order nobody here sees, and it has no checkout, no refund terms and no audit trail.
- **Holding a service role key for the firm's database**, if it does so only to write orders. With this door, Sealed needs one secret: its intake key.

## Rate

**This door has no per-site rate limit today.** The lead door allows 20 a minute per site (`SISTER_RATE_PER_MINUTE`, a ruling). This is a question for Robert, below.

## The switch that opens it, in order

1. Sealed's repository is changed to call this door and to stop writing `eng_orders`. That work is on Sealed's side.
2. Robert sets `sealed` in `ORDER_INTAKE_KEYS` in Vercel's Production environment to a new key, and gives the same value to Sealed's deployment.
3. `sisterOrdering.sealed` in `src/config/sister-ordering.ts` is set to `open: true`, with `openedBy`, `openedOn` and `because`. The proof pins the closed state as a literal, so this is a second edit, made on purpose. Then deploy.
4. The compliance gate must also be open. While it is shut, every site's order is refused with `prelaunch: true`, whatever the switch says.

The launch screen (`/portal/launch`) shows where the switch stands, under "Switches stated in configuration".

## Questions for Robert, each with a recommendation

1. **Rate limit on the orders door.** Recommendation: the same 20 a minute per site as the lead door, counted from the orders themselves, built before Sealed's switch opens.
2. **Files from Sealed.** Recommendation: a signed upload door for a keyed sister site, writing to a folder of its own, built before Sealed's switch opens. Until then, Sealed orders carry no attachments.
3. **A duplicate's checkout.** Recommendation: when a duplicate's order is still awaiting payment, return a fresh checkout for it, the way 254's own order flow handles a retry, after asking the money door again.
