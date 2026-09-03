# The 254 operations platform: the program, and where it stands

The internal operating system of an engineering firm that runs remotely. This
file records the phase order, what has shipped, and the specifications for what
has not, so a session picking this up mid program does not have to reconstruct it
from chat history.

Each phase is its own branch off main, merged on the operator's word, built
against the development Supabase project. See CLAUDE.md section 6b for the two
databases and the guard between them.

## Status

**This table went stale and is now a pointer. `docs/platform-state.md` is the
state of the platform; when the two disagree, that file is newer.**

The table below said phases 4 through 7 had not started, for some time after all
four had shipped. It is kept rather than deleted because the specifications
further down this file are still the specifications, and a reader needs to know
which parts of this document to trust.

| Phase | Branch | State as of 2026-09-03, at `a2d1637` |
| --- | --- | --- |
| 0. Foundation, auth, roles, shell | `feat/ops-foundation` | Merged, deployed, verified on production |
| 1. Clients, contacts, files, the state machine | `feat/ops-crm` | Merged, deployed, verified on production |
| 2. Dispatch and field operations | `feat/ops-field` | Merged, deployed |
| 3. Field tech onboarding | `feat/ops-tech-onboarding` | Merged, deployed |
| 4. Engineer review and responsible charge | `feat/ops-engineer-review` | Merged, deployed |
| 5. Tasks, communication, notifications | `feat/ops-comms` | Merged, deployed |
| 6. Documents, billing hooks, dashboards | `feat/ops-documents-dashboards` | Merged, deployed |
| 7. The order engine | `feat/ops-order-engine` | Merged, deployed. Migrations 0006 and 0007 applied to production; schema fingerprint matches development |
| 7b. Stuck order attention, firm cancellation | `feat/ops-order-attention` | Merged, deployed |

Everything above is on this repository only. The order flow does not exist on
`sealedengineering` or `stampmyplans` yet, which is the largest open item in
`BACKLOG.md`.

## Phase 2, as built

Protocol authoring, dispatch by coverage and certification, offer accept and
decline, protocol driven capture with the device camera and an offline queue,
the submission gate, and the administrator's roster with a coverage map and the
pay ledger.

### What is deliberately not there, and why

**Nothing geocodes.** Dispatch ranks by open workload and then by straight line
distance, and distance needs two points. There is no geocoder in this stack, and
the county geometry in this repo is projected screen coordinates rather than
latitude and longitude, so it cannot be used to derive one. An administrator
enters a technician's base once on the roster; a property's coordinates are a
column nothing fills automatically. Until both exist for a given file, the
ranking is workload and then name, and the dispatch screen says which side is
missing rather than implying a proximity nobody measured.

**The offline queue survives signal loss, not a cold start.** Captures are held
in IndexedDB and upload when connectivity returns, with the tab open. There is
no service worker, so a technician who closes the tab in a dead zone cannot
reopen the app until they have signal. That is the case that actually happens on
a two hour inspection; the cold start case is a separate piece of work and is in
BACKLOG.md rather than half done.

**Certification is set against the record, not earned.** Dispatch reads
eng_certifications and refuses anybody not certified for the service line. The
workflow that produces a certification, the training run and the score, is Phase
3.

### Rulings this phase settled

**A file reaches dispatched by acceptance, never by sending offers.** Offering
changes nothing about a file's status. The rule now lives in canTransition,
which takes `assignedTech` alongside `prelaunch`, and refuses the move when
nobody is on the file. A file marked dispatched with nobody on it is not a
status, it is a lie.

**A technician's pay is written at submission, not at seal.** What they were
paid for is the visit, and the visit is done. Whether the engineer later requests
a revision is a separate question about the work. This is the same principle the
operator set for Phase 4 refunds, pointed at the other end of the file: no money
rule may create pressure on an engineer's conclusion, and a technician's fee that
depended on the engineer's finding would be exactly that.

**Holding an offer is not holding the job.** Several technicians can read the
same checklist while deciding. Only the one who accepted may capture against it.

**A published protocol is never edited, only superseded.** Files in flight are
being worked to it.

### Two new actions in the authorization matrix

`evidence.start` and `evidence.submit`, held by all three roles. They exist
because a technician had no way to move their own file out of dispatched without
being handed `files.transition`, which would have let them move anything
anywhere. `actionFor` now takes the pair rather than the destination, because
evidence submitted is reachable from evidence in progress and from under review,
and those are two different acts: a technician finishing a capture, and an
engineer reopening a file. Keyed on the destination alone, a technician could
pull a file back from the engineer holding it.

## Phase 3, as built

The applicant to dispatchable path, and the two gates that decide whether a
technician can be offered work.

### What the existing onboarding system was missing

It never ended anywhere. Invite tokens, a per hire checklist, a private bucket
and an operator verification step all existed and are good. What did not exist
was the join to dispatch: a completed onboarding was a folder of accepted
documents, and somebody then created an account by hand, retyped the coverage,
and remembered the insurance expiry.

Activation is that join, and it is the one irreversible step in the phase.

### The two holes this closed, both of which were worse than omissions

**The roster's expiry warning could never fire.** eng_credentials carried
expires_on from the start, with an index and a comment saying the Phase 2 alerts
read it, and nothing ever wrote a row. An operator seeing an empty expiry panel
concludes nothing is expiring.

**Dispatch ignored paperwork entirely.** Three gates, none of them about whether
the technician was insured. Credentials are now the fourth, ordered last of the
four so an operator meets the reasons in the order they can act on them: status,
coverage, certification, credentials.

**The certification gate had no door.** planDispatch refused anybody without a
certified row and the only way to get one was writing it into the table by hand.

### Rulings this phase settled

**Expired blocks, expiring warns.** A technician whose insurance renews next
Tuesday can work on Monday. A certificate expiring today is valid today.

**A lapsed optional certificate still blocks.** It is a worse state than never
having uploaded one, because it means the firm believed there was cover.

**A renewal beside a lapsed copy wins.** Otherwise keeping records is what
blocks somebody and the fix looks like deleting them.

**Every question on a protocol check must be right, and retakes are free.**
There is no such thing as eighty percent of an evidence package. The pressure
that a strict mark would create is released the other way: the reasoning for
every wrong answer appears immediately, retakes cost nothing, and attempts are
counted rather than held against anybody.

**A revoked certification is not undone by retaking.** Revocation is an act by
the engineer in responsible charge. It comes back the way it went.

**Nothing reads a document.** Expiry dates are typed by the person holding the
card or the operator verifying it. There is no OCR and there will not be: the
firm needs the document, not the data off it, and a date a machine pulled off a
phone photograph is a date nobody checked.

**Coverage counties are validated against the canonical 254 before storage,**
because dispatch matches on the string and a typo silently excludes somebody
from every job in a place they cover while the roster shows coverage as set.

### Still open

The legacy /admin/onboarding screens still exist and now overlap this. They are
not deleted, because they are the surface the operator uses today and the invite
flow the applicant sees lives under /onboarding/[token], which is unchanged.
Retiring them is a separate piece of work.

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

### Operator rulings on payment and refunds, 2026-09-02

These are settled. The questions that produced them are kept below, because a
ruling with no visible question reads as an arbitrary preference to whoever
inherits it.

**1. Capture at submission, refund on decline.** Not authorize and capture later.
A card authorization expires in about seven days and an engineer's review plus a
revision cycle may not fit inside that, so a deferred capture can fail after the
work is already done. A refund is a worse outcome for the firm's cash flow and a
far better one for the customer, and it never leaves the firm holding completed
work it cannot bill.

**2. The refund rule, in three cases.** Disclosed at checkout in plain language,
before payment, not in a terms link nobody opens.

| What happened | The customer receives |
| --- | --- |
| Declined before any visit or review | Full refund |
| Declined after a technician visited | Refund less the disclosed inspection fee, and the engineer's findings |
| Declined after desk review, no visit | Full refund |

**The principle that governs this rule and any future change to it: no refund
rule may create financial pressure on the engineer toward a favourable
conclusion.**

That sentence is the reason the middle row is written the way it is. The customer
pays for the inspection whether or not the answer is the one they wanted, so
neither the firm nor the engineer is better off when the answer is yes. A rule
that refunded the visit on a decline would quietly pay the firm more for
certifying than for refusing, which is the exact incentive a professional
engineering practice must not have.

**3. County and coastal pricing differences appear as a named line item** at the
price step. Never as an unexplained higher total. A customer comparing a Nueces
property against a published inland price will notice the difference; finding out
afterwards is how a fixed price stops feeling fixed.

**4. The compliance gate goes in the customer terms as well as the code.** It is
what makes the order engine lawful to operate, not a launch toggle.

### A consequence of ruling 2 that reaches into Phase 4

The principle in ruling 2 is about the refund rule, and it does not stop there.

Phase 4 as specified writes an engineer production ledger entry **per sealed
document**, from the fee schedule tier. Read alongside ruling 2, that is the same
incentive the ruling exists to forbid, one layer in: an engineer who seals is
paid, and an engineer who reviews the same package and declines is not. The
pressure the refund rule was carefully drained of is reintroduced by the payroll.

This is not a defect in anything built yet, because Phase 4 does not exist. It is
a design constraint on it, recorded here so it is decided rather than
discovered:

- **Production pay should attach to the review, not to the seal.** A completed
  review is the work. Sealing is the conclusion, and paying for one conclusion
  and not the other is paying for the conclusion.
- A declined file should therefore write a production entry too, at the same
  tier, and the responsible charge log already records refusals, so the two
  records agree about what happened.
- If the operator prefers a different resolution, it needs to be a deliberate one
  with the reasoning written down, because the alternative is a payroll rule that
  contradicts a stated ethical principle in the same repository.

Raised at specification time rather than at implementation time, since by
implementation time the fee schedule will have rows in it.

### The questions that produced those rulings

Kept for the reasoning, not because they are still open. All four were ruled on
2026-09-02 and the rulings are above.

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
