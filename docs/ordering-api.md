# The ordering API

For accounts that place enough work that a browser is the wrong tool: a solar
installer with eight structural letters a month, a lender sending every
manufactured home file, a title company with steady transaction flow.

**This document lives in the repository and not on the public site, deliberately.**
It is not a product anybody can sign up to. It is a handful of named accounts
with a key, and publishing it would invite exactly the traffic the rate limiter
exists to survive. Send it to an account holder directly.

---

## What it is

One endpoint. A submission of one or many properties, which is the same act
either way: a single order is a batch of one.

```
POST https://254engineering.com/api/v1/orders
Authorization: Bearer eng_live_...
Content-Type: application/json
```

It calls the same code the website calls. The qualification, the price, the
coastal surcharge, the refund disclosure and the compliance gate are the same,
because there is one implementation and this is a second door onto it rather
than a second room.

## Getting a key

An account **owner** creates one in the portal under account settings. The key is
shown **once**, at creation, and the platform cannot show it again: only a
SHA-256 of it is stored, so a database disclosure is not a set of working keys.

A key belongs to one organisation. **The account is read from the key**, never
from the request, so there is no field in which to ask to order for somebody
else. That is the whole security model.

Revoke a key in the same place. A revoked key stops working immediately, and so
does every key on an account that is suspended.

## Rate limit

Sixty requests a minute per key unless the key names its own. A refused request
counts too, so a caller sending bad bodies is throttled the same as one sending
good ones.

Over the limit answers `429` with `Retry-After: 60`.

## The request

| Field | | |
| --- | --- | --- |
| `serviceSlug` | required | The service line, e.g. `roof-inspections` |
| `tier` | sometimes | Required when the line sells more than one deliverable |
| `clientRequestId` | required | Your own idempotency key. See below. |
| `properties` | required | One to two hundred entries |
| `dryRun` | optional | `true` checks without creating anything |

Each property:

| Field | | |
| --- | --- | --- |
| `ref` | recommended | Your own identifier, echoed back so you can match results |
| `propertyAddress` | required | |
| `county` | required | Decides both the protocol and the price |
| `city`, `postalCode` | optional | |
| `answers` | required | `[{ qualifierId, optionIndex }]` for every qualifier on the deliverable |

### clientRequestId is not optional and not decorative

Send the same value again and you get the same submission back rather than a
second one. Send a new value and you get a new submission. A timeout with no
response is the case this exists for: retry with the same id.

The per property keys are derived from it, so a retry finds each order rather
than creating duplicates beneath a new batch.

## Partial failure

The firm takes what it can and tells you what it will not, with the reason, and
you pay for what was taken.

If three of ten properties fail qualification, the response carries seven in
`accepted` and three in `rejected`, each with the catalog's own explanation, and
the total is for the seven. Nothing is charged for the three.

If **nothing** is acceptable, nothing is created and nothing is charged.

Use `dryRun: true` to see the split before committing.

## The response

`201` on success:

```json
{
  "ok": true,
  "reference": "254-B2026-K4M2PQ",
  "billingMode": "invoice",
  "totalCents": 420000,
  "accepted": [
    { "ref": "P1", "reference": "254-O2026-3C5P4A", "shareCents": 60000 }
  ],
  "rejected": [
    { "ref": "P8", "reason": "A roof the technician cannot reach safely cannot be documented to the standard the engineer reviews against." }
  ],
  "accountOutstandingCents": 1260000
}
```

**On a card account** the response carries `checkoutUrl` instead of
`accountOutstandingCents`. Nothing is charged and no work is released until that
checkout is paid.

**On an invoiced account** the work is released immediately and the amount
appears on the next statement.

## Status codes

| | |
| --- | --- |
| `201` | Created |
| `200` | A dry run |
| `400` | A field is missing or malformed |
| `401` | No key, a malformed key, a wrong key, a revoked key, or a suspended account. **These are deliberately not distinguished.** |
| `405` | Anything but POST |
| `409` | The firm cannot take this: the compliance gate, an account over its credit limit, or nothing acceptable in the submission |
| `429` | Rate limited |
| `503` | The submission is saved and the payment provider could not be reached. **Do not resubmit**; the reference is in the response. |

## Credit

An invoiced account over its limit, or with a statement outstanding beyond its
terms, is refused with `409` and a message naming which. Settle the statement or
agree a higher limit with the firm.

An account with **no** credit limit set has **no credit**, not unlimited credit,
and is refused until the firm agrees one.

## What this API does not do

- **No read endpoints yet.** There is no way to poll an order's status. The
  status link emailed to the customer is the way to follow one, and a proper read
  API is worth building only when somebody asks for it.
- **No webhooks to you.** The firm contacts the account when a document is ready.
- **No quote requests.** Quoted work is a conversation, and forty of them is
  forty conversations rather than one submission.
- **No cancellation or refund.** Those are decisions, not calls. Telephone the
  firm.

## An example

```bash
curl -sS https://254engineering.com/api/v1/orders \
  -H "Authorization: Bearer $ENG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceSlug": "roof-inspections",
    "clientRequestId": "2026-09-batch-014",
    "dryRun": true,
    "properties": [
      {
        "ref": "P1",
        "propertyAddress": "1200 Ocean Drive",
        "city": "Corpus Christi",
        "county": "Nueces",
        "postalCode": "78404",
        "answers": [
          { "qualifierId": "in_texas", "optionIndex": 0 },
          { "qualifierId": "authority", "optionIndex": 0 },
          { "qualifierId": "roof_access", "optionIndex": 0 }
        ]
      }
    ]
  }'
```

Drop `"dryRun": true` to place it.

The qualifier ids and their options are per deliverable and are in
`data/catalog.ts`. They are stable; when one changes, the account is told before
it changes, because a submission answering a question that no longer exists is
refused rather than assumed.
