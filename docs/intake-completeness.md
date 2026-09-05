# Intake completeness, Section A: what the firm needs and does not ask for

Phase 10 Section 1.5, Section A. Report and stop, before anything is built.

Measured 2026-09-04 from the catalog, the protocol templates on development, and
the intake surfaces as they stand. Nothing below is invented: where the answer is
not knowable from a primary source in this repository, it says so and is marked
for the engineer.

## The finding that outranks the rest

**Eight of the nine service lines have no protocol at all.**

There is exactly one protocol template in the system: `windstorm-wpi-8` v1,
published, six evidence items. Every other line has none, which means the
platform's own answer to "what does a technician capture on this job" does not
exist for roof certifications, foundation inspections, manufactured home
certifications, solar letters, structural letters, repair specifications, the
three design deliverables, or forensic work.

That has a direct consequence for question 1 of this section. **What an engineer
needs in front of them to seal a document is an engineering judgment, and for
eight of nine lines this repository contains nothing to derive it from.** I am
not going to invent it. Those eight are marked for the engineer below and the
question stays open until a licensed PE answers it.

It also means the gate 0 finding was understated. `docs/phase-10-gate-0.md`
recorded that a roof certification cannot be dispatched because no protocol
exists for the line. That is true of eight lines, not one.

## What each deliverable asks for today

Eleven deliverables across nine lines. Every one has exactly one qualifying
question except `custom-package`, which has none. Twenty six required inputs in
total.

| Deliverable | Type | Asks today |
| --- | --- | --- |
| Roof certification letter | field | access notes (req), prior roof report (opt) |
| WPI-8E windstorm evaluation | field | access notes (req), permit or plans (opt) |
| Foundation certification | field | access notes (req), what made you order this (opt) |
| Manufactured home foundation certification | field | access notes (req), HUD label or data plate (opt) |
| Solar structural letter | desk | array layout (req), mounting details (req), roof framing (opt) |
| Structural letter for permit | desk | what the letter must say and who asked for it (req), documents (req) |
| Repair specification | desk | assessment report (req), photographs (req) |
| Beam and header sizing | desk | span and load (req), plan or sketch (req), material preference (opt) |
| Carport and patio cover plan set | desk | dimensions (req), site photographs (req), reviewing jurisdiction (opt) |
| Custom foundation and framing package | quote | what are you building (req), drawings (opt), deadline (opt) |
| Forensic investigation | quote | what happened and what is in dispute (req), documents (opt) |

The qualifiers are gating questions, not capture: they decide whether the firm
may take the job, which is what the brief says they were written for.

## The three questions, answered where they can be

### 1. What the engineer needs to seal it

**Answerable for one deliverable.** `windstorm-wpi-8` requires four elevations,
roof covering close and wide, deck attachment where visible, roof pitch in
twelfths, and opening protection described. That is the protocol, and it is the
platform's only statement of what an engineer needs.

**Unknown, and marked for the engineer, for the other ten.** No protocol exists.
Writing one from general practice would be me deciding what a Texas PE needs to
put a seal on a document, which is the one thing in this build I have no standing
to do.

### 2. What a technician needs before driving

`access_notes` is required on all four field deliverables and its help text asks
for "gate codes, dogs, who will be there, and anything about the property that
would waste a trip". So the firm does ask, once, as free text.

What free text cannot do is be checked. Nothing can tell a dispatcher that a job
is missing an access arrangement, because a sentence saying "call Bob" and a
sentence saying "no idea" are the same shape. Every item in the brief's access
list, gated, dogs, alarm, appointment window, occupancy, is answerable inside
that field and none of it is answerable *about* that field.

The seven desk and quote deliverables ask nothing about access, correctly: nobody
drives to them.

### 3. What the document needs to be usable

**This is the weakest area and the brief is right that it is where jobs stall.**

Of eleven deliverables, exactly one asks who the document is for:
`structural-letters` asks "what does the letter need to say, and who asked for
it", as free text. One asks which jurisdiction reviews it
(`carport-patio-plan-set`, optional). One asks for a date (`custom-package`,
optional).

Nothing anywhere captures, in a form the platform can act on:

- who the document is addressed to, or where it is sent
- who else receives a copy
- the reason it is needed, and therefore what it has to say
- the deadline that reason creates, as distinct from a preferred turnaround
- the party imposing the requirement and their reference number
- whether a specific form or format is mandatory

A lender wanting a letter made out to them by name, and an insurer wanting their
own reference on it, are both invisible to this platform today. Both produce a
sealed document that has to be reissued, and reissuing a sealed document is the
most expensive kind of rework this firm has.

## Section B, field by field, against what exists

**Captured.** Who is paying (client and contact). How the job arrived
(`intake_channel`, added in 0015). Property address, city, county, TWIA status.
Urgency. A due date, on the file, settable by the operator.

**Partially captured, as unstructured text.** Access, occupancy, who will be
present, and site constraints, all inside `access_notes` on field jobs only.
Who asked for the document, inside `structural-letters` free text only. Prior
reports, permits and HUD labels, as optional file uploads on three deliverables.
The reviewing jurisdiction, on one.

**Absent everywhere.** Property owner if different from the payer. A contact at
the property distinct from the buyer. Document addressee and delivery. Copy
recipients. The reason for the document. The deadline that reason creates. The
requiring party and their reference. Required form or format. Property type,
occupancy as a field, year built, storeys, roof pitch as an intake fact,
foundation type, framing. Prior windstorm certificate numbers. Permit numbers.
Transferable warranties. Whether the client is a repeat client and on what terms,
which the platform knows from `eng_customer_accounts` and never surfaces at
intake. Any price or turnaround promised verbally, except that the operator
intake now records a price override with its reason.

**Needed for some lines and not others.** Year built and construction date matter
for windstorm and are irrelevant to a beam sizing. Foundation type matters to
foundation work. Panel and racking specification matter to solar and to nothing
else. The brief is right that this is per deliverable, which is why the catalog
is the only honest place to define it.

## The gap I introduced, reported before anybody finds it

**The operator intake I built in Section 1 does not ask the catalog's
`requiredInputs` at all.**

A roof certification ordered on the website captures access notes, required, and
optionally a prior roof report. **The same job taken by telephone captures
neither.** The New job screen asks for the client, the work, the property, the
price, the payment decision and how the job arrived, and then stops.

That directly fails Section 1.5's acceptance test, which is that a job ordered
through the customer flow and the same job taken by telephone must produce files
carrying identical information. It does not today, and the telephone path is the
one the firm says is primary.

It is a gap rather than a defect in what shipped: nothing claims those fields are
captured, and no screen shows a value that is not there. But it is the first
thing Section C has to fix, and it is mine.

## What I recommend Section C does, in order

1. **Move the per deliverable inputs into one definition in the catalog**, which
   is where `requiredInputs` already lives, and add the three timing states the
   brief describes: required to order, required before dispatch, required before
   sealing. The catalog already keys on `(serviceSlug, tier)`, which is what
   `eng_files.deliverable` now records, so a file can finally be asked what it is
   missing.
2. **Make the operator intake render that same definition**, closing the gap
   above, and make a partner referral render the subset a partner could know.
3. **Add the document-usability fields**, which are the ones with no engineering
   judgment in them and the ones causing reissues: addressee, delivery, copies,
   reason, requiring party and reference, hard deadline, required format.
4. **Leave the engineering-judgment fields for the engineer.** What an engineer
   needs to seal each of eight lines is not derivable from this repository, and
   the honest move is to build the mechanism now and let a PE fill it in, rather
   than ship a guess that looks authoritative.

## What is not answered here, and who has to answer it

- The evidence protocol for eight of nine service lines. Engineer.
- Whether any of those lines has a mandatory external form. Engineer, or the
  jurisdiction.
- Whether a windstorm certificate number, a permit number or a transferable
  warranty changes what the firm may certify. Engineer.

Nothing in this document should be read as those questions having been answered.
