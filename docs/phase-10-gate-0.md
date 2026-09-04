# Phase 10, gate 0: the firm cannot take a telephone call

Recorded 2026-09-04. Measured by walking the portal as an administrator against
seeded development data, clicking only what exists. Screenshots at 390 and 1280
were taken and looked at; the findings below are from the running app and from
the source, not from intent.

The operator's scenario is the test: somebody telephones the firm and wants a
roof certification on a property.

## The answer

**No.** An administrator cannot take a job from a telephone call through to a
priced, paid, dispatched technician from the portal. They can get as far as a
correctly shaped **unpriced** file, and can dispatch it only if the service line
happens to be one with a published protocol, which today is windstorm alone.

The roof certification in the operator's own scenario is precisely the case that
cannot be dispatched.

## What works, screen by screen

1. **Clients, "Add a client".** Kind (organization or individual), name, type,
   email, phone, city, notes. Real, and it works.
2. **Files, "Open a file".** Client, service line, property address, city,
   county, urgency, notes. The county is derived from the city where the
   platform knows it, and TWIA status is set from the county.
3. **Move this file on.** `intake` to `needs_dispatch`, with a timeline note.
4. **Dispatch, which lives on the file rather than on a screen of its own.**
   The eligible technician list, a stated reason for every technician who is not
   eligible, an offer expiry, and "Choose who to offer this to". The file reaches
   `dispatched` only when somebody accepts, and the screen says so rather than
   marking it dispatched with nobody on it.

## Where it stops, and why

Two independent blocks, either of which alone would be enough.

**There is no price.** The "Open a file" form has no price field. The API behind
it accepts `clientPriceCents`, `dueAt` and `twiaOverride`, and `createFile` in
`src/lib/ops-crm.ts` writes all three; the form sends none of them. An operator
created file therefore reads **Client price: not set** and **Margin: not set**,
and nothing anywhere derives a price from the catalog for it. The customer path
does: `ops-intake` passes the catalog total into the same function. So the
platform has a price for a job the customer placed and no price for the same job
taken by telephone.

**There is no protocol for roof work.** Development holds exactly one published
protocol, `windstorm-wpi-8`. On a roof certification file the dispatch panel
says, in the app's own words, that no published protocol exists for the service
line so the file cannot be dispatched, and that a technician accepting it would
open an empty checklist. That is the correct refusal. It is also the operator's
exact scenario.

**And no operator can take payment at all.** `startCheckout` is reachable from
`/api/order-flow` and `/api/orders` only, both of which are customer facing.
Nothing under `/api/portal/` can charge a card, send a payment link, or raise an
invoice against a file. The accounts screen can close a period, issue a
statement and set terms; it cannot bill a file.

## The table

| Step | Today |
| --- | --- |
| Create a client from nothing | Screen |
| Search or dedupe clients before creating | Does not exist |
| Open a file against the client | Screen |
| Set the service line | Screen |
| Set the deliverable or tier within the line | Does not exist. A file carries `service_slug` and no tier |
| Property, city, county, TWIA | Screen. The TWIA override is API only |
| Set urgency | Screen |
| Set a due date | API, no screen |
| Set a price | API, no screen, and nothing applies the catalog price or the coastal surcharge |
| Record a price override and its reason | Does not exist |
| Record how the job arrived, and who took the call | Does not exist |
| Take payment, or send a payment link | Does not exist |
| Invoice against an account with credit | Does not exist for a file |
| Open a job deliberately unpaid, and say so | Does not exist. Every operator created file is implicitly unpaid and nothing states it |
| Move to needs dispatch | Screen |
| Dispatch a technician | Screen, blocked on any service line with no published protocol |
| Audit trail of the above | Written for file creation and for transitions |

## One thing the walk exposed that is not on the list

The clients table holds five clients, three of them duplicate "Stripe Probe"
rows differing only by timestamp. There is no client search and no duplicate
check, so the failure mode Section 1 item 2 describes, the same solar installer
becoming four clients, is not hypothetical. It has already happened to probe
data on development and would happen to real clients the same way.

## What this gate does not say

It does not say the pieces are missing. Dispatch, the file state machine, the
catalog, pricing, the compliance gate and the audit trail all exist and work.
What is missing is the path a person walks from a telephone call to a dispatched
technician, and the two fields that path needs to carry: a price, and a payment.
