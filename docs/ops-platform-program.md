# The 254 operations platform: the program, and where it stands

The internal operating system of an engineering firm that runs remotely. This
file records the phase order, what has shipped, and the specifications for what
has not, so a session picking this up mid program does not have to reconstruct it
from chat history.

Each phase is its own branch off main, merged on the operator's word, built
against the development Supabase project. See CLAUDE.md section 6b for the two
databases and the guard between them.

## Status

| Phase | Branch | State |
| --- | --- | --- |
| 0. Foundation, auth, roles, shell | `feat/ops-foundation` | Merged, deployed, verified on production |
| 1. Clients, contacts, files, the state machine | `feat/ops-crm` | Approved by the operator; merge pending its suite |
| 2. Dispatch and field operations | `feat/ops-field` | In progress |
| 3. Field tech onboarding | not started | |
| 4. Engineer review and responsible charge | not started | |
| 5. Tasks, communication, notifications | not started | |
| 6. Documents, billing hooks, dashboards | not started | |
| 7. The order engine | not started | Specified below. Blocked on 2 and 4. |

## Phase 7: the order engine, automated intake across all three brands

Specified by the operator on 2026-09-02. **It builds after Phase 2 and Phase 4**,
because orders flow into both: a field order dispatches through Phase 2 and a
desk order lands in the Phase 4 review queue. Building it before those exist
would mean writing the intake against two interfaces that do not yet have a
shape, which is how a foundation acquires the wrong one.

### The goal

Most of the firm's volume should arrive without a phone call. A customer picks a
deliverable, answers the questions that determine whether the firm can do it and
what it costs, pays, provides what the engineer needs, and receives a sealed
document. The firm's people appear only where judgment is required.

Automated: qualification, pricing, payment, evidence intake, dispatch, status,
delivery.

**Never automated, by law and by the firm's own doctrine:** the professional
engineer's review and the decision to seal. The order engine delivers a complete,
correctly scoped package to the engineer. It never decides that a document may be
sealed, never predicts an outcome, and never states or implies that a seal is
guaranteed by paying. Copy suggesting otherwise fails voice-audit.

### Product model

One catalog module, read by all three sites and the platform. Per service: order
type, published price or quote flag, qualifying questions, required inputs,
evidence protocol reference, turnaround expectation, and what the customer
receives. A price change happens in one place.

1. **Fixed price, desk review.** No site visit. Customer uploads what the
   engineer needs. Solar structural letters, plan review letters, letters derived
   from documents.
2. **Fixed price, field evidence.** Requires a technician visit. Roof, foundation,
   manufactured home foundation, windstorm. Priced by service and county band.
   Dispatched automatically on payment.
3. **Quote required.** Custom design, forensic and expert work, anything a scope
   addendum governs. Captures the project and creates a quote request, not an
   order.

### The customer flow

Built once as a shared embeddable flow, rendered on all three sites with each
brand's own tokens, copy, and voice. Native to whichever site it appears on,
never a third party widget.

Service selection (entered from a service page, so nobody picks twice) →
qualification (a disqualifying answer ends the flow honestly with where to go
instead) → property (address validated, county derived, TWIA consequences
applied) → requirements (the exact inputs from the catalog) → price and terms →
Stripe → confirmation.

**The refusal path is explicit at the price step, not buried.** The engineer
reviews and may require revisions, an additional visit, or may decline. The
customer is told what happens to their payment in each case *before* they pay.

Quote services follow the same flow through requirements, then submit a quote
request instead of a payment.

### The platform side

- One order intake API, called server side by all three sites, authenticated per
  site with a key, never from the browser.
- It creates the client if new, creates the File, sets service, tier, county,
  price, and attribution, attaches uploads as evidence, and moves the file to
  needs dispatch (field) or under review (desk).
- Auto dispatch on payment for field types, through Phase 2's rules. No human
  touches it unless nobody accepts within a threshold, which raises an alert.
- Quote requests are a quote object with a pipeline: new, scoping, sent,
  accepted, declined, expired. One action converts an accepted quote to an order.
- Every order writes the audit trail. Attribution carries from the site's UTM
  capture. Margin computes from published price minus tech cost minus engineer
  production pay.

### The customer portal

Minimal, tokenized, no account required, at a signed URL emailed to the customer.
Order status in plain language, what is happening now, what is needed from them,
messages to the firm on that order, and the sealed deliverable when ready. Status
changes trigger branded emails.

This is what removes the "where is my letter" calls, which will otherwise become
the firm's largest support cost.

### The compliance gate, absolute

While LAUNCH_MODE is prelaunch, **no order can be placed and no payment taken on
any of the three sites.** The flow renders as a waitlist, with published prices
shown as launch pricing if the operator approves that, or pricing withheld if
not. The platform refuses order intake with a clear error. Verified in both modes
by launch-audit across all three sites.

### What the firm still does by hand, and why

Stated so nobody later mistakes the gap for an oversight:

- The engineer reviews every evidence package and decides whether to seal. That
  is the product and is never automated.
- Custom and forensic work is scoped by a person.
- Anything qualification flags as ambiguous routes to a human.
- Disputes, unusual properties, and anything where the customer's answers
  contradict the evidence go to the operator.

The automation exists so that a person is only involved where a person adds
something.

### Verification required before merge

Order flow demonstrated end to end on each of the three sites against dev: a desk
order arriving in the engineer's queue with uploads attached, a field order
dispatching automatically to a certified tech, and a quote request landing and
converting. Payment in Stripe test mode with the refund rule exercised. The
customer portal across a full status lifecycle. Both launch modes on all three
sites. All audits green including a new `order-audit` asserting catalog
integrity, price consistency across sites, and that no site can place an order in
prelaunch.

### Open questions for the operator, raised at specification time

These are design decisions the spec does not settle and that should not be
settled by whoever writes the code.

**1. The Stripe authorization window versus the review timeline.** The spec says
authorize on submission and capture per policy. A card authorization expires,
typically in seven days. If an engineer's review plus any revision cycle runs
longer than that, the authorization is dead and the capture fails after the work
is done. Either capture at submission and refund on decline, or authorize and
accept that some captures will need re-authorization, which means asking the
customer for their card again at the worst possible moment. This needs a decision
before the payment code is written.

**2. Taking payment for engineering services requires the registration.** The
compliance gate covers prelaunch. Worth stating explicitly that the gate is what
makes the whole order engine lawful to operate at all, and that it is not a
marketing toggle.

**3. Refunds on decline are a policy, not a mechanism.** "The engineer may
decline" plus "the customer paid" needs a written rule covering: declined before
any visit, declined after a technician has already driven out, and declined after
review found the property uncertifiable. The technician was paid in at least two
of those. Whether the customer is refunded in full, less the visit, or not at
all, is a commercial decision with a consumer protection dimension.

**4. County band pricing on the coast.** The spec allows coastal counties to
price differently. If that is a surcharge it should be named as one to the
customer at the price step, because a customer comparing a quote for a Nueces
property against a published price for an inland one will notice.
